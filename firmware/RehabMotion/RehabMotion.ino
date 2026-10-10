/*
 * RehabMotion firmware for Adafruit Feather nRF52832 + two MPU-6050s.
 *
 * MPU addresses: 0x68 (AD0 to GND, upper arm) and 0x69 (AD0 to 3V, forearm).
 *
 * This board is BLE-only. It will NOT appear in macOS Bluetooth settings.
 * The Python bridge finds it by service 0xFFF0 and name RehabMotion.
 *
 * Battery: Feather A7 / P0.31 is the 2:1 VBAT divider.
 * Charging: nRF52832 Feather does not wire MCP73831 STAT to a GPIO, so charge
 * state is inferred from the VBAT trend. Yellow CHARGE LED on the board is
 * still the hardware truth.
 */

#include <bluefruit.h>
#include <string.h>
#include <Wire.h>

static const uint8_t MPU_UPPER = 0x68;
static const uint8_t MPU_FORE = 0x69;
static const uint8_t MPU_PWR = 0x6B;
static const uint8_t MPU_ACCEL = 0x3B;
static const uint8_t MPU_WHOAMI = 0x75;

#ifndef PIN_VBAT
#define PIN_VBAT A7
#endif

static const char DEVICE_NAME[] = "RehabMotion";
static const uint16_t PACKET_LEN = 52;
static const uint16_t FRAME_MS = 19; // ~52 Hz
static const uint16_t MIN_MTU = PACKET_LEN + 3; // notify payload is MTU - 3

BLEDis bledis;
BLEBas blebas;
BLEService motionService(0xFFF0);
BLECharacteristic motionChar(0xFFF1);
BLECharacteristic commandChar(0xFFF2);

bool upperOk = false;
bool foreOk = false;
uint8_t batteryPercent = 0;
uint8_t charging = 0;
uint8_t chargeFull = 0;
float batteryVolts = 0.0f;
float voltageEma = 0.0f;
uint8_t riseCount = 0;
uint32_t lastFrameMs = 0;
uint32_t lastBatteryMs = 0;
uint32_t lastLogMs = 0;

bool mpuWrite(uint8_t addr, uint8_t reg, uint8_t value) {
  Wire.beginTransmission(addr);
  Wire.write(reg);
  Wire.write(value);
  return Wire.endTransmission() == 0;
}

bool mpuRead(uint8_t addr, uint8_t reg, uint8_t *buffer, uint8_t length) {
  Wire.beginTransmission(addr);
  Wire.write(reg);
  if (Wire.endTransmission(false) != 0) {
    return false;
  }
  if (Wire.requestFrom(addr, length) != length) {
    return false;
  }
  for (uint8_t i = 0; i < length; i++) {
    buffer[i] = Wire.read();
  }
  return true;
}

bool mpuBegin(uint8_t addr) {
  uint8_t who = 0;
  if (!mpuRead(addr, MPU_WHOAMI, &who, 1)) {
    return false;
  }
  if (who != 0x68) {
    return false;
  }
  if (!mpuWrite(addr, MPU_PWR, 0x00)) {
    return false;
  }
  delay(10);
  mpuWrite(addr, 0x1B, 0x00); // +/- 250 dps
  mpuWrite(addr, 0x1C, 0x00); // +/- 2 g
  mpuWrite(addr, 0x1A, 0x03); // low-pass
  return true;
}

bool mpuSample(uint8_t addr, float *out6) {
  uint8_t raw[14];
  if (!mpuRead(addr, MPU_ACCEL, raw, 14)) {
    memset(out6, 0, 6 * sizeof(float));
    return false;
  }
  int16_t ax = (int16_t)((raw[0] << 8) | raw[1]);
  int16_t ay = (int16_t)((raw[2] << 8) | raw[3]);
  int16_t az = (int16_t)((raw[4] << 8) | raw[5]);
  int16_t gx = (int16_t)((raw[8] << 8) | raw[9]);
  int16_t gy = (int16_t)((raw[10] << 8) | raw[11]);
  int16_t gz = (int16_t)((raw[12] << 8) | raw[13]);
  const float g = 9.80665f;
  out6[0] = (ax / 16384.0f) * g;
  out6[1] = (ay / 16384.0f) * g;
  out6[2] = (az / 16384.0f) * g;
  const float dps = 131.0f;
  const float deg2rad = 0.01745329252f;
  out6[3] = (gx / dps) * deg2rad;
  out6[4] = (gy / dps) * deg2rad;
  out6[5] = (gz / dps) * deg2rad;
  return true;
}

uint8_t voltsToPercent(float v) {
  const float points[][2] = {
      {3.30f, 0},  {3.40f, 5},  {3.50f, 12}, {3.60f, 22}, {3.70f, 35},
      {3.80f, 48}, {3.90f, 62}, {4.00f, 76}, {4.10f, 90}, {4.20f, 100},
  };
  if (v <= points[0][0]) {
    return 0;
  }
  if (v >= 4.20f) {
    return 100;
  }
  for (uint8_t i = 1; i < 10; i++) {
    if (v <= points[i][0]) {
      float span = points[i][0] - points[i - 1][0];
      float t = (v - points[i - 1][0]) / span;
      float pct = points[i - 1][1] + t * (points[i][1] - points[i - 1][1]);
      if (pct < 0) {
        return 0;
      }
      if (pct > 100) {
        return 100;
      }
      return (uint8_t)(pct + 0.5f);
    }
  }
  return 100;
}

void updateBattery() {
  uint32_t sum = 0;
  for (uint8_t i = 0; i < 8; i++) {
    sum += analogRead(PIN_VBAT);
  }
  float volts = (sum / 8.0f) * 2.0f * 3.3f / 1024.0f;
  if (voltageEma <= 0.1f) {
    voltageEma = volts;
  } else {
    voltageEma = 0.85f * voltageEma + 0.15f * volts;
  }
  if (volts > voltageEma + 0.008f) {
    if (riseCount < 20) {
      riseCount++;
    }
  } else if (volts + 0.008f < voltageEma) {
    if (riseCount > 0) {
      riseCount--;
    }
  }
  batteryVolts = voltageEma;
  batteryPercent = voltsToPercent(voltageEma);
  chargeFull = (voltageEma >= 4.16f && riseCount < 3) ? 1 : 0;
  charging = (!chargeFull && riseCount >= 4) ? 1 : 0;
  blebas.write(batteryPercent);
}

void packFloat(uint8_t *dest, float value) {
  memcpy(dest, &value, 4);
}

void sendFrame() {
  float upper[6] = {0};
  float fore[6] = {0};
  upperOk = mpuSample(MPU_UPPER, upper);
  foreOk = mpuSample(MPU_FORE, fore);

  uint8_t payload[PACKET_LEN];
  for (uint8_t i = 0; i < 6; i++) {
    packFloat(payload + i * 4, upper[i]);
    packFloat(payload + (6 + i) * 4, fore[i]);
  }
  uint8_t flags = 0;
  if (upperOk) {
    flags |= 0x01;
  }
  if (foreOk) {
    flags |= 0x02;
  }
  payload[48] = batteryPercent;
  payload[49] = charging;
  payload[50] = flags;
  payload[51] = chargeFull;

  if (motionChar.notifyEnabled()) {
    motionChar.notify(payload, PACKET_LEN);
  }
}

bool linkReadyForNotify() {
  if (!Bluefruit.connected()) {
    return false;
  }
  BLEConnection *conn = Bluefruit.Connection(Bluefruit.connHandle());
  if (conn == NULL) {
    return false;
  }
  return conn->getMtu() >= MIN_MTU;
}

void startAdvertising() {
  Bluefruit.Advertising.clearData();
  Bluefruit.ScanResponse.clearData();
  Bluefruit.Advertising.addFlags(BLE_GAP_ADV_FLAGS_LE_ONLY_GENERAL_DISC_MODE);
  Bluefruit.Advertising.addTxPower();
  Bluefruit.Advertising.addService(motionService);
  // Keep the 16-bit UUID + short name in the 31-byte adv packet so macOS
  // CoreBluetooth can see this device without a scan response.
  Bluefruit.Advertising.addName();
  Bluefruit.ScanResponse.addName();
  Bluefruit.Advertising.restartOnDisconnect(true);
  Bluefruit.Advertising.setInterval(32, 160); // 20 ms .. 100 ms
  Bluefruit.Advertising.setFastTimeout(30);
  Bluefruit.Advertising.start(0);
}

void connect_callback(uint16_t conn_handle) {
  BLEConnection *conn = Bluefruit.Connection(conn_handle);
  conn->requestMtuExchange(247);
  // 20-40 ms is stable on macOS; 52-byte notifies before MTU exchange
  // will drop the link, so sendFrame() waits until getMtu() >= 55.
  conn->requestConnectionParameter(16, 32, 0, 400);
  Serial.print("BLE connected, handle ");
  Serial.println(conn_handle);
}

void disconnect_callback(uint16_t conn_handle, uint8_t reason) {
  (void)conn_handle;
  Serial.print("BLE disconnected, reason 0x");
  Serial.println(reason, HEX);
}

void command_write_callback(uint16_t conn_handle, BLECharacteristic *chr, uint8_t *data, uint16_t len) {
  (void)conn_handle;
  (void)chr;
  if (len < 1 || data[0] != 0x01) {
    return;
  }
  upperOk = mpuBegin(MPU_UPPER);
  foreOk = mpuBegin(MPU_FORE);
  Serial.print("MPU re-probe 0x68=");
  Serial.print(upperOk ? "ok" : "MISSING");
  Serial.print(" 0x69=");
  Serial.println(foreOk ? "ok" : "MISSING");
}

void setup() {
  Serial.begin(115200);
  pinMode(PIN_VBAT, INPUT);
  analogReadResolution(10);

  Wire.begin();
  Wire.setClock(400000);
  delay(40);
  upperOk = mpuBegin(MPU_UPPER);
  foreOk = mpuBegin(MPU_FORE);

  Bluefruit.configPrphBandwidth(BANDWIDTH_MAX);
  Bluefruit.begin();
  Bluefruit.setTxPower(4);
  Bluefruit.setName(DEVICE_NAME);
  Bluefruit.Periph.setConnectCallback(connect_callback);
  Bluefruit.Periph.setDisconnectCallback(disconnect_callback);

  bledis.setManufacturer("MotionRehab");
  bledis.setModel("Feather nRF52832");
  bledis.begin();
  blebas.begin();

  motionService.begin();
  motionChar.setProperties(CHR_PROPS_READ | CHR_PROPS_NOTIFY);
  motionChar.setPermission(SECMODE_OPEN, SECMODE_NO_ACCESS);
  motionChar.setMaxLen(PACKET_LEN);
  motionChar.setFixedLen(PACKET_LEN);
  motionChar.begin();

  commandChar.setProperties(CHR_PROPS_WRITE | CHR_PROPS_WRITE_WO_RESP);
  commandChar.setPermission(SECMODE_OPEN, SECMODE_OPEN);
  commandChar.setFixedLen(1);
  commandChar.setWriteCallback(command_write_callback);
  commandChar.begin();

  updateBattery();
  startAdvertising();

  Serial.println("RehabMotion advertising as BLE name RehabMotion, service 0xFFF0");
  Serial.print("MPU 0x68 ");
  Serial.print(upperOk ? "ok" : "MISSING");
  Serial.print(" | MPU 0x69 ");
  Serial.println(foreOk ? "ok" : "MISSING");
}

void loop() {
  uint32_t now = millis();
  if (now - lastBatteryMs >= 400) {
    lastBatteryMs = now;
    updateBattery();
  }
  if (linkReadyForNotify() && now - lastFrameMs >= FRAME_MS) {
    lastFrameMs = now;
    sendFrame();
  }
  if (now - lastLogMs >= 2000) {
    lastLogMs = now;
    Serial.print("adv=");
    Serial.print(Bluefruit.Advertising.isRunning() ? "yes" : "no");
    Serial.print(" conn=");
    Serial.print(Bluefruit.connected() ? "yes" : "no");
    Serial.print(" vbat=");
    Serial.print(batteryVolts, 2);
    Serial.print("V ");
    Serial.print(batteryPercent);
    Serial.print("% ");
    Serial.print(charging ? "charging" : (chargeFull ? "full" : "on battery"));
    Serial.print(" mpu68=");
    Serial.print(upperOk ? "ok" : "no");
    Serial.print(" mpu69=");
    Serial.println(foreOk ? "ok" : "no");
  }
}

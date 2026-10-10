# Motion bridge

The browser never connects to Bluetooth. This process owns the nRF52832
connection and exposes clean JSON at `ws://127.0.0.1:8765`.

## Setup

```bash
cd bridge
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
```

## Run without hardware

```bash
python main.py --simulate
```

This produces upper-arm and forearm IMU readings, local bone quaternions,
elbow angle, connection status, and calibration responses at about 52 Hz.

## Run with BLE

The nRF52832 will **not** appear in macOS Bluetooth settings. Flash
`firmware/RehabMotion`, then:

```bash
python main.py --ble
```

The bridge scans for service `0xFFF0` and name `RehabMotion`. If the board
uses a different name or you already know the address:

```bash
MOTION_BLE_NAME=RehabMotion \
MOTION_BLE_ADDRESS= \
python main.py --ble
```

A successful connect logs `Connected to RehabMotion`. If it cannot find the
board it prints every nearby BLE advertisement so you can copy a name or
address.

The motion notification is a fixed **52-byte** packet at about **52 Hz**:
twelve little-endian `float32` IMU values (upper arm then forearm,
`ax, ay, az, gx, gy, gz`), then battery percent, charging, MPU flags,
and charge-complete. Short packets are ignored instead of dropping BLE.

## Commands

Clients may send:

```json
{"type":"command","command":"calibrate"}
{"type":"command","command":"record_start"}
{"type":"command","command":"record_stop"}
```

Recordings are newline-delimited JSON in `bridge/recordings/`.

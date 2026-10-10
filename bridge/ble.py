"""BLE source with an intentionally isolated firmware packet parser."""

from __future__ import annotations

import asyncio
import json
import logging
import math
import struct
import time
from collections.abc import Awaitable, Callable
from typing import Any, Optional

from config import (
    BINARY_PACKET_BYTES,
    BINARY_PACKET_FORMAT,
    BINARY_TRAILER_FORMAT,
    BLE_BATTERY_UUID,
    BLE_CHARACTERISTIC_UUID,
    BLE_COMMAND_UUID,
    BLE_DEVICE_ADDRESS,
    BLE_DEVICE_NAME,
    BLE_SERVICE_UUID,
    SAMPLE_RATE_HZ,
)
from orientation import Calibration, Quaternion, flexion_quaternion

Emitter = Callable[[dict[str, Any]], Awaitable[None]]
LOGGER = logging.getLogger("motion.ble")
IMU_BYTES = struct.calcsize(BINARY_PACKET_FORMAT)
TRAILER_BYTES = struct.calcsize(BINARY_TRAILER_FORMAT)
PACKET_BYTES = BINARY_PACKET_BYTES


def _norm_uuid(value: str) -> str:
    text = value.lower().strip()
    if len(text) == 4:
        return "0000{0}-0000-1000-8000-00805f9b34fb".format(text)
    return text


MOTION_SERVICE = _norm_uuid(BLE_SERVICE_UUID)
MOTION_CHAR = _norm_uuid(BLE_CHARACTERISTIC_UUID)
COMMAND_CHAR = _norm_uuid(BLE_COMMAND_UUID)
BATTERY_CHAR = _norm_uuid(BLE_BATTERY_UUID)


def parse_sensor_packet(data: bytes) -> dict[str, Any]:
    """Parse JSON or the 12-float firmware packet, with optional battery trailer.

    Keeping this function separate is deliberate: once the nRF firmware packet
    is final, this is the only bridge function that should need to change.
    """
    if data[:1] in (b"{", b"["):
        payload = json.loads(data.decode("utf-8"))
        sensors = payload.get("sensors", payload)
        parsed = {
            "upperArm": _reading(sensors["upperArm"]),
            "forearm": _reading(sensors["forearm"]),
            "upperOk": True,
            "foreOk": True,
        }
        if "battery" in payload:
            parsed["battery"] = int(payload["battery"])
        if "charging" in payload:
            parsed["charging"] = bool(payload["charging"])
        if payload.get("voltage") is not None:
            parsed["batteryVoltage"] = float(payload["voltage"])
        if payload.get("chargeState"):
            parsed["chargeState"] = str(payload["chargeState"])
        return parsed

    if len(data) >= PACKET_BYTES:
        data = data[:PACKET_BYTES]
    elif len(data) != IMU_BYTES:
        # Truncated MTU fragments used to raise and tear down the BLE link.
        return None
    values = struct.unpack_from(BINARY_PACKET_FORMAT, data)
    keys = ("ax", "ay", "az", "gx", "gy", "gz")
    parsed = {
        "upperArm": dict(zip(keys, values[:6])),
        "forearm": dict(zip(keys, values[6:])),
        "upperOk": True,
        "foreOk": True,
    }
    if len(data) >= PACKET_BYTES:
        percent, charging, flags, full = struct.unpack_from(
            BINARY_TRAILER_FORMAT, data, IMU_BYTES
        )
        parsed["battery"] = int(percent)
        parsed["charging"] = bool(charging)
        parsed["chargeState"] = _charge_state(bool(charging), bool(full), int(percent))
        parsed["upperOk"] = bool(flags & 0x01)
        parsed["foreOk"] = bool(flags & 0x02)
    return parsed


def _charge_state(charging: bool, full: bool, percent: int) -> str:
    if full or percent >= 99:
        return "full"
    if charging:
        return "charging"
    return "discharging"


def _reading(value: Any) -> dict[str, float]:
    keys = ("ax", "ay", "az", "gx", "gy", "gz")
    if not isinstance(value, dict):
        raise ValueError("Sensor reading must be an object")
    return {key: float(value[key]) for key in keys}


def _tilt_x(reading: dict[str, float]) -> float:
    return math.degrees(math.atan2(reading["ax"], reading["az"]))


def _matches(device: Any, adv: Any) -> bool:
    address = (getattr(device, "address", "") or "").lower()
    if BLE_DEVICE_ADDRESS and address == BLE_DEVICE_ADDRESS.lower():
        return True
    names = {
        getattr(device, "name", None),
        getattr(adv, "local_name", None),
    }
    names = {name for name in names if name}
    if any(name.lower() == BLE_DEVICE_NAME.lower() for name in names):
        return True
    uuids = {_norm_uuid(uuid) for uuid in (getattr(adv, "service_uuids", None) or [])}
    return MOTION_SERVICE in uuids


class BleSource:
    def __init__(self) -> None:
        self.sequence = 0
        self.calibration = Calibration()
        self.latest_raw: Optional[tuple] = None
        self.latest_angles = (0.0, 0.0)
        self.zero_elbow = 0.0
        self.queue: asyncio.Queue[bytes] = asyncio.Queue(maxsize=8)
        self.connected = False
        self.last_packet = 0.0
        self.measured_rate = 0.0
        self.battery: Optional[int] = None
        self.charging = False
        self.charge_state = "unknown"
        self.battery_voltage: Optional[float] = None
        self.upper_ok = False
        self.fore_ok = False
        self.device_label = BLE_DEVICE_NAME
        self.client = None

    async def command(self, command: str) -> Optional[dict[str, Any]]:
        if command == "calibrate":
            if self.latest_raw is None:
                return {
                    "type": "calibration_status",
                    "status": "failed",
                    "message": "No complete sensor frame is available.",
                }
            self.calibration.capture(*self.latest_raw)
            self.zero_elbow = self.latest_angles[1] - self.latest_angles[0]
            return {
                "type": "calibration_status",
                "status": "complete",
                "timestamp": int(time.time() * 1000),
            }
        if command == "calibration_clear":
            self.calibration.clear()
            return {"type": "calibration_status", "status": "not_calibrated"}
        if command == "refresh":
            client = self.client
            if client is not None:
                try:
                    await client.write_gatt_char(COMMAND_CHAR, b"\x01", response=False)
                    await asyncio.sleep(0.15)
                    LOGGER.info("Asked firmware to re-probe both MPUs")
                except Exception as exc:
                    LOGGER.info("MPU re-probe write skipped: %s", exc)
            return self._status()
        return {
            "type": "error",
            "code": "unknown_command",
            "message": "Unsupported command: {0}".format(command),
        }

    async def run(self, emit: Emitter) -> None:
        try:
            from bleak import BleakClient, BleakScanner
        except ImportError as exc:
            raise RuntimeError(
                "BLE mode requires bleak. Run: python -m pip install -r requirements.txt"
            ) from exc

        while True:
            await emit(self._status())
            try:
                device = await self._find_device(BleakScanner)
                LOGGER.info(
                    "Connecting to %s (%s)",
                    getattr(device, "name", None) or self.device_label,
                    getattr(device, "address", "?"),
                )
                async with BleakClient(device, timeout=20.0) as client:
                    self.client = client
                    self.connected = True
                    self.device_label = getattr(device, "name", None) or BLE_DEVICE_NAME
                    LOGGER.info("Connected to %s", self.device_label)
                    await emit(self._status())

                    def notification(_: Any, data: bytearray) -> None:
                        if self.queue.full():
                            try:
                                self.queue.get_nowait()
                            except asyncio.QueueEmpty:
                                pass
                        self.queue.put_nowait(bytes(data))

                    char_uuid = await self._motion_char(client)
                    await client.start_notify(char_uuid, notification)
                    LOGGER.info("Subscribed to motion characteristic %s", char_uuid)
                    try:
                        await client.start_notify(BATTERY_CHAR, self._battery_notify)
                    except Exception:
                        pass

                    while client.is_connected:
                        try:
                            data = await asyncio.wait_for(self.queue.get(), timeout=2.0)
                        except asyncio.TimeoutError:
                            await emit(self._status())
                            continue
                        try:
                            parsed = parse_sensor_packet(data)
                        except Exception as exc:
                            LOGGER.warning(
                                "Bad motion packet (%s bytes): %s", len(data), exc
                            )
                            continue
                        if parsed is None:
                            LOGGER.debug(
                                "Skipping short BLE packet (%s bytes), waiting for 52-byte frames",
                                len(data),
                            )
                            continue
                        await emit(self._frame(parsed))
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                LOGGER.warning("BLE source unavailable: %s", exc)
                await emit(
                    {
                        "type": "error",
                        "code": "ble_disconnected",
                        "message": str(exc),
                    }
                )
            finally:
                self.client = None
                self.connected = False
                self.upper_ok = False
                self.fore_ok = False
                await emit(self._status())
            await asyncio.sleep(2.0)

    async def _find_device(self, scanner_cls: Any) -> Any:
        LOGGER.info(
            "Scanning for BLE device %r (service %s)%s",
            BLE_DEVICE_NAME,
            MOTION_SERVICE,
            " address={0}".format(BLE_DEVICE_ADDRESS) if BLE_DEVICE_ADDRESS else "",
        )
        filtered = None
        try:
            filtered = await scanner_cls.discover(
                timeout=6.0,
                return_adv=True,
                service_uuids=[MOTION_SERVICE],
            )
        except Exception as exc:
            LOGGER.info("Service-filtered scan failed (%s); scanning all devices", exc)
        match = self._pick(filtered or {})
        if match is not None:
            return match

        LOGGER.info("No 0xFFF0 advert yet; scanning all nearby BLE devices")
        nearby = await scanner_cls.discover(timeout=8.0, return_adv=True)
        self._log_nearby(nearby)
        match = self._pick(nearby)
        if match is not None:
            return match
        raise RuntimeError(
            "BLE device {0!r} was not found. It will not appear in macOS "
            "Bluetooth settings. Flash firmware/RehabMotion and keep the board "
            "advertising (blue LED blinking).".format(BLE_DEVICE_NAME)
        )

    def _entries(self, discovered: Any):
        if isinstance(discovered, dict):
            for address, value in discovered.items():
                device, adv = value if isinstance(value, tuple) else (value, None)
                yield address, device, adv
        elif isinstance(discovered, list):
            for device in discovered:
                yield getattr(device, "address", ""), device, None

    def _pick(self, discovered: Any) -> Any:
        for _address, device, adv in self._entries(discovered):
            if _matches(device, adv):
                return device
        return None

    def _log_nearby(self, discovered: Any) -> None:
        rows = []
        for address, device, adv in self._entries(discovered):
            name = getattr(device, "name", None) or getattr(adv, "local_name", None) or "?"
            uuids = ",".join(getattr(adv, "service_uuids", None) or []) or "none"
            rows.append("{0} [{1}] uuids={2}".format(name, address, uuids))
        if rows:
            LOGGER.info("Nearby BLE devices:\n  %s", "\n  ".join(rows))
        else:
            LOGGER.info("No BLE advertisements seen. Check Mac Bluetooth and board power.")

    async def _motion_char(self, client: Any) -> str:
        services = getattr(client, "services", None)
        if services is None and hasattr(client, "get_services"):
            try:
                services = await client.get_services()
            except Exception:
                services = None
        chars = []
        mapping = getattr(services, "characteristics", None) if services is not None else None
        if isinstance(mapping, dict):
            chars = list(mapping.values())
        elif services is not None:
            try:
                for service in services:
                    chars.extend(list(getattr(service, "characteristics", []) or []))
            except TypeError:
                pass
        for char in chars:
            uuid = _norm_uuid(str(getattr(char, "uuid", "")))
            if uuid == MOTION_CHAR or uuid.endswith("fff1"):
                return str(char.uuid)
        return BLE_CHARACTERISTIC_UUID

    def _battery_notify(self, _: Any, data: bytearray) -> None:
        if not data:
            return
        self.battery = int(data[0])
        if self.charge_state == "unknown":
            self.charge_state = "discharging"

    def _status(self) -> dict[str, Any]:
        fresh = self.connected and time.monotonic() - self.last_packet < 1.0
        upper = fresh and self.upper_ok
        fore = fresh and self.fore_ok
        return {
            "type": "device_status",
            "source": "ble",
            "bleConnected": self.connected,
            "deviceName": self.device_label,
            "upperArmSensor": upper,
            "forearmSensor": fore,
            "handSensor": False,
            "sampleRate": round(self.measured_rate, 1),
            "battery": self.battery,
            "charging": self.charging,
            "chargeState": self.charge_state,
            "batteryVoltage": self.battery_voltage,
            "signalQuality": "good" if upper and fore else "missing",
            "calibrated": self.calibration.active,
        }

    def _frame(self, sensors: dict[str, Any]) -> dict[str, Any]:
        now = time.monotonic()
        if self.last_packet:
            instant_rate = 1.0 / max(now - self.last_packet, 0.0001)
            self.measured_rate += (instant_rate - self.measured_rate) * 0.12
        else:
            self.measured_rate = SAMPLE_RATE_HZ
        self.last_packet = now

        if sensors.get("battery") is not None:
            self.battery = int(sensors["battery"])
        if "charging" in sensors:
            self.charging = bool(sensors["charging"])
        if sensors.get("chargeState"):
            self.charge_state = str(sensors["chargeState"])
        elif self.battery is not None:
            self.charge_state = _charge_state(self.charging, False, self.battery)
        if sensors.get("batteryVoltage") is not None:
            self.battery_voltage = float(sensors["batteryVoltage"])
        self.upper_ok = bool(sensors.get("upperOk", True))
        self.fore_ok = bool(sensors.get("foreOk", True))

        upper_angle = _tilt_x(sensors["upperArm"])
        fore_angle = _tilt_x(sensors["forearm"])
        upper_raw = flexion_quaternion(upper_angle)
        fore_raw = flexion_quaternion(fore_angle)
        self.latest_raw = upper_raw, fore_raw
        self.latest_angles = upper_angle, fore_angle
        upper, fore = self.calibration.apply(upper_raw, fore_raw)
        elbow = max(
            0.0,
            fore_angle
            - upper_angle
            - (self.zero_elbow if self.calibration.active else 0.0),
        )
        self.sequence += 1
        return {
            "type": "motion_frame",
            "timestamp": int(time.time() * 1000),
            "sequence": self.sequence,
            "sensors": {
                "upperArm": sensors["upperArm"],
                "forearm": sensors["forearm"],
            },
            "orientation": {
                "upperArm": list(upper),
                "forearm": list(fore),
            },
            "joints": {
                "elbowFlexion": round(elbow, 2),
                "shoulderFlexion": round(upper_angle, 2),
            },
            "upperOk": self.upper_ok,
            "foreOk": self.fore_ok,
            "battery": self.battery,
            "charging": self.charging,
            "chargeState": self.charge_state,
            "batteryVoltage": self.battery_voltage,
        }

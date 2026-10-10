"""Bridge settings. Override these with environment variables for real hardware."""

from __future__ import annotations

import os

HOST = os.getenv("MOTION_WS_HOST", "127.0.0.1")
PORT = int(os.getenv("MOTION_WS_PORT", "8765"))
SAMPLE_RATE_HZ = float(os.getenv("MOTION_SAMPLE_RATE", "52"))

BLE_DEVICE_NAME = os.getenv("MOTION_BLE_NAME", "RehabMotion")
BLE_DEVICE_ADDRESS = os.getenv("MOTION_BLE_ADDRESS", "").strip()
BLE_SERVICE_UUID = os.getenv(
    "MOTION_BLE_SERVICE",
    "0000fff0-0000-1000-8000-00805f9b34fb",
)
BLE_CHARACTERISTIC_UUID = os.getenv(
    "MOTION_BLE_CHARACTERISTIC",
    "0000fff1-0000-1000-8000-00805f9b34fb",
)
BLE_COMMAND_UUID = os.getenv(
    "MOTION_BLE_COMMAND",
    "0000fff2-0000-1000-8000-00805f9b34fb",
)
BLE_BATTERY_UUID = "00002a19-0000-1000-8000-00805f9b34fb"

# Fixed 52-byte notification: twelve little-endian float32 IMU values
# (upper arm then forearm) plus battery percent, charging, MPU flags,
# and charge-complete.
BINARY_PACKET_FORMAT = "<12f"
BINARY_TRAILER_FORMAT = "<BBBB"
BINARY_PACKET_BYTES = 52

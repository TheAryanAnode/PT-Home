"""Deterministic two-sensor motion source for development and demos."""

from __future__ import annotations

import asyncio
import math
import time
from collections.abc import Awaitable, Callable
from typing import Any

from orientation import Calibration, Quaternion, flexion_quaternion

Emitter = Callable[[dict[str, Any]], Awaitable[None]]


class SimulatedSource:
    def __init__(self, sample_rate: float) -> None:
        self.sample_rate = sample_rate
        self.sequence = 0
        self.calibration = Calibration()
        self.latest_raw: tuple[Quaternion, Quaternion] = (
            flexion_quaternion(0),
            flexion_quaternion(5),
        )
        self.latest_angle = 5.0
        self.zero_angle = 5.0
        self.phase_started = time.monotonic()

    async def command(self, command: str) -> dict[str, Any] | None:
        if command == "calibrate":
            # A simulated calibration represents the patient holding the
            # documented rest pose, regardless of when the button is clicked.
            upper = flexion_quaternion(0)
            fore = flexion_quaternion(5)
            self.calibration.capture(upper, fore)
            self.zero_angle = 5.0
            self.phase_started = time.monotonic()
            return {
                "type": "calibration_status",
                "status": "complete",
                "timestamp": int(time.time() * 1000),
            }
        if command == "calibration_clear":
            self.calibration.clear()
            self.zero_angle = 0.0
            return {"type": "calibration_status", "status": "not_calibrated"}
        if command == "refresh":
            return self._status()
        return {
            "type": "error",
            "code": "unknown_command",
            "message": f"Unsupported command: {command}",
        }

    async def run(self, emit: Emitter) -> None:
        await emit(self._status())
        next_status = time.monotonic() + 1.0
        period = 1.0 / max(self.sample_rate, 1.0)
        while True:
            tick = time.monotonic()
            elapsed = tick - self.phase_started
            frame = self._frame(elapsed)
            await emit(frame)
            if tick >= next_status:
                await emit(self._status())
                next_status = tick + 1.0
            await asyncio.sleep(max(0.0, period - (time.monotonic() - tick)))

    def _status(self) -> dict[str, Any]:
        return {
            "type": "device_status",
            "source": "simulator",
            "bleConnected": True,
            "upperArmSensor": True,
            "forearmSensor": True,
            "handSensor": False,
            "sampleRate": self.sample_rate,
            "battery": 83,
            "charging": False,
            "chargeState": "discharging",
            "batteryVoltage": 3.94,
            "signalQuality": "good",
            "calibrated": self.calibration.active,
        }

    def _frame(self, elapsed: float) -> dict[str, Any]:
        # A smooth four-second bend: 5° -> 90° -> 5°.
        phase = (elapsed % 4.0) / 4.0
        lift = 0.5 - 0.5 * math.cos(phase * math.tau)
        elbow = 5.0 + 85.0 * lift
        shoulder = 2.0 * math.sin(phase * math.tau)
        wrist = 2.5 * math.sin(phase * math.tau + 0.7)
        elbow_velocity = 85.0 * (math.pi / 4.0) * math.sin(phase * math.tau)

        upper_raw = flexion_quaternion(shoulder)
        fore_raw = flexion_quaternion(elbow)
        self.latest_raw = upper_raw, fore_raw
        self.latest_angle = elbow
        upper, fore = self.calibration.apply(upper_raw, fore_raw)
        relative_elbow = elbow - self.zero_angle if self.calibration.active else elbow

        now_ms = int(time.time() * 1000)
        self.sequence += 1
        noise_a = 0.025 * math.sin(elapsed * 19.0)
        noise_g = 0.005 * math.sin(elapsed * 31.0)
        return {
            "type": "motion_frame",
            "timestamp": now_ms,
            "sequence": self.sequence,
            "sensors": {
                "upperArm": {
                    "ax": round(noise_a, 4),
                    "ay": round(-0.12 * math.sin(math.radians(shoulder)), 4),
                    "az": round(9.81 + noise_a, 4),
                    "gx": round(math.radians(2.0) + noise_g, 5),
                    "gy": 0.0,
                    "gz": 0.0,
                },
                "forearm": {
                    "ax": round(9.81 * math.sin(math.radians(elbow)), 4),
                    "ay": round(0.02 * math.cos(elapsed * 13.0), 4),
                    "az": round(9.81 * math.cos(math.radians(elbow)), 4),
                    "gx": round(math.radians(elbow_velocity) + noise_g, 5),
                    "gy": round(math.radians(wrist), 5),
                    "gz": 0.0,
                },
            },
            "orientation": {
                "upperArm": [round(value, 7) for value in upper],
                "forearm": [round(value, 7) for value in fore],
            },
            "joints": {
                "elbowFlexion": round(max(0.0, relative_elbow), 2),
                "shoulderFlexion": round(shoulder, 2),
                "wristFlexion": round(wrist, 2),
            },
            "upperOk": True,
            "foreOk": True,
            "battery": 83,
            "charging": False,
            "chargeState": "discharging",
            "batteryVoltage": 3.94,
        }

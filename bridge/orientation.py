"""Small quaternion helpers shared by simulated and BLE sources."""

from __future__ import annotations

import math
from dataclasses import dataclass

Quaternion = tuple[float, float, float, float]

IDENTITY: Quaternion = (0.0, 0.0, 0.0, 1.0)


def normalize(q: Quaternion) -> Quaternion:
    length = math.sqrt(sum(value * value for value in q)) or 1.0
    return tuple(value / length for value in q)  # type: ignore[return-value]


def multiply(a: Quaternion, b: Quaternion) -> Quaternion:
    ax, ay, az, aw = a
    bx, by, bz, bw = b
    return normalize(
        (
            aw * bx + ax * bw + ay * bz - az * by,
            aw * by - ax * bz + ay * bw + az * bx,
            aw * bz + ax * by - ay * bx + az * bw,
            aw * bw - ax * bx - ay * by - az * bz,
        )
    )


def inverse(q: Quaternion) -> Quaternion:
    x, y, z, w = normalize(q)
    return (-x, -y, -z, w)


def flexion_quaternion(degrees: float) -> Quaternion:
    """Match the web avatar: flexion is a negative local-X rotation."""
    half = math.radians(-degrees) / 2.0
    return (math.sin(half), 0.0, 0.0, math.cos(half))


@dataclass
class Calibration:
    upper_zero: Quaternion = IDENTITY
    fore_zero: Quaternion = IDENTITY
    active: bool = False

    def capture(self, upper: Quaternion, fore: Quaternion) -> None:
        self.upper_zero = normalize(upper)
        self.fore_zero = normalize(fore)
        self.active = True

    def clear(self) -> None:
        self.upper_zero = IDENTITY
        self.fore_zero = IDENTITY
        self.active = False

    def apply(
        self, upper: Quaternion, fore: Quaternion
    ) -> tuple[Quaternion, Quaternion]:
        if not self.active:
            return normalize(upper), normalize(fore)
        return (
            multiply(inverse(self.upper_zero), upper),
            multiply(inverse(self.fore_zero), fore),
        )

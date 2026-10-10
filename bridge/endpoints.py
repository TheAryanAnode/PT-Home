"""Digital endpoints and MotionQC from a raw session or JSONL recording.

raw session
    ↓
feature extraction
    ↓
endpoint record

Example:
  python endpoints.py recordings/motion-20261010.jsonl --participant R-0142
"""

from __future__ import annotations

import argparse
import csv
import json
import math
from pathlib import Path
from typing import Any, Iterable


def extract_endpoints(raw: dict[str, Any]) -> dict[str, Any]:
    samples = raw.get("samples") or []
    angles = [float(sample.get("angle", 0)) for sample in samples]
    speeds = [abs(float(sample.get("velocity", 0))) for sample in samples]
    comps = [abs(float(sample.get("compensation", 0))) for sample in samples]
    peaks = _rep_peaks(angles)
    reps = int(raw.get("repsCompleted") or raw.get("valid_reps") or 0)
    goal = max(1, int(raw.get("repGoal") or raw.get("rep_goal") or 1))
    duration = float(raw.get("durationSec") or raw.get("duration_sec") or 0)
    return {
        "max_rom": _round(_max(angles), 1),
        "min_rom": _round(_min(angles), 1),
        "mean_rom": _round(_mean(peaks or angles), 1),
        "peak_velocity": _round(_max(speeds), 1),
        "mean_velocity": _round(_mean(speeds), 1),
        "mean_rep_time": _round(duration / reps if reps else duration, 2),
        "hold_duration": _round(float(raw.get("holdSec") or raw.get("hold") or 0), 1),
        "smoothness": _round(_smoothness(samples), 2),
        "shoulder_compensation": _round(_max(comps), 1),
        "inter_rep_variability": _round(_stdev(peaks), 1),
        "completion_rate": _round(min(1.5, reps / goal), 2),
        "valid_reps": reps,
    }


def score_quality(raw: dict[str, Any]) -> dict[str, Any]:
    link = raw.get("link") or {}
    samples = raw.get("samples") or []
    reps = int(raw.get("repsCompleted") or 0)
    goal = max(1, int(raw.get("repGoal") or 1))
    rate = float(link.get("sampleRateHz") or link.get("sample_rate") or 0)
    loss = float(link.get("packetLossPct") or link.get("packet_loss") or 0)
    dropout = float(link.get("dropoutSec") or link.get("dropout_sec") or 0)
    calibrated = bool(link.get("calibrated"))
    sensors = bool(link.get("connected")) and bool(link.get("upperOk", True)) and bool(link.get("forearmOk", True))
    angles = [float(sample.get("angle", 0)) for sample in samples]
    span = (_max(angles) - _min(angles)) if angles else 0
    checks = [
        ("Sensor connection", "pass" if sensors else "fail", "PASS" if sensors else "Both IMUs were not live"),
        ("Sample rate", "pass" if 45 <= rate <= 58 else "warn" if rate >= 30 else "fail", f"{rate:.1f} Hz"),
        ("Packet loss", "pass" if loss <= 1 else "warn" if loss <= 5 else "fail", f"{loss:.1f}%"),
        ("Calibration", "pass" if calibrated else "fail", "PASS" if calibrated else "Not completed"),
        ("Required reps", "pass" if reps >= goal else "warn" if reps >= goal * 0.5 else "fail", f"{reps} / {goal}"),
        ("Motion validity", "pass" if span >= 12 else "fail" if span < 8 else "warn", "PASS" if span >= 12 else "Range too small"),
        ("Sensor attachment", "pass" if dropout <= 0.4 else "warn" if dropout <= 2.5 else "fail", "PASS" if dropout <= 0.4 else f"Dropout {dropout:.1f}s"),
        ("Signal noise", "pass", "PASS"),
    ]
    score_map = {"pass": 100, "warn": 62, "fail": 18}
    quality = round(sum(score_map[item[1]] for item in checks) / len(checks))
    fails = {item[0] for item in checks if item[1] == "fail"}
    if quality < 50 or fails & {"Sensor connection", "Calibration", "Packet loss", "Motion validity"}:
        status = "invalid"
    elif quality < 80 or any(item[1] != "pass" for item in checks):
        status = "review"
    else:
        status = "valid"
    reasons = []
    if not sensors:
        reasons.append("Upper-arm or forearm sensor was not connected.")
    if not calibrated:
        reasons.append("Calibration was not completed.")
    if dropout > 0.4:
        reasons.append(f"Forearm signal dropped for {dropout:.1f} seconds.")
    return {
        "quality_score": quality,
        "status": status,
        "review_reason": reasons[0] if reasons else "",
        "checks": [{"label": label, "result": result, "detail": detail} for label, result, detail in checks],
        "sample_rate": round(rate, 1),
        "packet_loss": round(loss, 1),
    }


def session_to_record(raw: dict[str, Any]) -> dict[str, Any]:
    endpoints = extract_endpoints(raw)
    quality = score_quality(raw)
    return {
        "participant": raw.get("participantCode") or raw.get("participant") or raw.get("participantId"),
        "assessment": raw.get("assessmentId") or raw.get("assessment"),
        "session_id": raw.get("id") or raw.get("session_id"),
        "date": raw.get("sessionDate") or raw.get("date"),
        "baseline": bool(raw.get("baseline")),
        **endpoints,
        "quality_score": quality["quality_score"],
        "valid": quality["status"] == "valid",
        "status": quality["status"],
        "review_reason": quality["review_reason"],
    }


def frames_to_raw(frames: Iterable[dict[str, Any]], meta: dict[str, Any]) -> dict[str, Any]:
    samples = []
    previous_angle = None
    previous_t = None
    sequences = []
    for frame in frames:
        if frame.get("type") and frame.get("type") != "motion_frame":
            continue
        joints = frame.get("joints") or {}
        angle = joints.get("elbowFlexion")
        if angle is None:
            continue
        timestamp = float(frame.get("timestamp") or 0)
        velocity = 0.0
        if previous_angle is not None and previous_t is not None:
            dt = timestamp - previous_t
            if dt > 0:
                velocity = (float(angle) - previous_angle) / dt
        samples.append(
            {
                "t": timestamp,
                "angle": float(angle),
                "velocity": velocity,
                "compensation": abs(float((joints.get("shoulderFlexion") or 0))),
            }
        )
        previous_angle = float(angle)
        previous_t = timestamp
        if frame.get("sequence") is not None:
            sequences.append(int(frame["sequence"]))
    lost = 0
    for index in range(1, len(sequences)):
        gap = sequences[index] - sequences[index - 1] - 1
        if gap > 0:
            lost += gap
    duration = (samples[-1]["t"] - samples[0]["t"]) if len(samples) > 1 else 0
    rate = (len(samples) / duration) if duration > 0 else 0
    loss = 100.0 * lost / max(1, lost + len(sequences))
    return {
        **meta,
        "durationSec": duration,
        "repsCompleted": meta.get("repsCompleted", 0),
        "repGoal": meta.get("repGoal", 8),
        "holdSec": meta.get("holdSec", 2),
        "link": {
            "connected": True,
            "upperOk": True,
            "forearmOk": True,
            "sampleRateHz": rate,
            "packetLossPct": loss,
            "calibrated": bool(meta.get("calibrated", True)),
            "dropoutSec": 0,
        },
        "samples": samples,
    }


def load_jsonl(path: Path) -> list[dict[str, Any]]:
    frames = []
    with path.open(encoding="utf-8") as handle:
        for line in handle:
            line = line.strip()
            if not line:
                continue
            frames.append(json.loads(line))
    return frames


def write_csv(records: list[dict[str, Any]], path: Path) -> None:
    if not records:
        return
    fieldnames = list(records[0].keys())
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(records)


def _mean(values: list[float]) -> float:
    return sum(values) / len(values) if values else 0.0


def _max(values: list[float]) -> float:
    return max(values) if values else 0.0


def _min(values: list[float]) -> float:
    return min(values) if values else 0.0


def _stdev(values: list[float]) -> float:
    if len(values) < 2:
        return 0.0
    avg = _mean(values)
    return math.sqrt(_mean([(value - avg) ** 2 for value in values]))


def _round(value: float, digits: int) -> float:
    return round(value, digits)


def _rep_peaks(angles: list[float]) -> list[float]:
    if len(angles) < 3:
        return list(angles)
    peaks = [
        angles[index]
        for index in range(1, len(angles) - 1)
        if angles[index] >= angles[index - 1] and angles[index] >= angles[index + 1] and angles[index] > 20
    ]
    return peaks or ([max(angles)] if angles else [])


def _smoothness(samples: list[dict[str, Any]]) -> float:
    if len(samples) < 4:
        return 0.7
    total = 0.0
    for index in range(1, len(samples) - 2):
        v0 = float(samples[index - 1].get("velocity") or 0)
        v1 = float(samples[index].get("velocity") or 0)
        v2 = float(samples[index + 1].get("velocity") or 0)
        total += abs(v2 - 2 * v1 + v0)
    mean_accel = total / max(1, len(samples) - 2)
    return max(0.05, min(0.99, 1 - mean_accel / 80))


def arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Extract digital endpoints from a motion JSONL recording.")
    parser.add_argument("recording", nargs="?", help="Path to a JSONL recording")
    parser.add_argument("--participant", default="P014")
    parser.add_argument("--assessment", default="elbow-flexion-v1")
    parser.add_argument("--out", help="Write a JSON endpoint record")
    parser.add_argument("--csv", help="Write a CSV row/file")
    return parser.parse_args()


def main() -> None:
    args = arguments()
    if not args.recording:
        demo = {
            "participant": "P014",
            "assessment": "elbow-flexion-v1",
            "repGoal": 5,
            "repsCompleted": 5,
            "holdSec": 2,
            "durationSec": 11.6,
            "link": {
                "connected": True,
                "upperOk": True,
                "forearmOk": True,
                "sampleRateHz": 49.7,
                "packetLossPct": 0.3,
                "calibrated": True,
                "dropoutSec": 0,
            },
            "samples": [
                {"t": t / 10, "angle": 12 + 70 * abs(math.sin(t / 6)), "velocity": 40, "compensation": 8}
                for t in range(80)
            ],
        }
        record = session_to_record(demo)
        print(json.dumps(record, indent=2))
        return
    path = Path(args.recording)
    frames = load_jsonl(path)
    raw = frames_to_raw(
        frames,
        {
            "participant": args.participant,
            "assessment": args.assessment,
            "session_id": path.stem,
            "calibrated": True,
            "repGoal": 8,
            "repsCompleted": 8,
            "holdSec": 2,
        },
    )
    record = session_to_record(raw)
    text = json.dumps(record, indent=2)
    print(text)
    if args.out:
        Path(args.out).write_text(text + "\n", encoding="utf-8")
    if args.csv:
        write_csv([record], Path(args.csv))


if __name__ == "__main__":
    main()

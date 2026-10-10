"""JSONL session recorder controlled by WebSocket commands."""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Any, TextIO


class Recorder:
    def __init__(self, root: Path | None = None) -> None:
        self.root = root or Path(__file__).parent / "recordings"
        self._file: TextIO | None = None
        self.path: Path | None = None

    @property
    def active(self) -> bool:
        return self._file is not None

    def start(self) -> Path:
        self.stop()
        self.root.mkdir(parents=True, exist_ok=True)
        stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        self.path = self.root / f"motion-{stamp}.jsonl"
        self._file = self.path.open("a", encoding="utf-8")
        return self.path

    def write(self, message: dict[str, Any]) -> None:
        if self._file is None or message.get("type") != "motion_frame":
            return
        self._file.write(json.dumps(message, separators=(",", ":")) + "\n")
        self._file.flush()

    def stop(self) -> Path | None:
        path = self.path
        if self._file is not None:
            self._file.close()
        self._file = None
        return path

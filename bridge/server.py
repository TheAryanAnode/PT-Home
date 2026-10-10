"""Single local WebSocket endpoint for motion data and commands."""

from __future__ import annotations

import asyncio
import json
import logging
from collections.abc import Awaitable, Callable
from typing import Any, Optional

from websockets.asyncio.server import ServerConnection, serve

from record import Recorder

LOGGER = logging.getLogger("motion.server")
CommandHandler = Callable[[str], Awaitable[Optional[dict[str, Any]]]]


class MotionServer:
    def __init__(self, host: str, port: int, recorder: Recorder) -> None:
        self.host = host
        self.port = port
        self.recorder = recorder
        self.clients: set[ServerConnection] = set()
        self.latest_frame: dict[str, Any] | None = None
        self.latest_status: dict[str, Any] | None = None
        self.command_handler: CommandHandler | None = None

    async def emit(self, message: dict[str, Any]) -> None:
        kind = message.get("type")
        if kind == "motion_frame":
            self.latest_frame = message
        elif kind == "device_status":
            self.latest_status = message
        self.recorder.write(message)
        if not self.clients:
            return
        encoded = json.dumps(message, separators=(",", ":"))
        clients = tuple(self.clients)
        results = await asyncio.gather(
            *(client.send(encoded) for client in clients),
            return_exceptions=True,
        )
        for client, result in zip(clients, results):
            if isinstance(result, Exception):
                self.clients.discard(client)

    async def _send_snapshot(self, websocket: ServerConnection) -> None:
        for message in (self.latest_status, self.latest_frame):
            if message is not None:
                await websocket.send(json.dumps(message, separators=(",", ":")))

    async def _handle_command(
        self, websocket: ServerConnection, raw: str | bytes
    ) -> None:
        try:
            message = json.loads(raw)
            if message.get("type") != "command":
                raise ValueError("Expected a command message")
            command = str(message.get("command", ""))
            if command == "record_start":
                path = self.recorder.start()
                reply: dict[str, Any] | None = {
                    "type": "recording_status",
                    "status": "recording",
                    "path": str(path),
                }
            elif command == "record_stop":
                path = self.recorder.stop()
                reply = {
                    "type": "recording_status",
                    "status": "stopped",
                    "path": str(path) if path else None,
                }
            elif command == "refresh":
                if self.command_handler is not None:
                    reply = await self.command_handler(command)
                else:
                    reply = self.latest_status
                if reply is not None:
                    await self.emit(reply)
                if self.latest_frame is not None:
                    await websocket.send(
                        json.dumps(self.latest_frame, separators=(",", ":"))
                    )
                return
            elif self.command_handler is not None:
                reply = await self.command_handler(command)
            else:
                reply = None
            if reply is not None:
                await self.emit(reply)
        except (json.JSONDecodeError, ValueError, TypeError) as exc:
            await websocket.send(
                json.dumps(
                    {
                        "type": "error",
                        "code": "bad_command",
                        "message": str(exc),
                    }
                )
            )

    async def _client(self, websocket: ServerConnection) -> None:
        self.clients.add(websocket)
        LOGGER.info("Web client connected (%d total)", len(self.clients))
        try:
            await self._send_snapshot(websocket)
            async for raw in websocket:
                await self._handle_command(websocket, raw)
        finally:
            self.clients.discard(websocket)
            LOGGER.info("Web client disconnected (%d total)", len(self.clients))

    async def run(self) -> None:
        LOGGER.info("WebSocket listening on ws://%s:%d", self.host, self.port)
        async with serve(self._client, self.host, self.port):
            await asyncio.Future()

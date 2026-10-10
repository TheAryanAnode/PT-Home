#!/usr/bin/env python3
"""Motion bridge entrypoint.

Examples:
  python main.py --simulate
  python main.py --ble
"""

from __future__ import annotations

import argparse
import asyncio
import logging

from ble import BleSource
from config import HOST, PORT, SAMPLE_RATE_HZ
from record import Recorder
from server import MotionServer
from simulate import SimulatedSource


def arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="BLE/simulator to WebSocket bridge")
    source = parser.add_mutually_exclusive_group()
    source.add_argument(
        "--simulate",
        action="store_true",
        help="Generate a two-sensor elbow-flexion stream (default).",
    )
    source.add_argument(
        "--ble",
        action="store_true",
        help="Connect to the configured nRF52832 over BLE.",
    )
    parser.add_argument("--host", default=HOST)
    parser.add_argument("--port", type=int, default=PORT)
    parser.add_argument("--rate", type=float, default=SAMPLE_RATE_HZ)
    parser.add_argument("--verbose", action="store_true")
    return parser.parse_args()


async def run(args: argparse.Namespace) -> None:
    recorder = Recorder()
    server = MotionServer(args.host, args.port, recorder)
    motion_source = BleSource() if args.ble else SimulatedSource(args.rate)
    server.command_handler = motion_source.command
    server_task = asyncio.create_task(server.run(), name="websocket-server")
    source_task = asyncio.create_task(
        motion_source.run(server.emit), name="motion-source"
    )
    try:
        await asyncio.gather(server_task, source_task)
    finally:
        server_task.cancel()
        source_task.cancel()
        await asyncio.gather(server_task, source_task, return_exceptions=True)
        recorder.stop()


def main() -> None:
    args = arguments()
    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
    mode = "BLE" if args.ble else "simulator"
    logging.getLogger("motion").info("Starting %s motion bridge", mode)
    try:
        asyncio.run(run(args))
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()

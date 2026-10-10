import { useEffect } from 'react'
import {
  markMotionTimedOut,
  processMotionMessage,
  setCalibrating,
  setSocketConnected,
} from './motionStore.ts'
import { parseMotionMessage, type MotionCommand } from './types.ts'

const MOTION_URL =
  import.meta.env.VITE_MOTION_WS_URL ?? 'ws://127.0.0.1:8765'

let socket: WebSocket | null = null
let consumers = 0
let reconnectTimer: number | null = null
let stopTimer: number | null = null
let heartbeatTimer: number | null = null
let retry = 0
let generation = 0

function connect() {
  if (
    consumers === 0 ||
    socket?.readyState === WebSocket.OPEN ||
    socket?.readyState === WebSocket.CONNECTING
  ) {
    return
  }
  const currentGeneration = ++generation
  const next = new WebSocket(MOTION_URL)
  socket = next

  next.addEventListener('open', () => {
    if (currentGeneration !== generation) return
    retry = 0
    setSocketConnected(true)
  })
  next.addEventListener('message', (event) => {
    if (currentGeneration !== generation || typeof event.data !== 'string') return
    const message = parseMotionMessage(event.data)
    if (message) processMotionMessage(message)
  })
  next.addEventListener('close', () => {
    if (currentGeneration !== generation) return
    socket = null
    setSocketConnected(false)
    scheduleReconnect()
  })
  next.addEventListener('error', () => {
    // close follows error in browsers; reconnection is scheduled there.
  })
}

function scheduleReconnect() {
  if (consumers === 0 || reconnectTimer !== null) return
  const delay = Math.min(5_000, 300 * 2 ** retry)
  retry = Math.min(retry + 1, 6)
  reconnectTimer = window.setTimeout(() => {
    reconnectTimer = null
    connect()
  }, delay)
}

function start() {
  consumers += 1
  if (stopTimer !== null) {
    window.clearTimeout(stopTimer)
    stopTimer = null
  }
  if (consumers > 1) return
  connect()
  heartbeatTimer = window.setInterval(() => markMotionTimedOut(), 250)
}

function stop() {
  consumers = Math.max(0, consumers - 1)
  if (consumers > 0 || stopTimer !== null) return
  // A short delay makes React StrictMode's mount/unmount check connection-safe.
  stopTimer = window.setTimeout(() => {
    stopTimer = null
    if (consumers > 0) return
    generation += 1
    if (reconnectTimer !== null) window.clearTimeout(reconnectTimer)
    if (heartbeatTimer !== null) window.clearInterval(heartbeatTimer)
    reconnectTimer = null
    heartbeatTimer = null
    socket?.close()
    socket = null
    setSocketConnected(false)
  }, 100)
}

export function useMotionStream() {
  useEffect(() => {
    start()
    return stop
  }, [])
}

export function sendMotionCommand(command: MotionCommand) {
  if (socket?.readyState !== WebSocket.OPEN) return false
  if (command === 'calibrate') setCalibrating()
  socket.send(JSON.stringify({ type: 'command', command }))
  return true
}

export function reconnectMotionStream() {
  if (reconnectTimer !== null) {
    window.clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
  retry = 0
  generation += 1
  const previous = socket
  socket = null
  previous?.close()
  connect()
}

export function motionSocketUrl() {
  return MOTION_URL
}

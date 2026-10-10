import { useEffect, useRef, type RefObject } from 'react'
import { createArm, writeArm, type ArmPose } from './types.ts'

type LoopArgs<T extends { arm: ArmPose }> = {
  timeRef: RefObject<number>
  playingRef: RefObject<boolean>
  speedRef: RefObject<number>
  sampleRef: RefObject<(time: number) => T>
  poseRef: RefObject<ArmPose>
  onFrameRef?: RefObject<((frame: T, time: number) => void) | null>
  onHudRef?: RefObject<((frame: T, time: number) => void) | null>
}

export function useMotionLoop<T extends { arm: ArmPose }>({
  timeRef,
  playingRef,
  speedRef,
  sampleRef,
  poseRef,
  onFrameRef,
  onHudRef,
}: LoopArgs<T>) {
  useEffect(() => {
    let last = performance.now()
    let hud = 0
    let id = 0
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      if (playingRef.current) timeRef.current += dt * speedRef.current
      const frame = sampleRef.current(timeRef.current)
      writeArm(poseRef.current, frame.arm)
      onFrameRef?.current?.(frame, timeRef.current)
      hud += dt
      if (hud > 0.1) {
        hud = 0
        onHudRef?.current?.(frame, timeRef.current)
      }
      id = requestAnimationFrame(tick)
    }
    id = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(id)
  }, [onFrameRef, onHudRef, playingRef, poseRef, sampleRef, speedRef, timeRef])
}

export function useSim<T extends { arm: ArmPose }>(
  sample: (time: number) => T,
  initial: ArmPose,
  autoplay = true,
) {
  const timeRef = useRef(0)
  const playingRef = useRef(autoplay)
  const speedRef = useRef(1)
  const poseRef = useRef(createArm(initial))
  const sampleRef = useRef(sample)
  const onFrameRef = useRef<((frame: T, time: number) => void) | null>(null)
  const onHudRef = useRef<((frame: T, time: number) => void) | null>(null)
  sampleRef.current = sample
  useMotionLoop({ timeRef, playingRef, speedRef, sampleRef, poseRef, onFrameRef, onHudRef })
  return { timeRef, playingRef, speedRef, poseRef, onFrameRef, onHudRef }
}

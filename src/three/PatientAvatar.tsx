import { useFrame } from '@react-three/fiber'
import { useRef, type ComponentProps, type RefObject } from 'react'
import type { ArmPose } from '../motion/types.ts'
import { Humanoid } from '../rig/Humanoid.tsx'
import { getLatestMotionFrame } from '../sensors/motionStore.ts'
import { applyMotionFrameToPose, createLiveArmPose } from './BoneController.ts'

type HumanoidProps = ComponentProps<typeof Humanoid>
type PatientAvatarProps = Omit<HumanoidProps, 'pose' | 'poseRef'> & {
  livePoseRef?: RefObject<ArmPose>
  tracking?: boolean
}

export function PatientAvatar({
  livePoseRef,
  tracking = true,
  ...props
}: PatientAvatarProps) {
  const internalPoseRef = useRef(createLiveArmPose())
  const poseRef = livePoseRef ?? internalPoseRef
  const previousSequence = useRef<number | null>(null)

  useFrame(() => {
    if (!tracking) return
    const frame = getLatestMotionFrame()
    if (!frame || frame.sequence === previousSequence.current) return
    previousSequence.current = frame.sequence
    applyMotionFrameToPose(poseRef.current, frame)
  })

  return <Humanoid {...props} poseRef={poseRef} />
}

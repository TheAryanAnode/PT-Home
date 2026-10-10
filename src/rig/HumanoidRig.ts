import * as THREE from 'three'

export type HumanoidRig = {
  hips: THREE.Bone
  spine: THREE.Bone
  spine1: THREE.Bone
  spine2: THREE.Bone
  neck: THREE.Bone
  head: THREE.Bone
  rightShoulder: THREE.Bone
  rightUpperArm: THREE.Bone
  rightForearm: THREE.Bone
  rightHand: THREE.Bone
  leftShoulder: THREE.Bone
  leftUpperArm: THREE.Bone
  leftForearm: THREE.Bone
  leftHand: THREE.Bone
  rightUpLeg: THREE.Bone
  rightLeg: THREE.Bone
  rightFoot: THREE.Bone
  leftUpLeg: THREE.Bone
  leftLeg: THREE.Bone
  leftFoot: THREE.Bone
}

/** Names a loader may see, in the order we prefer. */
export const BONE_ALIASES: Record<keyof HumanoidRig, readonly string[]> = {
  hips: ['Hips', 'mixamorigHips'],
  spine: ['Spine', 'mixamorigSpine'],
  spine1: ['Spine1', 'mixamorigSpine1'],
  spine2: ['Spine2', 'mixamorigSpine2'],
  neck: ['Neck', 'mixamorigNeck'],
  head: ['Head', 'mixamorigHead'],
  rightShoulder: ['RightShoulder', 'mixamorigRightShoulder'],
  rightUpperArm: ['RightUpperArm', 'mixamorigRightArm', 'CC_Base_R_Upperarm'],
  rightForearm: ['RightForeArm', 'mixamorigRightForeArm', 'CC_Base_R_Forearm'],
  rightHand: ['RightHand', 'mixamorigRightHand', 'CC_Base_R_Hand'],
  leftShoulder: ['LeftShoulder', 'mixamorigLeftShoulder'],
  leftUpperArm: ['LeftUpperArm', 'mixamorigLeftArm', 'CC_Base_L_Upperarm'],
  leftForearm: ['LeftForeArm', 'mixamorigLeftForeArm', 'CC_Base_L_Forearm'],
  leftHand: ['LeftHand', 'mixamorigLeftHand', 'CC_Base_L_Hand'],
  rightUpLeg: ['RightUpLeg', 'mixamorigRightUpLeg'],
  rightLeg: ['RightLeg', 'mixamorigRightLeg'],
  rightFoot: ['RightFoot', 'mixamorigRightFoot'],
  leftUpLeg: ['LeftUpLeg', 'mixamorigLeftUpLeg'],
  leftLeg: ['LeftLeg', 'mixamorigLeftLeg'],
  leftFoot: ['LeftFoot', 'mixamorigLeftFoot'],
}

export const RIG_SLOT_COUNT = Object.keys(BONE_ALIASES).length

export function resolveRig(root: THREE.Object3D): Partial<HumanoidRig> {
  const found = new Map<string, THREE.Bone>()
  root.traverse((obj) => {
    const bone = obj as THREE.Bone
    if (bone.isBone) found.set(bone.name, bone)
  })
  const resolved: Partial<HumanoidRig> = {}
  for (const key of Object.keys(BONE_ALIASES) as (keyof HumanoidRig)[]) {
    for (const alias of BONE_ALIASES[key]) {
      const bone = found.get(alias)
      if (bone) {
        resolved[key] = bone
        break
      }
    }
  }
  return resolved
}

export function adapterSelfTest() {
  const cases: { bone: string; slot: keyof HumanoidRig }[] = [
    { bone: 'mixamorigRightArm', slot: 'rightUpperArm' },
    { bone: 'CC_Base_R_Forearm', slot: 'rightForearm' },
    { bone: 'RightHand', slot: 'rightHand' },
    { bone: 'mixamorigLeftArm', slot: 'leftUpperArm' },
  ]
  return cases.map(({ bone, slot }) => {
    const root = new THREE.Group()
    const joint = new THREE.Bone()
    joint.name = bone
    root.add(joint)
    return { label: `${bone} → ${slot}`, ok: resolveRig(root)[slot] === joint }
  })
}

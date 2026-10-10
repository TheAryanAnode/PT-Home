/** Bone offsets in meters. Summing the right-arm chain lands on SHOULDER.right. */
export const UPPER_LEN = 0.3
export const FORE_LEN = 0.26
export const HAND_LEN = 0.09
export const THIGH_LEN = 0.44
export const SHIN_LEN = 0.42

export const P = {
  hips: [0, 0.98, 0],
  spine: [0, 0.08, 0],
  spine1: [0, 0.13, 0],
  spine2: [0, 0.14, 0],
  neck: [0, 0.16, 0],
  head: [0, 0.11, 0],
  shoulderRight: [0.06, 0.1, 0],
  shoulderLeft: [-0.06, 0.1, 0],
  upperRight: [0.14, -0.02, 0],
  upperLeft: [-0.14, -0.02, 0],
  fore: [0, -UPPER_LEN, 0],
  hand: [0, -FORE_LEN, 0],
  upLegR: [0.1, -0.02, 0],
  upLegL: [-0.1, -0.02, 0],
  leg: [0, -THIGH_LEN, 0],
  foot: [0, -SHIN_LEN, 0],
} as const

export type Vec3 = readonly [number, number, number]

function add(parts: Vec3[]): [number, number, number] {
  return parts.reduce<[number, number, number]>((acc, p) => [acc[0] + p[0], acc[1] + p[1], acc[2] + p[2]], [0, 0, 0])
}

export const SHOULDER = {
  right: add([P.hips, P.spine, P.spine1, P.spine2, P.shoulderRight, P.upperRight]),
  left: add([P.hips, P.spine, P.spine1, P.spine2, P.shoulderLeft, P.upperLeft]),
} as const

export const SKIN = '#e4d0c2'
export const CLOTH = '#355c62'
export const CLOTH_DARK = '#243e44'
export const JOINT = '#f4e7db'
export const GHOST = '#9ec2ff'

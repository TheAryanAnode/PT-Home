import type { ExerciseFocus, Side } from '../motion/types.ts'

export type Shot = {
  cam: [number, number, number]
  look: [number, number, number]
}

export const CAM = {
  body: { cam: [1.62, 1.16, 2.72], look: [0, 1.02, 0] },
  elbow: { cam: [1.35, 1.22, 2.05], look: [0.12, 1.12, 0] },
  shoulder: { cam: [1.5, 1.35, 2.2], look: [0.04, 1.22, 0] },
  wrist: { cam: [1.2, 1.12, 1.75], look: [0.16, 1.05, 0.06] },
  hip: { cam: [1.58, 0.92, 2.48], look: [0.08, 0.78, 0] },
  knee: { cam: [1.48, 0.62, 2.32], look: [0.1, 0.5, 0] },
  ankle: { cam: [1.18, 0.26, 1.88], look: [0.12, 0.1, 0.1] },
  wide: { cam: [0.15, 1.14, 3.55], look: [0, 1.02, 0] },
  lower: { cam: [1.72, 0.88, 3.15], look: [0, 0.62, 0] },
} satisfies Record<string, Shot>

export function frameFor(focus: ExerciseFocus | 'body' | 'lower', side: Side): Shot {
  const base = CAM[focus]
  const sign = side === 'right' ? 1 : -1
  return {
    cam: [base.cam[0] * sign, base.cam[1], base.cam[2]],
    look: [base.look[0] * sign, base.look[1], base.look[2]],
  }
}

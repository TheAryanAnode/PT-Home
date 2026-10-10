export type TestLink = {
  to: string
  label: string
  kicker: string
  blurb: string
}

export const NAV: { title: string; items: TestLink[] }[] = [
  {
    title: 'Scene',
    items: [
      {
        to: '/dev/viewer',
        label: 'Humanoid',
        kicker: 'Rig',
        blurb: 'Orbit the mannequin, show the skeleton, and check the bone-name adapter.',
      },
      {
        to: '/dev/manual',
        label: 'Manual pose',
        kicker: 'Cursor',
        blurb: 'Sliders and a rotation gizmo pose the shoulder, elbow, and wrist.',
      },
      {
        to: '/dev/ik',
        label: 'Reach',
        kicker: 'IK',
        blurb: 'Drag a wrist target and let a two-bone solver bend the arm.',
      },
    ],
  },
  {
    title: 'Motion',
    items: [
      {
        to: '/dev/sensor',
        label: 'Sensor stream',
        kicker: 'Fake MPU',
        blurb: 'Built-in quaternions, mount error, calibration, and slerp smoothing.',
      },
      {
        to: '/dev/exercise',
        label: 'Exercise playback',
        kicker: 'Keyframes',
        blurb: 'Play elbow, shoulder, and wrist exercises with a timeline and ROM arc.',
      },
      {
        to: '/dev/replay',
        label: 'Replay',
        kicker: 'Session',
        blurb: 'Scrub a recording, change speed, and compare it with a previous take.',
      },
    ],
  },
  {
    title: 'Compare',
    items: [
      {
        to: '/dev/ghost',
        label: 'Ghost target',
        kicker: 'Form',
        blurb: 'A transparent target pose, per-segment error colors, and a match score.',
      },
      {
        to: '/dev/dual',
        label: 'Dual avatar',
        kicker: 'Match',
        blurb: 'Expected motion beside a lagged, noisy patient.',
      },
      {
        to: '/dev/trails',
        label: 'Trail and heatmap',
        kicker: 'Path',
        blurb: 'The hand leaves a path and a density map of where it spends time.',
      },
    ],
  },
  {
    title: 'Clinic',
    items: [
      {
        to: '/dev/scoring',
        label: 'Dashboard',
        kicker: 'Score',
        blurb: 'Reps, joint angles, compensation, and a weighted form score.',
      },
      {
        to: '/dev/editor',
        label: 'Exercise editor',
        kicker: 'Author',
        blurb: 'Save poses as keyframes, play the blend, and keep the JSON.',
      },
    ],
  },
]

export const TESTS = NAV.flatMap((group) => group.items)

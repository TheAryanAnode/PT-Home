import { useRef, useState } from 'react'
import { EXERCISES, sampleExercise, samplePatient } from '../motion/exercises.ts'
import { errorColor, matchPercent, poseFromAngles, segmentErrors } from '../motion/quat.ts'
import { createArm, writeArm } from '../motion/types.ts'
import { useSim } from '../motion/useMotionLoop.ts'
import { CAM } from '../rig/cameras.ts'
import { Humanoid, type SegmentColors } from '../rig/Humanoid.tsx'
import { Scene } from '../rig/Scene.tsx'
import { useRehab } from '../store/rehabStore.ts'
import { ScoreBar, SideToggle, Slider, TestPage } from '../ui/widgets.tsx'

const exercise = EXERCISES[0]

export function DualPage() {
  const side = useRehab((state) => state.side)
  const [noise, setNoise] = useState(3)
  const [lag, setLag] = useState(0.28)
  const [compensation, setCompensation] = useState(12)
  const liveRef = useRef(createArm())
  const [hud, setHud] = useState({ match: 100, colors: {} as SegmentColors })

  const sim = useSim((time) => {
    const ideal = sampleExercise(exercise, time)
    const patient = samplePatient(exercise, time, { lag, noise, compensation })
    const arm = poseFromAngles(ideal, side)
    const live = poseFromAngles(patient, side)
    const errors = segmentErrors(live, arm)
    return {
      arm,
      live,
      match: matchPercent(live, arm),
      colors: {
        upper: errorColor(errors.upper),
        fore: errorColor(errors.fore),
        hand: errorColor(errors.hand),
      } satisfies SegmentColors,
    }
  }, poseFromAngles(sampleExercise(exercise, 0), side))
  sim.onFrameRef.current = (frame) => writeArm(liveRef.current, frame.live)
  sim.onHudRef.current = (frame) => setHud({ match: frame.match, colors: frame.colors })

  return (
    <TestPage
      kicker="Match"
      title="Dual avatar"
      lede="Expected plays the clean exercise. Your movement is the same exercise with lag, noise, and extra shoulder motion. Both views share one clock."
      note={`Match ${hud.match}%`}
      panel={
        <div className="stack">
          <SideToggle />
          <Slider label="Lag" min={0} max={0.8} step={0.05} value={lag} onChange={setLag} unit="s" />
          <Slider label="Noise" min={0} max={12} value={noise} onChange={setNoise} unit="°" />
          <Slider label="Shoulder cheat" min={0} max={30} value={compensation} onChange={setCompensation} unit="°" />
          <h2>Match {hud.match}%</h2>
          <ScoreBar value={hud.match} />
          <p>Color on the right figure is the error against the expected pose.</p>
        </div>
      }
    >
      <div className="split-stage">
        <div>
          <Scene camera={CAM.body.cam} look={CAM.body.look}>
            <Humanoid side={side} poseRef={sim.poseRef} slerp={0.22} />
          </Scene>
          <p className="split-caption">Expected</p>
        </div>
        <div>
          <Scene camera={CAM.body.cam} look={CAM.body.look}>
            <Humanoid side={side} poseRef={liveRef} slerp={0.22} colors={hud.colors} />
          </Scene>
          <p className="split-caption">Your movement</p>
        </div>
      </div>
    </TestPage>
  )
}

import { useCallback, useMemo, useState } from 'react'
import type { Object3D } from 'three'
import { EXERCISES, sampleExercise } from '../motion/exercises.ts'
import { poseFromAngles } from '../motion/quat.ts'
import { READY_ANGLES, type JointId } from '../motion/types.ts'
import { useSim } from '../motion/useMotionLoop.ts'
import { frameFor } from '../rig/cameras.ts'
import { Humanoid } from '../rig/Humanoid.tsx'
import { RIG_SLOT_COUNT, adapterSelfTest, resolveRig } from '../rig/HumanoidRig.ts'
import { GlideCamera, Scene } from '../rig/Scene.tsx'
import { useRehab } from '../store/rehabStore.ts'
import { TestPage, Toggle } from '../ui/widgets.tsx'

const elbow = EXERCISES[0]

export function ViewerPage() {
  const side = useRehab((state) => state.side)
  const setSide = useRehab((state) => state.setSide)
  const showSkeleton = useRehab((state) => state.showSkeleton)
  const showAxes = useRehab((state) => state.showAxes)
  const showSensors = useRehab((state) => state.showSensors)
  const setFlag = useRehab((state) => state.setFlag)
  const [preview, setPreview] = useState(false)
  const [resolved, setResolved] = useState(0)
  const [joint, setJoint] = useState<JointId | null>(null)
  const checks = useMemo(() => adapterSelfTest(), [])
  const shot = frameFor('body', side)
  const sim = useSim((time) => {
    const angles = preview ? sampleExercise(elbow, time * 0.85) : READY_ANGLES
    return { arm: poseFromAngles(angles, side) }
  }, poseFromAngles(READY_ANGLES, side))
  sim.playingRef.current = preview

  const onRoot = useCallback((root: Object3D) => {
    setResolved(Object.keys(resolveRig(root)).length)
  }, [])

  return (
    <TestPage
      kicker="Rig"
      title="Humanoid"
      lede="A segmented mannequin uses the same joint names a rigged GLB would. The adapter maps Mixamo and Reallusion names onto one skeleton, so later motion code does not care which model is loaded."
      note="Left drag orbits. Scroll zooms. Right drag pans."
      panel={
        <div className="stack">
          <Toggle label="Play elbow preview" checked={preview} onChange={setPreview} />
          <Toggle label="Show skeleton" checked={showSkeleton} onChange={(value) => setFlag('showSkeleton', value)} />
          <Toggle label="Show bone axes" checked={showAxes} onChange={(value) => setFlag('showAxes', value)} />
          <Toggle label="Show sensor blocks" checked={showSensors} onChange={(value) => setFlag('showSensors', value)} />
          <div className="row">
            <button type="button" className={side === 'right' ? 'btn primary' : 'btn'} onClick={() => setSide('right')}>
              Right
            </button>
            <button type="button" className={side === 'left' ? 'btn primary' : 'btn'} onClick={() => setSide('left')}>
              Left
            </button>
          </div>
          <p>{joint ? `Selected ${joint}.` : 'Click a joint on the driven arm.'}</p>
          <h2>This model</h2>
          <p>
            {resolved} / {RIG_SLOT_COUNT} standard bones resolved.
          </p>
          <h2>Alias check</h2>
          <div className="checks">
            {checks.map((check) => (
              <div key={check.label} className="check">
                <span>{check.label}</span>
                <b className={check.ok ? '' : 'bad'}>{check.ok ? 'Pass' : 'Fail'}</b>
              </div>
            ))}
          </div>
          <p>Axes: red X, green Y, blue Z, in each bone’s local frame.</p>
        </div>
      }
    >
      <Scene camera={shot.cam} look={shot.look} onMiss={() => setJoint(null)}>
        <Humanoid
          key={side}
          side={side}
          poseRef={sim.poseRef}
          slerp={preview ? 0.18 : 1}
          showSkeleton={showSkeleton}
          showAxes={showAxes}
          showSensors={showSensors}
          selected={joint}
          onSelect={setJoint}
          onRoot={onRoot}
        />
        <GlideCamera cam={shot.cam} look={shot.look} token={side} />
      </Scene>
    </TestPage>
  )
}

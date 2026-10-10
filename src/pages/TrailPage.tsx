import { useState } from 'react'
import { reachAngles } from '../motion/exercises.ts'
import { poseFromAngles } from '../motion/quat.ts'
import { useSim } from '../motion/useMotionLoop.ts'
import { frameFor } from '../rig/cameras.ts'
import { Humanoid } from '../rig/Humanoid.tsx'
import { GlideCamera, Scene } from '../rig/Scene.tsx'
import { useRehab } from '../store/rehabStore.ts'
import { SideToggle, TestPage } from '../ui/widgets.tsx'

export function TrailPage() {
  const side = useRehab((state) => state.side)
  const [reset, setReset] = useState(0)
  const shot = frameFor('body', side)
  const sim = useSim((time) => {
    const angles = reachAngles(time)
    return { arm: poseFromAngles(angles, side), angles }
  }, poseFromAngles(reachAngles(0), side))

  return (
    <TestPage
      kicker="Path"
      title="Trail and heatmap"
      lede="A repeating reach draws the wrist path and bins that path into a density map. The map fades slowly, so repeated reaches get brighter."
      note="Built-in reach loop"
      panel={
        <div className="stack">
          <SideToggle />
          <button type="button" className="btn primary" onClick={() => setReset((value) => value + 1)}>
            Clear trail and heatmap
          </button>
          <p>Use this to look at reach consistency. A shaky path spreads the heatmap; a repeated path stacks it.</p>
        </div>
      }
    >
      <Scene camera={shot.cam} look={shot.look}>
        <Humanoid
          key={`${side}-${reset}`}
          side={side}
          poseRef={sim.poseRef}
          slerp={0.2}
          trail
          heatmap
          trailReset={reset}
          heatmapReset={reset}
        />
        <GlideCamera cam={shot.cam} look={shot.look} token={side} />
      </Scene>
    </TestPage>
  )
}

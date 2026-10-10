import { Link } from 'react-router-dom'
import { findExercise, WEEK_GOAL, greeting, libraryFor, useCatalog, useExerciseExtras } from '../../product/catalog.ts'
import { useRehab } from '../../store/rehabStore.ts'
import { recordsFor } from '../../trial/study.ts'
import { PRIMARY_ASSESSMENT } from '../../trial/types.ts'
import { IconPlay } from '../../ui/icons.tsx'
import { HeadingInfo, InfoTip } from '../../ui/InfoTip.tsx'

export function HomeDash() {
  const history = useRehab((state) => state.history)
  const weekDone = useRehab((state) => state.weekDone)
  const extras = useExerciseExtras()
  const { exercises } = useCatalog()
  const activePatientId = useRehab((state) => state.activePatientId)
  const patients = useRehab((state) => state.patients)
  const assignedIds = patients.find((patient) => patient.id === activePatientId)?.assignedExerciseIds ?? []
  const today = findExercise(assignedIds[0] ?? 'elbow-flexion', extras) ?? findExercise('elbow-flexion', extras)
  const assigned = assignedIds
    .map((id) => findExercise(id, extras))
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
  const assessments = useRehab((state) => state.assessments)
  const series = recordsFor(assessments, activePatientId, PRIMARY_ASSESSMENT)
  const last = history[0]
  const previous = history[1]
  const romSeries = series.length ? series.map((row) => Math.round(row.endpoints.maxRom)) : [61, 70, 77, 83, 88]
  const remaining = Math.max(0, 95 - (last?.rom ?? 88))
  const romDelta = last && previous ? last.rom - previous.rom : 6
  const plan = assigned.length ? assigned : exercises.slice(0, 3)

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="kicker">Today</p>
          <h1>{greeting()}</h1>
        </div>
      </header>

      <section className="sticker">
        <div className="heading-row">
          <p className="kicker">Next up</p>
          <InfoTip label="About today’s session">
            <p>This is the first exercise on your assigned plan. Sensors on the upper arm and forearm track the movement against a target pose.</p>
          </InfoTip>
        </div>
        <h2 style={{ fontSize: 28, margin: '6px 0 8px' }}>{today?.name ?? 'Elbow flexion'}</h2>
        <p className="quiet">
          {today ? `${today.reps ?? 8} reps · about ${Math.max(3, Math.round(today.duration))} min` : ''}
          {today?.conditions?.length ? ` · used in ${today.conditions.slice(0, 2).join(', ')}` : ''}
        </p>
        <div style={{ marginTop: 12 }}>
          <p className="quiet">This week</p>
          <div className="meter" style={{ margin: '8px 0' }}>
            <div style={{ width: `${(weekDone / WEEK_GOAL) * 100}%` }} />
          </div>
          <strong>{weekDone} / {WEEK_GOAL} sessions</strong>
        </div>
        <div className="row" style={{ marginTop: 16 }}>
          <Link to={`/session/setup?exercise=${today?.id ?? 'elbow-flexion'}`} className="candy">
            Start session <span className="orb"><IconPlay size={14} /></span>
          </Link>
          {last ? <Link to={`/progress/session/${last.id}`} className="ghost-btn">Review last</Link> : null}
        </div>
      </section>

      <section>
        <HeadingInfo title="Your plan" label="Why these movements">
          <p>A clinician can assign drills for stroke, frozen shoulder, rotator cuff, Parkinson’s, tendon pain, arthritis, and fracture recovery. The 3D preview is a demo of the motion, not a diagnosis.</p>
        </HeadingInfo>
        <div className="card-grid" style={{ marginTop: 12 }}>
          {plan.map((exercise) => {
            const info = libraryFor(exercise)
            return (
              <Link key={exercise.id} to={`/exercises/${exercise.id}`} className="sticker exercise-card">
                <span className="pill">{exercise.focus}</span>
                <h2>{exercise.name}</h2>
                <p>{info.reps} reps</p>
                <p className="quiet">{info.conditions.slice(0, 2).join(' · ') || info.purpose}</p>
              </Link>
            )
          })}
        </div>
      </section>

      <section className="pair">
        <article className="sticker">
          <div className="heading-row">
            <p className="kicker">Goal</p>
            <InfoTip label="Range of motion">
              <p>Target is the peak elbow angle from your plan. Remaining is how far the last session was from 95°.</p>
            </InfoTip>
          </div>
          <h2>Elbow range</h2>
          <div className="stat-row"><span>Target</span><strong>95°</strong></div>
          <div className="stat-row"><span>Last</span><strong>{last?.rom ?? 88}°</strong></div>
          <p style={{ marginTop: 10, fontWeight: 700 }}>{remaining}° remaining</p>
        </article>
        <article className="sticker">
          <p className="kicker">Last session</p>
          <h2>{last?.date ?? 'Oct 9'}</h2>
          <div className="stat-row"><span>Form score</span><strong>{last?.score ?? 91}</strong></div>
          <div className="stat-row"><span>Max range</span><strong>{last?.rom ?? 88}°</strong></div>
          <div className="stat-row"><span>Reps</span><strong>{last ? `${last.reps} / ${last.repGoal}` : '12 / 12'}</strong></div>
          <p className="quiet" style={{ marginTop: 10 }}>{romDelta >= 0 ? `+${romDelta}° vs prior session` : `${romDelta}° vs prior session`}</p>
        </article>
      </section>

      <section className="sticker">
        <HeadingInfo title="Range over time" label="How to read this">
          <p>Each bar is a weekly check-in of peak elbow flexion. These are recorded angles, not a judgment about healing.</p>
        </HeadingInfo>
        <div className="spark" style={{ marginTop: 16 }}>
          {romSeries.map((value, index) => (
            <div key={`${value}-${index}`}>
              <i style={{ height: `${Math.max(8, value - 40)}px`, background: index === romSeries.length - 1 ? 'var(--accent)' : 'var(--mint)' }} />
              <span>{value}°</span>
            </div>
          ))}
        </div>
        <Link to="/progress" className="ghost-btn" style={{ marginTop: 16 }}>View progress</Link>
      </section>
    </div>
  )
}

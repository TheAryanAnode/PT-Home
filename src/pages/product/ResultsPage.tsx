import { Link } from 'react-router-dom'
import { useRehab } from '../../store/rehabStore.ts'
import { MotionQcPanel } from '../../trial/MotionQcPanel.tsx'
import { compareToBaseline, formatChange } from '../../trial/study.ts'

export function ResultsPage() {
  const history = useRehab((state) => state.history)
  const assessments = useRehab((state) => state.assessments)
  const activePatientId = useRehab((state) => state.activePatientId)
  const latest = history[0]
  const record = assessments.find((item) => item.id === latest?.id) ?? assessments[0]
  if (!latest) {
    return (
      <div className="page">
        <h1>No session yet</h1>
        <Link to="/session/setup" className="candy">Start session</Link>
      </div>
    )
  }
  const compared = record ? compareToBaseline(assessments, record.participantId, record.assessmentId) : compareToBaseline(assessments, activePatientId)
  const title = latest.score >= 85 ? 'Excellent consistency' : latest.score >= 70 ? 'Solid session' : 'Session complete'

  return (
    <div className="page">
      <header>
        <p className="kicker">Session complete</p>
        <h1>{title}</h1>
      </header>
      <section className="sticker" style={{ maxWidth: 640 }}>
        <p className="kicker">Form score</p>
        <p className="count">{latest.score}</p>
        <div className="stat-row"><span>Reps</span><strong>{latest.reps} / {latest.repGoal}</strong></div>
        <div className="stat-row"><span>Maximum ROM</span><strong>{record ? `${record.endpoints.maxRom.toFixed(1)}°` : `${latest.rom}°`}</strong></div>
        <div className="stat-row"><span>Peak velocity</span><strong>{record ? `${record.endpoints.peakVelocity.toFixed(1)}°/s` : '—'}</strong></div>
        <div className="stat-row"><span>Smoothness</span><strong>{record ? record.endpoints.smoothness.toFixed(2) : latest.smoothness}</strong></div>
        <div className="stat-row"><span>Compensation</span><strong>{record ? `${record.endpoints.compensationAngle.toFixed(1)}°` : `${latest.shoulderExtra}°`}</strong></div>
        {compared && !record?.baseline ? (
          <p style={{ fontWeight: 700 }}>
            Change from baseline {formatChange(compared.change.rom, 'rom')} ROM, {formatChange(compared.change.compensation, 'comp')} compensation.
          </p>
        ) : (
          <p style={{ fontWeight: 700 }}>{record?.baseline ? 'This is the baseline recording for this assessment.' : 'Session stored.'}</p>
        )}
        <div className="row">
          <Link to={`/progress/session/${latest.id}`} className="candy">Review</Link>
          <Link to="/" className="ghost-btn">Done</Link>
        </div>
      </section>
      {record ? <div style={{ maxWidth: 640, marginTop: 14 }}><MotionQcPanel qc={record.qc} /></div> : null}
    </div>
  )
}

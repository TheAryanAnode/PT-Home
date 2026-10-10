import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useRehab } from '../../store/rehabStore.ts'
import { downloadStudyCsv } from '../../trial/csv.ts'
import { shortDate } from '../../trial/math.ts'
import { MotionQcPanel } from '../../trial/MotionQcPanel.tsx'
import { compareToBaseline, formatChange, recordsFor } from '../../trial/study.ts'
import { PRIMARY_ASSESSMENT } from '../../trial/types.ts'
import { InfoTip } from '../../ui/InfoTip.tsx'

export function ResearcherPage() {
  const { id = '' } = useParams()
  const patients = useRehab((state) => state.patients)
  const assessments = useRehab((state) => state.assessments)
  const setViewerMode = useRehab((state) => state.setViewerMode)
  useEffect(() => { setViewerMode('clinician') }, [setViewerMode])
  const [participantId, setParticipantId] = useState(id || patients[0]?.id || '')
  useEffect(() => {
    if (id) setParticipantId(id)
  }, [id])
  const participant = patients.find((item) => item.id === participantId) ?? patients[0]
  const assessmentIds = useMemo(() => {
    const ids = new Set(
      assessments.filter((record) => record.participantId === participant?.id).map((record) => record.assessmentId),
    )
    if (!ids.size) ids.add(PRIMARY_ASSESSMENT)
    return [...ids]
  }, [assessments, participant?.id])
  const [assessmentId, setAssessmentId] = useState(assessmentIds[0] ?? PRIMARY_ASSESSMENT)
  const protocol = assessmentIds.includes(assessmentId) ? assessmentId : assessmentIds[0]
  const series = participant ? recordsFor(assessments, participant.id, protocol) : []
  const compared = participant ? compareToBaseline(assessments, participant.id, protocol) : null
  const maxBar = Math.max(90, ...series.map((row) => row.endpoints.maxRom))

  if (!participant) {
    return (
      <div className="page">
        <h1>No participants</h1>
        <Link to="/study" className="candy">Study overview</Link>
      </div>
    )
  }

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="kicker">Participant {participant.code}</p>
          <h1>{participant.name}</h1>
        </div>
        <div className="row">
          <Link to="/study" className="ghost-btn">Study</Link>
          <button type="button" className="candy" onClick={() => downloadStudyCsv(series, `${participant.code}-${protocol}.csv`)}>
            Export CSV
          </button>
        </div>
      </header>

      <div className="pair">
        <label className="field">
          Participant
          <select value={participant.id} onChange={(event) => setParticipantId(event.target.value)}>
            {patients.map((item) => (
              <option key={item.id} value={item.id}>{item.code} · {item.name}</option>
            ))}
          </select>
        </label>
        <label className="field">
          Assessment
          <select value={protocol} onChange={(event) => setAssessmentId(event.target.value)}>
            {assessmentIds.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </label>
      </div>

      {compared ? (
        <section className="sticker">
          <div className="heading-row">
            <p className="kicker">{compared.exerciseName}</p>
            <InfoTip label="Baseline">
              <p>Baseline is the first valid recording of this assessment. Later valid sessions are compared against it. Invalid recordings are excluded from change.</p>
            </InfoTip>
          </div>
          <h2>Baseline vs current</h2>
          <div className="compare-grid">
            <article>
              <p className="kicker">Baseline · {shortDate(compared.baseline.sessionDate)}</p>
              <div className="stat-row"><span>ROM</span><strong>{compared.baseline.endpoints.maxRom.toFixed(1)}°</strong></div>
              <div className="stat-row"><span>Smoothness</span><strong>{compared.baseline.endpoints.smoothness.toFixed(2)}</strong></div>
              <div className="stat-row"><span>Compensation</span><strong>{compared.baseline.endpoints.compensationAngle.toFixed(1)}°</strong></div>
            </article>
            <article>
              <p className="kicker">Current · {shortDate(compared.current.sessionDate)}</p>
              <div className="stat-row"><span>ROM</span><strong>{compared.current.endpoints.maxRom.toFixed(1)}°</strong></div>
              <div className="stat-row"><span>Smoothness</span><strong>{compared.current.endpoints.smoothness.toFixed(2)}</strong></div>
              <div className="stat-row"><span>Compensation</span><strong>{compared.current.endpoints.compensationAngle.toFixed(1)}°</strong></div>
            </article>
            <article>
              <p className="kicker">Change</p>
              <div className="stat-row"><span>ROM</span><strong>{formatChange(compared.change.rom, 'rom')}</strong></div>
              <div className="stat-row"><span>Smoothness</span><strong>{formatChange(compared.change.smoothness, 'smooth')}</strong></div>
              <div className="stat-row"><span>Compensation</span><strong>{formatChange(compared.change.compensation, 'comp')}</strong></div>
            </article>
          </div>
          <div className="stat-row"><span>Adherence</span><strong>{compared.adherence.done} / {compared.adherence.expected} sessions</strong></div>
          <div className="stat-row"><span>Data quality</span><strong>{compared.latestQuality}%</strong></div>
          <p className="quiet">Exploratory movement outcomes. Not an efficacy claim.</p>
        </section>
      ) : (
        <section className="sticker"><p>No valid assessments yet for this participant.</p></section>
      )}

      <section className="sticker">
        <h2>ROM over visits</h2>
        <div className="week-chart">
          {series.map((row) => (
            <div key={row.id}>
              <b
                style={{
                  height: `${Math.max(12, ((row.endpoints.maxRom - 30) / Math.max(20, maxBar - 30)) * 140)}px`,
                  background: row.baseline ? 'var(--mint)' : row.qc.status === 'valid' ? 'var(--accent)' : '#f4e7db',
                }}
              />
              <span>{Math.round(row.endpoints.maxRom)}°</span>
              <small>{row.baseline ? 'B' : `W${row.week}`}</small>
            </div>
          ))}
        </div>
      </section>

      {compared ? <MotionQcPanel qc={compared.current.qc} /> : null}

      <section className="stack">
        <h2>Sessions</h2>
        {series.map((row) => (
          <article key={row.id} className="sticker" style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
            <div>
              <p className="kicker">{shortDate(row.sessionDate)} {row.baseline ? '· BASELINE' : ''}</p>
              <h3>max ROM {row.endpoints.maxRom.toFixed(1)}° · smoothness {row.endpoints.smoothness.toFixed(2)}</h3>
              <p className="quiet">Compensation {row.endpoints.compensationAngle.toFixed(1)}° · {row.endpoints.validReps} reps · QC {row.qc.qualityScore}%</p>
            </div>
            <Link to={`/progress/session/${row.id}`} className="ghost-btn">Review</Link>
          </article>
        ))}
      </section>
    </div>
  )
}

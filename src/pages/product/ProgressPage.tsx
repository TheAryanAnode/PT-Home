import { Link } from 'react-router-dom'
import { useRehab } from '../../store/rehabStore.ts'
import { shortDate } from '../../trial/math.ts'
import { compareToBaseline, formatChange, recordsFor } from '../../trial/study.ts'
import { PRIMARY_ASSESSMENT, PROTOCOL_VISITS } from '../../trial/types.ts'
import { HeadingInfo, InfoTip } from '../../ui/InfoTip.tsx'

export function ProgressPage() {
  const assessments = useRehab((state) => state.assessments)
  const activePatientId = useRehab((state) => state.activePatientId)
  const patients = useRehab((state) => state.patients)
  const patient = patients.find((item) => item.id === activePatientId)
  const series = recordsFor(assessments, activePatientId, PRIMARY_ASSESSMENT)
  const compared = compareToBaseline(assessments, activePatientId)
  const done = series.length
  const adherence = Math.round((done / PROTOCOL_VISITS) * 100)
  const maxBar = Math.max(90, ...series.map((row) => row.endpoints.maxRom))

  return (
    <div className="page">
      <header>
        <p className="kicker">Progress</p>
        <h1>{patient?.name ?? 'Elbow flexion'}</h1>
      </header>

      <section className="sticker">
        <HeadingInfo title="Range of motion" label="What this chart shows">
          <p>Each bar is peak elbow flexion from a stored assessment. The mint bar is baseline, the first valid recording. These are movement measurements, not a judgment about healing.</p>
        </HeadingInfo>
        <div className="week-chart">
          {series.map((row) => (
            <div key={row.id}>
              <b
                style={{
                  height: `${Math.max(12, ((row.endpoints.maxRom - 30) / Math.max(20, maxBar - 30)) * 140)}px`,
                  background: row.baseline ? 'var(--mint)' : 'var(--accent)',
                  opacity: row.qc.status === 'valid' ? 1 : 0.45,
                }}
              />
              <span>{Math.round(row.endpoints.maxRom)}°</span>
              <small>{row.baseline ? 'B' : shortDate(row.sessionDate)}</small>
            </div>
          ))}
        </div>
        {compared ? (
          <>
            <div className="pair" style={{ marginTop: 12 }}>
              <div className="stat-row"><span>Baseline</span><strong>{compared.baseline.endpoints.maxRom.toFixed(0)}°</strong></div>
              <div className="stat-row"><span>Current</span><strong>{compared.current.endpoints.maxRom.toFixed(0)}°</strong></div>
            </div>
            <p style={{ fontWeight: 700 }}>Change {formatChange(compared.change.rom, 'rom')}</p>
          </>
        ) : null}
      </section>

      <section className="pair">
        <article className="sticker">
          <div className="heading-row">
            <h2>Compared with baseline</h2>
            <InfoTip label="Endpoints">
              <p>Smoothness is 0–1 (higher is cleaner). Compensation is extra proximal joint motion in degrees.</p>
            </InfoTip>
          </div>
          {compared ? (
            <>
              <div className="stat-row"><span>Smoothness</span><strong>{compared.baseline.endpoints.smoothness.toFixed(2)} → {compared.current.endpoints.smoothness.toFixed(2)}</strong></div>
              <div className="stat-row"><span>Compensation</span><strong>{compared.baseline.endpoints.compensationAngle.toFixed(1)}° → {compared.current.endpoints.compensationAngle.toFixed(1)}°</strong></div>
            </>
          ) : (
            <p>No valid baseline yet.</p>
          )}
        </article>
        <article className="sticker">
          <div className="heading-row">
            <h2>Adherence</h2>
            <InfoTip label="Adherence">
              <p>{done} of {PROTOCOL_VISITS} protocol visits are on record ({adherence}%).</p>
            </InfoTip>
          </div>
          <div className="meter"><div style={{ width: `${Math.min(100, adherence)}%` }} /></div>
          <p style={{ marginTop: 10, fontWeight: 700 }}>{done} / {PROTOCOL_VISITS} sessions</p>
        </article>
      </section>

      <section className="stack">
        <h2>Recent sessions</h2>
        {[...series].reverse().map((row) => (
          <article key={row.id} className="sticker" style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
            <div>
              <p className="kicker">{shortDate(row.sessionDate)} {row.baseline ? '· BASELINE' : ''}</p>
              <h3>{row.exerciseName}</h3>
              <p className="quiet">{row.endpoints.validReps} reps · ROM {row.endpoints.maxRom.toFixed(0)}° · QC {row.qc.qualityScore}%</p>
            </div>
            <Link to={`/progress/session/${row.id}`} className="ghost-btn">Review</Link>
          </article>
        ))}
      </section>
    </div>
  )
}

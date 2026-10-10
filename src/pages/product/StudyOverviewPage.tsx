import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useRehab } from '../../store/rehabStore.ts'
import { downloadStudyCsv } from '../../trial/csv.ts'
import { formatChange, studyOverview } from '../../trial/study.ts'
import { PRIMARY_ASSESSMENT } from '../../trial/types.ts'
import { HeadingInfo, InfoTip } from '../../ui/InfoTip.tsx'

export function StudyOverviewPage() {
  const patients = useRehab((state) => state.patients)
  const assessments = useRehab((state) => state.assessments)
  const setViewerMode = useRehab((state) => state.setViewerMode)
  useEffect(() => { setViewerMode('clinician') }, [setViewerMode])
  const study = studyOverview(assessments, patients.length)
  const protocol = assessments.filter((record) => record.assessmentId === PRIMARY_ASSESSMENT)
  const byParticipant = patients.map((patient) => {
    const rows = protocol.filter((record) => record.participantId === patient.id)
    const latest = rows[rows.length - 1]
    return { patient, rows, latest }
  })

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="kicker">Study</p>
          <h1>Study overview</h1>
        </div>
        <button type="button" className="candy" onClick={() => downloadStudyCsv(assessments)}>
          Export study data
        </button>
      </header>

      <section className="sticker">
        <HeadingInfo title="Enrollment" label="What this counts">
          <p>Completed sessions are stored assessments for the elbow-flexion protocol. Expected sessions is the protocol target for this cohort, not a clinical requirement.</p>
        </HeadingInfo>
        <div className="stat-row"><span>Participants</span><strong>{study.participants}</strong></div>
        <div className="stat-row"><span>Completed sessions</span><strong>{study.completed}</strong></div>
        <div className="stat-row"><span>Expected sessions</span><strong>{study.expected}</strong></div>
        <div className="stat-row"><span>Adherence</span><strong>{study.adherence}%</strong></div>
      </section>

      <section className="pair">
        <article className="sticker">
          <h2>Data quality</h2>
          <div className="stat-row"><span>Valid sessions</span><strong className="qc-pass">{study.valid}</strong></div>
          <div className="stat-row"><span>Review required</span><strong className="qc-warn">{study.review}</strong></div>
          <div className="stat-row"><span>Invalid</span><strong className="qc-fail">{study.invalid}</strong></div>
        </article>
        <article className="sticker">
          <div className="heading-row">
            <h2>Average change from baseline</h2>
            <InfoTip label="Exploratory outcomes">
              <p>These are exploratory movement outcomes from valid recordings. They are not an efficacy result and should not be read as proof that therapy worked.</p>
            </InfoTip>
          </div>
          <div className="stat-row"><span>ROM</span><strong>{formatChange(study.change.rom, 'rom')}</strong></div>
          <div className="stat-row"><span>Smoothness</span><strong>{formatChange(study.change.smoothness, 'smooth')}</strong></div>
          <div className="stat-row"><span>Compensation</span><strong>{formatChange(study.change.compensation, 'comp')}</strong></div>
          <p className="quiet">Exploratory movement outcomes · elbow-flexion-v1</p>
        </article>
      </section>

      <section className="stack">
        <h2>Participants</h2>
        {byParticipant.map(({ patient, rows, latest }) => (
          <Link key={patient.id} to={`/study/participant/${patient.id}`} className="sticker" style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', textDecoration: 'none' }}>
            <div>
              <p className="kicker">{patient.code}</p>
              <h3>{patient.name}</h3>
              <p className="quiet">{rows.length} sessions · last {latest ? Math.round(latest.endpoints.maxRom) : '—'}°</p>
            </div>
            <span className={`pill ${latest?.qc.status === 'valid' ? 'mint' : latest?.qc.status === 'review' ? '' : 'violet'}`}>
              {latest?.qc.status ?? 'none'}
            </span>
          </Link>
        ))}
      </section>
    </div>
  )
}

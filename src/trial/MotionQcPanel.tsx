import { statusLabel } from './study.ts'
import type { MotionQC } from './types.ts'

export function MotionQcPanel({ qc, compact = false }: { qc: MotionQC; compact?: boolean }) {
  return (
    <section className={`sticker qc-card ${qc.status}`}>
      <p className="kicker">Data quality</p>
      <div className="heading-row">
        <h2>{statusLabel(qc.status)}</h2>
        <strong className={`qc-score ${qc.status}`}>{qc.qualityScore}%</strong>
      </div>
      {qc.reviewReasons[0] ? <p className="qc-reason">{qc.reviewReasons[0]}</p> : null}
      <div className="qc-grid">
        {qc.checks.map((item) => (
          <div key={item.id} className="stat-row">
            <span>{item.label}</span>
            <strong className={`qc-${item.result}`}>{item.detail}</strong>
          </div>
        ))}
      </div>
      {compact ? null : <p className="quiet">Overall quality {qc.qualityScore}%. Status is about whether the recording is trustworthy, not about therapy response.</p>}
    </section>
  )
}

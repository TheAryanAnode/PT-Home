import type { ReactNode } from 'react'
import type { Side } from '../motion/types.ts'
import { useRehab } from '../store/rehabStore.ts'

export function TestPage({
  kicker,
  title,
  lede,
  note,
  panel,
  children,
}: {
  kicker: string
  title: string
  lede: string
  note?: string
  panel: ReactNode
  children: ReactNode
}) {
  return (
    <section className="test">
      <header className="test-head">
        <p className="kicker">{kicker}</p>
        <h1>{title}</h1>
        <p>{lede}</p>
      </header>
      <div className="test-body">
        <div className="stage">
          {children}
          {note ? <div className="stage-note">{note}</div> : null}
        </div>
        <aside className="panel">{panel}</aside>
      </div>
    </section>
  )
}

export function Slider({
  label,
  min,
  max,
  step = 1,
  value,
  onChange,
  unit = '°',
}: {
  label: string
  min: number
  max: number
  step?: number
  value: number
  onChange: (value: number) => void
  unit?: string
}) {
  return (
    <label className="slider">
      <span className="slider-top">
        <span>{label}</span>
        <span className="mono">
          {value.toFixed(step < 1 ? 2 : 0)}
          {unit}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={Number.isFinite(value) ? value : 0}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  )
}

export function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>{label}</span>
    </label>
  )
}

export function Choice<T extends string>({
  value,
  options,
  onChange,
  columns,
}: {
  value: T
  options: { id: T; label: string }[]
  onChange: (value: T) => void
  columns?: number
}) {
  return (
    <div
      className={columns ? 'choice choice-grid' : 'choice'}
      style={columns ? { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` } : undefined}
    >
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          className={option.id === value ? 'on' : ''}
          onClick={() => onChange(option.id)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

export function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string
  value: string
  hint?: string
  tone?: 'ok' | 'warn' | 'bad'
}) {
  return (
    <div className={`stat ${tone ?? ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {hint ? <em>{hint}</em> : null}
    </div>
  )
}

export function RomBar({
  min,
  max,
  value,
  target,
  limitMax,
}: {
  min: number
  max: number
  value: number
  target?: number
  limitMax?: number
}) {
  const span = max - min || 1
  const pct = (n: number) => `${((n - min) / span) * 100}%`
  const outside = limitMax !== undefined && value > limitMax
  return (
    <div className="rom">
      <div className="rom-track">
        {limitMax !== undefined ? (
          <div className="rom-safe" style={{ left: pct(min), width: pct(Math.min(limitMax, max)) }} />
        ) : null}
        {target !== undefined ? <div className="rom-target" style={{ left: pct(target) }} /> : null}
        <div className={`rom-now ${outside ? 'bad' : ''}`} style={{ left: pct(Math.min(max, Math.max(min, value))) }} />
      </div>
      <div className="rom-scale">
        <span>{min}°</span>
        <span>{value.toFixed(0)}°</span>
        <span>{max}°</span>
      </div>
    </div>
  )
}

export function SideToggle() {
  const side = useRehab((state) => state.side)
  const setSide = useRehab((state) => state.setSide)
  return (
    <Choice<Side>
      value={side}
      options={[
        { id: 'right', label: 'Right arm' },
        { id: 'left', label: 'Left arm' },
      ]}
      onChange={setSide}
    />
  )
}

export function ScoreBar({ value }: { value: number }) {
  return (
    <div className="scorebar">
      <div style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  )
}

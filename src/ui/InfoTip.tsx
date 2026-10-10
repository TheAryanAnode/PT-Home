import { useEffect, useId, useRef, useState, type ReactNode } from 'react'

export function InfoTip({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const id = useId()
  const root = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!open) return
    function onPointer(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <span className="info-tip" ref={root}>
      <button
        type="button"
        className={`info-btn${open ? ' on' : ''}`}
        aria-label={label}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((value) => !value)}
      >
        i
      </button>
      {open ? (
        <div className="info-pop" id={id} role="note">
          <p className="kicker">{label}</p>
          {children}
        </div>
      ) : null}
    </span>
  )
}

export function HeadingInfo({
  title,
  label,
  children,
}: {
  title: ReactNode
  label: string
  children: ReactNode
}) {
  return (
    <div className="heading-row">
      {typeof title === 'string' ? <h2>{title}</h2> : title}
      <InfoTip label={label}>{children}</InfoTip>
    </div>
  )
}

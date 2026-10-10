import type { ReactNode } from 'react'

type IconProps = { size?: number }

function Svg({ size = 22, children }: IconProps & { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  )
}

export function IconHome(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z" />
    </Svg>
  )
}

export function IconPlay(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M8 5.5v13l11-6.5z" />
    </Svg>
  )
}

export function IconExercises(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="7" />
      <circle cx="12" cy="12" r="2" />
    </Svg>
  )
}

export function IconProgress(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 16l5-5 4 3 7-8" />
      <path d="M14 6h6v6" />
    </Svg>
  )
}

export function IconPeople(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 19c.6-3 2.7-4.5 5.5-4.5S14 16 14.5 19" />
      <circle cx="17" cy="9" r="2.2" />
      <path d="M16 14.6c2.2.3 3.8 1.5 4.5 4.4" />
    </Svg>
  )
}

export function IconPencil(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 20h4l10-10-4-4L4 16z" />
      <path d="M13 7l4 4" />
    </Svg>
  )
}

export function IconGear(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3.5v2.2M12 18.3V20.5M3.5 12h2.2M18.3 12h2.2M6 6l1.6 1.6M16.4 16.4 18 18M18 6l-1.6 1.6M7.6 16.4 6 18" />
    </Svg>
  )
}

export function IconInfo(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6" />
      <path d="M12 8h.01" />
    </Svg>
  )
}

export function IconCheck(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5 12.5 10 17l9-10" />
    </Svg>
  )
}

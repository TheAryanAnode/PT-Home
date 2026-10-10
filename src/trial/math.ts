export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export function mean(values: number[]) {
  if (!values.length) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

export function stdev(values: number[]) {
  if (values.length < 2) return 0
  const avg = mean(values)
  const variance = mean(values.map((value) => (value - avg) ** 2))
  return Math.sqrt(variance)
}

export function round(value: number, digits = 1) {
  const f = 10 ** digits
  return Math.round(value * f) / f
}

export function signed(value: number, digits = 1, suffix = '') {
  const n = round(value, digits)
  const abs = Math.abs(n).toFixed(digits)
  return `${n >= 0 ? '+' : '−'}${abs}${suffix}`
}

export function shortDate(iso: string) {
  const stamp = iso.length <= 10 ? `${iso}T12:00:00` : iso
  return new Date(stamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function isoDate(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function addDays(iso: string, days: number) {
  const date = new Date(`${iso}T12:00:00`)
  date.setDate(date.getDate() + days)
  return isoDate(date)
}

export function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

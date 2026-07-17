/** Horarios de atención en mostrador (San Juan, AR) — misma referencia que el tótem. */
const TZ = 'America/Argentina/San_Juan'

type DayParts = { hour: number; minute: number }

function getZonedParts(date: Date): { weekday: number; hour: number; minute: number } {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false
  })
  const parts = fmt.formatToParts(date)
  const weekdayStr = parts.find((p) => p.type === 'weekday')?.value ?? 'Mon'
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0)
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0)
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6
  }
  return { weekday: weekdayMap[weekdayStr] ?? 1, hour, minute }
}

function minutesSinceMidnight(hour: number, minute: number): number {
  return hour * 60 + minute
}

function inRange(nowMin: number, start: DayParts, end: DayParts): boolean {
  const startMin = minutesSinceMidnight(start.hour, start.minute)
  const endMin = minutesSinceMidnight(end.hour, end.minute)
  return nowMin >= startMin && nowMin < endMin
}

/** Lun–Vie 6:00–22:00, Sáb 9:00–18:00, Dom cerrado. */
export function isPlotCenterBusinessHours(now = new Date()): boolean {
  const { weekday, hour, minute } = getZonedParts(now)
  const nowMin = minutesSinceMidnight(hour, minute)

  if (weekday >= 1 && weekday <= 5) {
    return inRange(nowMin, { hour: 6, minute: 0 }, { hour: 22, minute: 0 })
  }
  if (weekday === 6) {
    return inRange(nowMin, { hour: 9, minute: 0 }, { hour: 18, minute: 0 })
  }
  return false
}

export function plotCenterBusinessHoursLabel(): string {
  return 'Lun–Vie 6:00–22:00 · Sáb 9:00–18:00'
}

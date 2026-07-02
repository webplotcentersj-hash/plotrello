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

export function isPlotCenterBusinessHours(now = new Date()): boolean {
  const { weekday, hour, minute } = getZonedParts(now)
  const nowMin = minutesSinceMidnight(hour, minute)

  if (weekday >= 1 && weekday <= 5) {
    return inRange(nowMin, { hour: 7, minute: 0 }, { hour: 21, minute: 30 })
  }
  if (weekday === 6) {
    return inRange(nowMin, { hour: 8, minute: 0 }, { hour: 20, minute: 0 })
  }
  return false
}

export function plotCenterBusinessHoursLabel(): string {
  return 'Lun–Vie 7:00–21:30 · Sáb 8:00–20:00'
}

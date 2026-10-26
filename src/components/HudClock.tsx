import './HudClock.css'

type HudClockProps = {
  now: Date
  /** IANA (ej. America/Argentina/Buenos_Aires). Sin valor usa la hora del dispositivo. */
  timeZone?: string
  label?: string
  className?: string
}

/** Cada vez que cambia un dígito, el nuevo baja desde arriba (la animación es CSS, se relanza por `key`). */
function Digit({ ch }: { ch: string }) {
  if (!/\d/.test(ch)) return <span className="hud-digit">{ch}</span>
  return (
    <span className="hud-digit">
      <span key={ch} className="hud-digit__n">
        {ch}
      </span>
    </span>
  )
}

const SEC_TICKS = Array.from({ length: 60 }, (_, i) => {
  const a = (i / 60) * Math.PI * 2
  const major = i % 5 === 0
  const r1 = major ? 36 : 39
  return {
    x1: 50 + Math.sin(a) * r1,
    y1: 50 - Math.cos(a) * r1,
    x2: 50 + Math.sin(a) * 45,
    y2: 50 - Math.cos(a) * 45,
    major
  }
})

function clockParts(d: Date, timeZone?: string) {
  try {
    const hms = new Intl.DateTimeFormat('es-AR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
      timeZone
    }).formatToParts(d)
    const pick = (type: string) => hms.find((p) => p.type === type)?.value ?? '--'
    const date = new Intl.DateTimeFormat('es-AR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      timeZone
    }).format(d)
    const gmt =
      new Intl.DateTimeFormat('es-AR', { timeZoneName: 'short', timeZone })
        .formatToParts(d)
        .find((p) => p.type === 'timeZoneName')?.value ?? ''
    return { hh: pick('hour'), mm: pick('minute'), ss: pick('second'), date, gmt }
  } catch {
    return { hh: '--', mm: '--', ss: '--', date: '', gmt: '' }
  }
}

/** Reloj HUD: HH:MM en neón y los segundos en un anillo de 60 marcas que se van encendiendo. */
export default function HudClock({ now, timeZone, label = 'Hora local', className = '' }: HudClockProps) {
  const { hh, mm, ss, date, gmt } = clockParts(now, timeZone)
  const sec = Number.parseInt(ss, 10)

  return (
    <div className={`hud-clock ${className}`.trim()}>
      <span className="hud-clock__corners" aria-hidden />
      <span className="hud-clock__scan" aria-hidden />
      <div className="hud-clock__body">
        <div className="hud-clock__top">
          <span className="hud-clock__label">
            <i className="hud-clock__dot" />
            {label}
          </span>
          <span className="hud-clock__label">{gmt}</span>
        </div>

        <div className="hud-clock__row">
          <span className="hud-clock__hm" role="timer" aria-label={`${hh}:${mm}`}>
            {hh.split('').map((ch, i) => (
              <Digit key={`h${i}`} ch={ch} />
            ))}
            <span className="hud-clock__sep">:</span>
            {mm.split('').map((ch, i) => (
              <Digit key={`m${i}`} ch={ch} />
            ))}
          </span>

          <span className="hud-clock__ring">
            <svg viewBox="0 0 100 100" aria-hidden>
              {SEC_TICKS.map((t, i) => (
                <line
                  key={i}
                  x1={t.x1}
                  y1={t.y1}
                  x2={t.x2}
                  y2={t.y2}
                  className={`hud-clock__tick${t.major ? ' is-major' : ''}${i <= sec ? ' is-lit' : ''}${
                    i === sec ? ' is-head' : ''
                  }`}
                />
              ))}
            </svg>
            <span className="hud-clock__ss">
              {ss.split('').map((ch, i) => (
                <Digit key={`s${i}`} ch={ch} />
              ))}
            </span>
          </span>
        </div>

        <span className="hud-clock__date">{date}</span>
      </div>
    </div>
  )
}

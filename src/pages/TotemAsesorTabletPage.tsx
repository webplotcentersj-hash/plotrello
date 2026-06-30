import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../services/supabaseClient'
import {
  TOTEM_SOLICITUD_ASESOR_CHANNEL,
  TOTEM_SOLICITUD_ASESOR_EVENT,
  TOTEM_SOLICITUD_ASESOR_MARKER,
  type TotemSolicitudAsesorPayload
} from '../constants/totemSolicitudAsesor'
import { playPedidoTallerAlertSound } from '../utils/playPedidoTallerAlertSound'
import './TotemAsesorTabletPage.css'

const LOGO_URL = 'https://www.plotcenterlab.com.ar/Group%20187.png'

type SolicitudAsesor = {
  key: string
  atencionId?: number
  clienteNombre: string
  numeroOp?: string
  sectorDestino?: string
  notas?: string
  sentAt: string
}

function formatHora(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    })
  } catch {
    return ''
  }
}

function formatReloj(d: Date): string {
  try {
    return d.toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    })
  } catch {
    return '--:--:--'
  }
}

function parseBroadcastPayload(raw: unknown): TotemSolicitudAsesorPayload | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const clienteNombre =
    typeof o.clienteNombre === 'string' ? o.clienteNombre.trim() : ''
  const nonce = typeof o.nonce === 'string' ? o.nonce : ''
  const sentAt = typeof o.sentAt === 'string' ? o.sentAt : new Date().toISOString()
  if (!clienteNombre || !nonce) return null
  return {
    atencionId:
      typeof o.atencionId === 'number'
        ? o.atencionId
        : Number.isFinite(Number(o.atencionId))
          ? Number(o.atencionId)
          : undefined,
    clienteNombre,
    numeroOp: typeof o.numeroOp === 'string' ? o.numeroOp.trim() : undefined,
    sectorDestino: typeof o.sectorDestino === 'string' ? o.sectorDestino.trim() : undefined,
    notas: typeof o.notas === 'string' ? o.notas.trim() : undefined,
    sentAt,
    nonce
  }
}

function fromAtencionRow(row: Record<string, unknown>): SolicitudAsesor | null {
  const notas = typeof row.notas === 'string' ? row.notas : ''
  if (!notas.includes(TOTEM_SOLICITUD_ASESOR_MARKER)) return null
  const id = typeof row.id === 'number' ? row.id : Number(row.id)
  const clienteNombre =
    typeof row.cliente_nombre === 'string' ? row.cliente_nombre.trim() : ''
  if (!clienteNombre) return null
  const fecha =
    typeof row.fecha_atencion === 'string'
      ? row.fecha_atencion
      : new Date().toISOString()
  const opMatch = notas.match(/OP[:\s#]*(\d[\d-]*)/i)
  const sectorMatch = notas.match(/Sector sugerido:\s*([^.]+)/i)
  return {
    key: `db-${id}`,
    atencionId: Number.isFinite(id) ? id : undefined,
    clienteNombre,
    numeroOp: opMatch?.[1],
    sectorDestino: sectorMatch?.[1]?.trim(),
    notas,
    sentAt: fecha
  }
}

function fromBroadcastPayload(p: TotemSolicitudAsesorPayload): SolicitudAsesor {
  return {
    key: `rt-${p.nonce}`,
    atencionId: p.atencionId,
    clienteNombre: p.clienteNombre,
    numeroOp: p.numeroOp,
    sectorDestino: p.sectorDestino,
    notas: p.notas,
    sentAt: p.sentAt
  }
}

export default function TotemAsesorTabletPage() {
  const [now, setNow] = useState(() => new Date())
  const [pendientes, setPendientes] = useState<SolicitudAsesor[]>([])
  const [active, setActive] = useState<SolicitudAsesor | null>(null)
  const [atendidas, setAtendidas] = useState<Set<string>>(() => new Set())
  const lastNonceRef = useRef<string | null>(null)
  const beepIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const pushSolicitud = useCallback((solicitud: SolicitudAsesor) => {
    setPendientes((prev) => {
      if (prev.some((p) => p.key === solicitud.key)) return prev
      return [solicitud, ...prev].slice(0, 40)
    })
    setActive((current) => current ?? solicitud)
  }, [])

  const stopAlarm = useCallback(() => {
    if (beepIntervalRef.current != null) {
      clearInterval(beepIntervalRef.current)
      beepIntervalRef.current = null
    }
  }, [])

  const startAlarm = useCallback(() => {
    stopAlarm()
    playPedidoTallerAlertSound()
    beepIntervalRef.current = setInterval(() => {
      playPedidoTallerAlertSound()
    }, 2800)
  }, [stopAlarm])

  useEffect(() => {
    if (!active) {
      stopAlarm()
      return
    }
    startAlarm()
    return () => stopAlarm()
  }, [active, startAlarm, stopAlarm])

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    if (!supabase) return
    const sb = supabase

    const channel = sb.channel(TOTEM_SOLICITUD_ASESOR_CHANNEL, {
      config: { broadcast: { ack: false, self: false } }
    }).on('broadcast', { event: TOTEM_SOLICITUD_ASESOR_EVENT }, (msg: unknown) => {
      const rawPayload =
        msg && typeof msg === 'object' && 'payload' in msg
          ? (msg as { payload: unknown }).payload
          : msg
      const parsed = parseBroadcastPayload(rawPayload)
      if (!parsed) return
      if (lastNonceRef.current === parsed.nonce) return
      lastNonceRef.current = parsed.nonce
      pushSolicitud(fromBroadcastPayload(parsed))
    })

    void channel.subscribe()

    const pgChannel = sb
      .channel('totem-asesor-atenciones')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'atenciones_mostrador' },
        (payload) => {
          const row = payload.new as Record<string, unknown>
          const solicitud = fromAtencionRow(row)
          if (solicitud) pushSolicitud(solicitud)
        }
      )
      .subscribe()

    return () => {
      void sb.removeChannel(channel)
      void sb.removeChannel(pgChannel)
    }
  }, [pushSolicitud])

  const marcarAtendida = useCallback((solicitud: SolicitudAsesor) => {
    setPendientes((list) => {
      setAtendidas((attended) => {
        const nextAttended = new Set(attended)
        nextAttended.add(solicitud.key)
        setActive((current) => {
          if (current?.key !== solicitud.key) return current
          return list.find((p) => !nextAttended.has(p.key)) ?? null
        })
        return nextAttended
      })
      return list
    })
  }, [])

  const pendientesVisibles = pendientes.filter((p) => !atendidas.has(p.key))

  return (
    <div className="totem-asesor-page">
      <header className="totem-asesor-header">
        <img src={LOGO_URL} alt="Plot Center" className="totem-asesor-logo" />
        <div className="totem-asesor-header-text">
          <h1>Panel Asesor</h1>
          <p>Solicitudes desde el tótem de autoservicio</p>
        </div>
        <div className="totem-asesor-clock" aria-live="polite">
          <span className="totem-asesor-clock-time">{formatReloj(now)}</span>
        </div>
      </header>

      <main className="totem-asesor-main">
        {pendientesVisibles.length === 0 ? (
          <div className="totem-asesor-idle">
            <div className="totem-asesor-idle-pulse" aria-hidden />
            <p className="totem-asesor-idle-title">Esperando solicitudes</p>
            <p className="totem-asesor-idle-sub">
              Cuando un cliente toque <strong>«Llamar a un asesor»</strong> en el tótem, vas a ver el
              aviso acá con sonido.
            </p>
          </div>
        ) : (
          <ul className="totem-asesor-list">
            {pendientesVisibles.map((s) => (
              <li key={s.key}>
                <article className={`totem-asesor-card${active?.key === s.key ? ' totem-asesor-card--active' : ''}`}>
                  <div className="totem-asesor-card-top">
                    <span className="totem-asesor-card-time">{formatHora(s.sentAt)}</span>
                    <span className="totem-asesor-card-badge">Nueva solicitud</span>
                  </div>
                  <h2 className="totem-asesor-card-name">{s.clienteNombre}</h2>
                  {s.numeroOp && <p className="totem-asesor-card-op">OP #{s.numeroOp}</p>}
                  {s.sectorDestino && (
                    <p className="totem-asesor-card-sector">Sector sugerido: {s.sectorDestino}</p>
                  )}
                  <button
                    type="button"
                    className="totem-asesor-card-btn"
                    onClick={() => marcarAtendida(s)}
                  >
                    ✓ Ya lo atendí
                  </button>
                </article>
              </li>
            ))}
          </ul>
        )}
      </main>

      {active && !atendidas.has(active.key) && (
        <div
          className="totem-asesor-overlay"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="totem-asesor-alert-title"
        >
          <div className="totem-asesor-overlay-led totem-asesor-overlay-led--top" aria-hidden />
          <div className="totem-asesor-overlay-led totem-asesor-overlay-led--bottom" aria-hidden />
          <div className="totem-asesor-overlay-card">
            <div className="totem-asesor-overlay-pulse" aria-hidden />
            <span className="totem-asesor-overlay-badge">📞 Cliente en tótem</span>
            <h2 id="totem-asesor-alert-title" className="totem-asesor-overlay-title">
              {active.clienteNombre}
            </h2>
            {active.numeroOp && (
              <p className="totem-asesor-overlay-op">OP #{active.numeroOp}</p>
            )}
            {active.sectorDestino && (
              <p className="totem-asesor-overlay-meta">
                Sector sugerido: <strong>{active.sectorDestino}</strong>
              </p>
            )}
            <p className="totem-asesor-overlay-hint">
              Un cliente pidió hablar con un asesor. Acercate al tótem / mostrador.
            </p>
            <div className="totem-asesor-overlay-actions">
              <button
                type="button"
                className="totem-asesor-overlay-btn-primary"
                onClick={() => marcarAtendida(active)}
              >
                ✓ Voy a atenderlo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

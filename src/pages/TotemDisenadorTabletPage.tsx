import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../services/supabaseClient'
import apiService from '../services/api'
import { useAuth } from '../hooks/useAuth'
import {
  TOTEM_DISENADOR_EN_CAMINO_MARKER,
  TOTEM_SOLICITUD_DISENADOR_CHANNEL,
  TOTEM_SOLICITUD_DISENADOR_EVENT,
  TOTEM_SOLICITUD_DISENADOR_MARKER,
  mensajeDisenadorEnCamino,
  type TotemSolicitudDisenadorPayload
} from '../constants/totemSolicitudDisenador'
import { playPedidoTallerAlertSound } from '../utils/playPedidoTallerAlertSound'
import './TotemDisenadorTabletPage.css'

const LOGO_URL = '/plot-lab-logo.png'
/** Solo solicitudes recientes: el poll no debe reabrir llamadas viejas de prueba. */
const SOLICITUD_MAX_AGE_MS = 25 * 60 * 1000
const DISMISSED_ATENCIONES_KEY = 'plotlab_disenador_dismissed_atenciones'

type SolicitudDisenador = {
  key: string
  atencionId?: number
  requestNonce?: string
  clienteNombre: string
  sectorDestino?: string
  notas?: string
  briefToken?: string
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

function parseBroadcastPayload(raw: unknown): TotemSolicitudDisenadorPayload | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const clienteNombre = typeof o.clienteNombre === 'string' ? o.clienteNombre.trim() : ''
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
    sectorDestino: typeof o.sectorDestino === 'string' ? o.sectorDestino.trim() : undefined,
    notas: typeof o.notas === 'string' ? o.notas.trim() : undefined,
    briefToken: typeof o.briefToken === 'string' ? o.briefToken.trim() : undefined,
    sentAt,
    nonce
  }
}

function readDismissedAtencionIds(): Set<number> {
  try {
    const raw = sessionStorage.getItem(DISMISSED_ATENCIONES_KEY)
    if (!raw) return new Set()
    const arr = JSON.parse(raw) as unknown
    if (!Array.isArray(arr)) return new Set()
    return new Set(
      arr.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0)
    )
  } catch {
    return new Set()
  }
}

function persistDismissedAtencionId(id: number): void {
  if (!Number.isFinite(id) || id <= 0) return
  try {
    const next = readDismissedAtencionIds()
    next.add(id)
    sessionStorage.setItem(DISMISSED_ATENCIONES_KEY, JSON.stringify([...next].slice(-80)))
  } catch {
    /* ignore */
  }
}

function fromAtencionRow(row: Record<string, unknown>): SolicitudDisenador | null {
  const notas = typeof row.notas === 'string' ? row.notas : ''
  if (!notas.includes(TOTEM_SOLICITUD_DISENADOR_MARKER)) return null
  // Ya confirmada desde /disenador → no volver a mostrar
  if (notas.includes(TOTEM_DISENADOR_EN_CAMINO_MARKER)) return null
  const id = typeof row.id === 'number' ? row.id : Number(row.id)
  const clienteNombre =
    typeof row.cliente_nombre === 'string' ? row.cliente_nombre.trim() : ''
  if (!clienteNombre) return null
  const fecha =
    typeof row.fecha_atencion === 'string' ? row.fecha_atencion : new Date().toISOString()
  const sentMs = Date.parse(fecha)
  if (Number.isFinite(sentMs) && Date.now() - sentMs > SOLICITUD_MAX_AGE_MS) return null
  if (Number.isFinite(id) && readDismissedAtencionIds().has(id)) return null
  const tokenMatch = notas.match(/Brief token:\s*([a-zA-Z0-9-]+)/i)
  return {
    key: `db-${id}`,
    atencionId: Number.isFinite(id) ? id : undefined,
    clienteNombre,
    sectorDestino: 'Diseño gráfico',
    notas,
    briefToken: tokenMatch?.[1],
    sentAt: fecha
  }
}

function fromBroadcastPayload(p: TotemSolicitudDisenadorPayload): SolicitudDisenador {
  return {
    key: `rt-${p.nonce}`,
    atencionId: p.atencionId,
    requestNonce: p.nonce,
    clienteNombre: p.clienteNombre,
    sectorDestino: p.sectorDestino,
    notas: p.notas,
    briefToken: p.briefToken,
    sentAt: p.sentAt
  }
}

export default function TotemDisenadorTabletPage() {
  const { nombreVisible, usuario } = useAuth()
  const [now, setNow] = useState(() => new Date())
  const [pendientes, setPendientes] = useState<SolicitudDisenador[]>([])
  const [active, setActive] = useState<SolicitudDisenador | null>(null)
  const [atendidas, setAtendidas] = useState<Set<string>>(() => new Set())
  const [avisandoKey, setAvisandoKey] = useState<string | null>(null)
  const [avisoError, setAvisoError] = useState<string | null>(null)
  const [nombreManual, setNombreManual] = useState('')
  const lastNonceRef = useRef<string | null>(null)
  const beepIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const disenadorNombre =
    nombreVisible?.trim() || usuario?.nombre?.trim() || nombreManual.trim() || ''

  const pushSolicitud = useCallback((solicitud: SolicitudDisenador) => {
    if (
      solicitud.atencionId != null &&
      readDismissedAtencionIds().has(Number(solicitud.atencionId))
    ) {
      return
    }
    const sentMs = Date.parse(solicitud.sentAt)
    if (Number.isFinite(sentMs) && Date.now() - sentMs > SOLICITUD_MAX_AGE_MS) return

    setPendientes((prev) => {
      if (prev.some((p) => p.key === solicitud.key)) return prev
      if (
        solicitud.atencionId != null &&
        prev.some((p) => p.atencionId === solicitud.atencionId)
      ) {
        return prev
      }
      return [solicitud, ...prev].slice(0, 20)
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

    const channel = sb
      .channel(TOTEM_SOLICITUD_DISENADOR_CHANNEL, {
        config: { broadcast: { ack: false, self: false } }
      })
      .on('broadcast', { event: TOTEM_SOLICITUD_DISENADOR_EVENT }, (msg: unknown) => {
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

    void channel.subscribe((status) => {
      if (status === 'CHANNEL_ERROR') {
        console.warn('TotemDisenadorTabletPage: error de canal Realtime broadcast')
      }
    })

    const pgChannel = sb
      .channel('totem-disenador-atenciones')
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

    /** Poll: el broadcast es efímero y la tabla puede no estar en Realtime. */
    let cancelled = false
    const syncDesdeBd = async () => {
      try {
        const desde = new Date(Date.now() - SOLICITUD_MAX_AGE_MS).toISOString()
        const res = await apiService.obtenerAtencionesMostrador(desde)
        if (cancelled || !res.success || !Array.isArray(res.data)) return

        const abiertas: SolicitudDisenador[] = []
        const cerradasIds = new Set<number>()
        for (const row of res.data) {
          const notas = row.notas || ''
          if (!notas.includes(TOTEM_SOLICITUD_DISENADOR_MARKER)) continue
          const id = Number(row.id)
          if (notas.includes(TOTEM_DISENADOR_EN_CAMINO_MARKER)) {
            if (Number.isFinite(id) && id > 0) cerradasIds.add(id)
            continue
          }
          const solicitud = fromAtencionRow({
            id: row.id,
            cliente_nombre: row.cliente_nombre,
            notas: row.notas,
            fecha_atencion: row.fecha_atencion
          })
          if (solicitud) abiertas.push(solicitud)
        }

        // Sacar del panel las que ya tienen respuesta en BD (p. ej. otra pestaña)
        if (cerradasIds.size > 0) {
          for (const id of cerradasIds) persistDismissedAtencionId(id)
          setPendientes((prev) =>
            prev.filter((p) => p.atencionId == null || !cerradasIds.has(Number(p.atencionId)))
          )
          setActive((current) =>
            current?.atencionId != null && cerradasIds.has(Number(current.atencionId))
              ? null
              : current
          )
        }

        for (const solicitud of abiertas) {
          pushSolicitud(solicitud)
        }
      } catch (err) {
        console.warn('TotemDisenadorTabletPage: poll atenciones falló', err)
      }
    }

    void syncDesdeBd()
    const pollId = window.setInterval(() => {
      void syncDesdeBd()
    }, 4000)

    return () => {
      cancelled = true
      window.clearInterval(pollId)
      void sb.removeChannel(channel)
      void sb.removeChannel(pgChannel)
    }
  }, [pushSolicitud])

  const marcarAtendida = useCallback((solicitud: SolicitudDisenador) => {
    if (solicitud.atencionId != null) {
      persistDismissedAtencionId(Number(solicitud.atencionId))
    }
    setAtendidas((attended) => {
      const nextAttended = new Set(attended)
      nextAttended.add(solicitud.key)
      if (solicitud.atencionId != null) {
        nextAttended.add(`db-${solicitud.atencionId}`)
        nextAttended.add(`id-${solicitud.atencionId}`)
      }
      return nextAttended
    })
    setPendientes((list) => {
      const next = list.filter((p) => {
        if (p.key === solicitud.key) return false
        if (
          solicitud.atencionId != null &&
          p.atencionId != null &&
          Number(p.atencionId) === Number(solicitud.atencionId)
        ) {
          return false
        }
        return true
      })
      setActive((current) => {
        if (!current) return next[0] ?? null
        const stillThere = next.some((p) => p.key === current.key)
        if (stillThere) return current
        return next[0] ?? null
      })
      return next
    })
  }, [])

  const avisarYAtender = useCallback(
    async (solicitud: SolicitudDisenador) => {
      if (avisandoKey) return
      const nombre = disenadorNombre.trim()
      if (!nombre) {
        setAvisoError('Ingresá tu nombre arriba para que el cliente sepa quién va.')
        return
      }
      if (!solicitud.atencionId) {
        setAvisoError('No se pudo identificar la solicitud. Pedile al cliente que vuelva a llamar.')
        return
      }
      setAvisoError(null)
      setAvisandoKey(solicitud.key)
      try {
        const r = await apiService.broadcastDisenadorEnCaminoTotem({
          atencionId: solicitud.atencionId,
          requestNonce: solicitud.requestNonce,
          disenadorNombre: nombre,
          mensaje: mensajeDisenadorEnCamino(nombre)
        })
        if (!r.success) {
          setAvisoError(r.error || 'No se pudo avisar al tótem. Reintentá.')
          return
        }
        marcarAtendida(solicitud)
      } finally {
        setAvisandoKey(null)
      }
    },
    [avisandoKey, disenadorNombre, marcarAtendida]
  )

  const pendientesVisibles = pendientes.filter((p) => !atendidas.has(p.key))

  return (
    <div className="totem-asesor-page">
      <header className="totem-asesor-header">
        <img src={LOGO_URL} alt="Plot Center" className="totem-asesor-logo" />
        <div className="totem-asesor-header-text">
          <h1>Panel Diseñador</h1>
          <p>Solicitudes desde el tótem de Diseño (1° piso)</p>
          {nombreVisible?.trim() || usuario?.nombre?.trim() ? (
            <p className="totem-asesor-quien">
              Atendés como <strong>{disenadorNombre}</strong>
            </p>
          ) : (
            <label className="totem-asesor-nombre-label">
              Tu nombre (lo ve el cliente)
              <input
                type="text"
                className="totem-asesor-nombre-input"
                value={nombreManual}
                onChange={(e) => setNombreManual(e.target.value)}
                placeholder="Ej: Ivan Vera"
                autoComplete="name"
              />
            </label>
          )}
        </div>
        <div className="totem-asesor-clock" aria-live="polite">
          <span className="totem-asesor-clock-time">{formatReloj(now)}</span>
        </div>
      </header>

      {avisoError && (
        <div className="totem-asesor-banner-error" role="alert">
          {avisoError}
        </div>
      )}

      <main className="totem-asesor-main">
        {pendientesVisibles.length === 0 ? (
          <div className="totem-asesor-idle">
            <div className="totem-asesor-idle-pulse" aria-hidden />
            <p className="totem-asesor-idle-title">Esperando solicitudes</p>
            <p className="totem-asesor-idle-sub">
              Cuando un cliente toque <strong>«Llamar diseñador»</strong> en el tótem de Diseño, vas a
              ver el aviso acá. Al confirmar, el cliente ve tu nombre en pantalla.
            </p>
          </div>
        ) : (
          <ul className="totem-asesor-list">
            {pendientesVisibles.map((s) => (
              <li key={s.key}>
                <article
                  className={`totem-asesor-card${active?.key === s.key ? ' totem-asesor-card--active' : ''}`}
                >
                  <div className="totem-asesor-card-top">
                    <span className="totem-asesor-card-time">{formatHora(s.sentAt)}</span>
                    <span className="totem-asesor-card-badge">Nueva solicitud</span>
                  </div>
                  <h2 className="totem-asesor-card-name">{s.clienteNombre}</h2>
                  {s.briefToken && (
                    <p className="totem-asesor-card-op">Brief: {s.briefToken.slice(0, 8)}…</p>
                  )}
                  <button
                    type="button"
                    className="totem-asesor-card-btn"
                    disabled={avisandoKey === s.key}
                    onClick={() => void avisarYAtender(s)}
                  >
                    {avisandoKey === s.key
                      ? 'Avisando al tótem…'
                      : disenadorNombre
                        ? `✓ ${disenadorNombre.split(' ')[0]} va a ayudarlo`
                        : '✓ Voy a ayudarlo'}
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
          aria-labelledby="totem-disenador-alert-title"
        >
          <div className="totem-asesor-overlay-led totem-asesor-overlay-led--top" aria-hidden />
          <div className="totem-asesor-overlay-led totem-asesor-overlay-led--bottom" aria-hidden />
          <div className="totem-asesor-overlay-card">
            <div className="totem-asesor-overlay-pulse" aria-hidden />
            <span className="totem-asesor-overlay-badge">🎨 Cliente en tótem Diseño</span>
            <h2 id="totem-disenador-alert-title" className="totem-asesor-overlay-title">
              {active.clienteNombre}
            </h2>
            <p className="totem-asesor-overlay-hint">
              Pidió un diseñador. Al confirmar, el tótem mostrará que{' '}
              <strong>{disenadorNombre || 'vos'}</strong> ya vas a ayudarlo.
            </p>
            <div className="totem-asesor-overlay-actions">
              <button
                type="button"
                className="totem-asesor-overlay-btn-primary"
                disabled={avisandoKey === active.key}
                onClick={() => void avisarYAtender(active)}
              >
                {avisandoKey === active.key
                  ? 'Avisando al tótem…'
                  : disenadorNombre
                    ? `✓ ${disenadorNombre} ya va a ayudarlo`
                    : '✓ Voy a ayudarlo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

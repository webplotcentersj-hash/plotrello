import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../services/supabaseClient'
import { useAuth } from '../hooks/useAuth'
import apiService from '../services/api'
import {
  TALLER_IMPRENTA_PEDIDO_ENTREGA_CHANNEL,
  TALLER_IMPRENTA_PEDIDO_ENTREGA_EVENT,
  type TallerImprentaPedidoEntregaPayload
} from '../constants/tallerImprentaPedidoEntrega'
import { playPedidoTallerAlertSound } from '../utils/playPedidoTallerAlertSound'
import './TallerGraficoPedidoEntregaOverlay.css'

/** Reutiliza el audio de pedido a taller (public/audio/). */
function pedidoOverlayAudioUrl(): string {
  const base = import.meta.env.BASE_URL || '/'
  const normalized = base.endsWith('/') ? base : `${base}/`
  return `${normalized}audio/taller-grafico-pedido.mpeg`
}

function parseBroadcastPayload(raw: unknown): TallerImprentaPedidoEntregaPayload | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const idOrden = typeof o.idOrden === 'number' ? o.idOrden : Number(o.idOrden)
  const numeroOp = typeof o.numeroOp === 'string' ? o.numeroOp.trim() : ''
  const cliente = typeof o.cliente === 'string' ? o.cliente.trim() : ''
  const solicitanteId = typeof o.solicitanteId === 'number' ? o.solicitanteId : Number(o.solicitanteId)
  const solicitanteNombre = typeof o.solicitanteNombre === 'string' ? o.solicitanteNombre.trim() : ''
  const solicitanteRol = typeof o.solicitanteRol === 'string' ? o.solicitanteRol.trim() : undefined
  const sentAt = typeof o.sentAt === 'string' ? o.sentAt : ''
  const nonce = typeof o.nonce === 'string' ? o.nonce : ''
  if (!Number.isFinite(idOrden) || !numeroOp || !nonce) return null
  return {
    idOrden,
    numeroOp,
    cliente: cliente || '—',
    solicitanteId: Number.isFinite(solicitanteId) && solicitanteId > 0 ? solicitanteId : undefined,
    solicitanteNombre: solicitanteNombre || '—',
    solicitanteRol,
    sentAt: sentAt || new Date().toISOString(),
    nonce
  }
}

/**
 * Suscripción global para rol imprenta: pedido desde tótem / pantalla de entrega.
 */
export default function TallerImprentaPedidoEntregaOverlay() {
  const { isTallerImprenta } = useAuth()
  const navigate = useNavigate()
  const [active, setActive] = useState<TallerImprentaPedidoEntregaPayload | null>(null)
  const [ackLoading, setAckLoading] = useState(false)
  const lastNonceRef = useRef<string | null>(null)
  const alarmAudioRef = useRef<HTMLAudioElement | null>(null)
  const beepIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const dismiss = useCallback(() => {
    setActive(null)
  }, [])

  const marcarVisto = useCallback(async () => {
    if (!active || ackLoading) return
    if (!active.solicitanteId) {
      dismiss()
      return
    }
    setAckLoading(true)
    try {
      const r = await apiService.createNotification({
        user_id: active.solicitanteId,
        title: `✅ Taller de Imprenta tomó el pedido (OP #${active.numeroOp})`,
        description: `Taller de Imprenta confirmó que ya vio el pedido. OP #${active.numeroOp} · ${active.cliente}.`,
        type: 'success'
      })
      if (!r.success) {
        console.warn('TI visto: no se pudo crear la notificación:', r.error)
      } else {
        dismiss()
      }
    } finally {
      setAckLoading(false)
    }
  }, [active, ackLoading, dismiss])

  useEffect(() => {
    if (!isTallerImprenta || !supabase) return
    const sb = supabase

    const channel = sb.channel(TALLER_IMPRENTA_PEDIDO_ENTREGA_CHANNEL, {
      config: { broadcast: { ack: false, self: false } }
    }).on('broadcast', { event: TALLER_IMPRENTA_PEDIDO_ENTREGA_EVENT }, (msg: unknown) => {
      const rawPayload =
        msg && typeof msg === 'object' && 'payload' in msg
          ? (msg as { payload: unknown }).payload
          : msg
      const parsed = parseBroadcastPayload(rawPayload)
      if (!parsed) return
      if (lastNonceRef.current === parsed.nonce) return
      lastNonceRef.current = parsed.nonce
      setActive(parsed)
    })

    void channel.subscribe((status) => {
      if (status === 'CHANNEL_ERROR') {
        console.warn('TallerImprentaPedidoEntregaOverlay: error de canal Realtime')
      }
    })

    return () => {
      void sb.removeChannel(channel)
    }
  }, [isTallerImprenta])

  useEffect(() => {
    const stopAlarm = () => {
      const audio = alarmAudioRef.current
      if (audio) {
        audio.pause()
        audio.removeAttribute('src')
        audio.load()
        alarmAudioRef.current = null
      }
      if (beepIntervalRef.current != null) {
        clearInterval(beepIntervalRef.current)
        beepIntervalRef.current = null
      }
    }

    if (!active) {
      stopAlarm()
      return
    }

    const audio = new Audio(pedidoOverlayAudioUrl())
    audio.loop = true
    audio.volume = 1
    alarmAudioRef.current = audio
    void audio.play().catch(() => {
      /* autoplay bloqueado: siguen los beeps */
    })

    playPedidoTallerAlertSound()
    beepIntervalRef.current = setInterval(() => {
      playPedidoTallerAlertSound()
    }, 2400)

    return () => {
      stopAlarm()
    }
  }, [active])

  useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismiss()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, dismiss])

  if (!isTallerImprenta || !active) return null

  const hora = (() => {
    try {
      return new Date(active.sentAt).toLocaleString('es-AR', {
        dateStyle: 'short',
        timeStyle: 'short'
      })
    } catch {
      return ''
    }
  })()

  return (
    <div
      className="tg-pedido-overlay"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="ti-pedido-heading"
      onClick={dismiss}
    >
      <div className="tg-pedido-led-strip tg-pedido-led-strip--top" aria-hidden />
      <div className="tg-pedido-led-strip tg-pedido-led-strip--bottom" aria-hidden />
      <div className="tg-pedido-card" onClick={(e) => e.stopPropagation()}>
        <div className="tg-pedido-pulse-ring" aria-hidden />
        <div className="tg-pedido-badge">
          {active.solicitanteRol === 'totem'
            ? 'Cliente en tótem · Pedido a mostrador'
            : 'Pedido desde Caja · Entrega'}
        </div>
        <h2 id="ti-pedido-heading" className="tg-pedido-op">
          OP #{active.numeroOp}
        </h2>
        <p className="tg-pedido-cliente">{active.cliente}</p>
        <p className="tg-pedido-meta">
          <strong>{active.solicitanteNombre}</strong>
          {active.solicitanteRol ? ` · ${active.solicitanteRol}` : ''}
          <br />
          <span style={{ opacity: 0.85 }}>{hora}</span>
        </p>
        <div className="tg-pedido-actions">
          <button type="button" className="tg-pedido-btn-primary" onClick={dismiss}>
            Entendido
          </button>
          {active.solicitanteId ? (
            <button
              type="button"
              className="tg-pedido-btn-primary"
              onClick={() => void marcarVisto()}
              disabled={ackLoading}
            >
              {ackLoading ? 'Enviando…' : '✅ Visto'}
            </button>
          ) : null}
          <button
            type="button"
            className="tg-pedido-btn-ghost"
            onClick={() => {
              dismiss()
              navigate(`/op/${encodeURIComponent(active.numeroOp)}`)
            }}
          >
            Ver OP
          </button>
        </div>
      </div>
    </div>
  )
}

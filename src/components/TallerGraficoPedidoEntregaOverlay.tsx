import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../services/supabaseClient'
import { useAuth } from '../hooks/useAuth'
import {
  TALLER_GRAFICO_PEDIDO_ENTREGA_CHANNEL,
  TALLER_GRAFICO_PEDIDO_ENTREGA_EVENT,
  type TallerGraficoPedidoEntregaPayload
} from '../constants/tallerGraficoPedidoEntrega'
import { playPedidoTallerAlertSound } from '../utils/playPedidoTallerAlertSound'
import './TallerGraficoPedidoEntregaOverlay.css'

/** Audio en `public/audio/` (WhatsApp export). */
function pedidoOverlayAudioUrl(): string {
  const base = import.meta.env.BASE_URL || '/'
  const normalized = base.endsWith('/') ? base : `${base}/`
  return `${normalized}audio/taller-grafico-pedido.mpeg`
}

function parseBroadcastPayload(raw: unknown): TallerGraficoPedidoEntregaPayload | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const idOrden = typeof o.idOrden === 'number' ? o.idOrden : Number(o.idOrden)
  const numeroOp = typeof o.numeroOp === 'string' ? o.numeroOp.trim() : ''
  const cliente = typeof o.cliente === 'string' ? o.cliente.trim() : ''
  const solicitanteNombre = typeof o.solicitanteNombre === 'string' ? o.solicitanteNombre.trim() : ''
  const solicitanteRol = typeof o.solicitanteRol === 'string' ? o.solicitanteRol.trim() : undefined
  const sentAt = typeof o.sentAt === 'string' ? o.sentAt : ''
  const nonce = typeof o.nonce === 'string' ? o.nonce : ''
  if (!Number.isFinite(idOrden) || !numeroOp || !nonce) return null
  return {
    idOrden,
    numeroOp,
    cliente: cliente || '—',
    solicitanteNombre: solicitanteNombre || '—',
    solicitanteRol,
    sentAt: sentAt || new Date().toISOString(),
    nonce
  }
}

/**
 * Suscripción global para rol taller-grafico: pedido desde pantalla de entrega (Caja/Mostrador).
 */
export default function TallerGraficoPedidoEntregaOverlay() {
  const { isTallerGrafico } = useAuth()
  const navigate = useNavigate()
  const [active, setActive] = useState<TallerGraficoPedidoEntregaPayload | null>(null)
  const lastNonceRef = useRef<string | null>(null)
  const alarmAudioRef = useRef<HTMLAudioElement | null>(null)
  const beepIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const dismiss = useCallback(() => {
    setActive(null)
  }, [])

  useEffect(() => {
    if (!isTallerGrafico || !supabase) return
    const sb = supabase

    const channel = sb.channel(TALLER_GRAFICO_PEDIDO_ENTREGA_CHANNEL, {
      config: { broadcast: { ack: false, self: false } }
    })
      .on('broadcast', { event: TALLER_GRAFICO_PEDIDO_ENTREGA_EVENT }, (msg: unknown) => {
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
        console.warn('TallerGraficoPedidoEntregaOverlay: error de canal Realtime')
      }
    })

    return () => {
      void sb.removeChannel(channel)
    }
  }, [isTallerGrafico])

  /** Beep sintético cada ~2,4 s + audio en loop hasta Entendido / Ver OP / Escape / clic fuera. */
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

  if (!isTallerGrafico || !active) return null

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
      aria-labelledby="tg-pedido-heading"
      onClick={dismiss}
    >
      <div className="tg-pedido-led-strip tg-pedido-led-strip--top" aria-hidden />
      <div className="tg-pedido-led-strip tg-pedido-led-strip--bottom" aria-hidden />
      <div className="tg-pedido-card" onClick={(e) => e.stopPropagation()}>
        <div className="tg-pedido-pulse-ring" aria-hidden />
        <div className="tg-pedido-badge">Pedido desde Caja · Entrega</div>
        <h2 id="tg-pedido-heading" className="tg-pedido-op">
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

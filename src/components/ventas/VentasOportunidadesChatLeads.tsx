import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import apiService from '../../services/api'
import { supabase } from '../../services/supabaseClient'
import { nombreClienteAtencionVisible, telefonoWhatsappAtencionVisible } from '../../utils/atencionClienteDisplay'
import { ATENCION_PUBLICO } from '../../utils/clientesRoutes'
import { buildWhatsappLink } from '../../utils/whatsappLink'
import './VentasOportunidadesChatLeads.css'

export type ChatLeadCRM = {
  id: number
  cliente_nombre: string | null
  cliente_email: string | null
  cliente_telefono?: string | null
  cliente_whatsapp_link?: string | null
  canal: string
  ultimo_mensaje_preview: string | null
  estado: string
  visto_por_staff_at?: string | null
  historial_mensajes?: Array<{ role: string; text: string; contacto_nombre?: string; whatsapp?: string }>
  respuestas_staff?: Array<{ autor: string; texto: string }>
  created_at: string
  updated_at: string
}

type FiltroChat = 'todas' | 'sin_leer' | 'con_contacto' | 'hoy' | 'chat_web' | 'totem' | 'portal'

type Props = {
  onCrearOportunidad: (lead: {
    id?: number
    cliente_nombre: string
    cliente_telefono?: string
    cliente_email?: string
    descripcion?: string
  }) => void
  onStatsChange?: (stats: { sinLeer: number; total: number; conContacto: number }) => void
}

function isToday(dateStr: string): boolean {
  try {
    const d = new Date(dateStr)
    const t = new Date()
    return d.getDate() === t.getDate() && d.getMonth() === t.getMonth() && d.getFullYear() === t.getFullYear()
  } catch {
    return false
  }
}

function tiempoRelativo(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    const now = new Date()
    const diffMin = Math.floor((now.getTime() - d.getTime()) / 60000)
    if (diffMin < 1) return 'Ahora'
    if (diffMin < 60) return `Hace ${diffMin} min`
    if (diffMin < 1440) return `Hace ${Math.floor(diffMin / 60)} h`
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  } catch {
    return dateStr
  }
}

function labelCanal(canal: string): string {
  switch (canal) {
    case 'chat_web':
      return 'Chat web'
    case 'totem':
      return 'Tótem'
    case 'cliente_portal':
      return 'Portal cliente'
    default:
      return canal || '—'
  }
}

function tieneContactoCompleto(c: ChatLeadCRM): boolean {
  const nombre = nombreClienteAtencionVisible(c)
  if (nombre === 'Cliente web' && !c.cliente_email) return false
  return !!telefonoWhatsappAtencionVisible(c)
}

export default function VentasOportunidadesChatLeads({ onCrearOportunidad, onStatsChange }: Props) {
  const [conversaciones, setConversaciones] = useState<ChatLeadCRM[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState<FiltroChat>('sin_leer')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiService.listConversacionesAtencion()
      setConversaciones(res.success && res.data ? (res.data as ChatLeadCRM[]) : [])
    } catch {
      setConversaciones([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!supabase) return
    const ch = supabase
      .channel(`crm-chat-leads:${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'atencion_conversaciones' }, () => {
        void load()
      })
      .subscribe()
    return () => {
      if (supabase) void supabase.removeChannel(ch)
    }
  }, [load])

  const stats = useMemo(() => {
    const activas = conversaciones.filter((c) => c.estado !== 'cerrado')
    const sinLeer = activas.filter((c) => !c.visto_por_staff_at).length
    const conContacto = activas.filter(tieneContactoCompleto).length
    const hoy = activas.filter((c) => isToday(c.updated_at)).length
    const porCanal = {
      chat_web: activas.filter((c) => c.canal === 'chat_web').length,
      totem: activas.filter((c) => c.canal === 'totem').length,
      portal: activas.filter((c) => c.canal === 'cliente_portal').length
    }
    const staffRespondio = activas.filter((c) => (c.respuestas_staff?.length ?? 0) > 0).length
    return {
      total: activas.length,
      sinLeer,
      conContacto,
      hoy,
      staffRespondio,
      porCanal
    }
  }, [conversaciones])

  useEffect(() => {
    onStatsChange?.({ sinLeer: stats.sinLeer, total: stats.total, conContacto: stats.conContacto })
  }, [stats.sinLeer, stats.total, stats.conContacto, onStatsChange])

  const filtradas = useMemo(() => {
    let list = conversaciones.filter((c) => c.estado !== 'cerrado')
    switch (filtro) {
      case 'sin_leer':
        list = list.filter((c) => !c.visto_por_staff_at)
        break
      case 'con_contacto':
        list = list.filter(tieneContactoCompleto)
        break
      case 'hoy':
        list = list.filter((c) => isToday(c.updated_at))
        break
      case 'chat_web':
        list = list.filter((c) => c.canal === 'chat_web')
        break
      case 'totem':
        list = list.filter((c) => c.canal === 'totem')
        break
      case 'portal':
        list = list.filter((c) => c.canal === 'cliente_portal')
        break
      default:
        break
    }
    return [...list].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
  }, [conversaciones, filtro])

  return (
    <section className="crm-chat-leads" aria-labelledby="crm-chat-leads-title">
      <div className="crm-chat-leads-header">
        <div>
          <h3 id="crm-chat-leads-title">📞 Leads desde chat</h3>
          <p className="crm-chat-leads-sub">
            Conversaciones de Atención al público desglosadas para seguimiento comercial.
          </p>
        </div>
        <Link to={ATENCION_PUBLICO} className="crm-chat-leads-link-all">
          Abrir Atención al público →
        </Link>
      </div>

      <div className="crm-chat-leads-metrics">
        <button
          type="button"
          className={`crm-chat-leads-metric${filtro === 'sin_leer' ? ' crm-chat-leads-metric--active' : ''}`}
          onClick={() => setFiltro('sin_leer')}
        >
          <span className="crm-chat-leads-metric-val">{stats.sinLeer}</span>
          <span className="crm-chat-leads-metric-lbl">Sin leer</span>
        </button>
        <button
          type="button"
          className={`crm-chat-leads-metric${filtro === 'con_contacto' ? ' crm-chat-leads-metric--active' : ''}`}
          onClick={() => setFiltro('con_contacto')}
        >
          <span className="crm-chat-leads-metric-val">{stats.conContacto}</span>
          <span className="crm-chat-leads-metric-lbl">Con WhatsApp</span>
        </button>
        <button
          type="button"
          className={`crm-chat-leads-metric${filtro === 'hoy' ? ' crm-chat-leads-metric--active' : ''}`}
          onClick={() => setFiltro('hoy')}
        >
          <span className="crm-chat-leads-metric-val">{stats.hoy}</span>
          <span className="crm-chat-leads-metric-lbl">Hoy</span>
        </button>
        <div className="crm-chat-leads-metric crm-chat-leads-metric--static">
          <span className="crm-chat-leads-metric-val">{stats.staffRespondio}</span>
          <span className="crm-chat-leads-metric-lbl">Staff respondió</span>
        </div>
        <div className="crm-chat-leads-metric crm-chat-leads-metric--static">
          <span className="crm-chat-leads-metric-val">{stats.total}</span>
          <span className="crm-chat-leads-metric-lbl">Activas</span>
        </div>
      </div>

      <div className="crm-chat-leads-canales">
        <span className="crm-chat-leads-canales-title">Por canal:</span>
        <button
          type="button"
          className={`crm-chat-leads-canal-chip${filtro === 'chat_web' ? ' active' : ''}`}
          onClick={() => setFiltro('chat_web')}
        >
          Web ({stats.porCanal.chat_web})
        </button>
        <button
          type="button"
          className={`crm-chat-leads-canal-chip${filtro === 'totem' ? ' active' : ''}`}
          onClick={() => setFiltro('totem')}
        >
          Tótem ({stats.porCanal.totem})
        </button>
        <button
          type="button"
          className={`crm-chat-leads-canal-chip${filtro === 'portal' ? ' active' : ''}`}
          onClick={() => setFiltro('portal')}
        >
          Portal ({stats.porCanal.portal})
        </button>
        <button
          type="button"
          className={`crm-chat-leads-canal-chip${filtro === 'todas' ? ' active' : ''}`}
          onClick={() => setFiltro('todas')}
        >
          Todas
        </button>
      </div>

      {loading ? (
        <p className="crm-chat-leads-empty">Cargando conversaciones…</p>
      ) : filtradas.length === 0 ? (
        <p className="crm-chat-leads-empty">No hay leads de chat en este filtro.</p>
      ) : (
        <ul className="crm-chat-leads-list">
          {filtradas.map((c) => {
            const nombre = nombreClienteAtencionVisible(c)
            const telefono = telefonoWhatsappAtencionVisible(c)
            const wa = c.cliente_whatsapp_link || buildWhatsappLink(telefono)
            const sinLeer = !c.visto_por_staff_at
            return (
              <li key={c.id} className={`crm-chat-leads-item${sinLeer ? ' crm-chat-leads-item--nuevo' : ''}`}>
                <div className="crm-chat-leads-item-top">
                  <div>
                    <strong className="crm-chat-leads-item-nombre">{nombre}</strong>
                    <span className="crm-chat-leads-item-canal">{labelCanal(c.canal)}</span>
                    {sinLeer && <span className="crm-chat-leads-badge-nuevo">Nuevo</span>}
                    {(c.respuestas_staff?.length ?? 0) > 0 && (
                      <span className="crm-chat-leads-badge-staff">Staff</span>
                    )}
                  </div>
                  <span className="crm-chat-leads-item-time">{tiempoRelativo(c.updated_at)}</span>
                </div>
                {c.ultimo_mensaje_preview && (
                  <p className="crm-chat-leads-item-preview">{c.ultimo_mensaje_preview}</p>
                )}
                <div className="crm-chat-leads-item-meta">
                  {telefono && wa ? (
                    <a href={wa} target="_blank" rel="noopener noreferrer" className="crm-chat-leads-wa">
                      WhatsApp {telefono}
                    </a>
                  ) : (
                    <span className="crm-chat-leads-sin-tel">Sin WhatsApp</span>
                  )}
                  {c.cliente_email && <span className="crm-chat-leads-email">{c.cliente_email}</span>}
                </div>
                <div className="crm-chat-leads-item-actions">
                  <Link
                    to={`${ATENCION_PUBLICO}?conversacion=${c.id}`}
                    className="crm-chat-leads-btn crm-chat-leads-btn--secondary"
                  >
                    Ver chat
                  </Link>
                  <button
                    type="button"
                    className="crm-chat-leads-btn crm-chat-leads-btn--primary"
                    onClick={() =>
                      onCrearOportunidad({
                        id: c.id,
                        cliente_nombre: nombre,
                        cliente_telefono: telefono || undefined,
                        cliente_email: c.cliente_email || undefined,
                        descripcion: c.ultimo_mensaje_preview
                          ? `Lead chat #${c.id} (${labelCanal(c.canal)}): ${c.ultimo_mensaje_preview}`
                          : `Lead desde chat #${c.id} (${labelCanal(c.canal)})`
                      })
                    }
                  >
                    + Oportunidad
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

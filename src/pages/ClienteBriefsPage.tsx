import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Palette, Plus, RefreshCw, Sparkles } from 'lucide-react'
import { useClienteAuth } from '../hooks/useClienteAuth'
import apiService from '../services/api'
import ClientePageHeader from '../components/cliente/ClientePageHeader'
import ClientePageLayout from '../components/cliente/ClientePageLayout'
import ClientePageLoading from '../components/cliente/ClientePageLoading'
import ClienteStatusBadge from '../components/cliente/ClienteStatusBadge'
import BriefMockupCard from '../components/BriefMockupCard'
import {
  BRIEF_PIPELINE_STEPS,
  getBriefCardTitle,
  getClienteBriefStatus,
  type BriefFase
} from '../utils/clienteBriefStatus'
import './ClienteBriefsPage.css'

type BriefRecord = {
  id: number
  token: string
  cliente_nombre_completo: string | null
  cliente_empresa: string | null
  email_cliente: string | null
  brief_publico: string | null
  objetivo_proyecto: string | null
  tipo_producto_servicio: string[] | null
  completado: boolean
  id_orden_asociada: number | null
  numero_op: string | null
  fecha_creacion: string | null
  fecha_completado: string | null
  es_urgencia: boolean | null
  estado?: string | null
  mockup_url?: string | null
  etapa_taller_grafico?: string | null
  etapa_instalaciones?: string | null
  etapa_taller_imprenta?: string | null
  etapa_impresion_digital?: string | null
  etapa_metalurgica?: string | null
}

type FiltroFase = 'todos' | BriefFase

export default function ClienteBriefsPage() {
  const { cliente, loading: authLoading } = useClienteAuth()
  const navigate = useNavigate()
  const [briefs, setBriefs] = useState<BriefRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)
  const [filtro, setFiltro] = useState<FiltroFase>('todos')

  const loadBriefs = useCallback(async (silent = false) => {
    if (!cliente) return
    if (!silent) setLoading(true)
    if (!silent) setError('')
    try {
      const response = await apiService.listarBriefsPorCliente(cliente.id)
      if (response.success && response.data) {
        setBriefs(response.data)
      } else if (!silent) {
        setError(response.error || 'Error al cargar pedidos de diseño')
      }
    } catch {
      if (!silent) setError('Error de conexión')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [cliente])

  useEffect(() => {
    if (authLoading) return
    if (!cliente) {
      navigate('/cliente/login')
      return
    }
    loadBriefs(false)
  }, [cliente, authLoading, navigate, loadBriefs])

  useEffect(() => {
    if (!cliente || authLoading) return
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') loadBriefs(true)
    }, 30000)
    return () => clearInterval(interval)
  }, [cliente, authLoading, loadBriefs])

  const handleNuevoBrief = async () => {
    if (!cliente) return
    setCreating(true)
    setError('')
    try {
      const response = await apiService.crearBriefPublico(undefined, cliente.id)
      if (response.success && response.data) {
        navigate(`/cliente/brief/${response.data}`)
      } else {
        setError(response.error || 'Error al crear pedido de diseño')
      }
    } catch {
      setError('Error al crear pedido de diseño')
    } finally {
      setCreating(false)
    }
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Sin fecha'
    return new Date(dateStr).toLocaleDateString('es-AR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    })
  }

  const briefsConEstado = useMemo(
    () =>
      briefs.map((b) => ({
        brief: b,
        status: getClienteBriefStatus(b),
        title: getBriefCardTitle(b)
      })),
    [briefs]
  )

  const filtrados = useMemo(() => {
    if (filtro === 'todos') return briefsConEstado
    return briefsConEstado.filter((x) => x.status.fase === filtro)
  }, [briefsConEstado, filtro])

  const conteos = useMemo(() => {
    const c = { todos: briefs.length, borrador: 0, enviado: 0, produccion: 0, entregado: 0 }
    for (const { status } of briefsConEstado) {
      c[status.fase] += 1
    }
    return c
  }, [briefsConEstado, briefs.length])

  if (authLoading || loading) {
    return <ClientePageLoading />
  }

  return (
    <ClientePageLayout className="cliente-briefs-page">
      <ClientePageHeader
        eyebrow="Diseño"
        title="Mis pedidos de diseño"
        subtitle="Briefs creativos: desde tu idea hasta la orden en producción"
        actions={
          <button
            type="button"
            className="cliente-btn-primary cliente-briefs-new-btn"
            onClick={handleNuevoBrief}
            disabled={creating}
          >
            <Plus size={18} aria-hidden />
            {creating ? 'Abriendo…' : 'Nuevo pedido'}
          </button>
        }
      />

      {error && <div className="cliente-page-alert cliente-page-alert--error">{error}</div>}

      <section className="cliente-briefs-intro cliente-page-card">
        <div className="cliente-briefs-intro__icon" aria-hidden>
          <Palette size={22} />
        </div>
        <div>
          <h2 className="cliente-briefs-intro__title">¿Cómo funciona?</h2>
          <ol className="cliente-briefs-intro__steps">
            <li><strong>Completás el brief</strong> con productos, objetivo y mockup.</li>
            <li><strong>Plot Center lo revisa</strong> y crea tu orden de trabajo (OP).</li>
            <li><strong>Seguís el avance</strong> hasta que el trabajo esté listo.</li>
          </ol>
        </div>
      </section>

      <div className="cliente-briefs-toolbar">
        <div className="cliente-briefs-filters" role="tablist" aria-label="Filtrar pedidos">
          {(
            [
              ['todos', 'Todos', conteos.todos],
              ['borrador', 'Borradores', conteos.borrador],
              ['enviado', 'En revisión', conteos.enviado],
              ['produccion', 'En producción', conteos.produccion],
              ['entregado', 'Entregados', conteos.entregado]
            ] as const
          ).map(([id, label, count]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={filtro === id}
              className={`cliente-briefs-filter ${filtro === id ? 'is-active' : ''}`}
              onClick={() => setFiltro(id)}
            >
              {label}
              <span className="cliente-briefs-filter__count">{count}</span>
            </button>
          ))}
        </div>
        <button
          type="button"
          className="cliente-btn-outline cliente-briefs-refresh"
          onClick={async () => {
            setRefreshing(true)
            await loadBriefs(true)
            setRefreshing(false)
          }}
          disabled={refreshing}
        >
          <RefreshCw size={16} className={refreshing ? 'is-spinning' : ''} aria-hidden />
          {refreshing ? 'Actualizando…' : 'Actualizar'}
        </button>
      </div>

      {briefs.length === 0 ? (
        <div className="cliente-page-empty cliente-briefs-empty">
          <Sparkles size={40} strokeWidth={1.5} className="cliente-briefs-empty__icon" aria-hidden />
          <h3>Todavía no tenés pedidos de diseño</h3>
          <p>Contanos qué necesitás: banners, logos, piezas para redes y más.</p>
          <button type="button" className="cliente-btn-primary" onClick={handleNuevoBrief} disabled={creating}>
            Crear mi primer pedido
          </button>
        </div>
      ) : filtrados.length === 0 ? (
        <div className="cliente-page-empty">
          <p>No hay pedidos en esta categoría.</p>
          <button type="button" className="cliente-btn-outline" onClick={() => setFiltro('todos')}>
            Ver todos
          </button>
        </div>
      ) : (
        <ul className="cliente-briefs-list">
          {filtrados.map(({ brief, status, title }) => (
            <li key={brief.id}>
              <article
                className={`cliente-brief-card cliente-page-card ${brief.es_urgencia ? 'is-urgent' : ''}`}
                onClick={() => navigate(`/cliente/brief/${brief.token}`)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    navigate(`/cliente/brief/${brief.token}`)
                  }
                }}
                role="button"
                tabIndex={0}
              >
                <div className="cliente-brief-card__top">
                  <div className="cliente-brief-card__identity">
                    {brief.mockup_url ? (
                      <div className="cliente-brief-card__thumb">
                        <BriefMockupCard mockupUrl={brief.mockup_url} compact alt="" />
                      </div>
                    ) : (
                      <div className="cliente-brief-card__thumb cliente-brief-card__thumb--empty" aria-hidden>
                        <Palette size={28} strokeWidth={1.5} />
                      </div>
                    )}
                    <div className="cliente-brief-card__titles">
                      <h3 className="cliente-brief-card__title">{title}</h3>
                      <p className="cliente-brief-card__meta">
                        #{brief.id}
                        <span aria-hidden> · </span>
                        {formatDate(brief.fecha_completado || brief.fecha_creacion)}
                      </p>
                    </div>
                  </div>
                  <ClienteStatusBadge label={status.label} accent={status.accent} size="sm" />
                </div>

                <div className="cliente-brief-card__pipeline" aria-label="Progreso del pedido">
                  {BRIEF_PIPELINE_STEPS.map(({ step, label }) => (
                    <div
                      key={step}
                      className={`cliente-brief-card__pipe-step ${
                        step < status.step ? 'is-done' : step === status.step ? 'is-current' : ''
                      }`}
                    >
                      <span className="cliente-brief-card__pipe-dot" />
                      <span className="cliente-brief-card__pipe-label">{label}</span>
                    </div>
                  ))}
                </div>

                <p className="cliente-brief-card__hint">{status.hint}</p>

                {brief.tipo_producto_servicio && brief.tipo_producto_servicio.length > 0 && (
                  <div className="cliente-brief-card__tags">
                    {brief.tipo_producto_servicio.slice(0, 4).map((t) => (
                      <span key={t} className="cliente-brief-card__tag">
                        {t}
                      </span>
                    ))}
                  </div>
                )}

                <footer className="cliente-brief-card__footer">
                  <span className="cliente-brief-card__cta">
                    {!brief.completado ? 'Continuar brief' : 'Ver detalle'}
                    <ChevronRight size={16} aria-hidden />
                  </span>
                  {brief.es_urgencia && <span className="cliente-brief-card__urgent">Urgente</span>}
                  {brief.id_orden_asociada && brief.numero_op && (
                    <span className="cliente-brief-card__op">{brief.numero_op}</span>
                  )}
                </footer>
              </article>
            </li>
          ))}
        </ul>
      )}
    </ClientePageLayout>
  )
}

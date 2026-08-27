import { useEffect, useMemo, useState } from 'react'
import {
  ChevronRight,
  FileText,
  LayoutGrid,
  ShoppingBag,
  Sparkles
} from 'lucide-react'
import type { PedidoClienteRecord } from '../../types/api'
import type { WorkPoolOrdenSugerida, WorkPoolProduct, WorkPoolSector } from '../../types/workPool'
import { useAuth } from '../../hooks/useAuth'
import { apiService } from '../../services/api'
import { listOrdenesTableroPorSector } from './workPoolRepository'
import { TABLERO_COLA_LABEL } from './workPoolTablero'
import WorkPoolFuenteDetailModal, {
  type BriefFuenteResumen,
  type WorkPoolFuenteDetail
} from './WorkPoolFuenteDetailModal'
import './WorkPoolFuenteDetailModal.css'

type Props = {
  product: WorkPoolProduct
  sector: WorkPoolSector
  idUsuarioCreador: number
  onSeleccionarOp: (orden: WorkPoolOrdenSugerida) => void
  onAplicarBrief: (texto: string, cliente?: string, brief?: BriefFuenteResumen) => void
  onAplicarPedido: (pedido: PedidoClienteRecord) => void
}

function resumen(text: string | null | undefined, max = 64): string {
  if (!text?.trim()) return ''
  const one = text.replace(/\s+/g, ' ').trim()
  return one.length <= max ? one : `${one.slice(0, max)}…`
}

export default function WorkPoolFuentesEntrada({
  product,
  sector,
  idUsuarioCreador,
  onSeleccionarOp,
  onAplicarBrief,
  onAplicarPedido
}: Props) {
  const { nombreVisible } = useAuth()
  const showBriefsPortal = product === 'plot-design'
  const [tab, setTab] = useState<'tablero' | 'briefs' | 'pedidos'>('tablero')
  const [tablero, setTablero] = useState<WorkPoolOrdenSugerida[]>([])
  const [briefs, setBriefs] = useState<BriefFuenteResumen[]>([])
  const [pedidos, setPedidos] = useState<PedidoClienteRecord[]>([])
  const [loadingTablero, setLoadingTablero] = useState(true)
  const [loadingExtras, setLoadingExtras] = useState(true)
  const [fuenteDetail, setFuenteDetail] = useState<WorkPoolFuenteDetail | null>(null)

  const colaLabel = TABLERO_COLA_LABEL[sector]

  useEffect(() => {
    let cancelled = false
    setLoadingTablero(true)
    void listOrdenesTableroPorSector(sector, 24).then((tabRes) => {
      if (cancelled) return
      if (tabRes.success) setTablero(tabRes.data ?? [])
      setLoadingTablero(false)
    })
    return () => {
      cancelled = true
    }
  }, [sector])

  useEffect(() => {
    if (!showBriefsPortal) {
      setTab('tablero')
      setBriefs([])
      setPedidos([])
      setLoadingExtras(false)
      return
    }
    let cancelled = false
    setLoadingExtras(true)
    void Promise.all([apiService.listarBriefsPendientes(), apiService.getPedidosPendientes()]).then(
      ([briefRes, pedRes]) => {
        if (cancelled) return
        if (briefRes.success) setBriefs((briefRes.data ?? []) as BriefFuenteResumen[])
        if (pedRes.success) {
          setPedidos(
            (pedRes.data ?? []).filter(
              (p) =>
                !p.id_op_asociada &&
                !p.numero_op &&
                !['convertido_completo', 'cancelado', 'rechazado'].includes(p.estado)
            )
          )
        }
        setLoadingExtras(false)
      }
    )
    return () => {
      cancelled = true
    }
  }, [showBriefsPortal])

  const loading = loadingTablero || (showBriefsPortal && loadingExtras)
  const totalEntradas = tablero.length + (showBriefsPortal ? briefs.length + pedidos.length : 0)

  const tabItems = useMemo(
    () => [
      { id: 'tablero' as const, label: colaLabel, count: tablero.length, icon: LayoutGrid },
      ...(showBriefsPortal
        ? [
            { id: 'briefs' as const, label: 'Briefs', count: briefs.length, icon: FileText },
            { id: 'pedidos' as const, label: 'Portal', count: pedidos.length, icon: ShoppingBag }
          ]
        : [])
    ],
    [colaLabel, tablero.length, briefs.length, pedidos.length, showBriefsPortal]
  )

  const aplicarDesdeDetalle = (
    detail: WorkPoolFuenteDetail,
    opts?: { numeroOp?: string; textoBrief?: string; ordenId?: number }
  ) => {
    if (detail.kind === 'op') {
      onSeleccionarOp(detail.orden)
      return
    }
    if (detail.kind === 'brief') {
      const b = detail.brief
      const cliente = b.cliente_empresa || b.cliente_nombre_completo || 'Cliente'
      const tipos = b.tipo_producto_servicio?.join(', ') ?? ''
      const texto =
        opts?.textoBrief || [b.objetivo_proyecto, tipos].filter(Boolean).join(' · ')
      onAplicarBrief(texto, cliente, b)
      return
    }
    onAplicarPedido(detail.pedido)
    const numeroOp = opts?.numeroOp || detail.pedido.numero_op
    if (numeroOp) {
      const clienteNombre =
        (detail.pedido as PedidoClienteRecord & { cliente?: { nombre?: string; empresa?: string } }).cliente
          ?.empresa ||
        (detail.pedido as PedidoClienteRecord & { cliente?: { nombre?: string } }).cliente?.nombre ||
        detail.pedido.numero_pedido
      onSeleccionarOp({
        id: opts?.ordenId ?? detail.pedido.id_op_asociada ?? 0,
        numero_op: numeroOp,
        cliente: clienteNombre,
        descripcion: detail.pedido.brief_publico || detail.pedido.objetivo_proyecto || null,
        estado: detail.pedido.estado,
        sector: 'Diseño Gráfico'
      })
    }
  }

  return (
    <section className="work-pool-fuentes" aria-label="Fuentes de trabajo">
      <header className="work-pool-fuentes__head">
        <div className="work-pool-fuentes__head-copy">
          <p className="work-pool-fuentes__eyebrow">
            <Sparkles size={14} aria-hidden />
            Pipeline de publicación
          </p>
          <h4>Entradas de trabajo</h4>
          <p>
            {showBriefsPortal
              ? `OPs en ${colaLabel}, briefs sin OP y pedidos del portal — elegí una fuente para publicar o asignar.`
              : `OPs del tablero ${colaLabel} listas para bolsa o asignación directa.`}
          </p>
        </div>
        <div className="work-pool-fuentes__total" aria-label={`${totalEntradas} entradas en total`}>
          <span className="work-pool-fuentes__total-value">{totalEntradas}</span>
          <span className="work-pool-fuentes__total-label">pendientes</span>
        </div>
      </header>

      <div className="work-pool-fuentes__stats" role="group" aria-label="Resumen por fuente">
        {tabItems.map((item) => {
          const Icon = item.icon
          return (
            <button
              key={item.id}
              type="button"
              className={`work-pool-fuentes__stat${tab === item.id ? ' is-active' : ''}`}
              onClick={() => setTab(item.id)}
            >
              <span className="work-pool-fuentes__stat-icon" aria-hidden>
                <Icon size={18} />
              </span>
              <span className="work-pool-fuentes__stat-body">
                <strong>{item.count}</strong>
                <span>{item.label}</span>
              </span>
            </button>
          )
        })}
      </div>

      <div className="work-pool-fuentes__tabs" role="tablist" aria-label="Filtrar fuente">
        {tabItems.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={tab === item.id ? 'is-active' : ''}
            onClick={() => setTab(item.id)}
          >
            {item.label} <span>{item.count}</span>
          </button>
        ))}
      </div>

      <div className="work-pool-fuentes__body">
      {loading ? (
        <div className="work-pool-fuentes__loading">
          <span className="work-pool-fuentes__loading-dot" aria-hidden />
          Cargando fuentes…
        </div>
      ) : tab === 'tablero' ? (
        tablero.length === 0 ? (
          <p className="work-pool-fuentes__empty">
            No hay OPs en la columna {colaLabel} del tablero.
          </p>
        ) : (
          <div className="work-pool-fuentes__grid">
            {tablero.map((op) => (
              <button
                key={op.id}
                type="button"
                className="work-pool-fuentes__card work-pool-fuentes__card--tablero"
                onClick={() => setFuenteDetail({ kind: 'op', orden: op })}
              >
                <div className="work-pool-fuentes__card-top">
                  <span className="work-pool-fuentes__card-tag">Tablero</span>
                  {(op.brief_publico || op.objetivo_proyecto) && (
                    <span className="work-pool-fuentes__brief-hint">Brief</span>
                  )}
                  <ChevronRight size={16} className="work-pool-fuentes__card-chev" aria-hidden />
                </div>
                <strong className="work-pool-fuentes__card-title">OP {op.numero_op}</strong>
                <span className="work-pool-fuentes__card-client">{op.cliente}</span>
                {op.descripcion ? (
                  <small className="work-pool-fuentes__card-desc">{resumen(op.descripcion, 72)}</small>
                ) : null}
              </button>
            ))}
          </div>
        )
      ) : tab === 'briefs' ? (
        briefs.length === 0 ? (
          <p className="work-pool-fuentes__empty">No hay briefs pendientes sin OP.</p>
        ) : (
          <div className="work-pool-fuentes__grid">
            {briefs.map((b) => {
              const cliente = b.cliente_empresa || b.cliente_nombre_completo || 'Cliente'
              const tipos = b.tipo_producto_servicio?.join(', ') ?? ''
              const texto = [b.objetivo_proyecto, tipos].filter(Boolean).join(' · ')
              return (
                <button
                  key={b.id}
                  type="button"
                  className="work-pool-fuentes__card work-pool-fuentes__card--brief"
                  onClick={() => setFuenteDetail({ kind: 'brief', brief: b })}
                >
                  <div className="work-pool-fuentes__card-top">
                    <span className="work-pool-fuentes__card-tag">Brief</span>
                    {b.es_urgencia ? <span className="work-pool-fuentes__urgente">Urgente</span> : null}
                    <ChevronRight size={16} className="work-pool-fuentes__card-chev" aria-hidden />
                  </div>
                  <strong className="work-pool-fuentes__card-title">{cliente}</strong>
                  {texto ? <small className="work-pool-fuentes__card-desc">{resumen(texto, 90)}</small> : null}
                  <em className="work-pool-fuentes__card-meta">
                    {new Date(b.fecha_creacion).toLocaleDateString('es-AR')}
                  </em>
                </button>
              )
            })}
          </div>
        )
      ) : pedidos.length === 0 ? (
        <p className="work-pool-fuentes__empty">No hay pedidos del portal pendientes de convertir.</p>
      ) : (
        <div className="work-pool-fuentes__grid">
          {pedidos.map((p) => {
            const cliente =
              (p as PedidoClienteRecord & { cliente?: { nombre?: string; empresa?: string } }).cliente?.empresa ||
              (p as PedidoClienteRecord & { cliente?: { nombre?: string } }).cliente?.nombre ||
              `Pedido #${p.numero_pedido}`
            const texto = [p.brief_publico, p.objetivo_proyecto, p.observaciones_cliente]
              .filter(Boolean)
              .join(' · ')
            return (
              <button
                key={p.id}
                type="button"
                className="work-pool-fuentes__card work-pool-fuentes__card--pedido"
                onClick={() => setFuenteDetail({ kind: 'pedido', pedido: p })}
              >
                <div className="work-pool-fuentes__card-top">
                  <span className="work-pool-fuentes__card-tag">Portal</span>
                  {p.es_urgente ? <span className="work-pool-fuentes__urgente">Urgente</span> : null}
                  <ChevronRight size={16} className="work-pool-fuentes__card-chev" aria-hidden />
                </div>
                <strong className="work-pool-fuentes__card-title">{p.numero_pedido}</strong>
                <span className="work-pool-fuentes__card-client">{cliente}</span>
                {texto ? <small className="work-pool-fuentes__card-desc">{resumen(texto, 90)}</small> : null}
                <em className="work-pool-fuentes__card-meta">
                  {p.tipo_producto_servicio?.join(', ') || p.estado}
                </em>
              </button>
            )
          })}
        </div>
      )}
      </div>

      {fuenteDetail && (
        <WorkPoolFuenteDetailModal
          detail={fuenteDetail}
          idUsuarioCreador={idUsuarioCreador}
          usuarioNombre={nombreVisible}
          onClose={() => setFuenteDetail(null)}
          onUsarParaPublicar={aplicarDesdeDetalle}
        />
      )}
    </section>
  )
}

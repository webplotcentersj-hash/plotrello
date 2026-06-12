import { useEffect, useState } from 'react'
import type { PedidoClienteRecord } from '../../types/api'
import type { WorkPoolOrdenSugerida, WorkPoolSector } from '../../types/workPool'
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
  sector: WorkPoolSector
  idUsuarioCreador: number
  onSeleccionarOp: (orden: WorkPoolOrdenSugerida) => void
  onAplicarBrief: (texto: string, cliente?: string) => void
  onAplicarPedido: (pedido: PedidoClienteRecord) => void
}

function resumen(text: string | null | undefined, max = 64): string {
  if (!text?.trim()) return ''
  const one = text.replace(/\s+/g, ' ').trim()
  return one.length <= max ? one : `${one.slice(0, max)}…`
}

export default function WorkPoolFuentesEntrada({
  sector,
  idUsuarioCreador,
  onSeleccionarOp,
  onAplicarBrief,
  onAplicarPedido
}: Props) {
  const { usuario } = useAuth()
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
  }, [])

  const loading = loadingTablero || loadingExtras

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
      onAplicarBrief(texto, cliente)
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
        <div>
          <h4>Entradas de trabajo</h4>
          <p>OPs del tablero ({colaLabel}), briefs pendientes y pedidos del portal de clientes.</p>
        </div>
        <div className="work-pool-fuentes__tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'tablero'}
            className={tab === 'tablero' ? 'is-active' : ''}
            onClick={() => setTab('tablero')}
          >
            {colaLabel} <span>{tablero.length}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'briefs'}
            className={tab === 'briefs' ? 'is-active' : ''}
            onClick={() => setTab('briefs')}
          >
            Briefs <span>{briefs.length}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'pedidos'}
            className={tab === 'pedidos' ? 'is-active' : ''}
            onClick={() => setTab('pedidos')}
          >
            Portal <span>{pedidos.length}</span>
          </button>
        </div>
      </header>

      {loading ? (
        <p className="work-pool-publicar__muted">Cargando fuentes…</p>
      ) : tab === 'tablero' ? (
        tablero.length === 0 ? (
          <p className="work-pool-publicar__muted">
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
                <span className="work-pool-fuentes__card-tag">Tablero</span>
                <strong>OP {op.numero_op}</strong>
                <span>{op.cliente}</span>
                {op.descripcion ? <small>{resumen(op.descripcion)}</small> : null}
                {(op.brief_publico || op.objetivo_proyecto) && (
                  <em className="work-pool-fuentes__brief-hint">Incluye brief</em>
                )}
              </button>
            ))}
          </div>
        )
      ) : tab === 'briefs' ? (
        briefs.length === 0 ? (
          <p className="work-pool-publicar__muted">No hay briefs pendientes sin OP.</p>
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
                  <span className="work-pool-fuentes__card-tag">Brief</span>
                  {b.es_urgencia ? <span className="work-pool-fuentes__urgente">Urgente</span> : null}
                  <strong>{cliente}</strong>
                  {texto ? <small>{resumen(texto, 90)}</small> : null}
                  <em>{new Date(b.fecha_creacion).toLocaleDateString('es-AR')}</em>
                </button>
              )
            })}
          </div>
        )
      ) : pedidos.length === 0 ? (
        <p className="work-pool-publicar__muted">No hay pedidos del portal pendientes de convertir.</p>
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
                <span className="work-pool-fuentes__card-tag">Portal</span>
                {p.es_urgente ? <span className="work-pool-fuentes__urgente">Urgente</span> : null}
                <strong>{p.numero_pedido}</strong>
                <span>{cliente}</span>
                {texto ? <small>{resumen(texto, 90)}</small> : null}
                <em>{p.tipo_producto_servicio?.join(', ') || p.estado}</em>
              </button>
            )
          })}
        </div>
      )}

      {fuenteDetail && (
        <WorkPoolFuenteDetailModal
          detail={fuenteDetail}
          idUsuarioCreador={idUsuarioCreador}
          usuarioNombre={usuario?.nombre || 'Usuario'}
          onClose={() => setFuenteDetail(null)}
          onUsarParaPublicar={aplicarDesdeDetalle}
        />
      )}
    </section>
  )
}

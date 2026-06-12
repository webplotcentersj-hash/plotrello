import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { PedidoClienteDetalle, PedidoClienteRecord } from '../../types/api'
import type { Task, TeamMember } from '../../types/board'
import type { SectorRecord } from '../../types/api'
import type { WorkPoolOrdenSugerida } from '../../types/workPool'
import apiService from '../../services/api'
import { ordenToTask } from '../../utils/dataMappers'
import BriefMockupCard from '../../components/BriefMockupCard'
import {
  buildPedidoEspecificacionTexto,
  downloadArchivo,
  isImageArchivo,
  splitPedidoArchivos
} from '../../utils/pedidoClienteMaterial'
import {
  etiquetaTipoIntencionPedido,
  puedeConvertirPedidoAOp
} from '../../utils/pedidoClienteConversion'
import './WorkPoolFuenteDetailModal.css'

const TaskViewModal = lazy(() => import('../../components/TaskViewModal'))

export type BriefFuenteResumen = {
  id: number
  token: string
  cliente_nombre_completo: string | null
  cliente_empresa: string | null
  tipo_producto_servicio: string[] | null
  objetivo_proyecto: string | null
  fecha_creacion: string
  es_urgencia?: boolean
}

export type WorkPoolFuenteDetail =
  | { kind: 'op'; orden: WorkPoolOrdenSugerida }
  | { kind: 'brief'; brief: BriefFuenteResumen }
  | { kind: 'pedido'; pedido: PedidoClienteRecord }

type Props = {
  detail: WorkPoolFuenteDetail
  idUsuarioCreador: number
  usuarioNombre: string
  onClose: () => void
  onUsarParaPublicar: (
    detail: WorkPoolFuenteDetail,
    opts?: { numeroOp?: string; textoBrief?: string; ordenId?: number }
  ) => void
}

function buildBriefTexto(brief: Record<string, unknown>): string {
  return [
    brief.objetivo_proyecto,
    brief.brief_publico,
    brief.estilo_diseno,
    brief.referencias,
    brief.referencias_links,
    brief.donde_colocados,
    brief.digital_o_impresion,
    brief.cantidades,
    Array.isArray(brief.tipo_producto_servicio) ? (brief.tipo_producto_servicio as string[]).join(', ') : null
  ]
    .filter((v) => typeof v === 'string' && v.trim())
    .join('\n\n')
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  if (value == null || value === '') return null
  return (
    <div className="wp-fuente-detail__field">
      <span className="wp-fuente-detail__label">{label}</span>
      <div className="wp-fuente-detail__value">{value}</div>
    </div>
  )
}

function formatDateAr(iso: string | null | undefined) {
  if (!iso) return null
  return new Date(iso).toLocaleString('es-AR', { dateStyle: 'medium', timeStyle: 'short' })
}

export default function WorkPoolFuenteDetailModal({
  detail,
  idUsuarioCreador,
  usuarioNombre,
  onClose,
  onUsarParaPublicar
}: Props) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [task, setTask] = useState<Task | null>(null)
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [sectores, setSectores] = useState<SectorRecord[]>([])

  const [briefFull, setBriefFull] = useState<Record<string, unknown> | null>(null)
  const [pedidoDetalle, setPedidoDetalle] = useState<PedidoClienteDetalle | null>(null)
  const [convirtiendo, setConvirtiendo] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        if (detail.kind === 'op') {
          const [ordenRes, sectRes, usersRes] = await Promise.all([
            apiService.getOrden(detail.orden.id),
            apiService.getSectores(),
            apiService.getUsuarios()
          ])
          if (cancelled) return
          if (!ordenRes.success || !ordenRes.data) {
            setError(ordenRes.error || 'No se pudo cargar la OP')
            return
          }
          setTask(ordenToTask(ordenRes.data))
          if (sectRes.success && sectRes.data) setSectores(sectRes.data)
          if (usersRes.success && usersRes.data) {
            setTeamMembers(
              usersRes.data.map((u) => ({
                id: String(u.id),
                name: u.nombre,
                role: u.rol,
                avatar: '',
                productivity: 0
              }))
            )
          }
        } else if (detail.kind === 'brief') {
          const res = await apiService.obtenerBriefPorToken(detail.brief.token)
          if (cancelled) return
          if (!res.success || !res.data) {
            setError(res.error || 'No se pudo cargar el brief')
            return
          }
          setBriefFull(res.data as Record<string, unknown>)
        } else {
          const res = await apiService.getDetallePedidoCliente(detail.pedido.id)
          if (cancelled) return
          if (!res.success || !res.data) {
            setError(res.error || 'No se pudo cargar el pedido')
            return
          }
          setPedidoDetalle(res.data)
        }
      } catch {
        if (!cancelled) setError('Error al cargar el detalle')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [detail])

  const handleConvertirPedido = async () => {
    if (detail.kind !== 'pedido' || !pedidoDetalle) return
    if (!window.confirm('¿Convertir este pedido del portal en una OP? Se copiarán archivos y brief.')) return
    setConvirtiendo(true)
    setError('')
    try {
      const res = await apiService.convertirPedidoAOp({
        id_pedido: detail.pedido.id,
        id_usuario_convertidor: idUsuarioCreador,
        nombre_usuario_convertidor: usuarioNombre,
        sector_inicial: 'Diseño Gráfico'
      })
      if (!res.success || !res.data) {
        setError(res.error || 'No se pudo convertir el pedido')
        return
      }
      onUsarParaPublicar(
        { kind: 'pedido', pedido: { ...detail.pedido, numero_op: res.data.numero_op, id_op_asociada: res.data.id_op } },
        { numeroOp: res.data.numero_op, ordenId: res.data.id_op }
      )
      onClose()
    } catch {
      setError('Error al convertir el pedido')
    } finally {
      setConvirtiendo(false)
    }
  }

  if (detail.kind === 'op' && task && !loading && !error) {
    return (
      <>
        <Suspense fallback={null}>
          <TaskViewModal
            task={task}
            teamMembers={teamMembers}
            sectores={sectores}
            exhaustiveDetail
            onClose={onClose}
          />
        </Suspense>
        {createPortal(
          <div className="wp-fuente-detail__op-bar">
            <span>
              OP <strong>{detail.orden.numero_op}</strong> — {detail.orden.cliente}
            </span>
            <div className="wp-fuente-detail__op-bar-actions">
              <button
                type="button"
                className="work-pool-module__btn work-pool-module__btn--primary"
                onClick={() => {
                  onUsarParaPublicar(detail, { numeroOp: detail.orden.numero_op, ordenId: detail.orden.id })
                  onClose()
                }}
              >
                Usar para publicar
              </button>
              <button type="button" className="work-pool-module__btn work-pool-module__btn--ghost" onClick={onClose}>
                Cerrar
              </button>
            </div>
          </div>,
          document.body
        )}
      </>
    )
  }

  const title =
    detail.kind === 'brief'
      ? `Brief — ${detail.brief.cliente_empresa || detail.brief.cliente_nombre_completo || 'Cliente'}`
      : detail.kind === 'pedido'
        ? `Pedido ${detail.pedido.numero_pedido}`
        : `OP ${detail.orden.numero_op}`

  const pedido = pedidoDetalle?.pedido
  const archivos = pedidoDetalle?.archivos ?? []
  const { mockup, otros } = splitPedidoArchivos(archivos)

  return createPortal(
    <div className="wp-fuente-detail-backdrop" role="presentation" onClick={onClose}>
      <div
        className="wp-fuente-detail"
        role="dialog"
        aria-modal="true"
        aria-labelledby="wp-fuente-detail-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="wp-fuente-detail__header">
          <div>
            <span className="wp-fuente-detail__kind">
              {detail.kind === 'brief' ? 'Brief público' : detail.kind === 'pedido' ? 'Portal cliente' : 'Tablero'}
            </span>
            <h2 id="wp-fuente-detail-title">{title}</h2>
          </div>
          <button type="button" className="wp-fuente-detail__close" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </header>

        <div className="wp-fuente-detail__body">
          {loading && <p className="wp-fuente-detail__loading">Cargando detalle completo…</p>}
          {error && <p className="wp-fuente-detail__error">{error}</p>}

          {!loading && !error && detail.kind === 'brief' && briefFull && (
            <>
              <div className="wp-fuente-detail__mockup">
                <BriefMockupCard
                  mockupUrl={(briefFull.mockup_url as string) || null}
                  alt={`Mockup ${String(briefFull.cliente_nombre_completo || 'brief')}`}
                />
              </div>
              <div className="wp-fuente-detail__grid">
                <Field label="Cliente" value={String(briefFull.cliente_nombre_completo || '')} />
                <Field label="Empresa" value={String(briefFull.cliente_empresa || '')} />
                <Field label="Teléfono" value={String(briefFull.telefono_cliente || '')} />
                <Field label="Email" value={String(briefFull.email_cliente || '')} />
                <Field
                  label="Tipo de producto"
                  value={
                    Array.isArray(briefFull.tipo_producto_servicio)
                      ? (briefFull.tipo_producto_servicio as string[]).join(', ')
                      : null
                  }
                />
                <Field label="Objetivo" value={String(briefFull.objetivo_proyecto || '')} />
                <Field label="Brief público" value={String(briefFull.brief_publico || '')} />
                <Field label="Estilo de diseño" value={String(briefFull.estilo_diseno || '')} />
                <Field label="Referencias" value={String(briefFull.referencias || '')} />
                <Field label="Links de referencia" value={String(briefFull.referencias_links || '')} />
                <Field label="Dónde se colocan" value={String(briefFull.donde_colocados || '')} />
                <Field label="Formato" value={String(briefFull.digital_o_impresion || '')} />
                <Field label="Cantidades" value={String(briefFull.cantidades || '')} />
                <Field label="Material logo" value={String(briefFull.material_logo || '')} />
                <Field label="Material textos" value={String(briefFull.material_textos || '')} />
                <Field label="Material imágenes" value={String(briefFull.material_imagenes || '')} />
                <Field label="Fecha límite" value={formatDateAr(briefFull.fecha_limite_brief as string)} />
                <Field label="Urgencia" value={briefFull.es_urgencia ? 'Sí' : null} />
                <Field label="Creado" value={formatDateAr(detail.brief.fecha_creacion)} />
              </div>
              {(briefFull.mockup_url as string) && (
                <div className="wp-fuente-detail__downloads">
                  <a
                    href={briefFull.mockup_url as string}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="work-pool-module__btn work-pool-module__btn--ghost"
                  >
                    Abrir mockup
                  </a>
                  <button
                    type="button"
                    className="work-pool-module__btn work-pool-module__btn--ghost"
                    onClick={() =>
                      void downloadArchivo(
                        briefFull.mockup_url as string,
                        `mockup-brief-${detail.brief.token}.png`
                      )
                    }
                  >
                    Descargar mockup
                  </button>
                </div>
              )}
            </>
          )}

          {!loading && !error && detail.kind === 'pedido' && pedidoDetalle && pedido && (
            <>
              <div className="wp-fuente-detail__status-row">
                <span className="wp-fuente-detail__badge">{pedido.estado}</span>
                {pedido.es_urgente ? <span className="wp-fuente-detail__urgente">Urgente</span> : null}
              </div>
              <div className="wp-fuente-detail__grid">
                <Field
                  label="Cliente"
                  value={`${pedido.cliente?.nombre || ''} ${pedido.cliente?.apellido || ''}`.trim()}
                />
                <Field label="Empresa" value={pedido.cliente?.empresa} />
                <Field label="Email" value={pedido.cliente?.email} />
                <Field label="Teléfono" value={pedido.cliente?.telefono} />
                <Field label="Tipo" value={etiquetaTipoIntencionPedido(pedido.tipo_intencion)} />
                <Field label="Productos" value={pedido.tipo_producto_servicio?.join(', ')} />
                <Field label="Fecha pedido" value={formatDateAr(pedido.fecha_pedido)} />
                <Field label="Fecha límite" value={formatDateAr(pedido.fecha_limite_deseada)} />
                <Field label="OP asociada" value={pedido.numero_op || (pedido.id_op_asociada ? `#${pedido.id_op_asociada}` : null)} />
                <Field label="Observaciones" value={pedido.observaciones_cliente} />
                <Field label="Objetivo" value={pedido.objetivo_proyecto} />
                <Field label="Brief" value={pedido.brief_publico} />
                <Field label="Estilo" value={pedido.estilo_diseno} />
                <Field label="Referencias" value={pedido.referencias} />
                <Field label="Delivery" value={pedido.requiere_delivery ? pedido.direccion_delivery || 'Sí' : null} />
              </div>

              {buildPedidoEspecificacionTexto(pedido) && (
                <section className="wp-fuente-detail__section">
                  <h3>Especificación completa</h3>
                  <pre className="wp-fuente-detail__pre">{buildPedidoEspecificacionTexto(pedido)}</pre>
                </section>
              )}

              {pedidoDetalle.items.length > 0 && (
                <section className="wp-fuente-detail__section">
                  <h3>Artículos</h3>
                  <ul className="wp-fuente-detail__items">
                    {pedidoDetalle.items.map((item) => (
                      <li key={item.id}>
                        <strong>{item.articulo?.nombre || 'Artículo'}</strong>
                        {item.descripcion_personalizada ? ` — ${item.descripcion_personalizada}` : ''}
                        <span> × {item.cantidad}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <section className="wp-fuente-detail__section">
                <h3>Mockup y archivos</h3>
                {mockup ? (
                  <div className="wp-fuente-detail__mockup-block">
                    <img src={mockup.url} alt="Mockup del pedido" className="wp-fuente-detail__mockup-img" />
                    <button
                      type="button"
                      className="work-pool-module__btn work-pool-module__btn--ghost"
                      onClick={() => void downloadArchivo(mockup.url, mockup.nombre_archivo)}
                    >
                      Descargar mockup
                    </button>
                  </div>
                ) : (
                  <p className="wp-fuente-detail__muted">Sin mockup guardado.</p>
                )}
                {otros.length > 0 ? (
                  <div className="wp-fuente-detail__archivos">
                    {otros.map((archivo) => (
                      <div key={archivo.id} className="wp-fuente-detail__archivo">
                        {isImageArchivo(archivo) && (
                          <img src={archivo.url} alt={archivo.nombre_archivo} className="wp-fuente-detail__archivo-thumb" />
                        )}
                        <span>{archivo.nombre_archivo}</span>
                        <button
                          type="button"
                          className="work-pool-module__btn work-pool-module__btn--ghost"
                          onClick={() => void downloadArchivo(archivo.url, archivo.nombre_archivo)}
                        >
                          Descargar
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="wp-fuente-detail__muted">Sin otros archivos adjuntos.</p>
                )}
              </section>
            </>
          )}
        </div>

        <footer className="wp-fuente-detail__footer">
          {detail.kind === 'brief' && (
            <a
              href={`/brief/${detail.brief.token}`}
              target="_blank"
              rel="noopener noreferrer"
              className="work-pool-module__btn work-pool-module__btn--ghost"
            >
              Abrir formulario completo
            </a>
          )}
          {detail.kind === 'pedido' && pedido && puedeConvertirPedidoAOp(pedido) && (
            <button
              type="button"
              className="work-pool-module__btn work-pool-module__btn--success"
              disabled={convirtiendo}
              onClick={() => void handleConvertirPedido()}
            >
              {convirtiendo ? 'Convirtiendo…' : 'Convertir a OP'}
            </button>
          )}
          <button
            type="button"
            className="work-pool-module__btn work-pool-module__btn--primary"
            disabled={loading}
            onClick={() => {
              if (detail.kind === 'op') {
                onUsarParaPublicar(detail, { numeroOp: detail.orden.numero_op, ordenId: detail.orden.id })
              } else if (detail.kind === 'brief') {
                onUsarParaPublicar(detail, {
                  textoBrief: briefFull ? buildBriefTexto(briefFull) : undefined
                })
              } else {
                onUsarParaPublicar(detail, {
                  numeroOp: detail.pedido.numero_op || undefined,
                  ordenId: detail.pedido.id_op_asociada || undefined
                })
              }
              onClose()
            }}
          >
            Usar para publicar
          </button>
          <button type="button" className="work-pool-module__btn work-pool-module__btn--ghost" onClick={onClose}>
            Cerrar
          </button>
        </footer>
      </div>
    </div>,
    document.body
  )
}

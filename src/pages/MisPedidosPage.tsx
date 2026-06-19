import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import apiService from '../services/api'
import type { PedidoCompra } from '../types/pedidos'
import { formatArgentinaDate, formatArgentinaDateTime } from '../utils/dateUtils'
import './MisPedidosPage.css'

const CARGAR_MAS = 15
const INICIAL_VISIBLES = 15

const MisPedidosPage = () => {
  const navigate = useNavigate()
  const { usuario, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [pedidos, setPedidos] = useState<PedidoCompra[]>([])
  const [filtroEstado, setFiltroEstado] = useState<string>('todos')
  const [visibles, setVisibles] = useState(INICIAL_VISIBLES)
  const [editPedido, setEditPedido] = useState<PedidoCompra | null>(null)
  const [savingEdit, setSavingEdit] = useState(false)
  const [editSnapshot, setEditSnapshot] = useState<string>('')
  const [editForm, setEditForm] = useState({
    sector_solicitante: '',
    motivo: '',
    observaciones: '',
    prioridad: 'Normal' as PedidoCompra['prioridad']
  })
  const [editItems, setEditItems] = useState<
    Array<{
      id_articulo_stock?: number | null
      codigo_articulo?: string | null
      descripcion: string
      cantidad_solicitada: number
      unidad: string
      observaciones?: string | null
    }>
  >([])

  useEffect(() => {
    if (authLoading) return
    if (!usuario) {
      navigate('/')
      return
    }
    loadPedidos()
  }, [authLoading, usuario, navigate, filtroEstado])

  useEffect(() => {
    setVisibles(INICIAL_VISIBLES)
  }, [filtroEstado])

  const pedidosOrdenados = useMemo(
    () =>
      [...pedidos].sort(
        (a, b) => new Date(b.fecha_solicitud).getTime() - new Date(a.fecha_solicitud).getTime()
      ),
    [pedidos]
  )

  const pedidosVisibles = useMemo(
    () => pedidosOrdenados.slice(0, visibles),
    [pedidosOrdenados, visibles]
  )

  const hayMas = visibles < pedidosOrdenados.length
  const restantes = pedidosOrdenados.length - visibles

  const loadPedidos = async () => {
    setLoading(true)
    try {
      const filters: any = {
        id_solicitante: usuario?.id
      }
      if (filtroEstado !== 'todos') {
        filters.estado = filtroEstado
      }
      const response = await apiService.getPedidosCompra(filters)
      if (response.success && response.data) {
        setPedidos(response.data)
      }
    } catch (error) {
      console.error('Error cargando pedidos:', error)
    } finally {
      setLoading(false)
    }
  }

  const puedeEditarOCancelar = (p: PedidoCompra) => p.estado === 'Pendiente' || p.estado === 'En Revisión'

  const abrirEdicion = (p: PedidoCompra) => {
    setEditPedido(p)
    setEditForm({
      sector_solicitante: p.sector_solicitante || '',
      motivo: p.motivo || '',
      observaciones: p.observaciones || '',
      prioridad: p.prioridad || 'Normal'
    })
    const itemsMapped =
      (p.items || []).map((it) => ({
        id_articulo_stock: it.id_articulo_stock ?? null,
        codigo_articulo: it.codigo_articulo ?? null,
        descripcion: it.descripcion,
        cantidad_solicitada: it.cantidad_solicitada,
        unidad: it.unidad || 'unidad',
        observaciones: it.observaciones ?? null
      }))
    setEditItems(itemsMapped)
    setEditSnapshot(
      JSON.stringify({
        form: {
          sector_solicitante: p.sector_solicitante || '',
          motivo: p.motivo || '',
          observaciones: p.observaciones || '',
          prioridad: p.prioridad || 'Normal'
        },
        items: itemsMapped
      })
    )
  }

  const closeEditModal = () => {
    if (!editPedido) {
      setEditPedido(null)
      return
    }
    const current = JSON.stringify({ form: editForm, items: editItems })
    const hasChanges = editSnapshot && current !== editSnapshot
    if (hasChanges && !confirm('Tenés cambios sin guardar. ¿Cerrar y descartarlos?')) {
      return
    }
    setEditPedido(null)
  }

  const cancelarPedido = async (p: PedidoCompra) => {
    if (!usuario) return
    if (!confirm(`¿Cancelar el pedido ${p.numero_pedido}?`)) return
    try {
      const res = await apiService.actualizarEstadoPedido(p.id, 'Cancelado' as any)
      if (!res.success) {
        alert(res.error || 'No se pudo cancelar el pedido')
        return
      }
      await loadPedidos()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error al cancelar el pedido')
    }
  }

  const guardarEdicion = async () => {
    if (!usuario || !editPedido) return
    if (!puedeEditarOCancelar(editPedido)) {
      alert('Este pedido ya no se puede editar.')
      return
    }
    setSavingEdit(true)
    try {
      const cleanedItems = editItems
        .map((it) => ({
          ...it,
          descripcion: it.descripcion.trim(),
          unidad: (it.unidad || 'unidad').trim(),
          cantidad_solicitada: Number(it.cantidad_solicitada) || 1
        }))
        .filter((it) => it.descripcion !== '')

      if (cleanedItems.length === 0) {
        alert('Agregá al menos 1 producto.')
        return
      }

      const res = await apiService.actualizarPedidoCompraConItems(
        editPedido.id,
        {
          sector_solicitante: editForm.sector_solicitante || null,
          motivo: editForm.motivo || null,
          observaciones: editForm.observaciones || null,
          prioridad: editForm.prioridad
        } as any,
        cleanedItems
      )
      if (!res.success) {
        alert(res.error || 'No se pudo guardar')
        return
      }
      setEditPedido(null)
      await loadPedidos()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error al guardar cambios')
    } finally {
      setSavingEdit(false)
    }
  }

  const getEstadoColor = (estado: string) => {
    switch (estado) {
      case 'Pendiente':
        return '#f59e0b'
      case 'En Revisión':
        return '#3b82f6'
      case 'Aprobado':
        return '#10b981'
      case 'Rechazado':
        return '#ef4444'
      case 'En Compra':
        return '#8b5cf6'
      case 'Completado':
        return '#059669'
      case 'Cancelado':
        return '#6b7280'
      default:
        return '#6b7280'
    }
  }

  const getEstadoIcon = (estado: string) => {
    switch (estado) {
      case 'Pendiente':
        return '⏳'
      case 'En Revisión':
        return '👀'
      case 'Aprobado':
        return '✅'
      case 'Rechazado':
        return '❌'
      case 'En Compra':
        return '🛒'
      case 'Completado':
        return '🎉'
      case 'Cancelado':
        return '🚫'
      default:
        return '📋'
    }
  }

  if (loading) {
    return (
      <div className="mis-pedidos-page">
        <div className="mis-pedidos-header">
          <h1>📦 Mis Pedidos de Compra</h1>
        </div>
        <div style={{ padding: '20px', textAlign: 'center' }}>Cargando...</div>
      </div>
    )
  }

  return (
    <div className="mis-pedidos-page">
      <div className="mis-pedidos-header">
        <h1>📦 Mis Pedidos de Compra</h1>
        <button className="btn-back" onClick={() => navigate('/')}>
          ← Volver al Tablero
        </button>
      </div>

      <div className="mis-pedidos-filters">
        <select
          value={filtroEstado}
          onChange={(e) => setFiltroEstado(e.target.value)}
          className="filter-select"
        >
          <option value="todos">Todos los estados</option>
          <option value="Pendiente">Pendiente</option>
          <option value="En Revisión">En Revisión</option>
          <option value="Aprobado">Aprobado</option>
          <option value="Rechazado">Rechazado</option>
          <option value="En Compra">En Compra</option>
          <option value="En Viaje">En Viaje</option>
          <option value="Completado">Completado</option>
          <option value="Cancelado">Cancelado</option>
        </select>
      </div>

      <div className="mis-pedidos-content">
        {pedidosOrdenados.length === 0 ? (
          <div className="empty-state">
            <p>No tienes pedidos de compra</p>
            <button className="btn-primary" onClick={() => navigate('/')}>
              Solicitar Productos
            </button>
          </div>
        ) : (
          <>
            {pedidosOrdenados.length > INICIAL_VISIBLES && (
              <p className="mis-pedidos-count">
                Mostrando {pedidosVisibles.length} de {pedidosOrdenados.length} pedidos
              </p>
            )}
            <div className="pedidos-list">
              {pedidosVisibles.map((pedido) => (
              <div key={pedido.id} className="pedido-card">
                <div className="pedido-card-header">
                  <div className="pedido-info">
                    <h3>{pedido.numero_pedido}</h3>
                    <span
                      className="estado-badge"
                      style={{ backgroundColor: getEstadoColor(pedido.estado) }}
                    >
                      {getEstadoIcon(pedido.estado)} {pedido.estado}
                    </span>
                  </div>
                  <div className="pedido-meta">
                    <span className="fecha">
                      {formatArgentinaDate(pedido.fecha_solicitud)}
                    </span>
                  </div>
                </div>

                <div className="pedido-card-body">
                  {pedido.motivo && (
                    <div className="pedido-field">
                      <strong>Motivo:</strong> {pedido.motivo}
                    </div>
                  )}
                  {pedido.prioridad && (
                    <div className="pedido-field">
                      <strong>Prioridad:</strong>{' '}
                      <span className={`prioridad-badge prioridad-${pedido.prioridad.toLowerCase()}`}>
                        {pedido.prioridad}
                      </span>
                    </div>
                  )}
                  {pedido.items && pedido.items.length > 0 && (
                    <div className="pedido-items">
                      <strong>Productos ({pedido.items.length}):</strong>
                      <ul>
                        {pedido.items.map((item, idx) => (
                          <li key={idx}>
                            {item.descripcion} - {item.cantidad_solicitada} {item.unidad || 'unidad'}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {pedido.motivo_rechazo && (
                    <div className="pedido-rechazo">
                      <strong>Motivo de rechazo:</strong> {pedido.motivo_rechazo}
                    </div>
                  )}
                  {pedido.fecha_aprobacion && (
                    <div className="pedido-field">
                      <strong>Aprobado:</strong>{' '}
                      {formatArgentinaDateTime(pedido.fecha_aprobacion)}
                      {pedido.nombre_aprobador && ` por ${pedido.nombre_aprobador}`}
                    </div>
                  )}
                  {pedido.fecha_rechazo && (
                    <div className="pedido-field">
                      <strong>Rechazado:</strong>{' '}
                      {formatArgentinaDateTime(pedido.fecha_rechazo)}
                    </div>
                  )}
                  {pedido.fecha_completado && (
                    <div className="pedido-field">
                      <strong>Completado:</strong>{' '}
                      {formatArgentinaDateTime(pedido.fecha_completado)}
                    </div>
                  )}
                </div>

                <div className="pedido-card-actions">
                  <button
                    className="btn-secondary"
                    onClick={() => navigate(`/compras/pedidos/${pedido.id}`)}
                  >
                    Ver Detalles
                  </button>
                  {puedeEditarOCancelar(pedido) && (
                    <>
                      <button className="btn-secondary" onClick={() => abrirEdicion(pedido)}>
                        Editar
                      </button>
                      <button className="btn-danger" onClick={() => void cancelarPedido(pedido)}>
                        Cancelar
                      </button>
                    </>
                  )}
                </div>
              </div>
              ))}
            </div>
            {hayMas && (
              <div className="mis-pedidos-load-more">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setVisibles((v) => v + CARGAR_MAS)}
                >
                  Cargar más pedidos ({Math.min(CARGAR_MAS, restantes)} de {restantes})
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {editPedido && (
        <div className="mis-pedidos-modal-overlay">
          <div className="mis-pedidos-modal" onClick={(e) => e.stopPropagation()}>
            <div className="mis-pedidos-modal-header">
              <h2>Editar pedido {editPedido.numero_pedido}</h2>
              <button className="btn-close" onClick={closeEditModal}>
                ×
              </button>
            </div>
            <div className="mis-pedidos-modal-body">
              <div className="form-row">
                <div className="form-group">
                  <label>Sector solicitante</label>
                  <input
                    value={editForm.sector_solicitante}
                    onChange={(e) => setEditForm((p) => ({ ...p, sector_solicitante: e.target.value }))}
                    placeholder="Ej. Taller gráfico"
                  />
                </div>
                <div className="form-group">
                  <label>Prioridad</label>
                  <select
                    value={editForm.prioridad}
                    onChange={(e) => setEditForm((p) => ({ ...p, prioridad: e.target.value as any }))}
                  >
                    <option value="Baja">Baja</option>
                    <option value="Normal">Normal</option>
                    <option value="Alta">Alta</option>
                    <option value="Urgente">Urgente</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Motivo</label>
                <input
                  value={editForm.motivo}
                  onChange={(e) => setEditForm((p) => ({ ...p, motivo: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label>Observaciones</label>
                <textarea
                  value={editForm.observaciones}
                  onChange={(e) => setEditForm((p) => ({ ...p, observaciones: e.target.value }))}
                  rows={3}
                />
              </div>

              <div className="form-group">
                <label>Productos</label>
                <div className="edit-items">
                  {editItems.map((it, idx) => (
                    <div key={idx} className="edit-item-row">
                      <input
                        className="edit-item-desc"
                        value={it.descripcion}
                        onChange={(e) =>
                          setEditItems((prev) => prev.map((x, i) => (i === idx ? { ...x, descripcion: e.target.value } : x)))
                        }
                        placeholder="Descripción"
                      />
                      <input
                        className="edit-item-qty"
                        type="number"
                        min={1}
                        value={it.cantidad_solicitada}
                        onChange={(e) =>
                          setEditItems((prev) =>
                            prev.map((x, i) => (i === idx ? { ...x, cantidad_solicitada: Number(e.target.value) } : x))
                          )
                        }
                      />
                      <input
                        className="edit-item-unit"
                        value={it.unidad}
                        onChange={(e) =>
                          setEditItems((prev) => prev.map((x, i) => (i === idx ? { ...x, unidad: e.target.value } : x)))
                        }
                        placeholder="unidad"
                      />
                      <button
                        type="button"
                        className="btn-danger btn-xs"
                        onClick={() => setEditItems((prev) => prev.filter((_, i) => i !== idx))}
                        title="Quitar"
                      >
                        Quitar
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="btn-secondary btn-sm"
                    onClick={() =>
                      setEditItems((prev) => [
                        ...prev,
                        { descripcion: '', cantidad_solicitada: 1, unidad: 'unidad', observaciones: null }
                      ])
                    }
                  >
                    + Agregar producto
                  </button>
                </div>
              </div>
            </div>
            <div className="mis-pedidos-modal-footer">
              <button className="btn-secondary" onClick={closeEditModal} disabled={savingEdit}>
                Cancelar
              </button>
              <button className="btn-primary" onClick={() => void guardarEdicion()} disabled={savingEdit}>
                {savingEdit ? 'Guardando…' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default MisPedidosPage


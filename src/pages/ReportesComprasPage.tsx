import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import apiService from '../services/api'
import type { PedidoCompra } from '../types/pedidos'
import jsPDF from 'jspdf'
import * as XLSX from 'xlsx'
import './ReportesComprasPage.css'

const ReportesComprasPage = () => {
  const navigate = useNavigate()
  const { canManageCompras, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [pedidos, setPedidos] = useState<PedidoCompra[]>([])
  const [filtros, setFiltros] = useState({
    fechaDesde: '',
    fechaHasta: '',
    estado: 'todos',
    prioridad: 'todos',
    sector: ''
  })

  useEffect(() => {
    if (authLoading) return
    if (!canManageCompras) {
      navigate('/compras/dashboard')
      return
    }
    loadPedidos()
  }, [canManageCompras, navigate, authLoading])

  const loadPedidos = async () => {
    setLoading(true)
    try {
      const response = await apiService.getPedidosCompra({})
      if (response.success && response.data) {
        setPedidos(response.data)
      }
    } catch (error) {
      console.error('Error cargando pedidos:', error)
    } finally {
      setLoading(false)
    }
  }

  const aplicarFiltros = () => {
    let filtrados = [...pedidos]

    if (filtros.fechaDesde) {
      const fechaDesde = new Date(filtros.fechaDesde)
      fechaDesde.setHours(0, 0, 0, 0)
      filtrados = filtrados.filter(p => {
        const fechaPedido = new Date(p.fecha_solicitud)
        fechaPedido.setHours(0, 0, 0, 0)
        return fechaPedido >= fechaDesde
      })
    }

    if (filtros.fechaHasta) {
      const fechaHasta = new Date(filtros.fechaHasta)
      fechaHasta.setHours(23, 59, 59, 999)
      filtrados = filtrados.filter(p => {
        const fechaPedido = new Date(p.fecha_solicitud)
        return fechaPedido <= fechaHasta
      })
    }

    if (filtros.sector) {
      filtrados = filtrados.filter(p => p.sector_solicitante === filtros.sector)
    }

    if (filtros.estado !== 'todos') {
      filtrados = filtrados.filter(p => p.estado === filtros.estado)
    }

    if (filtros.prioridad !== 'todos') {
      filtrados = filtrados.filter(p => p.prioridad === filtros.prioridad)
    }

    return filtrados
  }

  const exportarPDF = () => {
    const pedidosFiltrados = aplicarFiltros()
    const doc = new jsPDF()

    // Título
    doc.setFontSize(18)
    doc.text('Reporte de Compras', 14, 20)

    // Información del reporte
    doc.setFontSize(10)
    doc.text(`Fecha de generación: ${new Date().toLocaleDateString('es-AR')}`, 14, 30)
    doc.text(`Total de pedidos: ${pedidosFiltrados.length}`, 14, 36)

    let y = 50
    pedidosFiltrados.forEach((pedido) => {
      if (y > 270) {
        doc.addPage()
        y = 20
      }

      doc.setFontSize(12)
      doc.setFont(undefined, 'bold')
      doc.text(`Pedido ${pedido.numero_pedido}`, 14, y)
      y += 7

      doc.setFontSize(10)
      doc.setFont(undefined, 'normal')
      doc.text(`Solicitante: ${pedido.nombre_solicitante}`, 14, y)
      y += 5
      doc.text(`Estado: ${pedido.estado}`, 14, y)
      y += 5
      doc.text(`Prioridad: ${pedido.prioridad}`, 14, y)
      y += 5
      doc.text(`Fecha: ${new Date(pedido.fecha_solicitud).toLocaleDateString('es-AR')}`, 14, y)
      y += 5

      if (pedido.items && pedido.items.length > 0) {
        doc.text(`Items: ${pedido.items.length}`, 14, y)
        y += 5
      }

      y += 3
      if (y > 270) {
        doc.addPage()
        y = 20
      }
    })

    doc.save(`reporte-compras-${new Date().toISOString().split('T')[0]}.pdf`)
  }

  const exportarExcel = () => {
    const pedidosFiltrados = aplicarFiltros()
    
    const datos = pedidosFiltrados.map(pedido => ({
      'Número Pedido': pedido.numero_pedido,
      'Solicitante': pedido.nombre_solicitante,
      'Sector': pedido.sector_solicitante || '',
      'Estado': pedido.estado,
      'Prioridad': pedido.prioridad,
      'Fecha Solicitud': new Date(pedido.fecha_solicitud).toLocaleDateString('es-AR'),
      'Fecha Aprobación': pedido.fecha_aprobacion ? new Date(pedido.fecha_aprobacion).toLocaleDateString('es-AR') : '',
      'Cantidad Items': pedido.items?.length || 0,
      'Observaciones': pedido.observaciones || ''
    }))

    const ws = XLSX.utils.json_to_sheet(datos)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Pedidos')
    XLSX.writeFile(wb, `reporte-compras-${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  const calcularCostos = () => {
    const pedidosFiltrados = aplicarFiltros()
    let total = 0
    let porEstado: Record<string, number> = {}
    let porSector: Record<string, number> = {}

    pedidosFiltrados.forEach(pedido => {
      const costoPedido = pedido.items?.reduce((sum, item) => {
        return sum + (item.precio_total || 0)
      }, 0) || 0

      total += costoPedido
      porEstado[pedido.estado] = (porEstado[pedido.estado] || 0) + costoPedido
      if (pedido.sector_solicitante) {
        porSector[pedido.sector_solicitante] = (porSector[pedido.sector_solicitante] || 0) + costoPedido
      }
    })

    return { total, porEstado, porSector }
  }

  const exportarReporteCostos = () => {
    const { total, porEstado, porSector } = calcularCostos()
    const pedidosFiltrados = aplicarFiltros()
    const doc = new jsPDF()

    doc.setFontSize(18)
    doc.text('Análisis de Costos', 14, 20)

    doc.setFontSize(12)
    doc.setFont(undefined, 'bold')
    doc.text(`Total General: $${total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`, 14, 35)
    doc.setFontSize(10)
    doc.setFont(undefined, 'normal')
    doc.text(`Pedidos analizados: ${pedidosFiltrados.length}`, 14, 42)

    let y = 50
    doc.setFontSize(11)
    doc.text('Costos por Estado:', 14, y)
    y += 7

    doc.setFontSize(10)
    Object.entries(porEstado).forEach(([estado, costo]) => {
      doc.text(`${estado}: $${costo.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`, 20, y)
      y += 5
    })

    y += 5
    doc.setFontSize(11)
    doc.text('Costos por Sector:', 14, y)
    y += 7

    doc.setFontSize(10)
    Object.entries(porSector).forEach(([sector, costo]) => {
      doc.text(`${sector}: $${costo.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`, 20, y)
      y += 5
    })

    doc.save(`analisis-costos-${new Date().toISOString().split('T')[0]}.pdf`)
  }

  if (authLoading || loading) {
    return (
      <div className="reportes-compras-page">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Cargando...</p>
        </div>
      </div>
    )
  }

  if (!canManageCompras) {
    return (
      <div className="reportes-compras-page">
        <div className="error-container">
          <p>No tienes permiso para acceder a esta página.</p>
          <button className="btn-primary" onClick={() => navigate('/compras/dashboard')}>
            Volver al Dashboard
          </button>
        </div>
      </div>
    )
  }

  const pedidosFiltrados = aplicarFiltros()
  const { total, porEstado, porSector } = calcularCostos()

  return (
    <div className="reportes-compras-page">
      <header className="page-header">
        <div className="header-content">
          <div>
            <h1>📊 Reportes y Exportación</h1>
            <p className="subtitle">Genera reportes personalizados y exporta datos</p>
          </div>
          <div className="header-actions">
            <button className="btn-secondary" onClick={() => navigate('/compras/dashboard')}>
              ← Volver
            </button>
          </div>
        </div>
      </header>

      {/* Filtros */}
      <section className="filtros-section">
        <h2>Filtros</h2>
        <div className="filtros-grid">
          <div className="filtro-group">
            <label>Fecha Desde</label>
            <input
              type="date"
              value={filtros.fechaDesde}
              onChange={(e) => setFiltros({ ...filtros, fechaDesde: e.target.value })}
            />
          </div>
          <div className="filtro-group">
            <label>Fecha Hasta</label>
            <input
              type="date"
              value={filtros.fechaHasta}
              onChange={(e) => setFiltros({ ...filtros, fechaHasta: e.target.value })}
            />
          </div>
          <div className="filtro-group">
            <label>Estado</label>
            <select
              value={filtros.estado}
              onChange={(e) => setFiltros({ ...filtros, estado: e.target.value })}
            >
              <option value="todos">Todos</option>
              <option value="Pendiente">Pendiente</option>
              <option value="En Revisión">En Revisión</option>
              <option value="Aprobado">Aprobado</option>
              <option value="En Compra">En Compra</option>
              <option value="Completado">Completado</option>
              <option value="Rechazado">Rechazado</option>
            </select>
          </div>
          <div className="filtro-group">
            <label>Prioridad</label>
            <select
              value={filtros.prioridad}
              onChange={(e) => setFiltros({ ...filtros, prioridad: e.target.value })}
            >
              <option value="todos">Todas</option>
              <option value="Baja">Baja</option>
              <option value="Normal">Normal</option>
              <option value="Alta">Alta</option>
              <option value="Urgente">Urgente</option>
            </select>
          </div>
        </div>
      </section>

      {/* Resumen */}
      <section className="resumen-section">
        <div className="resumen-grid">
          <div className="resumen-card">
            <div className="resumen-label">Total Pedidos</div>
            <div className="resumen-value">{pedidosFiltrados.length}</div>
          </div>
          <div className="resumen-card">
            <div className="resumen-label">Costo Total</div>
            <div className="resumen-value">${total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div>
          </div>
        </div>
      </section>

      {/* Exportación */}
      <section className="exportacion-section">
        <h2>Exportar Reportes</h2>
        <div className="exportacion-buttons">
          <button className="btn-export pdf" onClick={exportarPDF}>
            📄 Exportar PDF
          </button>
          <button className="btn-export excel" onClick={exportarExcel}>
            📊 Exportar Excel
          </button>
          <button className="btn-export costos" onClick={exportarReporteCostos}>
            💰 Análisis de Costos (PDF)
          </button>
        </div>
      </section>

      {/* Vista Previa */}
      <section className="preview-section">
        <h2>Vista Previa ({pedidosFiltrados.length} pedidos)</h2>
        <div className="pedidos-table">
          <table>
            <thead>
              <tr>
                <th>Número</th>
                <th>Solicitante</th>
                <th>Estado</th>
                <th>Prioridad</th>
                <th>Fecha</th>
                <th>Items</th>
                <th>Costo</th>
              </tr>
            </thead>
            <tbody>
              {pedidosFiltrados.slice(0, 20).map((pedido) => {
                const costoPedido = pedido.items?.reduce((sum, item) => sum + (item.precio_total || 0), 0) || 0
                return (
                  <tr key={pedido.id}>
                    <td>{pedido.numero_pedido}</td>
                    <td>{pedido.nombre_solicitante}</td>
                    <td>
                      <span className={`estado-badge estado-${pedido.estado.toLowerCase().replace(' ', '-')}`}>
                        {pedido.estado}
                      </span>
                    </td>
                    <td>{pedido.prioridad}</td>
                    <td>{new Date(pedido.fecha_solicitud).toLocaleDateString('es-AR')}</td>
                    <td>{pedido.items?.length || 0}</td>
                    <td>${costoPedido.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {pedidosFiltrados.length > 20 && (
            <div className="table-footer">
              Mostrando 20 de {pedidosFiltrados.length} pedidos. Exporta el reporte completo para ver todos.
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

export default ReportesComprasPage


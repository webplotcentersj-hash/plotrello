import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import apiService from '../services/api'
import type { ArticuloStock, StockMovimiento, PedidoCompra } from '../types/pedidos'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import './ReportesStockPage.css'

const ReportesStockPage = () => {
  const navigate = useNavigate()
  const { canManageCompras } = useAuth()
  const [loading, setLoading] = useState(true)
  const [articulos, setArticulos] = useState<ArticuloStock[]>([])
  const [movimientos, setMovimientos] = useState<StockMovimiento[]>([])
  const [pedidos, setPedidos] = useState<PedidoCompra[]>([])
  const [filtroStock, setFiltroStock] = useState<string>('todos') // todos, bajo, agotado, normal
  const [fechaDesde, setFechaDesde] = useState<string>(() => {
    const date = new Date()
    date.setMonth(date.getMonth() - 1)
    return date.toISOString().split('T')[0]
  })
  const [fechaHasta, setFechaHasta] = useState<string>(() => {
    return new Date().toISOString().split('T')[0]
  })
  const reporteRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!canManageCompras) {
      navigate('/')
      return
    }
    loadData()
  }, [filtroStock, fechaDesde, fechaHasta, canManageCompras])

  const loadData = async () => {
    setLoading(true)
    try {
      // Cargar artículos
      const stockBajo = filtroStock === 'bajo' || filtroStock === 'agotado'
      const responseArticulos = await apiService.getArticulosStock(undefined, stockBajo)
      if (responseArticulos.success && responseArticulos.data) {
        let articulosFiltrados = responseArticulos.data
        if (filtroStock === 'agotado') {
          articulosFiltrados = articulosFiltrados.filter(a => a.stock === 0 || a.stock === null)
        } else if (filtroStock === 'bajo') {
          articulosFiltrados = articulosFiltrados.filter(a => a.stock !== null && a.stock > 0 && a.stock <= 10)
        } else if (filtroStock === 'normal') {
          articulosFiltrados = articulosFiltrados.filter(a => a.stock !== null && a.stock > 10)
        }
        setArticulos(articulosFiltrados)
      }

      // Cargar movimientos
      const responseMovimientos = await apiService.getMovimientosStock({
        fecha_desde: fechaDesde,
        fecha_hasta: fechaHasta
      })
      if (responseMovimientos.success && responseMovimientos.data) {
        setMovimientos(responseMovimientos.data)
      }

      // Cargar pedidos del período
      const responsePedidos = await apiService.getPedidosCompra()
      if (responsePedidos.success && responsePedidos.data) {
        const pedidosFiltrados = responsePedidos.data.filter(p => {
          const fechaPedido = new Date(p.fecha_solicitud)
          const desde = new Date(fechaDesde)
          const hasta = new Date(fechaHasta)
          hasta.setHours(23, 59, 59, 999)
          return fechaPedido >= desde && fechaPedido <= hasta
        })
        setPedidos(pedidosFiltrados)
      }
    } catch (error) {
      console.error('Error cargando datos:', error)
    } finally {
      setLoading(false)
    }
  }

  const getEstadisticas = () => {
    const totalArticulos = articulos.length
    const stockBajo = articulos.filter(a => a.stock !== null && a.stock > 0 && a.stock <= 10).length
    const stockAgotado = articulos.filter(a => a.stock === 0 || a.stock === null).length
    const stockNormal = articulos.filter(a => a.stock !== null && a.stock > 10).length

    const totalMovimientos = movimientos.length
    const entradas = movimientos.filter(m => m.tipo_movimiento === 'Entrada').length
    const salidas = movimientos.filter(m => m.tipo_movimiento === 'Salida').length

    const totalPedidos = pedidos.length
    const pedidosPendientes = pedidos.filter(p => p.estado === 'Pendiente' || p.estado === 'En Revisión').length
    const pedidosAprobados = pedidos.filter(p => p.estado === 'Aprobado' || p.estado === 'En Compra').length
    const pedidosCompletados = pedidos.filter(p => p.estado === 'Completado').length

    return {
      totalArticulos,
      stockBajo,
      stockAgotado,
      stockNormal,
      totalMovimientos,
      entradas,
      salidas,
      totalPedidos,
      pedidosPendientes,
      pedidosAprobados,
      pedidosCompletados
    }
  }

  const generarReportePDF = async () => {
    if (!reporteRef.current) return

    try {
      const canvas = await html2canvas(reporteRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      })

      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      })

      const pdfWidth = pdf.internal.pageSize.getWidth()
      const pdfHeight = pdf.internal.pageSize.getHeight()
      const imgWidth = canvas.width
      const imgHeight = canvas.height
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight)
      const imgScaledWidth = imgWidth * ratio
      const imgScaledHeight = imgHeight * ratio
      const xOffset = (pdfWidth - imgScaledWidth) / 2
      const yOffset = (pdfHeight - imgScaledHeight) / 2

      pdf.addImage(imgData, 'PNG', xOffset, yOffset, imgScaledWidth, imgScaledHeight)
      pdf.save(`Reporte_Stock_${fechaDesde}_${fechaHasta}.pdf`)
    } catch (error) {
      console.error('Error generando PDF:', error)
      alert('Error al generar el reporte PDF')
    }
  }

  const stats = getEstadisticas()

  if (loading) {
    return (
      <div className="reportes-stock-page">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Cargando reportes...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="reportes-stock-page">
      <header className="page-header">
        <div className="header-content">
          <div>
            <h1>📊 Reportes de Stock y Compras</h1>
            <p className="subtitle">Análisis de inventario y pedidos</p>
          </div>
          <button
            className="btn-secondary"
            onClick={() => navigate('/compras/dashboard')}
          >
            ← Volver
          </button>
        </div>
      </header>

      {/* Filtros */}
      <section className="filters-section">
        <div className="filters-grid">
          <div className="filter-group">
            <label>Filtro de Stock:</label>
            <select
              value={filtroStock}
              onChange={(e) => setFiltroStock(e.target.value)}
              className="filter-select"
            >
              <option value="todos">Todos</option>
              <option value="agotado">Stock Agotado</option>
              <option value="bajo">Stock Bajo (≤10)</option>
              <option value="normal">Stock Normal (&gt;10)</option>
            </select>
          </div>
          <div className="filter-group">
            <label>Fecha Desde:</label>
            <input
              type="date"
              value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)}
              className="filter-input"
            />
          </div>
          <div className="filter-group">
            <label>Fecha Hasta:</label>
            <input
              type="date"
              value={fechaHasta}
              onChange={(e) => setFechaHasta(e.target.value)}
              className="filter-input"
            />
          </div>
          <div className="filter-group">
            <button className="btn-primary" onClick={generarReportePDF}>
              📄 Generar PDF
            </button>
          </div>
        </div>
      </section>

      {/* Reporte para PDF */}
      <div ref={reporteRef} className="reporte-content" style={{ display: 'none' }}>
        <div className="reporte-header">
          <h2>Reporte de Stock y Compras</h2>
          <p>Período: {new Date(fechaDesde).toLocaleDateString('es-AR')} - {new Date(fechaHasta).toLocaleDateString('es-AR')}</p>
          <p>Generado: {new Date().toLocaleString('es-AR')}</p>
        </div>
        {/* Contenido del reporte */}
      </div>

      {/* Estadísticas */}
      <section className="stats-section">
        <h2>Estadísticas Generales</h2>
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-value">{stats.totalArticulos}</div>
            <div className="stat-label">Total Artículos</div>
          </div>
          <div className="stat-card warning">
            <div className="stat-value">{stats.stockBajo}</div>
            <div className="stat-label">Stock Bajo</div>
          </div>
          <div className="stat-card danger">
            <div className="stat-value">{stats.stockAgotado}</div>
            <div className="stat-label">Stock Agotado</div>
          </div>
          <div className="stat-card success">
            <div className="stat-value">{stats.stockNormal}</div>
            <div className="stat-label">Stock Normal</div>
          </div>
          <div className="stat-card info">
            <div className="stat-value">{stats.totalMovimientos}</div>
            <div className="stat-label">Movimientos</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.totalPedidos}</div>
            <div className="stat-label">Pedidos</div>
          </div>
        </div>
      </section>

      {/* Artículos con Stock Bajo/Agotado */}
      {(filtroStock === 'bajo' || filtroStock === 'agotado' || filtroStock === 'todos') && (
        <section className="articulos-section">
          <h2>Artículos con Stock Bajo o Agotado</h2>
          {articulos.filter(a => a.stock === null || a.stock <= 10).length === 0 ? (
            <p className="empty-state">No hay artículos con stock bajo o agotado</p>
          ) : (
            <div className="articulos-table">
              <table>
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Descripción</th>
                    <th>Stock Actual</th>
                    <th>Stock Mínimo</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {articulos
                    .filter(a => a.stock === null || a.stock <= 10)
                    .map((articulo) => (
                      <tr key={articulo.id}>
                        <td>{articulo.codigo || '-'}</td>
                        <td>{articulo.descripcion}</td>
                        <td>
                          <span className={`stock-badge ${articulo.stock === null || articulo.stock === 0 ? 'agotado' : 'bajo'}`}>
                            {articulo.stock === null ? 'Sin stock' : articulo.stock}
                          </span>
                        </td>
                        <td>{articulo.stock_minimo || '-'}</td>
                        <td>
                          {articulo.stock === null || articulo.stock === 0 ? (
                            <span className="badge-danger">Agotado</span>
                          ) : (
                            <span className="badge-warning">Bajo</span>
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Movimientos de Stock */}
      <section className="movimientos-section">
        <h2>Movimientos de Stock ({stats.totalMovimientos})</h2>
        {movimientos.length === 0 ? (
          <p className="empty-state">No hay movimientos en el período seleccionado</p>
        ) : (
          <div className="movimientos-table">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Artículo</th>
                  <th>Tipo</th>
                  <th>Cantidad</th>
                  <th>Stock Anterior</th>
                  <th>Stock Nuevo</th>
                  <th>Motivo</th>
                  <th>Usuario</th>
                </tr>
              </thead>
              <tbody>
                {movimientos.map((movimiento) => (
                  <tr key={movimiento.id}>
                    <td>{new Date(movimiento.created_at).toLocaleString('es-AR')}</td>
                    <td>{movimiento.descripcion}</td>
                    <td>
                      <span className={`tipo-badge ${movimiento.tipo_movimiento.toLowerCase()}`}>
                        {movimiento.tipo_movimiento}
                      </span>
                    </td>
                    <td>{movimiento.cantidad}</td>
                    <td>{movimiento.cantidad_anterior ?? '-'}</td>
                    <td>{movimiento.cantidad_nueva ?? '-'}</td>
                    <td>{movimiento.motivo || '-'}</td>
                    <td>{movimiento.nombre_usuario || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Resumen de Pedidos */}
      <section className="pedidos-section">
        <h2>Resumen de Pedidos ({stats.totalPedidos})</h2>
        <div className="pedidos-stats">
          <div className="pedido-stat-card">
            <div className="pedido-stat-value">{stats.pedidosPendientes}</div>
            <div className="pedido-stat-label">Pendientes</div>
          </div>
          <div className="pedido-stat-card">
            <div className="pedido-stat-value">{stats.pedidosAprobados}</div>
            <div className="pedido-stat-label">Aprobados/En Compra</div>
          </div>
          <div className="pedido-stat-card">
            <div className="pedido-stat-value">{stats.pedidosCompletados}</div>
            <div className="pedido-stat-label">Completados</div>
          </div>
        </div>
      </section>
    </div>
  )
}

export default ReportesStockPage


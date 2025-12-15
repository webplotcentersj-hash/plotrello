import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import apiService from '../services/api'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import type { OrdenTrabajo } from '../types/api'
import './ReportesMostradorPage.css'

type TipoAtencion = 'virtual' | 'consulta' | 'venta'
type Atencion = {
  id: number
  cliente_nombre: string
  tipo: TipoAtencion
  orden_id?: number
  usuario_id: number
  usuario_nombre: string
  timestamp: string
  notas?: string
}

const ReportesMostradorPage = () => {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [fechaInicio, setFechaInicio] = useState(() => {
    const hoy = new Date()
    hoy.setDate(1) // Primer día del mes
    return hoy.toISOString().split('T')[0]
  })
  const [fechaFin, setFechaFin] = useState(() => {
    const hoy = new Date()
    return hoy.toISOString().split('T')[0]
  })
  const [ordenes, setOrdenes] = useState<OrdenTrabajo[]>([])
  const [atenciones, setAtenciones] = useState<Atencion[]>([])
  const [reporteRef, setReporteRef] = useState<HTMLDivElement | null>(null)

  useEffect(() => {
    loadDatos()
  }, [fechaInicio, fechaFin])

  const loadDatos = async () => {
    setLoading(true)
    try {
      // Cargar órdenes
      const ordenesResponse = await apiService.getOrdenes()
      if (ordenesResponse.success && ordenesResponse.data) {
        const inicio = new Date(fechaInicio)
        const fin = new Date(fechaFin)
        fin.setHours(23, 59, 59, 999)

        const ordenesFiltradas = ordenesResponse.data.filter((orden) => {
          if (!orden.fecha_creacion) return false
          const fechaCreacion = new Date(orden.fecha_creacion)
          return fechaCreacion >= inicio && fechaCreacion <= fin
        })
        setOrdenes(ordenesFiltradas)
      }

      // Cargar atenciones
      const atencionesGuardadas = localStorage.getItem('atenciones_mostrador')
      if (atencionesGuardadas) {
        const todasAtenciones: Atencion[] = JSON.parse(atencionesGuardadas)
        const inicio = new Date(fechaInicio)
        const fin = new Date(fechaFin)
        fin.setHours(23, 59, 59, 999)

        const atencionesFiltradas = todasAtenciones.filter((atencion) => {
          const fechaAtencion = new Date(atencion.timestamp)
          return fechaAtencion >= inicio && fechaAtencion <= fin
        })
        setAtenciones(atencionesFiltradas)
      }
    } catch (error) {
      console.error('Error cargando datos:', error)
    } finally {
      setLoading(false)
    }
  }

  const calcularMetricas = () => {
    const ordenesCreadas = ordenes.length
    const ordenesEntregadas = ordenes.filter(
      (o) => o.estado === 'Entregado o Instalado'
    ).length

    const totalAtenciones = atenciones.length
    const atencionesVirtuales = atenciones.filter((a) => a.tipo === 'virtual').length
    const consultas = atenciones.filter((a) => a.tipo === 'consulta').length
    const ventasConcretadas = atenciones.filter((a) => a.tipo === 'venta').length

    return {
      ordenesCreadas,
      ordenesEntregadas,
      totalAtenciones,
      atencionesVirtuales,
      consultas,
      ventasConcretadas
    }
  }

  const generarReportePDF = async () => {
    if (!reporteRef) return

    try {
      const canvas = await html2canvas(reporteRef, {
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
      pdf.save(`Reporte_Mostrador_${fechaInicio}_${fechaFin}.pdf`)
    } catch (error) {
      console.error('Error generando PDF:', error)
      alert('Error al generar el reporte PDF')
    }
  }

  const metricas = calcularMetricas()

  if (loading) {
    return (
      <div className="reportes-mostrador-page">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Cargando reportes...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="reportes-mostrador-page">
      <header className="page-header">
        <div className="header-content">
          <div>
            <h1>📊 Reportes de Mostrador</h1>
            <p className="subtitle">Estadísticas y métricas del período seleccionado</p>
          </div>
          <button
            className="btn-secondary"
            onClick={() => navigate('/mostrador/dashboard')}
          >
            ← Volver al Dashboard
          </button>
        </div>
      </header>

      {/* Filtros */}
      <section className="filtros-section">
        <h2>Período de Reporte</h2>
        <div className="filtros-grid">
          <div className="form-group">
            <label>Fecha Inicio:</label>
            <input
              type="date"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>Fecha Fin:</label>
            <input
              type="date"
              value={fechaFin}
              onChange={(e) => setFechaFin(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>Acciones:</label>
            <button className="btn-primary" onClick={generarReportePDF}>
              💾 Descargar PDF
            </button>
          </div>
        </div>
      </section>

      {/* Reporte */}
      <div ref={setReporteRef} className="reporte-content">
        {/* Encabezado del Reporte */}
        <div className="reporte-header">
          <img
            src="https://trello.plotcenter.com.ar/Group%20187.png"
            alt="Plot Center Logo"
            className="reporte-logo"
          />
          <div>
            <h2>REPORTE DE MOSTRADOR</h2>
            <p>
              Período: {new Date(fechaInicio).toLocaleDateString('es-AR')} -{' '}
              {new Date(fechaFin).toLocaleDateString('es-AR')}
            </p>
            <p className="reporte-fecha">
              Generado el {new Date().toLocaleString('es-AR')}
            </p>
          </div>
        </div>

        {/* Métricas Principales */}
        <section className="metricas-reporte">
          <h3>Métricas Principales</h3>
          <div className="metricas-grid-reporte">
            <div className="metrica-reporte">
              <div className="metrica-icon">👥</div>
              <div className="metrica-content">
                <div className="metrica-value">{metricas.totalAtenciones}</div>
                <div className="metrica-label">Personas Atendidas</div>
              </div>
            </div>
            <div className="metrica-reporte">
              <div className="metrica-icon">💻</div>
              <div className="metrica-content">
                <div className="metrica-value">{metricas.atencionesVirtuales}</div>
                <div className="metrica-label">Atenciones Virtuales</div>
              </div>
            </div>
            <div className="metrica-reporte">
              <div className="metrica-icon">❓</div>
              <div className="metrica-content">
                <div className="metrica-value">{metricas.consultas}</div>
                <div className="metrica-label">Solo Consultas</div>
              </div>
            </div>
            <div className="metrica-reporte">
              <div className="metrica-icon">💰</div>
              <div className="metrica-content">
                <div className="metrica-value">{metricas.ventasConcretadas}</div>
                <div className="metrica-label">Ventas Concretadas</div>
              </div>
            </div>
            <div className="metrica-reporte">
              <div className="metrica-icon">📝</div>
              <div className="metrica-content">
                <div className="metrica-value">{metricas.ordenesCreadas}</div>
                <div className="metrica-label">Órdenes Creadas</div>
              </div>
            </div>
            <div className="metrica-reporte">
              <div className="metrica-icon">✅</div>
              <div className="metrica-content">
                <div className="metrica-value">{metricas.ordenesEntregadas}</div>
                <div className="metrica-label">Órdenes Entregadas</div>
              </div>
            </div>
          </div>
        </section>

        {/* Detalle de Atenciones */}
        {atenciones.length > 0 && (
          <section className="detalle-section">
            <h3>Detalle de Atenciones ({atenciones.length})</h3>
            <table className="reporte-table">
              <thead>
                <tr>
                  <th>Fecha/Hora</th>
                  <th>Tipo</th>
                  <th>Cliente</th>
                  <th>OP</th>
                  <th>Usuario</th>
                  <th>Notas</th>
                </tr>
              </thead>
              <tbody>
                {atenciones.map((atencion) => (
                  <tr key={atencion.id}>
                    <td>
                      {new Date(atencion.timestamp).toLocaleString('es-AR')}
                    </td>
                    <td>
                      <span className={`badge-tipo ${atencion.tipo}`}>
                        {atencion.tipo === 'virtual' && '💻 Virtual'}
                        {atencion.tipo === 'consulta' && '❓ Consulta'}
                        {atencion.tipo === 'venta' && '💰 Venta'}
                      </span>
                    </td>
                    <td>{atencion.cliente_nombre}</td>
                    <td>{atencion.orden_id ? `OP ${atencion.orden_id}` : '-'}</td>
                    <td>{atencion.usuario_nombre}</td>
                    <td>{atencion.notas || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* Resumen de Órdenes */}
        {ordenes.length > 0 && (
          <section className="resumen-section">
            <h3>Resumen de Órdenes</h3>
            <div className="resumen-stats">
              <div className="stat-item">
                <span className="stat-label">Total Creadas:</span>
                <span className="stat-value">{metricas.ordenesCreadas}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Entregadas:</span>
                <span className="stat-value">{metricas.ordenesEntregadas}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">En Proceso:</span>
                <span className="stat-value">
                  {metricas.ordenesCreadas - metricas.ordenesEntregadas}
                </span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Tasa de Entrega:</span>
                <span className="stat-value">
                  {metricas.ordenesCreadas > 0
                    ? ((metricas.ordenesEntregadas / metricas.ordenesCreadas) * 100).toFixed(1)
                    : 0}
                  %
                </span>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

export default ReportesMostradorPage

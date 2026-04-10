import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import apiService from '../services/api'
import type { UsuarioRecord } from '../types/api'
import jsPDF from 'jspdf'
import * as XLSX from 'xlsx'
import './RecursosHumanosReportesPage.css'
import {
  ReportePieTorta,
  pieOrdenesPorEstado,
  agregarPieOrdenesUsuarios,
} from '../components/ReportePieTorta'

const SECTORES_DISPONIBLES = [
  'Taller Gráfico',
  'Instalaciones',
  'Taller de Imprenta',
  'Metalúrgica',
  'Diseño Gráfico',
  'Mostrador',
  'Compras',
  'Administración',
  'Gerencia'
]

function diasPeriodoInclusivo(fechaDesde: string, fechaHasta: string): number {
  const a = new Date(`${fechaDesde}T12:00:00`)
  const b = new Date(`${fechaHasta}T12:00:00`)
  const diff = b.getTime() - a.getTime()
  return Math.max(1, Math.floor(diff / 86400000) + 1)
}

function pctLabel(num: number, den: number): string {
  if (!den || den <= 0) return '0,0 %'
  return `${((num / den) * 100).toFixed(1).replace('.', ',')} %`
}

function pendientesDerivado(total: number, completadas: number, enProceso: number): number {
  return Math.max(0, total - completadas - enProceso)
}

function movimientosPorOrden(movs: number, ordenes: number): string {
  if (!ordenes || ordenes <= 0) return '—'
  return (movs / ordenes).toFixed(2).replace('.', ',')
}

function fmtFechaHora(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('es-AR', {
      dateStyle: 'short',
      timeStyle: 'short'
    })
  } catch {
    return '—'
  }
}

function labelTipoReporte(t: string): string {
  if (t === 'usuario') return 'Por usuario (órdenes y movimientos en historial)'
  if (t === 'sector') return 'Por sector del tablero'
  return 'Por período (toda la empresa)'
}

type ReporteDataShape = {
  tipo: 'usuario' | 'sector' | 'periodo'
  periodo: { desde: string; hasta: string }
  usuario?: Record<string, unknown>
  usuarios?: Record<string, unknown>[]
  sector?: Record<string, unknown>
  estadisticas?: Record<string, unknown>
}

function ReporteResumenPanel({
  reporteData,
  usuarioSeleccionado,
  usuarios,
  sectorSeleccionado
}: {
  reporteData: ReporteDataShape
  usuarioSeleccionado: string
  usuarios: UsuarioRecord[]
  sectorSeleccionado: string
}) {
  const dias = diasPeriodoInclusivo(reporteData.periodo.desde, reporteData.periodo.hasta)
  const desdeFmt = new Date(reporteData.periodo.desde + 'T12:00:00').toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })
  const hastaFmt = new Date(reporteData.periodo.hasta + 'T12:00:00').toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })

  let detalleFiltro = '—'
  if (reporteData.tipo === 'usuario') {
    detalleFiltro =
      usuarioSeleccionado === 'todos'
        ? `Todos los usuarios (${usuarios.length} cargados en el listado)`
        : usuarios.find((u) => u.id.toString() === usuarioSeleccionado)?.nombre ?? 'Usuario seleccionado'
  } else if (reporteData.tipo === 'sector') {
    detalleFiltro = sectorSeleccionado || '—'
  } else {
    detalleFiltro = 'Todas las órdenes creadas en el rango'
  }

  return (
    <>
      <div className="rrhh-reporte-resumen-panel">
        <div className="rrhh-reporte-resumen-heading">Resumen del informe</div>
        <div className="rrhh-reporte-resumen-grid">
          <div className="rrhh-reporte-resumen-cell">
            <span className="rrhh-reporte-resumen-label">Tipo</span>
            <span className="rrhh-reporte-resumen-value">{labelTipoReporte(reporteData.tipo)}</span>
          </div>
          <div className="rrhh-reporte-resumen-cell">
            <span className="rrhh-reporte-resumen-label">Filtro / alcance</span>
            <span className="rrhh-reporte-resumen-value">{detalleFiltro}</span>
          </div>
          <div className="rrhh-reporte-resumen-cell rrhh-reporte-resumen-cell--wide">
            <span className="rrhh-reporte-resumen-label">Período analizado</span>
            <span className="rrhh-reporte-resumen-value">
              {desdeFmt} → {hastaFmt}
            </span>
          </div>
          <div className="rrhh-reporte-resumen-cell">
            <span className="rrhh-reporte-resumen-label">Días calendario (inclusive)</span>
            <span className="rrhh-reporte-resumen-value">{dias}</span>
          </div>
          <div className="rrhh-reporte-resumen-cell">
            <span className="rrhh-reporte-resumen-label">Generado</span>
            <span className="rrhh-reporte-resumen-value">{fmtFechaHora(new Date().toISOString())}</span>
          </div>
        </div>
      </div>
      <details className="rrhh-reporte-legend">
        <summary>Cómo se calculan los números (criterios en base de datos)</summary>
        <ul className="rrhh-reporte-legend-list">
          <li>
            Las <strong>órdenes</strong> se consideran según <strong>fecha de creación</strong> dentro del rango. En
            informe por usuario solo cuentan si el usuario aparece como creador, operario asignado o quien estaba
            trabajando la ficha.
          </li>
          <li>
            <strong>Completada</strong>: estado &quot;Finalizado en Taller&quot; o &quot;Almacén de Entrega&quot;.
          </li>
          <li>
            <strong>En proceso</strong>: otros estados excepto &quot;Diseño Gráfico&quot; y los completados anteriores.
          </li>
          <li>
            <strong>Pendiente (inicial)</strong>: estado &quot;Diseño Gráfico&quot; (según función SQL del servidor).
          </li>
          <li>
            <strong>Movimientos</strong>: filas en historial de movimientos vinculadas al usuario o al período, según el
            tipo de reporte.
          </li>
          <li>
            <strong>Pendientes (derivado en pantalla)</strong>: total − completadas − en proceso; debe alinear con la torta
            cuando no hay dato explícito de pendientes.
          </li>
        </ul>
      </details>
    </>
  )
}

const RecursosHumanosReportesPage = () => {
  const navigate = useNavigate()
  const { canManageRecursosHumanos, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [usuarios, setUsuarios] = useState<UsuarioRecord[]>([])
  const [reporteTipo, setReporteTipo] = useState<'usuario' | 'sector' | 'periodo'>('usuario')
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState<string>('todos')
  const [sectorSeleccionado, setSectorSeleccionado] = useState<string>('')
  const [fechaDesde, setFechaDesde] = useState<string>('')
  const [fechaHasta, setFechaHasta] = useState<string>('')
  const [reporteData, setReporteData] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (authLoading) return
    if (!canManageRecursosHumanos) {
      navigate('/rrhh/dashboard')
      return
    }
    loadUsuarios()
    // Establecer fechas por defecto (último mes)
    const hoy = new Date()
    const haceUnMes = new Date()
    haceUnMes.setMonth(haceUnMes.getMonth() - 1)
    setFechaHasta(hoy.toISOString().split('T')[0])
    setFechaDesde(haceUnMes.toISOString().split('T')[0])
  }, [canManageRecursosHumanos, navigate, authLoading])

  const loadUsuarios = async () => {
    try {
      const response = await apiService.getUsuarios()
      if (response.success && response.data) {
        setUsuarios(response.data)
      }
    } catch (error) {
      console.error('Error cargando usuarios:', error)
    } finally {
      setLoading(false)
    }
  }

  const generarReporte = async () => {
    if (!fechaDesde || !fechaHasta) {
      setError('Por favor, selecciona un rango de fechas')
      return
    }

    setLoading(true)
    setError(null)
    try {
      let data: any = null

      if (reporteTipo === 'usuario') {
        if (usuarioSeleccionado === 'todos') {
          // Generar reporte para todos los usuarios
          const reportesUsuarios = await Promise.all(
            usuarios.map(async (usuario) => {
              const response = await apiService.getEstadisticasUsuario(
                usuario.id,
                fechaDesde,
                fechaHasta
              )
              return response.success ? response.data : null
            })
          )
          data = {
            tipo: 'usuario',
            usuarios: reportesUsuarios.filter(r => r !== null),
            periodo: { desde: fechaDesde, hasta: fechaHasta }
          }
        } else {
          const response = await apiService.getEstadisticasUsuario(
            parseInt(usuarioSeleccionado),
            fechaDesde,
            fechaHasta
          )
          if (response.success) {
            data = {
              tipo: 'usuario',
              usuario: response.data,
              periodo: { desde: fechaDesde, hasta: fechaHasta }
            }
          } else {
            setError(response.error || 'Error al obtener estadísticas del usuario')
            return
          }
        }
      } else if (reporteTipo === 'sector') {
        if (!sectorSeleccionado) {
          setError('Por favor, selecciona un sector')
          return
        }
        const response = await apiService.getEstadisticasSector(
          sectorSeleccionado,
          fechaDesde,
          fechaHasta
        )
        if (response.success) {
          data = {
            tipo: 'sector',
            sector: response.data,
            periodo: { desde: fechaDesde, hasta: fechaHasta }
          }
        } else {
          setError(response.error || 'Error al obtener estadísticas del sector')
          return
        }
      } else if (reporteTipo === 'periodo') {
        const response = await apiService.getEstadisticasPeriodo(fechaDesde, fechaHasta)
        if (response.success) {
          data = {
            tipo: 'periodo',
            estadisticas: response.data,
            periodo: { desde: fechaDesde, hasta: fechaHasta }
          }
        } else {
          setError(response.error || 'Error al obtener estadísticas del período')
          return
        }
      }

      setReporteData(data)
    } catch (error: any) {
      console.error('Error generando reporte:', error)
      setError(error.message || 'Error al generar el reporte')
    } finally {
      setLoading(false)
    }
  }

  const exportarPDF = () => {
    if (!reporteData) return

    const doc = new jsPDF()
    let y = 20

    // Título
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.text('Reporte de Personal', 14, y)
    y += 10

    // Información del reporte
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(`Fecha de generación: ${new Date().toLocaleDateString('es-AR')}`, 14, y)
    y += 5
    doc.text(`Período: ${new Date(reporteData.periodo.desde).toLocaleDateString('es-AR')} - ${new Date(reporteData.periodo.hasta).toLocaleDateString('es-AR')}`, 14, y)
    y += 5
    doc.text(`Tipo: ${reporteData.tipo === 'usuario' ? 'Por Usuario' : reporteData.tipo === 'sector' ? 'Por Sector' : 'Por Período'}`, 14, y)
    y += 10

    // Datos según el tipo de reporte
    if (reporteData.tipo === 'usuario') {
      if (reporteData.usuario) {
        // Reporte de un solo usuario
        doc.setFontSize(12)
        doc.setFont('helvetica', 'bold')
        doc.text(`Usuario: ${reporteData.usuario.nombre_usuario || 'N/A'}`, 14, y)
        y += 8
        doc.setFontSize(10)
        doc.setFont('helvetica', 'normal')
        doc.text(`Total de órdenes: ${reporteData.usuario.total_ordenes || 0}`, 14, y)
        y += 5
        doc.text(`Órdenes completadas: ${reporteData.usuario.ordenes_completadas || 0}`, 14, y)
        y += 5
        doc.text(`Órdenes en proceso: ${reporteData.usuario.ordenes_en_proceso || 0}`, 14, y)
        y += 5
        doc.text(`Órdenes pendientes: ${reporteData.usuario.ordenes_pendientes || 0}`, 14, y)
        y += 5
        doc.text(`Movimientos realizados: ${reporteData.usuario.movimientos_realizados || 0}`, 14, y)
        y += 5
        const tU = Number(reporteData.usuario.total_ordenes) || 0
        const cU = Number(reporteData.usuario.ordenes_completadas) || 0
        const pU = Number(reporteData.usuario.ordenes_en_proceso) || 0
        doc.text(`Tasa completitud: ${pctLabel(cU, tU)}`, 14, y)
        y += 5
        doc.text(`Movimientos/orden: ${movimientosPorOrden(Number(reporteData.usuario.movimientos_realizados) || 0, tU)}`, 14, y)
        y += 5
        doc.text(`Pendientes (derivado): ${pendientesDerivado(tU, cU, pU)}`, 14, y)
        y += 5
        if (reporteData.usuario.promedio_dias_completar) {
          doc.text(`Promedio días para completar: ${reporteData.usuario.promedio_dias_completar.toFixed(1)} días`, 14, y)
          y += 5
        }
        if (reporteData.usuario.sector_principal) {
          doc.text(`Sector principal: ${reporteData.usuario.sector_principal}`, 14, y)
          y += 5
        }
        if (reporteData.usuario.ultima_actividad) {
          doc.text(`Última actividad: ${new Date(reporteData.usuario.ultima_actividad).toLocaleDateString('es-AR')}`, 14, y)
        }
      } else if (reporteData.usuarios) {
        // Reporte de múltiples usuarios
        reporteData.usuarios.forEach((usuario: any, index: number) => {
          if (y > 270) {
            doc.addPage()
            y = 20
          }
          doc.setFontSize(12)
          doc.setFont('helvetica', 'bold')
          doc.text(`${index + 1}. ${usuario.nombre_usuario || 'N/A'}`, 14, y)
          y += 8
          doc.setFontSize(10)
          doc.setFont('helvetica', 'normal')
          const tm = Number(usuario.total_ordenes) || 0
          const cm = Number(usuario.ordenes_completadas) || 0
          const pm = Number(usuario.ordenes_en_proceso) || 0
          doc.text(`Total órdenes: ${tm} | Completadas: ${cm} | En proceso: ${pm} | Pend.: ${usuario.ordenes_pendientes ?? pendientesDerivado(tm, cm, pm)}`, 14, y)
          y += 5
          doc.text(`Tasa compl.: ${pctLabel(cm, tm)} | Mov.: ${usuario.movimientos_realizados || 0} | Mov/OP: ${movimientosPorOrden(Number(usuario.movimientos_realizados) || 0, tm)}`, 14, y)
          y += 8
        })
      }
    } else if (reporteData.tipo === 'sector' && reporteData.sector) {
      doc.setFontSize(12)
      doc.setFont('helvetica', 'bold')
      doc.text(`Sector: ${reporteData.sector.sector || 'N/A'}`, 14, y)
      y += 8
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.text(`Total de órdenes: ${reporteData.sector.total_ordenes || 0}`, 14, y)
      y += 5
      doc.text(`Órdenes completadas: ${reporteData.sector.ordenes_completadas || 0}`, 14, y)
      y += 5
      doc.text(`Órdenes en proceso: ${reporteData.sector.ordenes_en_proceso || 0}`, 14, y)
      y += 5
      const ts = Number(reporteData.sector.total_ordenes) || 0
      const cs = Number(reporteData.sector.ordenes_completadas) || 0
      const ps = Number(reporteData.sector.ordenes_en_proceso) || 0
      doc.text(`Pendientes (derivado): ${pendientesDerivado(ts, cs, ps)}`, 14, y)
      y += 5
      doc.text(
        `Órdenes/día (aprox.): ${(ts / diasPeriodoInclusivo(reporteData.periodo.desde, reporteData.periodo.hasta)).toFixed(2)}`,
        14,
        y
      )
      y += 5
      doc.text(`Usuarios activos: ${reporteData.sector.usuarios_activos || 0}`, 14, y)
      y += 5
      if (reporteData.sector.promedio_dias_completar) {
        doc.text(`Promedio días para completar: ${reporteData.sector.promedio_dias_completar.toFixed(1)} días`, 14, y)
        y += 5
      }
      if (reporteData.sector.tasa_completitud !== null && reporteData.sector.tasa_completitud !== undefined) {
        doc.text(`Tasa de completitud: ${reporteData.sector.tasa_completitud.toFixed(1)}%`, 14, y)
      }
    } else if (reporteData.tipo === 'periodo' && reporteData.estadisticas) {
      const stats = reporteData.estadisticas
      doc.setFontSize(12)
      doc.setFont('helvetica', 'bold')
      doc.text('Estadísticas Generales del Período', 14, y)
      y += 8
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.text(`Total de órdenes: ${stats.total_ordenes || 0}`, 14, y)
      y += 5
      doc.text(`Órdenes completadas: ${stats.ordenes_completadas || 0}`, 14, y)
      y += 5
      doc.text(`Órdenes en proceso: ${stats.ordenes_en_proceso || 0}`, 14, y)
      y += 5
      doc.text(`Usuarios activos: ${stats.usuarios_activos || 0}`, 14, y)
      y += 5
      doc.text(`Movimientos totales: ${stats.movimientos_totales || 0}`, 14, y)
      y += 5
      const tP = Number(stats.total_ordenes) || 0
      const cP = Number(stats.ordenes_completadas) || 0
      const pP = Number(stats.ordenes_en_proceso) || 0
      doc.text(`Pendientes (derivado): ${pendientesDerivado(tP, cP, pP)}`, 14, y)
      y += 5
      doc.text(`Tasa completitud: ${pctLabel(cP, tP)}`, 14, y)
      y += 5
      doc.text(
        `Movimientos/dia (aprox.): ${((Number(stats.movimientos_totales) || 0) / diasPeriodoInclusivo(reporteData.periodo.desde, reporteData.periodo.hasta)).toFixed(2)}`,
        14,
        y
      )
      y += 5
      if (stats.promedio_dias_completar) {
        doc.text(`Promedio días para completar: ${stats.promedio_dias_completar.toFixed(1)} días`, 14, y)
        y += 5
      }
      if (stats.ordenes_por_dia) {
        doc.text(`Órdenes por día: ${stats.ordenes_por_dia.toFixed(2)}`, 14, y)
      }
    }

    doc.save(`reporte-personal-${reporteData.tipo}-${new Date().toISOString().split('T')[0]}.pdf`)
  }

  const exportarExcel = () => {
    if (!reporteData) return

    let datos: any[] = []

    if (reporteData.tipo === 'usuario') {
      if (reporteData.usuario) {
        const u = reporteData.usuario
        const t = Number(u.total_ordenes) || 0
        const c = Number(u.ordenes_completadas) || 0
        const p = Number(u.ordenes_en_proceso) || 0
        datos = [{
          'ID Usuario': u.id_usuario ?? 'N/A',
          'Usuario': u.nombre_usuario || 'N/A',
          'Total Órdenes': t,
          'Completadas': c,
          'En Proceso': p,
          'Pendientes (BD)': u.ordenes_pendientes ?? '—',
          'Pendientes (derivado)': pendientesDerivado(t, c, p),
          'Tasa completitud': pctLabel(c, t),
          'Movimientos': u.movimientos_realizados || 0,
          'Movimientos/orden': movimientosPorOrden(Number(u.movimientos_realizados) || 0, t),
          'Promedio Días': u.promedio_dias_completar ? u.promedio_dias_completar.toFixed(1) : 'N/A',
          'Sector Principal': u.sector_principal || 'N/A',
          'Última Actividad': u.ultima_actividad ? fmtFechaHora(u.ultima_actividad) : 'N/A'
        }]
      } else if (reporteData.usuarios) {
        datos = reporteData.usuarios.map((usuario: any) => {
          const t = Number(usuario.total_ordenes) || 0
          const c = Number(usuario.ordenes_completadas) || 0
          const p = Number(usuario.ordenes_en_proceso) || 0
          return {
            'ID Usuario': usuario.id_usuario ?? 'N/A',
            'Usuario': usuario.nombre_usuario || 'N/A',
            'Total Órdenes': t,
            'Completadas': c,
            'En Proceso': p,
            'Pendientes (BD)': usuario.ordenes_pendientes ?? '—',
            'Pendientes (derivado)': pendientesDerivado(t, c, p),
            'Tasa completitud': pctLabel(c, t),
            'Movimientos': usuario.movimientos_realizados || 0,
            'Movimientos/orden': movimientosPorOrden(Number(usuario.movimientos_realizados) || 0, t),
            'Promedio Días': usuario.promedio_dias_completar ? usuario.promedio_dias_completar.toFixed(1) : 'N/A',
            'Sector Principal': usuario.sector_principal || 'N/A',
            'Última Actividad': usuario.ultima_actividad ? fmtFechaHora(usuario.ultima_actividad) : 'N/A'
          }
        })
      }
    } else if (reporteData.tipo === 'sector' && reporteData.sector) {
      const s = reporteData.sector
      const t = Number(s.total_ordenes) || 0
      const c = Number(s.ordenes_completadas) || 0
      const p = Number(s.ordenes_en_proceso) || 0
      const dias = diasPeriodoInclusivo(reporteData.periodo.desde, reporteData.periodo.hasta)
      datos = [{
        'Sector': s.sector || 'N/A',
        'Total Órdenes': t,
        'Completadas': c,
        'En Proceso': p,
        'Pendientes (derivado)': pendientesDerivado(t, c, p),
        'Órdenes/día (aprox.)': (t / dias).toFixed(2),
        'Usuarios Activos': s.usuarios_activos || 0,
        'Promedio Días': s.promedio_dias_completar ? s.promedio_dias_completar.toFixed(1) : 'N/A',
        'Tasa Completitud (%)': s.tasa_completitud != null ? s.tasa_completitud.toFixed(1) : pctLabel(c, t)
      }]
    } else if (reporteData.tipo === 'periodo' && reporteData.estadisticas) {
      const stats = reporteData.estadisticas
      const t = Number(stats.total_ordenes) || 0
      const c = Number(stats.ordenes_completadas) || 0
      const p = Number(stats.ordenes_en_proceso) || 0
      const dias = diasPeriodoInclusivo(reporteData.periodo.desde, reporteData.periodo.hasta)
      datos = [{
        'Período Inicio': new Date(stats.periodo_inicio).toLocaleDateString('es-AR'),
        'Período Fin': new Date(stats.periodo_fin).toLocaleDateString('es-AR'),
        'Total Órdenes': t,
        'Completadas': c,
        'En Proceso': p,
        'Pendientes (derivado)': pendientesDerivado(t, c, p),
        'Tasa completitud': pctLabel(c, t),
        'Usuarios Activos': stats.usuarios_activos || 0,
        'Movimientos Totales': stats.movimientos_totales || 0,
        'Movimientos/día (aprox.)': ((Number(stats.movimientos_totales) || 0) / dias).toFixed(2),
        'Promedio Días': stats.promedio_dias_completar ? stats.promedio_dias_completar.toFixed(1) : 'N/A',
        'Órdenes por Día': stats.ordenes_por_dia ? stats.ordenes_por_dia.toFixed(2) : 'N/A'
      }]
    }

    if (datos.length === 0) return

    const ws = XLSX.utils.json_to_sheet(datos)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Reporte Personal')
    XLSX.writeFile(wb, `reporte-personal-${reporteData.tipo}-${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  if (loading && !reporteData) {
    return (
      <div className="rrhh-reportes-loading">
        <div className="spinner"></div>
        <p>Cargando...</p>
      </div>
    )
  }

  return (
    <div className="rrhh-reportes-page">
      <header className="rrhh-reportes-header">
        <div className="rrhh-header-content">
          <h1>📊 Reportes de Personal</h1>
          <button className="btn-back" onClick={() => navigate('/rrhh/dashboard')}>
            ← Volver
          </button>
        </div>
      </header>

      <div className="rrhh-reportes-content">
        {/* Filtros de reporte */}
        <div className="rrhh-reporte-filters">
          <div className="rrhh-filter-section">
            <label>Tipo de Reporte</label>
            <select
              value={reporteTipo}
              onChange={(e) => setReporteTipo(e.target.value as 'usuario' | 'sector' | 'periodo')}
              className="rrhh-filter-select"
            >
              <option value="usuario">Por Usuario</option>
              <option value="sector">Por Sector</option>
              <option value="periodo">Por Período</option>
            </select>
          </div>

          {reporteTipo === 'usuario' && (
            <div className="rrhh-filter-section">
              <label>Usuario</label>
              <select
                value={usuarioSeleccionado}
                onChange={(e) => setUsuarioSeleccionado(e.target.value)}
                className="rrhh-filter-select"
              >
                <option value="todos">Todos los usuarios</option>
                {usuarios.map(u => (
                  <option key={u.id} value={u.id.toString()}>
                    {u.nombre}
                  </option>
                ))}
              </select>
            </div>
          )}

          {reporteTipo === 'sector' && (
            <div className="rrhh-filter-section">
              <label>Sector</label>
              <select
                value={sectorSeleccionado}
                onChange={(e) => setSectorSeleccionado(e.target.value)}
                className="rrhh-filter-select"
              >
                <option value="">Selecciona un sector</option>
                {SECTORES_DISPONIBLES.map(sector => (
                  <option key={sector} value={sector}>
                    {sector}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="rrhh-filter-section">
            <label>Fecha Desde</label>
            <input
              type="date"
              value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)}
              className="rrhh-date-input"
            />
          </div>

          <div className="rrhh-filter-section">
            <label>Fecha Hasta</label>
            <input
              type="date"
              value={fechaHasta}
              onChange={(e) => setFechaHasta(e.target.value)}
              className="rrhh-date-input"
            />
          </div>

          <button className="btn-primary" onClick={generarReporte}>
            Generar Reporte
          </button>
        </div>

        {/* Mensaje de error */}
        {error && (
          <div className="rrhh-error-message">
            <p>⚠️ {error}</p>
          </div>
        )}

        {/* Resultados del reporte */}
        {reporteData && (
          <div className="rrhh-reporte-results">
            <div className="rrhh-reporte-header">
              <h2>Resultados del Reporte</h2>
              <div className="rrhh-export-buttons">
                <button className="btn-export" onClick={exportarPDF}>
                  📄 Exportar PDF
                </button>
                <button className="btn-export" onClick={exportarExcel}>
                  📊 Exportar Excel
                </button>
              </div>
            </div>

            <div className="rrhh-reporte-content">
              <ReporteResumenPanel
                reporteData={reporteData as ReporteDataShape}
                usuarioSeleccionado={usuarioSeleccionado}
                usuarios={usuarios}
                sectorSeleccionado={sectorSeleccionado}
              />
              {reporteData.tipo === 'usuario' && (
                <>
                  {reporteData.usuario ? (
                    <div className="rrhh-stats-grid">
                      <div className="rrhh-stat-card rrhh-stat-card--with-pie">
                        <h3>{reporteData.usuario.nombre_usuario || 'Usuario'}</h3>
                        <div className="rrhh-stat-rows">
                        {reporteData.usuario.id_usuario != null && (
                          <div className="rrhh-stat-item">
                            <span className="rrhh-stat-label">ID usuario:</span>
                            <span className="rrhh-stat-value">{String(reporteData.usuario.id_usuario)}</span>
                          </div>
                        )}
                        <div className="rrhh-stat-item">
                          <span className="rrhh-stat-label">Total de órdenes:</span>
                          <span className="rrhh-stat-value">{reporteData.usuario.total_ordenes || 0}</span>
                        </div>
                        <div className="rrhh-stat-item">
                          <span className="rrhh-stat-label">Completadas:</span>
                          <span className="rrhh-stat-value success">{reporteData.usuario.ordenes_completadas || 0}</span>
                        </div>
                        <div className="rrhh-stat-item">
                          <span className="rrhh-stat-label">En proceso:</span>
                          <span className="rrhh-stat-value warning">{reporteData.usuario.ordenes_en_proceso || 0}</span>
                        </div>
                        <div className="rrhh-stat-item">
                          <span className="rrhh-stat-label">Pendientes (según BD):</span>
                          <span className="rrhh-stat-value">{reporteData.usuario.ordenes_pendientes ?? 0}</span>
                        </div>
                        <div className="rrhh-stat-item">
                          <span className="rrhh-stat-label">Pendientes (derivado):</span>
                          <span className="rrhh-stat-value">
                            {pendientesDerivado(
                              Number(reporteData.usuario.total_ordenes) || 0,
                              Number(reporteData.usuario.ordenes_completadas) || 0,
                              Number(reporteData.usuario.ordenes_en_proceso) || 0
                            )}
                          </span>
                        </div>
                        <div className="rrhh-stat-item">
                          <span className="rrhh-stat-label">Tasa de completitud:</span>
                          <span className="rrhh-stat-value success">
                            {pctLabel(
                              Number(reporteData.usuario.ordenes_completadas) || 0,
                              Number(reporteData.usuario.total_ordenes) || 0
                            )}
                          </span>
                        </div>
                        <div className="rrhh-stat-item">
                          <span className="rrhh-stat-label">Movimientos en historial:</span>
                          <span className="rrhh-stat-value">{reporteData.usuario.movimientos_realizados || 0}</span>
                        </div>
                        <div className="rrhh-stat-item">
                          <span className="rrhh-stat-label">Movimientos / orden (prom.):</span>
                          <span className="rrhh-stat-value">
                            {movimientosPorOrden(
                              Number(reporteData.usuario.movimientos_realizados) || 0,
                              Number(reporteData.usuario.total_ordenes) || 0
                            )}
                          </span>
                        </div>
                        <div className="rrhh-stat-item">
                          <span className="rrhh-stat-label">Promedio días completar:</span>
                          <span className="rrhh-stat-value">
                            {reporteData.usuario.promedio_dias_completar != null
                              ? Number(reporteData.usuario.promedio_dias_completar).toFixed(1).replace('.', ',')
                              : '—'}
                          </span>
                        </div>
                        <div className="rrhh-stat-item">
                          <span className="rrhh-stat-label">Sector principal:</span>
                          <span className="rrhh-stat-value">{reporteData.usuario.sector_principal || '—'}</span>
                        </div>
                        <div className="rrhh-stat-item">
                          <span className="rrhh-stat-label">Última actividad (historial):</span>
                          <span className="rrhh-stat-value">
                            {fmtFechaHora(reporteData.usuario.ultima_actividad as string | undefined)}
                          </span>
                        </div>
                        </div>
                        <ReportePieTorta
                          title="Órdenes por estado"
                          data={pieOrdenesPorEstado(reporteData.usuario)}
                          height={260}
                          outerRadius={92}
                        />
                      </div>
                    </div>
                  ) : reporteData.usuarios && reporteData.usuarios.length > 0 ? (
                    <div className="rrhh-usuarios-list">
                      <h3>Estadísticas por usuario</h3>
                      <p className="rrhh-reporte-intro">
                        Vista resumida en tarjetas y tabla detallada con los mismos datos que exportás a Excel. Los
                        porcentajes usan el total de órdenes del período por persona.
                      </p>
                      {reporteData.usuarios.length > 1 && (
                        <ReportePieTorta
                          className="rrhh-reporte-pie-global"
                          title="Distribución global (todos los usuarios)"
                          data={agregarPieOrdenesUsuarios(reporteData.usuarios)}
                          height={280}
                          outerRadius={100}
                        />
                      )}
                      <div className="rrhh-stats-grid">
                        {reporteData.usuarios.map((usuario: any) => {
                          const uid = usuario.id_usuario ?? usuario.nombre_usuario
                          const t = Number(usuario.total_ordenes) || 0
                          const c = Number(usuario.ordenes_completadas) || 0
                          const p = Number(usuario.ordenes_en_proceso) || 0
                          const mov = Number(usuario.movimientos_realizados) || 0
                          return (
                          <div key={String(uid)} className="rrhh-stat-card rrhh-stat-card--with-pie">
                            <h4>{usuario.nombre_usuario || 'Usuario'}</h4>
                            <div className="rrhh-stat-rows">
                            {usuario.id_usuario != null && (
                              <div className="rrhh-stat-item">
                                <span className="rrhh-stat-label">ID:</span>
                                <span className="rrhh-stat-value">{String(usuario.id_usuario)}</span>
                              </div>
                            )}
                            <div className="rrhh-stat-item">
                              <span className="rrhh-stat-label">Total órdenes:</span>
                              <span className="rrhh-stat-value">{t}</span>
                            </div>
                            <div className="rrhh-stat-item">
                              <span className="rrhh-stat-label">Completadas:</span>
                              <span className="rrhh-stat-value success">{c}</span>
                            </div>
                            <div className="rrhh-stat-item">
                              <span className="rrhh-stat-label">En proceso:</span>
                              <span className="rrhh-stat-value warning">{p}</span>
                            </div>
                            <div className="rrhh-stat-item">
                              <span className="rrhh-stat-label">Pendientes:</span>
                              <span className="rrhh-stat-value">{usuario.ordenes_pendientes ?? pendientesDerivado(t, c, p)}</span>
                            </div>
                            <div className="rrhh-stat-item">
                              <span className="rrhh-stat-label">Tasa completitud:</span>
                              <span className="rrhh-stat-value success">{pctLabel(c, t)}</span>
                            </div>
                            <div className="rrhh-stat-item">
                              <span className="rrhh-stat-label">Movimientos:</span>
                              <span className="rrhh-stat-value">{mov}</span>
                            </div>
                            <div className="rrhh-stat-item">
                              <span className="rrhh-stat-label">Mov. / orden:</span>
                              <span className="rrhh-stat-value">{movimientosPorOrden(mov, t)}</span>
                            </div>
                            <div className="rrhh-stat-item">
                              <span className="rrhh-stat-label">Promedio días:</span>
                              <span className="rrhh-stat-value">
                                {usuario.promedio_dias_completar != null
                                  ? Number(usuario.promedio_dias_completar).toFixed(1).replace('.', ',')
                                  : '—'}
                              </span>
                            </div>
                            <div className="rrhh-stat-item">
                              <span className="rrhh-stat-label">Sector principal:</span>
                              <span className="rrhh-stat-value">{usuario.sector_principal || '—'}</span>
                            </div>
                            <div className="rrhh-stat-item">
                              <span className="rrhh-stat-label">Última actividad:</span>
                              <span className="rrhh-stat-value">{fmtFechaHora(usuario.ultima_actividad)}</span>
                            </div>
                            </div>
                            <ReportePieTorta
                              compact
                              data={pieOrdenesPorEstado(usuario)}
                              height={200}
                              outerRadius={64}
                            />
                          </div>
                          )
                        })}
                      </div>
                      <div className="rrhh-reporte-tabla-section">
                        <h4 className="rrhh-reporte-tabla-title">Detalle tabular</h4>
                        <div className="rrhh-reporte-tabla-wrap">
                          <table className="rrhh-reporte-tabla">
                            <thead>
                              <tr>
                                <th>ID</th>
                                <th>Usuario</th>
                                <th>Total</th>
                                <th>Compl.</th>
                                <th>Proc.</th>
                                <th>Pend.</th>
                                <th>% Compl.</th>
                                <th>Mov.</th>
                                <th>Mov/OP</th>
                                <th>Prom. días</th>
                                <th>Sector princ.</th>
                                <th>Última act.</th>
                              </tr>
                            </thead>
                            <tbody>
                              {reporteData.usuarios.map((u: any) => {
                                const t = Number(u.total_ordenes) || 0
                                const c = Number(u.ordenes_completadas) || 0
                                const p = Number(u.ordenes_en_proceso) || 0
                                const pend = u.ordenes_pendientes ?? pendientesDerivado(t, c, p)
                                const mov = Number(u.movimientos_realizados) || 0
                                return (
                                  <tr key={String(u.id_usuario ?? u.nombre_usuario)}>
                                    <td>{u.id_usuario != null ? String(u.id_usuario) : '—'}</td>
                                    <td>{u.nombre_usuario || '—'}</td>
                                    <td>{t}</td>
                                    <td>{c}</td>
                                    <td>{p}</td>
                                    <td>{pend}</td>
                                    <td>{pctLabel(c, t)}</td>
                                    <td>{mov}</td>
                                    <td>{movimientosPorOrden(mov, t)}</td>
                                    <td>
                                      {u.promedio_dias_completar != null
                                        ? Number(u.promedio_dias_completar).toFixed(1).replace('.', ',')
                                        : '—'}
                                    </td>
                                    <td>{u.sector_principal || '—'}</td>
                                    <td>{fmtFechaHora(u.ultima_actividad)}</td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p>No se encontraron datos para el período seleccionado.</p>
                  )}
                </>
              )}

              {reporteData.tipo === 'sector' && reporteData.sector && (
                <div className="rrhh-stats-grid">
                  <div className="rrhh-stat-card rrhh-stat-card--with-pie">
                    <h3>{reporteData.sector.sector || 'Sector'}</h3>
                    <p className="rrhh-reporte-card-note">
                      Órdenes con <strong>sector</strong> igual al elegido y <strong>fecha de creación</strong> en el rango.
                      Usuarios activos: distintos valores de &quot;usuario trabajando&quot; en ese sector y período.
                    </p>
                    <div className="rrhh-stat-rows">
                    <div className="rrhh-stat-item">
                      <span className="rrhh-stat-label">Total de órdenes:</span>
                      <span className="rrhh-stat-value">{reporteData.sector.total_ordenes || 0}</span>
                    </div>
                    <div className="rrhh-stat-item">
                      <span className="rrhh-stat-label">Completadas:</span>
                      <span className="rrhh-stat-value success">{reporteData.sector.ordenes_completadas || 0}</span>
                    </div>
                    <div className="rrhh-stat-item">
                      <span className="rrhh-stat-label">En proceso:</span>
                      <span className="rrhh-stat-value warning">{reporteData.sector.ordenes_en_proceso || 0}</span>
                    </div>
                    <div className="rrhh-stat-item">
                      <span className="rrhh-stat-label">Pendientes (derivado):</span>
                      <span className="rrhh-stat-value">
                        {pendientesDerivado(
                          Number(reporteData.sector.total_ordenes) || 0,
                          Number(reporteData.sector.ordenes_completadas) || 0,
                          Number(reporteData.sector.ordenes_en_proceso) || 0
                        )}
                      </span>
                    </div>
                    <div className="rrhh-stat-item">
                      <span className="rrhh-stat-label">Órdenes por día (aprox.):</span>
                      <span className="rrhh-stat-value">
                        {(
                          (Number(reporteData.sector.total_ordenes) || 0) /
                          diasPeriodoInclusivo(reporteData.periodo.desde, reporteData.periodo.hasta)
                        ).toFixed(2).replace('.', ',')}
                      </span>
                    </div>
                    <div className="rrhh-stat-item">
                      <span className="rrhh-stat-label">Usuarios activos (en sector):</span>
                      <span className="rrhh-stat-value">{reporteData.sector.usuarios_activos || 0}</span>
                    </div>
                    <div className="rrhh-stat-item">
                      <span className="rrhh-stat-label">Promedio días completar:</span>
                      <span className="rrhh-stat-value">
                        {reporteData.sector.promedio_dias_completar != null
                          ? Number(reporteData.sector.promedio_dias_completar).toFixed(1).replace('.', ',')
                          : '—'}
                      </span>
                    </div>
                    <div className="rrhh-stat-item">
                      <span className="rrhh-stat-label">Tasa de completitud:</span>
                      <span className="rrhh-stat-value success">
                        {reporteData.sector.tasa_completitud != null && reporteData.sector.tasa_completitud !== undefined
                          ? `${Number(reporteData.sector.tasa_completitud).toFixed(1).replace('.', ',')} %`
                          : pctLabel(
                              Number(reporteData.sector.ordenes_completadas) || 0,
                              Number(reporteData.sector.total_ordenes) || 0
                            )}
                      </span>
                    </div>
                    </div>
                    <ReportePieTorta
                      title="Órdenes por estado"
                      data={pieOrdenesPorEstado(reporteData.sector)}
                      height={260}
                      outerRadius={92}
                    />
                  </div>
                </div>
              )}

              {reporteData.tipo === 'periodo' && reporteData.estadisticas && (
                <div className="rrhh-stats-grid">
                  <div className="rrhh-stat-card rrhh-stat-card--with-pie">
                    <h3>Estadísticas generales del período</h3>
                    <p className="rrhh-reporte-card-note">
                      Incluye todas las órdenes creadas en el rango. Usuarios activos = distintos usuarios con movimientos
                      en historial en ese rango.
                    </p>
                    <div className="rrhh-stat-rows">
                    <div className="rrhh-stat-item">
                      <span className="rrhh-stat-label">Inicio / fin (BD):</span>
                      <span className="rrhh-stat-value">
                        {reporteData.estadisticas.periodo_inicio
                          ? new Date(reporteData.estadisticas.periodo_inicio as string).toLocaleDateString('es-AR')
                          : '—'}{' '}
                        —{' '}
                        {reporteData.estadisticas.periodo_fin
                          ? new Date(reporteData.estadisticas.periodo_fin as string).toLocaleDateString('es-AR')
                          : '—'}
                      </span>
                    </div>
                    <div className="rrhh-stat-item">
                      <span className="rrhh-stat-label">Total de órdenes:</span>
                      <span className="rrhh-stat-value">{reporteData.estadisticas.total_ordenes || 0}</span>
                    </div>
                    <div className="rrhh-stat-item">
                      <span className="rrhh-stat-label">Completadas:</span>
                      <span className="rrhh-stat-value success">{reporteData.estadisticas.ordenes_completadas || 0}</span>
                    </div>
                    <div className="rrhh-stat-item">
                      <span className="rrhh-stat-label">En proceso:</span>
                      <span className="rrhh-stat-value warning">{reporteData.estadisticas.ordenes_en_proceso || 0}</span>
                    </div>
                    <div className="rrhh-stat-item">
                      <span className="rrhh-stat-label">Pendientes (derivado):</span>
                      <span className="rrhh-stat-value">
                        {pendientesDerivado(
                          Number(reporteData.estadisticas.total_ordenes) || 0,
                          Number(reporteData.estadisticas.ordenes_completadas) || 0,
                          Number(reporteData.estadisticas.ordenes_en_proceso) || 0
                        )}
                      </span>
                    </div>
                    <div className="rrhh-stat-item">
                      <span className="rrhh-stat-label">Tasa de completitud:</span>
                      <span className="rrhh-stat-value success">
                        {pctLabel(
                          Number(reporteData.estadisticas.ordenes_completadas) || 0,
                          Number(reporteData.estadisticas.total_ordenes) || 0
                        )}
                      </span>
                    </div>
                    <div className="rrhh-stat-item">
                      <span className="rrhh-stat-label">Usuarios activos (historial):</span>
                      <span className="rrhh-stat-value">{reporteData.estadisticas.usuarios_activos || 0}</span>
                    </div>
                    <div className="rrhh-stat-item">
                      <span className="rrhh-stat-label">Movimientos totales:</span>
                      <span className="rrhh-stat-value">{reporteData.estadisticas.movimientos_totales || 0}</span>
                    </div>
                    <div className="rrhh-stat-item">
                      <span className="rrhh-stat-label">Movimientos por día (aprox.):</span>
                      <span className="rrhh-stat-value">
                        {(
                          (Number(reporteData.estadisticas.movimientos_totales) || 0) /
                          diasPeriodoInclusivo(reporteData.periodo.desde, reporteData.periodo.hasta)
                        ).toFixed(2).replace('.', ',')}
                      </span>
                    </div>
                    <div className="rrhh-stat-item">
                      <span className="rrhh-stat-label">Promedio días completar:</span>
                      <span className="rrhh-stat-value">
                        {reporteData.estadisticas.promedio_dias_completar != null
                          ? Number(reporteData.estadisticas.promedio_dias_completar).toFixed(1).replace('.', ',')
                          : '—'}
                      </span>
                    </div>
                    <div className="rrhh-stat-item">
                      <span className="rrhh-stat-label">Órdenes por día (BD):</span>
                      <span className="rrhh-stat-value">
                        {reporteData.estadisticas.ordenes_por_dia != null
                          ? Number(reporteData.estadisticas.ordenes_por_dia).toFixed(2).replace('.', ',')
                          : '—'}
                      </span>
                    </div>
                    </div>
                    <ReportePieTorta
                      title="Órdenes por estado"
                      data={pieOrdenesPorEstado(reporteData.estadisticas)}
                      height={260}
                      outerRadius={92}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default RecursosHumanosReportesPage


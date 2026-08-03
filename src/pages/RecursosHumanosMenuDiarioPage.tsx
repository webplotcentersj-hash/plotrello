import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import apiService from '../services/api'
import type { MenuDiario, MenuDescuentoBeneficioComida, MenuDescuentoBeneficioResumen, MenuSeleccion } from '../types/api'
import { formatArgentinaDate, formatArgentinaTime } from '../utils/dateUtils'
import {
  formatMenuDescuentoArs,
  getTurnoAlmuerzoLabel,
  MENU_DESCUENTO_PERDIDA_BENEFICIO_ARS,
  MENU_TURNOS_ALMUERZO
} from '../constants/menuDiario'
import jsPDF from 'jspdf'
import './RecursosHumanosMenuDiarioPage.css'

/**
 * Lista de comedor (PDF imprimir): etiqueta corta con @.
 * Si `nombre_usuario` es email, usa la parte antes del @; si ya empieza con @, la conserva; si no, @ + primera palabra.
 */
function etiquetaUsuarioArrobaParaImprimir(sel: MenuSeleccion): string {
  const raw = (sel.nombre_usuario || '').trim()
  if (!raw) return `@u${sel.id_usuario}`
  if (raw.startsWith('@')) {
    const token = raw.split(/\s+/)[0]
    return token.length > 1 ? token : `@u${sel.id_usuario}`
  }
  const at = raw.indexOf('@')
  if (at > 0) {
    const local = raw.slice(0, at).replace(/[^\w.-]/gi, '')
    return local ? `@${local}` : `@u${sel.id_usuario}`
  }
  const first = raw.split(/\s+/)[0] || raw
  const safe = first.replace(/[^\wÀ-ÿ0-9._-]/gi, '')
  return safe ? `@${safe}` : `@u${sel.id_usuario}`
}

const RecursosHumanosMenuDiarioPage = () => {
  const navigate = useNavigate()
  const { canManageRecursosHumanos, isAdmin, usuario, loading: authLoading } = useAuth()
  const canAccessRrhhMenu =
    !!usuario && (canManageRecursosHumanos || isAdmin || usuario.rol === 'gerencia')
  const [loading, setLoading] = useState(true)
  const [menuHoy, setMenuHoy] = useState<MenuDiario | null>(null)
  const [selecciones, setSelecciones] = useState<MenuSeleccion[]>([])
  const [menuSeleccionado, setMenuSeleccionado] = useState<MenuDiario | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [showSelecciones, setShowSelecciones] = useState(false)
  const [platos, setPlatos] = useState<string[]>([''])
  const [menusHistorial, setMenusHistorial] = useState<MenuDiario[]>([])
  const [historialLoading, setHistorialLoading] = useState(false)
  const [historialError, setHistorialError] = useState<string | null>(null)
  const [showHistorialDetalle, setShowHistorialDetalle] = useState(false)
  const [historialAbierto, setHistorialAbierto] = useState(false)
  const [filtroMes, setFiltroMes] = useState<string>(() => {
    const d = new Date()
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    return `${y}-${m}`
  })
  const [filtroDesde, setFiltroDesde] = useState<string>('')
  const [filtroHasta, setFiltroHasta] = useState<string>('')
  const [planillaMes, setPlanillaMes] = useState<string>(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const [planillaDesde, setPlanillaDesde] = useState('')
  const [planillaHasta, setPlanillaHasta] = useState('')
  const [descuentosDetalle, setDescuentosDetalle] = useState<MenuDescuentoBeneficioComida[]>([])
  const [descuentosResumen, setDescuentosResumen] = useState<MenuDescuentoBeneficioResumen[]>([])
  const [descuentosPorSeleccion, setDescuentosPorSeleccion] = useState<Record<number, number>>({})
  const [planillaLoading, setPlanillaLoading] = useState(false)
  const [planillaError, setPlanillaError] = useState<string | null>(null)
  const [planillaAbierta, setPlanillaAbierta] = useState(true)

  useEffect(() => {
    if (authLoading) return
    if (!canAccessRrhhMenu) {
      navigate('/rrhh/dashboard')
      return
    }
    void loadMenuHoy()
    // Historial inicia colapsado; se carga cuando se abre o cuando se ajustan filtros.
  }, [canAccessRrhhMenu, navigate, authLoading])

  useEffect(() => {
    if (!planillaMes) return
    const [yyRaw, mmRaw] = planillaMes.split('-')
    const yy = parseInt(yyRaw || '', 10)
    const mm = parseInt(mmRaw || '', 10)
    if (!Number.isFinite(yy) || !Number.isFinite(mm) || mm < 1 || mm > 12) return
    const first = `${yy}-${String(mm).padStart(2, '0')}-01`
    const lastDate = new Date(yy, mm, 0)
    const last = `${yy}-${String(mm).padStart(2, '0')}-${String(lastDate.getDate()).padStart(2, '0')}`
    setPlanillaDesde(first)
    setPlanillaHasta(last)
  }, [planillaMes])

  useEffect(() => {
    if (!canAccessRrhhMenu || !planillaDesde || !planillaHasta) return
    void loadPlanillaDescuentos(planillaDesde, planillaHasta)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAccessRrhhMenu, planillaDesde, planillaHasta])

  const loadMenuHoy = async () => {
    setLoading(true)
    try {
      const response = await apiService.obtenerMenuDiaActual()
      if (response.success && response.data) {
        setMenuHoy(response.data)
        if (response.data.platos && response.data.platos.length > 0) {
          setPlatos(response.data.platos.map((p) => p.nombre_plato))
        } else {
          setPlatos([''])
        }
      } else {
        setMenuHoy(null)
        setPlatos([''])
      }
    } catch (error) {
      console.error('Error cargando menú:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadPlanillaDescuentos = async (desde: string, hasta: string) => {
    setPlanillaLoading(true)
    setPlanillaError(null)
    try {
      const res = await apiService.menuDescuentosBeneficioListar({ fechaDesde: desde, fechaHasta: hasta })
      if (!res.success || !res.data) {
        setDescuentosDetalle([])
        setDescuentosResumen([])
        setPlanillaError(res.error || 'No se pudo cargar la planilla de descuentos')
        return
      }
      setDescuentosDetalle(res.data)
      setDescuentosResumen(apiService.menuDescuentosBeneficioResumenPorEmpleado(res.data))
    } catch (e: unknown) {
      setDescuentosDetalle([])
      setDescuentosResumen([])
      setPlanillaError(e instanceof Error ? e.message : 'Error al cargar planilla')
    } finally {
      setPlanillaLoading(false)
    }
  }

  const totalPlanillaMonto = descuentosResumen.reduce((s, r) => s + r.total_monto, 0)
  const totalPlanillaPedidos = descuentosDetalle.length

  const loadSelecciones = async () => {
    const m = menuSeleccionado ?? menuHoy
    if (!m) return
    const fecha = String(m.fecha).slice(0, 10)
    const [response, descRes] = await Promise.all([
      apiService.obtenerSeleccionesMenu(m.id),
      apiService.menuDescuentosBeneficioListar({ fechaDesde: fecha, fechaHasta: fecha })
    ])
    if (response.success && response.data) {
      setSelecciones(response.data)
    } else {
      setSelecciones([])
    }
    const map: Record<number, number> = {}
    if (descRes.success && descRes.data) {
      for (const d of descRes.data) {
        if (d.id_seleccion != null) map[d.id_seleccion] = d.monto
      }
    }
    setDescuentosPorSeleccion(map)
  }

  const loadHistorialMenus = async (params?: { desde?: string | null; hasta?: string | null }) => {
    setHistorialLoading(true)
    setHistorialError(null)
    try {
      const resp = await apiService.obtenerMenusDiarios(params?.desde ?? null, params?.hasta ?? null)
      if (resp.success && resp.data) {
        const ordered = [...resp.data].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
        setMenusHistorial(ordered.slice(0, 30))
      } else {
        setMenusHistorial([])
        setHistorialError(resp.error || 'No se pudo cargar el historial de menús')
      }
    } catch (e: any) {
      setMenusHistorial([])
      setHistorialError(e?.message || 'No se pudo cargar el historial de menús')
    } finally {
      setHistorialLoading(false)
    }
  }

  const applyFiltrosHistorial = async () => {
    const desde = filtroDesde.trim() || null
    const hasta = filtroHasta.trim() || null
    await loadHistorialMenus({ desde, hasta })
  }

  useEffect(() => {
    // Si el usuario elige mes, proponemos rango (1..último día) y cargamos cuando el panel esté abierto.
    if (!filtroMes) return
    const [yyRaw, mmRaw] = filtroMes.split('-')
    const yy = parseInt(yyRaw || '', 10)
    const mm = parseInt(mmRaw || '', 10)
    if (!Number.isFinite(yy) || !Number.isFinite(mm) || mm < 1 || mm > 12) return
    const first = `${yy}-${String(mm).padStart(2, '0')}-01`
    const lastDate = new Date(yy, mm, 0) // día 0 del mes siguiente => último del mes actual
    const last = `${yy}-${String(mm).padStart(2, '0')}-${String(lastDate.getDate()).padStart(2, '0')}`
    setFiltroDesde(first)
    setFiltroHasta(last)
    if (historialAbierto) void loadHistorialMenus({ desde: first, hasta: last })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroMes])

  useEffect(() => {
    if (historialAbierto && menusHistorial.length === 0 && !historialLoading) {
      void applyFiltrosHistorial()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historialAbierto])

  const handleNuevoMenu = () => {
    setPlatos([''])
    setShowModal(true)
  }

  const handleEditarMenu = () => {
    if (menuHoy && menuHoy.platos && menuHoy.platos.length > 0) {
      setPlatos(menuHoy.platos.map(p => p.nombre_plato))
    } else {
      setPlatos([''])
    }
    setShowModal(true)
  }

  const handleAgregarPlato = () => {
    setPlatos([...platos, ''])
  }

  const handleEliminarPlato = (index: number) => {
    if (platos.length > 1) {
      setPlatos(platos.filter((_, i) => i !== index))
    }
  }

  const handleCambiarPlato = (index: number, valor: string) => {
    const nuevosPlatos = [...platos]
    nuevosPlatos[index] = valor
    setPlatos(nuevosPlatos)
  }

  const handleGuardarMenu = async () => {
    if (!usuario?.id) return
    
    const platosFiltrados = platos.filter(p => p && p.trim() !== '')
    if (platosFiltrados.length === 0) {
      alert('Debes agregar al menos un plato')
      return
    }

    const yaHabiaMenuHoy = Boolean(menuHoy?.id)

    const response = await apiService.crearActualizarMenuDiario(
      platosFiltrados,
      usuario.id
    )

    if (response.success) {
      // Solo avisar a todos la primera vez del día (re-guardar no debe spamear comunicados).
      if (!yaHabiaMenuHoy) {
        try {
          const fecha = response.data?.fecha ?? menuHoy?.fecha ?? ''
          const lista = platosFiltrados.slice(0, 6).join(' · ')
          const descExtra =
            platosFiltrados.length > 6 ? ` · +${platosFiltrados.length - 6} más` : ''
          await apiService.enviarNotificacionMasiva({
            titulo: `🍽️ Menú diario disponible${fecha ? ` (${fecha})` : ''}`,
            descripcion: `Ya podés elegir tu plato en /menu-diario.${lista ? `\n\nPlatos: ${lista}${descExtra}` : ''}`,
            tipo: 'info',
            enviar_a_todos: true,
            id_usuario_emisor: usuario.id
          })
        } catch (e) {
          console.warn('Menú diario: no se pudo enviar notificación masiva:', e)
        }
      }
      alert('Menú guardado correctamente')
      setShowModal(false)
      loadMenuHoy()
    } else {
      alert('Error: ' + response.error)
    }
  }

  const handleVerSelecciones = async () => {
    await loadSelecciones()
    setShowSelecciones(true)
  }

  const generarPdfMenuDiario = (m: MenuDiario, listaPdf: MenuSeleccion[], tipo: 'enviar' | 'imprimir') => {
    const porPlato = new Map<number, MenuSeleccion[]>()
    for (const sel of listaPdf) {
      const arr = porPlato.get(sel.id_plato) ?? []
      arr.push(sel)
      porPlato.set(sel.id_plato, arr)
    }

    if (tipo === 'enviar') {
      const doc = new jsPDF()
      const pageWidth = doc.internal.pageSize.getWidth()
      const margin = 20
      let yPos = margin
      const nuevaPaginaSiHaceFalta = (extra: number) => {
        if (yPos + extra > 280) {
          doc.addPage()
          yPos = margin
        }
      }

      doc.setFontSize(18)
      doc.text('Menú del día — Para enviar', pageWidth / 2, yPos, { align: 'center' })
      yPos += 9
      doc.setFontSize(10)
      doc.setTextColor(90, 90, 90)
      doc.text('Solo cantidades por plato (números)', pageWidth / 2, yPos, { align: 'center' })
      doc.setTextColor(0, 0, 0)
      yPos += 12

      doc.setFontSize(11)
      doc.text(`Fecha: ${formatArgentinaDate(m.fecha)}`, margin, yPos)
      yPos += 7
      doc.setFontSize(12)
      doc.setFont('helvetica', 'bold')
      doc.text(`Total de pedidos: ${listaPdf.length}`, margin, yPos)
      doc.setFont('helvetica', 'normal')
      yPos += 14

      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.text('Cantidades por plato', margin, yPos)
      yPos += 10
      doc.setFont('helvetica', 'normal')

      let idx = 0
      for (const plato of m.platos) {
        idx += 1
        const n = (porPlato.get(plato.id) ?? []).length
        nuevaPaginaSiHaceFalta(12)
        doc.setFontSize(11)
        doc.setFont('helvetica', 'bold')
        const label = `${idx}. ${plato.nombre_plato}`
        const wTexto = pageWidth - margin * 2 - 28
        const lineas = doc.splitTextToSize(label, wTexto)
        for (let i = 0; i < lineas.length; i++) {
          nuevaPaginaSiHaceFalta(7)
          doc.text(lineas[i], margin, yPos)
          if (i === lineas.length - 1) {
            doc.setFontSize(13)
            doc.text(String(n), pageWidth - margin, yPos, { align: 'right' })
            doc.setFontSize(11)
          }
          yPos += 6
        }
        yPos += 4
      }

      doc.save(`menu-diario-para-enviar-${m.fecha}.pdf`)
      return
    }

    const byTurn = new Map<number, MenuSeleccion[]>()
    for (const s of listaPdf) {
      const tid = s.turno_almuerzo ?? 1
      const arr = byTurn.get(tid) ?? []
      arr.push(s)
      byTurn.set(tid, arr)
    }

    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()
    const margin = 20
    let yPos = margin

    const nuevaPaginaSiHaceFalta = (extra: number) => {
      if (yPos + extra > 280) {
        doc.addPage()
        yPos = margin
      }
    }

    doc.setFontSize(18)
    doc.text('Menú del día — Para imprimir', pageWidth / 2, yPos, { align: 'center' })
    yPos += 8
    doc.setFontSize(10)
    doc.setTextColor(90, 90, 90)
    doc.text('Listado por turno (comedor) — sin hora de registro ni emoji', pageWidth / 2, yPos, {
      align: 'center'
    })
    doc.setTextColor(0, 0, 0)
    yPos += 10

    doc.setFontSize(11)
    const fechaFormateada = formatArgentinaDate(m.fecha)
    doc.text(`Fecha: ${fechaFormateada}`, margin, yPos)
    yPos += 4
    doc.setFontSize(9)
    doc.setTextColor(100, 100, 100)
    doc.text(`Total de pedidos: ${listaPdf.length}`, margin, yPos)
    doc.setTextColor(0, 0, 0)
    yPos += 12

    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.text('Platos del menú', margin, yPos)
    yPos += 7
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    m.platos.forEach((plato, index) => {
      nuevaPaginaSiHaceFalta(8)
      doc.text(`${index + 1}. ${plato.nombre_plato}`, margin + 4, yPos)
      yPos += 6
    })

    yPos += 8
    nuevaPaginaSiHaceFalta(20)
    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.text('Pedidos por turno de almuerzo', margin, yPos)
    yPos += 7
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)

    for (const turno of MENU_TURNOS_ALMUERZO) {
      nuevaPaginaSiHaceFalta(18)
      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.text(`${turno.label} — ${turno.horario}`, margin, yPos)
      yPos += 6
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      const list = (byTurn.get(turno.id) ?? []).sort((a, b) =>
        etiquetaUsuarioArrobaParaImprimir(a).localeCompare(
          etiquetaUsuarioArrobaParaImprimir(b),
          'es',
          { sensitivity: 'base' }
        )
      )
      if (list.length === 0) {
        doc.setTextColor(110, 110, 110)
        doc.text('Sin pedidos en este turno.', margin + 4, yPos)
        doc.setTextColor(0, 0, 0)
        yPos += 6
      } else {
        for (const s of list) {
          const platoNom = s.nombre_plato || '—'
          const linea = `• ${etiquetaUsuarioArrobaParaImprimir(s)} — ${platoNom}`
          const wrapped = doc.splitTextToSize(linea, pageWidth - margin * 2 - 4)
          for (const ln of wrapped) {
            nuevaPaginaSiHaceFalta(6)
            doc.text(ln, margin + 4, yPos)
            yPos += 5
          }
          yPos += 1
        }
      }
      yPos += 4
    }

    yPos += 4
    nuevaPaginaSiHaceFalta(14)
    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.text('Resumen: pedidos por plato', margin, yPos)
    yPos += 8
    doc.setFont('helvetica', 'normal')

    for (const plato of m.platos) {
      const n = (porPlato.get(plato.id) ?? []).length
      nuevaPaginaSiHaceFalta(12)
      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.text(`${plato.nombre_plato}`, margin, yPos)
      yPos += 5
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.text(`Pedidos: ${n}`, margin + 4, yPos)
      yPos += 10
    }

    doc.save(`menu-diario-para-imprimir-${m.fecha}.pdf`)
  }

  const handlePdfParaEnviar = async (menu?: MenuDiario | null) => {
    const m = menu ?? menuSeleccionado ?? menuHoy
    if (!m) return
    const selRes = await apiService.obtenerSeleccionesMenu(m.id)
    const listaPdf = selRes.success && selRes.data ? selRes.data : []
    setSelecciones(listaPdf)
    generarPdfMenuDiario(m, listaPdf, 'enviar')
  }

  const handlePdfParaImprimir = async (menu?: MenuDiario | null) => {
    const m = menu ?? menuSeleccionado ?? menuHoy
    if (!m) return
    const selRes = await apiService.obtenerSeleccionesMenu(m.id)
    const listaPdf = selRes.success && selRes.data ? selRes.data : []
    setSelecciones(listaPdf)
    generarPdfMenuDiario(m, listaPdf, 'imprimir')
  }

  if (authLoading) {
    return (
      <div className="rrhh-menu-page">
        <div className="rrhh-menu-header">
          <h1>🍽️ Menú Diario</h1>
        </div>
        <div style={{ padding: '20px', textAlign: 'center' }}>Cargando...</div>
      </div>
    )
  }

  return (
    <div className="rrhh-menu-page">
      <div className="rrhh-menu-header">
        <h1>🍽️ Menú Diario</h1>
        <button className="btn-primary" onClick={() => navigate('/rrhh/dashboard')}>
          ← Volver al Dashboard
        </button>
      </div>

      <div className="rrhh-menu-content">
        {/* Menú del día */}
        {loading ? (
          <p className="rrhh-menu-planilla-empty">Cargando menú del día…</p>
        ) : menuHoy ? (
          <div className="rrhh-menu-card">
            <div className="rrhh-menu-card-header">
              <h3>Menú del Día - {formatArgentinaDate(menuHoy.fecha)}</h3>
              <span className="badge-active">Activo</span>
            </div>
            <div className="rrhh-menu-card-body">
              <div className="menu-platos-list">
                {menuHoy.platos && menuHoy.platos.length > 0 ? (
                  menuHoy.platos.map((plato, index) => (
                    <div key={plato.id} className="menu-plato-item">
                      <span className="plato-number">{index + 1}.</span>
                      <span className="plato-name">{plato.nombre_plato}</span>
                    </div>
                  ))
                ) : (
                  <p>No hay platos cargados</p>
                )}
              </div>
              <div className="menu-stats">
                <strong>Total Selecciones:</strong> {menuHoy.total_selecciones || 0}
              </div>
            </div>
            <div className="rrhh-menu-card-actions">
              <button className="btn-secondary" onClick={handleEditarMenu}>
                ✏️ Editar Menú
              </button>
              <button className="btn-secondary" onClick={handleVerSelecciones}>
                👥 Ver Selecciones ({menuHoy.total_selecciones || 0})
              </button>
              <button
                className="btn-secondary"
                type="button"
                onClick={() => void handlePdfParaEnviar(menuHoy)}
                title="Solo cantidades numéricas por plato (para proveedor / cocina)"
              >
                📧 PDF para enviar
              </button>
              <button
                className="btn-secondary"
                type="button"
                onClick={() => void handlePdfParaImprimir(menuHoy)}
                title="Comedor: @usuario y plato por turno, sin hora ni emoji"
              >
                🖨️ PDF para imprimir
              </button>
            </div>
          </div>
        ) : (
          <div className="rrhh-empty-state">
            <p>No hay menú cargado para hoy</p>
            <button className="btn-primary" onClick={handleNuevoMenu}>
              ➕ Crear Menú del Día
            </button>
          </div>
        )}

        {/* Planilla descuentos — pérdida beneficio comida */}
        <section className="rrhh-menu-planilla">
          <button
            type="button"
            className="rrhh-menu-planilla-toggle"
            onClick={() => setPlanillaAbierta((v) => !v)}
            aria-expanded={planillaAbierta}
          >
            <span className="rrhh-menu-planilla-toggle-title">
              💰 Planilla descuentos — pérdida beneficio comida
            </span>
            <span className="rrhh-menu-planilla-toggle-meta">
              {formatMenuDescuentoArs(MENU_DESCUENTO_PERDIDA_BENEFICIO_ARS)} por pedido ·{' '}
              {totalPlanillaPedidos} registro{totalPlanillaPedidos === 1 ? '' : 's'} en el período
            </span>
            <span className="rrhh-menu-planilla-chevron">{planillaAbierta ? '▼' : '▶'}</span>
          </button>

          {planillaAbierta && (
            <div className="rrhh-menu-planilla-body">
              <p className="rrhh-menu-planilla-hint">
                Empleados con novedad de pérdida del beneficio de comida que pidieron menú: cada pedido suma{' '}
                <strong>{formatMenuDescuentoArs(MENU_DESCUENTO_PERDIDA_BENEFICIO_ARS)}</strong> al descuento
                acumulado (se registra al confirmar en /menu-diario).
              </p>

              <div className="rrhh-menu-planilla-filters">
                <label>
                  Mes
                  <input type="month" value={planillaMes} onChange={(e) => setPlanillaMes(e.target.value)} />
                </label>
                <label>
                  Desde
                  <input
                    type="date"
                    value={planillaDesde}
                    onChange={(e) => setPlanillaDesde(e.target.value)}
                  />
                </label>
                <label>
                  Hasta
                  <input
                    type="date"
                    value={planillaHasta}
                    onChange={(e) => setPlanillaHasta(e.target.value)}
                  />
                </label>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={planillaLoading || !planillaDesde || !planillaHasta}
                  onClick={() => void loadPlanillaDescuentos(planillaDesde, planillaHasta)}
                >
                  {planillaLoading ? 'Cargando…' : 'Aplicar'}
                </button>
              </div>

              {planillaError ? <p className="rrhh-menu-planilla-error">⚠️ {planillaError}</p> : null}

              {planillaLoading ? (
                <p className="rrhh-menu-planilla-empty">Cargando planilla…</p>
              ) : descuentosResumen.length === 0 ? (
                <p className="rrhh-menu-planilla-empty">
                  No hay descuentos registrados en este período.
                </p>
              ) : (
                <>
                  <div className="rrhh-menu-planilla-kpis">
                    <div className="rrhh-menu-planilla-kpi">
                      <span>Empleados con descuento</span>
                      <strong>{descuentosResumen.length}</strong>
                    </div>
                    <div className="rrhh-menu-planilla-kpi">
                      <span>Total pedidos descontados</span>
                      <strong>{totalPlanillaPedidos}</strong>
                    </div>
                    <div className="rrhh-menu-planilla-kpi rrhh-menu-planilla-kpi--total">
                      <span>Acumulado a descontar</span>
                      <strong>{formatMenuDescuentoArs(totalPlanillaMonto)}</strong>
                    </div>
                  </div>

                  <div className="rrhh-menu-planilla-table-wrap">
                    <h4>Acumulado por empleado</h4>
                    <table className="rrhh-table rrhh-menu-planilla-table">
                      <thead>
                        <tr>
                          <th>Empleado</th>
                          <th>Pedidos</th>
                          <th>Acumulado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {descuentosResumen.map((r) => (
                          <tr key={r.id_usuario}>
                            <td>{r.nombre_usuario}</td>
                            <td>{r.cantidad_pedidos}</td>
                            <td className="rrhh-menu-planilla-monto">{formatMenuDescuentoArs(r.total_monto)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td>
                            <strong>Total general</strong>
                          </td>
                          <td>
                            <strong>{totalPlanillaPedidos}</strong>
                          </td>
                          <td className="rrhh-menu-planilla-monto">
                            <strong>{formatMenuDescuentoArs(totalPlanillaMonto)}</strong>
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  <div className="rrhh-menu-planilla-table-wrap">
                    <h4>Detalle por pedido</h4>
                    <table className="rrhh-table rrhh-menu-planilla-table rrhh-menu-planilla-table--detail">
                      <thead>
                        <tr>
                          <th>Fecha</th>
                          <th>Empleado</th>
                          <th>Plato</th>
                          <th>Descuento</th>
                        </tr>
                      </thead>
                      <tbody>
                        {descuentosDetalle.map((d) => (
                          <tr key={d.id}>
                            <td>{formatArgentinaDate(d.fecha)}</td>
                            <td>{d.nombre_usuario || `Usuario ${d.id_usuario}`}</td>
                            <td>{d.nombre_plato || '—'}</td>
                            <td className="rrhh-menu-planilla-monto">{formatMenuDescuentoArs(d.monto)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}
        </section>

        {/* Historial de menús */}
        <div className="rrhh-menu-history">
          <button
            type="button"
            className="rrhh-menu-history-toggle"
            onClick={() => setHistorialAbierto((v) => !v)}
            aria-expanded={historialAbierto}
          >
            <span className="rrhh-menu-history-toggle-title">📚 Historial de menús</span>
            <span className="rrhh-menu-history-toggle-meta">
              {menusHistorial.length} registros (máx 30)
            </span>
            <span className="rrhh-menu-history-chevron">{historialAbierto ? '▼' : '▶'}</span>
          </button>

          {historialAbierto && (
            <div className="rrhh-menu-history-body">
              <div className="rrhh-menu-history-filters">
                <div className="rrhh-menu-history-filter">
                  <label>Mes</label>
                  <input
                    type="month"
                    value={filtroMes}
                    onChange={(e) => setFiltroMes(e.target.value)}
                  />
                </div>
                <div className="rrhh-menu-history-filter">
                  <label>Desde</label>
                  <input
                    type="date"
                    value={filtroDesde}
                    onChange={(e) => setFiltroDesde(e.target.value)}
                  />
                </div>
                <div className="rrhh-menu-history-filter">
                  <label>Hasta</label>
                  <input
                    type="date"
                    value={filtroHasta}
                    onChange={(e) => setFiltroHasta(e.target.value)}
                  />
                </div>
                <div className="rrhh-menu-history-filter rrhh-menu-history-filter-actions">
                  <button className="btn-secondary" onClick={() => void applyFiltrosHistorial()} disabled={historialLoading}>
                    {historialLoading ? 'Buscando…' : 'Aplicar'}
                  </button>
                  <button
                    className="btn-secondary"
                    onClick={() => {
                      const d = new Date()
                      const y = d.getFullYear()
                      const m = String(d.getMonth() + 1).padStart(2, '0')
                      setFiltroMes(`${y}-${m}`)
                    }}
                    disabled={historialLoading}
                  >
                    Mes actual
                  </button>
                </div>
              </div>

              {historialError && <div className="rrhh-menu-history-error">⚠️ {historialError}</div>}
              {historialLoading ? (
                <div className="rrhh-menu-history-loading">Cargando…</div>
              ) : menusHistorial.length === 0 ? (
                <div className="rrhh-menu-history-empty">No hay menús para ese filtro.</div>
              ) : (
                <div className="rrhh-menu-history-table-wrap">
                  <table className="rrhh-table rrhh-menu-history-table">
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Platos</th>
                        <th>Pedidos</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {menusHistorial.map((m) => (
                        <tr key={m.id}>
                          <td>{formatArgentinaDate(m.fecha)}</td>
                          <td>{m.platos?.length ?? 0}</td>
                          <td>{m.total_selecciones ?? 0}</td>
                          <td>
                            <div className="rrhh-menu-history-actions">
                              <button
                                type="button"
                                className="btn-secondary"
                                onClick={() => {
                                  setMenuSeleccionado(m)
                                  setShowHistorialDetalle(true)
                                }}
                              >
                                Ver
                              </button>
                              <button
                                type="button"
                                className="btn-secondary"
                                onClick={() => void handlePdfParaEnviar(m)}
                                title="Cantidades por plato solamente"
                              >
                                📧 Enviar
                              </button>
                              <button
                                type="button"
                                className="btn-secondary"
                                onClick={() => void handlePdfParaImprimir(m)}
                                title="PDF listo para imprimir (comedor)"
                              >
                                🖨️ Imprimir
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal: detalle de menú histórico */}
      {showHistorialDetalle && menuSeleccionado && (
        <div className="rrhh-modal-overlay" onClick={() => setShowHistorialDetalle(false)}>
          <div className="rrhh-modal" onClick={(e) => e.stopPropagation()}>
            <div className="rrhh-modal-header">
              <h2>Menú — {formatArgentinaDate(menuSeleccionado.fecha)}</h2>
              <button className="btn-close" onClick={() => setShowHistorialDetalle(false)}>
                ✕
              </button>
            </div>
            <div className="rrhh-modal-body">
              <div className="menu-platos-list">
                {menuSeleccionado.platos?.length ? (
                  menuSeleccionado.platos.map((plato, index) => (
                    <div key={plato.id} className="menu-plato-item">
                      <span className="plato-number">{index + 1}.</span>
                      <span className="plato-name">{plato.nombre_plato}</span>
                    </div>
                  ))
                ) : (
                  <p>No hay platos cargados</p>
                )}
              </div>
              <div className="menu-stats">
                <strong>Total Selecciones:</strong> {menuSeleccionado.total_selecciones || 0}
              </div>
              <div className="rrhh-menu-history-actions rrhh-menu-history-actions--modal">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => void handlePdfParaEnviar(menuSeleccionado)}
                  title="Cantidades por plato solamente"
                >
                  📧 PDF para enviar
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => void handlePdfParaImprimir(menuSeleccionado)}
                  title="Listado comedor para imprimir"
                >
                  🖨️ PDF para imprimir
                </button>
                <button
                  className="btn-secondary"
                  onClick={async () => {
                    await handleVerSelecciones()
                  }}
                >
                  👥 Ver Selecciones
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de selecciones */}
      {showSelecciones && (
        <div className="rrhh-modal-overlay" onClick={() => setShowSelecciones(false)}>
          <div className="rrhh-modal" onClick={(e) => e.stopPropagation()}>
            <div className="rrhh-modal-header">
              <h2>Selecciones - {(menuSeleccionado ?? menuHoy) && formatArgentinaDate((menuSeleccionado ?? menuHoy)!.fecha)}</h2>
              <button className="btn-close" onClick={() => setShowSelecciones(false)}>✕</button>
            </div>
            <div className="rrhh-modal-body">
              <table className="rrhh-table">
                <thead>
                  <tr>
                    <th>Empleado</th>
                    <th>Plato</th>
                    <th>Turno almuerzo</th>
                    <th>Cómo se siente</th>
                    <th>Hora</th>
                    <th>Descuento</th>
                  </tr>
                </thead>
                <tbody>
                  {selecciones.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center' }}>No hay selecciones registradas</td>
                    </tr>
                  ) : (
                    selecciones.map((sel) => {
                      const desc = descuentosPorSeleccion[sel.id]
                      return (
                      <tr key={sel.id}>
                        <td>{sel.nombre_usuario || `Usuario ${sel.id_usuario}`}</td>
                        <td>{sel.nombre_plato || '-'}</td>
                        <td>{getTurnoAlmuerzoLabel(sel.turno_almuerzo ?? 1)}</td>
                        <td className="rrhh-table-emoji">{sel.emoji_estado || '—'}</td>
                        <td>{formatArgentinaTime(sel.fecha_seleccion)}</td>
                        <td className={desc ? 'rrhh-menu-planilla-monto' : ''}>
                          {desc ? formatMenuDescuentoArs(desc) : '—'}
                        </td>
                      </tr>
                    )})
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal de formulario */}
      {showModal && (
        <div className="rrhh-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="rrhh-modal" onClick={(e) => e.stopPropagation()}>
            <div className="rrhh-modal-header">
              <h2>Gestionar Menú del Día</h2>
              <button className="btn-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="rrhh-modal-body">
              <div className="form-group">
                <label>Platos del Día *</label>
                <p className="form-help">Agrega los platos disponibles para hoy. Puedes agregar múltiples platos.</p>
                {platos.map((plato, index) => (
                  <div key={index} className="plato-input-group">
                    <input
                      type="text"
                      value={plato}
                      onChange={(e) => handleCambiarPlato(index, e.target.value)}
                      placeholder={`Plato ${index + 1}`}
                      className="plato-input"
                    />
                    {platos.length > 1 && (
                      <button
                        type="button"
                        className="btn-remove-plato"
                        onClick={() => handleEliminarPlato(index)}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  className="btn-add-plato"
                  onClick={handleAgregarPlato}
                >
                  ➕ Agregar Otro Plato
                </button>
              </div>
              <div className="rrhh-modal-actions">
                <button className="btn-secondary" onClick={() => setShowModal(false)}>
                  Cancelar
                </button>
                <button className="btn-primary" onClick={handleGuardarMenu}>
                  Guardar Menú
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default RecursosHumanosMenuDiarioPage

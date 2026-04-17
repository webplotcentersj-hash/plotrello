import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import apiService from '../services/api'
import type { MenuDiario, MenuSeleccion } from '../types/api'
import { formatArgentinaDate, formatArgentinaTime } from '../utils/dateUtils'
import { getTurnoAlmuerzoLabel, MENU_TURNOS_ALMUERZO } from '../constants/menuDiario'
import jsPDF from 'jspdf'
import './RecursosHumanosMenuDiarioPage.css'

const RecursosHumanosMenuDiarioPage = () => {
  const navigate = useNavigate()
  const { canManageRecursosHumanos, usuario, loading: authLoading } = useAuth()
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

  useEffect(() => {
    if (authLoading) return
    if (!canManageRecursosHumanos) {
      navigate('/rrhh/dashboard')
      return
    }
    loadMenuHoy()
    // Historial inicia colapsado; se carga cuando se abre o cuando se ajustan filtros.
  }, [canManageRecursosHumanos, navigate, authLoading])

  const loadMenuHoy = async () => {
    setLoading(true)
    try {
      const response = await apiService.obtenerMenuDiaActual()
      if (response.success && response.data) {
        setMenuHoy(response.data)
        if (response.data.platos && response.data.platos.length > 0) {
          setPlatos(response.data.platos.map(p => p.nombre_plato))
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

  const loadSelecciones = async () => {
    const m = menuSeleccionado ?? menuHoy
    if (!m) return
    const response = await apiService.obtenerSeleccionesMenu(m.id)
    if (response.success && response.data) {
      setSelecciones(response.data)
    }
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

    const response = await apiService.crearActualizarMenuDiario(
      platosFiltrados,
      usuario.id
    )

    if (response.success) {
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

  const handleDescargarPDF = async (menu?: MenuDiario | null) => {
    const m = menu ?? menuSeleccionado ?? menuHoy
    if (!m) return

    const selRes = await apiService.obtenerSeleccionesMenu(m.id)
    const listaPdf =
      selRes.success && selRes.data ? selRes.data : []
    setSelecciones(listaPdf)

    const porPlato = new Map<number, MenuSeleccion[]>()
    for (const sel of listaPdf) {
      const arr = porPlato.get(sel.id_plato) ?? []
      arr.push(sel)
      porPlato.set(sel.id_plato, arr)
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
    doc.text('Resumen del día — Menú', pageWidth / 2, yPos, { align: 'center' })
    yPos += 10

    doc.setFontSize(11)
    const fechaFormateada = formatArgentinaDate(m.fecha)
    doc.text(`Fecha: ${fechaFormateada}`, margin, yPos)
    yPos += 4
    doc.setFontSize(9)
    doc.setTextColor(100, 100, 100)
    doc.text(
      `Total de pedidos: ${listaPdf.length}`,
      margin,
      yPos
    )
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

    const byTurn = new Map<number, MenuSeleccion[]>()
    for (const s of listaPdf) {
      const tid = s.turno_almuerzo ?? 1
      const arr = byTurn.get(tid) ?? []
      arr.push(s)
      byTurn.set(tid, arr)
    }

    for (const turno of MENU_TURNOS_ALMUERZO) {
      nuevaPaginaSiHaceFalta(18)
      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.text(`${turno.label} — ${turno.horario}`, margin, yPos)
      yPos += 6
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      const list = (byTurn.get(turno.id) ?? []).sort((a, b) =>
        (a.nombre_usuario || '').localeCompare(b.nombre_usuario || '', 'es', { sensitivity: 'base' })
      )
      if (list.length === 0) {
        doc.setTextColor(110, 110, 110)
        doc.text('Sin pedidos en este turno.', margin + 4, yPos)
        doc.setTextColor(0, 0, 0)
        yPos += 6
      } else {
        for (const s of list) {
          const nombre = s.nombre_usuario || `Usuario ${s.id_usuario}`
          const platoNom = s.nombre_plato || '—'
          const em = s.emoji_estado || '—'
          const horaReg = formatArgentinaTime(s.fecha_seleccion)
          const linea = `• ${nombre} — Plato: ${platoNom} — Estado: ${em} — Registro: ${horaReg}`
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

    doc.save(`resumen-menu-${m.fecha}.pdf`)
  }

  if (loading) {
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
        {menuHoy ? (
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
              <button className="btn-secondary" onClick={() => void handleDescargarPDF(menuHoy)} title="Incluye turnos y detalle por empleado">
                📄 Descargar PDF (reporte)
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
                                onClick={() => void handleDescargarPDF(m)}
                                title="Turnos y pedidos por usuario"
                              >
                                PDF
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
                  className="btn-secondary"
                  onClick={() => void handleDescargarPDF(menuSeleccionado)}
                  title="Incluye turnos y detalle por empleado"
                >
                  📄 Descargar PDF (reporte)
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
                  </tr>
                </thead>
                <tbody>
                  {selecciones.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center' }}>No hay selecciones registradas</td>
                    </tr>
                  ) : (
                    selecciones.map((sel) => (
                      <tr key={sel.id}>
                        <td>{sel.nombre_usuario || `Usuario ${sel.id_usuario}`}</td>
                        <td>{sel.nombre_plato || '-'}</td>
                        <td>{getTurnoAlmuerzoLabel(sel.turno_almuerzo ?? 1)}</td>
                        <td className="rrhh-table-emoji">{sel.emoji_estado || '—'}</td>
                        <td>{formatArgentinaTime(sel.fecha_seleccion)}</td>
                      </tr>
                    ))
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

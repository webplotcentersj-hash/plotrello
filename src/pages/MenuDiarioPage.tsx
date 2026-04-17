import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import apiService from '../services/api'
import type { MenuDiario, MenuSeleccion } from '../types/api'
import { getArgentinaDate, formatArgentinaTime, formatArgentinaDate, isBeforeArgentinaTime } from '../utils/dateUtils'
import {
  MENU_TURNOS_ALMUERZO,
  MENU_ALMUERZO_CUPO_POR_TURNO,
  MENU_EMOJIS_ESTADO,
  MENU_PEDIDO_HORA_TOPE_ARG,
  MENU_PEDIDO_HORA_TOPE_TEXTO,
  getTurnoAlmuerzoLabel,
  type MenuTurnoAlmuerzoId
} from '../constants/menuDiario'
import jsPDF from 'jspdf'
import './MenuDiarioPage.css'

function seatsForTurn(selecciones: MenuSeleccion[], turno: MenuTurnoAlmuerzoId) {
  const list = selecciones
    .filter((s) => (s.turno_almuerzo ?? 1) === turno)
    .sort((a, b) => a.fecha_seleccion.localeCompare(b.fecha_seleccion))
  return Array.from({ length: MENU_ALMUERZO_CUPO_POR_TURNO }, (_, i) => {
    const s = list[i]
    return s
      ? {
          ocupado: true as const,
          nombre: s.nombre_usuario || `Usuario ${s.id_usuario}`,
          emoji: s.emoji_estado || '😊'
        }
      : { ocupado: false as const }
  })
}

const MenuDiarioPage = () => {
  const navigate = useNavigate()
  const { usuario, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [menu, setMenu] = useState<MenuDiario | null>(null)
  const [miSeleccion, setMiSeleccion] = useState<MenuSeleccion | null>(null)
  const [seleccionesMesa, setSeleccionesMesa] = useState<MenuSeleccion[]>([])
  const [seleccionando, setSeleccionando] = useState(false)
  const [horaActual, setHoraActual] = useState(getArgentinaDate())
  const [puedeSeleccionar, setPuedeSeleccionar] = useState(true)

  const [platoElegido, setPlatoElegido] = useState<number | null>(null)
  const [turnoElegido, setTurnoElegido] = useState<MenuTurnoAlmuerzoId | null>(null)
  const [emojiElegido, setEmojiElegido] = useState<string | null>(null)

  useEffect(() => {
    if (authLoading) return
    if (!usuario) {
      navigate('/')
      return
    }
    loadMenu()
    const interval = setInterval(() => {
      setHoraActual(getArgentinaDate())
    }, 60000)
    return () => clearInterval(interval)
  }, [authLoading, usuario, navigate])

  useEffect(() => {
    setPuedeSeleccionar(
      isBeforeArgentinaTime(MENU_PEDIDO_HORA_TOPE_ARG.hour, MENU_PEDIDO_HORA_TOPE_ARG.minute)
    )
  }, [horaActual])

  const loadSeleccionesMesa = useCallback(async (idMenu: number) => {
    const response = await apiService.obtenerSeleccionesMenu(idMenu)
    if (response.success && response.data) {
      setSeleccionesMesa(response.data)
    } else {
      setSeleccionesMesa([])
    }
  }, [])

  useEffect(() => {
    if (!menu?.id) return
    loadSeleccionesMesa(menu.id)
    const t = setInterval(() => loadSeleccionesMesa(menu.id), 45000)
    return () => clearInterval(t)
  }, [menu?.id, loadSeleccionesMesa])

  const loadMenu = async () => {
    setLoading(true)
    try {
      const response = await apiService.obtenerMenuDiaActual()
      if (response.success && response.data) {
        setMenu(response.data)
        if (usuario?.id) {
          await loadMiSeleccion(response.data.id, usuario.id)
        }
        await loadSeleccionesMesa(response.data.id)
      } else {
        setMenu(null)
        setSeleccionesMesa([])
      }
    } catch (error) {
      console.error('Error cargando menú:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadMiSeleccion = async (idMenu: number, idUsuario: number) => {
    const response = await apiService.obtenerSeleccionUsuarioMenu(idMenu, idUsuario)
    if (response.success && response.data) {
      setMiSeleccion(response.data)
      setPlatoElegido(response.data.id_plato)
      setTurnoElegido((response.data.turno_almuerzo ?? 1) as MenuTurnoAlmuerzoId)
      setEmojiElegido(response.data.emoji_estado ?? '😊')
    } else {
      setMiSeleccion(null)
      setPlatoElegido(null)
      setTurnoElegido(null)
      setEmojiElegido(null)
    }
  }

  const countEnTurno = (turno: MenuTurnoAlmuerzoId, excluirUsuarioId?: number) =>
    seleccionesMesa.filter(
      (s) =>
        (s.turno_almuerzo ?? 1) === turno &&
        (excluirUsuarioId == null || s.id_usuario !== excluirUsuarioId)
    ).length

  const handleConfirmarPedido = async () => {
    if (!usuario?.id || !menu) return
    if (!puedeSeleccionar) {
      alert(
        `El plazo para seleccionar el menú ha expirado. Debes hacerlo antes de las ${MENU_PEDIDO_HORA_TOPE_TEXTO} AM (hora Argentina)`
      )
      return
    }
    if (platoElegido == null || turnoElegido == null || !emojiElegido) {
      alert('Elegí plato, turno de almuerzo y cómo te sentís (emoji).')
      return
    }

    const otros = countEnTurno(turnoElegido, usuario.id)
    if (otros >= MENU_ALMUERZO_CUPO_POR_TURNO) {
      alert('Ese turno ya está completo (10 lugares). Elegí otro horario.')
      return
    }

    setSeleccionando(true)
    try {
      const response = await apiService.seleccionarPlatoMenu(
        menu.id,
        usuario.id,
        platoElegido,
        turnoElegido,
        emojiElegido
      )
      if (response.success && response.data) {
        setMiSeleccion(response.data)
        alert('Pedido registrado correctamente')
        await loadMenu()
      } else {
        alert('Error: ' + response.error)
      }
    } catch (error: unknown) {
      alert('Error: ' + (error instanceof Error ? error.message : 'Error al confirmar'))
    } finally {
      setSeleccionando(false)
    }
  }

  const handleCancelarSeleccion = async () => {
    if (!usuario?.id || !menu || !miSeleccion) return
    if (!puedeSeleccionar) {
      alert(
        `El plazo para cancelar la selección ha expirado. Debes hacerlo antes de las ${MENU_PEDIDO_HORA_TOPE_TEXTO} AM (hora Argentina)`
      )
      return
    }

    if (!confirm('¿Cancelar tu pedido del menú?')) return

    const response = await apiService.cancelarSeleccionMenu(menu.id, usuario.id)
    if (response.success) {
      setMiSeleccion(null)
      setPlatoElegido(null)
      setTurnoElegido(null)
      setEmojiElegido(null)
      alert('Pedido cancelado')
      loadMenu()
    } else {
      alert('Error: ' + response.error)
    }
  }

  const handleDescargarPedido = () => {
    if (!usuario || !menu || !miSeleccion) return

    const doc = new jsPDF()
    const w = doc.internal.pageSize.getWidth()
    const m = 18
    let y = m

    doc.setFontSize(16)
    doc.text('Pedido — Menú del día', w / 2, y, { align: 'center' })
    y += 10
    doc.setFontSize(11)
    doc.text(`Fecha: ${formatArgentinaDate(menu.fecha)}`, m, y)
    y += 7
    doc.text(`Empleado/a: ${usuario.nombre}`, m, y)
    y += 7
    doc.text(`Plato: ${miSeleccion.nombre_plato || '—'}`, m, y)
    y += 7
    doc.text(`Turno almuerzo: ${getTurnoAlmuerzoLabel(miSeleccion.turno_almuerzo ?? 1)}`, m, y)
    y += 7
    doc.text(`Cómo te sentís: ${miSeleccion.emoji_estado || '—'}`, m, y)
    y += 7
    doc.text(`Registrado: ${formatArgentinaTime(miSeleccion.fecha_seleccion)}`, m, y)

    doc.save(`pedido-menu-${menu.fecha}-${usuario.nombre.replace(/\s+/g, '-')}.pdf`)
  }

  if (loading) {
    return (
      <div className="menu-diario-page">
        <div className="menu-diario-header">
          <h1>🍽️ Menú Diario</h1>
        </div>
        <div style={{ padding: '20px', textAlign: 'center' }}>Cargando...</div>
      </div>
    )
  }

  const horaFormateada = formatArgentinaTime(horaActual)

  return (
    <div className="menu-diario-page">
      <div className="menu-diario-header">
        <h1>🍽️ Menú Diario</h1>
        <button className="btn-back" onClick={() => navigate('/')}>
          ← Volver al Tablero
        </button>
      </div>

      <div className="menu-diario-content">
        <div className="menu-horario-info">
          <div className={`horario-badge ${puedeSeleccionar ? 'horario-activo' : 'horario-expirado'}`}>
            {puedeSeleccionar ? (
              <>
                ⏰ Hora actual (Argentina): {horaFormateada} — Podés elegir menú, turno y estado hasta las{' '}
                {MENU_PEDIDO_HORA_TOPE_TEXTO}
              </>
            ) : (
              <>
                ⏰ Hora actual (Argentina): {horaFormateada} — El plazo para elegir o cambiar el menú ya cerró
              </>
            )}
          </div>
        </div>

        {!menu ? (
          <div className="menu-empty-state">
            <p>No hay menú disponible para hoy</p>
            <p className="menu-empty-subtitle">El menú será publicado por Recursos Humanos</p>
          </div>
        ) : (
          <>
            <div className="menu-card">
              <div className="menu-card-header">
                <h2>Menú del día</h2>
                <span className="menu-fecha">{formatArgentinaDate(menu.fecha)}</span>
              </div>
              <div className="menu-card-body">
                <div className="menu-platos-grid">
                  {menu.platos && menu.platos.length > 0 ? (
                    menu.platos.map((plato, idx) => (
                      <div key={plato.id} className="menu-plato-card">
                        <div className="plato-number">{idx + 1}</div>
                        <div className="plato-name">{plato.nombre_plato}</div>
                      </div>
                    ))
                  ) : (
                    <p>No hay platos disponibles</p>
                  )}
                </div>
              </div>
            </div>

            <div className="menu-mesa-section">
              <div className="menu-mesa-header">
                <h3>🪑 Mesas por turno de almuerzo</h3>
                <p className="menu-mesa-sub">
                  Cada turno tiene {MENU_ALMUERZO_CUPO_POR_TURNO} lugares. Asientos ocupados se actualizan solos.
                </p>
                <button type="button" className="btn-mesa-refresh" onClick={() => menu.id && loadSeleccionesMesa(menu.id)}>
                  🔄 Actualizar
                </button>
              </div>
              <div className="menu-mesa-grid">
                {MENU_TURNOS_ALMUERZO.map((t) => {
                  const seats = seatsForTurn(seleccionesMesa, t.id)
                  const ocupados = seleccionesMesa.filter((s) => (s.turno_almuerzo ?? 1) === t.id).length
                  return (
                    <div key={t.id} className="menu-mesa-mesa">
                      <div className="menu-mesa-mesa-top">
                        <span className="menu-mesa-titulo">{t.label}</span>
                        <span className="menu-mesa-hora">{t.horario}</span>
                        <span className="menu-mesa-cupo">
                          {ocupados} / {MENU_ALMUERZO_CUPO_POR_TURNO}
                        </span>
                      </div>
                      <div className="menu-mesa-tabla" aria-label={`Asientos turno ${t.id}`}>
                        {seats.map((seat, idx) => (
                          <div
                            key={idx}
                            className={`menu-mesa-asiento ${seat.ocupado ? 'ocupado' : 'libre'}`}
                            title={seat.ocupado ? seat.nombre : `Lugar ${idx + 1} libre`}
                          >
                            {seat.ocupado ? (
                              <>
                                <span className="menu-mesa-emoji">{seat.emoji}</span>
                                <span className="menu-mesa-nombre">{seat.nombre}</span>
                              </>
                            ) : (
                              <span className="menu-mesa-libre">+</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {miSeleccion ? (
              <div className="menu-seleccion-card">
                <h3>✅ Tu pedido</h3>
                <div className="seleccion-info">
                  <p>
                    <strong>Plato:</strong> {miSeleccion.nombre_plato || '—'}
                  </p>
                  <p>
                    <strong>Turno:</strong> {getTurnoAlmuerzoLabel(miSeleccion.turno_almuerzo ?? 1)}
                  </p>
                  <p>
                    <strong>Cómo te sentís:</strong> {miSeleccion.emoji_estado || '—'}
                  </p>
                  <p>
                    <strong>Registrado:</strong> {formatArgentinaTime(miSeleccion.fecha_seleccion)}
                  </p>
                </div>
                <div className="menu-pedido-acciones">
                  <button type="button" className="btn-descargar-pedido" onClick={handleDescargarPedido}>
                    📄 Descargar pedido (PDF)
                  </button>
                  {puedeSeleccionar && (
                    <button
                      className="btn-secondary"
                      onClick={handleCancelarSeleccion}
                      disabled={seleccionando}
                    >
                      Cancelar pedido
                    </button>
                  )}
                </div>
              </div>
            ) : null}

            {!miSeleccion && puedeSeleccionar ? (
              <div className="menu-seleccion-card menu-form-pedido">
                <h3>Armar tu pedido</h3>
                <p className="seleccion-subtitle">Elegí plato, turno de almuerzo y cómo te sentís (al menos 5 opciones de emoji).</p>

                <h4 className="menu-form-step">1. Plato</h4>
                <div className="menu-plato-pick">
                  {menu.platos?.map((plato) => (
                    <button
                      key={plato.id}
                      type="button"
                      className={`menu-plato-opt ${platoElegido === plato.id ? 'selected' : ''}`}
                      onClick={() => setPlatoElegido(plato.id)}
                    >
                      {plato.nombre_plato}
                    </button>
                  ))}
                </div>

                <h4 className="menu-form-step">2. Turno de almuerzo</h4>
                <div className="menu-turno-pick">
                  {MENU_TURNOS_ALMUERZO.map((t) => {
                    const otros = countEnTurno(t.id, usuario?.id)
                    const lleno = otros >= MENU_ALMUERZO_CUPO_POR_TURNO
                    return (
                      <button
                        key={t.id}
                        type="button"
                        disabled={lleno}
                        className={`menu-turno-opt ${turnoElegido === t.id ? 'selected' : ''} ${lleno ? 'disabled' : ''}`}
                        onClick={() => setTurnoElegido(t.id)}
                      >
                        <span className="menu-turno-nombre">{t.label}</span>
                        <span className="menu-turno-hora">{t.horario}</span>
                        <span className="menu-turno-cupo">
                          {otros}/{MENU_ALMUERZO_CUPO_POR_TURNO}
                        </span>
                        {lleno ? <span className="menu-turno-lleno">Completo</span> : null}
                      </button>
                    )
                  })}
                </div>

                <h4 className="menu-form-step">3. ¿Cómo te sentís hoy?</h4>
                <div className="menu-emoji-pick">
                  {MENU_EMOJIS_ESTADO.map(({ emoji, label }) => (
                    <button
                      key={emoji}
                      type="button"
                      className={`menu-emoji-opt ${emojiElegido === emoji ? 'selected' : ''}`}
                      onClick={() => setEmojiElegido(emoji)}
                      title={label}
                    >
                      <span className="menu-emoji-big">{emoji}</span>
                      <span className="menu-emoji-lbl">{label}</span>
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  className="btn-confirmar-pedido"
                  onClick={handleConfirmarPedido}
                  disabled={seleccionando}
                >
                  {seleccionando ? 'Guardando…' : 'Confirmar pedido'}
                </button>
                {seleccionando && <p className="seleccion-loading">Procesando…</p>}
              </div>
            ) : null}

            {!miSeleccion && !puedeSeleccionar ? (
              <div className="menu-seleccion-card menu-seleccion-expirada">
                <h3>⏰ Plazo vencido</h3>
                <p>
                  No registraste pedido a tiempo (hasta las {MENU_PEDIDO_HORA_TOPE_TEXTO} AM Argentina). Contactá a
                  RRHH si necesitás ayuda.
                </p>
              </div>
            ) : null}

            {miSeleccion && puedeSeleccionar ? (
              <div className="menu-seleccion-card menu-cambiar-hint">
                <p>
                  Para cambiar plato, turno o emoji, cancelá el pedido con el botón de arriba y volvé a cargarlo.
                </p>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}

export default MenuDiarioPage

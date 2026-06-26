import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import apiService from '../services/api'
import type { MenuDiario, MenuIntercambioTurno, MenuSeleccion, RrhhNovedad } from '../types/api'
import {
  getArgentinaDate,
  getArgentinaDateString,
  formatArgentinaTime,
  formatArgentinaDate,
  isBeforeArgentinaTime
} from '../utils/dateUtils'
import { findPerdidaBeneficioComidaActiva } from '../utils/rrhhNovedadDates'
import {
  MENU_TURNOS_ALMUERZO,
  MENU_ALMUERZO_CUPO_POR_TURNO,
  MENU_EMOJIS_ESTADO,
  MENU_PEDIDO_HORA_TOPE_ARG,
  MENU_PEDIDO_HORA_TOPE_TEXTO,
  MENU_DESCUENTO_PERDIDA_BENEFICIO_ARS,
  formatMenuDescuentoArs,
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
  const { usuario, nombreVisible, loading: authLoading } = useAuth()
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
  const [isMobile, setIsMobile] = useState(false)
  const [intercambios, setIntercambios] = useState<MenuIntercambioTurno[]>([])
  const [idDestinoIntercambio, setIdDestinoIntercambio] = useState<number | ''>('')
  const [swapBusy, setSwapBusy] = useState(false)
  const [turnoSoloEdit, setTurnoSoloEdit] = useState<MenuTurnoAlmuerzoId>(1)
  const [guardandoTurno, setGuardandoTurno] = useState(false)
  const [perdidaBeneficioComida, setPerdidaBeneficioComida] = useState<RrhhNovedad | null>(null)
  const [acumuladoDescuento, setAcumuladoDescuento] = useState({ cantidad: 0, total: 0 })
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    const mql = window.matchMedia('(max-width: 720px)')
    const update = () => setIsMobile(mql.matches)
    update()
    mql.addEventListener('change', update)
    return () => mql.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    setPuedeSeleccionar(
      isBeforeArgentinaTime(MENU_PEDIDO_HORA_TOPE_ARG.hour, MENU_PEDIDO_HORA_TOPE_ARG.minute)
    )
  }, [horaActual])

  useEffect(() => {
    if (miSeleccion) {
      setTurnoSoloEdit((miSeleccion.turno_almuerzo ?? 1) as MenuTurnoAlmuerzoId)
    }
  }, [miSeleccion])

  const loadSeleccionesMesa = useCallback(async (idMenu: number) => {
    const response = await apiService.obtenerSeleccionesMenu(idMenu)
    if (response.success && response.data) {
      setSeleccionesMesa(response.data)
    } else {
      setSeleccionesMesa([])
    }
  }, [])

  useEffect(() => {
    if (!menu?.id || !usuario?.id) return
    const tick = async () => {
      await loadSeleccionesMesa(menu.id)
      const r = await apiService.obtenerIntercambiosTurnoMenu(usuario.id, menu.id)
      if (r.success && r.data) setIntercambios(r.data)
      else setIntercambios([])
    }
    tick()
    const t = setInterval(tick, 20000)
    return () => clearInterval(t)
  }, [menu?.id, usuario?.id, loadSeleccionesMesa])

  const loadAcumuladoDescuento = useCallback(
    async (idUsuario: number, novedad: RrhhNovedad | null) => {
      if (!novedad) {
        setAcumuladoDescuento({ cantidad: 0, total: 0 })
        return
      }
      const res = await apiService.menuDescuentosBeneficioAcumulado({
        idUsuario,
        idNovedad: novedad.id,
        fechaDesde: novedad.fecha_desde,
        fechaHasta: novedad.fecha_hasta
      })
      if (res.success && res.data) {
        setAcumuladoDescuento(res.data)
      } else {
        setAcumuladoDescuento({ cantidad: 0, total: 0 })
      }
    },
    []
  )

  const loadPerdidaBeneficioComida = useCallback(
    async (idUsuario: number) => {
      const hoy = getArgentinaDateString()
      const res = await apiService.rrhhNovedadesListar({
        idUsuario,
        grupo: 'beneficio_comida',
        codigo: 'perdida_beneficio_comida',
        fechaDesde: hoy,
        fechaHasta: hoy
      })
      const activa =
        res.success && res.data?.length
          ? findPerdidaBeneficioComidaActiva(res.data, idUsuario, hoy)
          : null
      setPerdidaBeneficioComida(activa)
      await loadAcumuladoDescuento(idUsuario, activa)
    },
    [loadAcumuladoDescuento]
  )

  const refreshMenuData = useCallback(
    async (opts?: { pantallaCompleta?: boolean }) => {
      if (!usuario?.id) return
      if (opts?.pantallaCompleta) setLoading(true)
      try {
        const response = await apiService.obtenerMenuDiaActual()
        if (response.success && response.data) {
          setMenu(response.data)
        } else {
          setMenu(null)
          setSeleccionesMesa([])
          setMiSeleccion(null)
        }
        if (opts?.pantallaCompleta) setLoading(false)

        if (response.success && response.data) {
          void Promise.all([
            loadMiSeleccion(response.data.id, usuario.id),
            loadSeleccionesMesa(response.data.id),
            loadPerdidaBeneficioComida(usuario.id)
          ])
        } else {
          void loadPerdidaBeneficioComida(usuario.id)
        }
      } catch (error) {
        console.error('Error cargando menú:', error)
        if (opts?.pantallaCompleta) setLoading(false)
      }
    },
    [usuario?.id, loadPerdidaBeneficioComida, loadSeleccionesMesa]
  )

  const loadMenu = useCallback(() => refreshMenuData({ pantallaCompleta: true }), [refreshMenuData])

  useEffect(() => {
    if (authLoading && !usuario) return
    if (!usuario) {
      navigate('/')
      return
    }
    void loadMenu()
    const interval = setInterval(() => {
      setHoraActual(getArgentinaDate())
    }, 60000)
    return () => clearInterval(interval)
  }, [authLoading, usuario, navigate, loadMenu])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3500)
    return () => clearTimeout(t)
  }, [toast])

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
    if (perdidaBeneficioComida && !miSeleccion) {
      const nuevoTotal = acumuladoDescuento.total + MENU_DESCUENTO_PERDIDA_BENEFICIO_ARS
      const ok = confirm(
        `Tenés registrada la pérdida del beneficio de comida (hasta el ${perdidaBeneficioComida.fecha_hasta}).\n\n` +
          `Este pedido se descontará ${formatMenuDescuentoArs(MENU_DESCUENTO_PERDIDA_BENEFICIO_ARS)} de tu sueldo.\n` +
          `Acumulado en el período: ${formatMenuDescuentoArs(nuevoTotal)} (${acumuladoDescuento.cantidad + 1} pedido${acumuladoDescuento.cantidad + 1 === 1 ? '' : 's'}).\n\n` +
          `¿Confirmás el pedido?`
      )
      if (!ok) return
    }
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
        let msg = miSeleccion ? 'Pedido actualizado' : 'Pedido registrado correctamente'
        if (perdidaBeneficioComida) {
          const platoNom =
            menu.platos?.find((p) => p.id === platoElegido)?.nombre_plato ?? response.data.nombre_plato
          const desc = await apiService.menuDescuentoBeneficioRegistrar({
            id_usuario: usuario.id,
            id_menu: menu.id,
            id_seleccion: response.data.id,
            id_novedad: perdidaBeneficioComida.id,
            fecha: menu.fecha,
            nombre_plato: platoNom ?? null
          })
          if (!desc.success) {
            msg = `Pedido guardado, pero no se pudo registrar el descuento: ${desc.error ?? 'error desconocido'}. Avisá a RRHH.`
          } else {
            msg = miSeleccion
              ? `Pedido actualizado. Descuento: ${formatMenuDescuentoArs(MENU_DESCUENTO_PERDIDA_BENEFICIO_ARS)} por pedido.`
              : `Pedido registrado. Se descontarán ${formatMenuDescuentoArs(MENU_DESCUENTO_PERDIDA_BENEFICIO_ARS)} de tu sueldo.`
          }
        }
        setToast(msg)
        if (perdidaBeneficioComida) {
          await loadAcumuladoDescuento(usuario.id, perdidaBeneficioComida)
        }
        await refreshMenuData()
      } else {
        alert('Error: ' + response.error)
      }
    } catch (error: unknown) {
      alert('Error: ' + (error instanceof Error ? error.message : 'Error al confirmar'))
    } finally {
      setSeleccionando(false)
    }
  }

  const handleGuardarSoloTurno = async () => {
    if (!usuario?.id || !menu || !miSeleccion) return
    if (turnoSoloEdit === (miSeleccion.turno_almuerzo ?? 1)) {
      alert('Ya estás en ese turno.')
      return
    }
    const otros = countEnTurno(turnoSoloEdit, usuario.id)
    if (otros >= MENU_ALMUERZO_CUPO_POR_TURNO) {
      alert('Ese turno ya está completo (10 lugares). Elegí otro horario.')
      return
    }
    const prevSeleccion = miSeleccion
    const prevMesa = seleccionesMesa
    setMiSeleccion({ ...miSeleccion, turno_almuerzo: turnoSoloEdit })
    setSeleccionesMesa((prev) =>
      prev.map((s) =>
        s.id_usuario === usuario.id ? { ...s, turno_almuerzo: turnoSoloEdit } : s
      )
    )
    setGuardandoTurno(true)
    try {
      const response = await apiService.actualizarSoloTurnoMenu(menu.id, usuario.id, turnoSoloEdit)
      if (response.success && response.data) {
        setMiSeleccion(response.data)
        setToast('Turno de almuerzo actualizado')
        void loadSeleccionesMesa(menu.id)
      } else {
        setMiSeleccion(prevSeleccion)
        setSeleccionesMesa(prevMesa)
        alert('Error: ' + (response.error || 'No se pudo guardar'))
      }
    } catch (error: unknown) {
      setMiSeleccion(prevSeleccion)
      setSeleccionesMesa(prevMesa)
      alert('Error: ' + (error instanceof Error ? error.message : 'Error al guardar'))
    } finally {
      setGuardandoTurno(false)
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

    const idSeleccion = miSeleccion.id
    const response = await apiService.cancelarSeleccionMenu(menu.id, usuario.id)
    if (response.success) {
      await apiService.menuDescuentoBeneficioEliminarPorSeleccion(idSeleccion)
      setMiSeleccion(null)
      setPlatoElegido(null)
      setTurnoElegido(null)
      setEmojiElegido(null)
      setToast('Pedido cancelado')
      void refreshMenuData()
    } else {
      alert('Error: ' + response.error)
    }
  }

  const compañerosConPedido = seleccionesMesa.filter((s) => {
    if (!usuario || s.id_usuario === usuario.id) return false
    if (!miSeleccion) return true
    return (s.turno_almuerzo ?? 1) !== (miSeleccion.turno_almuerzo ?? 1)
  })

  const handleSolicitarIntercambio = async () => {
    if (!usuario?.id || !menu || miSeleccion == null || idDestinoIntercambio === '') return
    setSwapBusy(true)
    try {
      const r = await apiService.solicitarIntercambioTurnoMenu(menu.id, usuario.id, Number(idDestinoIntercambio))
      if (r.success) {
        alert('Solicitud enviada. Tu compañero puede aceptarla cuando quiera.')
        setIdDestinoIntercambio('')
        const ri = await apiService.obtenerIntercambiosTurnoMenu(usuario.id, menu.id)
        if (ri.success && ri.data) setIntercambios(ri.data)
      } else {
        alert(r.error || 'No se pudo enviar la solicitud')
      }
    } finally {
      setSwapBusy(false)
    }
  }

  const handleResponderIntercambio = async (
    idIntercambio: number,
    accion: 'aceptar' | 'rechazar' | 'cancelar'
  ) => {
    if (!usuario?.id || !menu) return
    if (accion === 'aceptar' && !confirm('¿Confirmás el intercambio de turno de almuerzo?')) return
    if (accion === 'rechazar' && !confirm('¿Rechazar esta solicitud?')) return
    if (accion === 'cancelar' && !confirm('¿Cancelar tu solicitud de intercambio?')) return
    setSwapBusy(true)
    try {
      const r = await apiService.responderIntercambioTurnoMenu(idIntercambio, usuario.id, accion)
      if (r.success) {
        if (accion === 'aceptar') alert('Listo: los turnos ya se intercambiaron.')
        const ri = await apiService.obtenerIntercambiosTurnoMenu(usuario.id, menu.id)
        if (ri.success && ri.data) setIntercambios(ri.data)
        await loadMiSeleccion(menu.id, usuario.id)
        await loadSeleccionesMesa(menu.id)
      } else {
        alert(r.error || 'No se pudo procesar la solicitud')
      }
    } finally {
      setSwapBusy(false)
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
    doc.text(`Empleado/a: ${nombreVisible}`, m, y)
    y += 7
    doc.text(`Plato: ${miSeleccion.nombre_plato || '—'}`, m, y)
    y += 7
    doc.text(`Turno almuerzo: ${getTurnoAlmuerzoLabel(miSeleccion.turno_almuerzo ?? 1)}`, m, y)
    y += 7
    doc.text(`Cómo te sentís: ${miSeleccion.emoji_estado || '—'}`, m, y)
    y += 7
    doc.text(`Registrado: ${formatArgentinaTime(miSeleccion.fecha_seleccion)}`, m, y)

    doc.save(`pedido-menu-${menu.fecha}-${nombreVisible.replace(/\s+/g, '-')}.pdf`)
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

  const incomingSwap = usuario ? intercambios.filter((i) => i.id_destino === usuario.id) : []
  const outgoingSwap = usuario ? intercambios.filter((i) => i.id_solicita === usuario.id) : []

  return (
    <div className="menu-diario-page">
      <div className="menu-diario-header">
        <h1>🍽️ Menú Diario</h1>
        {!isMobile && (
          <button className="btn-back" onClick={() => navigate('/')}>
            ← Volver al Tablero
          </button>
        )}
      </div>

      <div className="menu-diario-content">
        {toast ? (
          <div className="menu-diario-toast" role="status">
            {toast}
          </div>
        ) : null}

        {perdidaBeneficioComida ? (
          <div className="menu-beneficio-aviso" role="alert">
            <strong>⚠️ Pérdida del beneficio de comida</strong>
            <p>
              RRHH registró la sanción desde el{' '}
              <strong>{formatArgentinaDate(perdidaBeneficioComida.fecha_desde)}</strong> hasta el{' '}
              <strong>{formatArgentinaDate(perdidaBeneficioComida.fecha_hasta)}</strong>
              {perdidaBeneficioComida.observaciones ? <> — {perdidaBeneficioComida.observaciones}</> : null}.
            </p>
            <p>
              Si pedís comida, cada pedido se descontará{' '}
              <strong>{formatMenuDescuentoArs(MENU_DESCUENTO_PERDIDA_BENEFICIO_ARS)}</strong> de tu sueldo.
            </p>
            <p className="menu-beneficio-acumulado">
              Acumulado en este período:{' '}
              <strong>{formatMenuDescuentoArs(acumuladoDescuento.total)}</strong>
              {' '}({acumuladoDescuento.cantidad} pedido{acumuladoDescuento.cantidad === 1 ? '' : 's'})
            </p>
          </div>
        ) : null}

        <div className="menu-horario-info">
          <div className={`horario-badge ${puedeSeleccionar ? 'horario-activo' : 'horario-expirado'}`}>
            {puedeSeleccionar ? (
              <>
                ⏰ Hora actual (Argentina): {horaFormateada} — Pedido y cancelación del plato hasta las{' '}
                {MENU_PEDIDO_HORA_TOPE_TEXTO} AM. El turno de almuerzo podés cambiarlo cuando quieras (sin tope).
              </>
            ) : (
              <>
                ⏰ Hora actual (Argentina): {horaFormateada} — El plazo para elegir o cancelar el pedido del plato
                cerró ({MENU_PEDIDO_HORA_TOPE_TEXTO} AM). El turno de almuerzo sigue editable abajo.
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

            {!isMobile && (
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
            )}

            {miSeleccion && !puedeSeleccionar ? (
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
                  {!isMobile && (
                    <button type="button" className="btn-descargar-pedido" onClick={handleDescargarPedido}>
                      📄 Descargar pedido (PDF)
                    </button>
                  )}
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

            {miSeleccion && usuario && menu && !puedeSeleccionar ? (
              <div className="menu-seleccion-card menu-turno-libre-card">
                <h3>🕐 Cambiar turno de almuerzo</h3>
                <p className="seleccion-subtitle">
                  Sin límite de horario: podés moverte de turno cuando quieras. El plato solo se puede elegir o
                  cancelar hasta las {MENU_PEDIDO_HORA_TOPE_TEXTO} AM (Argentina).
                </p>
                <div className="menu-turno-pick">
                  {MENU_TURNOS_ALMUERZO.map((t) => {
                    const otros = countEnTurno(t.id, usuario.id)
                    const lleno = otros >= MENU_ALMUERZO_CUPO_POR_TURNO
                    return (
                      <button
                        key={t.id}
                        type="button"
                        disabled={lleno}
                        className={`menu-turno-opt ${turnoSoloEdit === t.id ? 'selected' : ''} ${lleno ? 'disabled' : ''}`}
                        onClick={() => setTurnoSoloEdit(t.id)}
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
                <button
                  type="button"
                  className="btn-confirmar-pedido"
                  onClick={handleGuardarSoloTurno}
                  disabled={
                    guardandoTurno ||
                    turnoSoloEdit === (miSeleccion.turno_almuerzo ?? 1) ||
                    countEnTurno(turnoSoloEdit, usuario.id) >= MENU_ALMUERZO_CUPO_POR_TURNO
                  }
                >
                  {guardandoTurno ? 'Guardando…' : 'Guardar turno'}
                </button>
              </div>
            ) : null}

            {menu && usuario ? (
              <div className="menu-intercambio-card">
                <h3>🔁 Intercambio de turno de almuerzo</h3>
                <p className="menu-intercambio-desc">
                  Podés pedirle a un compañero que ya tiene pedido que intercambien turnos en <strong>cualquier hora</strong>.
                  Cuando la otra persona acepta, los turnos se actualizan solos (no hace falta cancelar y volver a pedir).
                </p>

                {incomingSwap.length > 0 ? (
                  <div className="menu-intercambio-bloque">
                    <h4>Te solicitaron intercambio</h4>
                    <ul className="menu-intercambio-lista">
                      {incomingSwap.map((it) => (
                        <li key={it.id} className="menu-intercambio-item">
                          <span>
                            <strong>{it.nombre_solicita || 'Compañero/a'}</strong> quiere intercambiar turno contigo.
                          </span>
                          <span className="menu-intercambio-acciones">
                            <button
                              type="button"
                              className="btn-intercambio-ok"
                              disabled={swapBusy}
                              onClick={() => handleResponderIntercambio(it.id, 'aceptar')}
                            >
                              Aceptar
                            </button>
                            <button
                              type="button"
                              className="btn-intercambio-no"
                              disabled={swapBusy}
                              onClick={() => handleResponderIntercambio(it.id, 'rechazar')}
                            >
                              Rechazar
                            </button>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {outgoingSwap.length > 0 ? (
                  <div className="menu-intercambio-bloque">
                    <h4>Tus solicitudes pendientes</h4>
                    <ul className="menu-intercambio-lista">
                      {outgoingSwap.map((it) => (
                        <li key={it.id} className="menu-intercambio-item">
                          <span>
                            Esperando respuesta de <strong>{it.nombre_destino || 'compañero/a'}</strong>
                          </span>
                          <button
                            type="button"
                            className="btn-intercambio-cancel"
                            disabled={swapBusy}
                            onClick={() => handleResponderIntercambio(it.id, 'cancelar')}
                          >
                            Cancelar solicitud
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {miSeleccion ? (
                  <div className="menu-intercambio-solicitar">
                    <label htmlFor="menu-swap-destino">Pedir intercambio con</label>
                    <div className="menu-intercambio-row">
                      <select
                        id="menu-swap-destino"
                        value={idDestinoIntercambio === '' ? '' : String(idDestinoIntercambio)}
                        onChange={(e) =>
                          setIdDestinoIntercambio(e.target.value === '' ? '' : Number(e.target.value))
                        }
                        disabled={swapBusy || compañerosConPedido.length === 0}
                      >
                        <option value="">Elegí compañero/a con pedido…</option>
                        {compañerosConPedido.map((s) => (
                          <option key={s.id_usuario} value={s.id_usuario}>
                            {s.nombre_usuario || `Usuario ${s.id_usuario}`} —{' '}
                            {getTurnoAlmuerzoLabel(s.turno_almuerzo ?? 1)}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="btn-intercambio-enviar"
                        disabled={
                          swapBusy || idDestinoIntercambio === '' || compañerosConPedido.length === 0
                        }
                        onClick={handleSolicitarIntercambio}
                      >
                        {swapBusy ? '…' : 'Enviar solicitud'}
                      </button>
                    </div>
                    {compañerosConPedido.length === 0 ? (
                      <p className="menu-intercambio-hint">No hay otros compañeros con pedido para hoy.</p>
                    ) : null}
                  </div>
                ) : (
                  <p className="menu-intercambio-hint">
                    Para solicitar intercambio necesitás tener tu pedido del menú cargado.
                  </p>
                )}
              </div>
            ) : null}

            {puedeSeleccionar ? (
              <div className="menu-seleccion-card menu-form-pedido">
                <h3>{miSeleccion ? 'Cambiar pedido' : 'Armar tu pedido'}</h3>
                <p className="seleccion-subtitle">
                  {miSeleccion
                    ? 'Modificá plato, turno o emoji y guardá. No hace falta cancelar el pedido.'
                    : 'Elegí plato, turno de almuerzo y cómo te sentís (al menos 5 opciones de emoji).'}
                </p>
                {miSeleccion ? (
                  <p className="menu-pedido-actual">
                    Pedido actual: <strong>{miSeleccion.nombre_plato}</strong> ·{' '}
                    {getTurnoAlmuerzoLabel(miSeleccion.turno_almuerzo ?? 1)} · {miSeleccion.emoji_estado}
                  </p>
                ) : null}

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
                  disabled={
                    seleccionando ||
                    platoElegido == null ||
                    turnoElegido == null ||
                    !emojiElegido
                  }
                >
                  {seleccionando ? 'Guardando…' : miSeleccion ? 'Guardar cambios' : 'Confirmar pedido'}
                </button>
                {seleccionando && <p className="seleccion-loading">Procesando…</p>}
                {miSeleccion ? (
                  <div className="menu-pedido-acciones menu-pedido-acciones--form">
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={handleCancelarSeleccion}
                      disabled={seleccionando}
                    >
                      Cancelar pedido
                    </button>
                    {!isMobile ? (
                      <button type="button" className="btn-descargar-pedido" onClick={handleDescargarPedido}>
                        📄 Descargar pedido (PDF)
                      </button>
                    ) : null}
                  </div>
                ) : null}
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

            {miSeleccion && !puedeSeleccionar ? (
              <div className="menu-seleccion-card menu-cambiar-hint">
                <p>
                  Ya no podés cancelar ni cambiar plato ni emoji. Podés seguir cambiando solo el turno de almuerzo en la
                  sección de arriba.
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

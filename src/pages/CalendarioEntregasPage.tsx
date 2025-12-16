import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import apiService from '../services/api'
import type { PedidoCompra } from '../types/pedidos'
import './CalendarioEntregasPage.css'

const CalendarioEntregasPage = () => {
  const navigate = useNavigate()
  const { canManageCompras, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [pedidos, setPedidos] = useState<PedidoCompra[]>([])
  const [fechaSeleccionada, setFechaSeleccionada] = useState<Date>(new Date())
  const [vista, setVista] = useState<'mes' | 'semana' | 'dia'>('mes')
  const [entregasAtrasadas, setEntregasAtrasadas] = useState<PedidoCompra[]>([])
  const [entregasProximas, setEntregasProximas] = useState<PedidoCompra[]>([])

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
      const response = await apiService.getPedidosCompra({ estado: 'Aprobado' })
      if (response.success && response.data) {
        const pedidosConEntrega = response.data.filter(p => p.fecha_entrega_estimada)
        setPedidos(pedidosConEntrega)
        
        // Filtrar entregas atrasadas
        const ahora = new Date()
        ahora.setHours(0, 0, 0, 0)
        const atrasadas = pedidosConEntrega.filter(p => {
          if (!p.fecha_entrega_estimada) return false
          const fechaEntrega = new Date(p.fecha_entrega_estimada)
          fechaEntrega.setHours(0, 0, 0, 0)
          return fechaEntrega < ahora && p.estado !== 'Completado'
        })
        setEntregasAtrasadas(atrasadas)

        // Filtrar entregas próximas (próximos 7 días)
        const en7Dias = new Date()
        en7Dias.setDate(en7Dias.getDate() + 7)
        en7Dias.setHours(23, 59, 59, 999)
        const proximas = pedidosConEntrega.filter(p => {
          if (!p.fecha_entrega_estimada) return false
          const fechaEntrega = new Date(p.fecha_entrega_estimada)
          return fechaEntrega >= ahora && fechaEntrega <= en7Dias && p.estado !== 'Completado'
        })
        setEntregasProximas(proximas)
      }
    } catch (error) {
      console.error('Error cargando pedidos:', error)
    } finally {
      setLoading(false)
    }
  }

  const getEntregasPorFecha = (fecha: Date) => {
    const fechaStr = fecha.toISOString().split('T')[0]
    return pedidos.filter(p => {
      if (!p.fecha_entrega_estimada) return false
      const fechaEntrega = new Date(p.fecha_entrega_estimada)
      fechaEntrega.setHours(0, 0, 0, 0)
      const fechaComparar = new Date(fechaStr)
      fechaComparar.setHours(0, 0, 0, 0)
      return fechaEntrega.getTime() === fechaComparar.getTime()
    })
  }

  const getDiasRestantes = (fechaEntrega: string) => {
    const ahora = new Date()
    ahora.setHours(0, 0, 0, 0)
    const entrega = new Date(fechaEntrega)
    entrega.setHours(0, 0, 0, 0)
    const diff = Math.floor((entrega.getTime() - ahora.getTime()) / (1000 * 60 * 60 * 24))
    return diff
  }

  const getDiasAtrasados = (fechaEntrega: string) => {
    const ahora = new Date()
    ahora.setHours(0, 0, 0, 0)
    const entrega = new Date(fechaEntrega)
    entrega.setHours(0, 0, 0, 0)
    const diff = Math.floor((ahora.getTime() - entrega.getTime()) / (1000 * 60 * 60 * 24))
    return diff
  }

  const renderCalendarioMes = () => {
    const año = fechaSeleccionada.getFullYear()
    const mes = fechaSeleccionada.getMonth()
    const primerDia = new Date(año, mes, 1)
    const ultimoDia = new Date(año, mes + 1, 0)
    const primerDiaSemana = primerDia.getDay()
    const diasEnMes = ultimoDia.getDate()
    
    const dias = []
    const diasSemana = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
    
    // Días del mes anterior
    const mesAnterior = new Date(año, mes - 1, 0)
    const diasMesAnterior = mesAnterior.getDate()
    for (let i = primerDiaSemana - 1; i >= 0; i--) {
      dias.push({
        fecha: new Date(año, mes - 1, diasMesAnterior - i),
        esMesActual: false
      })
    }
    
    // Días del mes actual
    for (let i = 1; i <= diasEnMes; i++) {
      dias.push({
        fecha: new Date(año, mes, i),
        esMesActual: true
      })
    }
    
    // Completar semana
    const diasRestantes = 42 - dias.length
    for (let i = 1; i <= diasRestantes; i++) {
      dias.push({
        fecha: new Date(año, mes + 1, i),
        esMesActual: false
      })
    }

    return (
      <div className="calendario-mes">
        <div className="calendario-header">
          {diasSemana.map(dia => (
            <div key={dia} className="dia-semana-header">{dia}</div>
          ))}
        </div>
        <div className="calendario-grid">
          {dias.map((dia, idx) => {
            const entregas = getEntregasPorFecha(dia.fecha)
            const esHoy = dia.fecha.toDateString() === new Date().toDateString()
            const esAtrasado = entregas.some(e => {
              if (!e.fecha_entrega_estimada) return false
              const fechaEntrega = new Date(e.fecha_entrega_estimada)
              fechaEntrega.setHours(0, 0, 0, 0)
              return fechaEntrega < new Date() && e.estado !== 'Completado'
            })

            return (
              <div
                key={idx}
                className={`dia-calendario ${!dia.esMesActual ? 'otro-mes' : ''} ${esHoy ? 'hoy' : ''} ${esAtrasado ? 'atrasado' : ''}`}
                onClick={() => setFechaSeleccionada(dia.fecha)}
              >
                <div className="dia-numero">{dia.fecha.getDate()}</div>
                {entregas.length > 0 && (
                  <div className="entregas-indicador">
                    <span className="entregas-count">{entregas.length}</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const renderVistaSemana = () => {
    const inicioSemana = new Date(fechaSeleccionada)
    inicioSemana.setDate(fechaSeleccionada.getDate() - fechaSeleccionada.getDay())
    inicioSemana.setHours(0, 0, 0, 0)

    const diasSemana = []
    for (let i = 0; i < 7; i++) {
      const fecha = new Date(inicioSemana)
      fecha.setDate(inicioSemana.getDate() + i)
      diasSemana.push(fecha)
    }

    return (
      <div className="vista-semana">
        {diasSemana.map((dia, idx) => {
          const entregas = getEntregasPorFecha(dia)
          const esHoy = dia.toDateString() === new Date().toDateString()
          const esAtrasado = entregas.some(e => {
            if (!e.fecha_entrega_estimada) return false
            const fechaEntrega = new Date(e.fecha_entrega_estimada)
            fechaEntrega.setHours(0, 0, 0, 0)
            return fechaEntrega < new Date() && e.estado !== 'Completado'
          })

          return (
            <div key={idx} className={`dia-semana-card ${esHoy ? 'hoy' : ''} ${esAtrasado ? 'atrasado' : ''}`}>
              <div className="dia-semana-header-card">
                <div className="dia-nombre">{dia.toLocaleDateString('es-AR', { weekday: 'long' })}</div>
                <div className="dia-fecha">{dia.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}</div>
              </div>
              <div className="entregas-lista">
                {entregas.length === 0 ? (
                  <div className="sin-entregas">Sin entregas programadas</div>
                ) : (
                  entregas.map(entrega => (
                    <div
                      key={entrega.id}
                      className="entrega-item"
                      onClick={() => navigate(`/compras/pedidos/${entrega.id}`)}
                    >
                      <div className="entrega-numero">{entrega.numero_pedido}</div>
                      <div className="entrega-info">
                        <div>{entrega.nombre_solicitante}</div>
                        {entrega.fecha_entrega_estimada && (
                          <div className="entrega-tiempo">
                            {getDiasRestantes(entrega.fecha_entrega_estimada) < 0 ? (
                              <span className="atrasado-text">
                                {getDiasAtrasados(entrega.fecha_entrega_estimada)} día(s) atrasado
                              </span>
                            ) : getDiasRestantes(entrega.fecha_entrega_estimada) === 0 ? (
                              <span className="hoy-text">Hoy</span>
                            ) : (
                              <span>{getDiasRestantes(entrega.fecha_entrega_estimada)} día(s)</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  const renderVistaDia = () => {
    const entregas = getEntregasPorFecha(fechaSeleccionada)
    const esHoy = fechaSeleccionada.toDateString() === new Date().toDateString()
    const esAtrasado = entregas.some(e => {
      if (!e.fecha_entrega_estimada) return false
      const fechaEntrega = new Date(e.fecha_entrega_estimada)
      fechaEntrega.setHours(0, 0, 0, 0)
      return fechaEntrega < new Date() && e.estado !== 'Completado'
    })

    return (
      <div className={`vista-dia ${esHoy ? 'hoy' : ''} ${esAtrasado ? 'atrasado' : ''}`}>
        <div className="dia-header">
          <h2>{fechaSeleccionada.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</h2>
          {esAtrasado && <span className="badge-atrasado">⚠️ Entregas Atrasadas</span>}
        </div>
        <div className="entregas-lista-detalle">
          {entregas.length === 0 ? (
            <div className="sin-entregas">No hay entregas programadas para este día</div>
          ) : (
            entregas.map(entrega => (
              <div
                key={entrega.id}
                className="entrega-card-detalle"
                onClick={() => navigate(`/compras/pedidos/${entrega.id}`)}
              >
                <div className="entrega-header-detalle">
                  <div className="entrega-numero-detalle">{entrega.numero_pedido}</div>
                  <div className={`entrega-estado estado-${entrega.estado.toLowerCase().replace(' ', '-')}`}>
                    {entrega.estado}
                  </div>
                </div>
                <div className="entrega-info-detalle">
                  <div className="info-item-detalle">
                    <span className="label">Solicitante:</span>
                    <span>{entrega.nombre_solicitante}</span>
                  </div>
                  {entrega.sector_solicitante && (
                    <div className="info-item-detalle">
                      <span className="label">Sector:</span>
                      <span>{entrega.sector_solicitante}</span>
                    </div>
                  )}
                  {entrega.fecha_entrega_estimada && (
                    <div className="info-item-detalle">
                      <span className="label">Fecha Entrega:</span>
                      <span>{new Date(entrega.fecha_entrega_estimada).toLocaleDateString('es-AR')}</span>
                    </div>
                  )}
                  {entrega.items && (
                    <div className="info-item-detalle">
                      <span className="label">Items:</span>
                      <span>{entrega.items.length}</span>
                    </div>
                  )}
                </div>
                {entrega.fecha_entrega_estimada && getDiasRestantes(entrega.fecha_entrega_estimada) < 0 && (
                  <div className="alerta-atrasado">
                    ⚠️ Esta entrega está {getDiasAtrasados(entrega.fecha_entrega_estimada)} día(s) atrasada
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    )
  }

  if (authLoading || loading) {
    return (
      <div className="calendario-entregas-page">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Cargando...</p>
        </div>
      </div>
    )
  }

  if (!canManageCompras) {
    return (
      <div className="calendario-entregas-page">
        <div className="error-container">
          <p>No tienes permiso para acceder a esta página.</p>
          <button className="btn-primary" onClick={() => navigate('/compras/dashboard')}>
            Volver al Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="calendario-entregas-page">
      <header className="page-header">
        <div className="header-content">
          <div>
            <h1>📅 Calendario de Entregas</h1>
            <p className="subtitle">Planificación y seguimiento de entregas</p>
          </div>
          <div className="header-actions">
            <button className="btn-secondary" onClick={() => navigate('/compras/dashboard')}>
              ← Volver
            </button>
          </div>
        </div>
      </header>

      {/* Alertas de Entregas Atrasadas */}
      {entregasAtrasadas.length > 0 && (
        <section className="alertas-section">
          <h2>⚠️ Entregas Atrasadas ({entregasAtrasadas.length})</h2>
          <div className="entregas-grid-alerta">
            {entregasAtrasadas.map(entrega => (
              <div
                key={entrega.id}
                className="entrega-alerta-card"
                onClick={() => navigate(`/compras/pedidos/${entrega.id}`)}
              >
                <div className="alerta-header-card">
                  <strong>{entrega.numero_pedido}</strong>
                  {entrega.fecha_entrega_estimada && (
                    <span className="dias-atrasado">
                      {getDiasAtrasados(entrega.fecha_entrega_estimada)} día(s)
                    </span>
                  )}
                </div>
                <div className="alerta-info">
                  <div>{entrega.nombre_solicitante}</div>
                  {entrega.fecha_entrega_estimada && (
                    <div className="fecha-estimada">
                      Estimada: {new Date(entrega.fecha_entrega_estimada).toLocaleDateString('es-AR')}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Entregas Próximas */}
      {entregasProximas.length > 0 && (
        <section className="proximas-section">
          <h2>📌 Entregas Próximas (7 días)</h2>
          <div className="entregas-grid-alerta">
            {entregasProximas.map(entrega => (
              <div
                key={entrega.id}
                className="entrega-proxima-card"
                onClick={() => navigate(`/compras/pedidos/${entrega.id}`)}
              >
                <div className="proxima-header-card">
                  <strong>{entrega.numero_pedido}</strong>
                  {entrega.fecha_entrega_estimada && (
                    <span className="dias-restantes">
                      {getDiasRestantes(entrega.fecha_entrega_estimada) === 0 ? 'Hoy' : `${getDiasRestantes(entrega.fecha_entrega_estimada)} día(s)`}
                    </span>
                  )}
                </div>
                <div className="proxima-info">
                  <div>{entrega.nombre_solicitante}</div>
                  {entrega.fecha_entrega_estimada && (
                    <div className="fecha-estimada">
                      {new Date(entrega.fecha_entrega_estimada).toLocaleDateString('es-AR')}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Controles de Vista */}
      <section className="controles-section">
        <div className="controles-fecha">
          <button
            className="btn-nav"
            onClick={() => {
              const nuevaFecha = new Date(fechaSeleccionada)
              if (vista === 'mes') {
                nuevaFecha.setMonth(nuevaFecha.getMonth() - 1)
              } else if (vista === 'semana') {
                nuevaFecha.setDate(nuevaFecha.getDate() - 7)
              } else {
                nuevaFecha.setDate(nuevaFecha.getDate() - 1)
              }
              setFechaSeleccionada(nuevaFecha)
            }}
          >
            ← Anterior
          </button>
          <div className="fecha-actual">
            {vista === 'mes' && fechaSeleccionada.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}
            {vista === 'semana' && `Semana del ${fechaSeleccionada.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}`}
            {vista === 'dia' && fechaSeleccionada.toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
          <button
            className="btn-nav"
            onClick={() => {
              const nuevaFecha = new Date(fechaSeleccionada)
              if (vista === 'mes') {
                nuevaFecha.setMonth(nuevaFecha.getMonth() + 1)
              } else if (vista === 'semana') {
                nuevaFecha.setDate(nuevaFecha.getDate() + 7)
              } else {
                nuevaFecha.setDate(nuevaFecha.getDate() + 1)
              }
              setFechaSeleccionada(nuevaFecha)
            }}
          >
            Siguiente →
          </button>
          <button className="btn-hoy" onClick={() => setFechaSeleccionada(new Date())}>
            Hoy
          </button>
        </div>
        <div className="controles-vista">
          <button
            className={`btn-vista ${vista === 'mes' ? 'active' : ''}`}
            onClick={() => setVista('mes')}
          >
            Mes
          </button>
          <button
            className={`btn-vista ${vista === 'semana' ? 'active' : ''}`}
            onClick={() => setVista('semana')}
          >
            Semana
          </button>
          <button
            className={`btn-vista ${vista === 'dia' ? 'active' : ''}`}
            onClick={() => setVista('dia')}
          >
            Día
          </button>
        </div>
      </section>

      {/* Vista del Calendario */}
      <section className="calendario-section">
        {vista === 'mes' && renderCalendarioMes()}
        {vista === 'semana' && renderVistaSemana()}
        {vista === 'dia' && renderVistaDia()}
      </section>
    </div>
  )
}

export default CalendarioEntregasPage

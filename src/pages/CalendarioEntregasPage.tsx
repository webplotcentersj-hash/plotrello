import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import apiService from '../services/api'
import type { OrdenTrabajo } from '../types/api'
import './CalendarioEntregasPage.css'

const CalendarioEntregasPage = () => {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [ordenes, setOrdenes] = useState<OrdenTrabajo[]>([])
  const [fechaSeleccionada, setFechaSeleccionada] = useState<Date>(new Date())
  const [vista, setVista] = useState<'mes' | 'semana' | 'dia'>('mes')

  useEffect(() => {
    loadOrdenes()
  }, [])

  const loadOrdenes = async () => {
    setLoading(true)
    try {
      const response = await apiService.getOrdenes()
      if (response.success && response.data) {
        setOrdenes(response.data)
      }
    } catch (error) {
      console.error('Error cargando órdenes:', error)
    } finally {
      setLoading(false)
    }
  }

  const ordenesConFechaEntrega = ordenes.filter(
    (orden) => orden.fecha_entrega && orden.estado !== 'Entregado o Instalado'
  )

  const getOrdenesPorFecha = (fecha: Date) => {
    const fechaStr = fecha.toISOString().split('T')[0]
    return ordenesConFechaEntrega.filter((orden) => {
      if (!orden.fecha_entrega) return false
      const ordenFecha = new Date(orden.fecha_entrega).toISOString().split('T')[0]
      return ordenFecha === fechaStr
    })
  }

  const getDiasDelMes = () => {
    const year = fechaSeleccionada.getFullYear()
    const month = fechaSeleccionada.getMonth()
    const primerDia = new Date(year, month, 1)
    const ultimoDia = new Date(year, month + 1, 0)
    const diasEnMes = ultimoDia.getDate()
    const diaInicioSemana = primerDia.getDay()

    const dias: Date[] = []
    
    // Días del mes anterior para completar la semana
    for (let i = diaInicioSemana - 1; i >= 0; i--) {
      const fecha = new Date(year, month, -i)
      dias.push(fecha)
    }
    
    // Días del mes actual
    for (let i = 1; i <= diasEnMes; i++) {
      dias.push(new Date(year, month, i))
    }
    
    // Días del mes siguiente para completar la semana
    const diasRestantes = 42 - dias.length
    for (let i = 1; i <= diasRestantes; i++) {
      dias.push(new Date(year, month + 1, i))
    }

    return dias
  }

  const getSemanasDelMes = () => {
    const dias = getDiasDelMes()
    const semanas: Date[][] = []
    for (let i = 0; i < dias.length; i += 7) {
      semanas.push(dias.slice(i, i + 7))
    }
    return semanas
  }

  const cambiarMes = (direccion: number) => {
    const nuevaFecha = new Date(fechaSeleccionada)
    nuevaFecha.setMonth(nuevaFecha.getMonth() + direccion)
    setFechaSeleccionada(nuevaFecha)
  }

  const esHoy = (fecha: Date) => {
    const hoy = new Date()
    return (
      fecha.getDate() === hoy.getDate() &&
      fecha.getMonth() === hoy.getMonth() &&
      fecha.getFullYear() === hoy.getFullYear()
    )
  }

  const esMesActual = (fecha: Date) => {
    return fecha.getMonth() === fechaSeleccionada.getMonth()
  }

  const formatFecha = (fecha: Date) => {
    return fecha.toLocaleDateString('es-AR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  if (loading) {
    return (
      <div className="calendario-entregas-page">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Cargando calendario...</p>
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
            <p className="subtitle">Visualiza las entregas programadas</p>
          </div>
          <button
            className="btn-secondary"
            onClick={() => navigate('/mostrador/dashboard')}
          >
            ← Volver al Dashboard
          </button>
        </div>
      </header>

      {/* Controles */}
      <div className="calendario-controls">
        <div className="vista-buttons">
          <button
            className={`vista-btn ${vista === 'mes' ? 'active' : ''}`}
            onClick={() => setVista('mes')}
          >
            Mes
          </button>
          <button
            className={`vista-btn ${vista === 'semana' ? 'active' : ''}`}
            onClick={() => setVista('semana')}
          >
            Semana
          </button>
          <button
            className={`vista-btn ${vista === 'dia' ? 'active' : ''}`}
            onClick={() => setVista('dia')}
          >
            Día
          </button>
        </div>
        <div className="navegacion-mes">
          <button onClick={() => cambiarMes(-1)}>← Mes Anterior</button>
          <h2>
            {fechaSeleccionada.toLocaleDateString('es-AR', {
              month: 'long',
              year: 'numeric'
            })}
          </h2>
          <button onClick={() => cambiarMes(1)}>Mes Siguiente →</button>
        </div>
      </div>

      {/* Vista de Mes */}
      {vista === 'mes' && (
        <div className="calendario-mes">
          <div className="dias-semana">
            {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map((dia) => (
              <div key={dia} className="dia-semana-header">
                {dia}
              </div>
            ))}
          </div>
          <div className="semanas">
            {getSemanasDelMes().map((semana, semanaIndex) => (
              <div key={semanaIndex} className="semana">
                {semana.map((dia, diaIndex) => {
                  const ordenesDelDia = getOrdenesPorFecha(dia)
                  const esDiaActual = esHoy(dia)
                  const esDelMesActual = esMesActual(dia)

                  return (
                    <div
                      key={diaIndex}
                      className={`dia-calendario ${!esDelMesActual ? 'otro-mes' : ''} ${esDiaActual ? 'hoy' : ''}`}
                    >
                      <div className="dia-numero">{dia.getDate()}</div>
                      {ordenesDelDia.length > 0 && (
                        <div className="ordenes-del-dia">
                          {ordenesDelDia.slice(0, 3).map((orden) => (
                            <div
                              key={orden.id}
                              className="orden-calendario"
                              onClick={() => navigate(`/op/${orden.numero_op}`)}
                              title={`OP ${orden.numero_op} - ${orden.cliente}`}
                            >
                              OP {orden.numero_op}
                            </div>
                          ))}
                          {ordenesDelDia.length > 3 && (
                            <div className="mas-ordenes">
                              +{ordenesDelDia.length - 3} más
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Vista de Semana */}
      {vista === 'semana' && (
        <div className="calendario-semana">
          <div className="semana-header">
            {getSemanasDelMes()[2]?.map((dia) => {
              const ordenesDelDia = getOrdenesPorFecha(dia)
              return (
                <div
                  key={dia.getTime()}
                  className={`dia-semana ${esHoy(dia) ? 'hoy' : ''}`}
                >
                  <div className="dia-semana-nombre">
                    {dia.toLocaleDateString('es-AR', { weekday: 'short' })}
                  </div>
                  <div className="dia-semana-numero">{dia.getDate()}</div>
                  <div className="ordenes-count">{ordenesDelDia.length}</div>
                  <div className="ordenes-lista">
                    {ordenesDelDia.map((orden) => (
                      <div
                        key={orden.id}
                        className="orden-item"
                        onClick={() => navigate(`/op/${orden.numero_op}`)}
                      >
                        <strong>OP {orden.numero_op}</strong>
                        <span>{orden.cliente}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Vista de Día */}
      {vista === 'dia' && (
        <div className="calendario-dia">
          <div className="dia-header">
            <h2>{formatFecha(fechaSeleccionada)}</h2>
            <div className="dia-navegacion">
              <button onClick={() => {
                const nuevaFecha = new Date(fechaSeleccionada)
                nuevaFecha.setDate(nuevaFecha.getDate() - 1)
                setFechaSeleccionada(nuevaFecha)
              }}>
                ← Ayer
              </button>
              <button onClick={() => setFechaSeleccionada(new Date())}>
                Hoy
              </button>
              <button onClick={() => {
                const nuevaFecha = new Date(fechaSeleccionada)
                nuevaFecha.setDate(nuevaFecha.getDate() + 1)
                setFechaSeleccionada(nuevaFecha)
              }}>
                Mañana →
              </button>
            </div>
          </div>
          <div className="ordenes-del-dia-lista">
            {getOrdenesPorFecha(fechaSeleccionada).length === 0 ? (
              <div className="empty-state">
                <p>No hay entregas programadas para este día</p>
              </div>
            ) : (
              getOrdenesPorFecha(fechaSeleccionada).map((orden) => (
                <div
                  key={orden.id}
                  className="orden-dia-card"
                  onClick={() => navigate(`/op/${orden.numero_op}`)}
                >
                  <div className="orden-dia-header">
                    <h3>OP #{orden.numero_op}</h3>
                    {orden.fecha_entrega && (
                      <span className="hora-entrega">
                        {new Date(orden.fecha_entrega).toLocaleTimeString('es-AR', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    )}
                  </div>
                  <div className="orden-dia-cliente">{orden.cliente}</div>
                  {orden.descripcion && (
                    <div className="orden-dia-descripcion">{orden.descripcion}</div>
                  )}
                  <button
                    className="btn-link"
                    onClick={(e) => {
                      e.stopPropagation()
                      navigate(`/mostrador/entrega/${orden.id}`)
                    }}
                  >
                    Procesar Entrega →
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default CalendarioEntregasPage

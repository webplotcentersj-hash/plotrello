import { useEffect, useState, useMemo } from 'react'
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isToday, parseISO, addMonths, subMonths } from 'date-fns'
import { es } from 'date-fns/locale'
import apiService from '../services/api'
import type { CitaAsesorTecnico, ClienteRecord } from '../types/api'
import CitaModal from './CitaModal'
import './AgendaAsesorTecnico.css'

type AgendaAsesorTecnicoProps = {
  idAsesor: number
}

const AgendaAsesorTecnico = ({ idAsesor }: AgendaAsesorTecnicoProps) => {
  const [citas, setCitas] = useState<CitaAsesorTecnico[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [citaModalOpen, setCitaModalOpen] = useState(false)
  const [citaToEdit, setCitaToEdit] = useState<CitaAsesorTecnico | null>(null)
  const [clientes, setClientes] = useState<ClienteRecord[]>([])

  useEffect(() => {
    loadCitas()
    loadClientes()
  }, [idAsesor, currentMonth])

  const loadCitas = async () => {
    setLoading(true)
    setError(null)
    try {
      const inicioMes = startOfMonth(currentMonth)
      const finMes = endOfMonth(currentMonth)
      
      const response = await apiService.getCitasAsesor(
        idAsesor,
        inicioMes.toISOString(),
        finMes.toISOString()
      )

      if (response.success && response.data) {
        setCitas(response.data)
      } else {
        setError(response.error || 'Error al cargar las citas')
      }
    } catch (err) {
      setError('Error al cargar las citas')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const loadClientes = async () => {
    try {
      // Usar buscarClientes con búsqueda vacía para obtener todos
      const response = await apiService.buscarClientes('')
      if (response.success && response.data) {
        setClientes(response.data)
      }
    } catch (err) {
      console.error('Error al cargar clientes:', err)
    }
  }

  const citasByDate = useMemo(() => {
    const map = new Map<string, CitaAsesorTecnico[]>()
    citas.forEach((cita) => {
      const fechaKey = format(parseISO(cita.fecha_cita), 'yyyy-MM-dd')
      const existing = map.get(fechaKey) || []
      existing.push(cita)
      map.set(fechaKey, existing)
    })
    return map
  }, [citas])

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(monthStart)
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })

  const days: Date[] = []
  let day = gridStart
  while (day <= gridEnd) {
    days.push(day)
    day = addDays(day, 1)
  }

  const goToPrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1))
  const goToNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1))
  const goToToday = () => setCurrentMonth(new Date())

  const handleDateClick = (date: Date) => {
    setSelectedDate(date)
    setCitaToEdit(null)
    setCitaModalOpen(true)
  }

  const handleCitaClick = (cita: CitaAsesorTecnico) => {
    setCitaToEdit(cita)
    setSelectedDate(parseISO(cita.fecha_cita))
    setCitaModalOpen(true)
  }

  const handleCitaSaved = () => {
    setCitaModalOpen(false)
    setCitaToEdit(null)
    setSelectedDate(null)
    loadCitas()
  }

  const handleCitaDeleted = () => {
    setCitaModalOpen(false)
    setCitaToEdit(null)
    setSelectedDate(null)
    loadCitas()
  }

  const citasDeHoy = useMemo(() => {
    const hoy = new Date()
    const inicioHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 0, 0, 0, 0)
    const finHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 23, 59, 59, 999)
    
    return citas
      .filter(cita => {
        const fechaCita = parseISO(cita.fecha_cita)
        return fechaCita >= inicioHoy && fechaCita <= finHoy
      })
      .sort((a, b) => parseISO(a.fecha_cita).getTime() - parseISO(b.fecha_cita).getTime())
  }, [citas])

  return (
    <div className="agenda-asesor-tecnico">
      <div className="agenda-header">
        <div className="agenda-header-left">
          <h2>📅 Agenda del Asesor Técnico</h2>
          <div className="month-nav">
            <button onClick={goToPrevMonth} className="btn-nav">◀</button>
            <button onClick={goToToday} className="btn-nav">Hoy</button>
            <button onClick={goToNextMonth} className="btn-nav">▶</button>
          </div>
          <div className="month-title">{format(currentMonth, 'MMMM yyyy', { locale: es })}</div>
        </div>
        <button className="btn-primary" onClick={() => handleDateClick(new Date())}>
          + Nueva Cita
        </button>
      </div>

      {error && (
        <div className="alert alert-error">
          {error}
        </div>
      )}

      <div className="agenda-content">
        <div className="agenda-calendar">
          <div className="calendar-weekdays">
            {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(day => (
              <div key={day} className="weekday-header">{day}</div>
            ))}
          </div>
          <div className="calendar-grid">
            {days.map((date, idx) => {
              const fechaKey = format(date, 'yyyy-MM-dd')
              const dayCitas = citasByDate.get(fechaKey) || []
              const isCurrent = isSameMonth(date, monthStart)
              const isCurrentDay = isToday(date)

              return (
                <div
                  key={idx}
                  className={`calendar-day ${!isCurrent ? 'other-month' : ''} ${isCurrentDay ? 'today' : ''}`}
                  onClick={() => isCurrent && handleDateClick(date)}
                >
                  <div className="day-number">{format(date, 'd')}</div>
                  {dayCitas.length > 0 && (
                    <div className="day-citas">
                      {dayCitas.slice(0, 3).map(cita => (
                        <div
                          key={cita.id}
                          className={`cita-indicator estado-${cita.estado}`}
                          onClick={(e) => {
                            e.stopPropagation()
                            handleCitaClick(cita)
                          }}
                          title={cita.titulo}
                        >
                          {format(parseISO(cita.fecha_cita), 'HH:mm')} - {cita.titulo.substring(0, 15)}
                        </div>
                      ))}
                      {dayCitas.length > 3 && (
                        <div className="cita-more">+{dayCitas.length - 3} más</div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <div className="agenda-sidebar">
          <div className="sidebar-section">
            <h3>Citas de Hoy</h3>
            {loading ? (
              <div className="loading">Cargando...</div>
            ) : citasDeHoy.length === 0 ? (
              <div className="empty-state">No hay citas programadas para hoy</div>
            ) : (
              <div className="citas-list">
                {citasDeHoy.map(cita => (
                  <div
                    key={cita.id}
                    className={`cita-item estado-${cita.estado}`}
                    onClick={() => handleCitaClick(cita)}
                  >
                    <div className="cita-item-header">
                      <span className="cita-fecha">{format(parseISO(cita.fecha_cita), 'HH:mm', { locale: es })}</span>
                      <span className={`cita-estado estado-${cita.estado}`}>{cita.estado}</span>
                    </div>
                    <div className="cita-titulo">{cita.titulo}</div>
                    {cita.cliente_nombre && (
                      <div className="cita-cliente">👤 {cita.cliente_nombre}</div>
                    )}
                    {cita.direccion && (
                      <div className="cita-direccion">📍 {cita.direccion}</div>
                    )}
                    {cita.duracion_minutos && (
                      <div className="cita-duracion">⏱️ {cita.duracion_minutos} min</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {citaModalOpen && (
        <CitaModal
          cita={citaToEdit}
          fechaSeleccionada={selectedDate}
          idAsesor={idAsesor}
          clientes={clientes}
          onClose={() => {
            setCitaModalOpen(false)
            setCitaToEdit(null)
            setSelectedDate(null)
          }}
          onSave={handleCitaSaved}
          onDelete={handleCitaDeleted}
        />
      )}
    </div>
  )
}

export default AgendaAsesorTecnico


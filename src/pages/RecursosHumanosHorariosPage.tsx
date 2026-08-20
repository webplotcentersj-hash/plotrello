import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts'
import { useAuth } from '../hooks/useAuth'
import apiService from '../services/api'
import VerLegajoModal from '../components/VerLegajoModal'
import TurnosDiaPanel from '../components/TurnosDiaPanel'
import RrhhNovedadDetailModal from '../components/RrhhNovedadDetailModal'
import type { UsuarioRecord, Asistencia, RrhhNovedad, SolicitudPermiso } from '../types/api'
import { exportarAsistenciaPlanillaXlsx } from '../utils/exportAsistenciaPlanillaXlsx'
import {
  abreviaturaCodigoNovedad,
  esDiaHabil,
  novedadEnDia
} from '../utils/rrhhNovedadDates'
import { etiquetaCodigoRrhhNovedad } from '../utils/rrhhNovedadCatalog'
import { asistenciaHoraCorta } from '../utils/dateUtils'
import {
  joinAsistenciaObservaciones,
  parseAsistenciaObservaciones,
  tieneAclaracionAsistencia
} from '../utils/asistenciaAclaracion'
import {
  buildExtraAcumuladoPorEmpleado,
  calcularStatsAsistencia,
  diasEntre,
  evaluarDiaAsistencia,
  formatArs,
  LS_VALOR_HORA_EXTRA,
  mergeTabletMarcacionesIntoAsistencia,
  rankingPuntualidad,
  totalesStats,
  ultimoDiaMes,
  type HorarioFijoAsistencia,
  type StatsEmpleadoAsistencia,
  type TabletMarcacionParaStats
} from '../utils/asistenciaStats'
import { plotLabFetch } from '../utils/plotLabApiOrigin'
import { etiquetaUsuarioNombre } from '../utils/etiquetaUsuarioNombre'
import { getStaffAuthToken } from '../services/staffSession'
import {
  formatHoras,
  etiquetaHorarioSabado,
  horarioSabadoEfectivo,
  HORARIO_SABADO
} from '../services/relojBiometricoService'
import { detectarNovedadesDesdeAsistencia, sincronizarNovedadesDesdeAsistencia } from '../utils/rrhhAsistenciaNovedadSync'
import RelojTabletMarcacionesTab from '../components/RelojTabletMarcacionesTab'
import RelojFacialTab from '../components/RelojFacialTab'
import './RecursosHumanosHorariosPage.css'

type TabType = 'horarios' | 'permisos' | 'asistencia' | 'estadisticas' | 'tablet-reloj' | 'reloj-facial'

const RecursosHumanosHorariosPage = () => {
  const navigate = useNavigate()
  const { canManageRecursosHumanos, usuario, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabType>('horarios')
  
  // Datos
  const [usuarios, setUsuarios] = useState<UsuarioRecord[]>([])
  const [asistencia, setAsistencia] = useState<Asistencia[]>([])
  const [novedades, setNovedades] = useState<RrhhNovedad[]>([])
  const [permisos, setPermisos] = useState<SolicitudPermiso[]>([])
  
  // Filtros
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState<number | null>(null)
  const [fechaDesde, setFechaDesde] = useState<string>(() => {
    const date = new Date()
    date.setDate(1) // Primer día del mes
    return date.toISOString().split('T')[0]
  })
  const [fechaHasta, setFechaHasta] = useState<string>(() => {
    const date = new Date()
    date.setMonth(date.getMonth() + 1)
    date.setDate(0) // Último día del mes
    return date.toISOString().split('T')[0]
  })
  

  useEffect(() => {
    if (authLoading) return
    if (!canManageRecursosHumanos) {
      navigate('/rrhh/dashboard')
      return
    }
    loadInitialData()
  }, [canManageRecursosHumanos, navigate, authLoading])

  useEffect(() => {
    if (activeTab === 'permisos') {
      loadPermisos()
    }
  }, [activeTab, usuarioSeleccionado])

  useEffect(() => {
    if (activeTab === 'asistencia') {
      loadAsistencia()
      loadNovedades()
    }
  }, [activeTab, usuarioSeleccionado, fechaDesde, fechaHasta])

  const loadInitialData = async () => {
    setLoading(true)
    try {
      const usuariosResponse = await apiService.getUsuariosRrhhOperarios()
      if (usuariosResponse.success && usuariosResponse.data) {
        setUsuarios(usuariosResponse.data)
      }
    } catch (error) {
      console.error('Error cargando datos:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadPermisos = async () => {
    try {
      const response = await apiService.obtenerSolicitudesPermisos(

        usuarioSeleccionado,
        'aprobado',
        null,
        null,
        null
      )
      if (response.success && response.data) {
        setPermisos(response.data)
      }
    } catch (error) {
      console.error('Error cargando permisos:', error)
    }
  }

  const loadNovedades = async () => {
    try {
      const response = await apiService.rrhhNovedadesListar({
        idUsuario: usuarioSeleccionado ?? undefined,
        fechaDesde,
        fechaHasta
      })
      if (response.success && response.data) {
        setNovedades(response.data)
      }
    } catch (error) {
      console.error('Error cargando novedades:', error)
    }
  }

  const loadAsistencia = async () => {
    try {
      const response = await apiService.obtenerAsistencia(usuarioSeleccionado, fechaDesde, fechaHasta)
      if (response.success && response.data) {
        setAsistencia(response.data)
      }
    } catch (error) {
      console.error('Error cargando asistencia:', error)
    }
  }

  if (loading) {
    return (
      <div className="rrhh-horarios-loading">
        <div className="spinner"></div>
        <p>Cargando...</p>
      </div>
    )
  }

  return (
    <div className="rrhh-horarios-page">
      <header className="rrhh-horarios-header">
        <div className="rrhh-header-content">
          <h1>🕐 Gestión de Horarios y Turnos</h1>
          <div className="rrhh-header-actions">
            <button className="btn-back" onClick={() => navigate('/rrhh/dashboard')}>
              ← Volver
            </button>
          </div>
        </div>
      </header>

      <div className="rrhh-horarios-content">
        {/* Tabs */}
        <div className="rrhh-tabs">
          <button
            className={`rrhh-tab ${activeTab === 'horarios' ? 'active' : ''}`}
            onClick={() => setActiveTab('horarios')}
          >
            🕘 Horarios reloj
          </button>
          <button
            className={`rrhh-tab ${activeTab === 'permisos' ? 'active' : ''}`}
            onClick={() => setActiveTab('permisos')}
          >
            🗓️ Turnos
          </button>
          <button
            className={`rrhh-tab ${activeTab === 'asistencia' ? 'active' : ''}`}
            onClick={() => setActiveTab('asistencia')}
          >
            ✅ Asistencia
          </button>
          <button
            className={`rrhh-tab ${activeTab === 'estadisticas' ? 'active' : ''}`}
            onClick={() => setActiveTab('estadisticas')}
          >
            📊 Estadísticas
          </button>
          <button
            className={`rrhh-tab ${activeTab === 'tablet-reloj' ? 'active' : ''}`}
            onClick={() => setActiveTab('tablet-reloj')}
          >
            📱 Tablet reloj
          </button>
          <button
            className={`rrhh-tab ${activeTab === 'reloj-facial' ? 'active' : ''}`}
            onClick={() => setActiveTab('reloj-facial')}
          >
            👤 Reloj facial
          </button>
        </div>

        {/* Filtros */}
        {activeTab === 'asistencia' && (
        <div className="rrhh-filters-section">
          <select
            value={usuarioSeleccionado || ''}
            onChange={(e) => setUsuarioSeleccionado(e.target.value ? parseInt(e.target.value) : null)}
            className="rrhh-filter-select"
          >
            <option value="">Todos los usuarios</option>
            {usuarios.map(u => (
              <option key={u.id} value={u.id}>{u.nombre}</option>
            ))}
          </select>
          <input
            type="date"
            value={fechaDesde}
            onChange={(e) => setFechaDesde(e.target.value)}
            className="rrhh-date-input"
          />
          <input
            type="date"
            value={fechaHasta}
            onChange={(e) => setFechaHasta(e.target.value)}
            className="rrhh-date-input"
          />
        </div>
        )}

        {activeTab === 'estadisticas' && (
        <div className="rrhh-filters-section">
          <select
            value={usuarioSeleccionado || ''}
            onChange={(e) => setUsuarioSeleccionado(e.target.value ? parseInt(e.target.value) : null)}
            className="rrhh-filter-select"
          >
            <option value="">Todos los empleados</option>
            {usuarios.map(u => (
              <option key={u.id} value={u.id}>{u.nombre}</option>
            ))}
          </select>
        </div>
        )}

        {activeTab === 'horarios' && (
        <div className="rrhh-filters-section">
          <select
            value={usuarioSeleccionado || ''}
            onChange={(e) => setUsuarioSeleccionado(e.target.value ? parseInt(e.target.value) : null)}
            className="rrhh-filter-select"
          >
            <option value="">Todos los usuarios</option>
            {usuarios.map(u => (
              <option key={u.id} value={u.id}>{u.nombre}</option>
            ))}
          </select>
        </div>
        )}

        {/* Contenido de tabs */}
        {activeTab === 'horarios' && (
          <HorariosTab
            usuarios={usuarios}
            usuarioSeleccionado={usuarioSeleccionado}
          />
        )}

        {activeTab === 'permisos' && (
          <div className="rrhh-tab-content">
            <div className="rrhh-section-header">
              <h2>Turnos del día</h2>
              <p className="rrhh-section-sub">
                Horarios de hoy (o el día elegido), permisos e intercambio de turnos. Los sábados son 9–14 por
                defecto (hay excepciones, p. ej. 6:30–13); algunos vienen sábados por medio.
              </p>
            </div>
            <TurnosDiaPanel usuarios={usuarios} permisos={permisos} />
          </div>
        )}

        {activeTab === 'asistencia' && (
          <AsistenciaTab
            asistencia={asistencia}
            novedades={novedades}
            usuarios={usuarios}
            fechaDesde={fechaDesde}
            fechaHasta={fechaHasta}
            registradoPorId={usuario?.id ?? null}
            onNovedadesActualizadas={loadNovedades}
            onAsistenciaActualizada={loadAsistencia}
            onIrNovedades={() => navigate('/rrhh/novedades')}
          />
        )}

        {activeTab === 'estadisticas' && (
          <EstadisticasAsistenciaTab
            usuarios={usuarios}
            usuarioSeleccionado={usuarioSeleccionado}
          />
        )}

        {activeTab === 'tablet-reloj' && (
          <div className="rrhh-tab-content">
            <RelojTabletMarcacionesTab />
          </div>
        )}

        {activeTab === 'reloj-facial' && (
          <div className="rrhh-tab-content">
            <RelojFacialTab
              onVerAuditoria={() => setActiveTab('tablet-reloj')}
              onIrAHorarios={() => setActiveTab('horarios')}
            />
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================================
// Editor de horario fijo por empleado (entrada/salida estándar)
// Persiste en BD y queda como referencia hasta que se cambie.
// ============================================================
const HorarioFijoEditor = ({
  plotLabId,
  valor,
  guardando,
  onGuardar,
  compacto
}: {
  plotLabId: number | null
  valor?: { entrada: string; salida: string }
  guardando?: boolean
  onGuardar: (plotLabId: number, entrada: string, salida: string) => void
  compacto?: boolean
}) => {
  const [entrada, setEntrada] = useState(valor?.entrada || '')
  const [salida, setSalida] = useState(valor?.salida || '')

  useEffect(() => {
    setEntrada(valor?.entrada || '')
    setSalida(valor?.salida || '')
  }, [valor?.entrada, valor?.salida])

  const sucio = entrada !== (valor?.entrada || '') || salida !== (valor?.salida || '')
  const valido = !!entrada

  if (!plotLabId) {
    return <span className="reloj-fijo-novinc">Vinculá primero</span>
  }

  return (
    <div className={`reloj-fijo-editor ${compacto ? 'compacto' : ''}`}>
      <input
        type="time"
        className="reloj-fijo-input"
        value={entrada}
        title="Hora de entrada esperada (define tardanzas)"
        onChange={(e) => setEntrada(e.target.value)}
      />
      <span className="reloj-fijo-sep">–</span>
      <input
        type="time"
        className="reloj-fijo-input reloj-fijo-input--opcional"
        value={salida}
        title="Salida esperada (opcional)"
        placeholder="18:00"
        onChange={(e) => setSalida(e.target.value)}
      />
      <button
        type="button"
        className="reloj-fijo-save"
        disabled={!valido || !sucio || guardando}
        title="Guardar horario de entrada"
        onClick={() => valido && onGuardar(plotLabId, entrada, salida)}
      >
        {guardando ? '…' : sucio ? 'Guardar' : '✓'}
      </button>
    </div>
  )
}

// ============================================================
// Editor de jornada (horas) por empleado, con valor derivado como placeholder
// ============================================================
const JornadaCell = ({
  valor,
  derivado,
  disabled,
  onGuardar
}: {
  valor: number | null
  derivado: number | null
  disabled?: boolean
  onGuardar: (horas: number | null) => void
}) => {
  const [v, setV] = useState(valor != null ? String(valor) : '')

  useEffect(() => {
    setV(valor != null ? String(valor) : '')
  }, [valor])

  const commit = () => {
    const txt = v.trim()
    if (txt === '') {
      if (valor != null) onGuardar(null)
      return
    }
    const n = Number(txt)
    if (!isNaN(n) && n > 0 && n !== valor) onGuardar(Math.round(n * 100) / 100)
  }

  return (
    <input
      type="number"
      min={0}
      max={24}
      step={0.5}
      className="rrhh-fijos-jornada-input"
      value={v}
      disabled={disabled}
      placeholder={derivado != null ? String(derivado) : '—'}
      title={derivado != null ? `Derivado del horario: ${derivado} hs` : 'Definí el horario fijo primero'}
      onChange={(e) => setV(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
      }}
    />
  )
}

// ============================================================
// Editor de nombre/apellido del legajo (planilla horarios fijos)
// ============================================================
const NombreLegajoCell = ({
  idUsuario,
  legajo,
  loginNombre,
  guardando,
  onGuardar
}: {
  idUsuario: number
  legajo?: { nombre: string; apellido: string }
  loginNombre: string
  guardando?: boolean
  onGuardar: (idUsuario: number, nombre: string, apellido: string) => void
}) => {
  const [nombre, setNombre] = useState(legajo?.nombre || '')
  const [apellido, setApellido] = useState(legajo?.apellido || '')

  useEffect(() => {
    setNombre(legajo?.nombre || '')
    setApellido(legajo?.apellido || '')
  }, [legajo?.nombre, legajo?.apellido])

  const partesLogin = loginNombre.trim().split(/\s+/)
  const phNombre = partesLogin[0] || 'Nombre'
  const phApellido = partesLogin.slice(1).join(' ') || 'Apellido'

  const sucio = nombre.trim() !== (legajo?.nombre || '').trim() || apellido.trim() !== (legajo?.apellido || '').trim()
  const valido = !!(nombre.trim() || apellido.trim())

  const commit = () => {
    if (!valido || !sucio || guardando) return
    onGuardar(idUsuario, nombre.trim(), apellido.trim())
  }

  return (
    <div className="rrhh-fijos-nombre-cell">
      <div className="rrhh-fijos-nombre-editor">
        <input
          type="text"
          className="rrhh-fijos-nombre-input"
          value={nombre}
          placeholder={phNombre}
          title="Nombre en legajo (reloj, tarjetas QR)"
          disabled={guardando}
          onChange={(e) => setNombre(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit()
          }}
        />
        <input
          type="text"
          className="rrhh-fijos-nombre-input"
          value={apellido}
          placeholder={phApellido}
          title="Apellido en legajo"
          disabled={guardando}
          onChange={(e) => setApellido(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit()
          }}
        />
        <button
          type="button"
          className="rrhh-fijos-nombre-save"
          disabled={!valido || !sucio || guardando}
          title="Guardar nombre en legajo"
          onClick={commit}
        >
          {guardando ? '…' : sucio ? 'Guardar' : '✓'}
        </button>
      </div>
      <span className="rrhh-fijos-login" title="Usuario de login en Plot Lab">
        {loginNombre}
      </span>
    </div>
  )
}

// ============================================================
// Planilla editable (grilla empleados x días)
// Componente de Horarios
/** Horas decimales entre dos 'HH:mm' (cruza medianoche si salida <= entrada). */
const horasEntre = (entrada: string, salida: string): number | null => {
  const pe = entrada.match(/^(\d{1,2}):(\d{2})$/)
  const ps = salida.match(/^(\d{1,2}):(\d{2})$/)
  if (!pe || !ps) return null
  let diff = (Number(ps[1]) * 60 + Number(ps[2])) - (Number(pe[1]) * 60 + Number(pe[2]))
  if (diff <= 0) diff += 24 * 60
  return Math.round((diff / 60) * 100) / 100
}

const HorariosTab = ({ usuarios, usuarioSeleccionado }: {
  usuarios: UsuarioRecord[]
  usuarioSeleccionado: number | null
}) => {
  // Horarios fijos (planilla editable): entrada/salida/jornada estándar por empleado.
  const [fijos, setFijos] = useState<
    Record<
      number,
      {
        entrada: string
        salida: string
        horas?: number | null
        trabajaSabado?: boolean
        sabadoEntrada?: string | null
        sabadoSalida?: string | null
        vigenteDesde?: string
        esDelMes?: boolean
      }
    >
  >({})
  const [guardandoFijo, setGuardandoFijo] = useState<number | null>(null)
  const [guardandoNombre, setGuardandoNombre] = useState<number | null>(null)
  const [cargandoFijos, setCargandoFijos] = useState(true)
  // Datos de legajo (nombre completo + área) por id de usuario.
  const [legajos, setLegajos] = useState<Record<number, { nombre: string; apellido: string; sector: string }>>({})
  // Usuario cuyo legajo se está viendo en el modal.
  const [legajoUsuario, setLegajoUsuario] = useState<UsuarioRecord | null>(null)
  // Mes seleccionado (YYYY-MM): los horarios fijos se guardan/leen por mes.
  const [mes, setMes] = useState<string>(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })

  // Legajos: una sola vez.
  useEffect(() => {
    let cancelado = false
    apiService.obtenerLegajosBasico().then((rl) => {
      if (!cancelado && rl.success && rl.data) setLegajos(rl.data)
    })
    return () => {
      cancelado = true
    }
  }, [])

  // Horarios fijos del mes seleccionado.
  useEffect(() => {
    let cancelado = false
    setCargandoFijos(true)
    apiService.obtenerHorariosFijos(mes).then((rf) => {
      if (cancelado) return
      setFijos(rf.success && rf.data ? rf.data : {})
      setCargandoFijos(false)
    })
    return () => {
      cancelado = true
    }
  }, [mes])

  const upsertFijo = async (
    idUsuario: number,
    entrada: string,
    salida: string,
    horas: number | null,
    trabajaSabado: boolean,
    sabadoEntrada?: string | null,
    sabadoSalida?: string | null
  ) => {
    if (!idUsuario || !entrada || !salida) return
    const previo = fijos[idUsuario]
    const sabE =
      sabadoEntrada !== undefined ? sabadoEntrada : previo?.sabadoEntrada ?? null
    const sabS =
      sabadoSalida !== undefined ? sabadoSalida : previo?.sabadoSalida ?? null
    setFijos((prev) => ({
      ...prev,
      [idUsuario]: {
        entrada,
        salida,
        horas,
        trabajaSabado,
        sabadoEntrada: sabE,
        sabadoSalida: sabS,
        vigenteDesde: mes,
        esDelMes: true
      }
    }))
    setGuardandoFijo(idUsuario)
    try {
      const r = await apiService.upsertHorarioFijo(
        idUsuario,
        entrada,
        salida,
        horas,
        mes,
        trabajaSabado,
        null,
        sabE,
        sabS
      )
      if (!r.success) {
        setFijos((prev) => {
          const next = { ...prev }
          if (previo) next[idUsuario] = previo
          else delete next[idUsuario]
          return next
        })
        alert('Error al guardar el horario fijo: ' + (r.error || ''))
      }
    } finally {
      setGuardandoFijo(null)
    }
  }

  const eliminarFijo = async (idUsuario: number) => {
    const f = fijos[idUsuario]
    if (!f?.entrada) return
    if (!f.esDelMes) {
      alert('Este horario viene de un mes anterior y sigue vigente. Para cambiarlo, editá y guardá (aplica desde este mes).')
      return
    }
    if (!confirm('¿Quitar el horario guardado para este mes? Volverá a aplicarse el anterior si existía.')) return
    const previo = fijos[idUsuario]
    setFijos((prev) => {
      const next = { ...prev }
      delete next[idUsuario]
      return next
    })
    setGuardandoFijo(idUsuario)
    try {
      const r = await apiService.eliminarHorarioFijo(idUsuario, mes)
      if (!r.success) {
        setFijos((prev) => ({ ...prev, [idUsuario]: previo }))
        alert('Error al eliminar: ' + (r.error || ''))
      } else {
        const rf = await apiService.obtenerHorariosFijos(mes)
        if (rf.success && rf.data) {
          setFijos((prev) => {
            const next = { ...prev }
            if (rf.data![idUsuario]) next[idUsuario] = rf.data![idUsuario]
            else delete next[idUsuario]
            return next
          })
        } else {
          setFijos((prev) => {
            const next = { ...prev }
            delete next[idUsuario]
            return next
          })
        }
      }
    } finally {
      setGuardandoFijo(null)
    }
  }

  // Guarda entrada/salida preservando la jornada y el sábado existentes.
  const guardarFijo = (idUsuario: number, entrada: string, salida: string) =>
    upsertFijo(idUsuario, entrada, salida, fijos[idUsuario]?.horas ?? null, fijos[idUsuario]?.trabajaSabado ?? true)

  // Guarda la jornada (hs) preservando entrada/salida y sábado.
  const guardarJornada = (idUsuario: number, horas: number | null) => {
    const f = fijos[idUsuario]
    if (!f?.entrada || !f?.salida) return
    upsertFijo(idUsuario, f.entrada, f.salida, horas, f.trabajaSabado ?? true)
  }

  // Cambia si el empleado trabaja sábado (Lun-Sáb vs Lun-Vie).
  const guardarSabado = (idUsuario: number, trabajaSabado: boolean) => {
    const f = fijos[idUsuario]
    if (!f?.entrada || !f?.salida) return
    upsertFijo(idUsuario, f.entrada, f.salida, f.horas ?? null, trabajaSabado)
  }

  const guardarHorarioSabado = (idUsuario: number, sabadoEntrada: string, sabadoSalida: string) => {
    const f = fijos[idUsuario]
    if (!f?.entrada || !f?.salida) return
    const e = sabadoEntrada.slice(0, 5) || HORARIO_SABADO.entrada
    const s = sabadoSalida.slice(0, 5) || HORARIO_SABADO.salida
    void upsertFijo(idUsuario, f.entrada, f.salida, f.horas ?? null, true, e, s)
  }

  const guardarNombreLegajo = async (idUsuario: number, nombre: string, apellido: string) => {
    const previo = legajos[idUsuario]
    setLegajos((prev) => ({
      ...prev,
      [idUsuario]: {
        nombre,
        apellido,
        sector: prev[idUsuario]?.sector || ''
      }
    }))
    setGuardandoNombre(idUsuario)
    try {
      const r = await apiService.crearActualizarLegajo(idUsuario, { nombre, apellido })
      if (!r.success) {
        setLegajos((prev) => {
          const next = { ...prev }
          if (previo) next[idUsuario] = previo
          else delete next[idUsuario]
          return next
        })
        alert('Error al guardar el nombre: ' + (r.error || ''))
      } else if (r.data) {
        setLegajos((prev) => ({
          ...prev,
          [idUsuario]: {
            nombre: r.data!.nombre || nombre,
            apellido: r.data!.apellido || apellido,
            sector: prev[idUsuario]?.sector || r.data!.sector || ''
          }
        }))
      }
    } finally {
      setGuardandoNombre(null)
    }
  }

  const usuariosFijos = useMemo(() => {
    const lista = usuarioSeleccionado ? usuarios.filter((u) => u.id === usuarioSeleccionado) : usuarios
    return [...lista].sort((a, b) => {
      const na = `${legajos[a.id]?.nombre || ''} ${legajos[a.id]?.apellido || ''}`.trim() || a.nombre
      const nb = `${legajos[b.id]?.nombre || ''} ${legajos[b.id]?.apellido || ''}`.trim() || b.nombre
      return na.localeCompare(nb)
    })
  }, [usuarios, usuarioSeleccionado, legajos])

  const totalConFijo = useMemo(
    () => usuariosFijos.filter((u) => fijos[u.id]?.entrada && fijos[u.id]?.salida).length,
    [usuariosFijos, fijos]
  )

  return (
    <div className="rrhh-tab-content">
      <div className="rrhh-fijos-planilla">
        <div className="rrhh-section-header">
          <h2>🕘 Horarios del reloj</h2>
          <div className="rrhh-fijos-header-right">
            <label className="rrhh-fijos-mes">
              Mes:
              <input type="month" value={mes} onChange={(e) => setMes(e.target.value)} />
            </label>
            <span className="rrhh-fijos-resumen">
              {cargandoFijos
                ? 'Cargando...'
                : `${totalConFijo} de ${usuariosFijos.length} empleados con horario fijo`}
            </span>
          </div>
        </div>
        <p className="rrhh-fijos-help">
          Los horarios fijos <strong>permanecen vigentes hasta que los cambies</strong>: no se borran solos al
          cambiar de mes. El selector de mes muestra qué horario aplica en ese período (hereda el último guardado si
          no hubo cambios). Editá y guardá para definir un horario nuevo a partir del mes seleccionado. Columna{' '}
          <strong>Sáb</strong>: si está marcada, trabaja sábado (por defecto 9–14). Podés cargar otro rango
          (ej. Claudia 6:30–13). Si no marca, el sábado es todo extra.
        </p>
        <div className="rrhh-fijos-tabla-wrap">
          <table className="rrhh-fijos-tabla">
            <thead>
              <tr>
                <th>Empleado</th>
                <th>Área</th>
                <th>Horario fijo</th>
                <th>Jornada (hs)</th>
                <th title="Trabaja sábado. Default 9–14; se puede personalizar.">Sáb</th>
                <th>Legajo</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {usuariosFijos.map((u) => {
                const f = fijos[u.id]
                const sector = legajos[u.id]?.sector || ''
                const tieneHorario = !!(f?.entrada && f?.salida)
                const trabajaSab = tieneHorario && f?.trabajaSabado !== false
                const sab = horarioSabadoEfectivo(f)
                return (
                  <tr key={u.id} className={f?.entrada ? '' : 'rrhh-fijos-row-sin'}>
                    <td>
                      <NombreLegajoCell
                        idUsuario={u.id}
                        legajo={legajos[u.id]}
                        loginNombre={u.nombre}
                        guardando={guardandoNombre === u.id}
                        onGuardar={guardarNombreLegajo}
                      />
                    </td>
                    <td className="rrhh-fijos-area">{sector || '—'}</td>
                    <td>
                      <HorarioFijoEditor
                        plotLabId={u.id}
                        valor={f}
                        guardando={guardandoFijo === u.id}
                        onGuardar={guardarFijo}
                      />
                    </td>
                    <td>
                      <JornadaCell
                        valor={f?.horas ?? null}
                        derivado={tieneHorario ? horasEntre(f!.entrada, f!.salida) : null}
                        disabled={!tieneHorario || guardandoFijo === u.id}
                        onGuardar={(h) => guardarJornada(u.id, h)}
                      />
                    </td>
                    <td className="rrhh-fijos-sab">
                      <label
                        className="rrhh-fijos-sab-label"
                        title={
                          !trabajaSab
                            ? 'Lun–Vie (sábado todo extra)'
                            : `Trabaja sábado ${sab?.entrada || '09:00'} a ${sab?.salida || '14:00'}`
                        }
                      >
                        <input
                          type="checkbox"
                          checked={f?.trabajaSabado !== false}
                          disabled={!tieneHorario || guardandoFijo === u.id}
                          onChange={(e) => guardarSabado(u.id, e.target.checked)}
                        />
                        <span>{trabajaSab ? etiquetaHorarioSabado(f) : '—'}</span>
                      </label>
                      {trabajaSab ? (
                        <div className="rrhh-fijos-sab-times">
                          <input
                            type="time"
                            className="rrhh-fijos-sab-time"
                            value={sab?.entrada || HORARIO_SABADO.entrada}
                            disabled={guardandoFijo === u.id}
                            title="Entrada sábado"
                            onChange={(e) =>
                              guardarHorarioSabado(u.id, e.target.value, sab?.salida || HORARIO_SABADO.salida)
                            }
                          />
                          <span>–</span>
                          <input
                            type="time"
                            className="rrhh-fijos-sab-time"
                            value={sab?.salida || HORARIO_SABADO.salida}
                            disabled={guardandoFijo === u.id}
                            title="Salida sábado"
                            onChange={(e) =>
                              guardarHorarioSabado(u.id, sab?.entrada || HORARIO_SABADO.entrada, e.target.value)
                            }
                          />
                        </div>
                      ) : null}
                    </td>
                    <td>
                      <button className="rrhh-fijos-legajo-btn" onClick={() => setLegajoUsuario(u)}>
                        📂 Ver legajo
                      </button>
                    </td>
                    <td>
                      {tieneHorario && f?.esDelMes && (
                        <button
                          className="rrhh-fijos-del-btn"
                          title="Quitar horario guardado para este mes"
                          disabled={guardandoFijo === u.id}
                          onClick={() => eliminarFijo(u.id)}
                        >
                          🗑️
                        </button>
                      )}
                      {tieneHorario && !f?.esDelMes && f?.vigenteDesde && f.vigenteDesde !== mes ? (
                        <span className="rrhh-fijos-vigente" title={`Horario vigente desde ${f.vigenteDesde}`}>
                          ↩ {f.vigenteDesde}
                        </span>
                      ) : null}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {legajoUsuario && (
        <VerLegajoModal usuario={legajoUsuario} isOpen onClose={() => setLegajoUsuario(null)} />
      )}
    </div>
  )
}

// Componente de Asistencia

const pad2 = (n: number) => String(n).padStart(2, '0')

const ASIS_DOW_CORTO = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa']

const LiquidacionHorasExtraPanel = ({
  stats,
  valorHora,
  onValorHoraChange,
  periodoLabel
}: {
  stats: StatsEmpleadoAsistencia[]
  valorHora: number
  onValorHoraChange: (v: number) => void
  periodoLabel: string
}) => {
  const conExtra = useMemo(
    () => [...stats].filter((s) => s.totalHorasExtra > 0).sort((a, b) => b.costoExtra - a.costoExtra || b.totalHorasExtra - a.totalHorasExtra),
    [stats]
  )
  const totales = useMemo(() => totalesStats(stats), [stats])
  if (!conExtra.length) return null

  return (
    <div className="rrhh-extra-liquidacion">
      <div className="rrhh-extra-liquidacion-head">
        <div>
          <h3>💰 Liquidación horas extra — {periodoLabel}</h3>
          <p>Acumulado del período. HE 50% = hora × 1,5 · HE 100% (domingos) = hora × 2.</p>
        </div>
        <label className="rrhh-extra-valor-hora">
          Valor hora normal ($)
          <input
            type="number"
            min={0}
            step={500}
            value={valorHora || ''}
            placeholder="Ej. 8000"
            onChange={(e) => onValorHoraChange(Math.max(0, Number(e.target.value) || 0))}
          />
        </label>
      </div>
      <table className="rrhh-extra-liquidacion-tabla">
        <thead>
          <tr>
            <th>Empleado</th>
            <th>HE 50%</th>
            <th>HE 100%</th>
            <th>Total hs extra</th>
            <th>Costo estimado</th>
          </tr>
        </thead>
        <tbody>
          {conExtra.map((s) => (
            <tr key={s.id}>
              <td className="rrhh-extra-emp">{etiquetaUsuarioNombre(s.nombre, s.id)}</td>
              <td className={s.extra50 > 0 ? 'rrhh-extra-he50' : 'rrhh-extra-vacio'}>
                {s.extra50 > 0 ? `${s.extra50.toFixed(1)} hs` : '—'}
              </td>
              <td className={s.extra100 > 0 ? 'rrhh-extra-he100' : 'rrhh-extra-vacio'}>
                {s.extra100 > 0 ? `${s.extra100.toFixed(1)} hs` : '—'}
              </td>
              <td className="leyenda-extra">{formatHoras(s.totalHorasExtra)}</td>
              <td
                className={`rrhh-extra-costo${valorHora > 0 ? '' : ' rrhh-extra-vacio'}`}
                title={valorHora > 0 ? undefined : 'Ingresá el valor hora normal arriba para estimar el costo'}
              >
                {valorHora > 0 ? formatArs(s.costoExtra) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td><strong>Total</strong></td>
            <td className={totales.totalExtra50 > 0 ? 'rrhh-extra-he50' : 'rrhh-extra-vacio'}>
              <strong>{totales.totalExtra50.toFixed(1)} hs</strong>
            </td>
            <td className={totales.totalExtra100 > 0 ? 'rrhh-extra-he100' : 'rrhh-extra-vacio'}>
              <strong>{totales.totalExtra100.toFixed(1)} hs</strong>
            </td>
            <td className="leyenda-extra"><strong>{formatHoras(totales.totalHorasExtra)}</strong></td>
            <td className={`rrhh-extra-costo${valorHora > 0 ? '' : ' rrhh-extra-vacio'}`}>
              <strong>{valorHora > 0 ? formatArs(totales.costoExtraTotal) : '—'}</strong>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

const AsistenciaTab = ({
  asistencia,
  novedades,
  usuarios,
  fechaDesde,
  fechaHasta,
  registradoPorId,
  onNovedadesActualizadas,
  onAsistenciaActualizada,
  onIrNovedades
}: {
  asistencia: Asistencia[]
  novedades: RrhhNovedad[]
  usuarios: UsuarioRecord[]
  fechaDesde: string
  fechaHasta: string
  registradoPorId: number | null
  onNovedadesActualizadas: () => void
  onAsistenciaActualizada: () => void
  onIrNovedades: () => void
}) => {
  const { isAdmin } = useAuth()
  const [novedadDetalle, setNovedadDetalle] = useState<RrhhNovedad | null>(null)
  const [asistenciaDetalle, setAsistenciaDetalle] = useState<Asistencia | null>(null)
  const [asistenciaDetalleExtra, setAsistenciaDetalleExtra] = useState<number | null>(null)
  const [asistenciaDetalleAcum, setAsistenciaDetalleAcum] = useState<number | null>(null)
  const [aclaracionDraft, setAclaracionDraft] = useState('')
  const [aclaracionSaving, setAclaracionSaving] = useState(false)
  const [aclaracionError, setAclaracionError] = useState<string | null>(null)
  const [aclaracionOk, setAclaracionOk] = useState(false)
  const [editEntrada, setEditEntrada] = useState('')
  const [editSalida, setEditSalida] = useState('')
  const [editTipo, setEditTipo] = useState<Asistencia['tipo_registro']>('normal')
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [editOk, setEditOk] = useState(false)
  const [deletingAsistencia, setDeletingAsistencia] = useState(false)
  const [horariosPorMes, setHorariosPorMes] = useState<Record<string, Record<number, HorarioFijoAsistencia>>>({})
  const [legajos, setLegajos] = useState<Record<number, { nombre: string; apellido: string }>>({})
  const syncNovedadesRef = useRef(false)
  const [valorHora, setValorHora] = useState<number>(() => {
    try {
      const v = localStorage.getItem(LS_VALOR_HORA_EXTRA)
      return v ? Math.max(0, Number(v)) : 0
    } catch {
      return 0
    }
  })

  const guardarValorHora = (v: number) => {
    setValorHora(v)
    try {
      localStorage.setItem(LS_VALOR_HORA_EXTRA, String(v))
    } catch {
      /* ignore */
    }
  }

  const dias = useMemo(() => diasEntre(fechaDesde, fechaHasta), [fechaDesde, fechaHasta])

  const mesesEnPeriodo = useMemo(() => [...new Set(dias.map((d) => d.slice(0, 7)))], [dias])

  useEffect(() => {
    let cancelado = false
    apiService.obtenerLegajosBasico().then((r) => {
      if (cancelado || !r.success || !r.data) return
      const map: Record<number, { nombre: string; apellido: string }> = {}
      for (const [id, l] of Object.entries(r.data)) {
        map[Number(id)] = { nombre: l.nombre || '', apellido: l.apellido || '' }
      }
      setLegajos(map)
    })
    return () => {
      cancelado = true
    }
  }, [])

  useEffect(() => {
    let cancelado = false
    if (!mesesEnPeriodo.length) return
    Promise.all(mesesEnPeriodo.map((m) => apiService.obtenerHorariosFijos(m))).then((results) => {
      if (cancelado) return
      const map: Record<string, Record<number, HorarioFijoAsistencia>> = {}
      mesesEnPeriodo.forEach((mes, i) => {
        const r = results[i]
        if (!r.success || !r.data) return
        const entradas: Record<number, HorarioFijoAsistencia> = {}
        for (const [id, h] of Object.entries(r.data)) {
          if (h.entrada) {
            entradas[Number(id)] = {
              entrada: h.entrada,
              salida: h.salida,
              horas: h.horas,
              trabajaSabado: h.trabajaSabado,
              sabadoEntrada: h.sabadoEntrada,
              sabadoSalida: h.sabadoSalida
            }
          }
        }
        map[mes] = entradas
      })
      setHorariosPorMes(map)
    })
    return () => {
      cancelado = true
    }
  }, [mesesEnPeriodo])

  useEffect(() => {
    if (!registradoPorId || !asistencia.length || syncNovedadesRef.current) return
    const pendientes = detectarNovedadesDesdeAsistencia({
      asistencia,
      novedades,
      dias,
      horariosPorMes
    })
    if (!pendientes.length) return
    let cancelled = false
    syncNovedadesRef.current = true
    ;(async () => {
      try {
        const r = await sincronizarNovedadesDesdeAsistencia({
          asistencia,
          novedades,
          dias,
          horariosPorMes,
          registradoPor: registradoPorId
        })
        if (!cancelled && r.creadas > 0) onNovedadesActualizadas()
      } finally {
        syncNovedadesRef.current = false
      }
    })()
    return () => {
      cancelled = true
    }
  }, [asistencia, novedades, dias, horariosPorMes, registradoPorId, onNovedadesActualizadas])

  const nombres = useMemo(() => {
    const m = new Map<number, string>()
    usuarios.forEach((u) => m.set(u.id, etiquetaUsuarioNombre(u.nombre, u.id)))
    asistencia.forEach((a) => {
      if (a.nombre_usuario) m.set(a.id_usuario, etiquetaUsuarioNombre(a.nombre_usuario, a.id_usuario))
    })
    for (const [id, l] of Object.entries(legajos)) {
      const full = `${(l.nombre || '').trim()} ${(l.apellido || '').trim()}`.trim()
      if (full) m.set(Number(id), full)
    }
    return m
  }, [usuarios, asistencia, legajos])

  const empleados = useMemo(() => {
    const activos = new Set(usuarios.map((u) => u.id))
    const ids = new Set<number>()
    asistencia.forEach((a) => {
      if (activos.has(a.id_usuario)) ids.add(a.id_usuario)
    })
    novedades
      .filter((n) => n.grupo === 'falta' || n.grupo === 'licencia' || n.grupo === 'tardanza_retiro' || n.grupo === 'horas_extra')
      .forEach((n) => {
        if (activos.has(n.id_usuario)) ids.add(n.id_usuario)
      })

    const map = new Map<number, { id: number; nombre: string; dias: Record<string, Asistencia>; horas: number; horasExtra: number }>()
    for (const id of ids) {
      map.set(id, {
        id,
        nombre: nombres.get(id) || `Usuario ${id}`,
        dias: {},
        horas: 0,
        horasExtra: 0
      })
    }
    for (const a of asistencia) {
      const emp = map.get(a.id_usuario)
      if (!emp) continue
      emp.dias[a.fecha.slice(0, 10)] = a
      emp.horas += a.horas_trabajadas || 0
    }
    return [...map.values()].sort((x, y) => x.nombre.localeCompare(y.nombre))
  }, [asistencia, novedades, nombres, usuarios])

  const asistenciaActiva = useMemo(() => {
    const activos = new Set(usuarios.map((u) => u.id))
    return asistencia.filter((a) => activos.has(a.id_usuario))
  }, [asistencia, usuarios])

  const novedadesActivas = useMemo(() => {
    const activos = new Set(usuarios.map((u) => u.id))
    return novedades.filter((n) => activos.has(n.id_usuario))
  }, [novedades, usuarios])

  const statsLista = useMemo(
    () =>
      calcularStatsAsistencia({
        asistencia: asistenciaActiva,
        novedades: novedadesActivas,
        dias,
        nombres,
        horariosPorMes,
        valorHoraBase: valorHora
      }),
    [asistenciaActiva, novedadesActivas, dias, nombres, horariosPorMes, valorHora]
  )

  const statsPorEmpleado = useMemo(() => new Map(statsLista.map((s) => [s.id, s])), [statsLista])

  const { acumulado: extraAcumulado, porDia: extraPorDia } = useMemo(
    () =>
      buildExtraAcumuladoPorEmpleado({
        asistencia: asistenciaActiva,
        novedades: novedadesActivas,
        dias,
        horariosPorMes
      }),
    [asistenciaActiva, novedadesActivas, dias, horariosPorMes]
  )

  const periodoLabel = useMemo(() => {
    const d = new Date(fechaDesde + 'T12:00:00')
    const h = new Date(fechaHasta + 'T12:00:00')
    if (fechaDesde.slice(0, 7) === fechaHasta.slice(0, 7)) {
      return d.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
    }
    return `${d.toLocaleDateString('es-AR')} – ${h.toLocaleDateString('es-AR')}`
  }, [fechaDesde, fechaHasta])

  const novedadesPorUsuarioDia = useMemo(() => {
    const m = new Map<string, RrhhNovedad[]>()
    for (const n of novedadesActivas) {
      for (const f of dias) {
        if (!novedadEnDia(n, f)) continue
        const k = `${n.id_usuario}|${f}`
        const prev = m.get(k) ?? []
        prev.push(n)
        m.set(k, prev)
      }
    }
    return m
  }, [novedadesActivas, dias])

  const exportar = () => {
    if (!empleados.length) return
    exportarAsistenciaPlanillaXlsx({
      empleados,
      dias,
      novedades: novedadesActivas,
      fechaDesde,
      fechaHasta,
      stats: statsLista,
      extraPorDia,
      extraAcumulado,
      valorHora
    })
  }

  type CeldaRender = {
    cls: string
    contenido: React.ReactNode
    title: string
    onClick?: () => void
  }

  const cerrarDetalleAsistencia = () => {
    setAsistenciaDetalle(null)
    setAsistenciaDetalleExtra(null)
    setAsistenciaDetalleAcum(null)
    setAclaracionDraft('')
    setAclaracionError(null)
    setAclaracionOk(false)
    setEditEntrada('')
    setEditSalida('')
    setEditTipo('normal')
    setEditError(null)
    setEditOk(false)
    setDeletingAsistencia(false)
  }

  const argentinaHoraToTs = (fecha: string, hhmm: string): string | null => {
    const t = hhmm.trim()
    if (!t) return null
    if (!/^\d{2}:\d{2}$/.test(t)) return null
    return `${fecha.slice(0, 10)}T${t}:00-03:00`
  }

  const calcHorasTrabajadas = (entradaTs: string | null, salidaTs: string | null): number | null => {
    if (!entradaTs || !salidaTs) return null
    const e = new Date(entradaTs).getTime()
    const s = new Date(salidaTs).getTime()
    if (!Number.isFinite(e) || !Number.isFinite(s) || s < e) return null
    return Math.round(((s - e) / 3_600_000) * 100) / 100
  }

  const guardarEdicionAsistencia = async () => {
    if (!asistenciaDetalle || !isAdmin) return
    if (asistenciaDetalle.id <= 0) {
      setEditError('Este día no tiene un registro guardado para editar.')
      return
    }
    setEditSaving(true)
    setEditError(null)
    setEditOk(false)
    try {
      const horaEntrada = argentinaHoraToTs(asistenciaDetalle.fecha, editEntrada)
      const horaSalida = argentinaHoraToTs(asistenciaDetalle.fecha, editSalida)
      if (editEntrada.trim() && !horaEntrada) {
        setEditError('Entrada inválida. Usá formato HH:MM.')
        return
      }
      if (editSalida.trim() && !horaSalida) {
        setEditError('Salida inválida. Usá formato HH:MM.')
        return
      }
      if (editTipo !== 'ausente' && editTipo !== 'justificado' && !horaEntrada) {
        setEditError('La hora de entrada es obligatoria.')
        return
      }
      const horasTrabajadas = calcHorasTrabajadas(horaEntrada, horaSalida)
      const res = await apiService.actualizarAsistencia({
        id: asistenciaDetalle.id,
        horaEntrada,
        horaSalida,
        horasTrabajadas,
        tipoRegistro: editTipo
      })
      if (!res.success) {
        setEditError(res.error || 'No se pudo guardar el registro.')
        return
      }
      setAsistenciaDetalle({
        ...asistenciaDetalle,
        hora_entrada: horaEntrada,
        hora_salida: horaSalida,
        horas_trabajadas: horasTrabajadas,
        tipo_registro: editTipo
      })
      setEditOk(true)
      onAsistenciaActualizada()
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'No se pudo guardar el registro.')
    } finally {
      setEditSaving(false)
    }
  }

  const eliminarRegistroAsistencia = async () => {
    if (!asistenciaDetalle || !isAdmin || asistenciaDetalle.id <= 0) return
    const nombre =
      asistenciaDetalle.nombre_usuario || nombres.get(asistenciaDetalle.id_usuario) || 'el empleado'
    const fechaLabel = new Date(asistenciaDetalle.fecha).toLocaleDateString('es-AR')
    if (
      !window.confirm(
        `¿Eliminar la asistencia de ${nombre} del ${fechaLabel}?\nEsta acción no se puede deshacer.`
      )
    ) {
      return
    }
    setDeletingAsistencia(true)
    setEditError(null)
    try {
      const res = await apiService.eliminarAsistencia(asistenciaDetalle.id)
      if (!res.success) {
        setEditError(res.error || 'No se pudo eliminar el registro.')
        return
      }
      cerrarDetalleAsistencia()
      onAsistenciaActualizada()
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'No se pudo eliminar el registro.')
    } finally {
      setDeletingAsistencia(false)
    }
  }

  const guardarAclaracion = async () => {
    if (!asistenciaDetalle) return
    setAclaracionSaving(true)
    setAclaracionError(null)
    setAclaracionOk(false)
    try {
      const { sistema } = parseAsistenciaObservaciones(asistenciaDetalle.observaciones)
      const observaciones = joinAsistenciaObservaciones(sistema, aclaracionDraft)
      const res = await apiService.guardarObservacionesAsistencia({
        id: asistenciaDetalle.id,
        idUsuario: asistenciaDetalle.id_usuario,
        fecha: asistenciaDetalle.fecha,
        horaEntrada: asistenciaDetalle.hora_entrada,
        horaSalida: asistenciaDetalle.hora_salida,
        horasTrabajadas: asistenciaDetalle.horas_trabajadas,
        tipoRegistro: asistenciaDetalle.tipo_registro,
        observaciones
      })
      if (!res.success || !res.data) {
        setAclaracionError(res.error || 'No se pudo guardar la aclaración.')
        return
      }
      setAsistenciaDetalle({
        ...asistenciaDetalle,
        id: res.data,
        observaciones
      })
      setAclaracionOk(true)
      onAsistenciaActualizada()
    } catch (err) {
      setAclaracionError(err instanceof Error ? err.message : 'No se pudo guardar la aclaración.')
    } finally {
      setAclaracionSaving(false)
    }
  }

  const notaBadge = (obs: string | null | undefined) =>
    tieneAclaracionAsistencia(obs) ? (
      <span className="celda-nota" title="Hay una aclaración">
        ✎
      </span>
    ) : null

  const renderCelda = (empId: number, f: string, a: Asistencia | undefined): CeldaRender => {
    const novs = novedadesPorUsuarioDia.get(`${empId}|${f}`) ?? []
    const finde = !esDiaHabil(f)
    const horario = horariosPorMes[f.slice(0, 7)]?.[empId] ?? null
    const ev = evaluarDiaAsistencia({
      idUsuario: empId,
      fecha: f,
      asistencia: a,
      novedades: novs,
      horario
    })
    const det = ev.extraDet

    const abrirDetalle = (reg: Asistencia) => {
      setAsistenciaDetalle(reg)
      setAsistenciaDetalleExtra(det.total)
      setAsistenciaDetalleAcum(extraAcumulado.get(empId)?.get(f) ?? det.total)
      setAclaracionDraft(parseAsistenciaObservaciones(reg.observaciones).aclaracion)
      setAclaracionError(null)
      setAclaracionOk(false)
      setEditEntrada(asistenciaHoraCorta(reg.hora_entrada))
      setEditSalida(asistenciaHoraCorta(reg.hora_salida))
      setEditTipo(reg.tipo_registro)
      setEditError(null)
      setEditOk(false)
    }

    const acum = extraAcumulado.get(empId)?.get(f) ?? 0
    const extraBadge = (detTotal: number) =>
      detTotal > 0 || acum > 0 ? (
        <>
          {detTotal > 0 ? <span className="celda-extra-hs">+{detTotal.toFixed(1)}</span> : null}
          {acum > 0 ? <span className="celda-extra-acum">Σ{acum.toFixed(1)}</span> : null}
        </>
      ) : null

    if (a && (ev.esAusenciaInjustificada || ev.esJustificado)) {
      const nov = novs.find((n) => n.grupo === 'falta' || n.grupo === 'licencia') ?? novs[0]
      const label = nov
        ? abreviaturaCodigoNovedad(nov.codigo)
        : ev.esJustificado
          ? 'JUS'
          : 'AUS'
      return {
        cls: `celda-aus${nov ? ' celda-nov-vinc' : ''}`,
        contenido: (
          <>
            <span className="celda-nov-label">{label}</span>
            {notaBadge(a.observaciones)}
          </>
        ),
        title: [nov ? etiquetaCodigoRrhhNovedad(nov.codigo) : a.tipo_registro, a.observaciones, nov?.observaciones]
          .filter(Boolean)
          .join(' · '),
        onClick: () => abrirDetalle(a)
      }
    }

    if (a) {
      const e = asistenciaHoraCorta(a.hora_entrada)
      const s = asistenciaHoraCorta(a.hora_salida)
      const tardeNov = novs.find((n) => n.codigo === 'tardanza')
      return {
        cls: `${ev.esTarde || a.tipo_registro === 'tarde' || tardeNov ? 'celda-tarde' : 'celda-ok'}${!s && e ? ' celda-sin-salida' : ''}${det.total > 0 ? ' celda-con-extra' : ''}`,
        contenido: (
          <>
            <span className="celda-h celda-h-entrada">{e || '—'}</span>
            <span className="celda-h celda-h-salida">{s || '—'}</span>
            {extraBadge(det.total)}
            {(ev.esTarde || tardeNov) ? <span className="celda-nov-mini">T</span> : null}
            {notaBadge(a.observaciones)}
          </>
        ),
        title: [
          e && s ? `${e}–${s}` : e ? `Entrada ${e}` : '',
          det.total > 0 ? `Extra del día: ${det.total.toFixed(1)} hs` : '',
          acum > 0 ? `Acumulado: ${acum.toFixed(1)} hs` : '',
          ev.esTarde ? 'Tardanza (automática o novedad)' : '',
          a.observaciones,
          tardeNov ? etiquetaCodigoRrhhNovedad(tardeNov.codigo) : '',
          'Clic para ver detalle'
        ]
          .filter(Boolean)
          .join(' · '),
        onClick: () => abrirDetalle(a)
      }
    }

    if (novs.length) {
      const n =
        novs.find((nv) => nv.grupo === 'falta' || nv.grupo === 'licencia') ??
        novs.find((nv) => nv.codigo === 'tardanza') ??
        novs[0]
      const extraNov = det.total
      if (ev.esAusenciaInjustificada || ev.esJustificado) {
        return {
          cls: `celda-aus celda-nov celda-nov--${n.grupo}`,
          contenido: (
            <>
              <span className="celda-nov-label">{abreviaturaCodigoNovedad(n.codigo)}</span>
              {extraBadge(extraNov)}
            </>
          ),
          title: `${etiquetaCodigoRrhhNovedad(n.codigo)}${n.observaciones ? ` · ${n.observaciones}` : ''}`,
          onClick: () => setNovedadDetalle(n)
        }
      }
      if (ev.esTarde || n.codigo === 'tardanza') {
        return {
          cls: `celda-tarde celda-nov celda-nov--tardanza_retiro${extraNov > 0 ? ' celda-con-extra' : ''}`,
          contenido: (
            <>
              <span className="celda-nov-label">{abreviaturaCodigoNovedad(n.codigo)}</span>
              {extraBadge(extraNov)}
            </>
          ),
          title: `${etiquetaCodigoRrhhNovedad(n.codigo)}${n.observaciones ? ` · ${n.observaciones}` : ''}`,
          onClick: () => setNovedadDetalle(n)
        }
      }
      return {
        cls: `celda-nov celda-nov--${n.grupo}${extraNov > 0 ? ' celda-con-extra' : ''}`,
        contenido: (
          <>
            <span className="celda-nov-label">{abreviaturaCodigoNovedad(n.codigo)}</span>
            {extraBadge(extraNov)}
          </>
        ),
        title: `${etiquetaCodigoRrhhNovedad(n.codigo)}${n.observaciones ? ` · ${n.observaciones}` : ''} (clic para ver novedad)`,
        onClick: () => setNovedadDetalle(n)
      }
    }

    if (finde) {
      return { cls: 'celda-vacia finde', contenido: <span>—</span>, title: 'Fin de semana' }
    }

    return {
      cls: 'celda-sin-marca',
      contenido: <span className="celda-sm">S/M</span>,
      title: 'Sin marca ni novedad registrada'
    }
  }

  return (
    <div className="rrhh-tab-content">
      <div className="rrhh-section-header">
        <h2>Control de Asistencia</h2>
        <div className="rrhh-asistencia-actions">
          {empleados.length > 0 && (
            <button type="button" className="btn-secondary rrhh-btn-oscuro" onClick={exportar}>
              📥 Exportar Excel
            </button>
          )}
          <button type="button" className="btn-secondary rrhh-btn-oscuro" onClick={onIrNovedades}>
            📋 Novedades RRHH
          </button>
        </div>
      </div>

      {asistencia.length === 0 && novedades.length === 0 ? (
        <div className="rrhh-asistencia-list">
          <p>No hay registros de asistencia ni novedades en el período.</p>
        </div>
      ) : (
        <div className="rrhh-asis-planilla">
          <p className="rrhh-asis-help">
            Planilla del período filtrado. Entrada en <strong className="leyenda-entrada">azul</strong>, salida en{' '}
            <strong className="leyenda-salida">violeta</strong>, extra en{' '}
            <strong className="leyenda-extra">verde</strong> (<strong>Σ</strong> = acumulado del mes). Tardanzas en amarillo, ausencias en rojo.
            Tardanzas y faltas se detectan automáticamente desde marcaciones y se sincronizan con novedades del legajo.
            Las horas extra de novedades manuales se suman al acumulado.{' '}
            <strong>S/M</strong> = sin marca en día hábil. Clic en celda para ver detalle y dejar una aclaración.
          </p>
          <div className="rrhh-asis-leyenda">
            <span className="leyenda-entrada">▲ Entrada</span>
            <span className="leyenda-salida">▼ Salida</span>
            <span className="leyenda-ok">✓ A horario</span>
            <span className="leyenda-tarde">⏰ Tarde</span>
            <span className="leyenda-extra">⚡ Extra</span>
            <span className="leyenda-extra">Σ Acumulado</span>
            <span className="leyenda-aus">F.I. / AUS</span>
            <span className="leyenda-nov">Novedad</span>
            <span className="leyenda-sm">S/M sin marca</span>
          </div>
          <div className="rrhh-asis-scroll">
            <table className="rrhh-asis-tabla">
              <thead>
                <tr>
                  <th className="rrhh-asis-sticky">Empleado</th>
                  {dias.map((f) => {
                    const [y, m, d] = f.split('-').map(Number)
                    const dow = new Date(y, m - 1, d).getDay()
                    const finde = dow === 0 || dow === 6
                    return (
                      <th key={f} className={`rrhh-asis-dia ${finde ? 'finde' : ''}`}>
                        <span className="dia-dow">{ASIS_DOW_CORTO[dow]}</span>
                        <span className="dia-num">{d}</span>
                      </th>
                    )
                  })}
                  <th className="rrhh-asis-tot">Hs</th>
                  <th className="rrhh-asis-tot rrhh-asis-tot-extra">Ext Σ</th>
                </tr>
              </thead>
              <tbody>
                {empleados.map((emp) => {
                  const st = statsPorEmpleado.get(emp.id)
                  return (
                  <tr key={emp.id}>
                    <td className="rrhh-asis-sticky rrhh-asis-emp" title={emp.nombre}>{emp.nombre}</td>
                    {dias.map((f) => {
                      const a = emp.dias[f]
                      const cell = renderCelda(emp.id, f, a)
                      const [y, m, d] = f.split('-').map(Number)
                      const dow = new Date(y, m - 1, d).getDay()
                      const finde = dow === 0 || dow === 6
                      let cls = `rrhh-asis-celda ${cell.cls}`
                      if (finde) cls += ' finde'
                      if (cell.onClick) cls += ' celda-click'
                      return (
                        <td key={f} className={cls} title={cell.title} onClick={cell.onClick}>
                          {cell.contenido}
                        </td>
                      )
                    })}
                    <td className="rrhh-asis-tot">{emp.horas ? emp.horas.toFixed(1) : '—'}</td>
                    <td className="rrhh-asis-tot rrhh-asis-tot-extra">
                      {st && st.totalHorasExtra > 0 ? (
                        <>
                          <span>{formatHoras(st.totalHorasExtra)}</span>
                          {valorHora > 0 && st.costoExtra > 0 ? (
                            <span className="rrhh-asis-costo-mini">{formatArs(st.costoExtra)}</span>
                          ) : null}
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                )})}
              </tbody>
            </table>
          </div>
          <LiquidacionHorasExtraPanel
            stats={statsLista}
            valorHora={valorHora}
            onValorHoraChange={guardarValorHora}
            periodoLabel={periodoLabel}
          />
        </div>
      )}

      {novedadDetalle ? (
        <RrhhNovedadDetailModal
          novedad={novedadDetalle}
          empleadoNombre={nombres.get(novedadDetalle.id_usuario) || 'Empleado'}
          onClose={() => setNovedadDetalle(null)}
        />
      ) : null}

      {asistenciaDetalle ? (
        <div className="rrhh-asis-detalle-overlay" onMouseDown={cerrarDetalleAsistencia}>
          <div className="rrhh-asis-detalle-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="rrhh-asis-detalle-head">
              <h3>Registro de asistencia</h3>
              <button type="button" className="rrhh-asis-detalle-close" onClick={cerrarDetalleAsistencia}>
                ✕
              </button>
            </div>
            <dl className="rrhh-asis-detalle-dl">
              <dt>Empleado</dt>
              <dd>{asistenciaDetalle.nombre_usuario || nombres.get(asistenciaDetalle.id_usuario) || '—'}</dd>
              <dt>Fecha</dt>
              <dd>{new Date(asistenciaDetalle.fecha).toLocaleDateString('es-AR')}</dd>
              {!isAdmin ? (
                <>
                  <dt>Entrada</dt>
                  <dd className="leyenda-entrada">{asistenciaHoraCorta(asistenciaDetalle.hora_entrada) || '—'}</dd>
                  <dt>Salida</dt>
                  <dd className="leyenda-salida">{asistenciaHoraCorta(asistenciaDetalle.hora_salida) || '—'}</dd>
                  <dt>Horas</dt>
                  <dd>
                    {asistenciaDetalle.horas_trabajadas != null
                      ? `${asistenciaDetalle.horas_trabajadas.toFixed(1)} hs`
                      : '—'}
                  </dd>
                  <dt>Tipo</dt>
                  <dd>{asistenciaDetalle.tipo_registro}</dd>
                </>
              ) : null}
              {asistenciaDetalleExtra != null && asistenciaDetalleExtra > 0 ? (
                <>
                  <dt>Extra del día</dt>
                  <dd className="leyenda-extra">{formatHoras(asistenciaDetalleExtra)}</dd>
                  {asistenciaDetalleAcum != null ? (
                    <>
                      <dt>Acumulado</dt>
                      <dd className="leyenda-extra">Σ {formatHoras(asistenciaDetalleAcum)}</dd>
                    </>
                  ) : null}
                </>
              ) : null}
              {parseAsistenciaObservaciones(asistenciaDetalle.observaciones).sistema ? (
                <>
                  <dt>Sistema</dt>
                  <dd>{parseAsistenciaObservaciones(asistenciaDetalle.observaciones).sistema}</dd>
                </>
              ) : null}
            </dl>

            {isAdmin ? (
              <form
                className="rrhh-asis-edicion"
                onSubmit={(e) => {
                  e.preventDefault()
                  void guardarEdicionAsistencia()
                }}
              >
                <p className="rrhh-asis-edicion-hint">Admin / gerencia: podés corregir o borrar este registro.</p>
                <div className="rrhh-asis-edicion-grid">
                  <label>
                    Entrada
                    <input
                      type="time"
                      value={editEntrada}
                      onChange={(e) => {
                        setEditEntrada(e.target.value)
                        setEditOk(false)
                        setEditError(null)
                      }}
                    />
                  </label>
                  <label>
                    Salida
                    <input
                      type="time"
                      value={editSalida}
                      onChange={(e) => {
                        setEditSalida(e.target.value)
                        setEditOk(false)
                        setEditError(null)
                      }}
                    />
                  </label>
                  <label>
                    Tipo
                    <select
                      value={editTipo}
                      onChange={(e) => {
                        setEditTipo(e.target.value as Asistencia['tipo_registro'])
                        setEditOk(false)
                        setEditError(null)
                      }}
                    >
                      <option value="normal">Normal</option>
                      <option value="tarde">Tarde</option>
                      <option value="ausente">Ausente</option>
                      <option value="justificado">Justificado</option>
                    </select>
                  </label>
                  <div className="rrhh-asis-edicion-horas">
                    <span>Horas</span>
                    <strong>
                      {(() => {
                        const e = argentinaHoraToTs(asistenciaDetalle.fecha, editEntrada)
                        const s = argentinaHoraToTs(asistenciaDetalle.fecha, editSalida)
                        const h = calcHorasTrabajadas(e, s)
                        return h != null ? `${h.toFixed(1)} hs` : '—'
                      })()}
                    </strong>
                  </div>
                </div>
                <div className="rrhh-asis-edicion-actions">
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={editSaving || deletingAsistencia || asistenciaDetalle.id <= 0}
                  >
                    {editSaving ? 'Guardando…' : 'Guardar cambios'}
                  </button>
                  <button
                    type="button"
                    className="rrhh-asis-btn-eliminar"
                    disabled={editSaving || deletingAsistencia || asistenciaDetalle.id <= 0}
                    onClick={() => void eliminarRegistroAsistencia()}
                  >
                    {deletingAsistencia ? 'Eliminando…' : 'Eliminar registro'}
                  </button>
                  {editOk ? <span className="rrhh-asis-aclaracion-ok">Guardado</span> : null}
                </div>
                {editError ? <p className="rrhh-asis-aclaracion-error">{editError}</p> : null}
              </form>
            ) : null}

            <form
              className="rrhh-asis-aclaracion"
              onSubmit={(e) => {
                e.preventDefault()
                void guardarAclaracion()
              }}
            >
              <label htmlFor="rrhh-asis-aclaracion">Aclaración</label>
              <textarea
                id="rrhh-asis-aclaracion"
                rows={3}
                value={aclaracionDraft}
                onChange={(e) => {
                  setAclaracionDraft(e.target.value)
                  setAclaracionOk(false)
                }}
                placeholder="Ej: salió a las 08:07 por trámite; reingresó después."
                maxLength={500}
              />
              <div className="rrhh-asis-aclaracion-actions">
                <button type="submit" className="btn-primary" disabled={aclaracionSaving}>
                  {aclaracionSaving ? 'Guardando…' : 'Guardar aclaración'}
                </button>
                {aclaracionOk ? <span className="rrhh-asis-aclaracion-ok">Guardada</span> : null}
              </div>
              {aclaracionError ? <p className="rrhh-asis-aclaracion-error">{aclaracionError}</p> : null}
            </form>
          </div>
        </div>
      ) : null}
    </div>
  )
}

const nombreCortoStats = (n: string) => {
  const parts = n.split(/\s+/)
  return parts.length > 2 ? `${parts[0]} ${parts[1]}` : n
}

const EstadisticasAsistenciaTab = ({
  usuarios,
  usuarioSeleccionado
}: {
  usuarios: UsuarioRecord[]
  usuarioSeleccionado: number | null
}) => {
  const [modo, setModo] = useState<'mes' | 'anio'>('mes')
  const [mes, setMes] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const [anio, setAnio] = useState(() => String(new Date().getFullYear()))
  const [asistencia, setAsistencia] = useState<Asistencia[]>([])
  const [novedades, setNovedades] = useState<RrhhNovedad[]>([])
  const [horariosPorMes, setHorariosPorMes] = useState<Record<string, Record<number, HorarioFijoAsistencia>>>({})
  const [horarioFallback, setHorarioFallback] = useState<Record<number, HorarioFijoAsistencia>>({})
  const [legajos, setLegajos] = useState<Record<number, { nombre: string; apellido: string }>>({})
  const [cargando, setCargando] = useState(true)
  const [valorHora, setValorHora] = useState<number>(() => {
    try {
      const v = localStorage.getItem(LS_VALOR_HORA_EXTRA)
      return v ? Math.max(0, Number(v)) : 0
    } catch {
      return 0
    }
  })

  const guardarValorHora = (v: number) => {
    setValorHora(v)
    try {
      localStorage.setItem(LS_VALOR_HORA_EXTRA, String(v))
    } catch {
      /* ignore */
    }
  }

  const periodo = useMemo(() => {
    if (modo === 'mes') {
      return { desde: `${mes}-01`, hasta: ultimoDiaMes(mes) }
    }
    return { desde: `${anio}-01-01`, hasta: `${anio}-12-31` }
  }, [modo, mes, anio])

  useEffect(() => {
    let cancelado = false
    setCargando(true)
    const { desde, hasta } = periodo

    const horariosPromise =
      modo === 'mes'
        ? apiService.obtenerHorariosFijos(mes).then((r) => (r.success && r.data ? { [mes]: r.data } : {}))
        : Promise.all(
            Array.from({ length: 12 }, (_, i) => {
              const m = `${anio}-${pad2(i + 1)}`
              return apiService.obtenerHorariosFijos(m).then((r) => ({ mes: m, data: r.success ? r.data : null }))
            })
          ).then((rows) => {
            const map: Record<string, NonNullable<Awaited<ReturnType<typeof apiService.obtenerHorariosFijos>>['data']>> = {}
            for (const row of rows) {
              if (row.data) map[row.mes] = row.data
            }
            return map
          })

    const tabletPromise = (async (): Promise<TabletMarcacionParaStats[]> => {
      try {
        const token = getStaffAuthToken()
        const resp = await plotLabFetch(
          `/api/rrhh/reloj-tablet-marcaciones?desde=${encodeURIComponent(desde)}&hasta=${encodeURIComponent(hasta)}`,
          { headers: token ? { Authorization: `Bearer ${token}` } : {} }
        )
        const json = (await resp.json()) as {
          success?: boolean
          data?: Array<{ id_usuario: number; tipo: string; marcado_at: string; empleado?: string | null }>
        }
        if (!resp.ok || !json.success || !json.data) return []
        let rows = json.data
        if (usuarioSeleccionado != null) {
          rows = rows.filter((r) => r.id_usuario === usuarioSeleccionado)
        }
        return rows.map((r) => ({
          id_usuario: r.id_usuario,
          tipo: r.tipo,
          marcado_at: r.marcado_at,
          empleado: r.empleado
        }))
      } catch {
        return []
      }
    })()

    Promise.all([
      apiService.obtenerAsistencia(usuarioSeleccionado, desde, hasta),
      apiService.rrhhNovedadesListar({
        idUsuario: usuarioSeleccionado ?? undefined,
        fechaDesde: desde,
        fechaHasta: hasta
      }),
      apiService.obtenerLegajosBasico(),
      horariosPromise,
      tabletPromise
    ]).then(([ra, rn, rl, rhMap, tabletRows]) => {
      if (cancelado) return
      const baseAsis = ra.success && ra.data ? ra.data : []
      setAsistencia(mergeTabletMarcacionesIntoAsistencia(baseAsis, tabletRows))
      setNovedades(rn.success && rn.data ? rn.data : [])
      if (rl.success && rl.data) {
        const map: Record<number, { nombre: string; apellido: string }> = {}
        for (const [id, row] of Object.entries(rl.data)) {
          map[Number(id)] = { nombre: row.nombre, apellido: row.apellido }
        }
        setLegajos(map)
      }
      if (rhMap && typeof rhMap === 'object') {
        const mapMes: Record<string, Record<number, HorarioFijoAsistencia>> = {}
        let fb: Record<number, HorarioFijoAsistencia> = {}
        for (const [mesKey, rhData] of Object.entries(rhMap)) {
          if (!rhData) continue
          const entradas: Record<number, HorarioFijoAsistencia> = {}
          for (const [id, h] of Object.entries(rhData)) {
            if (h.entrada) {
              entradas[Number(id)] = {
                entrada: h.entrada,
                salida: h.salida,
                horas: h.horas,
                trabajaSabado: h.trabajaSabado,
                sabadoEntrada: h.sabadoEntrada,
                sabadoSalida: h.sabadoSalida
              }
            }
          }
          mapMes[mesKey] = entradas
          fb = { ...fb, ...entradas }
        }
        setHorariosPorMes(mapMes)
        setHorarioFallback(fb)
      }
      setCargando(false)
    })

    return () => {
      cancelado = true
    }
  }, [periodo, usuarioSeleccionado, modo, mes, anio])

  const nombres = useMemo(() => {
    const m = new Map<number, string>()
    usuarios.forEach((u) => m.set(u.id, etiquetaUsuarioNombre(u.nombre, u.id)))
    asistencia.forEach((a) => {
      if (a.nombre_usuario) m.set(a.id_usuario, etiquetaUsuarioNombre(a.nombre_usuario, a.id_usuario))
    })
    for (const [id, l] of Object.entries(legajos)) {
      const full = `${(l.nombre || '').trim()} ${(l.apellido || '').trim()}`.trim()
      if (full) m.set(Number(id), full)
    }
    return m
  }, [usuarios, asistencia, legajos])

  const dias = useMemo(() => diasEntre(periodo.desde, periodo.hasta), [periodo])

  const idsConHorario = useMemo(() => {
    const activos = new Set(usuarios.map((u) => u.id))
    const ids = new Set<number>()
    for (const mesMap of Object.values(horariosPorMes)) {
      for (const id of Object.keys(mesMap)) {
        const n = Number(id)
        if (activos.has(n)) ids.add(n)
      }
    }
    for (const id of Object.keys(horarioFallback)) {
      const n = Number(id)
      if (activos.has(n)) ids.add(n)
    }
    if (usuarioSeleccionado != null) {
      return ids.has(usuarioSeleccionado) ? [usuarioSeleccionado] : []
    }
    return [...ids]
  }, [horariosPorMes, horarioFallback, usuarioSeleccionado, usuarios])

  const stats = useMemo(() => {
    const activos = new Set(usuarios.map((u) => u.id))
    return calcularStatsAsistencia({
      asistencia: asistencia.filter((a) => activos.has(a.id_usuario)),
      novedades: novedades.filter((n) => activos.has(n.id_usuario)),
      dias,
      nombres,
      horariosPorMes,
      horarioFallback,
      idsConHorario,
      valorHoraBase: valorHora
    })
  }, [asistencia, novedades, dias, nombres, horariosPorMes, horarioFallback, idsConHorario, valorHora, usuarios])

  const rankingExtra = useMemo(
    () => [...stats].filter((s) => s.totalHorasExtra > 0).sort((a, b) => b.totalHorasExtra - a.totalHorasExtra),
    [stats]
  )

  const ranking = useMemo(() => rankingPuntualidad(stats), [stats])
  const totales = useMemo(() => totalesStats(stats), [stats])

  const chartDistribucion = useMemo(() => {
    let puntual = 0
    let tarde = 0
    let ausente = 0
    let sinMarca = 0
    for (const s of stats) {
      puntual += Math.max(0, s.diasConEntrada - s.tardanzas)
      tarde += s.tardanzas
      ausente += s.ausencias + s.justificados
      sinMarca += s.sinMarca
    }
    return [
      { name: 'A horario', value: puntual, color: '#22c55e' },
      { name: 'Tarde', value: tarde, color: '#f59e0b' },
      { name: 'Ausente / lic.', value: ausente, color: '#ef4444' },
      { name: 'Sin marca', value: sinMarca, color: '#64748b' }
    ].filter((d) => d.value > 0)
  }, [stats])

  const chartHoras = useMemo(
    () =>
      [...stats]
        .filter((s) => s.totalHoras > 0)
        .sort((a, b) => b.totalHoras - a.totalHoras)
        .slice(0, 12)
        .map((s) => ({ nombre: nombreCortoStats(s.nombre), Horas: Math.round(s.totalHoras * 10) / 10 })),
    [stats]
  )

  const chartExtra = useMemo(
    () =>
      rankingExtra.slice(0, 12).map((s) => ({
        nombre: nombreCortoStats(s.nombre),
        Extra: Math.round(s.totalHorasExtra * 10) / 10
      })),
    [rankingExtra]
  )

  const periodoLabel =
    modo === 'mes'
      ? new Date(`${mes}-01T12:00:00`).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
      : `Año ${anio}`

  const renderRanking = (lista: StatsEmpleadoAsistencia[], titulo: string) => (
    <div className="rrhh-stats-ranking">
      <h3>{titulo}</h3>
      {lista.length === 0 ? (
        <p className="rrhh-stats-empty">Sin datos de puntualidad en el período.</p>
      ) : (
        <div className="reloj-ranking-list">
          {lista.map((e, i) => (
            <div key={e.id} className="reloj-ranking-item">
              <span className={`reloj-rank-pos reloj-rank-${Math.min(i + 1, 3)}`}>{i + 1}</span>
              <span className="reloj-rank-nombre" title={e.nombre}>
                {e.nombre}
              </span>
              <div className="reloj-rank-bar-wrap">
                <div
                  className="reloj-rank-bar"
                  style={{
                    width: `${e.puntualidadPct}%`,
                    background:
                      e.puntualidadPct >= 90 ? '#22c55e' : e.puntualidadPct >= 70 ? '#f59e0b' : '#ef4444'
                  }}
                />
              </div>
              <span className="reloj-rank-pct">{e.puntualidadPct}%</span>
              <span className="reloj-rank-detalle">
                {e.tardanzas} tarde · {e.ausencias} aus. · {formatHoras(e.totalHorasExtra)} ext.
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  return (
    <div className="rrhh-tab-content rrhh-stats-tab">
      <div className="rrhh-section-header">
        <h2>📊 Estadísticas de asistencia</h2>
        <div className="rrhh-stats-controls">
          <div className="rrhh-stats-modo">
            <button
              type="button"
              className={`rrhh-stats-modo-btn${modo === 'mes' ? ' active' : ''}`}
              onClick={() => setModo('mes')}
            >
              Por mes
            </button>
            <button
              type="button"
              className={`rrhh-stats-modo-btn${modo === 'anio' ? ' active' : ''}`}
              onClick={() => setModo('anio')}
            >
              Por año
            </button>
          </div>
          {modo === 'mes' ? (
            <label className="rrhh-stats-periodo">
              Mes:
              <input type="month" value={mes} onChange={(e) => setMes(e.target.value)} />
            </label>
          ) : (
            <label className="rrhh-stats-periodo">
              Año:
              <input
                type="number"
                min={2020}
                max={2100}
                value={anio}
                onChange={(e) => setAnio(e.target.value)}
              />
            </label>
          )}
        </div>
      </div>

      <p className="rrhh-stats-subtitle">
        Período: <strong>{periodoLabel}</strong>
        {usuarioSeleccionado ? ` · Empleado filtrado` : ' · Todos los empleados'}
        <br />
        Puntualidad y tardanzas: marcas de{' '}
        <strong>reloj facial / tablet</strong> (y asistencia) vs{' '}
        <strong>Horarios reloj</strong> (tolerancia 15 min).
      </p>

      {cargando ? (
        <div className="rrhh-stats-loading">Cargando estadísticas…</div>
      ) : stats.length === 0 ? (
        <p className="rrhh-stats-empty">No hay registros de asistencia en el período seleccionado.</p>
      ) : (
        <>
          <div className="rrhh-stats-kpis">
            <div className="rrhh-stats-kpi">
              <span className="rrhh-stats-kpi-val">{totales.empleados}</span>
              <span className="rrhh-stats-kpi-lbl">Empleados</span>
            </div>
            <div className="rrhh-stats-kpi rrhh-stats-kpi--ok">
              <span className="rrhh-stats-kpi-val">{totales.promedioPuntualidad}%</span>
              <span className="rrhh-stats-kpi-lbl">Puntualidad prom.</span>
            </div>
            <div className="rrhh-stats-kpi rrhh-stats-kpi--warn">
              <span className="rrhh-stats-kpi-val">{totales.totalTardanzas}</span>
              <span className="rrhh-stats-kpi-lbl">Tardanzas</span>
            </div>
            <div className="rrhh-stats-kpi rrhh-stats-kpi--bad">
              <span className="rrhh-stats-kpi-val">{totales.totalAusencias}</span>
              <span className="rrhh-stats-kpi-lbl">Ausencias</span>
            </div>
            <div className="rrhh-stats-kpi">
              <span className="rrhh-stats-kpi-val">{totales.totalJustificados}</span>
              <span className="rrhh-stats-kpi-lbl">Justificados</span>
            </div>
            <div className="rrhh-stats-kpi">
              <span className="rrhh-stats-kpi-val">{totales.totalSinMarca}</span>
              <span className="rrhh-stats-kpi-lbl">Sin marca</span>
            </div>
            <div className="rrhh-stats-kpi rrhh-stats-kpi--extra">
              <span className="rrhh-stats-kpi-val">{formatHoras(totales.totalHorasExtra)}</span>
              <span className="rrhh-stats-kpi-lbl">Horas extra</span>
            </div>
            {valorHora > 0 && totales.costoExtraTotal > 0 ? (
              <div className="rrhh-stats-kpi rrhh-stats-kpi--extra">
                <span className="rrhh-stats-kpi-val">{formatArs(totales.costoExtraTotal)}</span>
                <span className="rrhh-stats-kpi-lbl">Costo extra</span>
              </div>
            ) : null}
            <div className="rrhh-stats-kpi">
              <span className="rrhh-stats-kpi-val">{totales.totalHoras}</span>
              <span className="rrhh-stats-kpi-lbl">Horas totales</span>
            </div>
          </div>

          <div className="rrhh-stats-grid">
            {renderRanking(ranking.slice(0, 10), '🏆 Top 10 más puntuales')}
            {renderRanking(
              [...ranking].reverse().slice(0, 10),
              '⚠️ Menor puntualidad'
            )}
            {rankingExtra.length > 0 && (
              <div className="rrhh-stats-ranking">
                <h3>⚡ Más horas extra</h3>
                <div className="reloj-ranking-list">
                  {rankingExtra.slice(0, 10).map((e, i) => (
                    <div key={e.id} className="reloj-ranking-item">
                      <span className={`reloj-rank-pos reloj-rank-${Math.min(i + 1, 3)}`}>{i + 1}</span>
                      <span className="reloj-rank-nombre" title={e.nombre}>
                        {e.nombre}
                      </span>
                      <div className="reloj-rank-bar-wrap">
                        <div
                          className="reloj-rank-bar"
                          style={{
                            width: `${Math.min(100, (e.totalHorasExtra / (rankingExtra[0]?.totalHorasExtra || 1)) * 100)}%`,
                            background: '#10b981'
                          }}
                        />
                      </div>
                      <span className="reloj-rank-pct leyenda-extra">{formatHoras(e.totalHorasExtra)}</span>
                      <span className="reloj-rank-detalle">{e.totalHoras.toFixed(0)} hs totales</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="rrhh-stats-charts">
            {chartDistribucion.length > 0 && (
              <div className="rrhh-stats-chart-card">
                <h3>Distribución del período</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={chartDistribucion}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {chartDistribucion.map((d) => (
                        <Cell key={d.name} fill={d.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
            {chartHoras.length > 0 && (
              <div className="rrhh-stats-chart-card">
                <h3>Horas trabajadas (top 12)</h3>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={chartHoras} layout="vertical" margin={{ left: 8, right: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.08)" />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="nombre" width={90} tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="Horas" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            {chartExtra.length > 0 && (
              <div className="rrhh-stats-chart-card">
                <h3>Horas extra (top 12)</h3>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={chartExtra} layout="vertical" margin={{ left: 8, right: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.08)" />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="nombre" width={90} tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="Extra" fill="#10b981" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="rrhh-stats-tabla-wrap">
            <h3>Detalle por empleado</h3>
            <table className="rrhh-stats-tabla">
              <thead>
                <tr>
                  <th>Empleado</th>
                  <th>Días c/ entrada</th>
                  <th>Puntualidad</th>
                  <th>Tardanzas</th>
                  <th>Ausencias</th>
                  <th>Justificados</th>
                  <th>Sin marca</th>
                  <th>Horas</th>
                  <th>Extra</th>
                  <th>HE 50%</th>
                  <th>HE 100%</th>
                  {valorHora > 0 ? <th>Costo extra</th> : null}
                </tr>
              </thead>
              <tbody>
                {ranking.map((s) => (
                  <tr key={s.id}>
                    <td className="rrhh-stats-emp">{s.nombre}</td>
                    <td>{s.diasConEntrada || '—'}</td>
                    <td>
                      <span
                        className="rrhh-stats-pct"
                        style={{
                          color: s.puntualidadPct >= 90 ? '#16a34a' : s.puntualidadPct >= 70 ? '#d97706' : '#dc2626'
                        }}
                      >
                        {s.diasConEntrada ? `${s.puntualidadPct}%` : '—'}
                      </span>
                    </td>
                    <td>{s.tardanzas || '—'}</td>
                    <td>{s.ausencias || '—'}</td>
                    <td>{s.justificados || '—'}</td>
                    <td>{s.sinMarca || '—'}</td>
                    <td>{s.totalHoras ? s.totalHoras.toFixed(1) : '—'}</td>
                    <td className="leyenda-extra">{s.totalHorasExtra > 0 ? formatHoras(s.totalHorasExtra) : '—'}</td>
                    <td className={s.extra50 > 0 ? 'rrhh-extra-he50' : 'rrhh-extra-vacio'}>
                      {s.extra50 > 0 ? `${s.extra50.toFixed(1)} hs` : '—'}
                    </td>
                    <td className={s.extra100 > 0 ? 'rrhh-extra-he100' : 'rrhh-extra-vacio'}>
                      {s.extra100 > 0 ? `${s.extra100.toFixed(1)} hs` : '—'}
                    </td>
                    {valorHora > 0 ? (
                      <td className="rrhh-extra-costo">{s.costoExtra > 0 ? formatArs(s.costoExtra) : '—'}</td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <LiquidacionHorasExtraPanel
            stats={stats}
            valorHora={valorHora}
            onValorHoraChange={guardarValorHora}
            periodoLabel={periodoLabel}
          />
        </>
      )}
    </div>
  )
}

export default RecursosHumanosHorariosPage

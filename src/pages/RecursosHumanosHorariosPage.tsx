import { useState, useEffect, useMemo, useRef, Fragment } from 'react'
import { useNavigate } from 'react-router-dom'
import { marked } from 'marked'
import { sanitizeHtml } from '../utils/sanitizeHtml'
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
import type { UsuarioRecord, HorarioEmpleado, Turno, Ausencia, Asistencia } from '../types/api'
import {
  procesarArchivoReloj,
  exportarRelojXlsx,
  exportarResumenXlsx,
  generarInformeAsistenciaIa,
  construirRegistrosAsistencia,
  construirTardanzas,
  construirPlanilla,
  planillaToMarcaciones,
  procesarMarcaciones,
  construirMapaHorariosFijos,
  parsearHorariosReales,
  diasDelPeriodo,
  matchearUsuario,
  formatHoras,
  CONFIG_CALCULO_DEFAULT,
  type ResumenEmpleado,
  type ConfigCalculo,
  type MarcacionReloj,
  type PlanillaEmpleado
} from '../services/relojBiometricoService'
import './RecursosHumanosHorariosPage.css'

type TabType = 'horarios' | 'turnos' | 'ausencias' | 'asistencia' | 'reportes' | 'reloj'

const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

const RecursosHumanosHorariosPage = () => {
  const navigate = useNavigate()
  const { canManageRecursosHumanos, usuario, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabType>('horarios')
  
  // Datos
  const [usuarios, setUsuarios] = useState<UsuarioRecord[]>([])
  const [horarios, setHorarios] = useState<HorarioEmpleado[]>([])
  const [turnos, setTurnos] = useState<Turno[]>([])
  const [ausencias, setAusencias] = useState<Ausencia[]>([])
  const [asistencia, setAsistencia] = useState<Asistencia[]>([])
  
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
    if (activeTab === 'horarios') {
      loadHorarios()
    } else if (activeTab === 'turnos') {
      loadTurnos()
    } else if (activeTab === 'ausencias') {
      loadAusencias()
    } else if (activeTab === 'asistencia') {
      loadAsistencia()
    }
  }, [activeTab, usuarioSeleccionado, fechaDesde, fechaHasta])

  const loadInitialData = async () => {
    setLoading(true)
    try {
      const usuariosResponse = await apiService.getUsuarios()
      if (usuariosResponse.success && usuariosResponse.data) {
        setUsuarios(usuariosResponse.data)
      }
    } catch (error) {
      console.error('Error cargando datos:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadHorarios = async () => {
    if (!usuarioSeleccionado) return
    try {
      const response = await apiService.obtenerHorariosUsuario(usuarioSeleccionado)
      if (response.success && response.data) {
        setHorarios(response.data)
      }
    } catch (error) {
      console.error('Error cargando horarios:', error)
    }
  }

  const loadTurnos = async () => {
    try {
      const response = await apiService.obtenerTurnos(usuarioSeleccionado, fechaDesde, fechaHasta)
      if (response.success && response.data) {
        setTurnos(response.data)
      }
    } catch (error) {
      console.error('Error cargando turnos:', error)
    }
  }

  const loadAusencias = async () => {
    try {
      const response = await apiService.obtenerAusencias(usuarioSeleccionado, fechaDesde, fechaHasta, null)
      if (response.success && response.data) {
        setAusencias(response.data)
      }
    } catch (error) {
      console.error('Error cargando ausencias:', error)
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

  const handleEliminarAsistencia = async (id: number) => {
    try {
      const response = await apiService.eliminarAsistencia(id)
      if (response.success) {
        loadAsistencia()
      } else {
        alert('Error al eliminar: ' + (response.error || ''))
      }
    } catch (error) {
      alert('Error al eliminar el registro')
      console.error(error)
    }
  }

  const handleMarcarEntrada = async () => {
    if (!usuario) return
    try {
      const response = await apiService.registrarEntrada(usuario.id)
      if (response.success) {
        alert('Entrada registrada correctamente')
        loadAsistencia()
      } else {
        alert('Error: ' + response.error)
      }
    } catch (error) {
      alert('Error al registrar entrada')
      console.error(error)
    }
  }

  const handleMarcarSalida = async () => {
    if (!usuario) return
    try {
      const response = await apiService.registrarSalida(usuario.id)
      if (response.success) {
        alert('Salida registrada correctamente')
        loadAsistencia()
      } else {
        alert('Error: ' + response.error)
      }
    } catch (error) {
      alert('Error al registrar salida')
      console.error(error)
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
            📅 Horarios
          </button>
          <button
            className={`rrhh-tab ${activeTab === 'turnos' ? 'active' : ''}`}
            onClick={() => setActiveTab('turnos')}
          >
            🗓️ Turnos
          </button>
          <button
            className={`rrhh-tab ${activeTab === 'ausencias' ? 'active' : ''}`}
            onClick={() => setActiveTab('ausencias')}
          >
            🏖️ Ausencias
          </button>
          <button
            className={`rrhh-tab ${activeTab === 'asistencia' ? 'active' : ''}`}
            onClick={() => setActiveTab('asistencia')}
          >
            ✅ Asistencia
          </button>
          <button
            className={`rrhh-tab ${activeTab === 'reportes' ? 'active' : ''}`}
            onClick={() => setActiveTab('reportes')}
          >
            📊 Reportes
          </button>
          <button
            className={`rrhh-tab ${activeTab === 'reloj' ? 'active' : ''}`}
            onClick={() => setActiveTab('reloj')}
          >
            🕒 Importar Reloj
          </button>
        </div>

        {/* Filtros */}
        {activeTab !== 'reloj' && (
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
          {(activeTab === 'turnos' || activeTab === 'ausencias' || activeTab === 'asistencia' || activeTab === 'reportes') && (
            <>
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
            </>
          )}
        </div>
        )}

        {/* Contenido de tabs */}
        {activeTab === 'horarios' && (
          <HorariosTab
            usuarios={usuarios}
            usuarioSeleccionado={usuarioSeleccionado}
            horarios={horarios}
            onLoad={loadHorarios}
          />
        )}

        {activeTab === 'turnos' && (
          <TurnosTab
            usuarios={usuarios}
            turnos={turnos}
            onLoad={loadTurnos}
          />
        )}

        {activeTab === 'ausencias' && (
          <AusenciasTab
            usuarios={usuarios}
            ausencias={ausencias}
            usuario={usuario}
            onLoad={loadAusencias}
          />
        )}

        {activeTab === 'asistencia' && (
          <AsistenciaTab
            asistencia={asistencia}
            usuario={usuario}
            onMarcarEntrada={handleMarcarEntrada}
            onMarcarSalida={handleMarcarSalida}
            onEliminar={handleEliminarAsistencia}
          />
        )}

        {activeTab === 'reportes' && (
          <ReportesTab
            asistencia={asistencia}
            ausencias={ausencias}
            turnos={turnos}
            fechaDesde={fechaDesde}
            fechaHasta={fechaHasta}
          />
        )}

        {activeTab === 'reloj' && (
          <RelojImportTab usuarios={usuarios} usuarioActual={usuario} />
        )}
      </div>
    </div>
  )
}

// ============================================================
// Importar Reloj Biométrico
// ============================================================
const RelojImportTab = ({
  usuarios,
  usuarioActual
}: {
  usuarios: UsuarioRecord[]
  usuarioActual: { id: number } | null
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState('')
  const [config, setConfig] = useState<ConfigCalculo>({ ...CONFIG_CALCULO_DEFAULT })
  const [marcaciones, setMarcaciones] = useState<MarcacionReloj[]>([])
  const [resumenes, setResumenes] = useState<ResumenEmpleado[]>([])
  const [planilla, setPlanilla] = useState<PlanillaEmpleado[]>([])
  const [diasPeriodo, setDiasPeriodo] = useState<string[]>([])
  const [vista, setVista] = useState<'resumen' | 'planilla'>('resumen')
  const [celdaEdit, setCeldaEdit] = useState<{ empKey: string; fecha: string } | null>(null)
  const [empleadoExpandido, setEmpleadoExpandido] = useState<string | null>(null)
  const [procesando, setProcesando] = useState(false)
  const [error, setError] = useState('')
  const [informeIa, setInformeIa] = useState('')
  const [generandoIa, setGenerandoIa] = useState(false)
  const [errorIa, setErrorIa] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [resultadoGuardado, setResultadoGuardado] = useState('')
  const [errorGuardado, setErrorGuardado] = useState('')
  const [registrarTardanzas, setRegistrarTardanzas] = useState(true)

  const [override, setOverride] = useState<Record<string, number>>({})
  // Horarios fijos guardados, por id de usuario de Plot Lab: { entrada, salida, horas } en 'HH:mm'.
  const [horariosFijos, setHorariosFijos] = useState<Record<number, { entrada: string; salida: string; horas?: number | null; trabajaSabado?: boolean }>>({})
  const [guardandoFijo, setGuardandoFijo] = useState<number | null>(null)

  // Importador de horarios reales (planilla "PERSONAL ACTUAL").
  const horariosFileRef = useRef<HTMLInputElement>(null)
  const [prevFijos, setPrevFijos] = useState<
    Array<{ nombre: string; puesto: string; jornada: string; entrada: string; salida: string; horas: number | null; trabajaSabado: boolean; plotLabId: number }> | null
  >(null)
  const [guardandoFijos, setGuardandoFijos] = useState(false)
  const [resFijos, setResFijos] = useState('')

  const usuariosLite = useMemo(
    () => usuarios.map((u) => ({ id: u.id, nombre: u.nombre })),
    [usuarios]
  )

  // Mes (YYYY-MM) del archivo importado: se usa para leer/guardar los horarios
  // fijos de ese mes. Sin archivo, el mes actual.
  const mesActivo = useMemo(() => {
    if (marcaciones.length) {
      const min = new Date(Math.min(...marcaciones.map((m) => m.fechaHora.getTime())))
      return `${min.getFullYear()}-${String(min.getMonth() + 1).padStart(2, '0')}`
    }
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  }, [marcaciones])

  // Cargar horarios fijos del mes activo (persisten hasta que se cambien).
  useEffect(() => {
    let cancelado = false
    apiService.obtenerHorariosFijos(mesActivo).then((r) => {
      if (!cancelado) setHorariosFijos(r.success && r.data ? r.data : {})
    })
    return () => {
      cancelado = true
    }
  }, [mesActivo])

  const usuariosOrdenados = useMemo(
    () => [...usuarios].sort((a, b) => a.nombre.localeCompare(b.nombre)),
    [usuarios]
  )

  // Vínculo efectivo por empleado del reloj: override manual o match automático.
  // Se basa en la planilla (identidad estable de empleados) para no recalcularse
  // en cada recompute de resúmenes y evitar bucles.
  const vinculos = useMemo(() => {
    const map: Record<string, { id: number; nombre: string }> = {}
    for (const emp of planilla) {
      if (emp.idUsuario in override) {
        const id = override[emp.idUsuario]
        const u = usuariosLite.find((x) => x.id === id)
        map[emp.idUsuario] = u ? { id: u.id, nombre: u.nombre } : { id: 0, nombre: '' }
      } else {
        const auto = matchearUsuario(emp.nombre, usuariosLite)
        map[emp.idUsuario] = auto ? { id: auto.id, nombre: auto.nombre } : { id: 0, nombre: '' }
      }
    }
    return map
  }, [planilla, override, usuariosLite])

  // Recompute central: cada vez que cambian la planilla, los vínculos, los
  // horarios fijos o la configuración, recalcula los resúmenes aplicando el
  // horario fijo de cada empleado (entrada esperada + jornada esperada).
  useEffect(() => {
    if (!planilla.length) return
    const mapaFijos = construirMapaHorariosFijos(vinculos, horariosFijos)
    setResumenes(procesarMarcaciones(planillaToMarcaciones(planilla), config, mapaFijos))
  }, [planilla, vinculos, horariosFijos, config])

  const handleGuardar = async () => {
    if (!resumenes.length) return
    const { registros, vinculados, noVinculados } = construirRegistrosAsistencia(resumenes, vinculos)
    if (!registros.length) {
      setErrorGuardado('Ningún empleado del reloj coincide con usuarios de Plot Lab. Verificá los nombres.')
      return
    }
    const aviso =
      `Se guardarán ${registros.length} registros de ${vinculados.length} empleados vinculados.` +
      (noVinculados.length ? `\n\nNo se vincularon (${noVinculados.length}): ${noVinculados.join(', ')}` : '') +
      `\n\n¿Continuar?`
    if (!confirm(aviso)) return

    setGuardando(true)
    setErrorGuardado('')
    setResultadoGuardado('')
    try {
      const resp = await apiService.registrarAsistenciaReloj(registros)
      if (resp.success && resp.data) {
        let msg = `✓ Guardado: ${resp.data.insertados} nuevos, ${resp.data.actualizados} actualizados (${resp.data.total} total).`

        if (registrarTardanzas) {
          const res = await registrarTardanzasEnLegajo()
          if (res.error) {
            msg += ` Tardanzas: ${res.error}`
          } else {
            msg += ` Tardanzas en legajo: ${res.creadas} nuevas${res.omitidas ? `, ${res.omitidas} ya existían` : ''}.`
          }
        }
        setResultadoGuardado(msg)
      } else {
        setErrorGuardado(
          (resp.error || 'No se pudo guardar.') +
            (/function|does not exist|registrar_asistencia_reloj/i.test(resp.error || '')
              ? ' — Falta aplicar la migración 2026-05-29_registrar_asistencia_reloj.sql en Supabase.'
              : '')
        )
      }
    } catch (e) {
      setErrorGuardado(e instanceof Error ? e.message : 'Error al guardar.')
    } finally {
      setGuardando(false)
    }
  }

  /** Registra cada tardanza como novedad RRHH (aparece en el legajo). Evita duplicados por usuario+fecha. */
  const registrarTardanzasEnLegajo = async (): Promise<{ creadas: number; omitidas: number; error?: string }> => {
    const tardanzas = construirTardanzas(resumenes, vinculos)
    if (!tardanzas.length) return { creadas: 0, omitidas: 0 }
    if (!usuarioActual?.id) return { creadas: 0, omitidas: 0, error: 'sin usuario para registrar.' }

    // Fechas ya registradas como tardanza por usuario, para no duplicar.
    const fechas = tardanzas.map((t) => t.fecha).sort()
    const desde = fechas[0]
    const hasta = fechas[fechas.length - 1]
    const yaExistentes = new Set<string>()
    const idsUsuario = [...new Set(tardanzas.map((t) => t.id_usuario))]
    for (const idU of idsUsuario) {
      const prev = await apiService.rrhhNovedadesListar({
        idUsuario: idU,
        grupo: 'tardanza_retiro',
        codigo: 'tardanza',
        fechaDesde: desde,
        fechaHasta: hasta
      })
      if (prev.success && prev.data) {
        for (const n of prev.data) yaExistentes.add(`${idU}|${n.fecha_desde}`)
      }
    }

    let creadas = 0
    let omitidas = 0
    for (const t of tardanzas) {
      if (yaExistentes.has(`${t.id_usuario}|${t.fecha}`)) {
        omitidas++
        continue
      }
      const obs = `Tardanza de ${t.minutos} min (entró ${t.entrada}, horario habitual ~${t.baseline}). Importado del reloj biométrico.`
      const r = await apiService.rrhhNovedadCrear({
        id_usuario: t.id_usuario,
        grupo: 'tardanza_retiro',
        codigo: 'tardanza',
        fecha_desde: t.fecha,
        fecha_hasta: t.fecha,
        duracion_minutos: t.minutos,
        observaciones: obs,
        registrado_por: usuarioActual.id
      })
      if (r.success) {
        creadas++
        yaExistentes.add(`${t.id_usuario}|${t.fecha}`)
      }
    }
    return { creadas, omitidas }
  }

  const procesar = (buffer: ArrayBuffer, cfg: ConfigCalculo) => {
    setProcesando(true)
    setError('')
    try {
      const { marcaciones: marc, resumenes: res } = procesarArchivoReloj(buffer, cfg)
      if (!marc.length) {
        setError('No se encontraron marcaciones. Verificá que el Excel tenga columnas "Nombre" y "Fecha/Hora".')
        setMarcaciones([])
        setResumenes([])
        return
      }
      setMarcaciones(marc)
      setResumenes(res)
      setPlanilla(construirPlanilla(res))
      setDiasPeriodo(diasDelPeriodo(marc))
      setCeldaEdit(null)
      setInformeIa('')
      setResultadoGuardado('')
      setErrorGuardado('')
    } catch (e) {
      console.error(e)
      setError('No se pudo leer el archivo. Probá exportarlo de nuevo en formato Excel.')
    } finally {
      setProcesando(false)
    }
  }

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setOverride({})
    const buffer = await file.arrayBuffer()
    procesar(buffer, config)
  }

  // El recompute lo dispara el efecto central; aquí solo cambia la configuración.
  const recalcular = (nuevaConfig: ConfigCalculo) => {
    setConfig(nuevaConfig)
  }

  const editarCelda = (empKey: string, fecha: string, celda: { entrada: string; salida: string; ausente: boolean; obs: string }) => {
    setPlanilla((prev) =>
      prev.map((emp) => (emp.idUsuario === empKey ? { ...emp, dias: { ...emp.dias, [fecha]: celda } } : emp))
    )
  }

  const marcarAusenciasHabilesVacias = () => {
    setPlanilla((prev) =>
      prev.map((emp) => {
        const dias = { ...emp.dias }
        for (const f of diasPeriodo) {
          const [y, m, d] = f.split('-').map(Number)
          const dow = new Date(y, m - 1, d).getDay()
          if (dow === 0) continue // domingo no se marca como ausencia
          const c = dias[f]
          const vacio = !c || (!c.entrada && !c.salida && !c.ausente)
          if (vacio) dias[f] = { entrada: '', salida: '', ausente: true, obs: 'Ausencia (día hábil sin marcación)' }
        }
        return { ...emp, dias }
      })
    )
  }

  // Guarda/actualiza el horario fijo de un empleado. Persiste en BD y queda
  // como referencia hasta que se vuelva a cambiar. Actualiza el estado local
  // de forma optimista para recalcular en vivo.
  const guardarHorarioFijo = async (plotLabId: number, entrada: string, salida: string) => {
    if (!plotLabId || !entrada || !salida) return
    const previo = horariosFijos[plotLabId]
    const horas = previo?.horas ?? null
    const trabajaSabado = previo?.trabajaSabado ?? true
    setHorariosFijos((prev) => ({ ...prev, [plotLabId]: { entrada, salida, horas, trabajaSabado } }))
    setGuardandoFijo(plotLabId)
    try {
      const r = await apiService.upsertHorarioFijo(plotLabId, entrada, salida, horas, mesActivo, trabajaSabado)
      if (!r.success) {
        // Revertir si falló.
        setHorariosFijos((prev) => {
          const next = { ...prev }
          if (previo) next[plotLabId] = previo
          else delete next[plotLabId]
          return next
        })
        setErrorGuardado(
          (r.error || 'No se pudo guardar el horario fijo.') +
            (/function|does not exist|upsert_horario_fijo/i.test(r.error || '')
              ? ' — Falta aplicar la migración 2026-05-29_upsert_horario_fijo.sql en Supabase.'
              : '')
        )
      }
    } finally {
      setGuardandoFijo(null)
    }
  }

  // Importa la planilla "PERSONAL ACTUAL": parsea horarios reales y matchea empleados.
  const handleHorariosRealesFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setResFijos('')
    try {
      const buf = await file.arrayBuffer()
      const rows = parsearHorariosReales(buf)
      if (!rows.length) {
        setResFijos('No se encontraron filas. Verificá que tenga columnas COLABORADORES y HORARIO.')
        return
      }
      const prev = rows.map((r) => {
        const m = matchearUsuario(r.nombre, usuariosLite)
        return {
          nombre: r.nombre,
          puesto: r.puesto,
          jornada: r.jornadaSemanal,
          entrada: r.entrada,
          salida: r.salida,
          horas: r.horasDia,
          trabajaSabado: r.trabajaSabado,
          plotLabId: m?.id || 0
        }
      })
      setPrevFijos(prev)
    } catch {
      setResFijos('No se pudo leer el archivo. Probá exportarlo de nuevo en formato Excel.')
    } finally {
      e.target.value = ''
    }
  }

  const actualizarPrevFijo = (
    index: number,
    patch: Partial<{ entrada: string; salida: string; trabajaSabado: boolean; plotLabId: number }>
  ) => {
    setPrevFijos((prev) => (prev ? prev.map((r, i) => (i === index ? { ...r, ...patch } : r)) : prev))
  }

  // Guarda en bloque todos los horarios fijos del preview (persisten hasta cambiarse).
  const guardarHorariosRealesTodos = async () => {
    if (!prevFijos) return
    setGuardandoFijos(true)
    setResFijos('')
    let ok = 0
    let omitidos = 0
    let errores = 0
    const nuevos: Record<number, { entrada: string; salida: string; horas?: number | null; trabajaSabado?: boolean }> = { ...horariosFijos }
    for (const r of prevFijos) {
      if (!r.plotLabId || !r.entrada || !r.salida) {
        omitidos++
        continue
      }
      const resp = await apiService.upsertHorarioFijo(r.plotLabId, r.entrada, r.salida, r.horas, mesActivo, r.trabajaSabado)
      if (resp.success) {
        ok++
        nuevos[r.plotLabId] = { entrada: r.entrada, salida: r.salida, horas: r.horas, trabajaSabado: r.trabajaSabado }
      } else {
        errores++
      }
    }
    setHorariosFijos(nuevos)
    setGuardandoFijos(false)
    setResFijos(
      `✓ Guardados ${ok} horarios fijos` +
        (omitidos ? `, ${omitidos} omitidos (sin vínculo u horario)` : '') +
        (errores ? `, ${errores} con error` : '') +
        '.'
    )
    setPrevFijos(null)
  }

  const totales = useMemo(() => {
    return resumenes.reduce(
      (acc, e) => {
        acc.horas += e.totalHoras
        acc.extra += e.totalExtra
        acc.anomalias += e.anomalias
        return acc
      },
      { horas: 0, extra: 0, anomalias: 0 }
    )
  }, [resumenes])

  const periodo = useMemo(() => {
    if (!marcaciones.length) return ''
    const fechas = marcaciones.map((m) => m.fechaHora.getTime())
    const min = new Date(Math.min(...fechas))
    const max = new Date(Math.max(...fechas))
    const f = (d: Date) => d.toLocaleDateString('es-AR')
    return `${f(min)} al ${f(max)}`
  }, [marcaciones])

  const nombreCorto = (n: string) => {
    const parts = n.split(/\s+/)
    return parts.length > 2 ? `${parts[0]} ${parts[1]}` : n
  }

  const chartHoras = useMemo(
    () =>
      [...resumenes]
        .sort((a, b) => b.totalHoras - a.totalHoras)
        .slice(0, 12)
        .map((e) => ({
          nombre: nombreCorto(e.nombre),
          Normales: Math.round((e.totalHoras - e.totalExtra) * 10) / 10,
          Extra: Math.round(e.totalExtra * 10) / 10
        })),
    [resumenes]
  )

  const ranking = useMemo(
    () =>
      [...resumenes]
        .filter((e) => e.diasConEntrada > 0)
        .sort((a, b) => b.puntualidadPct - a.puntualidadPct || a.minutosTardeTotal - b.minutosTardeTotal),
    [resumenes]
  )

  const chartDistribucion = useMemo(() => {
    let puntual = 0
    let tarde = 0
    let anomalia = 0
    for (const e of resumenes) {
      for (const s of e.sesiones) {
        if (s.anomalia) anomalia++
        else if (s.tarde) tarde++
        else puntual++
      }
    }
    return [
      { name: 'Puntual', value: puntual, color: '#22c55e' },
      { name: 'Tarde', value: tarde, color: '#f59e0b' },
      { name: 'Anomalías', value: anomalia, color: '#ef4444' }
    ].filter((d) => d.value > 0)
  }, [resumenes])

  const totalTardanzas = useMemo(() => resumenes.reduce((a, e) => a + e.tardanzas, 0), [resumenes])

  const handleInformeIa = async () => {
    if (!resumenes.length) return
    setGenerandoIa(true)
    setErrorIa('')
    try {
      const informe = await generarInformeAsistenciaIa(resumenes, periodo, config)
      setInformeIa(informe)
    } catch (e) {
      setErrorIa(e instanceof Error ? e.message : 'No se pudo generar el informe con IA.')
    } finally {
      setGenerandoIa(false)
    }
  }

  return (
    <div className="rrhh-reloj-tab">
      <div className="reloj-intro">
        <h2>🕒 Importar asistencia del reloj biométrico</h2>
        <p>
          Subí el Excel que exporta el reloj. El sistema empareja entrada/salida (incluso turnos que
          cruzan la medianoche), calcula horas trabajadas y horas extra, y detecta marcaciones faltantes.
        </p>
      </div>

      {/* Configuración de jornada */}
      <div className="reloj-config">
        <div className="reloj-config-field">
          <label>Jornada Lun-Sáb (hs)</label>
          <input
            type="number"
            min={1}
            max={24}
            step={0.5}
            value={config.jornadaLunVie}
            onChange={(e) => recalcular({ ...config, jornadaLunVie: Number(e.target.value) || 0 })}
          />
        </div>
        <div className="reloj-config-field">
          <label>Jornada Sábado (hs)</label>
          <input
            type="number"
            min={0}
            max={24}
            step={0.5}
            value={config.jornadaSab}
            onChange={(e) => recalcular({ ...config, jornadaSab: Number(e.target.value) || 0 })}
          />
        </div>
        <div className="reloj-config-field reloj-config-check">
          <label>
            <input
              type="checkbox"
              checked={config.domingoTodoExtra}
              onChange={(e) => recalcular({ ...config, domingoTodoExtra: e.target.checked })}
            />
            Domingo todo extra
          </label>
        </div>
        <div className="reloj-config-field">
          <label>Redondeo extra (hs)</label>
          <select
            value={config.redondeoExtra}
            onChange={(e) => recalcular({ ...config, redondeoExtra: Number(e.target.value) })}
          >
            <option value={0.25}>15 min</option>
            <option value={0.5}>30 min</option>
            <option value={1}>1 hora</option>
          </select>
        </div>
        <div className="reloj-config-field">
          <label>Tolerancia tardanza</label>
          <div className="reloj-config-fija">15 min (fija)</div>
        </div>
        <div className="reloj-config-field">
          <label title="Vacío = usa el horario habitual de cada empleado">Hora entrada esperada</label>
          <input
            type="time"
            value={config.horaEntradaEsperada}
            onChange={(e) => recalcular({ ...config, horaEntradaEsperada: e.target.value })}
          />
        </div>
      </div>

      {/* Carga de archivo */}
      <div className="reloj-upload">
        <input
          ref={fileInputRef}
          type="file"
          accept=".xls,.xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
          onChange={handleFile}
          style={{ display: 'none' }}
        />
        <button className="btn-primary" onClick={() => fileInputRef.current?.click()}>
          📂 Seleccionar Excel del reloj
        </button>
        {fileName && <span className="reloj-filename">{fileName}</span>}
      </div>

      {/* Importar horarios reales (PERSONAL ACTUAL) → guardar como horarios fijos */}
      <div className="reloj-fijos-import">
        <div className="reloj-fijos-import-head">
          <div>
            <strong>🗂️ Horarios reales de cada empleado</strong>
            <p>
              Subí la planilla "PERSONAL ACTUAL". Se leen los horarios reales, se vinculan los empleados
              y quedan guardados como <b>horarios fijos</b> (entrada esperada y jornada) hasta que los cambies.
            </p>
          </div>
          <input
            ref={horariosFileRef}
            type="file"
            accept=".xls,.xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
            onChange={handleHorariosRealesFile}
            style={{ display: 'none' }}
          />
          <button className="btn-secondary" onClick={() => horariosFileRef.current?.click()}>
            📂 Importar horarios reales
          </button>
        </div>

        {resFijos && <div className="reloj-ok">{resFijos}</div>}

        {prevFijos && (
          <div className="reloj-fijos-preview">
            <div className="reloj-fijos-preview-bar">
              <span>
                {prevFijos.length} empleados · {prevFijos.filter((r) => r.plotLabId && r.entrada && r.salida).length} listos para guardar · se guardan para el mes <strong>{mesActivo}</strong>
              </span>
              <div>
                <button className="btn-secondary" onClick={() => setPrevFijos(null)} disabled={guardandoFijos}>
                  Cancelar
                </button>
                <button className="btn-primary" onClick={guardarHorariosRealesTodos} disabled={guardandoFijos}>
                  {guardandoFijos ? '💾 Guardando...' : '💾 Guardar horarios fijos'}
                </button>
              </div>
            </div>
            <div className="reloj-fijos-tabla-wrap">
              <table className="reloj-fijos-tabla">
                <thead>
                  <tr>
                    <th>Empleado</th>
                    <th>Puesto / Jornada</th>
                    <th>Usuario Plot Lab</th>
                    <th>Entrada</th>
                    <th>Salida</th>
                    <th>Sáb</th>
                  </tr>
                </thead>
                <tbody>
                  {prevFijos.map((r, i) => {
                    const incompleto = !r.plotLabId || !r.entrada || !r.salida
                    return (
                      <tr key={`${r.nombre}-${i}`} className={incompleto ? 'reloj-fijos-row-warn' : ''}>
                        <td className="reloj-td-nombre">{r.nombre}</td>
                        <td className="reloj-fijos-puesto">
                          {r.puesto || '—'}
                          <span>{r.jornada}</span>
                        </td>
                        <td>
                          <select
                            className={`reloj-vinculo-select ${r.plotLabId ? 'reloj-vinculo-auto' : 'reloj-vinculo-none'}`}
                            value={r.plotLabId}
                            onChange={(e) => actualizarPrevFijo(i, { plotLabId: Number(e.target.value) })}
                          >
                            <option value={0}>Sin vincular</option>
                            {usuariosOrdenados.map((u) => (
                              <option key={u.id} value={u.id}>
                                {u.nombre}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <input
                            type="time"
                            className="reloj-fijo-input"
                            value={r.entrada}
                            onChange={(e) => actualizarPrevFijo(i, { entrada: e.target.value })}
                          />
                        </td>
                        <td>
                          <input
                            type="time"
                            className="reloj-fijo-input"
                            value={r.salida}
                            onChange={(e) => actualizarPrevFijo(i, { salida: e.target.value })}
                          />
                        </td>
                        <td className="reloj-fijos-sab">
                          <input
                            type="checkbox"
                            checked={r.trabajaSabado}
                            title="Trabaja sábado (Lun-Sáb)"
                            onChange={(e) => actualizarPrevFijo(i, { trabajaSabado: e.target.checked })}
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {procesando && <div className="reloj-procesando">Procesando archivo...</div>}
      {error && <div className="reloj-error">{error}</div>}

      {resumenes.length > 0 && (
        <>
          {/* Totales */}
          <div className="reloj-totales">
            <div className="reloj-total-card">
              <span className="reloj-total-num">{resumenes.length}</span>
              <span className="reloj-total-label">Empleados</span>
            </div>
            <div className="reloj-total-card">
              <span className="reloj-total-num">{formatHoras(totales.horas)}</span>
              <span className="reloj-total-label">Horas totales</span>
            </div>
            <div className="reloj-total-card reloj-total-extra">
              <span className="reloj-total-num">{formatHoras(totales.extra)}</span>
              <span className="reloj-total-label">Horas extra</span>
            </div>
            <div className={`reloj-total-card ${totalTardanzas ? 'reloj-total-tarde' : ''}`}>
              <span className="reloj-total-num">{totalTardanzas}</span>
              <span className="reloj-total-label">Tardanzas</span>
            </div>
            <div className={`reloj-total-card ${totales.anomalias ? 'reloj-total-warn' : ''}`}>
              <span className="reloj-total-num">{totales.anomalias}</span>
              <span className="reloj-total-label">Anomalías</span>
            </div>
            {periodo && (
              <div className="reloj-total-card reloj-total-periodo">
                <span className="reloj-total-num">📅</span>
                <span className="reloj-total-label">{periodo}</span>
              </div>
            )}
          </div>

          {/* Acciones */}
          <div className="reloj-acciones">
            <button className="btn-secondary" onClick={() => exportarRelojXlsx(resumenes)}>
              ⬇️ Exportar planilla (formato reloj)
            </button>
            <button className="btn-secondary" onClick={() => exportarResumenXlsx(resumenes)}>
              ⬇️ Exportar resumen por empleado
            </button>
            <button className="btn-primary" onClick={handleInformeIa} disabled={generandoIa}>
              {generandoIa ? '🤖 Analizando...' : '🤖 Analizar con IA'}
            </button>
            <button className="btn-primary reloj-btn-guardar" onClick={handleGuardar} disabled={guardando}>
              {guardando ? '💾 Guardando...' : '💾 Guardar en Plot Lab'}
            </button>
            <label className="reloj-check-tardanzas">
              <input
                type="checkbox"
                checked={registrarTardanzas}
                onChange={(e) => setRegistrarTardanzas(e.target.checked)}
              />
              Registrar tardanzas en el legajo
            </label>
          </div>

          {resultadoGuardado && <div className="reloj-ok">{resultadoGuardado}</div>}
          {errorGuardado && <div className="reloj-error">{errorGuardado}</div>}

          {/* Toggle de vista */}
          <div className="reloj-vista-toggle">
            <button
              className={`reloj-vista-btn ${vista === 'resumen' ? 'active' : ''}`}
              onClick={() => setVista('resumen')}
            >
              📊 Resumen
            </button>
            <button
              className={`reloj-vista-btn ${vista === 'planilla' ? 'active' : ''}`}
              onClick={() => setVista('planilla')}
            >
              📋 Planilla editable
            </button>
          </div>

          {vista === 'planilla' && (
            <PlanillaEditable
              planilla={planilla}
              diasPeriodo={diasPeriodo}
              resumenes={resumenes}
              celdaEdit={celdaEdit}
              setCeldaEdit={setCeldaEdit}
              onEdit={editarCelda}
              onMarcarAusencias={marcarAusenciasHabilesVacias}
              vinculos={vinculos}
              horariosFijos={horariosFijos}
              guardandoFijo={guardandoFijo}
              onGuardarHorarioFijo={guardarHorarioFijo}
            />
          )}

          {vista === 'resumen' && (
          <>
          {/* Gráficos */}
          <div className="reloj-charts">
            <div className="reloj-chart-card">
              <h3>Horas por empleado (top 12)</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartHoras} margin={{ top: 8, right: 8, left: 0, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                  <XAxis dataKey="nombre" angle={-40} textAnchor="end" interval={0} tick={{ fontSize: 11 }} height={70} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
                  />
                  <Legend />
                  <Bar dataKey="Normales" stackId="h" fill="#3b82f6" />
                  <Bar dataKey="Extra" stackId="h" fill="#f59e0b" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="reloj-chart-card reloj-chart-pie">
              <h3>Distribución de marcaciones</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={chartDistribucion}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={95}
                    label={(entry) => `${entry.name}: ${entry.value}`}
                  >
                    {chartDistribucion.map((d) => (
                      <Cell key={d.name} fill={d.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Ranking de puntualidad */}
          {ranking.length > 0 && (
            <div className="reloj-ranking">
              <h3>🏆 Ranking de puntualidad</h3>
              <div className="reloj-ranking-list">
                {ranking.map((e, i) => (
                  <div key={e.idUsuario} className="reloj-ranking-item">
                    <span className={`reloj-rank-pos ${i < 3 ? `reloj-rank-${i + 1}` : ''}`}>{i + 1}</span>
                    <span className="reloj-rank-nombre">{e.nombre}</span>
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
                      {e.tardanzas} tard. · entra ~{e.baselineEntrada}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {errorIa && <div className="reloj-error">{errorIa}</div>}
          {informeIa && (
            <div className="reloj-informe-ia">
              <div className="reloj-informe-header">
                <span>🤖 Informe PlotAI</span>
                <button className="reloj-informe-close" onClick={() => setInformeIa('')}>✕</button>
              </div>
              <div
                className="reloj-informe-body"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(marked.parse(informeIa) as string) }}
              />
            </div>
          )}

          {/* Tabla por empleado */}
          <div className="reloj-tabla-wrap">
            <table className="reloj-tabla">
              <thead>
                <tr>
                  <th>Empleado</th>
                  <th>Depto</th>
                  <th>Plot Lab</th>
                  <th>Horario fijo</th>
                  <th>Días</th>
                  <th>Horas</th>
                  <th>Extra</th>
                  <th>Punt.</th>
                  <th>Anomalías</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {resumenes.map((emp) => {
                  const vinc = vinculos[emp.idUsuario]
                  const esAuto = !(emp.idUsuario in override)
                  const expandido = empleadoExpandido === emp.idUsuario
                  return (
                    <Fragment key={emp.idUsuario}>
                      <tr className={emp.anomalias ? 'reloj-row-warn' : ''}>
                        <td className="reloj-td-nombre">{emp.nombre}</td>
                        <td>{emp.departamento || '—'}</td>
                        <td>
                          <select
                            className={`reloj-vinculo-select ${vinc?.id ? (esAuto ? 'reloj-vinculo-auto' : 'reloj-vinculo-manual') : 'reloj-vinculo-none'}`}
                            value={vinc?.id || 0}
                            onChange={(e) =>
                              setOverride({ ...override, [emp.idUsuario]: Number(e.target.value) })
                            }
                            title={vinc?.id && esAuto ? 'Vinculado automáticamente' : ''}
                          >
                            <option value={0}>Sin vincular</option>
                            {usuariosOrdenados.map((u) => (
                              <option key={u.id} value={u.id}>
                                {u.nombre}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <HorarioFijoEditor
                            plotLabId={vinc?.id || null}
                            valor={vinc?.id ? horariosFijos[vinc.id] : undefined}
                            guardando={guardandoFijo === vinc?.id}
                            onGuardar={guardarHorarioFijo}
                          />
                        </td>
                        <td className="reloj-td-num">{emp.diasTrabajados}</td>
                        <td className="reloj-td-num">{formatHoras(emp.totalHoras)}</td>
                        <td className="reloj-td-num reloj-td-extra">{formatHoras(emp.totalExtra)}</td>
                        <td className="reloj-td-num">
                          <span
                            className="reloj-punt-badge"
                            style={{
                              color:
                                emp.puntualidadPct >= 90 ? '#22c55e' : emp.puntualidadPct >= 70 ? '#f59e0b' : '#ef4444'
                            }}
                          >
                            {emp.diasConEntrada ? `${emp.puntualidadPct}%` : '—'}
                          </span>
                        </td>
                        <td className="reloj-td-num">{emp.anomalias > 0 ? `⚠️ ${emp.anomalias}` : '—'}</td>
                        <td>
                          <button
                            className="reloj-detalle-btn"
                            onClick={() => setEmpleadoExpandido(expandido ? null : emp.idUsuario)}
                          >
                            {expandido ? 'Ocultar' : 'Ver días'}
                          </button>
                        </td>
                      </tr>
                      {expandido && (
                        <tr className="reloj-detalle-row">
                          <td colSpan={10}>
                            <table className="reloj-detalle-tabla">
                              <thead>
                                <tr>
                                  <th>Día</th>
                                  <th>Fecha</th>
                                  <th>Entrada</th>
                                  <th>Salida</th>
                                  <th>Horas</th>
                                  <th>Extra</th>
                                  <th>Observaciones</th>
                                </tr>
                              </thead>
                              <tbody>
                                {emp.sesiones.map((s, i) => (
                                  <tr key={i} className={s.anomalia ? 'reloj-sesion-warn' : ''}>
                                    <td>{s.dia}</td>
                                    <td>{s.fecha}</td>
                                    <td className={s.tarde ? 'reloj-td-tarde' : ''}>
                                      {s.entradaStr ? s.entradaStr.slice(11, 16) : '—'}
                                      {s.tarde && <span className="reloj-tarde-badge"> tarde</span>}
                                    </td>
                                    <td>
                                      {s.salidaStr ? s.salidaStr.slice(11, 16) : '—'}
                                      {s.cruzaMedianoche && <span className="reloj-cruza"> (+1d)</span>}
                                    </td>
                                    <td>{formatHoras(s.horasTrabajadas)}</td>
                                    <td className="reloj-td-extra">{s.horasExtra > 0 ? formatHoras(s.horasExtra) : '—'}</td>
                                    <td className="reloj-obs">{s.observaciones || '—'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
          </>
          )}
        </>
      )}
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
  const valido = !!entrada && !!salida

  if (!plotLabId) {
    return <span className="reloj-fijo-novinc">Vinculá primero</span>
  }

  return (
    <div className={`reloj-fijo-editor ${compacto ? 'compacto' : ''}`}>
      <input
        type="time"
        className="reloj-fijo-input"
        value={entrada}
        title="Entrada esperada"
        onChange={(e) => setEntrada(e.target.value)}
      />
      <span className="reloj-fijo-sep">–</span>
      <input
        type="time"
        className="reloj-fijo-input"
        value={salida}
        title="Salida esperada"
        onChange={(e) => setSalida(e.target.value)}
      />
      <button
        type="button"
        className="reloj-fijo-save"
        disabled={!valido || !sucio || guardando}
        title={valor ? 'Actualizar horario fijo' : 'Guardar horario fijo'}
        onClick={() => valido && onGuardar(plotLabId, entrada, salida)}
      >
        {guardando ? '…' : sucio ? '💾' : '✓'}
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
// Planilla editable (grilla empleados x días)
// ============================================================
const DOW_CORTO = ['D', 'L', 'M', 'M', 'J', 'V', 'S']

const PlanillaEditable = ({
  planilla,
  diasPeriodo,
  resumenes,
  celdaEdit,
  setCeldaEdit,
  onEdit,
  onMarcarAusencias,
  vinculos,
  horariosFijos,
  guardandoFijo,
  onGuardarHorarioFijo
}: {
  planilla: PlanillaEmpleado[]
  diasPeriodo: string[]
  resumenes: ResumenEmpleado[]
  celdaEdit: { empKey: string; fecha: string } | null
  setCeldaEdit: (c: { empKey: string; fecha: string } | null) => void
  onEdit: (empKey: string, fecha: string, celda: { entrada: string; salida: string; ausente: boolean; obs: string }) => void
  onMarcarAusencias: () => void
  vinculos: Record<string, { id: number; nombre: string }>
  horariosFijos: Record<number, { entrada: string; salida: string }>
  guardandoFijo: number | null
  onGuardarHorarioFijo: (plotLabId: number, entrada: string, salida: string) => void
}) => {
  const [form, setForm] = useState<{ entrada: string; salida: string; ausente: boolean; obs: string }>({
    entrada: '',
    salida: '',
    ausente: false,
    obs: ''
  })

  const totalesPorEmp = useMemo(() => {
    const map: Record<string, { horas: number; extra: number; tardanzas: number; anomalias: number }> = {}
    for (const e of resumenes) {
      map[e.idUsuario] = {
        horas: e.totalHoras,
        extra: e.totalExtra,
        tardanzas: e.tardanzas,
        anomalias: e.anomalias
      }
    }
    return map
  }, [resumenes])

  const abrirEditor = (empKey: string, fecha: string) => {
    const emp = planilla.find((p) => p.idUsuario === empKey)
    const celda = emp?.dias[fecha]
    setForm({
      entrada: celda?.entrada || '',
      salida: celda?.salida || '',
      ausente: celda?.ausente || false,
      obs: celda?.obs || ''
    })
    setCeldaEdit({ empKey, fecha })
  }

  const guardarEditor = () => {
    if (!celdaEdit) return
    onEdit(celdaEdit.empKey, celdaEdit.fecha, {
      entrada: form.ausente ? '' : form.entrada,
      salida: form.ausente ? '' : form.salida,
      ausente: form.ausente,
      obs: form.obs
    })
    setCeldaEdit(null)
  }

  const limpiarCelda = () => {
    if (!celdaEdit) return
    onEdit(celdaEdit.empKey, celdaEdit.fecha, { entrada: '', salida: '', ausente: false, obs: '' })
    setCeldaEdit(null)
  }

  const empEditando = celdaEdit ? planilla.find((p) => p.idUsuario === celdaEdit.empKey) : null

  return (
    <div className="reloj-planilla">
      <div className="reloj-planilla-toolbar">
        <button className="btn-secondary" onClick={onMarcarAusencias}>
          🚩 Marcar ausencias en días hábiles vacíos
        </button>
        <div className="reloj-planilla-legend">
          <span><i className="lg lg-ok" /> Trabajado</span>
          <span><i className="lg lg-tarde" /> Tarde</span>
          <span><i className="lg lg-aus" /> Ausente</span>
          <span><i className="lg lg-warn" /> Falta marca</span>
        </div>
      </div>

      <div className="reloj-planilla-scroll">
        <table className="reloj-planilla-tabla">
          <thead>
            <tr>
              <th className="reloj-planilla-sticky">Empleado</th>
              {diasPeriodo.map((f) => {
                const [y, m, d] = f.split('-').map(Number)
                const dow = new Date(y, m - 1, d).getDay()
                const finde = dow === 0 || dow === 6
                return (
                  <th key={f} className={`reloj-planilla-dia ${finde ? 'finde' : ''}`}>
                    <span className="dia-dow">{DOW_CORTO[dow]}</span>
                    <span className="dia-num">{d}</span>
                  </th>
                )
              })}
              <th className="reloj-planilla-tot">Hs</th>
              <th className="reloj-planilla-tot">Ext</th>
            </tr>
          </thead>
          <tbody>
            {planilla.map((emp) => {
              const tot = totalesPorEmp[emp.idUsuario]
              const vinc = vinculos[emp.idUsuario]
              return (
                <tr key={emp.idUsuario}>
                  <td className="reloj-planilla-sticky reloj-planilla-emp" title={emp.nombre}>
                    <span className="reloj-planilla-emp-nombre">{emp.nombre}</span>
                    <HorarioFijoEditor
                      plotLabId={vinc?.id || null}
                      valor={vinc?.id ? horariosFijos[vinc.id] : undefined}
                      guardando={guardandoFijo === vinc?.id}
                      onGuardar={onGuardarHorarioFijo}
                      compacto
                    />
                  </td>
                  {diasPeriodo.map((f) => {
                    const c = emp.dias[f]
                    const [y, m, d] = f.split('-').map(Number)
                    const dow = new Date(y, m - 1, d).getDay()
                    const finde = dow === 0 || dow === 6
                    let cls = 'reloj-celda'
                    let contenido: React.ReactNode = <span className="celda-vacia">·</span>
                    if (c?.ausente) {
                      cls += ' celda-aus'
                      contenido = <span>AUS</span>
                    } else if (c?.entrada && c?.salida) {
                      cls += ' celda-ok'
                      contenido = (
                        <>
                          <span className="celda-h">{c.entrada}</span>
                          <span className="celda-h">{c.salida}</span>
                        </>
                      )
                    } else if (c?.entrada || c?.salida) {
                      cls += ' celda-warn'
                      contenido = (
                        <>
                          <span className="celda-h">{c.entrada || '—'}</span>
                          <span className="celda-h">{c.salida || '—'}</span>
                        </>
                      )
                    }
                    if (finde) cls += ' finde'
                    return (
                      <td
                        key={f}
                        className={cls}
                        onClick={() => abrirEditor(emp.idUsuario, f)}
                        title="Editar"
                      >
                        {contenido}
                      </td>
                    )
                  })}
                  <td className="reloj-planilla-tot">{tot ? formatHoras(tot.horas) : '—'}</td>
                  <td className="reloj-planilla-tot reloj-td-extra">
                    {tot && tot.extra > 0 ? formatHoras(tot.extra) : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {celdaEdit && (
        <div className="reloj-celda-editor-overlay" onMouseDown={() => setCeldaEdit(null)}>
          <div className="reloj-celda-editor" onMouseDown={(e) => e.stopPropagation()}>
            <header>
              <strong>{empEditando?.nombre}</strong>
              <span>{celdaEdit.fecha}</span>
              <button className="reloj-celda-editor-close" onClick={() => setCeldaEdit(null)}>✕</button>
            </header>
            <label className="reloj-celda-aus-toggle">
              <input
                type="checkbox"
                checked={form.ausente}
                onChange={(e) => setForm({ ...form, ausente: e.target.checked })}
              />
              Ausente / Falta
            </label>
            {!form.ausente && (
              <div className="reloj-celda-horas">
                <div>
                  <label>Entrada</label>
                  <input
                    type="time"
                    value={form.entrada}
                    onChange={(e) => setForm({ ...form, entrada: e.target.value })}
                  />
                </div>
                <div>
                  <label>Salida</label>
                  <input
                    type="time"
                    value={form.salida}
                    onChange={(e) => setForm({ ...form, salida: e.target.value })}
                  />
                </div>
              </div>
            )}
            <div className="reloj-celda-obs">
              <label>Observaciones</label>
              <input
                type="text"
                value={form.obs}
                onChange={(e) => setForm({ ...form, obs: e.target.value })}
                placeholder="Opcional"
              />
            </div>
            <div className="reloj-celda-editor-actions">
              <button className="btn-secondary" onClick={limpiarCelda}>Vaciar</button>
              <button className="btn-primary" onClick={guardarEditor}>Aplicar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

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

const HorariosTab = ({ usuarios, usuarioSeleccionado, horarios, onLoad }: {
  usuarios: UsuarioRecord[]
  usuarioSeleccionado: number | null
  horarios: HorarioEmpleado[]
  onLoad: () => void
}) => {
  const [showModal, setShowModal] = useState(false)
  // Horarios fijos (planilla editable): entrada/salida/jornada estándar por empleado.
  const [fijos, setFijos] = useState<Record<number, { entrada: string; salida: string; horas?: number | null; trabajaSabado?: boolean }>>({})
  const [guardandoFijo, setGuardandoFijo] = useState<number | null>(null)
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

  const upsertFijo = async (idUsuario: number, entrada: string, salida: string, horas: number | null, trabajaSabado: boolean) => {
    if (!idUsuario || !entrada || !salida) return
    const previo = fijos[idUsuario]
    setFijos((prev) => ({ ...prev, [idUsuario]: { entrada, salida, horas, trabajaSabado } }))
    setGuardandoFijo(idUsuario)
    try {
      const r = await apiService.upsertHorarioFijo(idUsuario, entrada, salida, horas, mes, trabajaSabado)
      if (!r.success) {
        setFijos((prev) => {
          const next = { ...prev }
          if (previo) next[idUsuario] = previo
          else delete next[idUsuario]
          return next
        })
        alert('Error al guardar el horario fijo: ' + (r.error || ''))
      } else {
        onLoad()
      }
    } finally {
      setGuardandoFijo(null)
    }
  }

  const eliminarFijo = async (idUsuario: number) => {
    if (!fijos[idUsuario]) return
    if (!confirm('¿Eliminar el horario fijo de este empleado para el mes seleccionado?')) return
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
        onLoad()
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

  const nombreCompletoLegajo = (u: UsuarioRecord): string => {
    const l = legajos[u.id]
    const full = `${l?.nombre || ''} ${l?.apellido || ''}`.trim()
    return full || u.nombre
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
  const [formData, setFormData] = useState({
    id_usuario: usuarioSeleccionado || 0,
    tipo_horario: 'fijo' as 'fijo' | 'flexible' | 'turnos',
    dia_semana: null as number | null,
    hora_entrada: '',
    hora_salida: '',
    horas_semanales: null as number | null,
    fecha_inicio: '',
    fecha_fin: '',
    observaciones: ''
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.id_usuario) {
      alert('Selecciona un usuario')
      return
    }

    try {
      const response = await apiService.crearHorario(
        formData.id_usuario,
        formData.tipo_horario,
        formData.dia_semana,
        formData.hora_entrada || null,
        formData.hora_salida || null,
        formData.horas_semanales,
        formData.fecha_inicio || null,
        formData.fecha_fin || null,
        formData.observaciones || null
      )

      if (response.success) {
        alert('Horario creado correctamente')
        setShowModal(false)
        onLoad()
      } else {
        alert('Error: ' + response.error)
      }
    } catch (error) {
      alert('Error al crear horario')
      console.error(error)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('¿Eliminar este horario?')) return
    try {
      const response = await apiService.eliminarHorario(id)
      if (response.success) {
        alert('Horario eliminado')
        onLoad()
      } else {
        alert('Error: ' + response.error)
      }
    } catch (error) {
      alert('Error al eliminar horario')
      console.error(error)
    }
  }

  return (
    <div className="rrhh-tab-content">
      {/* Planilla editable de horarios fijos (se completa al importar y desde el reloj) */}
      <div className="rrhh-fijos-planilla">
        <div className="rrhh-section-header">
          <h2>🕘 Horarios fijos (planilla)</h2>
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
          Entrada/salida estándar de cada empleado para el <strong>mes seleccionado</strong>. Quedan fijos hasta que
          los cambies y son la referencia para puntualidad y horas extra al importar el reloj de ese mes. Se completan
          al importar la planilla "PERSONAL ACTUAL".
        </p>
        <div className="rrhh-fijos-tabla-wrap">
          <table className="rrhh-fijos-tabla">
            <thead>
              <tr>
                <th>Empleado</th>
                <th>Área</th>
                <th>Horario fijo</th>
                <th>Jornada (hs)</th>
                <th title="Trabaja sábado (Lun-Sáb). Si no, el sábado es todo extra.">Sáb</th>
                <th>Legajo</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {usuariosFijos.map((u) => {
                const f = fijos[u.id]
                const sector = legajos[u.id]?.sector || ''
                const tieneHorario = !!(f?.entrada && f?.salida)
                return (
                  <tr key={u.id} className={f?.entrada ? '' : 'rrhh-fijos-row-sin'}>
                    <td>
                      <span className="rrhh-fijos-nombre">{nombreCompletoLegajo(u)}</span>
                      <span className="rrhh-fijos-login">{u.nombre}</span>
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
                      <input
                        type="checkbox"
                        checked={f?.trabajaSabado !== false}
                        disabled={!tieneHorario || guardandoFijo === u.id}
                        title={f?.trabajaSabado === false ? 'Lun-Vie (sábado todo extra)' : 'Lun-Sáb'}
                        onChange={(e) => guardarSabado(u.id, e.target.checked)}
                      />
                    </td>
                    <td>
                      <button className="rrhh-fijos-legajo-btn" onClick={() => setLegajoUsuario(u)}>
                        📂 Ver legajo
                      </button>
                    </td>
                    <td>
                      {tieneHorario && (
                        <button
                          className="rrhh-fijos-del-btn"
                          title="Eliminar horario fijo de este mes"
                          disabled={guardandoFijo === u.id}
                          onClick={() => eliminarFijo(u.id)}
                        >
                          🗑️
                        </button>
                      )}
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

      <div className="rrhh-section-header">
        <h2>Horarios de Empleados</h2>
        <button className="btn-primary" onClick={() => setShowModal(true)}>
          + Crear Horario
        </button>
      </div>

      {!usuarioSeleccionado && (
        <div className="rrhh-info-box">
          <p>Selecciona un usuario para ver sus horarios detallados (por día)</p>
        </div>
      )}

      {usuarioSeleccionado && (
        <div className="rrhh-horarios-list">
          {horarios.length === 0 ? (
            <p>No hay horarios registrados</p>
          ) : (
            horarios.map(h => (
              <div key={h.id} className="rrhh-horario-card">
                <div className="rrhh-horario-info">
                  <h3>{h.tipo_horario === 'fijo' ? 'Horario Fijo' : h.tipo_horario === 'flexible' ? 'Horario Flexible' : 'Turnos'}</h3>
                  {h.dia_semana !== null && <p>Día: {DIAS_SEMANA[h.dia_semana]}</p>}
                  {h.hora_entrada && h.hora_salida && (
                    <p>Horario: {h.hora_entrada} - {h.hora_salida}</p>
                  )}
                  {h.horas_semanales && <p>Horas semanales: {h.horas_semanales}</p>}
                  {h.fecha_inicio && <p>Desde: {new Date(h.fecha_inicio).toLocaleDateString()}</p>}
                  {h.fecha_fin && <p>Hasta: {new Date(h.fecha_fin).toLocaleDateString()}</p>}
                  {h.observaciones && <p>Obs: {h.observaciones}</p>}
                  <span className={`rrhh-badge ${h.activo ? 'active' : 'inactive'}`}>
                    {h.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
                <button className="btn-danger" onClick={() => handleDelete(h.id)}>
                  Eliminar
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {showModal && (
        <div className="rrhh-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="rrhh-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Crear Horario</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Usuario</label>
                <select
                  value={formData.id_usuario}
                  onChange={(e) => setFormData({ ...formData, id_usuario: parseInt(e.target.value) })}
                  required
                >
                  <option value="">Selecciona un usuario</option>
                  {usuarios.map(u => (
                    <option key={u.id} value={u.id}>{u.nombre}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Tipo de Horario</label>
                <select
                  value={formData.tipo_horario}
                  onChange={(e) => setFormData({ ...formData, tipo_horario: e.target.value as any })}
                  required
                >
                  <option value="fijo">Fijo</option>
                  <option value="flexible">Flexible</option>
                  <option value="turnos">Turnos</option>
                </select>
              </div>
              {formData.tipo_horario === 'fijo' && (
                <>
                  <div className="form-group">
                    <label>Día de la Semana</label>
                    <select
                      value={formData.dia_semana || ''}
                      onChange={(e) => setFormData({ ...formData, dia_semana: e.target.value ? parseInt(e.target.value) : null })}
                    >
                      <option value="">Selecciona un día</option>
                      {DIAS_SEMANA.map((dia, idx) => (
                        <option key={idx} value={idx}>{dia}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Hora de Entrada</label>
                    <input
                      type="time"
                      value={formData.hora_entrada}
                      onChange={(e) => setFormData({ ...formData, hora_entrada: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Hora de Salida</label>
                    <input
                      type="time"
                      value={formData.hora_salida}
                      onChange={(e) => setFormData({ ...formData, hora_salida: e.target.value })}
                    />
                  </div>
                </>
              )}
              {formData.tipo_horario === 'flexible' && (
                <div className="form-group">
                  <label>Horas Semanales</label>
                  <input
                    type="number"
                    step="0.5"
                    value={formData.horas_semanales || ''}
                    onChange={(e) => setFormData({ ...formData, horas_semanales: e.target.value ? parseFloat(e.target.value) : null })}
                  />
                </div>
              )}
              <div className="form-group">
                <label>Fecha Inicio</label>
                <input
                  type="date"
                  value={formData.fecha_inicio}
                  onChange={(e) => setFormData({ ...formData, fecha_inicio: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Fecha Fin (opcional)</label>
                <input
                  type="date"
                  value={formData.fecha_fin}
                  onChange={(e) => setFormData({ ...formData, fecha_fin: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Observaciones</label>
                <textarea
                  value={formData.observaciones}
                  onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
                />
              </div>
              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primary">
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// Componente de Turnos
const TurnosTab = ({ usuarios, turnos, onLoad }: {
  usuarios: UsuarioRecord[]
  turnos: Turno[]
  onLoad: () => void
}) => {
  const [showModal, setShowModal] = useState(false)
  const [formData, setFormData] = useState({
    id_usuario: 0,
    fecha: '',
    hora_entrada: '',
    hora_salida: '',
    tipo_turno: 'normal' as 'normal' | 'extra' | 'nocturno',
    observaciones: ''
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const response = await apiService.crearTurno(
        formData.id_usuario,
        formData.fecha,
        formData.hora_entrada,
        formData.hora_salida,
        formData.tipo_turno,
        formData.observaciones || null
      )

      if (response.success) {
        alert('Turno creado correctamente')
        setShowModal(false)
        onLoad()
      } else {
        alert('Error: ' + response.error)
      }
    } catch (error) {
      alert('Error al crear turno')
      console.error(error)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('¿Eliminar este turno?')) return
    try {
      const response = await apiService.eliminarTurno(id)
      if (response.success) {
        alert('Turno eliminado')
        onLoad()
      } else {
        alert('Error: ' + response.error)
      }
    } catch (error) {
      alert('Error al eliminar turno')
      console.error(error)
    }
  }

  return (
    <div className="rrhh-tab-content">
      <div className="rrhh-section-header">
        <h2>Calendario de Turnos</h2>
        <button className="btn-primary" onClick={() => setShowModal(true)}>
          + Crear Turno
        </button>
      </div>

      <div className="rrhh-turnos-list">
        {turnos.length === 0 ? (
          <p>No hay turnos registrados</p>
        ) : (
          turnos.map(t => (
            <div key={t.id} className="rrhh-turno-card">
              <div className="rrhh-turno-info">
                <h3>{t.nombre_usuario || 'Usuario'}</h3>
                <p>Fecha: {new Date(t.fecha).toLocaleDateString()}</p>
                <p>Horario: {t.hora_entrada} - {t.hora_salida}</p>
                <p>Tipo: {t.tipo_turno}</p>
                {t.observaciones && <p>Obs: {t.observaciones}</p>}
              </div>
              <button className="btn-danger" onClick={() => handleDelete(t.id)}>
                Eliminar
              </button>
            </div>
          ))
        )}
      </div>

      {showModal && (
        <div className="rrhh-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="rrhh-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Crear Turno</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Usuario</label>
                <select
                  value={formData.id_usuario}
                  onChange={(e) => setFormData({ ...formData, id_usuario: parseInt(e.target.value) })}
                  required
                >
                  <option value="">Selecciona un usuario</option>
                  {usuarios.map(u => (
                    <option key={u.id} value={u.id}>{u.nombre}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Fecha</label>
                <input
                  type="date"
                  value={formData.fecha}
                  onChange={(e) => setFormData({ ...formData, fecha: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Hora de Entrada</label>
                <input
                  type="time"
                  value={formData.hora_entrada}
                  onChange={(e) => setFormData({ ...formData, hora_entrada: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Hora de Salida</label>
                <input
                  type="time"
                  value={formData.hora_salida}
                  onChange={(e) => setFormData({ ...formData, hora_salida: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Tipo de Turno</label>
                <select
                  value={formData.tipo_turno}
                  onChange={(e) => setFormData({ ...formData, tipo_turno: e.target.value as any })}
                >
                  <option value="normal">Normal</option>
                  <option value="extra">Extra</option>
                  <option value="nocturno">Nocturno</option>
                </select>
              </div>
              <div className="form-group">
                <label>Observaciones</label>
                <textarea
                  value={formData.observaciones}
                  onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
                />
              </div>
              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primary">
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// Componente de Ausencias
const AusenciasTab = ({ usuarios, ausencias, usuario, onLoad }: {
  usuarios: UsuarioRecord[]
  ausencias: Ausencia[]
  usuario: any
  onLoad: () => void
}) => {
  const [showModal, setShowModal] = useState(false)
  const [formData, setFormData] = useState({
    id_usuario: 0,
    tipo_ausencia: 'vacaciones' as 'vacaciones' | 'licencia' | 'inasistencia' | 'permiso' | 'enfermedad',
    fecha_inicio: '',
    fecha_fin: '',
    motivo: '',
    observaciones: ''
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const response = await apiService.crearAusencia(
        formData.id_usuario,
        formData.tipo_ausencia,
        formData.fecha_inicio,
        formData.fecha_fin,
        formData.motivo || null,
        formData.observaciones || null
      )

      if (response.success) {
        alert('Ausencia registrada correctamente')
        setShowModal(false)
        onLoad()
      } else {
        alert('Error: ' + response.error)
      }
    } catch (error) {
      alert('Error al registrar ausencia')
      console.error(error)
    }
  }

  const handleAprobarRechazar = async (id: number, estado: 'aprobado' | 'rechazado') => {
    if (!usuario) return
    try {
      const response = await apiService.aprobarRechazarAusencia(id, estado, usuario.id)
      if (response.success) {
        alert(`Ausencia ${estado}`)
        onLoad()
      } else {
        alert('Error: ' + response.error)
      }
    } catch (error) {
      alert('Error al procesar ausencia')
      console.error(error)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('¿Eliminar esta ausencia?')) return
    try {
      const response = await apiService.eliminarAusencia(id)
      if (response.success) {
        alert('Ausencia eliminada')
        onLoad()
      } else {
        alert('Error: ' + response.error)
      }
    } catch (error) {
      alert('Error al eliminar ausencia')
      console.error(error)
    }
  }

  return (
    <div className="rrhh-tab-content">
      <div className="rrhh-section-header">
        <h2>Gestión de Ausencias</h2>
        <button className="btn-primary" onClick={() => setShowModal(true)}>
          + Registrar Ausencia
        </button>
      </div>

      <div className="rrhh-ausencias-list">
        {ausencias.length === 0 ? (
          <p>No hay ausencias registradas</p>
        ) : (
          ausencias.map(a => (
            <div key={a.id} className="rrhh-ausencia-card">
              <div className="rrhh-ausencia-info">
                <h3>{a.nombre_usuario || 'Usuario'}</h3>
                <p>Tipo: {a.tipo_ausencia}</p>
                <p>Período: {new Date(a.fecha_inicio).toLocaleDateString()} - {new Date(a.fecha_fin).toLocaleDateString()}</p>
                <p>Días: {a.dias}</p>
                {a.motivo && <p>Motivo: {a.motivo}</p>}
                <span className={`rrhh-badge ${a.estado}`}>
                  {a.estado}
                </span>
                {a.aprobado_por_nombre && <p>Aprobado por: {a.aprobado_por_nombre}</p>}
              </div>
              <div className="rrhh-ausencia-actions">
                {a.estado === 'pendiente' && usuario && (
                  <>
                    <button className="btn-success" onClick={() => handleAprobarRechazar(a.id, 'aprobado')}>
                      Aprobar
                    </button>
                    <button className="btn-danger" onClick={() => handleAprobarRechazar(a.id, 'rechazado')}>
                      Rechazar
                    </button>
                  </>
                )}
                <button className="btn-danger" onClick={() => handleDelete(a.id)}>
                  Eliminar
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {showModal && (
        <div className="rrhh-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="rrhh-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Registrar Ausencia</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Usuario</label>
                <select
                  value={formData.id_usuario}
                  onChange={(e) => setFormData({ ...formData, id_usuario: parseInt(e.target.value) })}
                  required
                >
                  <option value="">Selecciona un usuario</option>
                  {usuarios.map(u => (
                    <option key={u.id} value={u.id}>{u.nombre}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Tipo de Ausencia</label>
                <select
                  value={formData.tipo_ausencia}
                  onChange={(e) => setFormData({ ...formData, tipo_ausencia: e.target.value as any })}
                  required
                >
                  <option value="vacaciones">Vacaciones</option>
                  <option value="licencia">Licencia</option>
                  <option value="inasistencia">Inasistencia</option>
                  <option value="permiso">Permiso</option>
                  <option value="enfermedad">Enfermedad</option>
                </select>
              </div>
              <div className="form-group">
                <label>Fecha Inicio</label>
                <input
                  type="date"
                  value={formData.fecha_inicio}
                  onChange={(e) => setFormData({ ...formData, fecha_inicio: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Fecha Fin</label>
                <input
                  type="date"
                  value={formData.fecha_fin}
                  onChange={(e) => setFormData({ ...formData, fecha_fin: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Motivo</label>
                <textarea
                  value={formData.motivo}
                  onChange={(e) => setFormData({ ...formData, motivo: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Observaciones</label>
                <textarea
                  value={formData.observaciones}
                  onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
                />
              </div>
              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primary">
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// Componente de Asistencia
/** Extrae 'HH:mm' de un timestamp/hora guardado (timestamptz, ISO o 'YYYY-MM-DD HH:mm:ss'). */
const asisHoraCorta = (ts: string | null): string => {
  if (!ts) return ''
  const m = String(ts).match(/[T ](\d{2}):(\d{2})/)
  if (m) return `${m[1]}:${m[2]}`
  const m2 = String(ts).match(/^(\d{1,2}):(\d{2})/)
  return m2 ? `${m2[1].padStart(2, '0')}:${m2[2]}` : ''
}

const pad2 = (n: number) => String(n).padStart(2, '0')

const AsistenciaTab = ({ asistencia, usuario, onMarcarEntrada, onMarcarSalida, onEliminar }: {
  asistencia: Asistencia[]
  usuario: any
  onMarcarEntrada: () => void
  onMarcarSalida: () => void
  onEliminar: (id: number) => void
}) => {
  const [vista, setVista] = useState<'planilla' | 'lista'>('planilla')

  const eliminar = (a: Asistencia) => {
    if (!a?.id) return
    if (!confirm(`¿Eliminar el registro de ${a.nombre_usuario || 'este empleado'} del ${new Date(a.fecha).toLocaleDateString()}?`)) return
    onEliminar(a.id)
  }

  // Días (ISO) del período cubierto por los registros guardados.
  const dias = useMemo(() => {
    if (!asistencia.length) return []
    const fechas = asistencia.map((a) => a.fecha.slice(0, 10)).sort()
    const min = fechas[0]
    const max = fechas[fechas.length - 1]
    const [y, m, d] = min.split('-').map(Number)
    const [Y, M, D] = max.split('-').map(Number)
    const cur = new Date(y, m - 1, d)
    const fin = new Date(Y, M - 1, D)
    const out: string[] = []
    while (cur <= fin) {
      out.push(`${cur.getFullYear()}-${pad2(cur.getMonth() + 1)}-${pad2(cur.getDate())}`)
      cur.setDate(cur.getDate() + 1)
    }
    return out
  }, [asistencia])

  // Empleados con sus registros indexados por fecha.
  const empleados = useMemo(() => {
    const map = new Map<number, { id: number; nombre: string; dias: Record<string, Asistencia>; horas: number }>()
    for (const a of asistencia) {
      if (!map.has(a.id_usuario)) {
        map.set(a.id_usuario, { id: a.id_usuario, nombre: a.nombre_usuario || `Usuario ${a.id_usuario}`, dias: {}, horas: 0 })
      }
      const emp = map.get(a.id_usuario)!
      emp.dias[a.fecha.slice(0, 10)] = a
      emp.horas += a.horas_trabajadas || 0
    }
    return [...map.values()].sort((x, y) => x.nombre.localeCompare(y.nombre))
  }, [asistencia])

  return (
    <div className="rrhh-tab-content">
      <div className="rrhh-section-header">
        <h2>Control de Asistencia</h2>
        {usuario && (
          <div className="rrhh-asistencia-actions">
            <button className="btn-success" onClick={onMarcarEntrada}>
              🕐 Marcar Entrada
            </button>
            <button className="btn-warning" onClick={onMarcarSalida}>
              🕐 Marcar Salida
            </button>
          </div>
        )}
      </div>

      {asistencia.length > 0 && (
        <div className="rrhh-asis-toggle">
          <button className={`rrhh-asis-vbtn ${vista === 'planilla' ? 'active' : ''}`} onClick={() => setVista('planilla')}>
            📋 Planilla
          </button>
          <button className={`rrhh-asis-vbtn ${vista === 'lista' ? 'active' : ''}`} onClick={() => setVista('lista')}>
            📃 Lista
          </button>
        </div>
      )}

      {asistencia.length === 0 ? (
        <div className="rrhh-asistencia-list">
          <p>No hay registros de asistencia</p>
        </div>
      ) : vista === 'planilla' ? (
        <div className="rrhh-asis-planilla">
          <p className="rrhh-asis-help">
            Asistencia guardada (incluye lo importado del reloj). Cada celda muestra entrada / salida; "AUS" = ausente.
            Hacé clic en una celda para eliminar ese registro.
          </p>
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
                        <span className="dia-dow">{DOW_CORTO[dow]}</span>
                        <span className="dia-num">{d}</span>
                      </th>
                    )
                  })}
                  <th className="rrhh-asis-tot">Hs</th>
                </tr>
              </thead>
              <tbody>
                {empleados.map((emp) => (
                  <tr key={emp.id}>
                    <td className="rrhh-asis-sticky rrhh-asis-emp" title={emp.nombre}>{emp.nombre}</td>
                    {dias.map((f) => {
                      const a = emp.dias[f]
                      const [y, m, d] = f.split('-').map(Number)
                      const dow = new Date(y, m - 1, d).getDay()
                      const finde = dow === 0 || dow === 6
                      let cls = 'rrhh-asis-celda'
                      let contenido: React.ReactNode = <span className="celda-vacia">·</span>
                      if (a) {
                        if (a.tipo_registro === 'ausente') {
                          cls += ' celda-aus'
                          contenido = <span>AUS</span>
                        } else {
                          const e = asisHoraCorta(a.hora_entrada)
                          const s = asisHoraCorta(a.hora_salida)
                          cls += a.tipo_registro === 'tarde' ? ' celda-tarde' : ' celda-ok'
                          contenido = (
                            <>
                              <span className="celda-h">{e || '—'}</span>
                              <span className="celda-h">{s || '—'}</span>
                            </>
                          )
                        }
                      }
                      if (finde) cls += ' finde'
                      if (a) cls += ' celda-click'
                      return (
                        <td
                          key={f}
                          className={cls}
                          title={a ? `${a.observaciones || ''} (clic para eliminar)`.trim() : ''}
                          onClick={a ? () => eliminar(a) : undefined}
                        >
                          {contenido}
                        </td>
                      )
                    })}
                    <td className="rrhh-asis-tot">{emp.horas ? emp.horas.toFixed(1) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="rrhh-asistencia-list">
          {asistencia.map(a => (
            <div key={a.id} className="rrhh-asistencia-card">
              <div className="rrhh-asistencia-info">
                <h3>{a.nombre_usuario || 'Usuario'}</h3>
                <p>Fecha: {new Date(a.fecha).toLocaleDateString()}</p>
                {a.hora_entrada && <p>Entrada: {asisHoraCorta(a.hora_entrada)}</p>}
                {a.hora_salida && <p>Salida: {asisHoraCorta(a.hora_salida)}</p>}
                {a.horas_trabajadas != null && <p>Horas trabajadas: {a.horas_trabajadas.toFixed(2)}</p>}
                <span className={`rrhh-badge ${a.tipo_registro}`}>
                  {a.tipo_registro}
                </span>
              </div>
              <button className="rrhh-asis-del-btn" title="Eliminar registro" onClick={() => eliminar(a)}>
                🗑️ Eliminar
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Componente de Reportes
const ReportesTab = ({ asistencia, ausencias, turnos, fechaDesde, fechaHasta }: {
  asistencia: Asistencia[]
  ausencias: Ausencia[]
  turnos: Turno[]
  fechaDesde: string
  fechaHasta: string
}) => {
  const totalHorasTrabajadas = asistencia.reduce((sum, a) => sum + (a.horas_trabajadas || 0), 0)
  const totalAusencias = ausencias.filter(a => a.estado === 'aprobado').reduce((sum, a) => sum + a.dias, 0)
  const totalTurnos = turnos.length

  return (
    <div className="rrhh-tab-content">
      <div className="rrhh-section-header">
        <h2>Reportes de Horarios</h2>
      </div>

      <div className="rrhh-reportes-grid">
        <div className="rrhh-reporte-card">
          <h3>Total Horas Trabajadas</h3>
          <p className="rrhh-reporte-value">{totalHorasTrabajadas.toFixed(2)}</p>
          <p className="rrhh-reporte-periodo">
            {new Date(fechaDesde).toLocaleDateString()} - {new Date(fechaHasta).toLocaleDateString()}
          </p>
        </div>
        <div className="rrhh-reporte-card">
          <h3>Total Ausencias</h3>
          <p className="rrhh-reporte-value">{totalAusencias}</p>
          <p className="rrhh-reporte-periodo">Días aprobados</p>
        </div>
        <div className="rrhh-reporte-card">
          <h3>Total Turnos</h3>
          <p className="rrhh-reporte-value">{totalTurnos}</p>
          <p className="rrhh-reporte-periodo">En el período</p>
        </div>
      </div>
    </div>
  )
}

export default RecursosHumanosHorariosPage

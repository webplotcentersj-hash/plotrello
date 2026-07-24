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
import RelojHistorialCalendario from '../components/RelojHistorialCalendario'
import PermisosAutorizadosCalendario from '../components/PermisosAutorizadosCalendario'
import RrhhNovedadDetailModal from '../components/RrhhNovedadDetailModal'
import type { UsuarioRecord, Asistencia, RrhhRelojReporteSemanal, RrhhNovedad, SolicitudPermiso } from '../types/api'
import { crearSnapshotReloj, parseSnapshotReloj } from '../utils/relojReporteSnapshot'
import { exportarAsistenciaPlanillaXlsx } from '../utils/exportAsistenciaPlanillaXlsx'
import {
  abreviaturaCodigoNovedad,
  esDiaHabil,
  novedadEnDia
} from '../utils/rrhhNovedadDates'
import { etiquetaCodigoRrhhNovedad } from '../utils/rrhhNovedadCatalog'
import { asistenciaHoraCorta } from '../utils/dateUtils'
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
  filtrarDiasConDatosPlanilla,
  matchearUsuario,
  matchearUsuariosReloj,
  inferirEmailPlotcenter,
  formatHoras,
  CONFIG_CALCULO_DEFAULT,
  type ResumenEmpleado,
  type ConfigCalculo,
  type MarcacionReloj,
  type PlanillaEmpleado
} from '../services/relojBiometricoService'
import { detectarNovedadesDesdeAsistencia, sincronizarNovedadesDesdeAsistencia } from '../utils/rrhhAsistenciaNovedadSync'
import RelojTabletMarcacionesTab from '../components/RelojTabletMarcacionesTab'
import RelojFacialTab from '../components/RelojFacialTab'
import './RecursosHumanosHorariosPage.css'

type TabType = 'horarios' | 'permisos' | 'asistencia' | 'estadisticas' | 'reloj' | 'tablet-reloj' | 'reloj-facial'

const RecursosHumanosHorariosPage = () => {
  const navigate = useNavigate()
  const { canManageRecursosHumanos, usuario, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabType>('horarios')
  const [relojReporteJump, setRelojReporteJump] = useState<RrhhRelojReporteSemanal | null>(null)
  
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
            🗓️ Permisos
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
            className={`rrhh-tab ${activeTab === 'reloj' ? 'active' : ''}`}
            onClick={() => setActiveTab('reloj')}
          >
            🕒 Reloj
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

        {activeTab === 'permisos' && (
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
            onIrAReloj={() => setActiveTab('reloj')}
          />
        )}

        {activeTab === 'permisos' && (
          <div className="rrhh-tab-content">
            <div className="rrhh-section-header">
              <h2>Permisos autorizados</h2>
            </div>
            <PermisosAutorizadosCalendario
              usuarios={usuarios}
              permisos={permisos}
            />
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
            onIrNovedades={() => navigate('/rrhh/novedades')}
          />
        )}

        {activeTab === 'estadisticas' && (
          <EstadisticasAsistenciaTab
            usuarios={usuarios}
            usuarioSeleccionado={usuarioSeleccionado}
          />
        )}

        {activeTab === 'reloj' && (
          <RelojImportTab
            usuarios={usuarios}
            usuarioActual={usuario}
            reporteInicial={relojReporteJump}
            onReporteInicialConsumido={() => setRelojReporteJump(null)}
            onImportadoAsistencia={(desde, hasta) => {
              setFechaDesde(desde)
              setFechaHasta(hasta)
            }}
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
// Importar Reloj Biométrico
// ============================================================
type ModoRelojTab = 'calendario' | 'importar' | 'reporte'

const RelojImportTab = ({
  usuarios,
  usuarioActual,
  reporteInicial,
  onReporteInicialConsumido,
  onImportadoAsistencia
}: {
  usuarios: UsuarioRecord[]
  usuarioActual: { id: number } | null
  reporteInicial?: RrhhRelojReporteSemanal | null
  onReporteInicialConsumido?: () => void
  onImportadoAsistencia?: (fechaDesde: string, fechaHasta: string) => void
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [modo, setModo] = useState<ModoRelojTab>('calendario')
  const [calendarioMes, setCalendarioMes] = useState(() => new Date())
  const [reportesGuardados, setReportesGuardados] = useState<RrhhRelojReporteSemanal[]>([])
  const [reporteActivoId, setReporteActivoId] = useState<number | null>(null)
  const [cargandoReportes, setCargandoReportes] = useState(false)
  const [autoGuardando, setAutoGuardando] = useState(false)
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
  const [legajosBasico, setLegajosBasico] = useState<
    Record<number, { nombre: string; apellido: string; email: string | null }>
  >({})
  const [usuariosParaReloj, setUsuariosParaReloj] = useState<UsuarioRecord[]>(usuarios)

  useEffect(() => {
    let cancelado = false
    apiService.getUsuariosParaRelojMatch().then((r) => {
      if (!cancelado && r.success && r.data?.length) setUsuariosParaReloj(r.data)
    })
    return () => {
      cancelado = true
    }
  }, [])

  useEffect(() => {
    let cancelado = false
    apiService.obtenerLegajosBasico().then((r) => {
      if (!cancelado && r.success && r.data) {
        setLegajosBasico(
          Object.fromEntries(
            Object.entries(r.data).map(([id, leg]) => [
              Number(id),
              { nombre: leg.nombre, apellido: leg.apellido, email: leg.email ?? null }
            ])
          )
        )
      }
    })
    return () => {
      cancelado = true
    }
  }, [])

  const usuariosLite = useMemo(
    () =>
      usuariosParaReloj.map((u) => {
        const leg = legajosBasico[u.id]
        return {
          id: u.id,
          nombre: u.nombre,
          email:
            leg?.email ||
            (u.nombre.includes('@') ? u.nombre : inferirEmailPlotcenter(u.nombre)),
          legajoNombre: leg?.nombre || null,
          legajoApellido: leg?.apellido || null
        }
      }),
    [usuariosParaReloj, legajosBasico]
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
  const vinculos = useMemo(
    () => matchearUsuariosReloj(planilla, usuariosLite, override),
    [planilla, override, usuariosLite]
  )

  const construirVinculosInline = (
    pl: PlanillaEmpleado[],
    ov: Record<string, number>
  ): Record<string, { id: number; nombre: string }> => matchearUsuariosReloj(pl, usuariosLite, ov)

  const cargarReportesGuardados = async () => {
    setCargandoReportes(true)
    try {
      const r = await apiService.listarRelojReportesSemanales()
      if (r.success && r.data) setReportesGuardados(r.data)
    } finally {
      setCargandoReportes(false)
    }
  }

  useEffect(() => {
    void cargarReportesGuardados()
  }, [])

  const aplicarSnapshot = (snap: ReturnType<typeof parseSnapshotReloj>, meta?: RrhhRelojReporteSemanal) => {
    if (!snap) return
    setConfig(snap.config)
    setPlanilla(snap.planilla)
    setDiasPeriodo(snap.diasPeriodo)
    setOverride(snap.override)
    setHorariosFijos(snap.horariosFijos)
    setFileName(snap.fileName || meta?.archivo_nombre || '')
    setInformeIa(snap.informeIa ?? '')
    setRegistrarTardanzas(snap.registrarTardanzas ?? true)
    setMarcaciones(planillaToMarcaciones(snap.planilla))
    setCeldaEdit(null)
    setEmpleadoExpandido(null)
    setVista('resumen')
    if (meta) setReporteActivoId(meta.id)
    if (snap.guardadoAsistencia) {
      setResultadoGuardado(
        `✓ Informe guardado · ${snap.guardadoAsistencia.total} registros de asistencia (${snap.guardadoAsistencia.insertados} nuevos, ${snap.guardadoAsistencia.actualizados} actualizados).`
      )
    }
  }

  const abrirReporteGuardado = (r: RrhhRelojReporteSemanal) => {
    const snap = parseSnapshotReloj(r.payload)
    if (!snap) {
      setError('No se pudo leer el informe guardado.')
      return
    }
    setError('')
    aplicarSnapshot(snap, r)
    setModo('reporte')
  }

  useEffect(() => {
    if (!reporteInicial) return
    abrirReporteGuardado(reporteInicial)
    onReporteInicialConsumido?.()
  }, [reporteInicial])

  const persistirReporteSemanal = async (opts?: {
    pl?: PlanillaEmpleado[]
    dias?: string[]
    cfg?: ConfigCalculo
    ov?: Record<string, number>
    fijos?: typeof horariosFijos
    fname?: string
    informe?: string
    guardadoAsistencia?: { insertados: number; actualizados: number; total: number } | null
    registrarAsistencia?: boolean
    registrarTardanzasFlag?: boolean
    resumenes?: ResumenEmpleado[]
  }): Promise<number | null> => {
    const pl = opts?.pl ?? planilla
    const diasRaw = opts?.dias ?? diasPeriodo
    const dias = filtrarDiasConDatosPlanilla(pl, diasRaw)
    if (!pl.length || !dias.length) return null
    const periodoDesde = dias[0]
    const periodoHasta = dias[dias.length - 1]
    const resParaSnap = opts?.resumenes ?? resumenes
    const snapshot = crearSnapshotReloj({
      config: opts?.cfg ?? config,
      planilla: pl,
      diasPeriodo: dias,
      override: opts?.ov ?? override,
      horariosFijos: opts?.fijos ?? horariosFijos,
      fileName: opts?.fname ?? fileName,
      informeIa: opts?.informe ?? informeIa,
      resumenesCompactos: resParaSnap.map((e) => ({
        idUsuario: e.idUsuario,
        nombre: e.nombre,
        departamento: e.departamento,
        totalHoras: e.totalHoras,
        totalExtra: e.totalExtra,
        tardanzas: e.tardanzas,
        anomalias: e.anomalias,
        puntualidadPct: e.puntualidadPct,
        diasTrabajados: e.diasTrabajados
      })),
      registrarTardanzas: opts?.registrarTardanzasFlag ?? registrarTardanzas,
      guardadoAsistencia: opts?.guardadoAsistencia ?? null
    })
    if (!usuarioActual?.id) return null
    const resp = await apiService.guardarRelojReporteSemanal({
      periodoDesde,
      periodoHasta,
      archivoNombre: snapshot.fileName,
      payload: snapshot as unknown as Record<string, unknown>,
      registradoPor: usuarioActual.id
    })
    if (resp.success && resp.data) {
      setReporteActivoId(resp.data.id)
      await cargarReportesGuardados()
      return resp.data.id
    }
    return null
  }

  // Recompute central: cada vez que cambian la planilla, los vínculos, los vínculos, los
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
        await persistirReporteSemanal({
          guardadoAsistencia: resp.data ?? null,
          registrarTardanzasFlag: registrarTardanzas
        })
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
  const registrarTardanzasEnLegajo = async (
    resOverride?: ResumenEmpleado[],
    vincOverride?: Record<string, { id: number; nombre: string }>
  ): Promise<{ creadas: number; omitidas: number; error?: string }> => {
    const tardanzas = construirTardanzas(resOverride ?? resumenes, vincOverride ?? vinculos)
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

  const autoGuardarImportacion = async (
    pl: PlanillaEmpleado[],
    dias: string[],
    cfg: ConfigCalculo,
    fname: string
  ) => {
    setAutoGuardando(true)
    setErrorGuardado('')
    setResultadoGuardado('')
    try {
      const vinc = construirVinculosInline(pl, {})
      const mesImport = dias[0]?.slice(0, 7) ?? mesActivo
      const horariosResp = await apiService.obtenerHorariosFijos(mesImport)
      const fijosImport =
        horariosResp.success && horariosResp.data ? horariosResp.data : horariosFijos
      if (horariosResp.success && horariosResp.data) {
        setHorariosFijos(horariosResp.data)
      }
      const mapaFijos = construirMapaHorariosFijos(vinc, fijosImport)
      const res = procesarMarcaciones(planillaToMarcaciones(pl), cfg, mapaFijos)
      const { registros, vinculados, noVinculados } = construirRegistrosAsistencia(res, vinc)

      let guardadoAsistencia: { insertados: number; actualizados: number; total: number } | null = null
      let msg = '✓ Informe semanal guardado automáticamente.'

      if (registros.length) {
        const resp = await apiService.registrarAsistenciaReloj(registros)
        if (resp.success && resp.data) {
          guardadoAsistencia = resp.data
          msg += ` Asistencia: ${resp.data.total} registros (${vinculados.length}/${pl.length} empleados).`
          if (noVinculados.length) {
            msg += ` Sin vínculo: ${noVinculados.join(', ')}.`
          }
          if (registrarTardanzas) {
            const tardRes = await registrarTardanzasEnLegajo(res, vinc)
            if (tardRes.error) msg += ` Tardanzas: ${tardRes.error}`
            else msg += ` Tardanzas en legajo: ${tardRes.creadas} nuevas.`
          }
        } else {
          msg += ` Asistencia: ${resp.error || 'no se pudo registrar'}.`
        }
      } else if (noVinculados.length) {
        msg += ` Sin asistencia: ningún empleado vinculado (${noVinculados.length} sin match).`
      }

      await persistirReporteSemanal({
        pl,
        dias,
        cfg,
        ov: {},
        fname,
        guardadoAsistencia,
        registrarTardanzasFlag: registrarTardanzas,
        resumenes: res
      })
      setResultadoGuardado(msg)
      setModo('reporte')
      if (dias.length && onImportadoAsistencia) {
        onImportadoAsistencia(dias[0], dias[dias.length - 1])
      }
    } catch (e) {
      setErrorGuardado(e instanceof Error ? e.message : 'Error al guardar el informe.')
    } finally {
      setAutoGuardando(false)
    }
  }

  const procesar = (buffer: ArrayBuffer, cfg: ConfigCalculo, nombreArchivo: string) => {
    setProcesando(true)
    setError('')
    try {
      const { marcaciones: marc, resumenes: res, planillaDirecta, diasPeriodo } = procesarArchivoReloj(
        buffer,
        cfg
      )
      if (!marc.length) {
        setError(
          'No se encontraron marcaciones. Usá el Excel crudo del reloj (columnas Nombre y Fecha/Hora) o la planilla de asistencia (Empleado + fechas).'
        )
        setMarcaciones([])
        setResumenes([])
        return
      }
      setMarcaciones(marc)
      setResumenes(res)
      const pl = planillaDirecta?.length ? planillaDirecta : construirPlanilla(res)
      setPlanilla(pl)
      const diasRaw = diasPeriodo?.length ? diasPeriodo : diasDelPeriodo(marc)
      const dias = filtrarDiasConDatosPlanilla(pl, diasRaw)
      setDiasPeriodo(dias)
      setCeldaEdit(null)
      setInformeIa('')
      setErrorGuardado('')
      setModo('reporte')
      void autoGuardarImportacion(pl, dias, cfg, nombreArchivo)
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
    procesar(buffer, config, file.name)
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
    if (!plotLabId || !entrada) return
    const previo = horariosFijos[plotLabId]
    const salidaFinal = salida || previo?.salida || '18:00'
    const horas = previo?.horas ?? null
    const trabajaSabado = previo?.trabajaSabado ?? true
    setHorariosFijos((prev) => ({ ...prev, [plotLabId]: { entrada, salida: salidaFinal, horas, trabajaSabado } }))
    setGuardandoFijo(plotLabId)
    try {
      const r = await apiService.upsertHorarioFijo(plotLabId, entrada, salidaFinal, horas, mesActivo, trabajaSabado)
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
      await persistirReporteSemanal({ informe, resumenes })
    } catch (e) {
      setErrorIa(e instanceof Error ? e.message : 'No se pudo generar el informe con IA.')
    } finally {
      setGenerandoIa(false)
    }
  }

  return (
    <div className="rrhh-reloj-tab">
      <div className="reloj-subnav">
        <button
          type="button"
          className={`reloj-subnav-btn${modo === 'calendario' ? ' active' : ''}`}
          onClick={() => setModo('calendario')}
        >
          📅 Informes semanales
        </button>
        <button
          type="button"
          className={`reloj-subnav-btn${modo === 'importar' ? ' active' : ''}`}
          onClick={() => setModo('importar')}
        >
          📂 Importar Excel
        </button>
        {resumenes.length > 0 && modo === 'reporte' ? (
          <button type="button" className="reloj-subnav-btn active" disabled>
            📊 Reporte del período
          </button>
        ) : null}
      </div>

      {modo === 'calendario' && (
        <>
          <div className="reloj-intro">
            <h2>🕒 Informes del reloj biométrico</h2>
            <p>
              Calendario de reportes semanales guardados. Tocá un día con informe para ver el mismo
              desglose que al importar (KPIs, gráficos, planilla y detalle por empleado).
            </p>
          </div>
          {cargandoReportes ? <div className="reloj-procesando">Cargando informes…</div> : null}
          <RelojHistorialCalendario
            mes={calendarioMes}
            reportes={reportesGuardados}
            reporteActivoId={reporteActivoId}
            onMesChange={setCalendarioMes}
            onSeleccionarReporte={abrirReporteGuardado}
          />
          <div className="reloj-historial-actions">
            <button type="button" className="btn-primary" onClick={() => setModo('importar')}>
              📂 Importar nuevo Excel del reloj
            </button>
          </div>
        </>
      )}

      {modo === 'importar' && (
        <>
      <div className="reloj-intro">
        <h2>🕒 Importar asistencia del reloj biométrico</h2>
        <p>
          Subí el Excel que exporta el reloj (marcaciones crudas) o la planilla de asistencia de Plot Lab
          (Empleado + columnas por fecha). Al procesarlo se guarda el informe y la asistencia en Plot Lab
          automáticamente (sin cambiar de pestaña). Los empleados se vinculan por login @plotcenter.com.ar.
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
        {autoGuardando && <span className="reloj-filename">Guardando informe…</span>}
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
                          <label title="Trabaja sábado 9:00 a 14:00">
                            <input
                              type="checkbox"
                              checked={r.trabajaSabado}
                              onChange={(e) => actualizarPrevFijo(i, { trabajaSabado: e.target.checked })}
                            />
                            {r.trabajaSabado ? ' 9–14' : ''}
                          </label>
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
        </>
      )}

      {modo === 'reporte' && resumenes.length > 0 ? (
        <div className="reloj-reporte-toolbar">
          <button type="button" className="btn-secondary" onClick={() => setModo('calendario')}>
            ← Volver al calendario
          </button>
          <button type="button" className="btn-secondary" onClick={() => setModo('importar')}>
            📂 Importar otro Excel
          </button>
        </div>
      ) : null}

      {(modo === 'reporte' || (modo === 'importar' && resumenes.length > 0)) && resumenes.length > 0 && (
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
            <button className="btn-primary reloj-btn-guardar" onClick={handleGuardar} disabled={guardando || autoGuardando}>
              {guardando ? '💾 Guardando...' : '💾 Actualizar en Plot Lab'}
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
                                      {s.entradaStr ? asistenciaHoraCorta(s.entradaStr) : '—'}
                                      {s.tarde && <span className="reloj-tarde-badge"> tarde</span>}
                                    </td>
                                    <td>
                                      {s.salidaStr ? asistenciaHoraCorta(s.salidaStr) : '—'}
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

const HorariosTab = ({ usuarios, usuarioSeleccionado, onIrAReloj }: {
  usuarios: UsuarioRecord[]
  usuarioSeleccionado: number | null
  onIrAReloj: () => void
}) => {
  // Horarios fijos (planilla editable): entrada/salida/jornada estándar por empleado.
  const [fijos, setFijos] = useState<
    Record<number, { entrada: string; salida: string; horas?: number | null; trabajaSabado?: boolean; vigenteDesde?: string; esDelMes?: boolean }>
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

  const upsertFijo = async (idUsuario: number, entrada: string, salida: string, horas: number | null, trabajaSabado: boolean) => {
    if (!idUsuario || !entrada || !salida) return
    const previo = fijos[idUsuario]
    setFijos((prev) => ({
      ...prev,
      [idUsuario]: { entrada, salida, horas, trabajaSabado, vigenteDesde: mes, esDelMes: true }
    }))
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
            <button type="button" className="btn-secondary rrhh-btn-oscuro" onClick={onIrAReloj}>
              🕒 Importar / ver informes
            </button>
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
          <strong>Sáb 9–14</strong>: si está marcada, el sábado cuenta 5 hs (9 a 14); si no, el sábado es todo extra.
        </p>
        <div className="rrhh-fijos-tabla-wrap">
          <table className="rrhh-fijos-tabla">
            <thead>
              <tr>
                <th>Empleado</th>
                <th>Área</th>
                <th>Horario fijo</th>
                <th>Jornada (hs)</th>
                <th title="Si marca: trabaja sábado 9 a 14 hs. Si no, el sábado es todo extra.">Sáb 9–14</th>
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
                          f?.trabajaSabado === false
                            ? 'Lun–Vie (sábado todo extra)'
                            : 'Trabaja sábado 9:00 a 14:00 (5 hs)'
                        }
                      >
                        <input
                          type="checkbox"
                          checked={f?.trabajaSabado !== false}
                          disabled={!tieneHorario || guardandoFijo === u.id}
                          onChange={(e) => guardarSabado(u.id, e.target.checked)}
                        />
                        <span>{tieneHorario && f?.trabajaSabado !== false ? '9–14' : '—'}</span>
                      </label>
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
  onIrNovedades
}: {
  asistencia: Asistencia[]
  novedades: RrhhNovedad[]
  usuarios: UsuarioRecord[]
  fechaDesde: string
  fechaHasta: string
  registradoPorId: number | null
  onNovedadesActualizadas: () => void
  onIrNovedades: () => void
}) => {
  const [novedadDetalle, setNovedadDetalle] = useState<RrhhNovedad | null>(null)
  const [asistenciaDetalle, setAsistenciaDetalle] = useState<Asistencia | null>(null)
  const [asistenciaDetalleExtra, setAsistenciaDetalleExtra] = useState<number | null>(null)
  const [asistenciaDetalleAcum, setAsistenciaDetalleAcum] = useState<number | null>(null)
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
              trabajaSabado: h.trabajaSabado
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
        contenido: <span className="celda-nov-label">{label}</span>,
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
            <strong>S/M</strong> = sin marca en día hábil. Clic en celda para ver detalle.
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
        <div className="rrhh-asis-detalle-overlay" onMouseDown={() => { setAsistenciaDetalle(null); setAsistenciaDetalleExtra(null); setAsistenciaDetalleAcum(null) }}>
          <div className="rrhh-asis-detalle-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="rrhh-asis-detalle-head">
              <h3>Registro de asistencia</h3>
              <button type="button" className="rrhh-asis-detalle-close" onClick={() => { setAsistenciaDetalle(null); setAsistenciaDetalleExtra(null); setAsistenciaDetalleAcum(null) }}>
                ✕
              </button>
            </div>
            <dl className="rrhh-asis-detalle-dl">
              <dt>Empleado</dt>
              <dd>{asistenciaDetalle.nombre_usuario || nombres.get(asistenciaDetalle.id_usuario) || '—'}</dd>
              <dt>Fecha</dt>
              <dd>{new Date(asistenciaDetalle.fecha).toLocaleDateString('es-AR')}</dd>
              <dt>Entrada</dt>
              <dd className="leyenda-entrada">{asistenciaHoraCorta(asistenciaDetalle.hora_entrada) || '—'}</dd>
              <dt>Salida</dt>
              <dd className="leyenda-salida">{asistenciaHoraCorta(asistenciaDetalle.hora_salida) || '—'}</dd>
              <dt>Horas</dt>
              <dd>{asistenciaDetalle.horas_trabajadas != null ? `${asistenciaDetalle.horas_trabajadas.toFixed(1)} hs` : '—'}</dd>
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
              <dt>Tipo</dt>
              <dd>{asistenciaDetalle.tipo_registro}</dd>
              {asistenciaDetalle.observaciones ? (
                <>
                  <dt>Observaciones</dt>
                  <dd>{asistenciaDetalle.observaciones}</dd>
                </>
              ) : null}
            </dl>
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
                trabajaSabado: h.trabajaSabado
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

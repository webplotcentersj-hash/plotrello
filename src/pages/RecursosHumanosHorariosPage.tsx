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
import './RecursosHumanosHorariosPage.css'

type TabType = 'horarios' | 'permisos' | 'asistencia' | 'reloj'

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
            className={`rrhh-tab ${activeTab === 'reloj' ? 'active' : ''}`}
            onClick={() => setActiveTab('reloj')}
          >
            🕒 Reloj
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
            onEliminar={handleEliminarAsistencia}
            onIrNovedades={() => navigate('/rrhh/novedades')}
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

const HorariosTab = ({ usuarios, usuarioSeleccionado, onIrAReloj }: {
  usuarios: UsuarioRecord[]
  usuarioSeleccionado: number | null
  onIrAReloj: () => void
}) => {
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
          Misma planilla de horarios fijos que usa el importador del reloj biométrico. Entrada, salida y jornada
          por mes son la referencia para puntualidad y horas extra. Se completan al importar la planilla
          &quot;PERSONAL ACTUAL&quot; o desde la pestaña Reloj.
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
    </div>
  )
}

// Componente de Asistencia

const pad2 = (n: number) => String(n).padStart(2, '0')

const ASIS_DOW_CORTO = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa']

const AsistenciaTab = ({
  asistencia,
  novedades,
  usuarios,
  fechaDesde,
  fechaHasta,
  onEliminar,
  onIrNovedades
}: {
  asistencia: Asistencia[]
  novedades: RrhhNovedad[]
  usuarios: UsuarioRecord[]
  fechaDesde: string
  fechaHasta: string
  onEliminar: (id: number) => void
  onIrNovedades: () => void
}) => {
  const [novedadDetalle, setNovedadDetalle] = useState<RrhhNovedad | null>(null)

  const eliminar = (a: Asistencia) => {
    if (!a?.id) return
    if (!confirm(`¿Eliminar el registro de ${a.nombre_usuario || 'este empleado'} del ${new Date(a.fecha).toLocaleDateString()}?`)) return
    onEliminar(a.id)
  }

  const dias = useMemo(() => {
    const [y, m, d] = fechaDesde.split('-').map(Number)
    const [Y, M, D] = fechaHasta.split('-').map(Number)
    const cur = new Date(y, m - 1, d)
    const fin = new Date(Y, M - 1, D)
    const out: string[] = []
    while (cur <= fin) {
      out.push(`${cur.getFullYear()}-${pad2(cur.getMonth() + 1)}-${pad2(cur.getDate())}`)
      cur.setDate(cur.getDate() + 1)
    }
    return out
  }, [fechaDesde, fechaHasta])

  const nombres = useMemo(() => {
    const m = new Map<number, string>()
    usuarios.forEach((u) => m.set(u.id, u.nombre))
    asistencia.forEach((a) => {
      if (a.nombre_usuario) m.set(a.id_usuario, a.nombre_usuario)
    })
    return m
  }, [usuarios, asistencia])

  const empleados = useMemo(() => {
    const ids = new Set<number>()
    asistencia.forEach((a) => ids.add(a.id_usuario))
    novedades
      .filter((n) => n.grupo === 'falta' || n.grupo === 'licencia' || n.grupo === 'tardanza_retiro')
      .forEach((n) => ids.add(n.id_usuario))

    const map = new Map<number, { id: number; nombre: string; dias: Record<string, Asistencia>; horas: number }>()
    for (const id of ids) {
      map.set(id, {
        id,
        nombre: nombres.get(id) || `Usuario ${id}`,
        dias: {},
        horas: 0
      })
    }
    for (const a of asistencia) {
      const emp = map.get(a.id_usuario)
      if (!emp) continue
      emp.dias[a.fecha.slice(0, 10)] = a
      emp.horas += a.horas_trabajadas || 0
    }
    return [...map.values()].sort((x, y) => x.nombre.localeCompare(y.nombre))
  }, [asistencia, novedades, nombres])

  const novedadesPorUsuarioDia = useMemo(() => {
    const m = new Map<string, RrhhNovedad[]>()
    for (const n of novedades) {
      for (const f of dias) {
        if (!novedadEnDia(n, f)) continue
        const k = `${n.id_usuario}|${f}`
        const prev = m.get(k) ?? []
        prev.push(n)
        m.set(k, prev)
      }
    }
    return m
  }, [novedades, dias])

  const exportar = () => {
    if (!empleados.length) return
    exportarAsistenciaPlanillaXlsx({ empleados, dias, novedades, fechaDesde, fechaHasta })
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

    if (a) {
      if (a.tipo_registro === 'ausente' || a.tipo_registro === 'justificado') {
        const nov = novs[0]
        const label = nov
          ? abreviaturaCodigoNovedad(nov.codigo)
          : a.tipo_registro === 'justificado'
            ? 'JUS'
            : 'AUS'
        return {
          cls: `celda-aus${nov ? ' celda-nov-vinc' : ''}`,
          contenido: <span className="celda-nov-label">{label}</span>,
          title: [
            nov ? etiquetaCodigoRrhhNovedad(nov.codigo) : a.tipo_registro,
            a.observaciones,
            nov?.observaciones,
            a.tipo_registro === 'ausente' ? '(clic en registro para eliminar)' : ''
          ]
            .filter(Boolean)
            .join(' · '),
          onClick: () => eliminar(a)
        }
      }
      const e = asistenciaHoraCorta(a.hora_entrada)
      const s = asistenciaHoraCorta(a.hora_salida)
      const tardeNov = novs.find((n) => n.codigo === 'tardanza')
      return {
        cls: `${a.tipo_registro === 'tarde' || tardeNov ? 'celda-tarde' : 'celda-ok'}${!s && e ? ' celda-sin-salida' : ''}`,
        contenido: (
          <>
            <span className="celda-h">{e || '—'}</span>
            <span className="celda-h">{s || '—'}</span>
            {tardeNov ? <span className="celda-nov-mini">T</span> : null}
          </>
        ),
        title: [e && s ? `${e}–${s}` : e ? `Entrada ${e}` : '', a.observaciones, tardeNov ? etiquetaCodigoRrhhNovedad(tardeNov.codigo) : '', '(clic para eliminar)']
          .filter(Boolean)
          .join(' · '),
        onClick: () => eliminar(a)
      }
    }

    if (novs.length) {
      const n = novs[0]
      return {
        cls: `celda-nov celda-nov--${n.grupo}`,
        contenido: (
          <span className="celda-nov-label">{abreviaturaCodigoNovedad(n.codigo)}</span>
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
            Planilla del período filtrado. Las celdas muestran entrada/salida, ausencias y novedades de legajo
            (faltas, licencias, tardanzas). <strong>S/M</strong> = sin marca en día hábil. Clic en novedad para
            ver detalle; clic en registro de asistencia para eliminar.
          </p>
          <div className="rrhh-asis-leyenda">
            <span className="leyenda-ok">✓ Presente</span>
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
                </tr>
              </thead>
              <tbody>
                {empleados.map((emp) => (
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {novedadDetalle ? (
        <RrhhNovedadDetailModal
          novedad={novedadDetalle}
          empleadoNombre={nombres.get(novedadDetalle.id_usuario) || 'Empleado'}
          onClose={() => setNovedadDetalle(null)}
        />
      ) : null}
    </div>
  )
}

export default RecursosHumanosHorariosPage

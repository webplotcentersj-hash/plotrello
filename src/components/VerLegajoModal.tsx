import { useMemo, useState, useEffect } from 'react'
import { addMonths, format } from 'date-fns'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { nombreCompletoLegajo, nombreVisibleDesdeRecord } from '../utils/usuarioDisplayName'
import apiService from '../services/api'
import type {
  Capacitacion,
  Evaluacion,
  HistorialMovimiento,
  LegajoEmpleado,
  PruebaAsignacionColaborador,
  RrhhEventoLaboral,
  RrhhNovedad,
  SolicitudPermiso,
  UsuarioBajaLog,
  UsuarioRecord,
  Venta
} from '../types/api'
import { clasificarNovedadLegajo } from '../utils/rrhhNovedadClasificacionLegajo'
import RrhhNovedadDetailModal from './RrhhNovedadDetailModal'
import type { PedidoCompra } from '../types/pedidos'
import { isoToArgentinaDateKey } from '../utils/dateUtils'
import { jsPDF } from 'jspdf'
import LegajoTimeline from './LegajoTimeline'
import LegajoCapacitacionesPanel from './LegajoCapacitacionesPanel'
import LegajoPruebasPanel from './LegajoPruebasPanel'
import LegajoNovedadesPanel from './LegajoNovedadesPanel'
import LegajoActividadesPlotPanel from './LegajoActividadesPlotPanel'
import { listarNotasLegajoOperario } from '../features/work-pool/workPoolOperarioNotas'
import { construirHojaVidaLaboral, type HojaVidaEvento } from '../utils/hojaVidaLaboral'
import {
  calcularBenchmarkSectorColaborador,
  type BenchmarkSectorColaborador,
  type LegajoSectorBasico
} from '../utils/rrhhNovedadesSectorStats'
import { calcularSaldoVacaciones } from '../utils/rrhhVacacionesSaldo'
import { rrhhOnboardingResumenUsuario, rrhhMedicinaListar } from '../services/rrhhExtendidoService'
import './VerLegajoModal.css'

type VerLegajoModalProps = {
  usuario: UsuarioRecord
  isOpen: boolean
  onClose: () => void
  onDarDeBaja?: () => void
  /** Tab inicial; acepta ids viejos (movimientos, evaluaciones, etc.) y los unifica. */
  initialTab?: string
}

type LegajoTabId = 'legajo' | 'hoja_vida' | 'resumen' | 'desarrollo'

/** Tabs viejos → unificados (resumen / desarrollo). */
function normalizeLegajoTab(raw: string | undefined): LegajoTabId {
  const t = String(raw || 'legajo')
  if (t === 'capacitaciones' || t === 'pruebas' || t === 'evaluaciones' || t === 'desarrollo') {
    return 'desarrollo'
  }
  if (
    t === 'movimientos' ||
    t === 'pedidos' ||
    t === 'permisos' ||
    t === 'novedades' ||
    t === 'actividades_plot' ||
    t === 'resumen'
  ) {
    return 'resumen'
  }
  if (t === 'hoja_vida') return 'hoja_vida'
  return 'legajo'
}

type PruebaRow = {
  id: string
  titulo: string
  descripcion?: string | null
  porcentaje_aprobacion?: number | null
  created_at?: string
}

type ResultadoPayload = {
  prueba: { id?: string; titulo?: string; descripcion?: string | null; porcentaje_aprobacion?: number }
  asignaciones: { id_usuario?: number; aprobado?: boolean | null; puntaje_obtenido?: number | null; puntaje_maximo?: number | null; estado?: string }[]
}

const VerLegajoModal = ({
  usuario,
  isOpen,
  onClose,
  onDarDeBaja,
  initialTab = 'legajo'
}: VerLegajoModalProps) => {
  const { usuario: authUsuario, canManageRecursosHumanos } = useAuth()
  const puedeGestionarHojaVida =
    !!authUsuario && (canManageRecursosHumanos || authUsuario.rol === 'gerencia')

  const [loading, setLoading] = useState(false)
  const [legajo, setLegajo] = useState<LegajoEmpleado | null>(null)
  const empleadoNombre = useMemo(
    () => nombreCompletoLegajo(legajo) || nombreVisibleDesdeRecord(usuario),
    [legajo, usuario]
  )
  const [tab, setTab] = useState<LegajoTabId>('legajo')
  const [pdfGenerating, setPdfGenerating] = useState(false)
  const [pdfError, setPdfError] = useState<string | null>(null)

  const [movLoading, setMovLoading] = useState(false)
  const [movError, setMovError] = useState<string | null>(null)
  const [movimientos, setMovimientos] = useState<HistorialMovimiento[]>([])

  const [capLoading, setCapLoading] = useState(false)
  const [capError, setCapError] = useState<string | null>(null)
  const [capacitaciones, setCapacitaciones] = useState<Capacitacion[]>([])

  const [permLoading, setPermLoading] = useState(false)
  const [permError, setPermError] = useState<string | null>(null)
  const [permisos, setPermisos] = useState<SolicitudPermiso[]>([])

  const [evalLoading, setEvalLoading] = useState(false)
  const [evalError, setEvalError] = useState<string | null>(null)
  const [evaluaciones, setEvaluaciones] = useState<Evaluacion[]>([])

  const [pedLoading, setPedLoading] = useState(false)
  const [pedError, setPedError] = useState<string | null>(null)
  const [pedidos, setPedidos] = useState<PedidoCompra[]>([])

  const [ventas, setVentas] = useState<Venta[]>([])
  const [ventasLoading, setVentasLoading] = useState(false)
  const [plotNotasCount, setPlotNotasCount] = useState(0)
  const [plotLoading, setPlotLoading] = useState(false)
  const [resumenLoaded, setResumenLoaded] = useState(false)

  const [prueLoading, setPrueLoading] = useState(false)
  const [prueError, setPrueError] = useState<string | null>(null)
  const [pruebas, setPruebas] = useState<PruebaAsignacionColaborador[]>([])

  const [novLoading, setNovLoading] = useState(false)
  const [novError, setNovError] = useState<string | null>(null)
  const [novedadesRRHH, setNovedadesRRHH] = useState<RrhhNovedad[]>([])
  const [novedadDetail, setNovedadDetail] = useState<RrhhNovedad | null>(null)
  const [novBenchmark, setNovBenchmark] = useState<BenchmarkSectorColaborador | null>(null)

  const [hvLoading, setHvLoading] = useState(false)
  const [hvError, setHvError] = useState<string | null>(null)
  const [hojaVidaEventos, setHojaVidaEventos] = useState<HojaVidaEvento[]>([])
  const [hvLoaded, setHvLoaded] = useState(false)
  const [vacacionesSaldoChip, setVacacionesSaldoChip] = useState<string | null>(null)
  const [onboardingChip, setOnboardingChip] = useState<string | null>(null)
  const [medicinaChip, setMedicinaChip] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen && usuario.id) {
      setTab(normalizeLegajoTab(initialTab))
      setNovedadesRRHH([])
      setNovedadDetail(null)
      setNovBenchmark(null)
      setNovError(null)
      setHvLoaded(false)
      setHojaVidaEventos([])
      setHvError(null)
      setVacacionesSaldoChip(null)
      setOnboardingChip(null)
      setMedicinaChip(null)
      setResumenLoaded(false)
      setVentas([])
      setPlotNotasCount(0)
      loadLegajo()
    }
  }, [isOpen, usuario.id, initialTab])

  const loadChipsExtra = async () => {
    const [ob, med] = await Promise.all([
      rrhhOnboardingResumenUsuario(usuario.id),
      rrhhMedicinaListar(usuario.id)
    ])
    if (ob.success && ob.data) {
      setOnboardingChip(`Onboarding: ${ob.data.hechos}/${ob.data.total}`)
    }
    if (med.success && med.data && med.data.length > 0) {
      const last = med.data[0]
      setMedicinaChip(`Medicina: ${last.resultado}${last.proxima_revision ? ` · próx. ${last.proxima_revision}` : ''}`)
    }
  }

  const loadVacacionesChip = async (fechaIngreso: string | null | undefined) => {
    const anio = new Date().getFullYear()
    const yearStart = `${anio}-01-01`
    const yearEnd = `${anio}-12-31`
    try {
      const [solRes, novRes, ajRes] = await Promise.all([
        apiService.obtenerSolicitudesPermisos(usuario.id, 'aprobado', 'vacaciones'),
        apiService.rrhhNovedadesListar({
          idUsuario: usuario.id,
          codigo: 'licencia_vacaciones',
          fechaDesde: yearStart,
          fechaHasta: yearEnd
        }),
        apiService.rrhhVacacionesAjustesListar({ idUsuario: usuario.id, anio })
      ])
      const saldo = calcularSaldoVacaciones({
        idUsuario: usuario.id,
        nombre: '',
        fechaIngreso,
        anio,
        solicitudes: solRes.success && solRes.data ? solRes.data : [],
        novedades: novRes.success && novRes.data ? novRes.data : [],
        ajustes: ajRes.success && ajRes.data ? ajRes.data : []
      })
      setVacacionesSaldoChip(`Vacaciones ${anio}: saldo ${saldo.saldo}`)
    } catch {
      setVacacionesSaldoChip(null)
    }
  }

  const loadLegajo = async () => {
    setLoading(true)
    try {
      const response = await apiService.getLegajoEmpleado(usuario.id)
      if (response.success && response.data) {
        const d = response.data
        const ingreso = d.fecha_ingreso
          ? isoToArgentinaDateKey(String(d.fecha_ingreso)) || d.fecha_ingreso
          : d.fecha_ingreso
        setLegajo({
          ...d,
          fecha_ingreso: ingreso,
          fecha_nacimiento: d.fecha_nacimiento
            ? isoToArgentinaDateKey(String(d.fecha_nacimiento)) || d.fecha_nacimiento
            : d.fecha_nacimiento
        })
        void loadVacacionesChip(ingreso)
        void loadChipsExtra()
      } else {
        setLegajo(null)
      }
    } catch (error) {
      console.error('Error cargando legajo:', error)
      setLegajo(null)
    } finally {
      setLoading(false)
    }
  }

  const loadMovimientos = async () => {
    setMovLoading(true)
    setMovError(null)
    try {
      const r = await apiService.getHistorialMovimientos({ usuarioId: usuario.id, limit: 200 })
      if (r.success && r.data) setMovimientos(r.data)
      else setMovError(r.error || 'No se pudo cargar la actividad operativa')
    } catch (e) {
      setMovError(e instanceof Error ? e.message : 'Error al cargar actividad operativa')
    } finally {
      setMovLoading(false)
    }
  }

  const loadCapacitaciones = async () => {
    setCapLoading(true)
    setCapError(null)
    try {
      const r = await apiService.obtenerCapacitacionesUsuario(usuario.id, null)
      if (r.success && r.data) setCapacitaciones(r.data)
      else setCapError(r.error || 'No se pudieron cargar las capacitaciones')
    } catch (e) {
      setCapError(e instanceof Error ? e.message : 'Error al cargar capacitaciones')
    } finally {
      setCapLoading(false)
    }
  }

  const loadPermisos = async () => {
    setPermLoading(true)
    setPermError(null)
    try {
      const r = await apiService.obtenerSolicitudesPermisos(usuario.id, null, null, null, null)
      if (r.success && r.data) setPermisos(r.data)
      else setPermError(r.error || 'No se pudieron cargar los permisos')
    } catch (e) {
      setPermError(e instanceof Error ? e.message : 'Error al cargar permisos')
    } finally {
      setPermLoading(false)
    }
  }

  const loadEvaluaciones = async () => {
    setEvalLoading(true)
    setEvalError(null)
    try {
      const r = await apiService.obtenerEvaluaciones(usuario.id, null, null, null, null, null)
      if (r.success && r.data) setEvaluaciones(r.data)
      else setEvalError(r.error || 'No se pudieron cargar las evaluaciones')
    } catch (e) {
      setEvalError(e instanceof Error ? e.message : 'Error al cargar evaluaciones')
    } finally {
      setEvalLoading(false)
    }
  }

  const loadPedidos = async () => {
    setPedLoading(true)
    setPedError(null)
    try {
      const r = await apiService.getPedidosCompra({ id_solicitante: usuario.id })
      if (r.success && r.data) setPedidos(r.data)
      else setPedError(r.error || 'No se pudieron cargar los pedidos')
    } catch (e) {
      setPedError(e instanceof Error ? e.message : 'Error al cargar pedidos')
    } finally {
      setPedLoading(false)
    }
  }

  const loadResumen = async () => {
    setResumenLoaded(true)
    setVentasLoading(true)
    setPlotLoading(true)
    await Promise.all([
      loadMovimientos(),
      loadPermisos(),
      loadNovedadesRRHH(),
      loadPedidos(),
      (async () => {
        try {
          const r = await apiService.obtenerVentas(usuario.id, undefined, undefined, 'todos')
          if (r.success && r.data) setVentas(r.data)
          else setVentas([])
        } catch {
          setVentas([])
        } finally {
          setVentasLoading(false)
        }
      })(),
      (async () => {
        try {
          const actorId = authUsuario?.id
          if (!actorId) {
            setPlotNotasCount(0)
          } else {
            const r = await listarNotasLegajoOperario({
              id_actor: actorId,
              id_usuario: usuario.id,
              limit: 200
            })
            setPlotNotasCount(r.success && r.data ? r.data.length : 0)
          }
        } catch {
          setPlotNotasCount(0)
        } finally {
          setPlotLoading(false)
        }
      })()
    ])
  }

  const loadDesarrollo = async () => {
    await Promise.all([loadCapacitaciones(), loadPruebas(), loadEvaluaciones()])
  }

  const loadHojaVida = async () => {
    setHvLoading(true)
    setHvError(null)
    try {
      const [capR, evalR, permR, novR, evR, bajasR] = await Promise.all([
        apiService.obtenerCapacitacionesUsuario(usuario.id, null),
        apiService.obtenerEvaluaciones(usuario.id, null, null, null, null, null),
        apiService.obtenerSolicitudesPermisos(usuario.id, null, null, null, null),
        apiService.rrhhNovedadesListar({ idUsuario: usuario.id }),
        apiService.rrhhEventosLaboralesListar(usuario.id),
        apiService.getUsuariosBajasLog()
      ])

      const bajasUsuario: UsuarioBajaLog[] =
        bajasR.success && bajasR.data
          ? bajasR.data.filter((b) => b.id_usuario === usuario.id)
          : []

      const eventosLaborales: RrhhEventoLaboral[] =
        evR.success && evR.data ? evR.data : []

      if (!capR.success && !evalR.success && !novR.success && !evR.success) {
        setHvError('No se pudo cargar la hoja de vida laboral')
      }

      setHojaVidaEventos(
        construirHojaVidaLaboral({
          legajo,
          usuario,
          capacitaciones: capR.success && capR.data ? capR.data : [],
          evaluaciones: evalR.success && evalR.data ? evalR.data : [],
          permisos: permR.success && permR.data ? permR.data : [],
          novedades: novR.success && novR.data ? novR.data : [],
          eventosLaborales,
          bajas: bajasUsuario
        })
      )
      setHvLoaded(true)
    } catch (e) {
      setHvError(e instanceof Error ? e.message : 'Error al cargar hoja de vida')
    } finally {
      setHvLoading(false)
    }
  }

  const loadNovedadesRRHH = async () => {
    setNovLoading(true)
    setNovError(null)
    try {
      const desde12m = format(addMonths(new Date(), -11), 'yyyy-MM-dd')
      const [r, orgRes, legajosRes, usuariosRes] = await Promise.all([
        apiService.rrhhNovedadesListar({ idUsuario: usuario.id }),
        apiService.rrhhNovedadesListar({ fechaDesde: desde12m }),
        apiService.obtenerLegajosBasico(),
        apiService.getUsuarios()
      ])
      if (r.success && r.data) setNovedadesRRHH(r.data)
      else setNovError(r.error || 'No se pudieron cargar las novedades laborales')

      if (orgRes.success && orgRes.data && legajosRes.success && legajosRes.data && usuariosRes.success && usuariosRes.data) {
        const legajosMap: Record<number, LegajoSectorBasico> = {}
        for (const [id, row] of Object.entries(legajosRes.data)) {
          legajosMap[Number(id)] = { sector: row.sector }
        }
        setNovBenchmark(
          calcularBenchmarkSectorColaborador(
            orgRes.data,
            usuario.id,
            legajosMap,
            usuariosRes.data
          )
        )
      } else {
        setNovBenchmark(null)
      }
    } catch (e) {
      setNovError(e instanceof Error ? e.message : 'Error al cargar novedades')
    } finally {
      setNovLoading(false)
    }
  }

  const loadPruebas = async () => {
    setPrueLoading(true)
    setPrueError(null)
    try {
      const [pruebasRes, capRes] = await Promise.all([
        apiService.obtenerPruebasColaborador(usuario.id),
        capacitaciones.length === 0
          ? apiService.obtenerCapacitacionesUsuario(usuario.id, null)
          : Promise.resolve({ success: true as const, data: capacitaciones })
      ])
      if (!pruebasRes.success) {
        setPrueError(pruebasRes.error || 'No se pudieron cargar las evaluaciones')
        return
      }
      setPruebas(pruebasRes.data ?? [])
      if (capRes.success && capRes.data && capacitaciones.length === 0) {
        setCapacitaciones(capRes.data)
      }
    } catch (e) {
      setPrueError(e instanceof Error ? e.message : 'Error al cargar evaluaciones')
    } finally {
      setPrueLoading(false)
    }
  }

  const generarPdfLegajo = async () => {
    if (!legajo) return
    setPdfGenerating(true)
    setPdfError(null)
    try {
      const [movR, capR, pedR, permR, evalR, pruebasR, novR] = await Promise.all([
        apiService.getHistorialMovimientos({ usuarioId: usuario.id, limit: 200 }),
        apiService.obtenerCapacitacionesUsuario(usuario.id, null),
        apiService.getPedidosCompra({ id_solicitante: usuario.id }),
        apiService.obtenerSolicitudesPermisos(usuario.id, null, null, null, null),
        apiService.obtenerEvaluaciones(usuario.id, null, null, null, null, null),
        apiService.rrhhPruebasListar(),
        apiService.rrhhNovedadesListar({ idUsuario: usuario.id })
      ])

      const pruebasList = Array.isArray(pruebasR.data) ? (pruebasR.data as PruebaRow[]) : []

      // Para contar pruebas del usuario sin mil requests: traemos resultados solo de las primeras N pruebas
      // (sirve como resumen rápido). Si querés 100% completo, lo hacemos después con un RPC dedicado.
      const N = 8
      const subset = pruebasList.slice(0, N)
      let pruebasConAsignacion = 0
      let pruebasAprobadas = 0
      let pruebasNoAprobadas = 0
      let pruebasPendientes = 0
      for (const p of subset) {
        const rr = await apiService.rrhhPruebaResultados(p.id)
        const payload = rr.success ? ((rr.data ?? null) as ResultadoPayload | null) : null
        const asig = payload?.asignaciones?.find((a) => a.id_usuario === usuario.id) ?? null
        if (!asig) continue
        pruebasConAsignacion++
        if (asig.aprobado === true) pruebasAprobadas++
        else if (asig.aprobado === false) pruebasNoAprobadas++
        else pruebasPendientes++
      }

      const movimientosCount = movR.success && movR.data ? movR.data.length : null
      const capacitacionesCount = capR.success && capR.data ? capR.data.length : null
      const pedidosCount = pedR.success && pedR.data ? pedR.data.length : null
      const permisosCount = permR.success && permR.data ? permR.data.length : null
      const evaluacionesCount = evalR.success && evalR.data ? evalR.data.length : null
      const novedadesPdfCount = novR.success && novR.data ? novR.data.length : null

      const doc = new jsPDF({ unit: 'pt', format: 'a4' })
      const pageW = doc.internal.pageSize.getWidth()
      const margin = 48
      let y = 54

      const title = `Legajo · ${empleadoNombre} (ID ${usuario.id})`
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(16)
      doc.text(title, margin, y)
      y += 18

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.text(`Generado: ${new Date().toLocaleString('es-AR')}`, margin, y)
      y += 18

      const section = (label: string) => {
        y += 10
        doc.setDrawColor(180)
        doc.setLineWidth(0.5)
        doc.line(margin, y, pageW - margin, y)
        y += 16
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(12)
        doc.text(label, margin, y)
        y += 14
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(10)
      }

      const kv = (k: string, v: string) => {
        const line = `${k}: ${v}`
        const lines = doc.splitTextToSize(line, pageW - margin * 2)
        doc.text(lines, margin, y)
        y += lines.length * 12
      }

      section('Datos personales')
      kv('Nombre', legajo.nombre || empleadoNombre || '—')
      kv('Apellido', legajo.apellido || '—')
      kv('DNI', legajo.dni || '—')
      kv('CUIT / CUIL', legajo.cuil || '—')
      kv('Legajo AFIP', legajo.n_legajo != null && legajo.n_legajo > 0 ? String(legajo.n_legajo) : '—')
      kv('Banco', legajo.banco || '—')
      kv('CBU', legajo.cbu || '—')
      kv(
        'Cónyuge a cargo',
        legajo.conyuge
          ? [
              [legajo.conyuge_detalle?.apellido, legajo.conyuge_detalle?.nombre]
                .filter(Boolean)
                .join(', ') || 'Sí',
              legajo.conyuge_detalle?.edad != null ? `${legajo.conyuge_detalle.edad} años` : null
            ]
              .filter(Boolean)
              .join(' · ')
          : 'No'
      )
      {
        const pers = Array.isArray(legajo.personas_a_cargo) ? legajo.personas_a_cargo : []
        if (pers.length === 0) {
          kv('Personas a cargo', legajo.hijos != null && legajo.hijos > 0 ? String(legajo.hijos) : '0')
        } else {
          kv('Personas a cargo', String(pers.length))
          for (const p of pers) {
            kv(
              '  ·',
              [
                [p.apellido, p.nombre].filter(Boolean).join(', ') || 'Sin nombre',
                p.fecha_nacimiento || null
              ]
                .filter(Boolean)
                .join(' · ')
            )
          }
        }
      }
      kv('Teléfono', legajo.telefono || '—')
      kv('Email', legajo.email || '—')
      kv('Dirección', legajo.direccion || '—')
      kv('Estado civil', legajo.estado_civil || '—')
      kv('Fecha de nacimiento', legajo.fecha_nacimiento ? String(legajo.fecha_nacimiento) : '—')

      section('Datos laborales')
      kv('Sector', legajo.sector || '—')
      kv('Puesto', legajo.puesto || '—')
      kv('Categoría', legajo.categoria || '—')
      kv('Tipo de servicio', legajo.tipo_servicio || '—')
      kv('Obra social', legajo.obra_social || '—')
      kv('Código OS', legajo.codigo_os || '—')
      kv(
        'Retribución pactada',
        legajo.retribucion_pactada != null ? String(legajo.retribucion_pactada) : '—'
      )
      kv('Modo de liquidación', legajo.modo_liquidacion || '—')
      kv('Modalidad de contrato', legajo.modalidad_contrato || '—')
      kv('Convenio (CCT)', legajo.convenio_cct || '—')
      kv('Fecha de ingreso', legajo.fecha_ingreso ? String(legajo.fecha_ingreso) : '—')
      kv('Funciones', legajo.funciones || '—')

      section('Resumen de actividad')
      kv(
        'Actividad operativa (últimos 200)',
        movimientosCount == null ? 'No disponible' : String(movimientosCount)
      )
      kv('Capacitaciones (asociadas)', capacitacionesCount == null ? 'No disponible' : String(capacitacionesCount))
      kv('Pedidos (Compras)', pedidosCount == null ? 'No disponible' : String(pedidosCount))
      kv('Permisos solicitados', permisosCount == null ? 'No disponible' : String(permisosCount))
      kv('Evaluaciones RRHH', evaluacionesCount == null ? 'No disponible' : String(evaluacionesCount))
      kv(
        'Novedades laborales (RRHH)',
        novedadesPdfCount == null ? 'No disponible' : String(novedadesPdfCount)
      )
      kv(
        `Pruebas (muestra parcial ${subset.length}/${pruebasList.length})`,
        pruebasList.length === 0
          ? 'No disponible'
          : `Con asignación: ${pruebasConAsignacion} · Aprobadas: ${pruebasAprobadas} · No aprobadas: ${pruebasNoAprobadas} · Pendientes: ${pruebasPendientes}`
      )

      if (legajo.observaciones) {
        section('Observaciones')
        kv('Notas', legajo.observaciones)
      }

      const safeName = (empleadoNombre || 'usuario').replace(/[^\p{L}\p{N}_-]+/gu, '_')
      doc.save(`legajo_${usuario.id}_${safeName}.pdf`)
    } catch (e) {
      setPdfError(e instanceof Error ? e.message : 'No se pudo generar el PDF')
    } finally {
      setPdfGenerating(false)
    }
  }

  if (!isOpen) return null

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'No especificada'
    const key = isoToArgentinaDateKey(String(dateString))
    if (key.length === 10) {
      const [y, m, d] = key.split('-')
      return `${d}/${m}/${y}`
    }
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        timeZone: 'America/Argentina/Buenos_Aires'
      })
    } catch {
      return dateString
    }
  }

  const movimientoStats = useMemo(() => {
    const byTipo = new Map<string, number>()
    for (const m of movimientos) {
      const k = (m.accion_tipo || 'sin_tipo').trim() || 'sin_tipo'
      byTipo.set(k, (byTipo.get(k) || 0) + 1)
    }
    return Array.from(byTipo.entries()).sort((a, b) => b[1] - a[1])
  }, [movimientos])

  const resumenKpis = useMemo(() => {
    const opsUnicas = new Set(movimientos.map((m) => m.id_orden).filter((id) => id > 0))
    const ventasActivas = ventas.filter((v) => v.estado_pago !== 'Cancelado')
    const montoVendido = ventasActivas.reduce((s, v) => s + (Number(v.valor_total) || 0), 0)
    const montoCobrado = ventasActivas.reduce((s, v) => s + (Number(v.monto_pagado) || 0), 0)
    let faltas = 0
    let tardanzas = 0
    let licencias = 0
    for (const n of novedadesRRHH) {
      const c = clasificarNovedadLegajo(n)
      if (c === 'ausencia_injustificada') faltas += 1
      else if (c === 'llegada_tarde') tardanzas += 1
      else if (c === 'licencia_medica') licencias += 1
    }
    const permisosAprobados = permisos.filter((p) => p.estado === 'aprobado').length
    const permisosPendientes = permisos.filter((p) => p.estado === 'pendiente').length
    return {
      ops: opsUnicas.size,
      movimientos: movimientos.length,
      ventas: ventasActivas.length,
      montoVendido,
      montoCobrado,
      faltas,
      tardanzas,
      licencias,
      permisos: permisos.length,
      permisosAprobados,
      permisosPendientes,
      pedidos: pedidos.length,
      plotNotas: plotNotasCount
    }
  }, [movimientos, ventas, novedadesRRHH, permisos, pedidos, plotNotasCount])

  const tabs: Array<{ id: LegajoTabId; label: string }> = [
    { id: 'legajo', label: '📋 Legajo' },
    { id: 'hoja_vida', label: '📅 Hoja de vida' },
    { id: 'resumen', label: '📊 Resumen' },
    { id: 'desarrollo', label: '🎓 Desarrollo' }
  ]

  const resumenBusy =
    movLoading || permLoading || novLoading || pedLoading || ventasLoading || plotLoading

  useEffect(() => {
    if (!isOpen) return
    if (tab === 'resumen' && !resumenLoaded) void loadResumen()
    if (tab === 'desarrollo') void loadDesarrollo()
    if (tab === 'hoja_vida' && !hvLoaded) void loadHojaVida()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- carga lazy por pestaña
  }, [isOpen, tab, resumenLoaded, hvLoaded])

  return (
    <div
      className="ver-legajo-modal-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      onTouchStart={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className={`ver-legajo-modal-content${
          tab === 'hoja_vida' || tab === 'resumen' || tab === 'desarrollo'
            ? ' ver-legajo-modal-content--wide'
            : ''
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ver-legajo-modal-header">
          <h2>📋 Legajo de Empleado</h2>
          <button className="ver-legajo-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        {loading ? (
          <div className="ver-legajo-loading">
            <div className="spinner"></div>
            <p>Cargando legajo...</p>
          </div>
        ) : (
          <div className="ver-legajo-body">
            {pdfError && <div className="ver-legajo-alert ver-legajo-alert--error">⚠️ {pdfError}</div>}
            <div className="ver-legajo-tabs">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`ver-legajo-tab ${tab === t.id ? 'active' : ''}`}
                  onClick={() => {
                    setTab(t.id)
                    if (t.id === 'resumen' && !resumenLoaded) void loadResumen()
                    if (t.id === 'desarrollo') void loadDesarrollo()
                    if (t.id === 'hoja_vida' && !hvLoaded && !hvLoading) void loadHojaVida()
                  }}
                >
                  {t.label}
                </button>
              ))}
              <button
                type="button"
                className="ver-legajo-tab ver-legajo-tab--download"
                onClick={() => void generarPdfLegajo()}
                disabled={pdfGenerating}
                title="Descargar PDF (datos personales + resumen)"
              >
                {pdfGenerating ? 'Generando…' : '⬇️ PDF'}
              </button>
            </div>

            {tab !== 'legajo' && (
              <div className="ver-legajo-section ver-legajo-section--compact">
                <div className="ver-legajo-mini">
                  <div>
                    <span className="ver-legajo-label">Usuario</span>
                    <div className="ver-legajo-value">{empleadoNombre}</div>
                  </div>
                  <div>
                    <span className="ver-legajo-label">ID</span>
                    <div className="ver-legajo-value">{usuario.id}</div>
                  </div>
                  <div>
                    <span className="ver-legajo-label">Rol</span>
                    <div className="ver-legajo-value">{usuario.rol}</div>
                  </div>
                </div>
              </div>
            )}

            {tab === 'hoja_vida' && (
              <div className="ver-legajo-section">
                <h3 className="ver-legajo-section-title">📅 Hoja de vida laboral</h3>
                <LegajoTimeline
                  eventos={hojaVidaEventos}
                  loading={hvLoading}
                  error={hvError}
                  idUsuario={usuario.id}
                  puedeGestionar={puedeGestionarHojaVida}
                  registradoPorId={authUsuario?.id}
                  onRefresh={() => {
                    setHvLoaded(false)
                    void loadHojaVida()
                  }}
                />
              </div>
            )}

            {tab === 'resumen' && (
              <div className="ver-legajo-section">
                <h3 className="ver-legajo-section-title">📊 Resumen del colaborador</h3>
                <p className="ver-legajo-hint">
                  Vista unificada: OPs, ventas, faltas, tardanzas, permisos y actividades Plot Lab. Complementa
                  la{' '}
                  <button type="button" className="ver-legajo-linklike" onClick={() => setTab('hoja_vida')}>
                    hoja de vida
                  </button>
                  .
                </p>
                {(movError || permError || novError || pedError) && (
                  <div className="ver-legajo-alert ver-legajo-alert--error">
                    ⚠️ {[movError, permError, novError, pedError].filter(Boolean).join(' · ')}
                  </div>
                )}
                {resumenBusy && !resumenLoaded ? (
                  <div className="ver-legajo-subloading">Armando resumen…</div>
                ) : null}

                <div className="ver-legajo-kpi-grid">
                  <div className="ver-legajo-kpi">
                    <div className="ver-legajo-kpi-value">{resumenKpis.ops}</div>
                    <div className="ver-legajo-kpi-label">OPs tocadas</div>
                    <div className="ver-legajo-kpi-sub">{resumenKpis.movimientos} movimientos</div>
                  </div>
                  <div className="ver-legajo-kpi">
                    <div className="ver-legajo-kpi-value">{resumenKpis.ventas}</div>
                    <div className="ver-legajo-kpi-label">Ventas</div>
                    <div className="ver-legajo-kpi-sub">
                      $
                      {resumenKpis.montoVendido.toLocaleString('es-AR', {
                        maximumFractionDigits: 0
                      })}{' '}
                      · cobrado $
                      {resumenKpis.montoCobrado.toLocaleString('es-AR', {
                        maximumFractionDigits: 0
                      })}
                    </div>
                  </div>
                  <div className="ver-legajo-kpi">
                    <div className="ver-legajo-kpi-value">{resumenKpis.faltas}</div>
                    <div className="ver-legajo-kpi-label">Faltas injustificadas</div>
                    <div className="ver-legajo-kpi-sub">{resumenKpis.licencias} lic. médicas</div>
                  </div>
                  <div className="ver-legajo-kpi">
                    <div className="ver-legajo-kpi-value">{resumenKpis.tardanzas}</div>
                    <div className="ver-legajo-kpi-label">Tardanzas</div>
                    <div className="ver-legajo-kpi-sub">Novedades RRHH</div>
                  </div>
                  <div className="ver-legajo-kpi">
                    <div className="ver-legajo-kpi-value">{resumenKpis.permisos}</div>
                    <div className="ver-legajo-kpi-label">Permisos</div>
                    <div className="ver-legajo-kpi-sub">
                      {resumenKpis.permisosAprobados} aprob. · {resumenKpis.permisosPendientes} pend.
                    </div>
                  </div>
                  <div className="ver-legajo-kpi">
                    <div className="ver-legajo-kpi-value">{resumenKpis.pedidos}</div>
                    <div className="ver-legajo-kpi-label">Pedidos compras</div>
                    <div className="ver-legajo-kpi-sub">Como solicitante</div>
                  </div>
                  <div className="ver-legajo-kpi">
                    <div className="ver-legajo-kpi-value">{resumenKpis.plotNotas}</div>
                    <div className="ver-legajo-kpi-label">Actividades Plot</div>
                    <div className="ver-legajo-kpi-sub">Bitácora · checklist · anotador</div>
                  </div>
                </div>

                {movimientoStats.length > 0 && (
                  <div className="ver-legajo-badges" style={{ marginTop: 12 }}>
                    {movimientoStats.slice(0, 8).map(([k, v]) => (
                      <span key={k} className="ver-legajo-badge">
                        {k}: {v}
                      </span>
                    ))}
                  </div>
                )}

                <h4 className="ver-legajo-subtitle">Últimos movimientos en OP</h4>
                {movLoading ? (
                  <div className="ver-legajo-subloading">Cargando…</div>
                ) : movimientos.length === 0 ? (
                  <div className="ver-legajo-empty-small">Sin actividad operativa registrada.</div>
                ) : (
                  <div className="ver-legajo-table-wrap">
                    <table className="ver-legajo-table">
                      <thead>
                        <tr>
                          <th>Fecha</th>
                          <th>OP</th>
                          <th>Acción</th>
                          <th>Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {movimientos.slice(0, 25).map((m) => (
                          <tr key={m.id}>
                            <td>{formatDate(m.timestamp)}</td>
                            <td>#{m.id_orden}</td>
                            <td>{m.accion_tipo || '—'}</td>
                            <td>
                              {m.estado_anterior || m.estado_nuevo
                                ? [m.estado_anterior, m.estado_nuevo].filter(Boolean).join(' → ')
                                : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <h4 className="ver-legajo-subtitle">Ventas</h4>
                {ventasLoading ? (
                  <div className="ver-legajo-subloading">Cargando ventas…</div>
                ) : ventas.length === 0 ? (
                  <div className="ver-legajo-empty-small">Sin ventas como vendedor.</div>
                ) : (
                  <div className="ver-legajo-table-wrap">
                    <table className="ver-legajo-table">
                      <thead>
                        <tr>
                          <th>Fecha</th>
                          <th>Nº</th>
                          <th>Cliente</th>
                          <th>Total</th>
                          <th>Pago</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ventas.slice(0, 20).map((v) => (
                          <tr key={v.id}>
                            <td>{formatDate(v.fecha_venta)}</td>
                            <td>{v.numero_venta || `#${v.id}`}</td>
                            <td>{v.cliente_nombre || '—'}</td>
                            <td>
                              $
                              {Number(v.valor_total || 0).toLocaleString('es-AR', {
                                maximumFractionDigits: 0
                              })}
                            </td>
                            <td>{v.estado_pago}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <h4 className="ver-legajo-subtitle">Permisos</h4>
                {permLoading ? (
                  <div className="ver-legajo-subloading">Cargando permisos…</div>
                ) : permisos.length === 0 ? (
                  <div className="ver-legajo-empty-small">Sin permisos/solicitudes.</div>
                ) : (
                  <div className="ver-legajo-table-wrap">
                    <table className="ver-legajo-table">
                      <thead>
                        <tr>
                          <th>Fecha</th>
                          <th>Tipo</th>
                          <th>Título</th>
                          <th>Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {permisos.slice(0, 15).map((s) => (
                          <tr key={s.id}>
                            <td>{formatDate(s.fecha_solicitud)}</td>
                            <td>{s.tipo_solicitud}</td>
                            <td>{s.titulo}</td>
                            <td>{s.estado}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <h4 className="ver-legajo-subtitle">Novedades (faltas, tardanzas, licencias…)</h4>
                <p className="ver-legajo-hint">
                  <Link to="/rrhh/novedades" className="ver-legajo-link" onClick={onClose}>
                    Abrir módulo completo
                  </Link>
                </p>
                {novLoading ? (
                  <div className="ver-legajo-subloading">Cargando novedades…</div>
                ) : (
                  <LegajoNovedadesPanel
                    novedades={novedadesRRHH}
                    onSelectNovedad={setNovedadDetail}
                    benchmarkSector={novBenchmark}
                  />
                )}

                <h4 className="ver-legajo-subtitle">Actividades Plot Lab</h4>
                <p className="ver-legajo-hint">
                  Bitácora, checklist y anotador.{' '}
                  <Link to="/actividades-operarios" className="ver-legajo-link" onClick={onClose}>
                    Panel de supervisión
                  </Link>
                </p>
                <LegajoActividadesPlotPanel idUsuario={usuario.id} />
              </div>
            )}

            {tab === 'desarrollo' && (
              <div className="ver-legajo-section">
                <h3 className="ver-legajo-section-title">🎓 Desarrollo · formación y evaluaciones</h3>
                <p className="ver-legajo-hint">
                  Capacitaciones, pruebas de conocimiento y evaluaciones de desempeño RRHH en un solo lugar.
                </p>

                <h4 className="ver-legajo-subtitle">Formación</h4>
                {capError && <div className="ver-legajo-alert ver-legajo-alert--error">⚠️ {capError}</div>}
                {capLoading ? (
                  <div className="ver-legajo-subloading">Cargando capacitaciones…</div>
                ) : (
                  <LegajoCapacitacionesPanel
                    capacitaciones={capacitaciones}
                    sectorLegajo={legajo?.sector}
                    rolUsuario={usuario.rol}
                    formatDate={formatDate}
                  />
                )}

                <h4 className="ver-legajo-subtitle">Evaluaciones de conocimiento</h4>
                {prueError && <div className="ver-legajo-alert ver-legajo-alert--error">⚠️ {prueError}</div>}
                {prueLoading ? (
                  <div className="ver-legajo-subloading">Cargando pruebas…</div>
                ) : (
                  <LegajoPruebasPanel
                    pruebas={pruebas}
                    capacitaciones={capacitaciones}
                    formatDate={formatDate}
                  />
                )}

                <h4 className="ver-legajo-subtitle">Evaluaciones RRHH</h4>
                {evalError && <div className="ver-legajo-alert ver-legajo-alert--error">⚠️ {evalError}</div>}
                {evalLoading ? (
                  <div className="ver-legajo-subloading">Cargando evaluaciones…</div>
                ) : evaluaciones.length === 0 ? (
                  <div className="ver-legajo-empty-small">No hay evaluaciones de desempeño registradas.</div>
                ) : (
                  <div className="ver-legajo-table-wrap">
                    <table className="ver-legajo-table">
                      <thead>
                        <tr>
                          <th>Fecha</th>
                          <th>Tipo</th>
                          <th>Período</th>
                          <th>Estado</th>
                          <th>Calificación</th>
                        </tr>
                      </thead>
                      <tbody>
                        {evaluaciones.map((e) => (
                          <tr key={e.id}>
                            <td>{formatDate(e.fecha_evaluacion)}</td>
                            <td>{e.tipo_evaluacion}</td>
                            <td>{e.periodo_evaluacion}</td>
                            <td>{e.estado}</td>
                            <td>
                              {e.calificacion_general != null ? String(e.calificacion_general) : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {tab === 'legajo' && !legajo ? (
              <div className="ver-legajo-empty">
                <p>⚠️ No se encontró información del legajo para este empleado.</p>
                <p className="ver-legajo-empty-hint">
                  El legajo aún no ha sido creado. Podés consultar la{' '}
                  <button
                    type="button"
                    className="ver-legajo-linklike"
                    onClick={() => setTab('hoja_vida')}
                  >
                    hoja de vida
                  </button>{' '}
                  con los datos disponibles del sistema.
                </p>
              </div>
            ) : null}

            {tab === 'legajo' && legajo ? (
              <>
            {/* Foto del empleado */}
            {legajo.foto_url && (
              <div className="ver-legajo-photo-section">
                <img 
                  src={legajo.foto_url} 
                  alt={`Foto de ${legajo.nombre || empleadoNombre}`}
                  className="ver-legajo-photo"
                />
              </div>
            )}

            {/* Información Personal */}
            <div className="ver-legajo-section">
              <h3 className="ver-legajo-section-title">👤 Información Personal</h3>
              <div className="ver-legajo-grid">
                <div className="ver-legajo-info-item">
                  <span className="ver-legajo-label">Nombre:</span>
                  <span className="ver-legajo-value">
                    {legajo.nombre || 'No especificado'}
                  </span>
                </div>
                <div className="ver-legajo-info-item">
                  <span className="ver-legajo-label">Apellido:</span>
                  <span className="ver-legajo-value">
                    {legajo.apellido || 'No especificado'}
                  </span>
                </div>
                <div className="ver-legajo-info-item">
                  <span className="ver-legajo-label">DNI:</span>
                  <span className="ver-legajo-value">
                    {legajo.dni || 'No especificado'}
                  </span>
                </div>
                <div className="ver-legajo-info-item">
                  <span className="ver-legajo-label">CUIT / CUIL:</span>
                  <span className="ver-legajo-value">
                    {legajo.cuil || 'No especificado'}
                  </span>
                </div>
                <div className="ver-legajo-info-item">
                  <span className="ver-legajo-label">Legajo AFIP:</span>
                  <span className="ver-legajo-value">
                    {legajo.n_legajo != null && legajo.n_legajo > 0
                      ? legajo.n_legajo
                      : 'No especificado'}
                  </span>
                </div>
                <div className="ver-legajo-info-item">
                  <span className="ver-legajo-label">Fecha de Nacimiento:</span>
                  <span className="ver-legajo-value">
                    {formatDate(legajo.fecha_nacimiento)}
                  </span>
                </div>
                <div className="ver-legajo-info-item">
                  <span className="ver-legajo-label">Estado Civil:</span>
                  <span className="ver-legajo-value">
                    {legajo.estado_civil || 'No especificado'}
                  </span>
                </div>
                <div className="ver-legajo-info-item">
                  <span className="ver-legajo-label">Banco:</span>
                  <span className="ver-legajo-value">
                    {legajo.banco || 'No especificado'}
                  </span>
                </div>
                <div className="ver-legajo-info-item">
                  <span className="ver-legajo-label">CBU:</span>
                  <span className="ver-legajo-value">
                    {legajo.cbu || 'No especificado'}
                  </span>
                </div>
                <div className="ver-legajo-info-item">
                  <span className="ver-legajo-label">Cónyuge a cargo:</span>
                  <span className="ver-legajo-value">
                    {legajo.conyuge
                      ? [
                          [legajo.conyuge_detalle?.apellido, legajo.conyuge_detalle?.nombre]
                            .filter(Boolean)
                            .join(', ') || 'Sí',
                          legajo.conyuge_detalle?.edad != null
                            ? `${legajo.conyuge_detalle.edad} años`
                            : null
                        ]
                          .filter(Boolean)
                          .join(' · ')
                      : 'No'}
                  </span>
                </div>
                <div className="ver-legajo-info-item ver-legajo-full-width">
                  <span className="ver-legajo-label">Personas a cargo:</span>
                  <span className="ver-legajo-value">
                    {Array.isArray(legajo.personas_a_cargo) && legajo.personas_a_cargo.length > 0 ? (
                      <ul className="ver-legajo-familia-list">
                        {legajo.personas_a_cargo.map((p) => (
                          <li key={p.id}>
                            {[p.apellido, p.nombre].filter(Boolean).join(', ') || 'Sin nombre'}
                            {p.fecha_nacimiento ? ` · nac. ${p.fecha_nacimiento}` : ''}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      legajo.hijos != null && legajo.hijos > 0 ? legajo.hijos : 0
                    )}
                  </span>
                </div>
              </div>
            </div>

            {/* Información de Contacto */}
            <div className="ver-legajo-section">
              <h3 className="ver-legajo-section-title">📞 Información de Contacto</h3>
              <div className="ver-legajo-grid">
                <div className="ver-legajo-info-item">
                  <span className="ver-legajo-label">Teléfono:</span>
                  <span className="ver-legajo-value">
                    {legajo.telefono || 'No especificado'}
                  </span>
                </div>
                <div className="ver-legajo-info-item">
                  <span className="ver-legajo-label">Email:</span>
                  <span className="ver-legajo-value">
                    {legajo.email || 'No especificado'}
                  </span>
                </div>
                <div className="ver-legajo-info-item ver-legajo-full-width">
                  <span className="ver-legajo-label">Dirección:</span>
                  <span className="ver-legajo-value">
                    {legajo.direccion || 'No especificada'}
                  </span>
                </div>
                <div className="ver-legajo-info-item ver-legajo-full-width">
                  <span className="ver-legajo-label">Ubicación:</span>
                  <span className="ver-legajo-value">
                    {legajo.ubicacion || 'No especificada'}
                  </span>
                </div>
              </div>
            </div>

            {/* Información Laboral */}
            <div className="ver-legajo-section">
              <h3 className="ver-legajo-section-title">💼 Información Laboral</h3>
              <div className="ver-legajo-grid">
                <div className="ver-legajo-info-item">
                  <span className="ver-legajo-label">Sector:</span>
                  <span className="ver-legajo-value">
                    {legajo.sector || 'No especificado'}
                  </span>
                </div>
                <div className="ver-legajo-info-item">
                  <span className="ver-legajo-label">Puesto:</span>
                  <span className="ver-legajo-value">
                    {legajo.puesto || 'No especificado'}
                  </span>
                </div>
                <div className="ver-legajo-info-item">
                  <span className="ver-legajo-label">Categoría:</span>
                  <span className="ver-legajo-value">
                    {legajo.categoria || 'No especificada'}
                  </span>
                </div>
                <div className="ver-legajo-info-item">
                  <span className="ver-legajo-label">Tipo de servicio:</span>
                  <span className="ver-legajo-value">
                    {legajo.tipo_servicio || 'No especificado'}
                  </span>
                </div>
                <div className="ver-legajo-info-item">
                  <span className="ver-legajo-label">Obra social:</span>
                  <span className="ver-legajo-value">
                    {legajo.obra_social || 'No especificada'}
                  </span>
                </div>
                <div className="ver-legajo-info-item">
                  <span className="ver-legajo-label">Código OS:</span>
                  <span className="ver-legajo-value">
                    {legajo.codigo_os || 'No especificado'}
                  </span>
                </div>
                <div className="ver-legajo-info-item">
                  <span className="ver-legajo-label">Retribución pactada:</span>
                  <span className="ver-legajo-value">
                    {legajo.retribucion_pactada != null
                      ? `$ ${Number(legajo.retribucion_pactada).toLocaleString('es-AR', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2
                        })}`
                      : 'No especificada'}
                  </span>
                </div>
                <div className="ver-legajo-info-item">
                  <span className="ver-legajo-label">Modo de liquidación:</span>
                  <span className="ver-legajo-value">
                    {legajo.modo_liquidacion || 'No especificado'}
                  </span>
                </div>
                <div className="ver-legajo-info-item">
                  <span className="ver-legajo-label">Modalidad de contrato:</span>
                  <span className="ver-legajo-value">
                    {legajo.modalidad_contrato || 'No especificada'}
                  </span>
                </div>
                <div className="ver-legajo-info-item">
                  <span className="ver-legajo-label">Convenio (CCT):</span>
                  <span className="ver-legajo-value">
                    {legajo.convenio_cct || 'No especificado'}
                  </span>
                </div>
                <div className="ver-legajo-info-item">
                  <span className="ver-legajo-label">Fecha de Ingreso:</span>
                  <span className="ver-legajo-value">
                    {formatDate(legajo.fecha_ingreso)}
                  </span>
                </div>
                {vacacionesSaldoChip ? (
                  <div className="ver-legajo-info-item ver-legajo-full-width">
                    <span className="ver-legajo-badge ver-legajo-badge--ok">{vacacionesSaldoChip}</span>
                    <Link to="/rrhh/vacaciones" className="ver-legajo-vac-link" onClick={onClose}>
                      Ver saldos
                    </Link>
                  </div>
                ) : null}
                {onboardingChip ? (
                  <div className="ver-legajo-info-item ver-legajo-full-width">
                    <span className="ver-legajo-badge ver-legajo-badge--ok">{onboardingChip}</span>
                    <Link to="/rrhh/onboarding" className="ver-legajo-vac-link" onClick={onClose}>
                      Ver checklist
                    </Link>
                  </div>
                ) : null}
                {medicinaChip ? (
                  <div className="ver-legajo-info-item ver-legajo-full-width">
                    <span className="ver-legajo-badge">{medicinaChip}</span>
                    <Link to="/rrhh/medicina" className="ver-legajo-vac-link" onClick={onClose}>
                      Medicina
                    </Link>
                  </div>
                ) : null}
                <div className="ver-legajo-info-item ver-legajo-full-width">
                  <span className="ver-legajo-label">Funciones:</span>
                  <span className="ver-legajo-value">
                    {legajo.funciones || 'No especificadas'}
                  </span>
                </div>
              </div>
            </div>

            {/* Contacto de Emergencia */}
            <div className="ver-legajo-section">
              <h3 className="ver-legajo-section-title">🚨 Contacto de Emergencia</h3>
              <div className="ver-legajo-grid">
                <div className="ver-legajo-info-item">
                  <span className="ver-legajo-label">Nombre:</span>
                  <span className="ver-legajo-value">
                    {legajo.contacto_emergencia_nombre || 'No especificado'}
                  </span>
                </div>
                <div className="ver-legajo-info-item">
                  <span className="ver-legajo-label">Teléfono:</span>
                  <span className="ver-legajo-value">
                    {legajo.contacto_emergencia_telefono || 'No especificado'}
                  </span>
                </div>
              </div>
            </div>

            {/* Observaciones */}
            {legajo.observaciones && (
              <div className="ver-legajo-section">
                <h3 className="ver-legajo-section-title">📝 Observaciones</h3>
                <div className="ver-legajo-observaciones">
                  <p>{legajo.observaciones}</p>
                </div>
              </div>
            )}

            {/* Información del Sistema */}
            <div className="ver-legajo-section ver-legajo-system-info">
              <h3 className="ver-legajo-section-title">ℹ️ Información del Sistema</h3>
              <div className="ver-legajo-grid">
                <div className="ver-legajo-info-item">
                  <span className="ver-legajo-label">ID de Usuario:</span>
                  <span className="ver-legajo-value">{usuario.id}</span>
                </div>
                <div className="ver-legajo-info-item">
                  <span className="ver-legajo-label">Usuario:</span>
                  <span className="ver-legajo-value">{empleadoNombre}</span>
                </div>
                {legajo.created_at && (
                  <div className="ver-legajo-info-item">
                    <span className="ver-legajo-label">Creado:</span>
                    <span className="ver-legajo-value">
                      {formatDate(legajo.created_at)}
                    </span>
                  </div>
                )}
                {legajo.updated_at && (
                  <div className="ver-legajo-info-item">
                    <span className="ver-legajo-label">Última Actualización:</span>
                    <span className="ver-legajo-value">
                      {formatDate(legajo.updated_at)}
                    </span>
                  </div>
                )}
              </div>
            </div>
              </>
            ) : null}

            {/* Botón de cerrar */}
            <div className="ver-legajo-modal-actions">
              {onDarDeBaja ? (
                <button type="button" className="ver-legajo-btn ver-legajo-btn-danger" onClick={onDarDeBaja}>
                  Dar de Baja
                </button>
              ) : (
                <span />
              )}
              <button className="ver-legajo-btn ver-legajo-btn-primary" onClick={onClose}>
                Cerrar
              </button>
            </div>

            {novedadDetail ? (
              <RrhhNovedadDetailModal
                novedad={novedadDetail}
                empleadoNombre={empleadoNombre}
                onClose={() => setNovedadDetail(null)}
                onNovedadUpdated={(actualizada) => {
                  setNovedadDetail(actualizada)
                  setNovedadesRRHH((prev) =>
                    prev.map((n) => (n.id === actualizada.id ? actualizada : n))
                  )
                }}
              />
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}

export default VerLegajoModal


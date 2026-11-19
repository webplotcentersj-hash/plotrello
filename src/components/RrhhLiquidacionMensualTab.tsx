import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import apiService from '../services/api'
import type {
  Asistencia,
  RrhhLiquidacionDeuda,
  RrhhLiquidacionDeudaTipo,
  RrhhLiquidacionPago,
  RrhhNovedad,
  SolicitudPermiso,
  UsuarioRecord
} from '../types/api'
import { getArgentinaDateString } from '../utils/dateUtils'
import { etiquetaUsuarioNombre } from '../utils/etiquetaUsuarioNombre'
import { supabase } from '../services/supabaseClient'
import { idOperarioEfectivoHistorial } from '../features/work-pool/workPoolOperarioNotas'
import {
  LS_VALOR_HORA_EXTRA,
  calcularStatsAsistencia,
  diasEntre,
  formatArs,
  type HorarioEsperadoCtx,
  type HorarioFijoAsistencia
} from '../utils/asistenciaStats'
import { formatHoras } from '../services/relojBiometricoService'
import { exportarLiquidacionMensualXlsx } from '../utils/exportLiquidacionMensual'
import { exportarLiquidacionMensualPdf } from '../utils/exportLiquidacionMensualPdf'
import {
  CCT_LIQUIDACION_DEFAULT,
  CONFIG_LIQUIDACION_VERSION,
  MONTOS_VACIOS,
  PCT_ANTIGUEDAD_LEGAL_DEFAULT,
  TARDANZAS_POR_DIA_DESCUENTO,
  VALOR_DIA_DESCUENTO_DEFAULT,
  armarLiquidacionEmpleado,
  cargarMesLiquidacion,
  cargasParecenSinConfigurar,
  cargasSocialesSegunConvenio,
  guardarMesLiquidacion,
  mesAnterior,
  mesDeFecha,
  montosHeredadosMesNuevo,
  normalizarCargas,
  normalizarMontos,
  normalizarPctAntiguedad,
  totalesLiquidacion,
  type CargaSocialDef,
  type MontosLiquidacion
} from '../utils/liquidacionMensual'
import {
  deudasAplicables,
  etiquetaDeudaTipo,
  excedenteSinAplicar,
  normalizarAplicaciones,
  periodoHabilitaArrastreAuto,
  periodoOrigenArrastre,
  repartirFifo,
  resumenLiquidacionDeuda,
  saldoParaArrastre,
  totalAplicadoADeudas,
  totalPagos,
  type AplicacionDeuda
} from '../utils/liquidacionDeudas'
import { ultimoDiaMes } from '../utils/asistenciaStats'
import { filtrarUsuariosLiquidacionMensual } from '../utils/rrhhUsuariosExcluidos'
import { feriadosEntre } from '../utils/feriadosArgentina'
import './RrhhLiquidacionMensualTab.css'

function leerPrecioDefault(): number {
  try {
    const v = localStorage.getItem(LS_VALOR_HORA_EXTRA)
    const n = v ? Number(v) : 0
    return Number.isFinite(n) && n > 0 ? n : 0
  } catch {
    return 0
  }
}

function aNumero(value: string): number {
  const n = Number(value.replace(',', '.'))
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0
}

function aNumeroCeroOk(value: string): number {
  const n = Number(String(value).replace(',', '.'))
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : 0
}

function Numero({
  value,
  onCommit,
  placeholder,
  className,
  mostrarCero = false,
  ceroOk = false,
  onClear
}: {
  value: number
  onCommit: (n: number) => void
  placeholder?: string
  className?: string
  mostrarCero?: boolean
  /** Permite 0 (p. ej. neto manual o alícuotas). */
  ceroOk?: boolean
  /** Si se define, vaciar el campo llama a esto en vez de guardar 0 (p. ej. neto → auto). */
  onClear?: () => void
}) {
  const visible = value || mostrarCero ? String(value) : ''
  const [texto, setTexto] = useState(visible)
  const [foco, setFoco] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!foco) setTexto(visible)
  }, [visible, foco])

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    },
    []
  )

  const parse = (raw: string) => (ceroOk ? aNumeroCeroOk(raw) : aNumero(raw))

  const guardar = (raw: string) => {
    if (onClear && raw.trim() === '') {
      onClear()
      return
    }
    const n = parse(raw)
    // Solo si cambió: entrar y salir del campo no debe fijar el valor (p. ej. el neto calculado).
    if (n === value) return
    onCommit(n)
  }

  return (
    <input
      className={className}
      type="text"
      inputMode="decimal"
      value={foco ? texto : visible}
      placeholder={placeholder}
      onFocus={() => {
        setFoco(true)
        setTexto(visible)
      }}
      onChange={(e) => {
        const next = e.target.value
        setTexto(next)
        if (timerRef.current) clearTimeout(timerRef.current)
        timerRef.current = setTimeout(() => guardar(next), 350)
      }}
      onBlur={() => {
        if (timerRef.current) {
          clearTimeout(timerRef.current)
          timerRef.current = null
        }
        setFoco(false)
        if (texto !== visible) guardar(texto)
      }}
    />
  )
}

export default function RrhhLiquidacionMensualTab({
  asistencia,
  novedades,
  permisos,
  usuarios,
  usuarioSeleccionado,
  fechaDesde,
  fechaHasta
}: {
  asistencia: Asistencia[]
  novedades: RrhhNovedad[]
  permisos: SolicitudPermiso[]
  usuarios: UsuarioRecord[]
  usuarioSeleccionado: number | null
  fechaDesde: string
  fechaHasta: string
}) {
  const mes = mesDeFecha(fechaDesde)
  const [cargas, setCargas] = useState<CargaSocialDef[]>([])
  const [montos, setMontos] = useState<Record<number, MontosLiquidacion>>({})
  const [pctAntiguedadLegal, setPctAntiguedadLegal] = useState(PCT_ANTIGUEDAD_LEGAL_DEFAULT)
  const [valorDiaDescuento, setValorDiaDescuento] = useState(VALOR_DIA_DESCUENTO_DEFAULT)
  const [listo, setListo] = useState(false)
  const [precioDefault, setPrecioDefault] = useState(leerPrecioDefault)
  const [idPeriodo, setIdPeriodo] = useState<number | null>(null)
  const [guardandoBd, setGuardandoBd] = useState(false)
  const [pagosPorUsuario, setPagosPorUsuario] = useState<Record<number, RrhhLiquidacionPago[]>>({})
  const [deudas, setDeudas] = useState<RrhhLiquidacionDeuda[]>([])
  const [pagoDraft, setPagoDraft] = useState<
    Record<number, { fecha: string; monto: string; notas: string; recibo: File | null }>
  >({})
  const [deudaDraft, setDeudaDraft] = useState<
    Record<number, { tipo: RrhhLiquidacionDeudaTipo; monto: string; concepto: string; periodoOrigen: string }>
  >({})
  const [subiendoPago, setSubiendoPago] = useState<number | null>(null)
  const [guardandoDeuda, setGuardandoDeuda] = useState<number | null>(null)
  const arrastreHechoRef = useRef<string | null>(null)
  const [fechasIngreso, setFechasIngreso] = useState<Record<number, string | null>>({})
  const [abierto, setAbierto] = useState<number | null>(null)
  const [horariosPorMes, setHorariosPorMes] = useState<Record<string, Record<number, HorarioFijoAsistencia>>>({})
  const [horarioEsperadoCtx, setHorarioEsperadoCtx] = useState<HorarioEsperadoCtx | null>(null)
  /** Pagos excedentes ya aplicados a deudas en este período (config_json.aplicacionesDeuda). */
  const [aplicaciones, setAplicaciones] = useState<AplicacionDeuda[]>([])
  /**
   * Último config_json conocido del período. Cada guardado parte de acá para no
   * borrar claves que no maneja esa edición (cctCodigo, netos, aplicaciones…).
   */
  const cfgRef = useRef<Record<string, unknown>>({})
  const [actividad, setActividad] = useState<Map<number, { ventas: number; plata: number; ops: number; trabajos: number }>>(new Map())
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** Evita que edits rápidos de varios empleados se pisen por closures stale. */
  const persistRef = useRef({
    cargas,
    montos,
    pctAntiguedadLegal,
    precioDefault,
    valorDiaDescuento
  })
  persistRef.current = {
    cargas,
    montos,
    pctAntiguedadLegal,
    precioDefault,
    valorDiaDescuento
  }

  const dias = useMemo(() => diasEntre(fechaDesde, fechaHasta), [fechaDesde, fechaHasta])
  const mesesEnPeriodo = useMemo(() => [...new Set(dias.map((d) => d.slice(0, 7)))], [dias])

  useEffect(() => {
    let cancelado = false
    setListo(false)
    void (async () => {
      const local = cargarMesLiquidacion(mes)
      const res = await apiService.rrhhLiquidacionPeriodoObtener(mes)
      if (cancelado) return
      if (res.success && res.data) {
        setIdPeriodo(res.data.id)
        const cfg = res.data.config_json || {}
        cfgRef.current = { ...cfg }
        setAplicaciones(normalizarAplicaciones(cfg.aplicacionesDeuda))
        const v2 = Number(cfg.version) >= CONFIG_LIQUIDACION_VERSION
        const cctCfg =
          typeof cfg.cctCodigo === 'string' && cfg.cctCodigo.trim()
            ? String(cfg.cctCodigo).trim()
            : CCT_LIQUIDACION_DEFAULT
        const cargasCfg = normalizarCargas(
          Array.isArray(cfg.cargas) ? cfg.cargas : local.cargas,
          cctCfg,
          v2 && Array.isArray(cfg.cargas)
        )
        const pct = normalizarPctAntiguedad(
          cfg.pctAntiguedadLegal != null ? cfg.pctAntiguedadLegal : local.pctAntiguedadLegal,
          v2 && cfg.pctAntiguedadLegal != null
        )
        const valorDiaCfg =
          cfg.valorDiaDescuento != null ? Number(cfg.valorDiaDescuento) : local.valorDiaDescuento
        const montosCfg =
          cfg.montos && typeof cfg.montos === 'object'
            ? (cfg.montos as Record<string, MontosLiquidacion>)
            : null
        const montosMap: Record<number, MontosLiquidacion> = {}
        if (montosCfg) {
          for (const [id, row] of Object.entries(montosCfg)) montosMap[Number(id)] = normalizarMontos(row)
        }
        // Período sin montos propios: hereda sueldos del mes anterior, sin el neto manual.
        const montosIniciales = montosCfg ? montosMap : montosHeredadosMesNuevo(local.montos)
        setCargas(cargasCfg)
        setMontos(montosIniciales)
        setPctAntiguedadLegal(pct)
        setValorDiaDescuento(
          Number.isFinite(valorDiaCfg) && valorDiaCfg >= 0
            ? Math.round(valorDiaCfg * 100) / 100
            : local.valorDiaDescuento
        )
        // Config vieja (v1) o sin montos: persistir ya normalizada como v2, así desde ahora
        // un 0 explícito en alícuotas / antigüedad se respeta.
        if (
          !v2 ||
          !montosCfg ||
          cargasParecenSinConfigurar(Array.isArray(cfg.cargas) ? (cfg.cargas as CargaSocialDef[]) : null)
        ) {
          const nextCfg = {
            ...cfg,
            version: CONFIG_LIQUIDACION_VERSION,
            cctCodigo: cctCfg,
            cargas: cargasCfg,
            pctAntiguedadLegal: pct,
            valorDiaDescuento:
              Number.isFinite(valorDiaCfg) && valorDiaCfg >= 0
                ? Math.round(valorDiaCfg * 100) / 100
                : local.valorDiaDescuento,
            montos: Object.fromEntries(Object.entries(montosIniciales).map(([k, v]) => [String(k), v]))
          }
          cfgRef.current = nextCfg
          void apiService.rrhhLiquidacionPeriodoUpsert({
            periodo: mes,
            valor_hora_default: Number(res.data.valor_hora_default) || leerPrecioDefault(),
            config_json: nextCfg
          })
        }
        const vh = Number(res.data.valor_hora_default) || 0
        if (vh > 0) {
          setPrecioDefault(vh)
          try {
            localStorage.setItem(LS_VALOR_HORA_EXTRA, String(vh))
          } catch {
            /* ignore */
          }
        } else {
          setPrecioDefault(leerPrecioDefault())
        }
        const pagosRes = await apiService.rrhhLiquidacionPagosListar(res.data.id)
        if (!cancelado && pagosRes.success && pagosRes.data) {
          const map: Record<number, RrhhLiquidacionPago[]> = {}
          for (const p of pagosRes.data) {
            if (!map[p.id_usuario]) map[p.id_usuario] = []
            map[p.id_usuario].push(p)
          }
          setPagosPorUsuario(map)
        }
        const deudasRes = await apiService.rrhhLiquidacionDeudasListar({ soloActivas: true })
        if (!cancelado && deudasRes.success && deudasRes.data) setDeudas(deudasRes.data)
      } else {
        setIdPeriodo(null)
        // Mes nuevo en BD: hereda sueldos del mes anterior, sin el neto manual.
        const montosIniciales = montosHeredadosMesNuevo(local.montos)
        setMontos(montosIniciales)
        setValorDiaDescuento(local.valorDiaDescuento)
        setPrecioDefault(leerPrecioDefault())
        setPagosPorUsuario({})
        setDeudas([])
        setAplicaciones([])
        // Crear período en BD al abrir el mes (local ya viene normalizado).
        const cargasInicial = local.cargas
        const pctInicial = local.pctAntiguedadLegal
        setCargas(cargasInicial)
        setPctAntiguedadLegal(pctInicial)
        const nextCfg = {
          version: CONFIG_LIQUIDACION_VERSION,
          cctCodigo: CCT_LIQUIDACION_DEFAULT,
          cargas: cargasInicial,
          pctAntiguedadLegal: pctInicial,
          valorDiaDescuento: local.valorDiaDescuento,
          montos: Object.fromEntries(Object.entries(montosIniciales).map(([k, v]) => [String(k), v]))
        }
        cfgRef.current = nextCfg
        // Solo crear si la BD confirmó que no existe: con error de red no pisar un período real.
        if (res.success) {
          const crear = await apiService.rrhhLiquidacionPeriodoUpsert({
            periodo: mes,
            valor_hora_default: leerPrecioDefault(),
            config_json: nextCfg
          })
          if (!cancelado && crear.success && crear.data) setIdPeriodo(crear.data.id)
        }
        const deudasRes = await apiService.rrhhLiquidacionDeudasListar({ soloActivas: true })
        if (!cancelado && deudasRes.success && deudasRes.data) setDeudas(deudasRes.data)
      }
      arrastreHechoRef.current = null
      if (!cancelado) setListo(true)
    })()
    return () => {
      cancelado = true
    }
  }, [mes])

  // Rotativos + ajustes de turno del período (misma regla que la pestaña Asistencia):
  // sin esto un franco de rotativo en día de semana salía como falta injustificada.
  useEffect(() => {
    let cancelado = false
    void Promise.all([
      import('../services/rrhhTurnosRotativosService').then((m) => m.listarRotacionesCompletas()),
      apiService.obtenerTurnos(null, fechaDesde, fechaHasta)
    ])
      .then(([rot, rt]) => {
        if (cancelado) return
        const overridesPorUsuarioDia: Record<string, { entrada: string; salida: string }> = {}
        if (rt.success && rt.data) {
          for (const t of rt.data) {
            const f = String(t.fecha || '').slice(0, 10)
            if (!f) continue
            overridesPorUsuarioDia[`${t.id_usuario}|${f}`] = {
              entrada: String(t.hora_entrada || '').slice(0, 5),
              salida: String(t.hora_salida || '').slice(0, 5)
            }
          }
        }
        setHorarioEsperadoCtx({
          plantillas: rot.plantillas,
          asignaciones: rot.asignaciones,
          overridesPorUsuarioDia
        })
      })
      .catch(() => {
        if (!cancelado) setHorarioEsperadoCtx(null)
      })
    return () => {
      cancelado = true
    }
  }, [fechaDesde, fechaHasta])

  useEffect(() => {
    let cancelado = false
    void apiService.obtenerLegajosBasico().then((res) => {
      if (cancelado || !res.success || !res.data) return
      const map: Record<number, string | null> = {}
      for (const [id, leg] of Object.entries(res.data)) {
        map[Number(id)] = leg.fecha_ingreso ? String(leg.fecha_ingreso).slice(0, 10) : null
      }
      setFechasIngreso(map)
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
      mesesEnPeriodo.forEach((periodo, i) => {
        const r = results[i]
        if (!r.success || !r.data) return
        const entradas: Record<number, HorarioFijoAsistencia> = {}
        for (const [id, h] of Object.entries(r.data)) {
          if (!h.entrada) continue
          entradas[Number(id)] = {
            entrada: h.entrada,
            salida: h.salida,
            horas: h.horas,
            trabajaSabado: h.trabajaSabado,
            sabadoEntrada: h.sabadoEntrada,
            sabadoSalida: h.sabadoSalida
          }
        }
        map[periodo] = entradas
      })
      setHorariosPorMes(map)
    })
    return () => {
      cancelado = true
    }
  }, [mesesEnPeriodo])

  useEffect(() => {
    let cancelado = false
    void (async () => {
      const [ventasRes, movRes] = await Promise.all([
        apiService.obtenerVentas(undefined, fechaDesde, fechaHasta, 'todos'),
        supabase
          ? supabase
              .from('historial_movimientos')
              .select('id_orden, id_usuario, nombre_usuario')
              .gte('timestamp', `${fechaDesde}T00:00:00-03:00`)
              .lte('timestamp', `${fechaHasta}T23:59:59.999-03:00`)
              .limit(8000)
          : Promise.resolve({ data: [], error: null })
      ])
      if (cancelado) return
      const acum = new Map<number, { ventas: number; plata: number; ops: Set<number>; trabajos: number }>()
      const slot = (id: number) => {
        let row = acum.get(id)
        if (!row) {
          row = { ventas: 0, plata: 0, ops: new Set(), trabajos: 0 }
          acum.set(id, row)
        }
        return row
      }
      for (const venta of ventasRes.success ? ventasRes.data ?? [] : []) {
        if (!venta.id_vendedor || venta.estado_pago === 'Cancelado') continue
        const row = slot(venta.id_vendedor)
        row.ventas += 1
        row.plata += Number(venta.valor_total) || 0
      }
      for (const raw of movRes.data ?? []) {
        const mov = {
          id_orden: Number(raw.id_orden),
          id_usuario: Number(raw.id_usuario),
          nombre_usuario: (raw.nombre_usuario as string | null) ?? null,
          timestamp: '',
          estado_anterior: null,
          estado_nuevo: null,
          comentario: null
        }
        const id = idOperarioEfectivoHistorial(mov)
        if (!id) continue
        const row = slot(id)
        row.trabajos += 1
        if (mov.id_orden > 0) row.ops.add(mov.id_orden)
      }
      const out = new Map<number, { ventas: number; plata: number; ops: number; trabajos: number }>()
      for (const [id, row] of acum) {
        out.set(id, {
          ventas: row.ventas,
          plata: Math.round(row.plata * 100) / 100,
          ops: row.ops.size,
          trabajos: row.trabajos
        })
      }
      setActividad(out)
    })()
    return () => {
      cancelado = true
    }
  }, [fechaDesde, fechaHasta])

  const empleados = useMemo(() => {
    const base = filtrarUsuariosLiquidacionMensual(usuarios)
    const lista = usuarioSeleccionado ? base.filter((u) => u.id === usuarioSeleccionado) : base
    return [...lista].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
  }, [usuarios, usuarioSeleccionado])

  const nombres = useMemo(() => {
    const m = new Map<number, string>()
    for (const u of empleados) m.set(u.id, etiquetaUsuarioNombre(u.nombre, u.id))
    return m
  }, [empleados])

  const idsConHorario = useMemo(() => {
    const ids = new Set<number>()
    for (const porMes of Object.values(horariosPorMes)) {
      for (const id of Object.keys(porMes)) ids.add(Number(id))
    }
    return [...ids]
  }, [horariosPorMes])

  const stats = useMemo(
    () =>
      calcularStatsAsistencia({
        asistencia,
        novedades,
        dias,
        nombres,
        horariosPorMes,
        idsConHorario,
        valorHoraBase: 0,
        horarioEsperadoCtx
      }),
    [asistencia, novedades, dias, nombres, horariosPorMes, idsConHorario, horarioEsperadoCtx]
  )

  const filas = useMemo(() => {
    if (!listo) return []
    const porId = new Map(stats.map((s) => [s.id, s]))
    return empleados.map((u) =>
      armarLiquidacionEmpleado({
        id: u.id,
        nombre: nombres.get(u.id) || u.nombre,
        fechaIngreso: fechasIngreso[u.id] ?? null,
        stats: porId.get(u.id) ?? null,
        montos: montos[u.id] ?? MONTOS_VACIOS,
        precioHoraDefault: precioDefault,
        cargas,
        pctAntiguedadLegal,
        valorDiaDescuento,
        novedades,
        permisos,
        asistencia,
        horariosPorMes,
        horarioEsperadoCtx,
        dias,
        fechaDesde,
        fechaHasta
      })
    ).map((fila) => {
      const act = actividad.get(fila.id)
      return act
        ? { ...fila, ventas: act.ventas, plataVendida: act.plata, opsMovidas: act.ops, trabajos: act.trabajos }
        : fila
    })
  }, [listo, stats, empleados, nombres, fechasIngreso, montos, precioDefault, cargas, pctAntiguedadLegal, valorDiaDescuento, novedades, permisos, asistencia, horariosPorMes, horarioEsperadoCtx, dias, fechaDesde, fechaHasta, actividad])

  const totales = useMemo(() => totalesLiquidacion(filas), [filas])

  /** Arrastre automático del saldo impago del mes anterior (neto − pagos), desde el mes actual en adelante. */
  useEffect(() => {
    if (!listo || !periodoHabilitaArrastreAuto(mes) || empleados.length === 0) return
    if (arrastreHechoRef.current === mes) return
    let cancelado = false
    void (async () => {
      const origen = periodoOrigenArrastre(mes)
      const prev = await apiService.rrhhLiquidacionPeriodoObtener(origen)
      if (cancelado || !prev.success || !prev.data) {
        arrastreHechoRef.current = mes
        return
      }
      const pagosPrev = await apiService.rrhhLiquidacionPagosListar(prev.data.id)
      const pagosMap: Record<number, number> = {}
      if (pagosPrev.success && pagosPrev.data) {
        for (const p of pagosPrev.data) {
          pagosMap[p.id_usuario] = Math.round(((pagosMap[p.id_usuario] || 0) + p.monto) * 100) / 100
        }
      }
      const cfg = prev.data.config_json || {}
      const montosPrev =
        cfg.montos && typeof cfg.montos === 'object'
          ? (cfg.montos as Record<string, Partial<MontosLiquidacion>>)
          : {}
      const actor = (() => {
        try {
          const u = localStorage.getItem('usuario')
          return u ? Number(JSON.parse(u).id) || null : null
        } catch {
          return null
        }
      })()
      // Neto del mes origen: el manual si lo hubo; si no, el calculado que quedó guardado
      // al ver ese mes (config_json.netos).
      const netosPrev =
        cfg.netos && typeof cfg.netos === 'object' ? (cfg.netos as Record<string, unknown>) : {}
      const aplicacionesPrev = normalizarAplicaciones(cfg.aplicacionesDeuda)
      // Arrastre que llegó al mes origen: lo que siga pendiente pasa también.
      const arrastresPrevRes = await apiService.rrhhLiquidacionDeudasListar({
        soloActivas: false,
        periodoDestino: origen
      })
      const arrastrePrevPend: Record<number, number> = {}
      for (const d of arrastresPrevRes.success ? arrastresPrevRes.data ?? [] : []) {
        if (d.tipo !== 'arrastre' || !d.activa) continue
        arrastrePrevPend[d.id_usuario] = (arrastrePrevPend[d.id_usuario] || 0) + (d.monto_pendiente || 0)
      }
      const nuevas: RrhhLiquidacionDeuda[] = []
      for (const u of empleados) {
        const row = montosPrev[String(u.id)]
        const netoManualPrev =
          row?.netoManual != null && Number.isFinite(Number(row.netoManual)) ? Number(row.netoManual) : null
        const netoSnap = Number(netosPrev[String(u.id)])
        const netoPrev = netoManualPrev ?? (Number.isFinite(netoSnap) ? netoSnap : null)
        // Sin neto conocido del mes origen no se toca el arrastre (antes lo ponía en 0).
        if (netoPrev == null) continue
        const saldoImpago = saldoParaArrastre({
          netoMes: netoPrev,
          pagado: pagosMap[u.id] || 0,
          aplicadoADeudas: totalAplicadoADeudas(aplicacionesPrev, u.id),
          arrastreAnteriorPendiente: arrastrePrevPend[u.id] || 0
        })
        const res = await apiService.rrhhLiquidacionDeudaAsegurarArrastre({
          id_usuario: u.id,
          periodo_destino: mes,
          periodo_origen: origen,
          saldo_impago: saldoImpago,
          id_periodo_origen: prev.data.id,
          registrado_por: actor
        })
        if (res.success && res.data) nuevas.push(res.data)
      }
      if (cancelado) return
      arrastreHechoRef.current = mes
      if (nuevas.length) {
        setDeudas((prevDeudas) => {
          const sinArrastreDestino = prevDeudas.filter(
            (d) => !(d.tipo === 'arrastre' && d.periodo_destino === mes)
          )
          return [...nuevas, ...sinArrastreDestino]
        })
      } else {
        const refresco = await apiService.rrhhLiquidacionDeudasListar({ soloActivas: true })
        if (refresco.success && refresco.data) setDeudas(refresco.data)
      }
    })()
    return () => {
      cancelado = true
    }
  }, [listo, mes, empleados])

  const periodoLabel = useMemo(() => {
    const d = new Date(fechaDesde + 'T12:00:00')
    const h = new Date(fechaHasta + 'T12:00:00')
    if (fechaDesde.slice(0, 7) === fechaHasta.slice(0, 7)) {
      return d.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
    }
    return `${d.toLocaleDateString('es-AR')} – ${h.toLocaleDateString('es-AR')}`
  }, [fechaDesde, fechaHasta])

  const feriadosPeriodo = useMemo(() => feriadosEntre(fechaDesde, fechaHasta), [fechaDesde, fechaHasta])

  const persistirBd = () => {
    const snap = persistRef.current
    guardarMesLiquidacion(
      mes,
      snap.cargas,
      snap.montos,
      snap.pctAntiguedadLegal,
      snap.valorDiaDescuento
    )
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null
      void guardarConfig({})
    }, 450)
  }

  /**
   * Upsert del config_json del período. Parte del último config conocido (cfgRef)
   * más el estado editable actual, así no se pierden cctCodigo, netos ni aplicaciones.
   */
  const guardarConfig = async (patch: Record<string, unknown>) => {
    const latest = persistRef.current
    const nextCfg: Record<string, unknown> = {
      ...cfgRef.current,
      version: CONFIG_LIQUIDACION_VERSION,
      cctCodigo:
        typeof cfgRef.current.cctCodigo === 'string' && cfgRef.current.cctCodigo
          ? cfgRef.current.cctCodigo
          : CCT_LIQUIDACION_DEFAULT,
      cargas: latest.cargas,
      pctAntiguedadLegal: latest.pctAntiguedadLegal,
      valorDiaDescuento: latest.valorDiaDescuento,
      montos: Object.fromEntries(Object.entries(latest.montos).map(([k, v]) => [String(k), v])),
      ...patch
    }
    cfgRef.current = nextCfg
    setGuardandoBd(true)
    try {
      const res = await apiService.rrhhLiquidacionPeriodoUpsert({
        periodo: mes,
        valor_hora_default: latest.precioDefault,
        config_json: nextCfg
      })
      if (res.success && res.data) setIdPeriodo(res.data.id)
      return res.success
    } finally {
      setGuardandoBd(false)
    }
  }

  /**
   * Guarda el neto de cada empleado (manual o calculado) en config_json.netos,
   * para que el mes siguiente pueda arrastrar el saldo impago aunque no haya neto manual.
   * Solo con el mes completo a la vista y una vez cargados los horarios.
   */
  const mesCompleto = fechaDesde === `${mes}-01` && fechaHasta === ultimoDiaMes(mes)
  useEffect(() => {
    if (!listo || !mesCompleto || !filas.length || !Object.keys(horariosPorMes).length) return
    const prev =
      cfgRef.current.netos && typeof cfgRef.current.netos === 'object'
        ? (cfgRef.current.netos as Record<string, number>)
        : {}
    const next: Record<string, number> = { ...prev }
    let cambio = false
    for (const f of filas) {
      const k = String(f.id)
      if (next[k] !== f.neto) {
        next[k] = f.neto
        cambio = true
      }
    }
    if (!cambio) return
    const t = setTimeout(() => {
      void guardarConfig({ netos: next })
    }, 1500)
    return () => clearTimeout(t)
    // guardarConfig lee refs; no hace falta como dependencia.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listo, mesCompleto, filas, horariosPorMes])

  const persistir = (
    nextCargas: CargaSocialDef[],
    nextMontos: Record<number, MontosLiquidacion>,
    nextPct = pctAntiguedadLegal,
    nextPrecio = precioDefault,
    nextValorDia = valorDiaDescuento
  ) => {
    persistRef.current = {
      cargas: nextCargas,
      montos: nextMontos,
      pctAntiguedadLegal: nextPct,
      precioDefault: nextPrecio,
      valorDiaDescuento: nextValorDia
    }
    setCargas(nextCargas)
    setMontos(nextMontos)
    setPctAntiguedadLegal(nextPct)
    setPrecioDefault(nextPrecio)
    setValorDiaDescuento(nextValorDia)
    persistirBd()
  }

  const cambiarMonto = (id: number, campo: keyof MontosLiquidacion, valor: string) => {
    const prevMontos = persistRef.current.montos
    const prev = prevMontos[id] ?? MONTOS_VACIOS
    if (campo === 'fueraConvenio') return
    if (campo === 'netoManual') {
      const raw = String(valor).trim()
      const next: MontosLiquidacion = {
        ...prev,
        netoManual: raw === '' ? null : aNumeroCeroOk(raw)
      }
      persistir(persistRef.current.cargas, { ...prevMontos, [id]: next })
      return
    }
    persistir(persistRef.current.cargas, {
      ...prevMontos,
      [id]: { ...prev, [campo]: aNumero(valor) }
    })
  }

  const cambiarCarga = (id: string, valor: string) => {
    const e = persistRef.current
    persistir(
      e.cargas.map((c) => (c.id === id ? { ...c, porcentaje: aNumeroCeroOk(valor) } : c)),
      e.montos
    )
  }

  const cambiarPctAntiguedad = (valor: string) => {
    const n = Number(String(valor).replace(',', '.'))
    const pct = Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : PCT_ANTIGUEDAD_LEGAL_DEFAULT
    const e = persistRef.current
    persistir(e.cargas, e.montos, pct)
  }

  const cambiarFueraConvenio = (id: number, fuera: boolean) => {
    const prevMontos = persistRef.current.montos
    const prev = prevMontos[id] ?? MONTOS_VACIOS
    persistir(persistRef.current.cargas, { ...prevMontos, [id]: { ...prev, fueraConvenio: fuera } })
  }

  const cambiarValorDia = (valor: string) => {
    // 0 es válido: no descuenta faltas ni tardanzas (mismo criterio que el cálculo).
    const dia = aNumeroCeroOk(valor)
    const e = persistRef.current
    persistir(e.cargas, e.montos, e.pctAntiguedadLegal, e.precioDefault, dia)
  }

  const cambiarPrecioDefault = (valor: string) => {
    const n = aNumero(valor)
    try {
      localStorage.setItem(LS_VALOR_HORA_EXTRA, String(n))
    } catch {
      /* ignore */
    }
    const e = persistRef.current
    // Precio fijo para todos: limpia overrides individuales para que aplique el default.
    const nextMontos: Record<number, MontosLiquidacion> = {}
    for (const [id, m] of Object.entries(e.montos)) {
      nextMontos[Number(id)] = { ...m, precioHora: 0 }
    }
    persistir(e.cargas, nextMontos, e.pctAntiguedadLegal, n, e.valorDiaDescuento)
  }

  const draftPago = (idUsuario: number) =>
    pagoDraft[idUsuario] ?? { fecha: getArgentinaDateString(), monto: '', notas: '', recibo: null }

  const registrarPago = async (idUsuario: number) => {
    if (!idPeriodo) {
      alert('Todavía no se creó el período en la base. Reintentá en unos segundos.')
      return
    }
    const d = draftPago(idUsuario)
    const monto = aNumero(d.monto)
    if (monto <= 0) {
      alert('Indicá el monto del pago.')
      return
    }
    if (!d.fecha) {
      alert('Indicá la fecha del pago.')
      return
    }
    setSubiendoPago(idUsuario)
    try {
      let url: string | null = null
      if (d.recibo) {
        const up = await apiService.rrhhLiquidacionSubirRecibo(d.recibo, {
          periodo: mes,
          idUsuario
        })
        if (!up.success || !up.data?.url) {
          alert(up.error || 'No se pudo subir el recibo')
          return
        }
        url = up.data.url
      }
      const actor = (() => {
        try {
          const u = localStorage.getItem('usuario')
          return u ? Number(JSON.parse(u).id) || null : null
        } catch {
          return null
        }
      })()
      const res = await apiService.rrhhLiquidacionPagoCrear({
        id_periodo: idPeriodo,
        id_usuario: idUsuario,
        fecha: d.fecha,
        monto,
        url_recibo: url,
        notas: d.notas.trim() || null,
        registrado_por: actor
      })
      if (!res.success || !res.data) {
        alert(res.error || 'No se pudo registrar el pago')
        return
      }
      const nextPagos = [res.data!, ...(pagosPorUsuario[idUsuario] ?? [])]
      setPagosPorUsuario((prev) => ({
        ...prev,
        [idUsuario]: nextPagos
      }))
      setPagoDraft((prev) => ({
        ...prev,
        [idUsuario]: { fecha: getArgentinaDateString(), monto: '', notas: '', recibo: null }
      }))
      // Excedente sobre el neto del mes se aplica a deudas pendientes (FIFO). Solo la parte
      // todavía no aplicada: un pago nuevo no vuelve a aplicar el excedente de pagos anteriores.
      const fila = filas.find((x) => x.id === idUsuario)
      const aplicadoPrevio = totalAplicadoADeudas(aplicaciones, idUsuario)
      const excedente = excedenteSinAplicar({
        netoMes: fila?.neto ?? 0,
        pagado: totalPagos(nextPagos),
        aplicadoADeudas: aplicadoPrevio
      })
      if (excedente > 0) {
        const reparto = repartirFifo(deudasAplicables(deudas, idUsuario, mes), excedente)
        const updated: RrhhLiquidacionDeuda[] = []
        const nuevasAplic: AplicacionDeuda[] = []
        for (const { deuda: d, aplica } of reparto) {
          const pendiente = Math.round((d.monto_pendiente - aplica) * 100) / 100
          const up = await apiService.rrhhLiquidacionDeudaActualizar(d.id, {
            monto_pendiente: pendiente,
            activa: pendiente > 0
          })
          if (up.success && up.data) {
            updated.push(up.data)
            nuevasAplic.push({ idUsuario, idDeuda: d.id, idPago: res.data.id, monto: aplica })
          }
        }
        if (nuevasAplic.length) {
          const todas = [...aplicaciones, ...nuevasAplic]
          setAplicaciones(todas)
          await guardarConfig({ aplicacionesDeuda: todas })
        }
        if (updated.length) {
          setDeudas((prev) => {
            const byId = new Map(updated.map((d) => [d.id, d]))
            return prev
              .map((d) => byId.get(d.id) ?? d)
              .filter((d) => d.activa && d.monto_pendiente > 0)
          })
        }
      }
    } finally {
      setSubiendoPago(null)
    }
  }

  const eliminarPago = async (pago: RrhhLiquidacionPago) => {
    if (!window.confirm(`¿Eliminar pago de ${formatArs(pago.monto)} del ${pago.fecha}?`)) return
    const res = await apiService.rrhhLiquidacionPagoEliminar(pago.id)
    if (!res.success) {
      alert(res.error || 'No se pudo eliminar')
      return
    }
    setPagosPorUsuario((prev) => ({
      ...prev,
      [pago.id_usuario]: (prev[pago.id_usuario] ?? []).filter((p) => p.id !== pago.id)
    }))
    // Si parte de ese pago había bajado deudas, devolverles ese monto.
    const delPago = aplicaciones.filter((a) => a.idPago === pago.id)
    if (!delPago.length) return
    const todasDeudas = await apiService.rrhhLiquidacionDeudasListar({
      idUsuario: pago.id_usuario,
      soloActivas: false
    })
    const porId = new Map((todasDeudas.success ? todasDeudas.data ?? [] : []).map((d) => [d.id, d]))
    const restauradas: RrhhLiquidacionDeuda[] = []
    for (const a of delPago) {
      const d = porId.get(a.idDeuda)
      if (!d) continue
      const pendiente = Math.round(((d.monto_pendiente || 0) + a.monto) * 100) / 100
      const up = await apiService.rrhhLiquidacionDeudaActualizar(d.id, {
        monto_pendiente: pendiente,
        activa: pendiente > 0
      })
      if (up.success && up.data) restauradas.push(up.data)
    }
    const restantes = aplicaciones.filter((a) => a.idPago !== pago.id)
    setAplicaciones(restantes)
    await guardarConfig({ aplicacionesDeuda: restantes })
    if (restauradas.length) {
      setDeudas((prev) => {
        const byId = new Map(restauradas.map((d) => [d.id, d]))
        const sinEstas = prev.filter((d) => !byId.has(d.id))
        return [...restauradas.filter((d) => d.activa && d.monto_pendiente > 0), ...sinEstas]
      })
    }
  }

  const draftDeuda = (idUsuario: number) =>
    deudaDraft[idUsuario] ?? {
      tipo: 'mes_anterior' as RrhhLiquidacionDeudaTipo,
      monto: '',
      concepto: '',
      periodoOrigen: mesAnterior(mes)
    }

  const registrarDeuda = async (idUsuario: number) => {
    const d = draftDeuda(idUsuario)
    const monto = aNumero(d.monto)
    if (monto <= 0) {
      alert('Indicá el monto de la deuda.')
      return
    }
    if (d.tipo !== 'mes_anterior' && d.tipo !== 'especial') {
      alert('Tipo de deuda inválido.')
      return
    }
    setGuardandoDeuda(idUsuario)
    try {
      const actor = (() => {
        try {
          const u = localStorage.getItem('usuario')
          return u ? Number(JSON.parse(u).id) || null : null
        } catch {
          return null
        }
      })()
      const res = await apiService.rrhhLiquidacionDeudaCrear({
        id_usuario: idUsuario,
        tipo: d.tipo,
        concepto: d.concepto.trim() || (d.tipo === 'especial' ? 'Deuda especial' : `Deuda ${d.periodoOrigen || mesAnterior(mes)}`),
        monto,
        periodo_origen: d.tipo === 'mes_anterior' ? d.periodoOrigen || mesAnterior(mes) : null,
        periodo_destino: mes,
        registrado_por: actor
      })
      if (!res.success || !res.data) {
        alert(res.error || 'No se pudo registrar la deuda')
        return
      }
      setDeudas((prev) => [res.data!, ...prev])
      setDeudaDraft((prev) => ({
        ...prev,
        [idUsuario]: {
          tipo: 'mes_anterior',
          monto: '',
          concepto: '',
          periodoOrigen: mesAnterior(mes)
        }
      }))
    } finally {
      setGuardandoDeuda(null)
    }
  }

  const eliminarDeuda = async (deuda: RrhhLiquidacionDeuda) => {
    if (!window.confirm(`¿Quitar deuda de ${formatArs(deuda.monto_pendiente)} (${etiquetaDeudaTipo(deuda.tipo)})?`)) {
      return
    }
    const res = await apiService.rrhhLiquidacionDeudaEliminar(deuda.id)
    if (!res.success) {
      alert(res.error || 'No se pudo eliminar')
      return
    }
    setDeudas((prev) => prev.filter((d) => d.id !== deuda.id))
  }

  const exportarPdf = () => {
    void exportarLiquidacionMensualPdf({ filas, fechaDesde, fechaHasta, periodoLabel })
  }

  const exportarExcel = () => {
    exportarLiquidacionMensualXlsx({ filas, cargas, fechaDesde, fechaHasta, periodoLabel })
  }

  return (
    <div className="rrhh-tab-content liq">
      <div className="rrhh-section-header">
        <div>
          <h2>Liquidación mensual</h2>
          <p className="rrhh-section-sub">
            {periodoLabel}. Domingos y feriados/puentes de Argentina no son falta si no vino; si vino, se pagan al
            doble (HE 100%). El sábado libre y el día que no le toca tampoco se descuentan.
            {feriadosPeriodo.length > 0
              ? ` Feriados del período: ${feriadosPeriodo.map((f) => `${f.fecha.slice(8)}/${f.fecha.slice(5, 7)} ${f.nombre}`).join(' · ')}.`
              : ''}
          </p>
        </div>
        <div className="rrhh-asistencia-actions">
          <button type="button" className="liq-btn-pdf" onClick={exportarPdf} disabled={!filas.length}>
            Descargar PDF
          </button>
          <button type="button" className="liq-btn-excel" onClick={exportarExcel} disabled={!filas.length}>
            Excel
          </button>
        </div>
      </div>

      <div className="liq-controles">
        <label className="liq-campo">
          Precio de la hora (fijo para todos)
          <Numero value={precioDefault} placeholder="0" onCommit={(n) => cambiarPrecioDefault(String(n))} />
          <span>
            Queda guardado en la base y aplica a todos. Si editás acá, se limpia el precio individual. Extras al 50% y
            100%.
            {guardandoBd ? ' · Guardando…' : idPeriodo ? ' · En BD' : ''}
          </span>
        </label>
        <label className="liq-campo">
          Valor día (faltas / tardanzas)
          <Numero
            mostrarCero
            ceroOk
            value={valorDiaDescuento}
            placeholder={String(VALOR_DIA_DESCUENTO_DEFAULT)}
            onCommit={(n) => cambiarValorDia(String(n))}
          />
          <span>
            Falta injustificada = 1 día a este valor. Cada {TARDANZAS_POR_DIA_DESCUENTO} tardanzas = 1 falta. Se descuenta
            del neto.
          </span>
        </label>
        <details className="liq-cargas">
          <summary>Cargas sociales del mes</summary>
          <p>
            Precargadas según ley argentina (SIPA / INSSJP / OS / AAFF / FNE) y convenio {CCT_LIQUIDACION_DEFAULT}{' '}
            (gráficos · cuota sindical). Se calculan sobre sueldo en blanco + antigüedad proporcional + horas extra:
            los <strong>aportes se descuentan del neto</strong>; las contribuciones suman al costo empresa. ART queda en
            0 para cargar la de la empresa. Un 0 cargado acá se respeta. La cuota sindical no se aplica a quien esté
            marcado “fuera de convenio” en su detalle. Antigüedad legal: % del sueldo en blanco por año cumplido
            (prorrateado; 0 = sin adicional).
          </p>
          <div className="liq-cargas-grid">
            <label className="liq-campo">
              Antigüedad legal (por año)
              <Numero mostrarCero ceroOk value={pctAntiguedadLegal} onCommit={(n) => cambiarPctAntiguedad(String(n))} />
              <span>% del sueldo en blanco × años · proporcional a días que debía</span>
            </label>
            {cargas.map((c) => (
              <label key={c.id} className="liq-campo">
                {c.lado === 'aporte' ? 'Aporte' : 'Contribución'} · {c.nombre}
                <Numero mostrarCero ceroOk value={c.porcentaje} onCommit={(n) => cambiarCarga(c.id, String(n))} />
                <span>%</span>
              </label>
            ))}
          </div>
          <button
            type="button"
            className="liq-btn-excel"
            style={{ marginTop: 10 }}
            onClick={() => {
              const next = cargasSocialesSegunConvenio(CCT_LIQUIDACION_DEFAULT)
              persistir(next, persistRef.current.montos, PCT_ANTIGUEDAD_LEGAL_DEFAULT)
            }}
          >
            Restablecer ley + convenio {CCT_LIQUIDACION_DEFAULT}
          </button>
        </details>
      </div>

      <p className="liq-tabla-hint">
        Vista de liquidación: cargá sueldo y neto acá. Clic en el nombre para asistencia, ventas, horas extra y el
        desglose completo.
      </p>
      <div className="liq-scroll">
        <table className="liq-tabla liq-tabla--compacta">
          <thead>
            <tr>
              <th>Empleado</th>
              <th title="Desde el ingreso del legajo">Antigüedad</th>
              <th title="Días con marca / días que debía · puntualidad">Asistencia</th>
              <th title="Faltas injustificadas, tardanzas que descuentan, suspensiones">Descuentos</th>
              <th className="liq-sticky liq-sticky-precio" title="Para horas extra 50% y 100%">
                $/hora extra
              </th>
              <th className="liq-sticky liq-sticky-sueldo" title="Remuneración en blanco (base del recibo)">
                Sueldo blanco
              </th>
              <th className="liq-sticky liq-sticky-sin" title="Monto fuera de recibo / no declarado">
                Fuera de blanco
              </th>
              <th className="liq-sticky liq-sticky-neto" title="Neto a pagar (editable; auto = calculado)">
                Neto a pagar
              </th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => {
              const m = montos[f.id] ?? MONTOS_VACIOS
              const puntualColor =
                f.puntualidadPct >= 90 ? '#16a34a' : f.puntualidadPct >= 70 ? '#d97706' : '#dc2626'
              const descParts: string[] = []
              if (f.faltas > 0) descParts.push(`${f.faltas} falta${f.faltas === 1 ? '' : 's'}`)
              if (f.diasDescuentoTardanzas > 0) {
                descParts.push(
                  `${f.diasDescuentoTardanzas} falta${f.diasDescuentoTardanzas === 1 ? '' : 's'} (${f.tardanzas} tarde)`
                )
              } else if (f.tardanzas > 0) {
                descParts.push(`${f.tardanzas} tarde`)
              }
              if (f.diasSuspension > 0) descParts.push(`${f.diasSuspension} susp.`)
              if (f.diasMediaJornada > 0) descParts.push(`${f.diasMediaJornada} ½j`)
              return (
                <Fragment key={f.id}>
                  <tr>
                    <td>
                      <button type="button" className="liq-nombre" onClick={() => setAbierto(abierto === f.id ? null : f.id)}>
                        {f.nombre}
                        <span className="liq-nombre-hint">{abierto === f.id ? 'cerrar' : 'detalle'}</span>
                      </button>
                    </td>
                    <td title={f.fechaIngreso ? `Ingreso ${f.fechaIngreso}` : undefined}>
                      {f.antiguedadMeses != null ? f.antiguedadLabel : '—'}
                    </td>
                    <td>
                      {f.diasConEntrada || f.diasExigibles ? (
                        <div className="liq-cell-stack">
                          <span>
                            {f.diasConEntrada}/{f.diasExigibles} días
                          </span>
                          <span className="liq-pct" style={{ color: puntualColor }}>
                            {f.puntualidadPct}% punt.
                          </span>
                        </div>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      {descParts.length ? (
                        <span className={f.faltas > 0 || f.diasSuspension > 0 ? 'liq-desc-warn' : undefined}>
                          {descParts.join(' · ')}
                        </span>
                      ) : (
                        <span className="liq-muted-inline">Sin descuentos</span>
                      )}
                    </td>
                    <td className="liq-sticky liq-sticky-precio">
                      <Numero
                        className="liq-num"
                        value={m.precioHora > 0 ? m.precioHora : precioDefault}
                        placeholder={precioDefault ? String(precioDefault) : '0'}
                        onCommit={(n) => {
                          // Vacío / 0 → sigue el precio global; otro valor = override del empleado.
                          const efectivo = n > 0 ? n : 0
                          const igualAlDefault = precioDefault > 0 && efectivo === precioDefault
                          cambiarMonto(
                            f.id,
                            'precioHora',
                            String(igualAlDefault || efectivo <= 0 ? 0 : efectivo)
                          )
                        }}
                      />
                    </td>
                    <td className="liq-sticky liq-sticky-sueldo">
                      <Numero className="liq-num" value={m.sueldoBase} placeholder="0" onCommit={(n) => cambiarMonto(f.id, 'sueldoBase', String(n))} />
                    </td>
                    <td className="liq-sticky liq-sticky-sin">
                      <Numero className="liq-num" value={m.sueldoSinDeclarar} placeholder="0" onCommit={(n) => cambiarMonto(f.id, 'sueldoSinDeclarar', String(n))} />
                    </td>
                    <td className="liq-sticky liq-sticky-neto liq-neto">
                      <div className="liq-neto-edit">
                        <Numero
                          className="liq-num"
                          mostrarCero
                          ceroOk
                          value={f.neto}
                          placeholder={f.netoCalculado ? String(f.netoCalculado) : '0'}
                          onCommit={(n) => cambiarMonto(f.id, 'netoManual', String(n))}
                          // Vaciar el campo vuelve al neto calculado (no lo deja en $0).
                          onClear={() => {
                            if (f.netoManual) cambiarMonto(f.id, 'netoManual', '')
                          }}
                        />
                        {f.netoManual ? (
                          <button
                            type="button"
                            className="liq-neto-auto"
                            title={`Volver al calculado (${formatArs(f.netoCalculado)})`}
                            onClick={() => cambiarMonto(f.id, 'netoManual', '')}
                          >
                            auto
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                  {abierto === f.id && (
                    <tr className="liq-detalle">
                      <td colSpan={8}>
                        <div className="liq-detalle-panel">
                          <header className="liq-detalle-hero">
                            <div>
                              <p className="liq-detalle-kicker">{f.nombre}</p>
                              <h3 className="liq-detalle-title">Detalle de liquidación</h3>
                            </div>
                            {(() => {
                              const rHero = resumenLiquidacionDeuda({
                                netoMes: f.neto,
                                deudas: deudasAplicables(deudas, f.id, mes),
                                pagos: pagosPorUsuario[f.id] ?? [],
                                aplicadoADeudas: totalAplicadoADeudas(aplicaciones, f.id)
                              })
                              return (
                                <div className="liq-detalle-kpis">
                                  <div className="liq-kpi liq-kpi-neto">
                                    <span>Neto mes</span>
                                    <strong>{formatArs(rHero.netoMes)}</strong>
                                  </div>
                                  <div className="liq-kpi">
                                    <span>Deudas</span>
                                    <strong>{formatArs(rHero.deudas)}</strong>
                                  </div>
                                  <div className="liq-kpi">
                                    <span>A liquidar</span>
                                    <strong>{formatArs(rHero.totalALiquidar)}</strong>
                                  </div>
                                  <div className="liq-kpi">
                                    <span>Pagado</span>
                                    <strong>{formatArs(rHero.pagado)}</strong>
                                  </div>
                                  <div className="liq-kpi">
                                    <span>Saldo</span>
                                    <strong className={rHero.saldo > 0 ? 'liq-saldo-ok' : ''}>
                                      {formatArs(rHero.saldo)}
                                    </strong>
                                  </div>
                                  <div className="liq-kpi">
                                    <span>Puntualidad</span>
                                    <strong style={{ color: puntualColor }}>
                                      {f.diasConEntrada ? `${f.puntualidadPct}%` : '—'}
                                    </strong>
                                  </div>
                                </div>
                              )
                            })()}
                          </header>

                          <div className="liq-detalle-grid">
                            <section className="liq-panel">
                              <h4>Antigüedad</h4>
                              {f.fechaIngreso ? (
                                <dl className="liq-dl">
                                  <div>
                                    <dt>Ingreso</dt>
                                    <dd>{f.fechaIngreso}</dd>
                                  </div>
                                  <div>
                                    <dt>Al cierre</dt>
                                    <dd>
                                      {f.antiguedadLabel} ({f.antiguedadAnios} año
                                      {f.antiguedadAnios === 1 ? '' : 's'})
                                    </dd>
                                  </div>
                                  <div>
                                    <dt>Legal</dt>
                                    <dd>
                                      {f.pctAntiguedadLegal}% × {f.antiguedadAnios} →{' '}
                                      {formatArs(f.adicionalAntiguedadCompleto)}
                                    </dd>
                                  </div>
                                  <div>
                                    <dt>Proporcional</dt>
                                    <dd>
                                      {f.diasDebia}/{f.diasLaborablesPeriodo} días
                                      {f.factorProporcional < 1
                                        ? ` (${Math.round(f.factorProporcional * 100)}%)`
                                        : ''}{' '}
                                      → {formatArs(f.adicionalAntiguedad)}
                                    </dd>
                                  </div>
                                </dl>
                              ) : (
                                <p className="liq-muted">Sin fecha de ingreso en el legajo.</p>
                              )}
                            </section>

                            <section className="liq-panel">
                              <h4>
                                Novedades <em>{f.novedades.length}</em>
                              </h4>
                              {f.novedades.length === 0 ? (
                                <p className="liq-muted">Sin novedades.</p>
                              ) : (
                                <ul className="liq-chips">
                                  {f.novedades.map((n, i) => (
                                    <li key={`${n.desde}-${n.etiqueta}-${i}`}>
                                      <time>
                                        {n.desde === n.hasta ? n.desde : `${n.desde} → ${n.hasta}`}
                                      </time>
                                      <span>{n.etiqueta}</span>
                                      {n.detalle ? <small>{n.detalle}</small> : null}
                                    </li>
                                  ))}
                                </ul>
                              )}
                              <p className="liq-footnote">Justificados: {f.diasJustificados}</p>
                            </section>

                            <section className="liq-panel">
                              <h4>
                                Permisos <em>{f.permisos.length}</em>
                              </h4>
                              {f.permisos.length === 0 ? (
                                <p className="liq-muted">Sin permisos en el período.</p>
                              ) : (
                                <ul className="liq-chips">
                                  {f.permisos.map((p, i) => (
                                    <li key={`${p.desde}-${i}`}>
                                      <time>
                                        {p.desde === p.hasta ? p.desde : `${p.desde} → ${p.hasta}`}
                                      </time>
                                      <span>
                                        {p.tipo} · {p.titulo}
                                        {p.dias != null ? ` · ${p.dias} d` : ''}
                                      </span>
                                      {p.detalle ? <small>{p.detalle}</small> : null}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </section>

                            <section className="liq-panel">
                              <h4>Asistencia</h4>
                              <dl className="liq-dl">
                                <div>
                                  <dt>Marcas / exigibles</dt>
                                  <dd>
                                    {f.diasConEntrada ? `${f.diasConEntrada} / ${f.diasExigibles}` : '—'}
                                  </dd>
                                </div>
                                <div>
                                  <dt>Puntualidad</dt>
                                  <dd style={{ color: puntualColor }}>
                                    {f.diasConEntrada ? `${f.puntualidadPct}%` : '—'}
                                  </dd>
                                </div>
                                <div>
                                  <dt>Tardanzas</dt>
                                  <dd>
                                    {f.tardanzas}
                                    {f.minutosTarde > 0 ? ` (${f.minutosTarde} min)` : ''}
                                  </dd>
                                </div>
                                <div>
                                  <dt>Aus. / just. / sin marca</dt>
                                  <dd>
                                    {f.ausencias} / {f.diasJustificados} / {f.sinMarca}
                                  </dd>
                                </div>
                                <div>
                                  <dt>Horas</dt>
                                  <dd>{f.totalHoras ? f.totalHoras.toFixed(1) : '—'}</dd>
                                </div>
                                <div>
                                  <dt>Extra · HE 50/100</dt>
                                  <dd>
                                    {f.totalHorasExtra > 0 ? formatHoras(f.totalHorasExtra) : '—'} ·{' '}
                                    {f.extra50 > 0 ? `${f.extra50.toFixed(1)}` : '0'} /{' '}
                                    {f.extra100 > 0 ? `${f.extra100.toFixed(1)}` : '0'} hs
                                  </dd>
                                </div>
                              </dl>
                            </section>

                            <section className="liq-panel">
                              <h4>Faltas, suspensión y tardanzas</h4>
                              <p className="liq-hint">
                                Valor día {formatArs(f.valorDiaDescuento)}. Solo injustificadas descuentan · cada{' '}
                                {TARDANZAS_POR_DIA_DESCUENTO} tardanzas = 1 falta. Suspensión = 1 día · media jornada
                                post-suspensión = ½ día.
                              </p>
                              {f.diasSuspension > 0 ? (
                                <>
                                  <p className="liq-badge-row">
                                    <span className="liq-badge liq-badge-warn">
                                      {f.diasSuspension} suspensión
                                      {f.diasSuspension === 1 ? '' : 'es'}
                                    </span>
                                    <strong>−{formatArs(f.descuentoSuspensiones)}</strong>
                                  </p>
                                  <ul className="liq-chips liq-chips-warn">
                                    {f.fechasSuspensiones.map((fecha) => (
                                      <li key={`s-${fecha}`}>
                                        <time>{fecha}</time>
                                        <span>−{formatArs(f.valorDiaDescuento)}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </>
                              ) : null}
                              {f.diasMediaJornada > 0 ? (
                                <>
                                  <p className="liq-badge-row">
                                    <span className="liq-badge">
                                      {f.diasMediaJornada} media jornada
                                    </span>
                                    <strong>−{formatArs(f.descuentoMediaJornada)}</strong>
                                  </p>
                                  <ul className="liq-chips">
                                    {f.fechasMediaJornada.map((fecha) => (
                                      <li key={`mj-${fecha}`}>
                                        <time>{fecha}</time>
                                        <span>−{formatArs(f.valorDiaDescuento / 2)}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </>
                              ) : null}
                              {f.fechasFaltas.length === 0 ? (
                                <p className="liq-muted">Sin faltas injustificadas.</p>
                              ) : (
                                <>
                                  <p className="liq-badge-row">
                                    <span className="liq-badge liq-badge-warn">
                                      {f.faltas} injustificada{f.faltas === 1 ? '' : 's'}
                                    </span>
                                    <strong>−{formatArs(f.descuentoFaltas)}</strong>
                                  </p>
                                  <ul className="liq-chips liq-chips-warn">
                                    {f.fechasFaltas.map((fecha) => (
                                      <li key={fecha}>
                                        <time>{fecha}</time>
                                        <span>−{formatArs(f.valorDiaDescuento)}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </>
                              )}
                              {f.fechasJustificadas.length > 0 ? (
                                <>
                                  <p className="liq-badge-row">
                                    <span className="liq-badge liq-badge-ok">
                                      {f.fechasJustificadas.length} justificada
                                      {f.fechasJustificadas.length === 1 ? '' : 's'}
                                    </span>
                                    <strong>$0</strong>
                                  </p>
                                  <ul className="liq-chips liq-chips-ok">
                                    {f.fechasJustificadas.map((fecha) => (
                                      <li key={`j-${fecha}`}>
                                        <time>{fecha}</time>
                                        <span>sin descuento</span>
                                      </li>
                                    ))}
                                  </ul>
                                </>
                              ) : null}
                              <p className="liq-footnote">
                                Tardanzas: {f.tardanzas}
                                {f.diasDescuentoTardanzas > 0
                                  ? ` → ${f.diasDescuentoTardanzas} falta${f.diasDescuentoTardanzas === 1 ? '' : 's'} (−${formatArs(f.descuentoTardanzas)})`
                                  : f.tardanzas > 0
                                    ? ` (faltan ${TARDANZAS_POR_DIA_DESCUENTO - (f.tardanzas % TARDANZAS_POR_DIA_DESCUENTO)} para 1 falta)`
                                    : ' · sin descuento'}
                              </p>
                            </section>

                            <section className="liq-panel">
                              <h4>Días especiales</h4>
                              <dl className="liq-dl">
                                <div>
                                  <dt>Debía / vino</dt>
                                  <dd>
                                    {f.diasDebia} / {f.diasVino}
                                  </dd>
                                </div>
                                <div>
                                  <dt>Domingos</dt>
                                  <dd>
                                    {f.domingos} · vino {f.domingosVino}
                                    {f.domingosVino > 0
                                      ? ` (${f.horasDomingo.toFixed(1)} hs ×2 = ${formatArs(f.importeDomingo)})`
                                      : ' · no es falta'}
                                  </dd>
                                </div>
                                <div>
                                  <dt>Feriados AR</dt>
                                  <dd>
                                    {f.feriados} · vino {f.feriadosVino}
                                    {f.feriadosVino > 0
                                      ? ` (${f.horasFeriado.toFixed(1)} hs ×2 = ${formatArs(f.importeFeriado)})`
                                      : ' · no es falta'}
                                  </dd>
                                </div>
                                <div>
                                  <dt>No trabaja</dt>
                                  <dd>
                                    {f.diasNoTrabaja} · vino igual {f.noTrabajaVino}
                                  </dd>
                                </div>
                              </dl>
                              {feriadosPeriodo.length > 0 ? (
                                <ul className="liq-chips liq-chips-soft">
                                  {feriadosPeriodo.map((x) => (
                                    <li key={x.fecha}>
                                      <time>{x.fecha.slice(8)}/{x.fecha.slice(5, 7)}</time>
                                      <span>{x.nombre}</span>
                                    </li>
                                  ))}
                                </ul>
                              ) : null}
                              <p className="liq-footnote">Domingo/feriado trabajado entra en HE 100%.</p>
                            </section>

                            <section className="liq-panel">
                              <h4>Haberes</h4>
                              <dl className="liq-dl">
                                <div>
                                  <dt>Ventas / facturado</dt>
                                  <dd>
                                    {f.ventas || '—'} · {formatArs(f.plataVendida)}
                                  </dd>
                                </div>
                                <div>
                                  <dt>OPs / trabajos</dt>
                                  <dd>
                                    {f.opsMovidas || '—'} · {f.trabajos || '—'}
                                  </dd>
                                </div>
                                <div>
                                  <dt>Sueldo en blanco</dt>
                                  <dd>
                                    {formatArs(f.sueldoBase)}
                                    {f.factorProporcional < 1
                                      ? ` (${Math.round(f.factorProporcional * 100)}%)`
                                      : ''}
                                  </dd>
                                </div>
                                <div>
                                  <dt>Antigüedad</dt>
                                  <dd>{formatArs(f.adicionalAntiguedad)}</dd>
                                </div>
                                <div>
                                  <dt>HE 50% / 100%</dt>
                                  <dd>
                                    {formatArs(f.importeExtra50)} / {formatArs(f.importeExtra100)}
                                  </dd>
                                </div>
                                <div>
                                  <dt>Desc. faltas / tard. / susp. / ½ j.</dt>
                                  <dd className="liq-dd-neg">
                                    −{formatArs(f.descuentoFaltas)} / −{formatArs(f.descuentoTardanzas)} / −
                                    {formatArs(f.descuentoSuspensiones)} / −{formatArs(f.descuentoMediaJornada)}
                                  </dd>
                                </div>
                                <div className="liq-dl-total">
                                  <dt>Haberes</dt>
                                  <dd>{formatArs(f.haberes)}</dd>
                                </div>
                              </dl>
                            </section>

                            <section className="liq-panel">
                              <h4>Cargas sociales</h4>
                              <label
                                className="liq-check"
                                style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, margin: '0 0 8px' }}
                              >
                                <input
                                  type="checkbox"
                                  checked={f.fueraConvenio}
                                  onChange={(e) => cambiarFueraConvenio(f.id, e.target.checked)}
                                />{' '}
                                Fuera de convenio (sin cuota sindical)
                              </label>
                              <dl className="liq-dl">
                                <div>
                                  <dt>Base imponible</dt>
                                  <dd title="Sueldo en blanco proporcional + antigüedad + horas extra">
                                    {formatArs(f.baseImponible)}
                                  </dd>
                                </div>
                                {f.aportes.map((c) => (
                                  <div key={c.id}>
                                    <dt>
                                      Aporte {c.nombre} ({c.porcentaje}%)
                                    </dt>
                                    <dd>{formatArs(c.importe)}</dd>
                                  </div>
                                ))}
                                <div className="liq-dl-emphasis">
                                  <dt>Aportes al neto</dt>
                                  <dd className="liq-dd-neg">−{formatArs(f.totalAportes)}</dd>
                                </div>
                                {f.contribuciones.map((c) => (
                                  <div key={c.id}>
                                    <dt>
                                      Contrib. {c.nombre} ({c.porcentaje}%)
                                    </dt>
                                    <dd>{formatArs(c.importe)}</dd>
                                  </div>
                                ))}
                                <div>
                                  <dt>Neto calculado</dt>
                                  <dd>{formatArs(f.netoCalculado)}</dd>
                                </div>
                                {f.netoManual ? (
                                  <div>
                                    <dt>Neto manual</dt>
                                    <dd>{formatArs(f.neto)}</dd>
                                  </div>
                                ) : null}
                                <div className="liq-dl-total">
                                  <dt>Costo empresa</dt>
                                  <dd>{formatArs(f.costoEmpresa)}</dd>
                                </div>
                              </dl>
                            </section>

                            <section className="liq-panel liq-pagos">
                              <h4>Deudas y pagos</h4>
                              {(() => {
                                const pagos = pagosPorUsuario[f.id] ?? []
                                const deudasEmp = deudasAplicables(deudas, f.id, mes)
                                const r = resumenLiquidacionDeuda({
                                  netoMes: f.neto,
                                  deudas: deudasEmp,
                                  pagos,
                                  aplicadoADeudas: totalAplicadoADeudas(aplicaciones, f.id)
                                })
                                const d = draftPago(f.id)
                                const dd = draftDeuda(f.id)
                                return (
                                  <>
                                    <div className="liq-pagos-resumen liq-pagos-resumen-5">
                                      <div>
                                        <span>Neto mes</span>
                                        <strong>{formatArs(r.netoMes)}</strong>
                                      </div>
                                      <div>
                                        <span>Deudas</span>
                                        <strong>{formatArs(r.deudas)}</strong>
                                      </div>
                                      <div>
                                        <span>A liquidar</span>
                                        <strong>{formatArs(r.totalALiquidar)}</strong>
                                      </div>
                                      <div>
                                        <span>Pagado</span>
                                        <strong>{formatArs(r.pagado)}</strong>
                                        {r.aplicadoADeudas > 0 ? (
                                          <small>{formatArs(r.aplicadoADeudas)} fue a deudas</small>
                                        ) : null}
                                      </div>
                                      <div>
                                        <span>Saldo</span>
                                        <strong className={r.saldo > 0 ? 'liq-saldo-ok' : ''}>
                                          {formatArs(r.saldo)}
                                        </strong>
                                      </div>
                                    </div>
                                    <p className="liq-hint">
                                      El pago parcial descuenta del neto del mes; el excedente baja deudas. El saldo
                                      impago del neto se arrastra solo al mes siguiente (desde hoy).
                                    </p>

                                    <h5 className="liq-subhead">Deudas al empleado</h5>
                                    {deudasEmp.length === 0 ? (
                                      <p className="liq-muted">Sin deudas pendientes.</p>
                                    ) : (
                                      <ul className="liq-pagos-lista">
                                        {deudasEmp.map((deu) => (
                                          <li key={deu.id}>
                                            <span>
                                              <span className="liq-badge liq-badge-soft">
                                                {etiquetaDeudaTipo(deu.tipo)}
                                              </span>{' '}
                                              {formatArs(deu.monto_pendiente)}
                                              {deu.concepto ? ` · ${deu.concepto}` : ''}
                                              {deu.periodo_origen ? ` · origen ${deu.periodo_origen}` : ''}
                                            </span>
                                            <span className="liq-pagos-acciones">
                                              {deu.tipo !== 'arrastre' ? (
                                                <button type="button" onClick={() => void eliminarDeuda(deu)}>
                                                  Quitar
                                                </button>
                                              ) : (
                                                <button type="button" onClick={() => void eliminarDeuda(deu)}>
                                                  Anular arrastre
                                                </button>
                                              )}
                                            </span>
                                          </li>
                                        ))}
                                      </ul>
                                    )}
                                    <div className="liq-pagos-form">
                                      <label>
                                        Tipo
                                        <select
                                          value={dd.tipo}
                                          onChange={(e) =>
                                            setDeudaDraft((prev) => ({
                                              ...prev,
                                              [f.id]: {
                                                ...dd,
                                                tipo: e.target.value as RrhhLiquidacionDeudaTipo
                                              }
                                            }))
                                          }
                                        >
                                          <option value="mes_anterior">Mes anterior (manual)</option>
                                          <option value="especial">Deuda especial</option>
                                        </select>
                                      </label>
                                      {dd.tipo === 'mes_anterior' ? (
                                        <label>
                                          Período origen
                                          <input
                                            type="month"
                                            value={dd.periodoOrigen}
                                            onChange={(e) =>
                                              setDeudaDraft((prev) => ({
                                                ...prev,
                                                [f.id]: { ...dd, periodoOrigen: e.target.value }
                                              }))
                                            }
                                          />
                                        </label>
                                      ) : null}
                                      <label>
                                        Monto
                                        <input
                                          type="text"
                                          inputMode="decimal"
                                          placeholder="0"
                                          value={dd.monto}
                                          onChange={(e) =>
                                            setDeudaDraft((prev) => ({
                                              ...prev,
                                              [f.id]: { ...dd, monto: e.target.value }
                                            }))
                                          }
                                        />
                                      </label>
                                      <label>
                                        Concepto
                                        <input
                                          type="text"
                                          placeholder="Ej. saldo septiembre / préstamo"
                                          value={dd.concepto}
                                          onChange={(e) =>
                                            setDeudaDraft((prev) => ({
                                              ...prev,
                                              [f.id]: { ...dd, concepto: e.target.value }
                                            }))
                                          }
                                        />
                                      </label>
                                      <button
                                        type="button"
                                        className="liq-btn-pago"
                                        disabled={guardandoDeuda === f.id}
                                        onClick={() => void registrarDeuda(f.id)}
                                      >
                                        {guardandoDeuda === f.id ? 'Guardando…' : 'Cargar deuda'}
                                      </button>
                                    </div>

                                    <h5 className="liq-subhead">Pagos parciales del mes</h5>
                                    {pagos.length === 0 ? (
                                      <p className="liq-muted">Sin pagos registrados este mes.</p>
                                    ) : (
                                      <ul className="liq-pagos-lista">
                                        {pagos.map((p) => (
                                          <li key={p.id}>
                                            <span>
                                              {p.fecha} · {formatArs(p.monto)}
                                              {p.notas ? ` · ${p.notas}` : ''}
                                            </span>
                                            <span className="liq-pagos-acciones">
                                              {p.url_recibo ? (
                                                <a href={p.url_recibo} target="_blank" rel="noopener noreferrer">
                                                  Recibo
                                                </a>
                                              ) : null}
                                              <button type="button" onClick={() => void eliminarPago(p)}>
                                                Eliminar
                                              </button>
                                            </span>
                                          </li>
                                        ))}
                                      </ul>
                                    )}
                                    <div className="liq-pagos-form">
                                      <label>
                                        Fecha
                                        <input
                                          type="date"
                                          value={d.fecha}
                                          onChange={(e) =>
                                            setPagoDraft((prev) => ({
                                              ...prev,
                                              [f.id]: { ...d, fecha: e.target.value }
                                            }))
                                          }
                                        />
                                      </label>
                                      <label>
                                        Monto
                                        <input
                                          type="text"
                                          inputMode="decimal"
                                          placeholder="0"
                                          value={d.monto}
                                          onChange={(e) =>
                                            setPagoDraft((prev) => ({
                                              ...prev,
                                              [f.id]: { ...d, monto: e.target.value }
                                            }))
                                          }
                                        />
                                      </label>
                                      <label>
                                        Notas
                                        <input
                                          type="text"
                                          placeholder="Opcional"
                                          value={d.notas}
                                          onChange={(e) =>
                                            setPagoDraft((prev) => ({
                                              ...prev,
                                              [f.id]: { ...d, notas: e.target.value }
                                            }))
                                          }
                                        />
                                      </label>
                                      <label className="liq-pagos-file">
                                        Recibo {d.recibo ? `(${d.recibo.name})` : ''}
                                        <input
                                          type="file"
                                          accept="image/*,.pdf"
                                          disabled={subiendoPago === f.id}
                                          onChange={(e) => {
                                            const file = e.target.files?.[0] ?? null
                                            setPagoDraft((prev) => ({
                                              ...prev,
                                              [f.id]: { ...d, recibo: file }
                                            }))
                                          }}
                                        />
                                      </label>
                                      <button
                                        type="button"
                                        className="liq-btn-pago"
                                        disabled={subiendoPago === f.id}
                                        onClick={() => void registrarPago(f.id)}
                                      >
                                        {subiendoPago === f.id ? 'Guardando…' : 'Registrar pago'}
                                      </button>
                                    </div>
                                  </>
                                )
                              })()}
                            </section>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
          {filas.length > 0 && (
            <tfoot>
              <tr>
                <td>Total · {filas.length} empleados</td>
                <td />
                <td>
                  <div className="liq-cell-stack">
                    <span>
                      {totales.diasConEntrada}/{totales.diasExigibles} días
                    </span>
                    <span className="liq-sub">
                      {totales.puntualidadPromedio ? `${totales.puntualidadPromedio}% punt.` : '—'}
                    </span>
                  </div>
                </td>
                <td>
                  {totales.faltasEquivalentes
                    ? `${totales.faltasEquivalentes} falta${totales.faltasEquivalentes === 1 ? '' : 's'} equiv.`
                    : 'Sin faltas'}
                  {totales.tardanzas
                    ? ` · ${totales.tardanzas} tarde${totales.diasDescuentoTardanzas ? ` (${totales.diasDescuentoTardanzas}→falta)` : ''}`
                    : ''}
                </td>
                <td className="liq-sticky liq-sticky-precio" />
                <td className="liq-sticky liq-sticky-sueldo">
                  {formatArs(filas.reduce((a, f) => a + (montos[f.id]?.sueldoBase || 0), 0))}
                </td>
                <td className="liq-sticky liq-sticky-sin">
                  {formatArs(filas.reduce((a, f) => a + (montos[f.id]?.sueldoSinDeclarar || 0), 0))}
                </td>
                <td className="liq-sticky liq-sticky-neto liq-neto">{formatArs(totales.neto)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}

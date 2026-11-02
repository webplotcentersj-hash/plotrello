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
  type HorarioFijoAsistencia
} from '../utils/asistenciaStats'
import { formatHoras } from '../services/relojBiometricoService'
import { exportarLiquidacionMensualXlsx } from '../utils/exportLiquidacionMensual'
import { exportarLiquidacionMensualPdf } from '../utils/exportLiquidacionMensualPdf'
import {
  MONTOS_VACIOS,
  PCT_ANTIGUEDAD_LEGAL_DEFAULT,
  TARDANZAS_POR_DIA_DESCUENTO,
  VALOR_DIA_DESCUENTO_DEFAULT,
  armarLiquidacionEmpleado,
  cargarMesLiquidacion,
  guardarMesLiquidacion,
  mesAnterior,
  mesDeFecha,
  totalesLiquidacion,
  type CargaSocialDef,
  type MontosLiquidacion
} from '../utils/liquidacionMensual'
import {
  deudasAplicables,
  etiquetaDeudaTipo,
  periodoHabilitaArrastreAuto,
  periodoOrigenArrastre,
  resumenLiquidacionDeuda
} from '../utils/liquidacionDeudas'
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
  ceroOk = false
}: {
  value: number
  onCommit: (n: number) => void
  placeholder?: string
  className?: string
  mostrarCero?: boolean
  /** Permite 0 (p. ej. neto manual o alícuotas). */
  ceroOk?: boolean
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

  const guardar = (raw: string, forzar = false) => {
    const n = parse(raw)
    // En blur forzamos commit para que el neto (u otros) se guarden aunque no haya cambiado el dígito.
    if (!forzar && n === value) return
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
        guardar(texto, true)
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
        const cargasCfg = Array.isArray(cfg.cargas) ? cfg.cargas : local.cargas
        const pct =
          cfg.pctAntiguedadLegal != null
            ? Number(cfg.pctAntiguedadLegal)
            : local.pctAntiguedadLegal
        const valorDiaCfg =
          cfg.valorDiaDescuento != null ? Number(cfg.valorDiaDescuento) : local.valorDiaDescuento
        const montosCfg =
          cfg.montos && typeof cfg.montos === 'object'
            ? (cfg.montos as Record<string, MontosLiquidacion>)
            : null
        const montosMap: Record<number, MontosLiquidacion> = {}
        const origen = montosCfg ?? Object.fromEntries(Object.entries(local.montos).map(([k, v]) => [k, v]))
        for (const [id, row] of Object.entries(origen)) {
          const r = row as Partial<MontosLiquidacion>
          montosMap[Number(id)] = {
            ...MONTOS_VACIOS,
            precioHora: Number(r.precioHora) || 0,
            sueldoBase: Number(r.sueldoBase) || 0,
            sueldoBlanco: Number(r.sueldoBlanco) || 0,
            sueldoSinDeclarar: Number(r.sueldoSinDeclarar) || 0,
            netoManual:
              r.netoManual == null || r.netoManual === ('' as unknown)
                ? null
                : Number.isFinite(Number(r.netoManual))
                  ? Math.round(Number(r.netoManual) * 100) / 100
                  : null
          }
        }
        setCargas(
          Array.isArray(cargasCfg)
            ? (cargasCfg as CargaSocialDef[])
            : local.cargas
        )
        setMontos(Object.keys(montosMap).length ? montosMap : local.montos)
        setPctAntiguedadLegal(
          Number.isFinite(pct) && pct >= 0 ? Math.round(pct * 100) / 100 : local.pctAntiguedadLegal
        )
        setValorDiaDescuento(
          Number.isFinite(valorDiaCfg) && valorDiaCfg >= 0
            ? Math.round(valorDiaCfg * 100) / 100
            : local.valorDiaDescuento
        )
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
        setCargas(local.cargas)
        setMontos(local.montos)
        setPctAntiguedadLegal(local.pctAntiguedadLegal)
        setValorDiaDescuento(local.valorDiaDescuento)
        setPrecioDefault(leerPrecioDefault())
        setPagosPorUsuario({})
        setDeudas([])
        // Crear período en BD al abrir el mes
        const crear = await apiService.rrhhLiquidacionPeriodoUpsert({
          periodo: mes,
          valor_hora_default: leerPrecioDefault(),
          config_json: {
            cargas: local.cargas,
            pctAntiguedadLegal: local.pctAntiguedadLegal,
            valorDiaDescuento: local.valorDiaDescuento,
            montos: Object.fromEntries(Object.entries(local.montos).map(([k, v]) => [k, v]))
          }
        })
        if (!cancelado && crear.success && crear.data) setIdPeriodo(crear.data.id)
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
        valorHoraBase: 0
      }),
    [asistencia, novedades, dias, nombres, horariosPorMes, idsConHorario]
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
  }, [listo, stats, empleados, nombres, fechasIngreso, montos, precioDefault, cargas, pctAntiguedadLegal, valorDiaDescuento, novedades, permisos, asistencia, horariosPorMes, dias, fechaDesde, fechaHasta, actividad])

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
      const nuevas: RrhhLiquidacionDeuda[] = []
      for (const u of empleados) {
        const row = montosPrev[String(u.id)]
        const netoPrev =
          row?.netoManual != null && Number.isFinite(Number(row.netoManual))
            ? Math.round(Number(row.netoManual) * 100) / 100
            : 0
        const pagadoPrev = pagosMap[u.id] || 0
        const saldoImpago = Math.round((netoPrev - pagadoPrev) * 100) / 100
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
      // Siempre el snapshot más reciente al flush (varios edits seguidos).
      const latest = persistRef.current
      setGuardandoBd(true)
      void apiService
        .rrhhLiquidacionPeriodoUpsert({
          periodo: mes,
          valor_hora_default: latest.precioDefault,
          config_json: {
            cargas: latest.cargas,
            pctAntiguedadLegal: latest.pctAntiguedadLegal,
            valorDiaDescuento: latest.valorDiaDescuento,
            montos: Object.fromEntries(
              Object.entries(latest.montos).map(([k, v]) => [String(k), v])
            )
          }
        })
        .then((res) => {
          if (res.success && res.data) setIdPeriodo(res.data.id)
        })
        .finally(() => setGuardandoBd(false))
    }, 450)
  }

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

  const cambiarValorDia = (valor: string) => {
    const n = aNumeroCeroOk(valor)
    const dia = n > 0 ? n : VALOR_DIA_DESCUENTO_DEFAULT
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
      // Excedente sobre el neto del mes se aplica a deudas pendientes (FIFO).
      const fila = filas.find((x) => x.id === idUsuario)
      const netoMes = fila?.neto ?? 0
      const pagado = nextPagos.reduce((s, p) => s + p.monto, 0)
      let leftover = Math.round((pagado - netoMes) * 100) / 100
      if (leftover > 0) {
        const aplicables = deudasAplicables(deudas, idUsuario, mes).slice().sort((a, b) => a.id - b.id)
        const updated: RrhhLiquidacionDeuda[] = []
        for (const d of aplicables) {
          if (leftover <= 0) break
          const aplica = Math.min(d.monto_pendiente, leftover)
          const pendiente = Math.round((d.monto_pendiente - aplica) * 100) / 100
          leftover = Math.round((leftover - aplica) * 100) / 100
          const up = await apiService.rrhhLiquidacionDeudaActualizar(d.id, {
            monto_pendiente: pendiente,
            activa: pendiente > 0
          })
          if (up.success && up.data) updated.push(up.data)
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
            Falta injustificada = 1 día a este valor. Cada {TARDANZAS_POR_DIA_DESCUENTO} tardanzas = 1 día. Se descuenta
            del neto.
          </span>
        </label>
        <details className="liq-cargas">
          <summary>Cargas sociales del mes</summary>
          <p>
            Alícuotas de referencia del régimen general, sin reducción pyme. Se calculan sobre el sueldo base + antigüedad
            proporcional y los <strong>aportes se descuentan del neto</strong> (del base/haberes). Las contribuciones
            suman al costo empresa. ART arranca en 0 para que cargues la de la empresa. La antigüedad legal es % del
            sueldo base por cada año cumplido; se prorratea según ingreso y días laborables.
          </p>
          <div className="liq-cargas-grid">
            <label className="liq-campo">
              Antigüedad legal (por año)
              <Numero mostrarCero value={pctAntiguedadLegal} onCommit={(n) => cambiarPctAntiguedad(String(n))} />
              <span>% del sueldo base × años · proporcional a días que debía</span>
            </label>
            {cargas.map((c) => (
              <label key={c.id} className="liq-campo">
                {c.lado === 'aporte' ? 'Aporte' : 'Contribución'} · {c.nombre}
                <Numero mostrarCero value={c.porcentaje} onCommit={(n) => cambiarCarga(c.id, String(n))} />
                <span>%</span>
              </label>
            ))}
          </div>
        </details>
      </div>

      <div className="liq-scroll">
        <table className="liq-tabla">
          <thead>
            <tr>
              <th>Empleado</th>
              <th>Antigüedad</th>
              <th>Ventas</th>
              <th>Facturado</th>
              <th>OPs</th>
              <th>Trabajo</th>
              <th>Novedades</th>
              <th title="Días con marca / días que debía asistir (hasta hoy)">Días c/ marca / exigibles</th>
              <th>Puntualidad</th>
              <th>Tardanzas</th>
              <th>Ausencias</th>
              <th>Justificados</th>
              <th>Sin marca</th>
              <th>Horas</th>
              <th>Extra</th>
              <th>HE 50%</th>
              <th>HE 100%</th>
              <th>Faltas</th>
              <th>Permisos</th>
              <th className="liq-sticky liq-sticky-precio">Precio hora</th>
              <th className="liq-sticky liq-sticky-sueldo">Sueldo base</th>
              <th className="liq-sticky liq-sticky-sin">Sin declarar</th>
              <th className="liq-sticky liq-sticky-neto">Neto</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => {
              const m = montos[f.id] ?? MONTOS_VACIOS
              const puntualColor =
                f.puntualidadPct >= 90 ? '#16a34a' : f.puntualidadPct >= 70 ? '#d97706' : '#dc2626'
              return (
                <Fragment key={f.id}>
                  <tr>
                    <td>
                      <button type="button" className="liq-nombre" onClick={() => setAbierto(abierto === f.id ? null : f.id)}>
                        {f.nombre}
                      </button>
                    </td>
                    <td title={f.fechaIngreso ? `Ingreso ${f.fechaIngreso}` : undefined}>
                      {f.antiguedadMeses != null ? f.antiguedadLabel : '—'}
                    </td>
                    <td>{f.ventas || '—'}</td>
                    <td>{f.plataVendida ? formatArs(f.plataVendida) : '—'}</td>
                    <td>{f.opsMovidas || '—'}</td>
                    <td>{f.trabajos || '—'}</td>
                    <td>{f.novedades.length}</td>
                    <td title="Días con marca / días que debía asistir (hasta hoy)">
                      {f.diasConEntrada ? `${f.diasConEntrada} / ${f.diasExigibles}` : '—'}
                    </td>
                    <td>
                      {f.diasConEntrada ? (
                        <span className="liq-pct" style={{ color: puntualColor }}>
                          {f.puntualidadPct}%
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>{f.tardanzas || '—'}{f.minutosTarde > 0 ? <span className="liq-sub"> {f.minutosTarde} min</span> : null}</td>
                    <td>{f.ausencias || '—'}</td>
                    <td>{f.diasJustificados || '—'}</td>
                    <td>{f.sinMarca || '—'}</td>
                    <td>{f.totalHoras ? f.totalHoras.toFixed(1) : '—'}</td>
                    <td>{f.totalHorasExtra > 0 ? formatHoras(f.totalHorasExtra) : '—'}</td>
                    <td>{f.extra50 > 0 ? `${f.extra50.toFixed(1)} hs` : '—'}</td>
                    <td>{f.extra100 > 0 ? `${f.extra100.toFixed(1)} hs` : '—'}</td>
                    <td>{f.faltas || '—'}</td>
                    <td>{f.permisos.length || '—'}</td>
                    <td className="liq-sticky liq-sticky-precio">
                      <Numero
                        className="liq-num"
                        value={m.precioHora}
                        placeholder={precioDefault ? String(precioDefault) : '0'}
                        onCommit={(n) => cambiarMonto(f.id, 'precioHora', String(n))}
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
                          onCommit={(n) => {
                            // Siempre persistir el valor del input en BD (también si coincide con el calculado).
                            cambiarMonto(f.id, 'netoManual', String(n))
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
                      <td colSpan={23}>
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
                                pagos: pagosPorUsuario[f.id] ?? []
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
                              <h4>Faltas y tardanzas</h4>
                              <p className="liq-hint">
                                Valor día {formatArs(f.valorDiaDescuento)}. Solo injustificadas descuentan · cada{' '}
                                {TARDANZAS_POR_DIA_DESCUENTO} tardanzas = 1 día.
                              </p>
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
                                  ? ` → ${f.diasDescuentoTardanzas} día${f.diasDescuentoTardanzas === 1 ? '' : 's'} (−${formatArs(f.descuentoTardanzas)})`
                                  : f.tardanzas > 0
                                    ? ` (faltan ${TARDANZAS_POR_DIA_DESCUENTO - (f.tardanzas % TARDANZAS_POR_DIA_DESCUENTO)} para 1 día)`
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
                                  <dt>Sueldo base</dt>
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
                                  <dt>Desc. faltas / tard.</dt>
                                  <dd className="liq-dd-neg">
                                    −{formatArs(f.descuentoFaltas)} / −{formatArs(f.descuentoTardanzas)}
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
                              <dl className="liq-dl">
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
                                  pagos
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
                <td>Total</td>
                <td />
                <td>{filas.reduce((a, f) => a + f.ventas, 0)}</td>
                <td>{formatArs(filas.reduce((a, f) => a + f.plataVendida, 0))}</td>
                <td>{filas.reduce((a, f) => a + f.opsMovidas, 0)}</td>
                <td>{filas.reduce((a, f) => a + f.trabajos, 0)}</td>
                <td>{filas.reduce((a, f) => a + f.novedades.length, 0)}</td>
                <td>
                  {totales.diasConEntrada} / {totales.diasExigibles}
                </td>
                <td>{totales.puntualidadPromedio ? `${totales.puntualidadPromedio}%` : '—'}</td>
                <td>{totales.tardanzas || '—'}</td>
                <td>{totales.ausencias || '—'}</td>
                <td>{totales.justificados || '—'}</td>
                <td>{totales.sinMarca || '—'}</td>
                <td>{totales.totalHoras ? totales.totalHoras.toFixed(1) : '—'}</td>
                <td>{totales.totalHorasExtra > 0 ? formatHoras(totales.totalHorasExtra) : '—'}</td>
                <td>{totales.extra50 > 0 ? `${totales.extra50.toFixed(1)} hs` : '—'}</td>
                <td>{totales.extra100 > 0 ? `${totales.extra100.toFixed(1)} hs` : '—'}</td>
                <td>{totales.faltas || '—'}</td>
                <td>{totales.permisos || '—'}</td>
                <td className="liq-sticky liq-sticky-precio" />
                <td className="liq-sticky liq-sticky-sueldo" />
                <td className="liq-sticky liq-sticky-sin" />
                <td className="liq-sticky liq-sticky-neto liq-neto">{formatArs(totales.neto)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}

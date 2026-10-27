import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import apiService from '../services/api'
import type { Asistencia, RrhhNovedad, SolicitudPermiso, UsuarioRecord } from '../types/api'
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
  armarLiquidacionEmpleado,
  cargarMesLiquidacion,
  guardarMesLiquidacion,
  mesDeFecha,
  totalesLiquidacion,
  type CargaSocialDef,
  type MontosLiquidacion
} from '../utils/liquidacionMensual'
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

function Numero({
  value,
  onCommit,
  placeholder,
  className,
  mostrarCero = false
}: {
  value: number
  onCommit: (n: number) => void
  placeholder?: string
  className?: string
  mostrarCero?: boolean
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

  const guardar = (raw: string) => {
    onCommit(aNumero(raw))
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
        guardar(texto)
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
  const [listo, setListo] = useState(false)
  const [precioDefault, setPrecioDefault] = useState(leerPrecioDefault)
  const [fechasIngreso, setFechasIngreso] = useState<Record<number, string | null>>({})
  const [abierto, setAbierto] = useState<number | null>(null)
  const [horariosPorMes, setHorariosPorMes] = useState<Record<string, Record<number, HorarioFijoAsistencia>>>({})
  const [actividad, setActividad] = useState<Map<number, { ventas: number; plata: number; ops: number; trabajos: number }>>(new Map())

  const dias = useMemo(() => diasEntre(fechaDesde, fechaHasta), [fechaDesde, fechaHasta])
  const mesesEnPeriodo = useMemo(() => [...new Set(dias.map((d) => d.slice(0, 7)))], [dias])

  useEffect(() => {
    const data = cargarMesLiquidacion(mes)
    setCargas(data.cargas)
    setMontos(data.montos)
    setPctAntiguedadLegal(data.pctAntiguedadLegal)
    setListo(true)
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
    const lista = usuarioSeleccionado ? usuarios.filter((u) => u.id === usuarioSeleccionado) : usuarios
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
  }, [listo, stats, empleados, nombres, fechasIngreso, montos, precioDefault, cargas, pctAntiguedadLegal, novedades, permisos, asistencia, horariosPorMes, dias, fechaDesde, fechaHasta, actividad])

  const totales = useMemo(() => totalesLiquidacion(filas), [filas])

  const periodoLabel = useMemo(() => {
    const d = new Date(fechaDesde + 'T12:00:00')
    const h = new Date(fechaHasta + 'T12:00:00')
    if (fechaDesde.slice(0, 7) === fechaHasta.slice(0, 7)) {
      return d.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
    }
    return `${d.toLocaleDateString('es-AR')} – ${h.toLocaleDateString('es-AR')}`
  }, [fechaDesde, fechaHasta])

  const persistir = (
    nextCargas: CargaSocialDef[],
    nextMontos: Record<number, MontosLiquidacion>,
    nextPct = pctAntiguedadLegal
  ) => {
    setCargas(nextCargas)
    setMontos(nextMontos)
    setPctAntiguedadLegal(nextPct)
    guardarMesLiquidacion(mes, nextCargas, nextMontos, nextPct)
  }

  const cambiarMonto = (id: number, campo: keyof MontosLiquidacion, valor: string) => {
    const prev = montos[id] ?? MONTOS_VACIOS
    persistir(cargas, { ...montos, [id]: { ...prev, [campo]: aNumero(valor) } })
  }

  const cambiarCarga = (id: string, valor: string) => {
    persistir(
      cargas.map((c) => (c.id === id ? { ...c, porcentaje: aNumero(valor) } : c)),
      montos
    )
  }

  const cambiarPctAntiguedad = (valor: string) => {
    const n = Number(String(valor).replace(',', '.'))
    const pct = Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : PCT_ANTIGUEDAD_LEGAL_DEFAULT
    persistir(cargas, montos, pct)
  }

  const cambiarPrecioDefault = (valor: string) => {
    const n = aNumero(valor)
    setPrecioDefault(n)
    try {
      localStorage.setItem(LS_VALOR_HORA_EXTRA, String(n))
    } catch {
      /* ignore */
    }
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
            {periodoLabel}. Un domingo o un feriado se paga al doble solo si vino. Si no vino, no es falta. El sábado libre y el día que no le toca tampoco se descuentan.
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
          Precio de la hora
          <Numero value={precioDefault} placeholder="0" onCommit={(n) => cambiarPrecioDefault(String(n))} />
          <span>Se usa si el empleado no tiene uno propio. Las extras van al 50% y al 100%.</span>
        </label>
        <details className="liq-cargas">
          <summary>Cargas sociales del mes</summary>
          <p>
            Alícuotas de referencia del régimen general, sin reducción pyme. Se calculan sobre el sueldo base + antigüedad
            proporcional. ART arranca en 0 para que cargues la de la empresa. La antigüedad legal es % del sueldo base por
            cada año cumplido; se prorratea según la fecha de ingreso y los días laborables que le corresponden.
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
                      <Numero className="liq-num" value={m.precioHora} placeholder={precioDefault ? String(precioDefault) : '0'} onCommit={(n) => cambiarMonto(f.id, 'precioHora', String(n))} />
                    </td>
                    <td className="liq-sticky liq-sticky-sueldo">
                      <Numero className="liq-num" value={m.sueldoBase} placeholder="0" onCommit={(n) => cambiarMonto(f.id, 'sueldoBase', String(n))} />
                    </td>
                    <td className="liq-sticky liq-sticky-sin">
                      <Numero className="liq-num" value={m.sueldoSinDeclarar} placeholder="0" onCommit={(n) => cambiarMonto(f.id, 'sueldoSinDeclarar', String(n))} />
                    </td>
                    <td className="liq-sticky liq-sticky-neto liq-neto">{f.neto ? formatArs(f.neto) : '—'}</td>
                  </tr>
                  {abierto === f.id && (
                    <tr className="liq-detalle">
                      <td colSpan={23}>
                        <div className="liq-detalle-grid">
                          <section>
                            <h3>Antigüedad</h3>
                            <p>
                              {f.fechaIngreso
                                ? `Ingreso: ${f.fechaIngreso}. ${f.antiguedadLabel} al cierre del período (${f.antiguedadAnios} año${f.antiguedadAnios === 1 ? '' : 's'}).`
                                : 'Sin fecha de ingreso en el legajo.'}
                            </p>
                            <p>
                              Legal {f.pctAntiguedadLegal}% × {f.antiguedadAnios} años → pleno {formatArs(f.adicionalAntiguedadCompleto)}.
                            </p>
                            <p>
                              Proporcional: {f.diasDebia}/{f.diasLaborablesPeriodo} días laborables
                              {f.factorProporcional < 1 ? ` (${Math.round(f.factorProporcional * 100)}%)` : ''} →{' '}
                              {formatArs(f.adicionalAntiguedad)}.
                            </p>
                          </section>
                          <section>
                            <h3>Novedades</h3>
                            {f.novedades.length === 0 ? <p>Sin novedades.</p> : (
                              <ul>
                                {f.novedades.map((n, i) => (
                                  <li key={`${n.desde}-${n.etiqueta}-${i}`}>
                                    {n.desde === n.hasta ? n.desde : `${n.desde} → ${n.hasta}`} · {n.etiqueta}
                                    {n.detalle ? ` · ${n.detalle}` : ''}
                                  </li>
                                ))}
                              </ul>
                            )}
                            <p>Días justificados: {f.diasJustificados}</p>
                          </section>
                          <section>
                            <h3>Permisos aprobados</h3>
                            {f.permisos.length === 0 ? <p>Sin permisos en el período.</p> : (
                              <ul>
                                {f.permisos.map((p, i) => (
                                  <li key={`${p.desde}-${i}`}>
                                    {p.desde === p.hasta ? p.desde : `${p.desde} → ${p.hasta}`} · {p.tipo} · {p.titulo}
                                    {p.dias != null ? ` · ${p.dias} días` : ''}
                                    {p.detalle ? ` · ${p.detalle}` : ''}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </section>
                          <section>
                            <h3>Asistencia</h3>
                            <p>
                              Días c/ marca / exigibles:{' '}
                              {f.diasConEntrada ? `${f.diasConEntrada} / ${f.diasExigibles}` : '—'}
                            </p>
                            <p>Puntualidad: {f.diasConEntrada ? `${f.puntualidadPct}%` : '—'}</p>
                            <p>Tardanzas: {f.tardanzas}{f.minutosTarde > 0 ? ` (${f.minutosTarde} min)` : ''}</p>
                            <p>Ausencias: {f.ausencias}. Justificados: {f.diasJustificados}. Sin marca: {f.sinMarca}.</p>
                            <p>
                              Horas: {f.totalHoras ? f.totalHoras.toFixed(1) : '—'} · Extra:{' '}
                              {f.totalHorasExtra > 0 ? formatHoras(f.totalHorasExtra) : '—'} · HE 50%:{' '}
                              {f.extra50 > 0 ? `${f.extra50.toFixed(1)} hs` : '—'} · HE 100%:{' '}
                              {f.extra100 > 0 ? `${f.extra100.toFixed(1)} hs` : '—'}
                            </p>
                          </section>
                          <section>
                            <h3>Faltas</h3>
                            {f.fechasFaltas.length === 0 ? (
                              <p>Sin faltas en el período.</p>
                            ) : (
                              <>
                                <p>
                                  {f.faltas} falta{f.faltas === 1 ? '' : 's'} · descuento {formatArs(f.descuentoFaltas)}
                                </p>
                                <ul>
                                  {f.fechasFaltas.map((fecha) => (
                                    <li key={fecha}>{fecha} — no asistió</li>
                                  ))}
                                </ul>
                              </>
                            )}
                          </section>
                          <section>
                            <h3>Días</h3>
                            <p>Debía venir: {f.diasDebia}. Vino: {f.diasVino}.</p>
                            <p>
                              Domingos: {f.domingos}. Vino {f.domingosVino}
                              {f.domingosVino > 0 ? ` (${f.horasDomingo.toFixed(1)} hs al doble, ${formatArs(f.importeDomingo)})` : ''}.
                            </p>
                            <p>
                              Feriados: {f.feriados}. Vino {f.feriadosVino}
                              {f.feriadosVino > 0 ? ` (${f.horasFeriado.toFixed(1)} hs al doble, ${formatArs(f.importeFeriado)})` : ''}.
                            </p>
                            <p>Días que no trabaja: {f.diasNoTrabaja}. Vino igual: {f.noTrabajaVino}.</p>
                            <p>Esas horas de domingo y feriado están dentro de las extra al 100%.</p>
                          </section>
                          <section>
                            <h3>Haberes y descuentos</h3>
                            <p>Ventas: {f.ventas}. Facturado: {formatArs(f.plataVendida)}.</p>
                            <p>OPs que movió: {f.opsMovidas}. Movimientos de trabajo: {f.trabajos}.</p>
                            <p>
                              Sueldo base proporcional: {formatArs(f.sueldoBase)}
                              {f.factorProporcional < 1 ? ` (${Math.round(f.factorProporcional * 100)}%)` : ''}
                            </p>
                            <p>Antigüedad legal: {formatArs(f.adicionalAntiguedad)}</p>
                            <p>Horas extra 50%: {formatArs(f.importeExtra50)}</p>
                            <p>Horas extra 100%: {formatArs(f.importeExtra100)}</p>
                            <p>Descuento faltas: {formatArs(f.descuentoFaltas)}</p>
                            <p>Descuento tardanzas: {formatArs(f.descuentoTardanzas)}</p>
                            <p>Haberes: {formatArs(f.haberes)}</p>
                          </section>
                          <section>
                            <h3>Cargas sociales</h3>
                            {f.aportes.map((c) => (
                              <p key={c.id}>Aporte {c.nombre} ({c.porcentaje}%): {formatArs(c.importe)}</p>
                            ))}
                            {f.contribuciones.map((c) => (
                              <p key={c.id}>Contribución {c.nombre} ({c.porcentaje}%): {formatArs(c.importe)}</p>
                            ))}
                            <p>Neto a pagar: {formatArs(f.neto)}</p>
                            <p>Costo empresa: {formatArs(f.costoEmpresa)}</p>
                          </section>
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

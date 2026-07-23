import { getArgentinaDateString } from '../../utils/dateUtils'
import { calcularCierre } from './cierreCalculations'
import { fondoMinimoCaja, requiereFondoMinimo } from './fondoCaja'
import { fmtArs } from './format'
import {
  cierresEnFecha,
  getParams,
  listArqueos,
  listCajas,
  listCierres,
  listConcilBanco,
  listConcilMP,
  listDiferencias,
  listEgresoSolicitudes,
  listMovimientos,
  listPlanillas
} from './cajaRepository'
import { kpisTableroMes, mesArgentina } from './cajaDashboardData'
import { calcularTotalesDesdePlanilla } from './cajaTotales'
import type { PlanillaCajaParsed } from './parsePlanillaCajaPdf'
import { sistemaBancoParaFecha, sistemaMpParaFecha } from './cajaDashboardData'
import { BILLETE_DENOMINACIONES } from './constants'
import { loadEstadoOperativaHoy, type CajaEstadoOperativaHoy } from './cajaOperativaHoy'
import type {
  CajaAlerta,
  CajaArqueo,
  CajaCierre,
  CajaConcilBanco,
  CajaConcilMP,
  CajaDiferencia,
  CajaEgresoSolicitud,
  CajaMovimiento,
  CajaRegistro,
  CajaSaludResumen,
  PlanillaCajaGuardada
} from './types'

export type CajaSnapshot = {
  generadoEn: string
  tolerancia: number
  cajas: CajaRegistro[]
  cierres: CajaCierre[]
  arqueos: CajaArqueo[]
  movimientos: CajaMovimiento[]
  concilMp: CajaConcilMP[]
  concilBanco: CajaConcilBanco[]
  diferencias: CajaDiferencia[]
  salud: CajaSaludResumen
  /** Resumen operativo del día (cajeras). */
  operativaHoy?: CajaEstadoOperativaHoy | null
  egresosHoy?: CajaEgresoSolicitud[]
}

function uniqFechas(cierres: CajaCierre[], extra: string[] = []): string[] {
  const set = new Set<string>([...cierres.map((c) => c.fecha), ...extra])
  return [...set].sort((a, b) => b.localeCompare(a))
}

function cajaLabel(cajas: CajaRegistro[], slug: string): string {
  return cajas.find((c) => c.slug === slug)?.nombre ?? slug
}

function pushAlert(
  list: CajaAlerta[],
  alert: Omit<CajaAlerta, 'id'> & { id?: string }
): void {
  list.push({ ...alert, id: alert.id ?? `${alert.dominio}-${list.length}-${alert.fecha ?? 'x'}` })
}

/** Motor de concordancia: efectivo, MP, banco, arqueos y movimientos. */
export function analizarConcordancia(input: {
  cierres: CajaCierre[]
  arqueos: CajaArqueo[]
  movimientos: CajaMovimiento[]
  concilMp: CajaConcilMP[]
  concilBanco: CajaConcilBanco[]
  diferencias: CajaDiferencia[]
  cajas: CajaRegistro[]
  planillas?: PlanillaCajaGuardada[]
  tolerancia: number
  diasVentana?: number
}): CajaSaludResumen {
  const { cierres, arqueos, movimientos, concilMp, concilBanco, diferencias, cajas, tolerancia } =
    input
  const planillas = input.planillas ?? []
  const alertas: CajaAlerta[] = []
  const hoy = getArgentinaDateString()
  const mes = mesArgentina()

  const fechasExtra = [
    hoy,
    ...movimientos.slice(0, 60).map((m) => m.fecha),
    ...planillas.map((p) => p.fecha_hasta || p.fecha_desde).filter(Boolean)
  ]
  const fechas = uniqFechas(cierres.slice(0, 80), fechasExtra).slice(0, input.diasVentana ?? 14)

  // —— Cierres con diferencia ——
  for (const c of cierres.slice(0, 30)) {
    if (c.estado === 'REVISAR' || Math.abs(c.dif_total || 0) > tolerancia) {
      pushAlert(alertas, {
        severidad: 'warn',
        dominio: 'cierre',
        fecha: c.fecha,
        titulo: `Cierre a revisar · ${cajaLabel(cajas, c.caja_slug)}`,
        detalle: `Dif. total $${fmtArs(c.dif_total)} (ef. $${fmtArs(c.dif_ef)}, tarj. $${fmtArs(c.dif_tarj)}). ${c.observacion?.trim() || 'Sin observación.'}`,
        accion: { label: 'Ver cierres', section: 'cierres' }
      })
    }
    const recalc = calcularCierre(
      {
        fondo_fijo: c.fondo_fijo,
        ing_ef: c.ing_ef,
        egr_ef: c.egr_ef,
        ef_contado: c.ef_contado,
        tarj_sist: c.tarj_sist,
        tarj_fis: c.tarj_fis,
        mp_qr: c.mp_qr,
        trans: c.trans,
        cta_cte: c.cta_cte
      },
      tolerancia
    )
    if (Math.abs(recalc.dif_ef - (c.dif_ef || 0)) > 0.02) {
      pushAlert(alertas, {
        severidad: 'error',
        dominio: 'efectivo',
        fecha: c.fecha,
        titulo: 'Inconsistencia en cálculo de efectivo',
        detalle: `Cierre ${c.fecha} ${c.caja_slug}: dif. efectivo guardada $${fmtArs(c.dif_ef)} vs recalculada $${fmtArs(recalc.dif_ef)}.`,
        accion: { label: 'Editar cierre', section: 'cierres' }
      })
    }
  }

  // —— Por fecha: MP y banco vs conciliaciones ——
  for (const fecha of fechas) {
    const delDia = cierresEnFecha(cierres, fecha)
    const mpSistema = sistemaMpParaFecha(fecha, cierres, planillas, movimientos).valor
    const transSistema = sistemaBancoParaFecha(fecha, cierres, planillas, movimientos).valor

    const concMp = concilMp.find((x) => x.fecha === fecha)
    if (mpSistema > 0 && !concMp) {
      pushAlert(alertas, {
        severidad: 'warn',
        dominio: 'mercado_pago',
        fecha,
        titulo: 'Falta conciliación Mercado Pago',
        detalle: `Hay $${fmtArs(mpSistema)} en cierres (tarjeta sistema + MP/QR) pero no hay registro de conciliación MP para ${fecha}.`,
        accion: { label: 'Conciliar MP', section: 'concil_mp' }
      })
    }
    if (concMp) {
      const difVsCierres = concMp.sistema - mpSistema
      if (Math.abs(difVsCierres) > tolerancia) {
        pushAlert(alertas, {
          severidad: 'warn',
          dominio: 'mercado_pago',
          fecha,
          titulo: 'MP: sistema conciliación ≠ suma cierres',
          detalle: `Conciliación MP sistema $${fmtArs(concMp.sistema)} vs cierres del día $${fmtArs(mpSistema)} (Δ $${fmtArs(difVsCierres)}).`,
          accion: { label: 'Conciliar MP', section: 'concil_mp' }
        })
      }
      if (concMp.estado === 'REVISAR' || Math.abs(concMp.diferencia) > tolerancia) {
        pushAlert(alertas, {
          severidad: 'warn',
          dominio: 'mercado_pago',
          fecha,
          titulo: 'MP: diferencia con dashboard',
          detalle: `Dashboard $${fmtArs(concMp.dashboard)} vs sistema $${fmtArs(concMp.sistema)} (Δ $${fmtArs(concMp.diferencia)}).`,
          accion: { label: 'Conciliar MP', section: 'concil_mp' }
        })
      }
    }

    const concB = concilBanco.find((x) => x.fecha === fecha)
    if (transSistema > 0 && !concB) {
      pushAlert(alertas, {
        severidad: 'info',
        dominio: 'banco',
        fecha,
        titulo: 'Falta conciliación bancaria',
        detalle: `Transferencias en cierres: $${fmtArs(transSistema)} sin conciliación banco registrada.`,
        accion: { label: 'Conciliar banco', section: 'concil_banco' }
      })
    }
    if (concB) {
      const difVsCierres = concB.sistema - transSistema
      if (Math.abs(difVsCierres) > tolerancia) {
        pushAlert(alertas, {
          severidad: 'warn',
          dominio: 'banco',
          fecha,
          titulo: 'Banco: sistema ≠ transferencias en cierres',
          detalle: `Conciliación banco sistema $${fmtArs(concB.sistema)} vs cierres $${fmtArs(transSistema)} (Δ $${fmtArs(difVsCierres)}).`,
          accion: { label: 'Conciliar banco', section: 'concil_banco' }
        })
      }
      if (concB.estado === 'REVISAR' || Math.abs(concB.diferencia) > tolerancia) {
        pushAlert(alertas, {
          severidad: 'warn',
          dominio: 'banco',
          fecha,
          titulo: 'Banco: diferencia con extracto',
          detalle: `Extracto $${fmtArs(concB.extracto)} vs sistema $${fmtArs(concB.sistema)} (Δ $${fmtArs(concB.diferencia)}).`,
          accion: { label: 'Conciliar banco', section: 'concil_banco' }
        })
      }
    }

    if (delDia.length === 0 && (concMp || concB)) {
      pushAlert(alertas, {
        severidad: 'info',
        dominio: 'general',
        fecha,
        titulo: 'Conciliación sin cierres del día',
        detalle: 'Hay conciliación registrada pero ningún cierre de caja en esa fecha.',
        accion: { label: 'Nuevo cierre', section: 'cierres_new' }
      })
    }
  }

  // —— Fondo de caja sin configurar ——
  for (const caja of cajas) {
    if (requiereFondoMinimo(caja.slug) && (caja.fondo_fijo || 0) <= 0) {
      pushAlert(alertas, {
        severidad: 'info',
        dominio: 'efectivo',
        titulo: `Fondo de caja sin definir · ${caja.nombre}`,
        detalle: `El fondo está en $0. La cajera puede cargarlo en el cierre de turno si corresponde (no se asigna solo).`,
        accion: { label: 'Cierre de turno', section: 'cierre_turno' }
      })
    }
  }

  for (const c of cierres.slice(0, 30)) {
    const caja = cajas.find((x) => x.slug === c.caja_slug)
    if (!caja || !requiereFondoMinimo(c.caja_slug)) continue
    const min = fondoMinimoCaja(caja)
    if ((c.fondo_fijo || 0) < min) {
      pushAlert(alertas, {
        severidad: 'warn',
        dominio: 'efectivo',
        fecha: c.fecha,
        titulo: 'Cierre con fondo distinto al configurado',
        detalle: `${cajaLabel(cajas, c.caja_slug)} ${c.fecha}: fondo registrado $${fmtArs(c.fondo_fijo)} (configurado $${fmtArs(min)}).`,
        accion: { label: 'Ver cierres', section: 'cierres' }
      })
    }
    if (c.ef_contado > 0 && c.ef_contado < min) {
      pushAlert(alertas, {
        severidad: 'error',
        dominio: 'efectivo',
        fecha: c.fecha,
        titulo: 'Efectivo contado bajo el fondo de caja',
        detalle: `${c.fecha}: contado $${fmtArs(c.ef_contado)} menor al fondo $${fmtArs(min)}.`,
        accion: { label: 'Ver cierres', section: 'cierres' }
      })
    }
  }

  // —— Arqueo vs efectivo contado en cierre (misma fecha y caja) ——
  for (const a of arqueos.slice(0, 40)) {
    const caja = cajas.find((x) => x.slug === a.caja_slug)
    if (caja && requiereFondoMinimo(a.caja_slug)) {
      const min = fondoMinimoCaja(caja)
      if (a.total > 0 && a.total < min) {
        pushAlert(alertas, {
          severidad: 'error',
          dominio: 'arqueo',
          fecha: a.fecha,
          titulo: 'Arqueo por debajo del fondo de caja',
          detalle: `${cajaLabel(cajas, a.caja_slug)} ${a.fecha}: $${fmtArs(a.total)} contados; fondo configurado $${fmtArs(min)}.`,
          accion: { label: 'Ver arqueos', section: 'arqueos_admin' }
        })
      }
    }

    const cierreMatch = cierres.find((c) => c.fecha === a.fecha && c.caja_slug === a.caja_slug)
    if (cierreMatch) {
      const delta = a.total - (cierreMatch.ef_contado || 0)
      if (Math.abs(delta) > tolerancia + 1) {
        pushAlert(alertas, {
          severidad: 'warn',
          dominio: 'arqueo',
          fecha: a.fecha,
          titulo: `Arqueo ≠ efectivo contado en cierre`,
          detalle: `${cajaLabel(cajas, a.caja_slug)} ${a.fecha}: arqueo $${fmtArs(a.total)} vs cierre contado $${fmtArs(cierreMatch.ef_contado)} (Δ $${fmtArs(delta)}).`,
          accion: { label: 'Ver arqueos', section: 'arqueos_admin' }
        })
      }
    } else {
      pushAlert(alertas, {
        severidad: 'info',
        dominio: 'arqueo',
        fecha: a.fecha,
        titulo: 'Arqueo sin cierre del día',
        detalle: `${cajaLabel(cajas, a.caja_slug)} ${a.fecha}: hay arqueo $${fmtArs(a.total)} pero no cierre en esa fecha/caja.`,
        accion: { label: 'Nuevo cierre', section: 'cierres_new' }
      })
    }
  }

  // —— Diferencias pendientes ——
  const pend = diferencias.filter((d) => d.estado === 'Pendiente')
  for (const d of pend.slice(0, 8)) {
    pushAlert(alertas, {
      severidad: d.tipo === 'Faltante' ? 'error' : 'warn',
      dominio: 'diferencia',
      fecha: d.fecha,
      titulo: `${d.tipo} pendiente · $${fmtArs(d.monto)}`,
      detalle: [d.motivo, d.responsable ? `Responsable: ${d.responsable}` : null]
        .filter(Boolean)
        .join(' · '),
      accion: { label: 'Diferencias', section: 'diferencias' }
    })
  }

  // —— Movimientos recientes sin cierre asociado (heurística) ——
  const ultMov = movimientos.slice(0, 3)
  if (ultMov.length && !cierres.some((c) => c.fecha === ultMov[0].fecha)) {
    pushAlert(alertas, {
      severidad: 'info',
      dominio: 'movimiento',
      fecha: ultMov[0].fecha,
      titulo: 'Movimientos sin cierre del mismo día',
      detalle: `Último movimiento ${ultMov[0].fecha} (${ultMov[0].concepto}); verificar cierre diario.`,
      accion: { label: 'Movimientos', section: 'movimientos_admin' }
    })
  }

  const errores = alertas.filter((a) => a.severidad === 'error').length
  const warns = alertas.filter((a) => a.severidad === 'warn').length
  const puntaje = Math.max(0, Math.min(100, 100 - errores * 18 - warns * 8))

  let etiqueta: CajaSaludResumen['etiqueta'] = 'Excelente'
  if (puntaje < 70) etiqueta = 'Crítico'
  else if (puntaje < 90) etiqueta = 'Atención'

  if (alertas.length === 0) {
    pushAlert(alertas, {
      severidad: 'ok',
      dominio: 'general',
      titulo: 'Concordancia al día',
      detalle: 'Efectivo, MP, banco y cierres sin alertas en la ventana analizada.'
    })
  }

  return {
    puntaje,
    etiqueta,
    alertas: alertas.sort((a, b) => {
      const ord = { error: 0, warn: 1, info: 2, ok: 3 }
      return ord[a.severidad] - ord[b.severidad]
    }),
    fechasRecientes: fechas,
    totalesMes: (() => {
      const k = kpisTableroMes(mes, cierres, planillas, arqueos, concilMp, concilBanco)
      return {
        cierres: k.cierresMes,
        ok: k.ok,
        revisar: k.revisar,
        difNeta: k.difNeta,
        ventas: k.ventasMes
      }
    })()
  }
}

/** Alertas de concordancia derivadas de una planilla PDF cargada (todos los bloques). */
export function alertasDesdePlanilla(
  planilla: PlanillaCajaParsed,
  tolerancia: number
): CajaAlerta[] {
  const alertas: CajaAlerta[] = []
  const fecha = planilla.fecha_hasta || planilla.fecha_desde
  const resumen = calcularTotalesDesdePlanilla(planilla)

  if (planilla.lineas_cuadre_invalido > 0) {
    pushAlert(alertas, {
      severidad: 'warn',
      dominio: 'movimiento',
      fecha,
      titulo: 'Planilla PDF con líneas sin cuadrar',
      detalle: `${planilla.lineas_cuadre_invalido} comprobante(s) donde Total ≠ suma de medios de pago. Revisá antes del cierre.`,
      accion: { label: 'Mi arqueo', section: 'arqueo' }
    })
  }

  const t = planilla.totales
  if (t) {
    pushAlert(alertas, {
      severidad: 'info',
      dominio: 'general',
      fecha,
      titulo: `Planilla ${planilla.caja_nombre || 'caja'} cargada`,
      detalle: `Ingresos $${fmtArs(t.ingresos_total)} · Egresos $${fmtArs(t.egresos_total)} · Neto $${fmtArs(t.neto)} · ${planilla.cantidad_ventas} ventas FA/FB.`,
      accion: { label: 'Cierre', section: 'cierre_turno' }
    })
    if (Math.abs(t.neto - resumen.neto.total) > tolerancia + 0.5) {
      pushAlert(alertas, {
        severidad: 'warn',
        dominio: 'movimiento',
        fecha,
        titulo: 'Totales PDF vs cálculo interno',
        detalle: `Neto en PDF $${fmtArs(t.neto)} vs recalculado $${fmtArs(resumen.neto.total)} (Δ $${fmtArs(Math.abs(t.neto - resumen.neto.total))}).`,
        accion: { label: 'Mi arqueo', section: 'arqueo' }
      })
    }
  }

  if (resumen.neto.efectivo !== 0) {
    pushAlert(alertas, {
      severidad: 'info',
      dominio: 'efectivo',
      fecha,
      titulo: 'Efectivo que queda según planilla',
      detalle: `Movimiento neto en efectivo $${fmtArs(resumen.neto.efectivo)}. Sumá el fondo de caja y contá billetes hasta ese total; tarjetas y MP no entran en el arqueo.`,
      accion: { label: 'Arqueo', section: 'arqueo' }
    })
  }

  if (resumen.neto.electronico_neto !== 0) {
    pushAlert(alertas, {
      severidad: 'info',
      dominio: 'mercado_pago',
      fecha,
      titulo: 'Medios electrónicos en planilla',
      detalle: `Tarjetas/MP neto $${fmtArs(resumen.neto.tarjetas)} · Transferencias $${fmtArs(resumen.neto.trans_b)}.`,
      accion: { label: 'Conciliar MP', section: 'concil_mp' }
    })
  }

  for (const w of planilla.warnings.slice(0, 4)) {
    pushAlert(alertas, {
      severidad: 'warn',
      dominio: 'general',
      fecha,
      titulo: 'Aviso del lector PDF',
      detalle: w
    })
  }

  return alertas
}

export function mezclarSaludConPlanilla(
  salud: CajaSaludResumen,
  planilla: PlanillaCajaParsed | null | undefined,
  tolerancia: number
): CajaSaludResumen {
  if (!planilla) return salud
  const extra = alertasDesdePlanilla(planilla, tolerancia)
  const alertas = [...extra, ...salud.alertas]
  const errores = alertas.filter((a) => a.severidad === 'error').length
  const warns = alertas.filter((a) => a.severidad === 'warn').length
  const puntaje = Math.max(0, Math.min(100, 100 - errores * 18 - warns * 8))
  let etiqueta: CajaSaludResumen['etiqueta'] = 'Excelente'
  if (puntaje < 70) etiqueta = 'Crítico'
  else if (puntaje < 90) etiqueta = 'Atención'
  return {
    ...salud,
    puntaje,
    etiqueta,
    alertas: alertas.sort((a, b) => {
      const ord = { error: 0, warn: 1, info: 2, ok: 3 }
      return ord[a.severidad] - ord[b.severidad]
    })
  }
}

export async function loadCajaSnapshot(opts?: {
  usuario?: string
  usuarioId?: number
  isAdmin?: boolean
}): Promise<CajaSnapshot> {
  const hoy = getArgentinaDateString()
  const [params, cajas, cierres, arqueos, movimientos, concilMp, concilBanco, diferencias, planillas] =
    await Promise.all([
      getParams(),
      listCajas(),
      listCierres(),
      listArqueos(opts?.isAdmin ? undefined : { usuario: opts?.usuario, usuarioId: opts?.usuarioId }),
      listMovimientos(opts?.isAdmin ? undefined : { usuario: opts?.usuario, usuarioId: opts?.usuarioId }),
      listConcilMP(),
      listConcilBanco(),
      listDiferencias(),
      listPlanillas(200)
    ])

  const salud = analizarConcordancia({
    cierres,
    arqueos,
    movimientos,
    concilMp,
    concilBanco,
    diferencias,
    cajas,
    planillas,
    tolerancia: params.tolerancia
  })

  let operativaHoy: CajaEstadoOperativaHoy | null = null
  let egresosHoy: CajaEgresoSolicitud[] = []
  if (!opts?.isAdmin && opts?.usuarioId != null && opts.usuario) {
    try {
      operativaHoy = await loadEstadoOperativaHoy(opts.usuarioId, opts.usuario, hoy)
      egresosHoy = await listEgresoSolicitudes({
        fecha: hoy,
        cajaSlug: operativaHoy.cajaSlug ?? undefined,
        solicitanteId: opts.usuarioId
      })
      if (operativaHoy.cajaSlug) {
        egresosHoy = egresosHoy.filter(
          (e) =>
            e.caja_slug === operativaHoy!.cajaSlug || e.solicitante_id === opts.usuarioId
        )
      }
    } catch {
      operativaHoy = null
      egresosHoy = []
    }
  } else if (opts?.isAdmin) {
    egresosHoy = await listEgresoSolicitudes({ fecha: hoy })
  }

  return {
    generadoEn: new Date().toISOString(),
    tolerancia: params.tolerancia,
    cajas,
    cierres,
    arqueos,
    movimientos,
    concilMp,
    concilBanco,
    diferencias,
    salud,
    operativaHoy,
    egresosHoy
  }
}

function formatoBilletesArqueo(a: CajaArqueo | undefined): string {
  if (!a?.billetes || typeof a.billetes !== 'object') return 'sin detalle de billetes'
  const parts: string[] = []
  for (const d of BILLETE_DENOMINACIONES) {
    const q = Number((a.billetes as Record<string, number>)[`b${d}`] ?? 0)
    if (q > 0) parts.push(`${q}×$${d.toLocaleString('es-AR')}`)
  }
  return parts.length ? parts.join(', ') : 'sin billetes cargados'
}

/** Contexto estructurado para PlotAI / Gemini. */
export function formatSnapshotForAI(snap: CajaSnapshot, opts?: { isAdmin?: boolean; usuario?: string }): string {
  const { salud } = snap
  const hoy = getArgentinaDateString()
  const ultCierres = snap.cierres.slice(0, 8)
  const ultMp = snap.concilMp.slice(0, 5)
  const ultBanco = snap.concilBanco.slice(0, 5)
  const op = snap.operativaHoy
  const egresos = snap.egresosHoy ?? []

  const alertasTxt =
    salud.alertas.length === 0
      ? 'Sin alertas.'
      : salud.alertas
          .slice(0, 20)
          .map((a) => `- [${a.severidad}/${a.dominio}] ${a.titulo}: ${a.detalle}`)
          .join('\n')

  const ultimoArqueo =
    op?.cajaSlug != null
      ? snap.arqueos.find((a) => a.fecha === hoy && a.caja_slug === op.cajaSlug)
      : snap.arqueos.find((a) => a.fecha === hoy) ?? snap.arqueos[0]

  const egresosTxt =
    egresos.length === 0
      ? 'Sin egresos hoy.'
      : egresos
          .slice(0, 12)
          .map(
            (e) =>
              `- ${e.estado}${e.url_ticket ? '+ticket' : ''} $${fmtArs(e.monto_efectivo || 0)} · ${e.concepto || 'sin concepto'}`
          )
          .join('\n')

  const movsHoy =
    op?.ultimosMovimientos?.length
      ? op.ultimosMovimientos
          .map(
            (m) =>
              `- ${m.hora?.slice(0, 5) || '--'} ${m.concepto} ef $${fmtArs(m.efectivo || 0)} ot $${fmtArs(m.otros || 0)}`
          )
          .join('\n')
      : 'Sin movimientos listados.'

  const plot = op?.resumenPlotlab
  const operativaBlock = op
    ? `
MI DÍA OPERATIVO (${op.fecha}):
- Caja: ${op.cajaNombre || op.cajaSlug || 'sin asignar'} · turno ${op.turnoActivo}
- Arqueo hecho: ${op.arqueoHecho ? 'SÍ' : 'NO'} · Cierre de turno: ${op.cierreTurnoHecho ? 'SÍ' : 'NO'}
- Planilla del día: ${op.planillaImportada ? `sí (${op.planillasDelDia})` : 'no'}
- Egresos pendientes: ${op.egresosPendientes} · Traspasos pendientes: ${op.traspasosPendientes}
- Efectivo teórico a contar (fondo + cobros ef − egresos): ${op.efectivoTeorico != null ? `$${fmtArs(op.efectivoTeorico)}` : 'n/d'}
- Ventas Plot Lab hoy: total $${fmtArs(plot?.total ?? 0)} · efectivo $${fmtArs(plot?.efectivo ?? 0)} · tarjetas $${fmtArs(plot?.tarjetas ?? 0)} · transfer $${fmtArs(plot?.transferencia ?? 0)} · cta cte $${fmtArs(plot?.ctaCte ?? 0)} (${plot?.count ?? 0} ventas)
- Último arqueo: ${
        ultimoArqueo
          ? `contado $${fmtArs(ultimoArqueo.total)} · estado ${ultimoArqueo.estado_arqueo || '—'} · billetes: ${formatoBilletesArqueo(ultimoArqueo)}`
          : 'aún no hay arqueo'
      }
- Egresos del día:
${egresosTxt}
- Últimos movimientos:
${movsHoy}
`
    : `
HOY (${hoy}):
- Egresos del día (todas las cajas / filtro):
${egresosTxt}
`

  const rol = opts?.isAdmin ? 'Administración' : 'Cajera/mostrador'
  const guiaRol = opts?.isAdmin
    ? `- Priorizá conciliación MP/banco, cierres a revisar y diferencias.
- Indicá secciones: cierres, concil MP, concil banco, arqueos admin, diferencias.`
    : `- Ayudá a CONTAR efectivo (denominaciones ARS: ${BILLETE_DENOMINACIONES.join(', ')}), armar el arqueo, egresos con ticket, pase y cierre de turno.
- Si hay faltante vs teórico, pedí vincular egreso(s) con ticket cuya suma cubra el faltante (sección Egresos → Mi arqueo).
- No inventes montos: usá los números del contexto. Si falta dato, pedí que actualice con ↻ o complete el paso.
- Secciones útiles: Menú, Mi arqueo, Egresos, Pase de caja, Cierre de turno, Mis movimientos.
- Sé concreto: checklist corto, números, y qué tocar en la app.`

  return `MÓDULO CONTROL DE CAJAS — ASISTENTE OPERATIVO (Plot Lab).
Usuario: ${opts?.usuario ?? '—'}. Rol: ${rol}.
Tolerancia diferencias: $${fmtArs(snap.tolerancia)}.
Salud general: ${salud.puntaje}/100 (${salud.etiqueta}).
Mes: ${salud.totalesMes.cierres} cierres (${salud.totalesMes.ok} OK, ${salud.totalesMes.revisar} revisar), dif. neta $${fmtArs(salud.totalesMes.difNeta)}, ventas $${fmtArs(salud.totalesMes.ventas)}.
${operativaBlock}
ALERTAS:
${alertasTxt}

Últimos cierres (admin/histórico):
${ultCierres.map((c) => `${c.fecha} ${c.caja_slug} ventas $${fmtArs(c.total_ventas)} dif $${fmtArs(c.dif_total)} ${c.estado}`).join('\n') || 'ninguno'}

Conciliaciones MP:
${ultMp.map((x) => `${x.fecha} sist $${fmtArs(x.sistema)} dash $${fmtArs(x.dashboard)} Δ $${fmtArs(x.diferencia)} ${x.estado}`).join('\n') || 'ninguna'}

Conciliaciones banco:
${ultBanco.map((x) => `${x.fecha} sist $${fmtArs(x.sistema)} ext $${fmtArs(x.extracto)} Δ $${fmtArs(x.diferencia)} ${x.estado}`).join('\n') || 'ninguna'}

CÓMO AYUDAR (obligatorio):
${guiaRol}
- Fondo de caja: solo si está configurado (>0); no inventar $100.000.
- Efectivo teórico = fondo + ingresos efectivo − egresos; debe acercarse al contado.
- Respuestas en español rioplatense, claras, con montos formateados y pasos accionables.`
}

export function getCajaAiPrompts(isAdmin: boolean): { label: string; prompt: string }[] {
  if (isAdmin) {
    return [
      {
        label: 'Resumen del día',
        prompt:
          'Resumen ejecutivo de hoy: efectivo, MP, banco, egresos y qué revisar primero. Usá los números del contexto.'
      },
      {
        label: 'Conciliar MP',
        prompt:
          'Con los datos de hoy, ¿cuadra Mercado Pago? Si no, pasos concretos para conciliar y dónde mirar la diferencia.'
      },
      {
        label: 'Cuadre efectivo',
        prompt:
          'Analizá el cuadre de efectivo (teórico vs contado/arqueos) y listá acciones priorizadas.'
      },
      {
        label: 'Cierres a revisar',
        prompt:
          'Listá los cierres a revisar del mes/contexto y qué corregir en cada uno.'
      }
    ]
  }
  return [
    {
      label: 'Resumen de mi día',
      prompt:
        'Resumí MI día de caja con los datos del contexto: ¿ya arqueé? ¿egresos pendientes? ¿cuánto efectivo debería tener? ¿próximo paso (arqueo / egreso / pase / cierre)?'
    },
    {
      label: 'Ayuda a contar',
      prompt:
        'Ayudame a contar el efectivo. Decime cuánto debería haber según teórico/Plot Lab, cómo usar las denominaciones de billetes en Mi arqueo, y qué hago si me falta o sobra plata.'
    },
    {
      label: 'Arqueo paso a paso',
      prompt:
        'Checklist corto para hacer Mi arqueo ahora: qué contar, qué no incluir (tarjetas/transfer/CC), firma, y qué pasa si hay faltante (vincular egreso).'
    },
    {
      label: 'Egresos y faltante',
      prompt:
        'Con mis egresos de hoy del contexto, explicame qué está pendiente, cómo subir el ticket, y cómo vincular un egreso al faltante del arqueo.'
    },
    {
      label: 'Cerrar el turno',
      prompt:
        'Según mi estado (arqueo/cierre/egresos), dame el checklist para Cierre de turno y Pase: qué ya está OK y qué falta.'
    }
  ]
}

/** @deprecated Usar getCajaAiPrompts */
export const CAJA_AI_PROMPTS = getCajaAiPrompts(true)

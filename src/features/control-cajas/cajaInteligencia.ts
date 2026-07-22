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
  listMovimientos,
  listPlanillas
} from './cajaRepository'
import { kpisTableroMes, mesArgentina } from './cajaDashboardData'
import { calcularTotalesDesdePlanilla } from './cajaTotales'
import type { PlanillaCajaParsed } from './parsePlanillaCajaPdf'
import { sistemaBancoParaFecha, sistemaMpParaFecha } from './cajaDashboardData'
import type {
  CajaAlerta,
  CajaArqueo,
  CajaCierre,
  CajaConcilBanco,
  CajaConcilMP,
  CajaDiferencia,
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
    salud
  }
}

/** Contexto estructurado para PlotAI / Gemini. */
export function formatSnapshotForAI(snap: CajaSnapshot, opts?: { isAdmin?: boolean; usuario?: string }): string {
  const { salud } = snap
  const ultCierres = snap.cierres.slice(0, 8)
  const ultMp = snap.concilMp.slice(0, 5)
  const ultBanco = snap.concilBanco.slice(0, 5)

  const alertasTxt =
    salud.alertas.length === 0
      ? 'Sin alertas.'
      : salud.alertas
          .slice(0, 20)
          .map((a) => `- [${a.severidad}/${a.dominio}] ${a.titulo}: ${a.detalle}`)
          .join('\n')

  return `MÓDULO CONTROL DE CAJAS — ORQUESTACIÓN (Plot Lab).
Usuario: ${opts?.usuario ?? '—'}. Rol: ${opts?.isAdmin ? 'Administración' : 'Caja'}.
Tolerancia diferencias: $${fmtArs(snap.tolerancia)}.
Salud concordancia: ${salud.puntaje}/100 (${salud.etiqueta}).
Mes actual: ${salud.totalesMes.cierres} cierres (${salud.totalesMes.ok} OK, ${salud.totalesMes.revisar} a revisar), dif. neta $${fmtArs(salud.totalesMes.difNeta)}, ventas $${fmtArs(salud.totalesMes.ventas)}.

ALERTAS DE CONCORDANCIA (efectivo, MP, banco, arqueos):
${alertasTxt}

Últimos cierres:
${ultCierres.map((c) => `${c.fecha} ${c.caja_slug} ventas $${fmtArs(c.total_ventas)} dif $${fmtArs(c.dif_total)} ef $${fmtArs(c.dif_ef)} mp+tarj $${fmtArs((c.tarj_sist || 0) + (c.mp_qr || 0))} ${c.estado}`).join('\n') || 'ninguno'}

Conciliaciones MP recientes:
${ultMp.map((x) => `${x.fecha} sist $${fmtArs(x.sistema)} dash $${fmtArs(x.dashboard)} Δ $${fmtArs(x.diferencia)} ${x.estado}`).join('\n') || 'ninguna'}

Conciliaciones banco:
${ultBanco.map((x) => `${x.fecha} sist $${fmtArs(x.sistema)} ext $${fmtArs(x.extracto)} Δ $${fmtArs(x.diferencia)} ${x.estado}`).join('\n') || 'ninguna'}

REGLAS DE NEGOCIO:
- Fondo de caja = efectivo REAL que permanece en la caja operativa SOLO si fue configurado a mano (arranca en $0; no hay monto automático). Editable en cierre de turno. Si hay fondo > 0, el arqueo y el efectivo contado no pueden ser menores a ese valor.
- Efectivo teórico = fondo fijo + ingresos efectivo − egresos efectivo; debe coincidir con efectivo contado (tolerancia).
- MP: en cierres, tarjeta sistema + MP/QR debe alinearse con conciliación MP (sistema vs dashboard de la app MP).
- Banco: transferencias en cierres vs conciliación con extracto bancario.
- Arqueo físico de billetes debe cuadrar con efectivo contado del cierre mismo día y caja.
- Guiá al usuario con pasos concretos y secciones del menú (cierres, concil MP, concil banco, arqueos, diferencias).`
}

export const CAJA_AI_PROMPTS: { label: string; prompt: string }[] = [
  {
    label: 'Resumen del día',
    prompt:
      'Dame un resumen ejecutivo de la salud de caja hoy: efectivo, MP, banco y qué debo revisar primero.'
  },
  {
    label: 'Conciliar MP',
    prompt:
      'Explicame paso a paso cómo conciliar Mercado Pago con los cierres del día y qué revisar si hay diferencia.'
  },
  {
    label: 'Cuadre efectivo',
    prompt: '¿Cómo cuadro efectivo teórico vs contado y qué hacer si el arqueo no coincide con el cierre?'
  },
  {
    label: 'Cierre del día',
    prompt: 'Checklist para un cierre de caja completo (efectivo, tarjeta, MP, transferencias, cuenta corriente).'
  }
]

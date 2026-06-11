import { planillaEnFecha } from './cajaDashboardData'
import { mismoCajaSlug } from './cajaRepository'
import { fondoFijoEfectivo } from './fondoCaja'
import { fmtArs } from './format'
import type { CajaArqueo, CajaRegistro, PlanillaCajaGuardada } from './types'

export type MontosCajaPase = {
  efectivo: number
  otros: number
  hintEfectivo: string
  hintOtros: string
}

export function mediosElectronicosDesdePlanilla(planilla: PlanillaCajaGuardada | null): number {
  if (!planilla?.totales) return 0
  const t = planilla.totales
  return (
    (Number(t.ingresos_tarjetas) || 0) +
    (Number(t.ingresos_trans_b) || 0) +
    (Number(t.ingresos_cta_cte) || 0)
  )
}

export function montosCajaDesdeFuentes(
  caja: CajaRegistro | undefined,
  arqueo: CajaArqueo | null,
  planilla: PlanillaCajaGuardada | null,
  fecha: string
): MontosCajaPase {
  const nombre = caja?.nombre ?? 'Caja'
  const otrosPlanilla = mediosElectronicosDesdePlanilla(planilla)

  if (arqueo) {
    const dia =
      arqueo.fecha === fecha
        ? 'arqueo de hoy'
        : `arqueo del ${arqueo.fecha}`
    return {
      efectivo: arqueo.total,
      otros: otrosPlanilla,
      hintEfectivo: `Desde ${dia}: $ ${fmtArs(arqueo.total)}`,
      hintOtros: planilla
        ? `Tarjetas/MP desde planilla del día: $ ${fmtArs(otrosPlanilla)}`
        : 'Sin planilla del día para tarjetas — $ 0'
    }
  }

  if (planilla) {
    const ef = Number(planilla.totales?.ingresos_efectivo) || 0
    return {
      efectivo: ef,
      otros: otrosPlanilla,
      hintEfectivo: `Sin arqueo — efectivo neto planilla: $ ${fmtArs(ef)}`,
      hintOtros: `Desde planilla del día: $ ${fmtArs(otrosPlanilla)}`
    }
  }

  if (caja?.slug === 'admin') {
    return {
      efectivo: 0,
      otros: 0,
      hintEfectivo: `${nombre}: sin arqueo físico habitual`,
      hintOtros: 'Tarjetas/otros en administración: $ 0'
    }
  }

  return {
    efectivo: 0,
    otros: 0,
    hintEfectivo: `Sin arqueo ni planilla para ${nombre} en esta fecha`,
    hintOtros: 'Ingresá tarjetas/otros si corresponde'
  }
}

export function sugerirMontoPase(opts: {
  origen: CajaRegistro | undefined
  destino: CajaRegistro | undefined
  origenEf: number
  origenOt: number
}): { efectivo: number; otros: number; hint: string } {
  const { origen, destino, origenEf, origenOt } = opts
  if (!origen || !destino || origen.slug === destino.slug) {
    return { efectivo: 0, otros: 0, hint: '' }
  }

  const fondo = fondoFijoEfectivo(origen)

  if (destino.slug === 'admin' && origen.slug !== 'admin') {
    const ef = Math.max(0, Math.round((origenEf - fondo) * 100) / 100)
    return {
      efectivo: ef,
      otros: 0,
      hint:
        ef > 0
          ? `Sugerido: excedente de efectivo ($ ${fmtArs(origenEf)} − fondo $ ${fmtArs(fondo)}) hacia administración`
          : `Sin excedente de efectivo sobre el fondo ($ ${fmtArs(fondo)})`
    }
  }

  if (
    origen.slug !== 'admin' &&
    destino.slug !== 'admin' &&
    destino.slug !== 'vuelto'
  ) {
    return {
      efectivo: fondo,
      otros: 0,
      hint: `Sugerido: traspaso del fondo ($ ${fmtArs(fondo)}) entre cajas operativas`
    }
  }

  if (origenEf > 0) {
    return {
      efectivo: origenEf,
      otros: origenOt > 0 ? origenOt : 0,
      hint: 'Sugerido desde montos en caja origen'
    }
  }

  return { efectivo: 0, otros: 0, hint: 'Completá el monto del pase manualmente' }
}

export function buscarPlanillaCaja(
  planillas: PlanillaCajaGuardada[],
  cajaSlug: string,
  fecha: string,
  cajaNombre?: string
): PlanillaCajaGuardada | null {
  const slugNorm = cajaSlug.toLowerCase()
  const nombreNorm = cajaNombre?.toLowerCase() ?? ''
  const match = planillas.filter((p) => {
    if (!planillaEnFecha(p, fecha)) return false
    if (p.caja_slug && mismoCajaSlug(p.caja_slug, cajaSlug)) return true
    const pn = p.caja_nombre?.toLowerCase() ?? ''
    if (nombreNorm && pn.includes(nombreNorm)) return true
    if (pn.includes(slugNorm)) return true
    return false
  })
  if (!match.length) return null
  return [...match].sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))[0]
}

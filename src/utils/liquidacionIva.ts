/**
 * Liquidación mensual de IVA: débito fiscal, crédito fiscal, saldo técnico y
 * saldo de libre disponibilidad (retenciones y percepciones sufridas).
 */

export type PeriodoYYYYMM = string

export type FacturaIvaPeriodo = {
  tipo_comprobante?: string | null
  letra?: string | null
  iva?: number | string | null
  percepcion_iva?: number | string | null
}

export type TotalesIvaPeriodo = {
  debitoFiscal: number
  creditoFiscal: number
  /** Percepciones de IVA incluidas en facturas de compra. */
  percepcionesEnCompras: number
  comprobantesVentas: number
  comprobantesCompras: number
}

export type EntradaLiquidacionIva = {
  debitoFiscal: number
  creditoFiscal: number
  saldoTecnicoAnterior: number
  saldoLibreDispAnterior: number
  retencionesSufridas: number
  percepcionesSufridas: number
}

export type ResultadoLiquidacionIva = EntradaLiquidacionIva & {
  /** Débito − crédito − saldo técnico a favor anterior (puede ser negativo). */
  saldoPeriodo: number
  saldoTecnicoResultante: number
  saldoLibreDispResultante: number
  saldoAPagar: number
}

function num(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

function normalizar(s: unknown): string {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

/** +1 para facturas y notas de débito, −1 para notas de crédito. */
export function signoComprobante(tipo: unknown): 1 | -1 {
  return normalizar(tipo).startsWith('nota de credito') ? -1 : 1
}

export function totalesIvaPeriodo(
  ventas: FacturaIvaPeriodo[],
  compras: FacturaIvaPeriodo[]
): TotalesIvaPeriodo {
  let debito = 0
  let credito = 0
  let percepciones = 0

  for (const f of ventas) {
    debito += signoComprobante(f.tipo_comprobante) * Math.abs(num(f.iva))
  }
  for (const f of compras) {
    const signo = signoComprobante(f.tipo_comprobante)
    // Solo las facturas A dan crédito fiscal computable.
    if (String(f.letra || '').toUpperCase() === 'A') {
      credito += signo * Math.abs(num(f.iva))
    }
    percepciones += signo * Math.abs(num(f.percepcion_iva))
  }

  return {
    debitoFiscal: round2(debito),
    creditoFiscal: round2(credito),
    percepcionesEnCompras: round2(percepciones),
    comprobantesVentas: ventas.length,
    comprobantesCompras: compras.length
  }
}

export function calcularLiquidacionIva(e: EntradaLiquidacionIva): ResultadoLiquidacionIva {
  const saldoPeriodo = round2(e.debitoFiscal - e.creditoFiscal - e.saldoTecnicoAnterior)
  const pagosACuenta = round2(e.retencionesSufridas + e.percepcionesSufridas + e.saldoLibreDispAnterior)

  if (saldoPeriodo > 0) {
    return {
      ...e,
      saldoPeriodo,
      saldoTecnicoResultante: 0,
      saldoAPagar: round2(Math.max(0, saldoPeriodo - pagosACuenta)),
      saldoLibreDispResultante: round2(Math.max(0, pagosACuenta - saldoPeriodo))
    }
  }

  return {
    ...e,
    saldoPeriodo,
    saldoTecnicoResultante: round2(-saldoPeriodo),
    saldoAPagar: 0,
    saldoLibreDispResultante: pagosACuenta
  }
}

export function periodoDeFecha(fecha: string | Date): PeriodoYYYYMM {
  if (fecha instanceof Date) {
    return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`
  }
  return String(fecha).slice(0, 7)
}

export function periodoAnterior(periodo: PeriodoYYYYMM): PeriodoYYYYMM {
  const [y, m] = periodo.split('-').map(Number)
  const d = new Date(y, m - 2, 1)
  return periodoDeFecha(d)
}

export function periodoSiguiente(periodo: PeriodoYYYYMM): PeriodoYYYYMM {
  const [y, m] = periodo.split('-').map(Number)
  return periodoDeFecha(new Date(y, m, 1))
}

/** Primer y último día del mes en formato YYYY-MM-DD. */
export function rangoPeriodo(periodo: PeriodoYYYYMM): { desde: string; hasta: string } {
  const [y, m] = periodo.split('-').map(Number)
  const ultimo = new Date(y, m, 0).getDate()
  const mm = String(m).padStart(2, '0')
  return { desde: `${y}-${mm}-01`, hasta: `${y}-${mm}-${String(ultimo).padStart(2, '0')}` }
}

export function esPeriodoValido(periodo: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(periodo)
}

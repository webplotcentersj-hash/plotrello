/**
 * Ajuste por inflación simplificado (RT 6): reexpresa los movimientos de cuentas no monetarias
 * al índice del cierre y propone un asiento de ajuste contra una cuenta de resultado (RECPAM).
 *
 * Es una aproximación para trabajo interno: el saldo previo al inicio del ejercicio se toma ya
 * reexpresado al índice del mes de inicio. Revisar con el contador antes de contabilizar.
 */

export type IndicesInflacion = Record<string, number>

export type MovimientoMensual = {
  /** Mes del movimiento, YYYY-MM. */
  periodo: string
  /** Debe − haber del mes. */
  neto: number
}

export type AjusteCuenta = {
  saldoHistorico: number
  saldoAjustado: number
  /** Positivo: aumenta el saldo deudor (va al debe). Negativo: va al haber. */
  ajuste: number
  periodosSinIndice: string[]
}

export type LineaAsientoAjuste = { id_cuenta: number; debe: number; haber: number; concepto: string }

function r2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

export function calcularAjusteCuenta(
  movimientos: MovimientoMensual[],
  indices: IndicesInflacion,
  periodoInicio: string,
  periodoCierre: string
): AjusteCuenta {
  const indiceCierre = indices[periodoCierre]
  const faltantes = new Set<string>()
  if (!(indiceCierre > 0)) faltantes.add(periodoCierre)

  let historico = 0
  let ajustado = 0

  for (const mov of movimientos) {
    const periodo = mov.periodo < periodoInicio ? periodoInicio : mov.periodo
    const indiceOrigen = indices[periodo]
    historico += mov.neto
    if (!(indiceOrigen > 0) || !(indiceCierre > 0)) {
      if (!(indiceOrigen > 0)) faltantes.add(periodo)
      ajustado += mov.neto
      continue
    }
    ajustado += mov.neto * (indiceCierre / indiceOrigen)
  }

  return {
    saldoHistorico: r2(historico),
    saldoAjustado: r2(ajustado),
    ajuste: r2(ajustado - historico),
    periodosSinIndice: [...faltantes].sort()
  }
}

/** Arma las líneas del asiento: una por cuenta ajustada y la contrapartida contra RECPAM. */
export function armarAsientoAjuste(
  ajustes: Array<{ id_cuenta: number; nombre: string; ajuste: number }>,
  idCuentaRecpam: number
): { detalles: LineaAsientoAjuste[]; totalDebe: number; totalHaber: number } {
  const detalles: LineaAsientoAjuste[] = []
  let totalDebe = 0
  let totalHaber = 0

  for (const a of ajustes) {
    const monto = r2(Math.abs(a.ajuste))
    if (monto <= 0) continue
    if (a.ajuste > 0) {
      detalles.push({ id_cuenta: a.id_cuenta, debe: monto, haber: 0, concepto: `Ajuste por inflación ${a.nombre}` })
      totalDebe += monto
    } else {
      detalles.push({ id_cuenta: a.id_cuenta, debe: 0, haber: monto, concepto: `Ajuste por inflación ${a.nombre}` })
      totalHaber += monto
    }
  }

  const diferencia = r2(totalDebe - totalHaber)
  if (diferencia > 0) {
    detalles.push({ id_cuenta: idCuentaRecpam, debe: 0, haber: diferencia, concepto: 'RECPAM' })
    totalHaber += diferencia
  } else if (diferencia < 0) {
    detalles.push({ id_cuenta: idCuentaRecpam, debe: -diferencia, haber: 0, concepto: 'RECPAM' })
    totalDebe += -diferencia
  }

  return { detalles, totalDebe: r2(totalDebe), totalHaber: r2(totalHaber) }
}

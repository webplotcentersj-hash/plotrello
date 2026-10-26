export type LineaModelo = {
  id_cuenta: number
  lado: 'Debe' | 'Haber'
  porcentaje: number
  concepto?: string | null
}

export type LineaAsientoDesdeModelo = {
  id_cuenta: number
  debe: number
  haber: number
  concepto: string | null
}

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

/**
 * Reparte el importe del modelo en líneas de asiento. La última línea de cada lado absorbe el redondeo
 * para que Debe y Haber cierren al centavo.
 */
export function lineasDesdeModelo(detalles: LineaModelo[], importe: number): LineaAsientoDesdeModelo[] {
  const lineas = detalles.map((d) => ({
    id_cuenta: d.id_cuenta,
    concepto: d.concepto ?? null,
    lado: d.lado,
    monto: r2((importe * d.porcentaje) / 100),
    pct: d.porcentaje
  }))

  for (const lado of ['Debe', 'Haber'] as const) {
    const delLado = lineas.filter((l) => l.lado === lado)
    if (delLado.length === 0) continue
    const objetivo = r2((importe * delLado.reduce((s, l) => s + l.pct, 0)) / 100)
    const diferencia = r2(objetivo - delLado.reduce((s, l) => s + l.monto, 0))
    delLado[delLado.length - 1].monto = r2(delLado[delLado.length - 1].monto + diferencia)
  }

  return lineas.map((l) => ({
    id_cuenta: l.id_cuenta,
    debe: l.lado === 'Debe' ? l.monto : 0,
    haber: l.lado === 'Haber' ? l.monto : 0,
    concepto: l.concepto
  }))
}

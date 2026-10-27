import * as XLSX from 'xlsx'
import type { CargaSocialDef, LiquidacionEmpleado } from './liquidacionMensual'
import { totalesLiquidacion } from './liquidacionMensual'

export function exportarLiquidacionMensualXlsx(opts: {
  filas: LiquidacionEmpleado[]
  cargas: CargaSocialDef[]
  fechaDesde: string
  fechaHasta: string
  periodoLabel: string
}): void {
  const { filas, cargas, fechaDesde, fechaHasta, periodoLabel } = opts
  const tot = totalesLiquidacion(filas)

  const resumen = filas.map((f) => {
    const row: Record<string, string | number> = {
      Empleado: f.nombre,
      'Fecha ingreso': f.fechaIngreso || '',
      Antigüedad: f.antiguedadLabel,
      'Años antigüedad': f.antiguedadAnios,
      'Antigüedad legal %': f.pctAntiguedadLegal,
      'Antigüedad plena $': f.adicionalAntiguedadCompleto,
      'Antigüedad proporcional $': f.adicionalAntiguedad,
      'Días laborables período': f.diasLaborablesPeriodo,
      'Factor proporcional': f.factorProporcional,
      Novedades: f.novedades.length,
      'Días c/ marca': f.diasConEntrada,
      'Días exigibles': f.diasExigibles,
      'Puntualidad %': f.diasConEntrada ? f.puntualidadPct : '',
      Tardanzas: f.tardanzas,
      'Minutos tarde': f.minutosTarde,
      Ausencias: f.ausencias,
      Justificados: f.diasJustificados,
      'Sin marca': f.sinMarca,
      Horas: f.totalHoras,
      Extra: f.totalHorasExtra,
      Faltas: f.faltas,
      'Días que debía': f.diasDebia,
      'Días que vino': f.diasVino,
      Domingos: f.domingos,
      'Domingos que vino': f.domingosVino,
      'Hs domingo (doble)': f.horasDomingo,
      'Domingo $': f.importeDomingo,
      Feriados: f.feriados,
      'Feriados que vino': f.feriadosVino,
      'Hs feriado (doble)': f.horasFeriado,
      'Feriado $': f.importeFeriado,
      'Días que no trabaja': f.diasNoTrabaja,
      'Vino un día libre': f.noTrabajaVino,
      Permisos: f.permisos.length,
      'HE 50% (hs)': f.extra50,
      'HE 100% (hs)': f.extra100,
      'Precio hora': f.precioHora,
      'Sueldo base': f.sueldoBase,
      'Sueldo sin declarar': f.sueldoSinDeclarar,
      Ventas: f.ventas,
      Facturado: f.plataVendida,
      'OPs que movió': f.opsMovidas,
      Trabajos: f.trabajos,
      'Horas extra 50% $': f.importeExtra50,
      'Horas extra 100% $': f.importeExtra100,
      'Descuento faltas': f.descuentoFaltas,
      'Descuento tardanzas': f.descuentoTardanzas
    }
    for (const c of f.aportes) row[`Aporte ${c.nombre} (${c.porcentaje}%)`] = c.importe
    for (const c of f.contribuciones) row[`Contribución ${c.nombre} (${c.porcentaje}%)`] = c.importe
    row['Total aportes'] = f.totalAportes
    row['Total contribuciones'] = f.totalContribuciones
    row['Neto a pagar'] = f.neto
    row['Costo empresa'] = f.costoEmpresa
    return row
  })
  if (filas.length) {
    const primera = filas[0]
    const totalRow: Record<string, string | number> = {
      Empleado: 'TOTAL',
      'Fecha ingreso': '',
      Antigüedad: '',
      'Años antigüedad': '',
      'Antigüedad legal %': '',
      'Antigüedad plena $': filas.reduce((a, f) => a + f.adicionalAntiguedadCompleto, 0),
      'Antigüedad proporcional $': filas.reduce((a, f) => a + f.adicionalAntiguedad, 0),
      'Días laborables período': filas.reduce((a, f) => a + f.diasLaborablesPeriodo, 0),
      'Factor proporcional': '',
      Novedades: filas.reduce((a, f) => a + f.novedades.length, 0),
      'Días c/ marca': tot.diasConEntrada,
      'Días exigibles': tot.diasExigibles,
      'Puntualidad %': tot.puntualidadPromedio || '',
      Tardanzas: tot.tardanzas,
      'Minutos tarde': filas.reduce((a, f) => a + f.minutosTarde, 0),
      Ausencias: tot.ausencias,
      Justificados: tot.justificados,
      'Sin marca': tot.sinMarca,
      Horas: tot.totalHoras,
      Extra: tot.totalHorasExtra,
      Faltas: tot.faltas,
      'Días que debía': filas.reduce((a, f) => a + f.diasDebia, 0),
      'Días que vino': filas.reduce((a, f) => a + f.diasVino, 0),
      Domingos: filas.reduce((a, f) => a + f.domingos, 0),
      'Domingos que vino': filas.reduce((a, f) => a + f.domingosVino, 0),
      'Hs domingo (doble)': filas.reduce((a, f) => a + f.horasDomingo, 0),
      'Domingo $': filas.reduce((a, f) => a + f.importeDomingo, 0),
      Feriados: filas.reduce((a, f) => a + f.feriados, 0),
      'Feriados que vino': filas.reduce((a, f) => a + f.feriadosVino, 0),
      'Hs feriado (doble)': filas.reduce((a, f) => a + f.horasFeriado, 0),
      'Feriado $': filas.reduce((a, f) => a + f.importeFeriado, 0),
      'Días que no trabaja': filas.reduce((a, f) => a + f.diasNoTrabaja, 0),
      'Vino un día libre': filas.reduce((a, f) => a + f.noTrabajaVino, 0),
      Permisos: tot.permisos,
      'HE 50% (hs)': tot.extra50,
      'HE 100% (hs)': tot.extra100,
      'Precio hora': '',
      'Sueldo base': filas.reduce((a, f) => a + f.sueldoBase, 0),
      'Sueldo sin declarar': filas.reduce((a, f) => a + f.sueldoSinDeclarar, 0),
      Ventas: filas.reduce((a, f) => a + f.ventas, 0),
      Facturado: filas.reduce((a, f) => a + f.plataVendida, 0),
      'OPs que movió': filas.reduce((a, f) => a + f.opsMovidas, 0),
      Trabajos: filas.reduce((a, f) => a + f.trabajos, 0),
      'Horas extra 50% $': filas.reduce((a, f) => a + f.importeExtra50, 0),
      'Horas extra 100% $': filas.reduce((a, f) => a + f.importeExtra100, 0),
      'Descuento faltas': filas.reduce((a, f) => a + f.descuentoFaltas, 0),
      'Descuento tardanzas': filas.reduce((a, f) => a + f.descuentoTardanzas, 0)
    }
    for (const c of primera.aportes) {
      totalRow[`Aporte ${c.nombre} (${c.porcentaje}%)`] = filas.reduce(
        (a, f) => a + (f.aportes.find((x) => x.id === c.id)?.importe ?? 0),
        0
      )
    }
    for (const c of primera.contribuciones) {
      totalRow[`Contribución ${c.nombre} (${c.porcentaje}%)`] = filas.reduce(
        (a, f) => a + (f.contribuciones.find((x) => x.id === c.id)?.importe ?? 0),
        0
      )
    }
    totalRow['Total aportes'] = tot.aportes
    totalRow['Total contribuciones'] = tot.contribuciones
    totalRow['Neto a pagar'] = tot.neto
    totalRow['Costo empresa'] = tot.costoEmpresa
    resumen.push(totalRow)
  }

  const novedades = filas.flatMap((f) =>
    f.novedades.map((n) => ({
      Empleado: f.nombre,
      Desde: n.desde,
      Hasta: n.hasta,
      Grupo: n.grupo,
      Novedad: n.etiqueta,
      Detalle: n.detalle
    }))
  )

  const permisos = filas.flatMap((f) =>
    f.permisos.map((p) => ({
      Empleado: f.nombre,
      Tipo: p.tipo,
      Título: p.titulo,
      Desde: p.desde,
      Hasta: p.hasta,
      Días: p.dias ?? '',
      Detalle: p.detalle || ''
    }))
  )

  const faltasRows = filas.flatMap((f) =>
    f.fechasFaltas.map((fecha) => ({
      Empleado: f.nombre,
      Fecha: fecha,
      Descuento: f.faltas > 0 ? Math.round((f.descuentoFaltas / f.faltas) * 100) / 100 : 0
    }))
  )

  const cargasRows = cargas.map((c) => ({
    Concepto: c.nombre,
    Tipo: c.lado === 'aporte' ? 'Aporte del trabajador' : 'Contribución patronal',
    'Alícuota %': c.porcentaje,
    Base: 'Sueldo base'
  }))

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(resumen.length ? resumen : [{ Empleado: 'Sin empleados' }])
  ws['!cols'] = Object.keys(resumen[0] || { Empleado: '' }).map((k) => ({
    wch: Math.min(36, Math.max(14, k.length + 2))
  }))
  XLSX.utils.book_append_sheet(wb, ws, 'Liquidación')
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(novedades.length ? novedades : [{ Empleado: 'Sin novedades' }]),
    'Novedades'
  )
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(permisos.length ? permisos : [{ Empleado: 'Sin permisos' }]),
    'Permisos'
  )
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(faltasRows.length ? faltasRows : [{ Empleado: 'Sin faltas' }]),
    'Faltas'
  )
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(cargasRows), 'Cargas sociales')
  wb.Props = { Title: `Liquidación ${periodoLabel}` }
  XLSX.writeFile(wb, `liquidacion-${fechaDesde}_${fechaHasta}.xlsx`)
}

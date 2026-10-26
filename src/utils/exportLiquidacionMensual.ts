import { jsPDF } from 'jspdf'
import * as XLSX from 'xlsx'
import type { CargaSocialDef, LiquidacionEmpleado } from './liquidacionMensual'
import { totalesLiquidacion } from './liquidacionMensual'

function pesos(n: number): string {
  return n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fechaCorta(iso: string): string {
  if (!iso) return '—'
  const [y, m, d] = iso.slice(0, 10).split('-')
  if (!y || !m || !d) return iso
  return `${d}/${m}/${y}`
}

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
      Novedades: f.novedades.length,
      Tardanzas: f.tardanzas,
      'Minutos tarde': f.minutosTarde,
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
      'Días justificados': f.diasJustificados,
      Permisos: f.permisos.length,
      'HE 50% (hs)': f.extra50,
      'HE 100% (hs)': f.extra100,
      'Precio hora': f.precioHora,
      'Sueldo base': f.sueldoBase,
      'Sueldo en blanco': f.sueldoBlanco,
      'Sueldo sin declarar': f.sueldoSinDeclarar,
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
      Novedades: filas.reduce((a, f) => a + f.novedades.length, 0),
      Tardanzas: tot.tardanzas,
      'Minutos tarde': filas.reduce((a, f) => a + f.minutosTarde, 0),
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
      'Días justificados': filas.reduce((a, f) => a + f.diasJustificados, 0),
      Permisos: tot.permisos,
      'HE 50% (hs)': tot.extra50,
      'HE 100% (hs)': tot.extra100,
      'Precio hora': '',
      'Sueldo base': filas.reduce((a, f) => a + f.sueldoBase, 0),
      'Sueldo en blanco': filas.reduce((a, f) => a + f.sueldoBlanco, 0),
      'Sueldo sin declarar': filas.reduce((a, f) => a + f.sueldoSinDeclarar, 0),
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
      Días: p.dias ?? ''
    }))
  )

  const cargasRows = cargas.map((c) => ({
    Concepto: c.nombre,
    Tipo: c.lado === 'aporte' ? 'Aporte del trabajador' : 'Contribución patronal',
    'Alícuota %': c.porcentaje,
    'Base': 'Sueldo en blanco'
  }))

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(resumen.length ? resumen : [{ Empleado: 'Sin empleados' }])
  ws['!cols'] = Object.keys(resumen[0] || { Empleado: '' }).map((k) => ({ wch: Math.min(36, Math.max(14, k.length + 2)) }))
  XLSX.utils.book_append_sheet(wb, ws, 'Liquidación')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(novedades.length ? novedades : [{ Empleado: 'Sin novedades' }]), 'Novedades')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(permisos.length ? permisos : [{ Empleado: 'Sin permisos' }]), 'Permisos')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(cargasRows), 'Cargas sociales')
  wb.Props = { Title: `Liquidación ${periodoLabel}` }
  XLSX.writeFile(wb, `liquidacion-${fechaDesde}_${fechaHasta}.xlsx`)
}

export function exportarLiquidacionMensualPdf(opts: {
  filas: LiquidacionEmpleado[]
  fechaDesde: string
  fechaHasta: string
  periodoLabel: string
}): void {
  const { filas, periodoLabel } = opts
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const tot = totalesLiquidacion(filas)
  const margen = 14
  const ancho = 182
  let y = 16

  const salto = (alto: number) => {
    if (y + alto > 284) {
      doc.addPage()
      y = 16
    }
  }

  const titulo = (texto: string, size = 12) => {
    salto(10)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(size)
    doc.setTextColor(15, 23, 42)
    doc.text(texto, margen, y)
    y += size === 12 ? 7 : 6
  }

  const parrafo = (texto: string, size = 9) => {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(size)
    doc.setTextColor(30, 41, 59)
    const lines = doc.splitTextToSize(texto, ancho) as string[]
    salto(lines.length * 4.2 + 1)
    doc.text(lines, margen, y)
    y += lines.length * 4.2 + 1
  }

  const fila = (label: string, valor: string, fuerte = false) => {
    salto(5.2)
    doc.setFont('helvetica', fuerte ? 'bold' : 'normal')
    doc.setFontSize(9)
    doc.setTextColor(15, 23, 42)
    doc.text(label, margen, y)
    doc.text(valor, margen + ancho, y, { align: 'right' })
    y += 5
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(15, 23, 42)
  doc.text('Liquidación mensual', margen, y)
  y += 7
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(`Plot Lab · ${periodoLabel}`, margen, y)
  y += 5
  doc.setFontSize(8)
  doc.setTextColor(71, 85, 105)
  doc.text('Los aportes y las contribuciones se calculan sobre el sueldo en blanco.', margen, y)
  y += 8

  titulo('Resumen', 13)
  fila('Empleados', String(tot.empleados))
  fila('Tardanzas', String(tot.tardanzas))
  fila('Faltas', String(tot.faltas))
  fila('Permisos', String(tot.permisos))
  fila('Horas extra 50%', `${tot.extra50.toFixed(1)} hs`)
  fila('Horas extra 100%', `${tot.extra100.toFixed(1)} hs`)
  fila('Haberes', `$ ${pesos(tot.haberes)}`)
  fila('Aportes del trabajador', `$ ${pesos(tot.aportes)}`)
  fila('Contribuciones patronales', `$ ${pesos(tot.contribuciones)}`)
  fila('Neto a pagar', `$ ${pesos(tot.neto)}`, true)
  fila('Costo empresa', `$ ${pesos(tot.costoEmpresa)}`, true)
  y += 3

  for (const f of filas) {
    salto(16)
    doc.setDrawColor(203, 213, 225)
    doc.line(margen, y, margen + ancho, y)
    y += 6
    titulo(f.nombre, 12)
    parrafo(
      `Tardanzas: ${f.tardanzas} (${f.minutosTarde} min) · Faltas: ${f.faltas} · Días justificados: ${f.diasJustificados} · Permisos: ${f.permisos.length} · HE 50%: ${f.extra50.toFixed(1)} hs · HE 100%: ${f.extra100.toFixed(1)} hs`
    )

    parrafo(
      `Debía venir: ${f.diasDebia}. Vino: ${f.diasVino}. Domingos: ${f.domingos} (vino ${f.domingosVino}, ${f.horasDomingo.toFixed(1)} hs al doble). Feriados: ${f.feriados} (vino ${f.feriadosVino}, ${f.horasFeriado.toFixed(1)} hs al doble). Días que no trabaja: ${f.diasNoTrabaja} (vino ${f.noTrabajaVino}).`
    )

    titulo('Novedades')
    if (!f.novedades.length) parrafo('Sin novedades en el período.')
    for (const n of f.novedades) {
      const rango = n.desde === n.hasta ? fechaCorta(n.desde) : `${fechaCorta(n.desde)} al ${fechaCorta(n.hasta)}`
      parrafo(`${rango} · ${n.grupo} · ${n.etiqueta}${n.detalle ? ` · ${n.detalle}` : ''}`)
    }

    if (f.permisos.length) {
      titulo('Permisos')
      for (const p of f.permisos) {
        parrafo(`${fechaCorta(p.desde)} al ${fechaCorta(p.hasta)} · ${p.tipo} · ${p.titulo}${p.dias != null ? ` · ${p.dias} días` : ''}`)
      }
    }

    titulo('Haberes')
    fila('Sueldo base', `$ ${pesos(f.sueldoBase)}`)
    fila('Sueldo base en blanco', `$ ${pesos(f.sueldoBlanco)}`)
    fila('Sueldo sin declarar', `$ ${pesos(f.sueldoSinDeclarar)}`)
    fila(`Horas extra 50% (${f.extra50.toFixed(1)} hs × $${pesos(f.precioHora)} × 1,5)`, `$ ${pesos(f.importeExtra50)}`)
    fila(`Horas extra 100% (${f.extra100.toFixed(1)} hs × $${pesos(f.precioHora)} × 2)`, `$ ${pesos(f.importeExtra100)}`)
    if (f.domingosVino > 0) {
      fila(`Incluye domingo al doble (${f.horasDomingo.toFixed(1)} hs)`, `$ ${pesos(f.importeDomingo)}`)
    }
    if (f.feriadosVino > 0) {
      fila(`Incluye feriado al doble (${f.horasFeriado.toFixed(1)} hs)`, `$ ${pesos(f.importeFeriado)}`)
    }
    fila('Total haberes', `$ ${pesos(f.haberes)}`, true)
    if (f.baseDistinta) {
      parrafo('El sueldo base no coincide con en blanco + sin declarar. El neto usa en blanco + sin declarar.')
    }

    titulo('Descuentos del empleado')
    fila('Faltas (remuneración / 30 × días)', `$ ${pesos(f.descuentoFaltas)}`)
    fila('Tardanzas', `$ ${pesos(f.descuentoTardanzas)}`)
    titulo('Aportes sobre el sueldo en blanco')
    for (const c of f.aportes) fila(`${c.nombre} (${c.porcentaje}%)`, `$ ${pesos(c.importe)}`)
    fila('Total aportes', `$ ${pesos(f.totalAportes)}`, true)

    titulo('Cargas sociales del empleador')
    for (const c of f.contribuciones) fila(`${c.nombre} (${c.porcentaje}%)`, `$ ${pesos(c.importe)}`)
    fila('Total contribuciones', `$ ${pesos(f.totalContribuciones)}`, true)

    y += 1
    fila('Neto a pagar', `$ ${pesos(f.neto)}`, true)
    fila('Costo empresa', `$ ${pesos(f.costoEmpresa)}`, true)
    y += 4
  }

  doc.save(`liquidacion-${opts.fechaDesde}_${opts.fechaHasta}.pdf`)
}

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

const C = {
  ink: [15, 23, 42] as [number, number, number],
  muted: [71, 85, 105] as [number, number, number],
  soft: [148, 163, 184] as [number, number, number],
  line: [226, 232, 240] as [number, number, number],
  brand: [235, 103, 27] as [number, number, number],
  blue: [37, 99, 235] as [number, number, number],
  green: [22, 163, 74] as [number, number, number],
  teal: [13, 148, 136] as [number, number, number],
  violet: [124, 58, 237] as [number, number, number],
  rose: [225, 29, 72] as [number, number, number],
  amber: [217, 119, 6] as [number, number, number],
  slateBg: [248, 250, 252] as [number, number, number],
  white: [255, 255, 255] as [number, number, number]
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
      'Fecha ingreso': f.fechaIngreso || '',
      Antigüedad: f.antiguedadLabel,
      'Años antigüedad': f.antiguedadAnios,
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
      Días: p.dias ?? ''
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
  const pageW = 210
  const margen = 14
  const ancho = pageW - margen * 2
  let y = 0

  const rgb = (c: [number, number, number]) => doc.setTextColor(c[0], c[1], c[2])
  const fill = (c: [number, number, number]) => doc.setFillColor(c[0], c[1], c[2])
  const stroke = (c: [number, number, number]) => doc.setDrawColor(c[0], c[1], c[2])

  const ensure = (alto: number) => {
    if (y + alto <= 285) return
    doc.addPage()
    y = 16
  }

  const barraHeader = () => {
    fill(C.ink)
    doc.rect(0, 0, pageW, 28, 'F')
    fill(C.brand)
    doc.rect(0, 28, pageW, 2.2, 'F')
    rgb(C.white)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(18)
    doc.text('Liquidación mensual', margen, 13)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    rgb([226, 232, 240])
    doc.text(`Plot Lab · ${periodoLabel}`, margen, 21)
    y = 38
  }

  const seccion = (texto: string, color: [number, number, number] = C.blue) => {
    ensure(14)
    y += 4
    fill(color)
    doc.roundedRect(margen, y - 4.5, 2.2, 7, 0.6, 0.6, 'F')
    rgb(C.ink)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.text(texto, margen + 6, y)
    y += 8
  }

  const fila = (label: string, valor: string, opts?: { fuerte?: boolean; colorValor?: [number, number, number] }) => {
    ensure(6.5)
    doc.setFont('helvetica', opts?.fuerte ? 'bold' : 'normal')
    doc.setFontSize(9.5)
    rgb(C.muted)
    doc.text(label, margen + 2, y)
    rgb(opts?.colorValor || C.ink)
    doc.setFont('helvetica', opts?.fuerte ? 'bold' : 'normal')
    doc.text(valor, margen + ancho - 2, y, { align: 'right' })
    y += 6
  }

  const cardMetricas = (
    items: Array<{ label: string; value: string; color: [number, number, number] }>
  ) => {
    ensure(28)
    const gap = 3.5
    const w = (ancho - gap * (items.length - 1)) / items.length
    items.forEach((item, i) => {
      const x = margen + i * (w + gap)
      fill(C.slateBg)
      stroke(C.line)
      doc.setLineWidth(0.3)
      doc.roundedRect(x, y, w, 22, 2, 2, 'FD')
      fill(item.color)
      doc.rect(x, y, w, 2.2, 'F')
      rgb(C.soft)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7.5)
      doc.text(item.label.toUpperCase(), x + 3, y + 8)
      rgb(C.ink)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      const lines = doc.splitTextToSize(item.value, w - 6) as string[]
      doc.text(lines[0] || item.value, x + 3, y + 15)
    })
    y += 28
  }

  const barrasHorizontales = (
    titulo: string,
    data: Array<{ nombre: string; valor: number }>,
    color: [number, number, number]
  ) => {
    const top = [...data].sort((a, b) => b.valor - a.valor).filter((d) => d.valor > 0).slice(0, 6)
    if (!top.length) return
    const max = Math.max(...top.map((d) => d.valor), 1)
    seccion(titulo, color)
    const barMaxW = ancho - 62
    for (const d of top) {
      ensure(9)
      const nombre = d.nombre.length > 22 ? `${d.nombre.slice(0, 20)}…` : d.nombre
      rgb(C.ink)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.text(nombre, margen, y + 3.2)
      fill([241, 245, 249])
      doc.roundedRect(margen + 48, y, barMaxW, 5.5, 1.2, 1.2, 'F')
      const w = Math.max(3, (d.valor / max) * barMaxW)
      fill(color)
      doc.roundedRect(margen + 48, y, w, 5.5, 1.2, 1.2, 'F')
      rgb(C.muted)
      doc.setFontSize(7.5)
      doc.text(`$ ${pesos(d.valor)}`, margen + ancho, y + 3.8, { align: 'right' })
      y += 8.5
    }
    y += 2
  }

  barraHeader()

  cardMetricas([
    { label: 'Empleados', value: String(tot.empleados), color: C.blue },
    { label: 'Neto a pagar', value: `$ ${pesos(tot.neto)}`, color: C.green },
    { label: 'Costo empresa', value: `$ ${pesos(tot.costoEmpresa)}`, color: C.brand },
    { label: 'Haberes', value: `$ ${pesos(tot.haberes)}`, color: C.teal }
  ])

  seccion('Indicadores del período', C.violet)
  fill(C.slateBg)
  stroke(C.line)
  doc.setLineWidth(0.25)
  doc.roundedRect(margen, y, ancho, 38, 2.5, 2.5, 'FD')
  const boxY = y + 8
  const colW = ancho / 3
  const indicadores: Array<[string, string]> = [
    ['Tardanzas', String(tot.tardanzas)],
    ['Faltas', String(tot.faltas)],
    ['Permisos', String(tot.permisos)],
    ['HE 50%', `${tot.extra50.toFixed(1)} hs`],
    ['HE 100%', `${tot.extra100.toFixed(1)} hs`],
    ['Aportes', `$ ${pesos(tot.aportes)}`]
  ]
  indicadores.forEach(([lab, val], i) => {
    const col = i % 3
    const row = Math.floor(i / 3)
    const x = margen + col * colW + 4
    const yy = boxY + row * 14
    rgb(C.soft)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.text(lab.toUpperCase(), x, yy)
    rgb(C.ink)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text(val, x, yy + 6)
  })
  y += 44

  barrasHorizontales(
    'Top facturado',
    filas.map((f) => ({ nombre: f.nombre, valor: f.plataVendida })),
    C.brand
  )
  barrasHorizontales(
    'Top neto a pagar',
    filas.map((f) => ({ nombre: f.nombre, valor: f.neto })),
    C.green
  )

  rgb(C.muted)
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(8)
  ensure(8)
  doc.text('Los aportes y contribuciones se calculan sobre el sueldo base.', margen, y)
  y += 10

  for (const f of filas) {
    ensure(42)
    y += 3
    fill(C.slateBg)
    stroke(C.line)
    doc.setLineWidth(0.3)
    doc.roundedRect(margen, y, ancho, 12, 2, 2, 'FD')
    fill(C.brand)
    doc.roundedRect(margen, y, 3, 12, 1, 1, 'F')
    rgb(C.ink)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.text(f.nombre, margen + 7, y + 8)
    y += 18

    rgb(C.muted)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    const antigTxt = f.fechaIngreso
      ? `Antigüedad: ${f.antiguedadLabel} (ingreso ${fechaCorta(f.fechaIngreso)}).`
      : 'Antigüedad: sin fecha de ingreso en el legajo.'
    ensure(6)
    doc.text(antigTxt, margen + 2, y)
    y += 6
    const resumenEmp = doc.splitTextToSize(
      `Tardanzas ${f.tardanzas} (${f.minutosTarde} min) · Faltas ${f.faltas} · Justificados ${f.diasJustificados} · Permisos ${f.permisos.length} · HE 50% ${f.extra50.toFixed(1)} hs · HE 100% ${f.extra100.toFixed(1)} hs`,
      ancho - 4
    ) as string[]
    ensure(resumenEmp.length * 4.5 + 2)
    doc.text(resumenEmp, margen + 2, y)
    y += resumenEmp.length * 4.5 + 4

    const diasTxt = doc.splitTextToSize(
      `Debía ${f.diasDebia} · Vino ${f.diasVino} · Domingos ${f.domingos} (vino ${f.domingosVino}, ${f.horasDomingo.toFixed(1)} hs ×2) · Feriados ${f.feriados} (vino ${f.feriadosVino}, ${f.horasFeriado.toFixed(1)} hs ×2) · No trabaja ${f.diasNoTrabaja} (vino ${f.noTrabajaVino})`,
      ancho - 4
    ) as string[]
    ensure(diasTxt.length * 4.5 + 4)
    doc.text(diasTxt, margen + 2, y)
    y += diasTxt.length * 4.5 + 6

    seccion('Novedades', C.amber)
    if (!f.novedades.length) {
      rgb(C.soft)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      ensure(6)
      doc.text('Sin novedades en el período.', margen + 2, y)
      y += 7
    } else {
      for (const n of f.novedades) {
        const rango = n.desde === n.hasta ? fechaCorta(n.desde) : `${fechaCorta(n.desde)} al ${fechaCorta(n.hasta)}`
        const line = `${rango} · ${n.grupo} · ${n.etiqueta}${n.detalle ? ` · ${n.detalle}` : ''}`
        const lines = doc.splitTextToSize(line, ancho - 6) as string[]
        ensure(lines.length * 4.4 + 2)
        rgb(C.ink)
        doc.setFontSize(8.5)
        doc.text(lines, margen + 2, y)
        y += lines.length * 4.4 + 2
      }
      y += 2
    }

    if (f.permisos.length) {
      seccion('Permisos', C.violet)
      for (const p of f.permisos) {
        const line = `${fechaCorta(p.desde)} al ${fechaCorta(p.hasta)} · ${p.tipo} · ${p.titulo}${p.dias != null ? ` · ${p.dias} días` : ''}`
        const lines = doc.splitTextToSize(line, ancho - 6) as string[]
        ensure(lines.length * 4.4 + 2)
        rgb(C.ink)
        doc.setFontSize(8.5)
        doc.text(lines, margen + 2, y)
        y += lines.length * 4.4 + 2
      }
      y += 2
    }

    seccion('Haberes', C.teal)
    fila('Sueldo base', `$ ${pesos(f.sueldoBase)}`)
    fila('Sueldo sin declarar', `$ ${pesos(f.sueldoSinDeclarar)}`)
    fila('Ventas', String(f.ventas))
    fila('Facturado', `$ ${pesos(f.plataVendida)}`, { colorValor: C.brand })
    fila('OPs que movió', String(f.opsMovidas))
    fila('Trabajos en el tablero', String(f.trabajos))
    fila(
      `Horas extra 50% (${f.extra50.toFixed(1)} hs × $${pesos(f.precioHora)} × 1,5)`,
      `$ ${pesos(f.importeExtra50)}`
    )
    fila(
      `Horas extra 100% (${f.extra100.toFixed(1)} hs × $${pesos(f.precioHora)} × 2)`,
      `$ ${pesos(f.importeExtra100)}`
    )
    if (f.domingosVino > 0) {
      fila(`Incluye domingo al doble (${f.horasDomingo.toFixed(1)} hs)`, `$ ${pesos(f.importeDomingo)}`)
    }
    if (f.feriadosVino > 0) {
      fila(`Incluye feriado al doble (${f.horasFeriado.toFixed(1)} hs)`, `$ ${pesos(f.importeFeriado)}`)
    }
    fila('Total haberes', `$ ${pesos(f.haberes)}`, { fuerte: true, colorValor: C.teal })
    y += 2

    seccion('Descuentos del empleado', C.rose)
    fila('Faltas (remuneración / 30 × días)', `$ ${pesos(f.descuentoFaltas)}`)
    fila('Tardanzas', `$ ${pesos(f.descuentoTardanzas)}`)
    y += 2

    seccion('Aportes sobre el sueldo base', C.blue)
    for (const c of f.aportes) fila(`${c.nombre} (${c.porcentaje}%)`, `$ ${pesos(c.importe)}`)
    fila('Total aportes', `$ ${pesos(f.totalAportes)}`, { fuerte: true })
    y += 2

    seccion('Cargas sociales del empleador', C.violet)
    for (const c of f.contribuciones) fila(`${c.nombre} (${c.porcentaje}%)`, `$ ${pesos(c.importe)}`)
    fila('Total contribuciones', `$ ${pesos(f.totalContribuciones)}`, { fuerte: true })
    y += 3

    ensure(18)
    fill([236, 253, 245])
    stroke([167, 243, 208])
    doc.roundedRect(margen, y, ancho, 14, 2, 2, 'FD')
    rgb(C.green)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text('Neto a pagar', margen + 4, y + 9)
    doc.text(`$ ${pesos(f.neto)}`, margen + ancho - 4, y + 9, { align: 'right' })
    y += 18

    ensure(14)
    fill([255, 247, 237])
    stroke([253, 186, 116])
    doc.roundedRect(margen, y, ancho, 12, 2, 2, 'FD')
    rgb(C.brand)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9.5)
    doc.text('Costo empresa', margen + 4, y + 8)
    doc.text(`$ ${pesos(f.costoEmpresa)}`, margen + ancho - 4, y + 8, { align: 'right' })
    y += 18
  }

  const pages = doc.getNumberOfPages()
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p)
    rgb(C.soft)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.text(`Plot Lab · Liquidación ${periodoLabel}`, margen, 292)
    doc.text(`${p} / ${pages}`, pageW - margen, 292, { align: 'right' })
  }

  doc.save(`liquidacion-${opts.fechaDesde}_${opts.fechaHasta}.pdf`)
}

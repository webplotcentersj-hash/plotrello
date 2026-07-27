import jsPDF from 'jspdf'
import type { ResumenAdminHoy } from './cajaDashboardData'
import {
  conciliacionAutomaticaDia,
  esIngresoMercadoPago,
  fondosReservaDesdeArqueosDia,
  labelEstadoConciliacion,
  mediosIngresosDia,
  movimientosDelDia
} from './conciliacionDiaCaja'
import { fondoParaOtraCajaDesdeArqueo } from './cierreTurno'
import { fmtArs, fmtDateAr, montoCobradoCaja, montoCuentaCorriente, montoVisibleMovimiento } from './format'
import {
  cajaNombreFromSlug,
  labelOrigenImportacion,
  montoIngresoHeroDia,
  parseRefPlotLab,
  subtituloIngresoDia,
  tituloIngresoDia
} from './movimientoDetalle'
import type {
  CajaArqueo,
  CajaConcilBanco,
  CajaConcilMP,
  CajaEgresoSolicitud,
  CajaMovimiento,
  CajaRegistro,
  CajaTransferenciaLote,
  PlanillaCajaGuardada
} from './types'

function pdfText(value: string | null | undefined): string {
  if (!value) return ''
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u00b7/g, '-')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[^\x20-\x7E]/g, (ch) => {
      const map: Record<string, string> = { 'Ñ': 'N', 'ñ': 'n' }
      return map[ch] ?? ''
    })
}

function short(value: string | null | undefined, max: number): string {
  const t = pdfText(value).trim()
  if (t.length <= max) return t
  return `${t.slice(0, Math.max(0, max - 1))}…`
}

type TableCol = { header: string; width: number; align?: 'left' | 'right' }

function drawTable(
  doc: jsPDF,
  y: number,
  margin: number,
  pageBottom: number,
  cols: TableCol[],
  rows: string[][],
  opts?: { title?: string; fontSize?: number }
): number {
  const fontSize = opts?.fontSize ?? 7
  const rowH = 4.2
  const headerH = 5

  const ensure = (need: number) => {
    if (y + need > pageBottom) {
      doc.addPage()
      y = 12
      if (opts?.title) {
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(9)
        doc.text(pdfText(opts.title) + ' (cont.)', margin, y)
        y += 5
      }
      drawHeader()
    }
  }

  const drawHeader = () => {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(fontSize)
    doc.setFillColor(241, 245, 249)
    const totalW = cols.reduce((s, c) => s + c.width, 0)
    doc.rect(margin, y - 3.2, totalW, headerH, 'F')
    let x = margin
    for (const c of cols) {
      doc.text(c.header, c.align === 'right' ? x + c.width - 1 : x + 0.5, y, {
        align: c.align === 'right' ? 'right' : 'left'
      })
      x += c.width
    }
    y += headerH
    doc.setFont('helvetica', 'normal')
  }

  if (opts?.title) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.text(pdfText(opts.title), margin, y)
    y += 5
  }

  ensure(headerH + rowH * 2)
  drawHeader()

  for (const row of rows) {
    ensure(rowH + 1)
    let x = margin
    let maxLines = 1
    const cellLines: string[][] = []
    row.forEach((cell, i) => {
      const w = (cols[i]?.width ?? 20) - 1.2
      const lines = doc.splitTextToSize(pdfText(cell), Math.max(8, w)) as string[]
      cellLines.push(lines.slice(0, 2))
      maxLines = Math.max(maxLines, Math.min(2, lines.length))
    })
    const h = Math.max(rowH, maxLines * 3.2)
    if (y + h > pageBottom) {
      doc.addPage()
      y = 12
      if (opts?.title) {
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(9)
        doc.text(pdfText(opts.title) + ' (cont.)', margin, y)
        y += 5
      }
      drawHeader()
    }
    x = margin
    doc.setFontSize(fontSize)
    doc.setFont('helvetica', 'normal')
    cellLines.forEach((lines, i) => {
      const col = cols[i]
      const align = col?.align === 'right' ? 'right' : 'left'
      const tx = align === 'right' ? x + (col?.width ?? 20) - 1 : x + 0.5
      doc.text(lines, tx, y, { align })
      x += col?.width ?? 20
    })
    y += h
    doc.setDrawColor(226, 232, 240)
    doc.setLineWidth(0.1)
    doc.line(margin, y - 1.2, margin + cols.reduce((s, c) => s + c.width, 0), y - 1.2)
  }
  return y + 3
}

function montoMedio(m: CajaMovimiento, key: 'efectivo' | 'tarjeta' | 'transferencia' | 'cc' | 'mp'): number {
  if (key === 'efectivo') return Number(m.efectivo) || 0
  if (key === 'transferencia') return Number(m.transferencia_bancaria) || 0
  if (key === 'cc') return montoCuentaCorriente(m)
  const tarj = Number(m.tarjeta) || 0
  if (key === 'mp') return esIngresoMercadoPago(m) ? tarj : 0
  return esIngresoMercadoPago(m) ? 0 : tarj
}

export type InformeDiaCajaInput = {
  fecha: string
  resumen: ResumenAdminHoy
  movimientos: CajaMovimiento[]
  cajas: CajaRegistro[]
  planillas: PlanillaCajaGuardada[]
  egresos: CajaEgresoSolicitud[]
  lotes: CajaTransferenciaLote[]
  arqueos: CajaArqueo[]
  concilMp?: CajaConcilMP | null
  concilBanco?: CajaConcilBanco | null
}

/** Planilla PDF del día (apaisada): resumen, fondos, arqueos, cierres, egresos y movimientos detallados. */
export function downloadInformeDiaCajaPdf(input: InformeDiaCajaInput): void {
  const {
    fecha,
    resumen,
    movimientos,
    cajas,
    planillas,
    egresos,
    lotes,
    arqueos,
    concilMp,
    concilBanco
  } = input

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const margin = 8
  const pageBottom = 200
  let y = 12

  const movs = movimientosDelDia(movimientos, fecha).slice().sort((a, b) => {
    const ha = a.hora || ''
    const hb = b.hora || ''
    if (ha !== hb) return ha.localeCompare(hb)
    return (a.created_at || '').localeCompare(b.created_at || '')
  })
  const medios = mediosIngresosDia(movimientos, fecha)
  const concil = conciliacionAutomaticaDia({
    fecha,
    movimientos,
    planillas,
    arqueos,
    concilMp,
    concilBanco
  })
  const fondos = fondosReservaDesdeArqueosDia(arqueos, fecha, cajas)
  const totalFondos = fondos.reduce((s, f) => s + f.monto, 0)

  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('Planilla de caja — Plot Lab', margin, y)
  y += 6
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text(
    `Fecha: ${fmtDateAr(fecha)}  |  Generado: ${new Date().toLocaleString('es-AR')}  |  Movimientos: ${movs.length}`,
    margin,
    y
  )
  y += 7

  // —— Resumen ——
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('RESUMEN DEL DIA', margin, y)
  y += 4.5
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  const ingreso = montoIngresoHeroDia(resumen, medios.totalCobrado)
  doc.text(
    `${pdfText(tituloIngresoDia(resumen, false))}: $ ${fmtArs(ingreso)}   |   CC: $ ${fmtArs(medios.cuenta_corriente)}   |   Egresos: $ ${fmtArs(resumen.egresosHoy)}   |   Fondos reserva: $ ${fmtArs(totalFondos)}`,
    margin,
    y
  )
  y += 4
  doc.text(pdfText(subtituloIngresoDia(resumen)), margin, y)
  y += 4
  doc.text(
    `Desglose cobrado — Efectivo $ ${fmtArs(medios.efectivo)} | Tarjeta $ ${fmtArs(medios.tarjeta)} | MP $ ${fmtArs(medios.mercado_pago)} | Transf. $ ${fmtArs(medios.transferencia)} | Otros $ ${fmtArs(medios.otros)}`,
    margin,
    y
  )
  y += 6

  // —— Fondos reserva ——
  if (fondos.length) {
    y = drawTable(
      doc,
      y,
      margin,
      pageBottom,
      [
        { header: 'Caja (reserva)', width: 55 },
        { header: 'Monto', width: 28, align: 'right' },
        { header: 'Dejado por', width: 50 },
        { header: 'Nota', width: 90 }
      ],
      fondos.map((f) => [
        f.cajaNombre,
        `$ ${fmtArs(f.monto)}`,
        f.dejadoPor,
        'Queda en caja — no va a administracion'
      ]),
      { title: `Fondos de reserva en cajas — total $ ${fmtArs(totalFondos)}` }
    )
  }

  // —— Conciliación ——
  const concilRows = concil
    .filter((l) => !(l.estado === 'sin_mov' && l.movimientos <= 0))
    .map((l) => [
      l.label,
      `$ ${fmtArs(l.movimientos)}`,
      l.referencia != null ? `$ ${fmtArs(l.referencia)}` : '—',
      l.referenciaFuente || '—',
      labelEstadoConciliacion(l.estado),
      l.estado === 'revisar' ? `$ ${fmtArs(Math.abs(l.diferencia))}` : '—'
    ])
  if (concilRows.length) {
    y = drawTable(
      doc,
      y,
      margin,
      pageBottom,
      [
        { header: 'Medio', width: 32 },
        { header: 'Movimientos', width: 28, align: 'right' },
        { header: 'Referencia', width: 28, align: 'right' },
        { header: 'Fuente ref.', width: 40 },
        { header: 'Estado', width: 22 },
        { header: 'Diferencia', width: 26, align: 'right' }
      ],
      concilRows,
      { title: 'Conciliacion por medio' }
    )
  }

  // —— Arqueos ——
  const arqueosDia = arqueos.filter((a) => a.fecha === fecha)
  if (arqueosDia.length) {
    y = drawTable(
      doc,
      y,
      margin,
      pageBottom,
      [
        { header: 'Caja', width: 42 },
        { header: 'Turno', width: 18 },
        { header: 'Contado', width: 26, align: 'right' },
        { header: 'Objetivo', width: 26, align: 'right' },
        { header: 'Fondo dejado', width: 28, align: 'right' },
        { header: 'A admin (prev)', width: 28, align: 'right' },
        { header: 'Usuario', width: 40 }
      ],
      arqueosDia.map((a) => {
        const fondo = fondoParaOtraCajaDesdeArqueo(a)
        const s = a.saldos || {}
        const objetivo = Number(s.objetivo_efectivo ?? a.teorico_fisico) || 0
        const resto = Number(s.resto_admin_preview)
        return [
          cajaNombreFromSlug(a.caja_slug, cajas).replace(/^Caja\s+/i, ''),
          a.turno || '—',
          `$ ${fmtArs(a.total)}`,
          objetivo > 0 ? `$ ${fmtArs(objetivo)}` : '—',
          fondo ? `$ ${fmtArs(fondo.monto)}` : '$ 0',
          Number.isFinite(resto) ? `$ ${fmtArs(resto)}` : '—',
          a.usuario_nombre || '—'
        ]
      }),
      { title: `Arqueos del dia (${arqueosDia.length})` }
    )
  }

  // —— Cierres de turno ——
  const lotesDia = lotes.filter((l) => l.fecha === fecha)
  if (lotesDia.length) {
    y = drawTable(
      doc,
      y,
      margin,
      pageBottom,
      [
        { header: 'Hora', width: 14 },
        { header: 'Origen', width: 40 },
        { header: 'Fondo', width: 26, align: 'right' },
        { header: 'Destino fondo', width: 40 },
        { header: 'Resto admin', width: 28, align: 'right' },
        { header: 'Usuario', width: 40 }
      ],
      lotesDia.map((l) => [
        l.hora || '—',
        cajaNombreFromSlug(l.origen_slug, cajas).replace(/^Caja\s+/i, ''),
        `$ ${fmtArs(l.fondo_monto)}`,
        cajaNombreFromSlug(l.caja_fondo_destino_slug, cajas).replace(/^Caja\s+/i, ''),
        `$ ${fmtArs((l.resto_efectivo || 0) + (l.resto_otros || 0))}`,
        l.usuario_nombre || '—'
      ]),
      { title: `Cierres de turno (${lotesDia.length})` }
    )
  }

  // —— Egresos ——
  const egresosDia = egresos.filter((e) => e.fecha === fecha && e.estado === 'aprobado' && !!e.url_ticket)
  if (egresosDia.length) {
    y = drawTable(
      doc,
      y,
      margin,
      pageBottom,
      [
        { header: 'Concepto', width: 70 },
        { header: 'Caja', width: 36 },
        { header: 'Efectivo', width: 26, align: 'right' },
        { header: 'Otros', width: 26, align: 'right' },
        { header: 'Total', width: 26, align: 'right' },
        { header: 'Solicitante', width: 36 }
      ],
      egresosDia.map((e) => [
        short(e.concepto, 48),
        cajaNombreFromSlug(e.caja_slug, cajas).replace(/^Caja\s+/i, ''),
        `$ ${fmtArs(e.monto_efectivo || 0)}`,
        `$ ${fmtArs(e.monto_otros || 0)}`,
        `$ ${fmtArs((e.monto_efectivo || 0) + (e.monto_otros || 0))}`,
        e.solicitante_nombre || '—'
      ]),
      { title: `Egresos aprobados (${egresosDia.length})` }
    )
  }

  // —— Movimientos planilla ——
  if (!movs.length) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.text('Movimientos del dia: sin registros', margin, y)
  } else {
    y = drawTable(
      doc,
      y,
      margin,
      pageBottom,
      [
        { header: 'Hora', width: 12 },
        { header: 'Ref/Comp', width: 22 },
        { header: 'Cliente / tercero', width: 32 },
        { header: 'Caja', width: 28 },
        { header: 'Concepto', width: 36 },
        { header: 'Efec.', width: 18, align: 'right' },
        { header: 'Tarj.', width: 16, align: 'right' },
        { header: 'MP', width: 16, align: 'right' },
        { header: 'Transf.', width: 18, align: 'right' },
        { header: 'CC', width: 16, align: 'right' },
        { header: 'Total', width: 18, align: 'right' },
        { header: 'Usuario', width: 22 }
      ],
      movs.map((m) => {
        const ref = parseRefPlotLab(m) || m.comprobante || ''
        const caja =
          m.destino_slug && m.destino_slug !== 'admin'
            ? cajaNombreFromSlug(m.destino_slug, cajas)
            : cajaNombreFromSlug(m.origen_slug, cajas)
        return [
          m.hora || '—',
          short(ref, 14),
          short(m.tercero_nombre || '—', 20),
          short(caja.replace(/^Caja\s+/i, ''), 16),
          short(m.concepto || labelOrigenImportacion(m.origen_importacion), 22),
          fmtArs(montoMedio(m, 'efectivo')),
          fmtArs(montoMedio(m, 'tarjeta')),
          fmtArs(montoMedio(m, 'mp')),
          fmtArs(montoMedio(m, 'transferencia')),
          fmtArs(montoMedio(m, 'cc')),
          fmtArs(montoVisibleMovimiento(m) || montoCobradoCaja(m)),
          short(m.usuario_nombre || '—', 14)
        ]
      }),
      { title: `Detalle de movimientos (planilla) — ${movs.length} lineas` }
    )

    // Observaciones / pagó-vuelto en página aparte si hay
    const conObs = movs.filter((m) => (m.observacion || '').trim())
    if (conObs.length) {
      if (y > pageBottom - 20) {
        doc.addPage()
        y = 12
      }
      y = drawTable(
        doc,
        y,
        margin,
        pageBottom,
        [
          { header: 'Hora', width: 14 },
          { header: 'Cliente', width: 40 },
          { header: 'Observacion / traza (pago, vuelto, PlotLab…)', width: 200 }
        ],
        conObs.map((m) => [
          m.hora || '—',
          short(m.tercero_nombre || m.concepto, 28),
          short(m.observacion, 140)
        ]),
        { title: `Observaciones y trazas (${conObs.length})` }
      )
    }
  }

  // Pie
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.text(
      `Plot Lab — Planilla caja ${fmtDateAr(fecha)} — pag. ${i}/${pageCount}`,
      margin,
      205
    )
  }

  const slug = fecha.replace(/[^\w-]+/g, '_')
  doc.save(`planilla-caja-${slug}.pdf`)
}

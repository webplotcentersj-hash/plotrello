import { jsPDF } from 'jspdf'
import { toDataURL } from 'qrcode'
import type { ConfiguracionAFIPRecord, FacturaItemRecord, FacturaVentaRecord } from '../types/api'
import {
  codigoComprobanteAfip,
  conceptoLabel,
  cuitValido,
  formatFechaAr,
  letraComprobante
} from './afipFacturaUi'

function pdfText(value: string | null | undefined): string {
  if (!value) return ''
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u00b7/g, '-')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/[^\x20-\x7E]/g, (ch) => {
      const map: Record<string, string> = { Ñ: 'N', ñ: 'n' }
      return map[ch] ?? ''
    })
}

const LOGO_URL = '/factura/plot-center-pc.png'
const MARGIN = 10
const PAGE_W = 210
const PAGE_H = 297
const CONTENT_W = PAGE_W - MARGIN * 2
const AFIP_QR_BASE = 'https://www.afip.gob.ar/fe/qr/?p='

export type FacturaPdf = FacturaVentaRecord & { items?: FacturaItemRecord[] }

export type EmisorPdf = Pick<
  ConfiguracionAFIPRecord,
  'cuit' | 'razon_social' | 'domicilio_comercial' | 'condicion_iva' | 'ingresos_brutos' | 'fecha_inicio_actividades'
>

export type AfipQrPayload = {
  ver: 1
  fecha: string
  cuit: number
  ptoVta: number
  tipoCmp: number
  nroCmp: number
  importe: number
  moneda: 'PES'
  ctz: 1
  tipoDocRec: number
  nroDocRec: number
  tipoCodAut: 'E'
  codAut: number
}

function money(n: number): string {
  return `$ ${Number(n || 0).toLocaleString('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`
}

export function formatCuitPdf(raw: string | null | undefined): string {
  const d = (raw || '').replace(/\D/g, '')
  if (d.length !== 11) return (raw || '').trim()
  return `${d.slice(0, 2)}-${d.slice(2, 10)}-${d.slice(10)}`
}

export function tipoDocReceptorPdf(dniCuit: string | null | undefined): { tipoDocRec: number; nroDocRec: number } {
  const clean = (dniCuit || '').replace(/\D/g, '')
  if (cuitValido(clean)) return { tipoDocRec: 80, nroDocRec: Number(clean) }
  if (clean.length >= 7 && clean.length <= 8) return { tipoDocRec: 96, nroDocRec: Number(clean) }
  return { tipoDocRec: 99, nroDocRec: 0 }
}

export function caeFactura(factura: FacturaVentaRecord): string {
  return String(factura.cae || factura.numero_cae || '').replace(/\D/g, '')
}

export function buildAfipQrPayload(factura: FacturaVentaRecord, cuitEmisor: string): AfipQrPayload | null {
  const cae = caeFactura(factura)
  const cuit = Number((cuitEmisor || '').replace(/\D/g, ''))
  const tipoCmp = Number(codigoComprobanteAfip(factura.tipo_comprobante))
  if (!cae || !cuit || !Number.isFinite(tipoCmp) || tipoCmp <= 0) return null
  const doc = tipoDocReceptorPdf(factura.cliente_dni_cuit)
  return {
    ver: 1,
    fecha: String(factura.fecha_emision || '').slice(0, 10),
    cuit,
    ptoVta: Number(factura.punto_venta) || 0,
    tipoCmp,
    nroCmp: Number(factura.numero_comprobante) || 0,
    importe: Number(factura.total) || 0,
    moneda: 'PES',
    ctz: 1,
    tipoDocRec: doc.tipoDocRec,
    nroDocRec: doc.nroDocRec,
    tipoCodAut: 'E',
    codAut: Number(cae)
  }
}

export function buildAfipQrUrl(payload: AfipQrPayload): string {
  return `${AFIP_QR_BASE}${btoa(JSON.stringify(payload))}`
}

async function loadDataUrl(src: string): Promise<string | null> {
  try {
    const res = await fetch(src)
    if (!res.ok) return null
    const blob = await res.blob()
    return await new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result || '') || null)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

async function cargarEmisor(): Promise<EmisorPdf> {
  try {
    const { default: apiService } = await import('../services/api')
    const r = await apiService.getConfiguracionAFIP()
    if (r.success && r.data) {
      return {
        cuit: r.data.cuit,
        razon_social: r.data.razon_social,
        domicilio_comercial: r.data.domicilio_comercial,
        condicion_iva: r.data.condicion_iva,
        ingresos_brutos: r.data.ingresos_brutos,
        fecha_inicio_actividades: r.data.fecha_inicio_actividades
      }
    }
  } catch {
    // noop
  }
  return {
    cuit: '',
    razon_social: 'PLOT CENTER S.R.L.',
    domicilio_comercial: null,
    condicion_iva: 'Responsable Inscripto',
    ingresos_brutos: null,
    fecha_inicio_actividades: null
  }
}

function nombreArchivoPdf(factura: FacturaVentaRecord): string {
  const tipo = pdfText(factura.tipo_comprobante || 'Factura').replace(/\s+/g, '_')
  const nro = pdfText(factura.numero_factura || String(factura.id)).replace(/\s+/g, '_')
  return `${tipo}_${nro}.pdf`
}

export async function buildFacturaAfipPdf(factura: FacturaPdf, emisor: EmisorPdf): Promise<jsPDF> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const items = [...(factura.items || [])].sort((a, b) => (a.item_numero || 0) - (b.item_numero || 0))
  const autorizada = factura.estado_afip === 'Autorizada' && Boolean(caeFactura(factura))
  const letra = letraComprobante(factura.tipo_comprobante)
  const codigo = codigoComprobanteAfip(factura.tipo_comprobante)
  const logo = await loadDataUrl(LOGO_URL)
  const qrPayload = autorizada ? buildAfipQrPayload(factura, emisor.cuit) : null
  const qrDataUrl = qrPayload ? await toDataURL(buildAfipQrUrl(qrPayload), { width: 280, margin: 1, errorCorrectionLevel: 'M' }) : null

  const drawHeader = (primera: boolean): number => {
    const x = MARGIN
    const y = MARGIN
    const boxH = 46
    const mid = x + CONTENT_W * 0.62
    const right = x + CONTENT_W

    doc.setDrawColor(30, 30, 30)
    doc.setLineWidth(0.4)
    doc.rect(x, y, CONTENT_W, boxH)
    doc.line(mid, y, mid, y + boxH)

    if (logo) {
      try {
        doc.addImage(logo, 'PNG', x + 3, y + 4, 14, 14)
      } catch {
        // logo opcional
      }
    }

    const textX = logo ? x + 20 : x + 4
    doc.setTextColor(20, 20, 20)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text(pdfText(emisor.razon_social || 'PLOT CENTER S.R.L.'), textX, y + 8)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    let ey = y + 14
    const emisorLines = [
      emisor.cuit ? `CUIT: ${formatCuitPdf(emisor.cuit)}` : null,
      emisor.condicion_iva ? `IVA: ${emisor.condicion_iva}` : null,
      emisor.domicilio_comercial || null,
      emisor.ingresos_brutos ? `IIBB: ${emisor.ingresos_brutos}` : null,
      emisor.fecha_inicio_actividades ? `Inicio de actividades: ${formatFechaAr(emisor.fecha_inicio_actividades)}` : null
    ].filter(Boolean) as string[]
    for (const line of emisorLines) {
      const wrapped = doc.splitTextToSize(pdfText(line), mid - textX - 3) as string[]
      doc.text(wrapped, textX, ey)
      ey += wrapped.length * 3.6
    }

    const letraBox = 16
    const letraX = mid + (right - mid - letraBox) / 2
    doc.setLineWidth(0.8)
    doc.rect(letraX, y + 4, letraBox, letraBox)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(18)
    doc.text(letra, letraX + letraBox / 2, y + 15.5, { align: 'center' })

    doc.setFontSize(11)
    doc.text(pdfText(factura.tipo_comprobante), mid + (right - mid) / 2, y + 25, { align: 'center' })
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.text(`Cod. ${codigo}`, mid + (right - mid) / 2, y + 30, { align: 'center' })
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text(pdfText(factura.numero_factura || ''), mid + (right - mid) / 2, y + 36, { align: 'center' })
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.text(autorizada ? 'ORIGINAL' : 'BORRADOR', mid + (right - mid) / 2, y + 41.5, { align: 'center' })

    if (!primera) {
      doc.setFontSize(7)
      doc.setTextColor(90, 90, 90)
      doc.text('Continuacion', x + 2, y + boxH - 2)
      doc.setTextColor(20, 20, 20)
    }

    return y + boxH + 4
  }

  let y = drawHeader(true)

  const clienteTop = y
  doc.setDrawColor(30, 30, 30)
  doc.setLineWidth(0.3)
  doc.rect(MARGIN, clienteTop, CONTENT_W, 22)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text('Cliente', MARGIN + 2, clienteTop + 5)
  doc.setFont('helvetica', 'normal')
  doc.text(pdfText(factura.cliente_nombre || '-'), MARGIN + 18, clienteTop + 5)
  const clienteMeta = [
    factura.cliente_dni_cuit ? `CUIT/DNI: ${formatCuitPdf(factura.cliente_dni_cuit)}` : null,
    factura.cliente_condicion_iva ? `Cond. IVA: ${factura.cliente_condicion_iva}` : null,
    `Fecha: ${formatFechaAr(factura.fecha_emision)}`,
    factura.fecha_vencimiento ? `Vto: ${formatFechaAr(factura.fecha_vencimiento)}` : null,
    factura.concepto ? `Concepto: ${conceptoLabel(factura.concepto)}` : null,
    factura.numero_op ? `OP: ${factura.numero_op}` : null
  ]
    .filter(Boolean)
    .join('   ')
  const metaLines = doc.splitTextToSize(pdfText(clienteMeta), CONTENT_W - 4) as string[]
  doc.text(metaLines.slice(0, 2), MARGIN + 2, clienteTop + 10)
  if (factura.cliente_direccion) {
    doc.text(doc.splitTextToSize(pdfText(`Domicilio: ${factura.cliente_direccion}`), CONTENT_W - 4)[0], MARGIN + 2, clienteTop + 19)
  }
  y = clienteTop + 26

  const cols = [
    { title: '#', w: 8, align: 'center' as const },
    { title: 'Cant.', w: 14, align: 'right' as const },
    { title: 'Descripcion', w: 86, align: 'left' as const },
    { title: 'P. unit.', w: 24, align: 'right' as const },
    { title: 'Desc.', w: 20, align: 'right' as const },
    { title: 'IVA', w: 12, align: 'right' as const },
    { title: 'Total', w: 26, align: 'right' as const }
  ]

  const drawTableHead = (top: number): number => {
    doc.setFillColor(245, 245, 245)
    doc.setDrawColor(30, 30, 30)
    doc.rect(MARGIN, top, CONTENT_W, 7, 'FD')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    let cx = MARGIN
    for (const col of cols) {
      const tx = col.align === 'right' ? cx + col.w - 1.5 : col.align === 'center' ? cx + col.w / 2 : cx + 1.5
      doc.text(col.title, tx, top + 4.8, { align: col.align })
      cx += col.w
    }
    return top + 7
  }

  y = drawTableHead(y)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)

  const ensureSpace = (need: number) => {
    if (y + need < PAGE_H - 48) return
    doc.addPage()
    y = drawTableHead(drawHeader(false))
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
  }

  if (items.length === 0) {
    ensureSpace(8)
    doc.setTextColor(90, 90, 90)
    doc.text('Sin items', MARGIN + 2, y + 5)
    doc.setTextColor(20, 20, 20)
    y += 8
  } else {
    for (const item of items) {
      const descLines = doc.splitTextToSize(pdfText(item.descripcion || ''), cols[2].w - 3) as string[]
      const rowH = Math.max(6, descLines.length * 3.4 + 2.4)
      ensureSpace(rowH)
      doc.setDrawColor(210, 210, 210)
      doc.line(MARGIN, y + rowH, MARGIN + CONTENT_W, y + rowH)
      const descuento = Number(item.descuento || 0)
      const values = [
        String(item.item_numero || ''),
        String(Number(item.cantidad ?? 0)),
        '',
        money(Number(item.precio_unitario)),
        descuento > 0 ? money(descuento) : '-',
        `${Number(item.iva_porcentaje || 0)}%`,
        money(Number(item.total))
      ]
      let cx = MARGIN
      values.forEach((value, i) => {
        const col = cols[i]
        if (i === 2) {
          doc.text(descLines, cx + 1.5, y + 4)
        } else {
          const tx = col.align === 'right' ? cx + col.w - 1.5 : col.align === 'center' ? cx + col.w / 2 : cx + 1.5
          doc.text(value, tx, y + 4, { align: col.align })
        }
        cx += col.w
      })
      y += rowH
    }
  }

  ensureSpace(36)
  y += 3
  const totX = MARGIN + CONTENT_W - 70
  const totW = 70
  const rows = [
    ['Subtotal', money(factura.subtotal)],
    factura.descuento > 0 ? ['Descuento', `-${money(factura.descuento)}`] : null,
    Number(factura.iva) > 0 ? ['IVA', money(factura.iva)] : null,
    ['TOTAL', money(factura.total)]
  ].filter(Boolean) as Array<[string, string]>

  for (const [label, value] of rows) {
    const isTotal = label === 'TOTAL'
    doc.setFont('helvetica', isTotal ? 'bold' : 'normal')
    doc.setFontSize(isTotal ? 10 : 8)
    if (isTotal) {
      doc.setFillColor(245, 245, 245)
      doc.rect(totX, y - 4, totW, 8, 'F')
    }
    doc.text(label, totX + 2, y)
    doc.text(value, totX + totW - 2, y, { align: 'right' })
    y += isTotal ? 9 : 6
  }

  if (factura.observaciones?.trim()) {
    ensureSpace(16)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.text('Observaciones', MARGIN, y + 4)
    doc.setFont('helvetica', 'normal')
    const obs = doc.splitTextToSize(pdfText(factura.observaciones), CONTENT_W - 2) as string[]
    doc.text(obs.slice(0, 4), MARGIN, y + 9)
    y += 9 + Math.min(obs.length, 4) * 3.6
  }

  const footerTop = PAGE_H - 42
  if (y > footerTop - 4) {
    doc.addPage()
    y = drawHeader(false)
  }

  const pages = doc.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    doc.setDrawColor(30, 30, 30)
    doc.setLineWidth(0.3)
    doc.rect(MARGIN, footerTop, CONTENT_W, 32)

    if (qrDataUrl && i === pages) {
      try {
        doc.addImage(qrDataUrl, 'PNG', MARGIN + 2, footerTop + 2, 28, 28)
      } catch {
        // QR opcional
      }
    }

    const fx = qrDataUrl && i === pages ? MARGIN + 34 : MARGIN + 3
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    if (autorizada) {
      doc.text('Comprobante autorizado por AFIP', fx, footerTop + 7)
      doc.setFont('helvetica', 'normal')
      doc.text(`CAE: ${caeFactura(factura)}`, fx, footerTop + 13)
      if (factura.fecha_vencimiento_cae) {
        doc.text(`Vto. CAE: ${formatFechaAr(factura.fecha_vencimiento_cae)}`, fx, footerTop + 18)
      }
      doc.setFontSize(7)
      doc.text('Escanee el QR para verificar el comprobante en AFIP.', fx, footerTop + 24)
    } else {
      doc.setTextColor(140, 40, 40)
      doc.text('BORRADOR - No valido como factura', fx, footerTop + 10)
      doc.setTextColor(20, 20, 20)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7)
      doc.text('Este documento no tiene CAE y no fue autorizado por AFIP.', fx, footerTop + 16)
    }

    doc.setFontSize(7)
    doc.setTextColor(90, 90, 90)
    doc.text(
      pdfText(`${emisor.razon_social || 'Plot Lab'}  ·  Pagina ${i}/${pages}`),
      PAGE_W / 2,
      PAGE_H - 6,
      { align: 'center' }
    )
    doc.setTextColor(20, 20, 20)
  }

  return doc
}

export async function descargarFacturaAfipPdf(factura: FacturaPdf, config?: EmisorPdf | null): Promise<void> {
  const emisor = config ?? (await cargarEmisor())
  const doc = await buildFacturaAfipPdf(factura, emisor)
  doc.save(nombreArchivoPdf(factura))
}

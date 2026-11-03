import QRCode from 'qrcode'
import { LOGO_PLOT_CENTER } from './logoPlotCenter'
import { parseDoc, tipoComprobanteToCbteTipo } from './mapFactura'
import type { AfipPdfEmisor, AfipPdfFactura, AfipPdfReferencia } from './pdf'

/**
 * Factura como HTML propio para que AfipSDK la convierta a PDF (POST /v1/pdfs con `html`).
 * Es solo presentación: toma los importes ya guardados y autorizados, no calcula nada que viaje a ARCA.
 * La plantilla oficial no admite logo, cantidades decimales ni formato de importes; esta sí.
 */

type Letra = 'A' | 'B' | 'C'

export type LineaHtml = {
  numero: string
  cantidad: number
  descripcion: string
  /** A: neto unitario. B y C: precio final unitario (con IVA). */
  unitario: number
  alicuota: number
  neto: number
  iva: number
  total: number
}

export type DatosPdfHtml = {
  letra: Letra
  tipoTitulo: string
  codigo: string
  puntoVenta: string
  numero: string
  fechaEmision: string
  emisor: {
    razonSocial: string
    domicilio: string
    condicionIva: string
    cuit: string
    ingresosBrutos: string
    inicioActividades: string
  }
  receptor: {
    nombre: string
    documentoEtiqueta: string
    documento: string
    condicionIva: string
    domicilio: string
    condicionVenta: string
    concepto: string
    periodo: string | null
    vencimientoPago: string | null
  }
  referencia: string | null
  lineas: LineaHtml[]
  /** Neto y IVA por alícuota (en la A se muestran; en la B alimentan el IVA contenido). */
  alicuotas: Array<{ alicuota: number; neto: number; iva: number }>
  neto: number
  iva: number
  total: number
  /** Solo Factura B: IVA que contiene el precio final (Ley 27.743). */
  ivaContenido: number | null
  observaciones: string | null
  cae: string
  vencimientoCae: string
}

const n = (v: unknown): number => {
  const x = Number(v)
  return Number.isFinite(x) ? x : 0
}

/** Importe a centavos y en positivo: las notas de crédito se guardan en negativo y el comprobante las muestra como ARCA. */
const r2 = (v: unknown): number => Math.round((Math.abs(n(v)) + Number.EPSILON) * 100) / 100

const money = (v: number): string =>
  `$ ${v.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const cantidadTexto = (v: number): string => v.toLocaleString('es-AR', { maximumFractionDigits: 3 })

const pct = (v: number): string => `${v.toLocaleString('es-AR')}%`

function fecha(iso: string | null | undefined): string {
  const [y, m, d] = String(iso || '').slice(0, 10).split('-')
  return y && m && d ? `${d}/${m}/${y}` : String(iso || '')
}

function cuitFormateado(raw: string | null | undefined): string {
  const d = String(raw || '').replace(/\D/g, '')
  return d.length === 11 ? `${d.slice(0, 2)}-${d.slice(2, 10)}-${d.slice(10)}` : String(raw || '').trim()
}

/** La letra es siempre el último carácter ("Nota de Crédito B" tiene una C en "Crédito"). */
function letraDe(tipo: string): Letra {
  const ultima = tipo.trim().slice(-1).toUpperCase()
  return ultima === 'A' || ultima === 'C' ? ultima : 'B'
}

const CONCEPTOS: Record<number, string> = { 1: 'Productos', 2: 'Servicios', 3: 'Productos y Servicios' }

function condicionVenta(f: AfipPdfFactura): string {
  const emision = String(f.fecha_emision || '').slice(0, 10)
  const vencimiento = String(f.fecha_vencimiento || '').slice(0, 10)
  return vencimiento && emision && vencimiento > emision ? `Cuenta corriente (vence ${fecha(vencimiento)})` : 'Contado'
}

function armarLineas(f: AfipPdfFactura, letra: Letra): LineaHtml[] {
  const items = [...(f.items || [])].sort((a, b) => n(a.item_numero) - n(b.item_numero))
  if (!items.length) {
    const neto = r2(f.subtotal)
    const total = r2(f.total)
    return [
      {
        numero: '1',
        cantidad: 1,
        descripcion: f.tipo_comprobante,
        unitario: letra === 'A' ? neto : total,
        alicuota: letra !== 'C' && n(f.iva) !== 0 ? 21 : 0,
        neto,
        iva: letra === 'C' ? 0 : r2(f.iva),
        total
      }
    ]
  }
  return items.map((item, i) => {
    const cantidad = n(item.cantidad) || 1
    const neto = r2(item.subtotal)
    const iva = letra === 'C' ? 0 : r2(item.iva_monto)
    const total = r2(n(item.total) !== 0 ? item.total : neto + iva)
    // El precio unitario guardado es neto; en la A se muestra tal cual si cierra con el subtotal.
    const precioNeto = Math.abs(n(item.precio_unitario))
    const precioNetoCierra = precioNeto > 0 && Math.abs(precioNeto * cantidad - neto) <= 0.01 + 0.005 * cantidad
    const unitario =
      letra === 'A' ? (precioNetoCierra ? r2(precioNeto) : r2(neto / cantidad)) : r2(total / cantidad)
    return {
      numero: String(item.item_numero || i + 1),
      cantidad,
      descripcion: String(item.descripcion || '').trim() || 'Item',
      unitario,
      alicuota: letra === 'C' ? 0 : n(item.iva_porcentaje),
      neto,
      iva,
      total
    }
  })
}

/** Todo lo que se imprime, calculado a partir de lo guardado (sin HTML). */
export function datosFactura(
  f: AfipPdfFactura,
  emisor: AfipPdfEmisor,
  referencia: AfipPdfReferencia = null
): DatosPdfHtml {
  const letra = letraDe(f.tipo_comprobante)
  const cae = String(f.cae || f.numero_cae || '').replace(/\D/g, '')
  if (!cae) throw new Error('El comprobante no tiene CAE: el PDF se genera después de autorizar.')

  const lineas = armarLineas(f, letra)
  const porAlicuota = new Map<number, { neto: number; iva: number }>()
  for (const l of lineas) {
    const prev = porAlicuota.get(l.alicuota) ?? { neto: 0, iva: 0 }
    porAlicuota.set(l.alicuota, { neto: r2(prev.neto + l.neto), iva: r2(prev.iva + l.iva) })
  }
  const alicuotas = [...porAlicuota.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([alicuota, v]) => ({ alicuota, ...v }))
  const neto = r2(lineas.reduce((s, l) => s + l.neto, 0))
  const iva = r2(lineas.reduce((s, l) => s + l.iva, 0))
  const total = r2(n(f.total) !== 0 ? f.total : neto + iva)

  const doc = (() => {
    try {
      return parseDoc(f.cliente_dni_cuit, letra)
    } catch {
      return { DocTipo: 99, DocNro: 0 }
    }
  })()
  const digitos = String(f.cliente_dni_cuit || '').replace(/\D/g, '')
  const concepto = n(f.concepto) || 1

  return {
    letra,
    tipoTitulo: f.tipo_comprobante.replace(/\s+[ABC]$/, '').toUpperCase(),
    codigo: String(tipoComprobanteToCbteTipo(f.tipo_comprobante)).padStart(3, '0'),
    puntoVenta: String(n(f.punto_venta)).padStart(4, '0'),
    numero: String(n(f.numero_comprobante)).padStart(8, '0'),
    fechaEmision: fecha(f.fecha_emision),
    emisor: {
      razonSocial: emisor.razon_social || 'PLOT CENTER SRL',
      domicilio: emisor.domicilio_comercial || '-',
      condicionIva: emisor.condicion_iva || 'Responsable Inscripto',
      cuit: cuitFormateado(emisor.cuit),
      ingresosBrutos: emisor.ingresos_brutos || '-',
      inicioActividades: emisor.fecha_inicio_actividades ? fecha(emisor.fecha_inicio_actividades) : '-'
    },
    receptor: {
      nombre: f.cliente_nombre || 'Consumidor Final',
      documentoEtiqueta: doc.DocTipo === 80 ? 'CUIT' : doc.DocTipo === 96 ? 'DNI' : 'Documento',
      documento: doc.DocTipo === 80 ? cuitFormateado(digitos) : doc.DocTipo === 96 ? digitos : '-',
      condicionIva: f.cliente_condicion_iva || 'Consumidor Final',
      domicilio: f.cliente_direccion || '-',
      condicionVenta: condicionVenta(f),
      concepto: CONCEPTOS[concepto] ?? 'Productos',
      periodo:
        concepto !== 1 && f.fecha_servicio_desde && f.fecha_servicio_hasta
          ? `${fecha(f.fecha_servicio_desde)} al ${fecha(f.fecha_servicio_hasta)}`
          : null,
      vencimientoPago: concepto !== 1 && f.fecha_vencimiento ? fecha(f.fecha_vencimiento) : null
    },
    referencia: referencia
      ? `${referencia.tipo_comprobante} ${String(n(referencia.punto_venta)).padStart(4, '0')}-${String(n(referencia.numero_comprobante)).padStart(8, '0')}${referencia.fecha_emision ? ` (${fecha(referencia.fecha_emision)})` : ''}`
      : null,
    lineas,
    alicuotas,
    neto,
    iva,
    total,
    ivaContenido: letra === 'B' ? iva : null,
    observaciones: f.observaciones?.trim() || null,
    cae,
    vencimientoCae: fecha(f.fecha_vencimiento_cae || f.fecha_emision)
  }
}

/** URL del QR de ARCA (RG 4291): los mismos datos que el comprobante autorizado. */
export function urlQrAfip(f: AfipPdfFactura, emisor: AfipPdfEmisor): string {
  const letra = letraDe(f.tipo_comprobante)
  const doc = (() => {
    try {
      return parseDoc(f.cliente_dni_cuit, letra)
    } catch {
      return { DocTipo: 99, DocNro: 0 }
    }
  })()
  const payload = {
    ver: 1,
    fecha: String(f.fecha_emision || '').slice(0, 10),
    cuit: Number(String(emisor.cuit || '').replace(/\D/g, '')),
    ptoVta: n(f.punto_venta),
    tipoCmp: tipoComprobanteToCbteTipo(f.tipo_comprobante),
    nroCmp: n(f.numero_comprobante),
    importe: r2(f.total),
    moneda: 'PES',
    ctz: 1,
    tipoDocRec: doc.DocTipo,
    nroDocRec: doc.DocNro,
    tipoCodAut: 'E',
    codAut: Number(String(f.cae || f.numero_cae || '').replace(/\D/g, ''))
  }
  return `https://www.afip.gob.ar/fe/qr/?p=${Buffer.from(JSON.stringify(payload), 'utf8').toString('base64')}`
}

const esc = (valor: unknown): string =>
  String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

const CSS = `
@page { size: A4; margin: 10mm }
* { box-sizing: border-box }
body { margin: 0; font-family: Arial, Helvetica, sans-serif; font-size: 9.5pt; color: #111; line-height: 1.3 }
.hoja { min-height: 277mm; display: flex; flex-direction: column; gap: 3mm }
.caja { border: 1px solid #222 }
.cab { display: grid; grid-template-columns: 1fr 22mm 1fr }
.cab > div { padding: 3mm }
.emisor { display: flex; gap: 3mm; align-items: flex-start }
.emisor img { width: 20mm; height: 20mm; flex: none }
.emisor h1 { margin: 0 0 2mm; font-size: 13pt }
.letra { border-left: 1px solid #222; border-right: 1px solid #222; text-align: center }
.letra b { display: block; margin: -3mm -3mm 0; padding-top: 2mm; font-size: 26pt; line-height: 1.1; border-bottom: 1px solid #222 }
.letra small { display: block; padding-top: 1mm; font-size: 7pt }
.comp h2 { margin: 0 0 2mm; font-size: 14pt }
.comp .orig { float: right; font-size: 8pt; font-weight: bold }
p { margin: 0 0 1mm }
.rec { display: grid; grid-template-columns: 1.4fr 1fr; gap: 0 6mm; padding: 2.5mm 3mm }
.rec .ancho { grid-column: 1 / -1 }
table { width: 100%; border-collapse: collapse }
.items thead { display: table-header-group }
.items th { background: #ebebeb; border: 1px solid #222; padding: 1.5mm 2mm; font-size: 8.5pt; text-align: right }
.items th.izq, .items td.izq { text-align: left }
.items td { padding: 1.5mm 2mm; border-bottom: 1px solid #d0d0d0; text-align: right; vertical-align: top }
.items tr, .tot tr { break-inside: avoid }
.abajo { display: grid; grid-template-columns: 1fr 78mm; gap: 6mm; align-items: start; break-inside: avoid }
.transp { border: 1px solid #777; padding: 2.5mm 3mm; font-size: 8.5pt }
.transp b { display: block; margin-bottom: 1.5mm }
.tot td { padding: 1.2mm 2mm }
.tot td:last-child { text-align: right }
.tot tr.fuerte td { background: #ebebeb; font-weight: bold; font-size: 11pt; padding: 2mm }
.obs { font-size: 8.5pt; break-inside: avoid }
.pie { margin-top: auto; display: flex; gap: 4mm; align-items: center; padding: 3mm; break-inside: avoid }
.pie img { width: 30mm; height: 30mm; flex: none }
.pie .cae { font-size: 10pt }
.pie small { display: block; margin-top: 2mm; font-size: 8pt }
`

const dd = (etiqueta: string, valor: string) => `<p><b>${esc(etiqueta)}</b> ${esc(valor)}</p>`

/** HTML completo del comprobante. `qrDataUrl` es la imagen del QR ya generada. */
export function htmlFactura(d: DatosPdfHtml, qrDataUrl: string): string {
  const esA = d.letra === 'A'
  const encabezados = esA
    ? ['#', 'Cant.', 'Producto / Servicio', 'Precio unit.', 'Alíc. IVA', 'Subtotal', 'Subtotal c/IVA']
    : ['#', 'Cant.', 'Producto / Servicio', 'Precio unit.', 'Subtotal']
  const filas = d.lineas
    .map((l) => {
      const celdas = [
        `<td>${esc(l.numero)}</td>`,
        `<td>${esc(cantidadTexto(l.cantidad))}</td>`,
        `<td class="izq">${esc(l.descripcion)}</td>`,
        `<td>${esc(money(l.unitario))}</td>`,
        ...(esA ? [`<td>${esc(pct(l.alicuota))}</td>`, `<td>${esc(money(l.neto))}</td>`] : []),
        `<td>${esc(money(l.total))}</td>`
      ]
      return `<tr>${celdas.join('')}</tr>`
    })
    .join('')

  const filasTotales = [
    ...(esA
      ? [
          ['Importe Neto Gravado', money(d.neto)],
          ...d.alicuotas.map((a) => [`IVA ${pct(a.alicuota)}`, money(a.iva)])
        ]
      : [['Subtotal', money(d.total)]]),
    ['Importe Otros Tributos', money(0)]
  ]
    .map(([e, v]) => `<tr><td>${esc(e)}</td><td>${esc(v)}</td></tr>`)
    .join('')

  const transparencia =
    d.ivaContenido !== null
      ? `<div class="transp"><b>Régimen de Transparencia Fiscal al Consumidor (Ley 27.743)</b>
           IVA Contenido: ${esc(money(d.ivaContenido))}<br>Otros Impuestos Nacionales Indirectos: ${esc(money(0))}</div>`
      : '<div></div>'

  const r = d.receptor
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><style>${CSS}</style></head><body><div class="hoja">
<div class="caja cab">
  <div class="emisor"><img src="${LOGO_PLOT_CENTER}" alt=""><div>
    <h1>${esc(d.emisor.razonSocial)}</h1>
    ${dd('Domicilio Comercial:', d.emisor.domicilio)}${dd('Condición frente al IVA:', d.emisor.condicionIva)}</div></div>
  <div class="letra"><b>${esc(d.letra)}</b><small>COD. ${esc(d.codigo)}</small></div>
  <div class="comp"><span class="orig">ORIGINAL</span><h2>${esc(d.tipoTitulo)}</h2>
    <p><b>Punto de Venta:</b> ${esc(d.puntoVenta)} &nbsp; <b>Comp. Nro:</b> ${esc(d.numero)}</p>
    ${dd('Fecha de Emisión:', d.fechaEmision)}${dd('CUIT:', d.emisor.cuit)}${dd('Ingresos Brutos:', d.emisor.ingresosBrutos)}${dd('Inicio de Actividades:', d.emisor.inicioActividades)}</div>
</div>
<div class="caja rec">
  <div>${dd('Apellido y Nombre / Razón Social:', r.nombre)}${dd('Domicilio:', r.domicilio)}${dd('Condición de venta:', r.condicionVenta)}</div>
  <div>${dd(`${r.documentoEtiqueta}:`, r.documento)}${dd('Condición frente al IVA:', r.condicionIva)}${dd('Concepto:', r.concepto)}</div>
  ${r.periodo ? `<div class="ancho">${dd('Período facturado:', r.periodo)}${r.vencimientoPago ? dd('Vto. de pago:', r.vencimientoPago) : ''}</div>` : ''}
  ${d.referencia ? `<div class="ancho">${dd('Comprobante asociado:', d.referencia)}</div>` : ''}
</div>
<table class="items"><thead><tr>${encabezados.map((h, i) => `<th class="${i === 2 ? 'izq' : ''}">${esc(h)}</th>`).join('')}</tr></thead><tbody>${filas}</tbody></table>
<div class="abajo">${transparencia}<table class="tot">${filasTotales}<tr class="fuerte"><td>Importe Total</td><td>${esc(money(d.total))}</td></tr></table></div>
${d.observaciones ? `<div class="obs"><b>Observaciones</b><br>${esc(d.observaciones)}</div>` : ''}
<div class="caja pie"><img src="${qrDataUrl}" alt="QR de ARCA"><div class="cae"><b>Comprobante Autorizado</b><br>
  <b>CAE N°:</b> ${esc(d.cae)}<br><b>Fecha de Vto. de CAE:</b> ${esc(d.vencimientoCae)}
  <small>Escaneá el QR para verificar el comprobante en ARCA.</small></div></div>
</div></body></html>`
}

export type PedidoPdfHtml = {
  file_name: string
  html: string
  options: { width: number }
}

/** Pedido para POST /v1/pdfs de AfipSDK con el diseño propio. Solo para comprobantes con CAE. */
export async function buildAfipHtmlPdfRequest(
  f: AfipPdfFactura,
  emisor: AfipPdfEmisor,
  referencia: AfipPdfReferencia = null
): Promise<PedidoPdfHtml> {
  const datos = datosFactura(f, emisor, referencia)
  // Módulos de tamaño entero (6 px) y zona de silencio de 3: nítido al imprimir y fácil de leer para el celular.
  const qr = await QRCode.toDataURL(urlQrAfip(f, emisor), { scale: 6, margin: 3, errorCorrectionLevel: 'M' })
  const tipo = String(f.tipo_comprobante || 'Factura').replace(/\s+/g, '_')
  const nro = String(f.numero_factura || `${datos.puntoVenta}-${datos.numero}`).replace(/\s+/g, '_')
  return { file_name: `${tipo}_${nro}.pdf`, html: htmlFactura(datos, qr), options: { width: 8.27 } }
}

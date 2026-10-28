import { jsPDF } from 'jspdf'
import * as XLSX from 'xlsx'
import type { ArticuloEmpresaRecord } from '../types/api'
import {
  LISTAS_PRECIO_VENTAS,
  labelAjustesPreciosActivos,
  resolvePrecioLista,
  resolvePrecioListaBruto,
  tipoListaToNumero,
  type ConfigAjustesPreciosVentas,
  type TipoListaPrecioVentas
} from '../constants/ventasListasPrecio'
import { etiquetaUnidadCorta, normalizarUnidadPrecio } from './unidadPrecio'
import { cargarLogoPlotLabDataUrl } from './relojTabletTarjetaPdf'

type Rgb = [number, number, number]

export type FilaListaPreciosExport = {
  codigo: string
  nombre: string
  categoria: string
  unidad: string
  precioBruto: number | null
  precioFinal: number | null
}

type ExportOpts = {
  articulos: ArticuloEmpresaRecord[]
  lista: TipoListaPrecioVentas
  ajustes: ConfigAjustesPreciosVentas
  /** Texto extra bajo el subtítulo (ej. filtros). */
  notaFiltros?: string
}

const C = {
  ink: [15, 23, 42] as Rgb,
  muted: [71, 85, 105] as Rgb,
  soft: [148, 163, 184] as Rgb,
  line: [226, 232, 240] as Rgb,
  brand: [235, 103, 27] as Rgb,
  green: [16, 185, 129] as Rgb,
  violet: [99, 102, 241] as Rgb,
  head: [30, 41, 59] as Rgb,
  zebra: [248, 250, 252] as Rgb,
  white: [255, 255, 255] as Rgb,
  catBg: [255, 247, 237] as Rgb
}

function pesos(n: number): string {
  return n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function stampArgentina(): string {
  return new Date().toLocaleString('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })
}

function fechaArchivo(): string {
  return new Date().toLocaleDateString('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).replace(/\//g, '-')
}

function slugLista(lista: TipoListaPrecioVentas): string {
  return lista === 'lista_1' ? 'lista-1-efectivo' : 'lista-2-cuenta-corriente'
}

export function armarFilasListaPrecios(opts: ExportOpts): FilaListaPreciosExport[] {
  const { articulos, lista, ajustes } = opts
  const numero = tipoListaToNumero(lista)
  const filas: FilaListaPreciosExport[] = articulos.map((a) => ({
    codigo: (a.codigo || '').trim() || '—',
    nombre: (a.nombre || '').trim() || 'Sin nombre',
    categoria: (a.categoria || '').trim() || 'Sin categoría',
    unidad: etiquetaUnidadCorta(normalizarUnidadPrecio(a.unidad_medida)),
    precioBruto: resolvePrecioListaBruto(a, numero),
    precioFinal: resolvePrecioLista(a, numero, ajustes)
  }))
  filas.sort((a, b) => {
    const c = a.categoria.localeCompare(b.categoria, 'es')
    if (c !== 0) return c
    return a.nombre.localeCompare(b.nombre, 'es')
  })
  return filas
}

function trunc(doc: jsPDF, text: string, maxW: number): string {
  if (doc.getTextWidth(text) <= maxW) return text
  let t = text
  while (t.length > 2 && doc.getTextWidth(`${t}…`) > maxW) t = t.slice(0, -1)
  return `${t}…`
}

/** PDF atractivo de la lista activa: logo, fecha, categorías y precios finales. */
export async function exportListaPreciosPdf(opts: ExportOpts): Promise<void> {
  const meta = LISTAS_PRECIO_VENTAS[opts.lista]
  const accent: Rgb = opts.lista === 'lista_1' ? C.green : C.violet
  const filas = armarFilasListaPrecios(opts)
  const logo = await cargarLogoPlotLabDataUrl()
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true })
  const pageW = 210
  const margen = 14
  const ancho = pageW - margen * 2
  const emitido = stampArgentina()
  const ajustesTxt = labelAjustesPreciosActivos(opts.ajustes)

  const rgb = (c: Rgb) => doc.setTextColor(c[0], c[1], c[2])
  const fill = (c: Rgb) => doc.setFillColor(c[0], c[1], c[2])
  const stroke = (c: Rgb) => doc.setDrawColor(c[0], c[1], c[2])

  const drawHeader = (pageIndex: number) => {
    fill(C.head)
    doc.rect(0, 0, pageW, 36, 'F')
    fill(accent)
    doc.rect(0, 36, pageW, 2.2, 'F')

    if (logo?.dataUrl) {
      const logoH = 14
      const logoW = Math.min(42, logoH * (logo.aspect || 1.7))
      try {
        doc.addImage(logo.dataUrl, 'PNG', margen, 10, logoW, logoH)
      } catch {
        /* logo opcional */
      }
      rgb(C.white)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(14)
      doc.text('Lista de precios', margen + logoW + 6, 16)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      rgb([203, 213, 225])
      doc.text('Plot Center · Plot Lab', margen + logoW + 6, 22)
    } else {
      rgb(C.white)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(14)
      doc.text('Plot Center · Lista de precios', margen, 16)
    }

    rgb(C.white)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text(`${meta.label} · ${meta.subtitle}`, pageW - margen, 15, { align: 'right' })
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    rgb([203, 213, 225])
    doc.text(`Emitido ${emitido}`, pageW - margen, 21, { align: 'right' })
    if (pageIndex > 1) {
      doc.text(`Pág. ${pageIndex}`, pageW - margen, 27, { align: 'right' })
    }
  }

  const drawFooter = (pageIndex: number, totalPages: number) => {
    stroke(C.line)
    doc.setLineWidth(0.2)
    doc.line(margen, 287, pageW - margen, 287)
    rgb(C.soft)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.text('Precios de referencia · Plot Center San Juan', margen, 292)
    doc.text(`${pageIndex} / ${totalPages}`, pageW - margen, 292, { align: 'right' })
  }

  drawHeader(1)
  let y = 44

  fill(C.catBg)
  doc.roundedRect(margen, y, ancho, 16, 2, 2, 'F')
  rgb(C.ink)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text(`${meta.label} — ${meta.subtitle}`, margen + 4, y + 6.5)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  rgb(C.muted)
  doc.text(`Incluye ${ajustesTxt} · ${filas.length} artículo${filas.length === 1 ? '' : 's'}`, margen + 4, y + 12)
  y += 20

  if (opts.notaFiltros?.trim()) {
    rgb(C.muted)
    doc.setFontSize(8)
    doc.text(opts.notaFiltros.trim(), margen, y)
    y += 6
  }

  const colCodigo = 28
  const colUnidad = 16
  const colPrecio = 28
  const colNombre = ancho - colCodigo - colUnidad - colPrecio

  const ensureSpace = (need: number) => {
    if (y + need <= 280) return
    doc.addPage()
    drawHeader(doc.getNumberOfPages())
    y = 44
  }

  const paintTableHead = () => {
    ensureSpace(10)
    fill(accent)
    doc.roundedRect(margen, y, ancho, 8, 1.2, 1.2, 'F')
    rgb(C.white)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.text('Código', margen + 3, y + 5.3)
    doc.text('Producto', margen + colCodigo + 3, y + 5.3)
    doc.text('Unidad', margen + colCodigo + colNombre + colUnidad / 2, y + 5.3, { align: 'center' })
    doc.text('Precio', pageW - margen - 3, y + 5.3, { align: 'right' })
    y += 10
  }

  let categoriaActual = ''
  let zebra = false
  paintTableHead()

  for (const fila of filas) {
    if (fila.categoria !== categoriaActual) {
      categoriaActual = fila.categoria
      ensureSpace(14)
      fill([241, 245, 249])
      doc.roundedRect(margen, y, ancho, 7, 1, 1, 'F')
      rgb(accent)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8.5)
      doc.text(categoriaActual.toUpperCase(), margen + 3, y + 4.8)
      y += 9
      zebra = false
    }

    ensureSpace(8)
    if (zebra) {
      fill(C.zebra)
      doc.rect(margen, y - 1.5, ancho, 7, 'F')
    }
    zebra = !zebra

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    rgb(C.muted)
    doc.text(trunc(doc, fila.codigo, colCodigo - 4), margen + 3, y + 3.2)
    rgb(C.ink)
    doc.text(trunc(doc, fila.nombre, colNombre - 4), margen + colCodigo + 3, y + 3.2)
    rgb(C.muted)
    doc.text(fila.unidad, margen + colCodigo + colNombre + colUnidad / 2, y + 3.2, { align: 'center' })
    doc.setFont('helvetica', 'bold')
    rgb(C.ink)
    const precioTxt =
      fila.precioFinal != null && fila.precioFinal > 0 ? `$ ${pesos(fila.precioFinal)}` : '—'
    doc.text(precioTxt, pageW - margen - 3, y + 3.2, { align: 'right' })
    y += 7
  }

  if (filas.length === 0) {
    rgb(C.muted)
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(10)
    doc.text('No hay artículos para exportar con los filtros actuales.', margen, y + 4)
  }

  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    drawFooter(i, totalPages)
  }

  doc.save(`lista-precios-${slugLista(opts.lista)}-${fechaArchivo()}.pdf`)
}

/** Excel de la lista activa (código, nombre, categoría, unidad, precios). */
export function exportListaPreciosXlsx(opts: ExportOpts): void {
  const meta = LISTAS_PRECIO_VENTAS[opts.lista]
  const filas = armarFilasListaPrecios(opts)
  const emitido = stampArgentina()
  const ajustesTxt = labelAjustesPreciosActivos(opts.ajustes)

  const rows: Array<Record<string, string | number>> = filas.map((f) => ({
    Código: f.codigo,
    Producto: f.nombre,
    Categoría: f.categoria,
    Unidad: f.unidad,
    'Precio lista': f.precioBruto != null && f.precioBruto > 0 ? f.precioBruto : '',
    'Precio final': f.precioFinal != null && f.precioFinal > 0 ? f.precioFinal : ''
  }))

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ Código: '', Producto: '(sin artículos)' }])
  ws['!cols'] = [
    { wch: 14 },
    { wch: 42 },
    { wch: 22 },
    { wch: 10 },
    { wch: 14 },
    { wch: 14 }
  ]
  XLSX.utils.book_append_sheet(wb, ws, meta.label.slice(0, 31))

  const metaSheet = XLSX.utils.aoa_to_sheet([
    ['Plot Center · Lista de precios'],
    [meta.label, meta.subtitle],
    ['Emitido', emitido],
    ['Incluye', ajustesTxt],
    ['Artículos', filas.length],
    opts.notaFiltros?.trim() ? ['Filtros', opts.notaFiltros.trim()] : ['Filtros', 'Ninguno']
  ])
  XLSX.utils.book_append_sheet(wb, metaSheet, 'Info')

  XLSX.writeFile(wb, `lista-precios-${slugLista(opts.lista)}-${fechaArchivo()}.xlsx`)
}

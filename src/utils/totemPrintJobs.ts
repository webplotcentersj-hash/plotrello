import type { PrintColorDetection, PrintFormat, TotemPrintColorModo, TotemPrintFaz } from './totemPrintDocument'
import { labelPrintFormat, resolveTotemPrintColorQuote } from './totemPrintDocument'
import type { TotemPrintPapelId } from './totemPrintPapel'
import { labelTotemPrintPapel, TOTEM_PRINT_PAPEL_DEFAULT } from './totemPrintPapel'
import type { TotemArchivoItem } from './totemArchivoManifest'

export type TotemPrintJobSpec = {
  key: string
  url: string
  nombre: string
  formato: PrintFormat
  papel: TotemPrintPapelId
  faz: TotemPrintFaz
  modoColor: TotemPrintColorModo
  /** Hojas 1-based a imprimir. */
  hojasSeleccionadas: number[]
  /** Cuántas veces imprimir el set de hojas seleccionado (×1, ×2, ×3…). */
  copias: number
  pageCount: number
  colorDetection?: PrintColorDetection
  colorPagesDetected?: number
  bwPagesDetected?: number
}

export type TotemPrintJobDefaults = {
  formato: PrintFormat
  papel: TotemPrintPapelId
  faz: TotemPrintFaz
  modoColor: TotemPrintColorModo
}

export type TotemPrintJobPayload = {
  url: string
  nombre: string
  formato: PrintFormat
  papel: TotemPrintPapelId
  faz: TotemPrintFaz
  modo_color: TotemPrintColorModo
  hojas: number[]
  copias: number
  page_count: number
  tipo_impresion: string
  color_pages: number
  bw_pages: number
}

export function jobKeyFromArchivo(a: TotemArchivoItem, index: number): string {
  return `${a.url}::${index}`
}

export function createTotemPrintJob(
  archivo: TotemArchivoItem,
  index: number,
  defaults: TotemPrintJobDefaults
): TotemPrintJobSpec {
  return {
    key: jobKeyFromArchivo(archivo, index),
    url: archivo.url,
    nombre: archivo.nombre || `Archivo ${index + 1}`,
    formato: defaults.formato,
    papel: defaults.papel || TOTEM_PRINT_PAPEL_DEFAULT,
    faz: defaults.faz,
    modoColor: defaults.modoColor,
    hojasSeleccionadas: [],
    copias: 1,
    pageCount: 0
  }
}

/** Sincroniza jobs con la lista de archivos conservando opciones previas por URL. */
export function syncTotemPrintJobs(
  archivos: TotemArchivoItem[],
  prev: TotemPrintJobSpec[],
  defaults: TotemPrintJobDefaults
): TotemPrintJobSpec[] {
  return archivos.map((a, index) => {
    const key = jobKeyFromArchivo(a, index)
    const byKey = prev.find((j) => j.key === key)
    const byUrl = prev.find((j) => j.url === a.url)
    const base = byKey || byUrl
    if (base) {
      return {
        ...base,
        key,
        url: a.url,
        nombre: a.nombre || base.nombre || `Archivo ${index + 1}`,
        copias: Math.max(1, Math.min(99, Math.floor(base.copias || 1)))
      }
    }
    return createTotemPrintJob(a, index, defaults)
  })
}

export function allPagesRange(pageCount: number): number[] {
  const n = Math.max(0, Math.floor(pageCount))
  return Array.from({ length: n }, (_, i) => i + 1)
}

export function togglePageInList(pages: number[], page: number): number[] {
  const p = Math.floor(page)
  if (p < 1) return pages
  if (pages.includes(p)) return pages.filter((x) => x !== p)
  return [...pages, p].sort((a, b) => a - b)
}

export function formatHojasResumen(pages: number[], pageCount: number, copias = 1): string {
  const c = Math.max(1, Math.floor(copias || 1))
  let base: string
  if (pageCount <= 0) base = 'Sin hojas'
  else if (pages.length === 0) base = 'Ninguna hoja'
  else if (pages.length === pageCount) base = pageCount === 1 ? '1 hoja' : `Todas (1–${pageCount})`
  else if (pages.length <= 8) base = `Hojas ${pages.join(', ')}`
  else base = `${pages.length} de ${pageCount} hojas`
  if (c <= 1 || pages.length === 0) return base
  return `${base} · ×${c} = ${pages.length * c} impresiones`
}

export function normalizeCopias(raw: unknown): number {
  const n = Math.floor(Number(raw) || 1)
  return Math.max(1, Math.min(99, n))
}

export function quoteForJob(job: TotemPrintJobSpec): {
  tipo_impresion: string
  color_pages: number
  bw_pages: number
  cantidad_hojas: number
} {
  const hojasUnicas = Math.max(0, job.hojasSeleccionadas.length)
  const copias = normalizeCopias(job.copias)
  const hojas = hojasUnicas * copias
  if (hojas < 1) {
    return { tipo_impresion: '', color_pages: 0, bw_pages: 0, cantidad_hojas: 0 }
  }
  const analysis =
    job.colorDetection != null
      ? {
          colorDetection: job.colorDetection,
          colorPages: job.colorPagesDetected ?? 0,
          bwPages: job.bwPagesDetected ?? 0
        }
      : null
  const q = resolveTotemPrintColorQuote({
    formato: job.formato,
    modoColor: job.modoColor,
    cantidadHojas: hojas,
    papel: job.papel,
    faz: job.faz,
    analysis
  })
  return {
    tipo_impresion: q.tipo_impresion,
    color_pages: q.color_pages,
    bw_pages: q.bw_pages,
    cantidad_hojas: hojas
  }
}

export function buildJobsPayload(jobs: TotemPrintJobSpec[]): TotemPrintJobPayload[] {
  return jobs
    .map((job) => {
      const q = quoteForJob(job)
      if (q.cantidad_hojas < 1) return null
      return {
        url: job.url,
        nombre: job.nombre,
        formato: job.formato,
        papel: job.papel,
        faz: job.faz,
        modo_color: job.modoColor,
        hojas: [...job.hojasSeleccionadas].sort((a, b) => a - b),
        copias: normalizeCopias(job.copias),
        page_count: job.pageCount,
        tipo_impresion: q.tipo_impresion,
        color_pages: q.color_pages,
        bw_pages: q.bw_pages
      } satisfies TotemPrintJobPayload
    })
    .filter((x): x is TotemPrintJobPayload => x != null)
}

export function summarizeJobsTipoImpresion(jobs: TotemPrintJobSpec[]): string {
  const active = jobs.filter((j) => j.hojasSeleccionadas.length > 0)
  if (active.length === 0) return ''
  if (active.length === 1) {
    const q = quoteForJob(active[0])
    return `${q.tipo_impresion} · ${formatHojasResumen(active[0].hojasSeleccionadas, active[0].pageCount, active[0].copias)}`
  }
  const parts = active.map((j, i) => {
    const q = quoteForJob(j)
    return `${j.nombre || `Archivo ${i + 1}`}: ${q.tipo_impresion} (${formatHojasResumen(j.hojasSeleccionadas, j.pageCount, j.copias)})`
  })
  const totalHojas = totalHojasSeleccionadas(active)
  return `${active.length} archivos · ${totalHojas} hojas | ${parts.join(' · ')}`
}

export function totalHojasSeleccionadas(jobs: TotemPrintJobSpec[]): number {
  return jobs.reduce((s, j) => s + j.hojasSeleccionadas.length * normalizeCopias(j.copias), 0)
}

export function jobLabelCorto(job: TotemPrintJobSpec): string {
  const c = normalizeCopias(job.copias)
  return [
    labelPrintFormat(job.formato),
    labelTotemPrintPapel(job.papel),
    job.faz === 'doble' ? 'Doble faz' : 'Simple faz',
    job.modoColor === 'bn' ? 'B/N' : job.modoColor === 'color' ? 'Color' : 'Auto',
    c > 1 ? `×${c}` : null
  ]
    .filter(Boolean)
    .join(' · ')
}

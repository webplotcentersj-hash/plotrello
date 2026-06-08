import {
  differenceInMonths,
  eachMonthOfInterval,
  format,
  parseISO,
  startOfMonth,
  subMonths
} from 'date-fns'
import { es } from 'date-fns/locale'
import type { UsuarioBajaLog } from '../types/api'
import { etiquetaTipoDesvinculacion } from './rrhhBajaCatalog'

export type LegajoContextoBaja = {
  sector: string
  fecha_ingreso: string | null
}

export type PeriodoDesvinculaciones = '12m' | '24m' | '36m' | 'todo'

export type BajaDetalleRow = {
  id: number
  id_usuario: number
  nombre: string
  fechaDesvinculacion: string
  tipoLabel: string
  motivo: string
  sector: string
  antiguedadMeses: number | null
  antiguedadLabel: string
}

export type EstadisticasDesvinculaciones = {
  totalBajas: number
  antiguedadPromedioMeses: number | null
  antiguedadPromedioLabel: string
  tipoMasFrecuente: string | null
  sectorMasAfectado: string | null
  porTipo: { tipo: string; label: string; cantidad: number; pct: number }[]
  porSector: { sector: string; cantidad: number; pct: number }[]
  evolucionMensual: { mes: string; mesLabel: string; cantidad: number }[]
  filasDetalle: BajaDetalleRow[]
}

const ROL_A_SECTOR: Record<string, string> = {
  administracion: 'Administración',
  gerencia: 'Gerencia',
  'recursos-humanos': 'Recursos Humanos',
  diseno: 'Diseño',
  imprenta: 'Imprenta',
  'taller-grafico': 'Taller Gráfico',
  instalaciones: 'Instalaciones',
  metalurgica: 'Metalúrgica',
  caja: 'Caja',
  mostrador: 'Mostrador',
  compras: 'Compras',
  'asesor-tecnico': 'Asesor técnico',
  presupuestos: 'Presupuestos'
}

export function fechaBajaRegistro(b: UsuarioBajaLog): Date {
  const raw = b.fecha_desvinculacion || b.created_at.slice(0, 10)
  return parseISO(raw)
}

export function fmtAntiguedad(meses: number | null): string {
  if (meses == null || !Number.isFinite(meses) || meses < 0) return 'Sin dato'
  if (meses < 1) return '< 1 mes'
  const años = Math.floor(meses / 12)
  const m = Math.round(meses % 12)
  if (años === 0) return `${m} mes${m === 1 ? '' : 'es'}`
  if (m === 0) return `${años} año${años === 1 ? '' : 's'}`
  return `${años} año${años === 1 ? '' : 's'} ${m} mes${m === 1 ? '' : 'es'}`
}

function sectorDesdeBaja(
  b: UsuarioBajaLog,
  legajos: Record<number, LegajoContextoBaja>
): string {
  const leg = legajos[b.id_usuario]
  if (leg?.sector?.trim()) return leg.sector.trim()
  if (b.rol_snapshot && ROL_A_SECTOR[b.rol_snapshot]) return ROL_A_SECTOR[b.rol_snapshot]
  return 'Sin sector'
}

function antiguedadMeses(
  b: UsuarioBajaLog,
  legajos: Record<number, LegajoContextoBaja>
): number | null {
  const ingreso = legajos[b.id_usuario]?.fecha_ingreso
  if (!ingreso) return null
  try {
    const fi = parseISO(ingreso.slice(0, 10))
    const fb = fechaBajaRegistro(b)
    const meses = differenceInMonths(fb, fi)
    return meses >= 0 ? meses : null
  } catch {
    return null
  }
}

export function filtrarBajasPorPeriodo(
  bajas: UsuarioBajaLog[],
  periodo: PeriodoDesvinculaciones
): UsuarioBajaLog[] {
  if (periodo === 'todo') return bajas
  const meses = periodo === '12m' ? 12 : periodo === '24m' ? 24 : 36
  const desde = subMonths(startOfMonth(new Date()), meses - 1)
  return bajas.filter((b) => fechaBajaRegistro(b) >= desde)
}

function agruparConteo(
  items: string[],
  ordenar: 'desc' = 'desc'
): { clave: string; cantidad: number; pct: number }[] {
  const map = new Map<string, number>()
  for (const k of items) {
    map.set(k, (map.get(k) ?? 0) + 1)
  }
  const total = items.length
  const rows = [...map.entries()].map(([clave, cantidad]) => ({
    clave,
    cantidad,
    pct: total > 0 ? Math.round((cantidad / total) * 1000) / 10 : 0
  }))
  rows.sort((a, b) => (ordenar === 'desc' ? b.cantidad - a.cantidad : a.cantidad - b.cantidad))
  return rows
}

export function calcularEstadisticasDesvinculaciones(
  bajas: UsuarioBajaLog[],
  legajos: Record<number, LegajoContextoBaja>,
  periodo: PeriodoDesvinculaciones
): EstadisticasDesvinculaciones {
  const filtradas = filtrarBajasPorPeriodo(bajas, periodo)
  const total = filtradas.length

  const sectores = filtradas.map((b) => sectorDesdeBaja(b, legajos))
  const tipos = filtradas.map((b) => {
    const t = b.tipo_desvinculacion?.trim()
    return t || 'otro'
  })

  const antiguedades = filtradas
    .map((b) => antiguedadMeses(b, legajos))
    .filter((m): m is number => m != null)

  const antiguedadPromedioMeses =
    antiguedades.length > 0
      ? Math.round((antiguedades.reduce((s, m) => s + m, 0) / antiguedades.length) * 10) / 10
      : null

  const porTipoRaw = agruparConteo(tipos)
  const porTipo = porTipoRaw.map((r) => ({
    tipo: r.clave,
    label: etiquetaTipoDesvinculacion(r.clave),
    cantidad: r.cantidad,
    pct: r.pct
  }))

  const porSectorRaw = agruparConteo(sectores)
  const porSector = porSectorRaw.map((r) => ({
    sector: r.clave,
    cantidad: r.cantidad,
    pct: r.pct
  }))

  const now = new Date()
  const mesesIntervalo =
    periodo === 'todo'
      ? eachMonthOfInterval({
          start: startOfMonth(
            filtradas.length > 0
              ? filtradas.reduce(
                  (min, b) => (fechaBajaRegistro(b) < min ? fechaBajaRegistro(b) : min),
                  fechaBajaRegistro(filtradas[0])
                )
              : subMonths(now, 11)
          ),
          end: startOfMonth(now)
        })
      : eachMonthOfInterval({
          start: startOfMonth(
            subMonths(now, periodo === '12m' ? 11 : periodo === '24m' ? 23 : 35)
          ),
          end: startOfMonth(now)
        })

  const conteoPorMes = new Map<string, number>()
  for (const m of mesesIntervalo) {
    conteoPorMes.set(format(m, 'yyyy-MM'), 0)
  }
  for (const b of filtradas) {
    const key = format(startOfMonth(fechaBajaRegistro(b)), 'yyyy-MM')
    if (conteoPorMes.has(key)) {
      conteoPorMes.set(key, (conteoPorMes.get(key) ?? 0) + 1)
    }
  }

  const evolucionMensual = [...conteoPorMes.entries()].map(([mes, cantidad]) => ({
    mes,
    mesLabel: format(parseISO(`${mes}-01`), 'MMM yyyy', { locale: es }),
    cantidad
  }))

  const filasDetalle: BajaDetalleRow[] = [...filtradas]
    .sort((a, b) => fechaBajaRegistro(b).getTime() - fechaBajaRegistro(a).getTime())
    .map((b) => {
      const meses = antiguedadMeses(b, legajos)
      const tipo = b.tipo_desvinculacion?.trim() || 'otro'
      return {
        id: b.id,
        id_usuario: b.id_usuario,
        nombre: b.nombre_snapshot,
        fechaDesvinculacion: format(fechaBajaRegistro(b), 'd MMM yyyy', { locale: es }),
        tipoLabel: etiquetaTipoDesvinculacion(tipo),
        motivo: b.motivo,
        sector: sectorDesdeBaja(b, legajos),
        antiguedadMeses: meses,
        antiguedadLabel: fmtAntiguedad(meses)
      }
    })

  return {
    totalBajas: total,
    antiguedadPromedioMeses,
    antiguedadPromedioLabel: fmtAntiguedad(antiguedadPromedioMeses),
    tipoMasFrecuente: porTipo[0]?.label ?? null,
    sectorMasAfectado: porSector[0]?.sector ?? null,
    porTipo,
    porSector,
    evolucionMensual,
    filasDetalle
  }
}

export function labelPeriodoDesvinculaciones(p: PeriodoDesvinculaciones): string {
  if (p === '12m') return 'Últimos 12 meses'
  if (p === '24m') return 'Últimos 24 meses'
  if (p === '36m') return 'Últimos 36 meses'
  return 'Histórico completo'
}

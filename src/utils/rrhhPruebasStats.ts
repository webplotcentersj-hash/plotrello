import { parseISO } from 'date-fns'
import type { Capacitacion } from '../types/api'
import type { PruebaAsignacionColaborador } from '../types/api'
import { competenciasDeCapacitacion, esCapacitacionCompletada, etiquetaCompetencia } from './rrhhCapacitacionCompetencias'
import { etiquetaTematicaPrueba, tematicaDePrueba } from './rrhhPruebaTematica'

export type EvolucionTematicaPrueba = {
  tematica: string
  tematicaLabel: string
  cantidad: number
  promedioPct: number
  ultimaFecha: string | null
}

export type PuntoEvolucionPrueba = {
  fecha: string
  fechaLabel: string
  titulo: string
  tematicaLabel: string
  pct: number
  aprobado: boolean
}

export type VinculoFormacionPrueba = {
  capacitacionTitulo: string
  pruebaTitulo: string
  competencia: string
  pctPrueba: number | null
  aprobado: boolean
}

export type IndicadoresPruebasLegajo = {
  asignadas: number
  realizadas: number
  aprobadas: number
  tasaAprobacionPct: number
  promedioPct: number | null
  ultimaEvaluacion: string | null
  ultimaEvaluacionLabel: string | null
  porTematica: EvolucionTematicaPrueba[]
  evolucionHistorica: PuntoEvolucionPrueba[]
  vinculosFormacion: VinculoFormacionPrueba[]
}

export function esPruebaRealizada(p: PruebaAsignacionColaborador): boolean {
  return p.estado === 'finalizada' || !!p.finalizado_at
}

export function pctPrueba(p: PruebaAsignacionColaborador): number | null {
  const ob = Number(p.puntaje_obtenido)
  const max = Number(p.puntaje_maximo)
  if (!Number.isFinite(ob) || !Number.isFinite(max) || max <= 0) return null
  return Math.round((ob / max) * 1000) / 10
}

export function calcularIndicadoresPruebas(
  pruebas: PruebaAsignacionColaborador[],
  capacitaciones: Capacitacion[] = []
): IndicadoresPruebasLegajo {
  const asignadas = pruebas.length
  const realizadasList = pruebas.filter(esPruebaRealizada)
  const realizadas = realizadasList.length
  const aprobadas = realizadasList.filter((p) => p.aprobado === true).length

  const pcts = realizadasList.map(pctPrueba).filter((n): n is number => n != null)
  const promedioPct =
    pcts.length > 0 ? Math.round((pcts.reduce((a, b) => a + b, 0) / pcts.length) * 10) / 10 : null

  const tasaAprobacionPct =
    realizadas > 0 ? Math.round((aprobadas / realizadas) * 1000) / 10 : 0

  let ultimaEvaluacion: string | null = null
  for (const p of realizadasList) {
    const f = p.finalizado_at
    if (!f) continue
    if (!ultimaEvaluacion || f > ultimaEvaluacion) ultimaEvaluacion = f
  }

  const porTematicaMap = new Map<string, { pcts: number[]; fechas: string[] }>()
  for (const p of realizadasList) {
    const tem = tematicaDePrueba(p.titulo, p.descripcion)
    const pct = pctPrueba(p)
    const entry = porTematicaMap.get(tem) ?? { pcts: [], fechas: [] }
    if (pct != null) entry.pcts.push(pct)
    if (p.finalizado_at) entry.fechas.push(p.finalizado_at)
    porTematicaMap.set(tem, entry)
  }

  const porTematica: EvolucionTematicaPrueba[] = [...porTematicaMap.entries()]
    .map(([tematica, data]) => ({
      tematica,
      tematicaLabel: etiquetaTematicaPrueba(tematica),
      cantidad: data.pcts.length,
      promedioPct:
        data.pcts.length > 0
          ? Math.round((data.pcts.reduce((a, b) => a + b, 0) / data.pcts.length) * 10) / 10
          : 0,
      ultimaFecha: data.fechas.length > 0 ? data.fechas.sort().at(-1)! : null
    }))
    .sort((a, b) => b.cantidad - a.cantidad)

  const evolucionHistorica: PuntoEvolucionPrueba[] = realizadasList
    .filter((p) => p.finalizado_at && pctPrueba(p) != null)
    .map((p) => {
      const tem = tematicaDePrueba(p.titulo, p.descripcion)
      const pct = pctPrueba(p)!
      let fechaLabel = p.finalizado_at!
      try {
        fechaLabel = parseISO(p.finalizado_at!.slice(0, 10)).toLocaleDateString('es-AR', {
          day: '2-digit',
          month: 'short',
          year: 'numeric'
        })
      } catch {
        /* keep raw */
      }
      return {
        fecha: p.finalizado_at!,
        fechaLabel,
        titulo: p.titulo,
        tematicaLabel: etiquetaTematicaPrueba(tem),
        pct,
        aprobado: p.aprobado === true
      }
    })
    .sort((a, b) => a.fecha.localeCompare(b.fecha))

  const vinculosFormacion: VinculoFormacionPrueba[] = []
  const capsCompletadas = capacitaciones.filter(esCapacitacionCompletada)

  for (const cap of capsCompletadas) {
    const comps = competenciasDeCapacitacion(cap)
    for (const pr of realizadasList) {
      const temPrueba = tematicaDePrueba(pr.titulo, pr.descripcion)
      const tituloCap = cap.titulo.toLowerCase()
      const tituloPr = pr.titulo.toLowerCase()
      const matchTitulo =
        tituloCap.includes(tituloPr.slice(0, 12)) ||
        tituloPr.includes(tituloCap.slice(0, 12)) ||
        (cap.categoria &&
          temPrueba !== 'general' &&
          tematicaDePrueba(cap.categoria, cap.titulo) === temPrueba)

      const matchComp = comps.some((c) => {
        const temMap: Record<string, string> = {
          seguridad_higiene: 'seguridad',
          calidad: 'calidad',
          operativa_produccion: 'operativa',
          atencion_cliente: 'atencion',
          tecnologia: 'tecnologia',
          comercial: 'comercial',
          rrhh_normativa: 'normativa',
          liderazgo: 'liderazgo'
        }
        return temMap[c] === temPrueba
      })

      if (matchTitulo || matchComp) {
        vinculosFormacion.push({
          capacitacionTitulo: cap.titulo,
          pruebaTitulo: pr.titulo,
          competencia: comps.map(etiquetaCompetencia).join(', ') || etiquetaTematicaPrueba(temPrueba),
          pctPrueba: pctPrueba(pr),
          aprobado: pr.aprobado === true
        })
      }
    }
  }

  const uniq = new Map<string, VinculoFormacionPrueba>()
  for (const v of vinculosFormacion) {
    uniq.set(`${v.capacitacionTitulo}::${v.pruebaTitulo}`, v)
  }

  let ultimaEvaluacionLabel: string | null = null
  if (ultimaEvaluacion) {
    try {
      ultimaEvaluacionLabel = parseISO(ultimaEvaluacion.slice(0, 10)).toLocaleDateString('es-AR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      })
    } catch {
      ultimaEvaluacionLabel = ultimaEvaluacion.slice(0, 10)
    }
  }

  return {
    asignadas,
    realizadas,
    aprobadas,
    tasaAprobacionPct,
    promedioPct,
    ultimaEvaluacion,
    ultimaEvaluacionLabel,
    porTematica,
    evolucionHistorica,
    vinculosFormacion: [...uniq.values()]
  }
}

export function fmtPctPrueba(n: number) {
  return `${n.toFixed(1).replace('.', ',')}%`
}

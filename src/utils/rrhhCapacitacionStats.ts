import type { Capacitacion } from '../types/api'
import {
  competenciasDesarrolladas,
  esCapacitacionAsignada,
  esCapacitacionCompletada,
  resolverPerfilPuesto
} from './rrhhCapacitacionCompetencias'

export type IndicadoresCapacitacionLegajo = {
  asignadas: number
  completadas: number
  horasAcumuladas: number
  cumplimientoPct: number
  cumplimientoPlanPct: number
  promedioCalificacion: number | null
  obligatoriasAsignadas: number
  obligatoriasCompletadas: number
  competenciasDesarrolladas: string[]
  perfil: ReturnType<typeof resolverPerfilPuesto>
  brechaCompetencias: string[]
  coberturaPerfilPct: number | null
}

export function calcularIndicadoresCapacitacion(
  capacitaciones: Capacitacion[],
  sectorLegajo?: string | null,
  rol?: string | null
): IndicadoresCapacitacionLegajo {
  const asignadasList = capacitaciones.filter(esCapacitacionAsignada)
  const completadasList = asignadasList.filter(esCapacitacionCompletada)

  const obligatoriasAsignadas = asignadasList.filter((c) => c.es_obligatoria).length
  const obligatoriasCompletadas = completadasList.filter((c) => c.es_obligatoria).length

  const horasAcumuladas = completadasList.reduce(
    (sum, c) => sum + (Number(c.duracion_horas) || 0),
    0
  )

  const calificaciones = completadasList
    .map((c) => c.calificacion)
    .filter((n): n is number => n != null && Number.isFinite(n))

  const promedioCalificacion =
    calificaciones.length > 0
      ? Math.round((calificaciones.reduce((a, b) => a + b, 0) / calificaciones.length) * 10) / 10
      : null

  const asignadas = asignadasList.length
  const completadas = completadasList.length

  const cumplimientoPct = asignadas > 0 ? Math.round((completadas / asignadas) * 1000) / 10 : 0
  const cumplimientoPlanPct =
    obligatoriasAsignadas > 0
      ? Math.round((obligatoriasCompletadas / obligatoriasAsignadas) * 1000) / 10
      : cumplimientoPct

  const desarrolladas = competenciasDesarrolladas(completadasList)
  const perfil = resolverPerfilPuesto(sectorLegajo, rol)

  let brechaCompetencias: string[] = []
  let coberturaPerfilPct: number | null = null
  if (perfil && perfil.competenciasEsperadas.length > 0) {
    const desarrolladasSet = new Set(desarrolladas)
    brechaCompetencias = perfil.competenciasEsperadas.filter((id) => !desarrolladasSet.has(id))
    const cubiertas = perfil.competenciasEsperadas.filter((id) => desarrolladasSet.has(id)).length
    coberturaPerfilPct =
      Math.round((cubiertas / perfil.competenciasEsperadas.length) * 1000) / 10
  }

  return {
    asignadas,
    completadas,
    horasAcumuladas,
    cumplimientoPct,
    cumplimientoPlanPct,
    promedioCalificacion,
    obligatoriasAsignadas,
    obligatoriasCompletadas,
    competenciasDesarrolladas: desarrolladas,
    perfil,
    brechaCompetencias,
    coberturaPerfilPct
  }
}

export function fmtPct(n: number) {
  return `${n.toFixed(1).replace('.', ',')}%`
}

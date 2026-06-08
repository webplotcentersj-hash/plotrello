import { eachMonthOfInterval, format, startOfMonth, subMonths } from 'date-fns'
import { es } from 'date-fns/locale'
import type { RrhhNovedad } from '../types/api'
import {
  clasificarNovedadLegajo,
  diasNovedad,
  diasNovedadEnMes,
  esDisciplinaria,
  esLicenciaMedica,
  novedadEnMes,
  type NovedadClasificacionLegajo
} from './rrhhNovedadClasificacionLegajo'

export type PuntoEvolucionNovedad = {
  mes: string
  mesLabel: string
  ausentismoDias: number
  tardanzas: number
  disciplinarias: number
  licenciasDias: number
  totalEventos: number
}

const DIAS_LABORABLES_MES = 22

export function calcularEvolucionHistoricaNovedades(
  novedades: RrhhNovedad[],
  meses = 12,
  ref: Date = new Date()
): PuntoEvolucionNovedad[] {
  const fin = startOfMonth(ref)
  const inicio = subMonths(fin, meses - 1)
  const intervalo = eachMonthOfInterval({ start: inicio, end: fin })

  return intervalo.map((mesDate) => {
    let ausentismoDias = 0
    let tardanzas = 0
    let disciplinarias = 0
    let licenciasDias = 0
    let totalEventos = 0

    for (const n of novedades) {
      if (!novedadEnMes(n, mesDate)) continue
      totalEventos++
      const clas = clasificarNovedadLegajo(n)
      if (clas === 'llegada_tarde') tardanzas++
      if (esDisciplinaria(n)) disciplinarias++
      if (esLicenciaMedica(n)) licenciasDias += diasNovedadEnMes(n, mesDate)
      if (clas === 'ausencia_injustificada' || clas === 'licencia_medica') {
        ausentismoDias += diasNovedadEnMes(n, mesDate)
      }
    }

    return {
      mes: format(mesDate, 'yyyy-MM'),
      mesLabel: format(mesDate, 'MMM yy', { locale: es }),
      ausentismoDias,
      tardanzas,
      disciplinarias,
      licenciasDias,
      totalEventos
    }
  })
}

export function indiceAusentismoPct(diasAusencia: number, headcount: number): number {
  if (headcount <= 0) return 0
  return Math.round((diasAusencia / (headcount * DIAS_LABORABLES_MES)) * 1000) / 10
}

export type AlertaNovedadLegajo = {
  nivel: 'info' | 'warning' | 'critical'
  mensaje: string
}

export type IndicadoresNovedadesLegajo = {
  ausentismoMesDias: number
  ausentismoMesEventos: number
  llegadasTardeMes: number
  llegadasTardeTotal: number
  licenciasMedicasDias: number
  licenciasMedicasEventos: number
  disciplinariasMes: number
  disciplinariasAnio: number
  porClasificacion: Partial<Record<NovedadClasificacionLegajo, number>>
  alertas: AlertaNovedadLegajo[]
}

export function calcularIndicadoresNovedadesLegajo(
  novedades: RrhhNovedad[],
  ref: Date = new Date()
): IndicadoresNovedadesLegajo {
  const hace12 = subMonths(ref, 12)

  let ausentismoMesDias = 0
  let ausentismoMesEventos = 0
  let llegadasTardeMes = 0
  let llegadasTardeTotal = 0
  let licenciasMedicasDias = 0
  let licenciasMedicasEventos = 0
  let disciplinariasMes = 0
  let disciplinariasAnio = 0

  const porClasificacion: Partial<Record<NovedadClasificacionLegajo, number>> = {}

  for (const n of novedades) {
    const clas = clasificarNovedadLegajo(n)
    porClasificacion[clas] = (porClasificacion[clas] ?? 0) + 1

    if (clas === 'llegada_tarde') {
      llegadasTardeTotal++
      if (novedadEnMes(n, ref)) llegadasTardeMes++
    }

    if (esLicenciaMedica(n)) {
      licenciasMedicasDias += diasNovedad(n)
      licenciasMedicasEventos++
    }

    if (clas === 'ausencia_injustificada' || clas === 'licencia_medica') {
      if (novedadEnMes(n, ref)) {
        ausentismoMesDias += diasNovedadEnMes(n, ref)
        ausentismoMesEventos++
      }
    }

    if (esDisciplinaria(n)) {
      if (novedadEnMes(n, ref)) disciplinariasMes++
      try {
        const desde = new Date(n.fecha_desde.slice(0, 10))
        if (desde >= hace12) disciplinariasAnio++
      } catch {
        disciplinariasAnio++
      }
    }
  }

  const alertas: AlertaNovedadLegajo[] = []

  if (ausentismoMesDias >= 3) {
    alertas.push({
      nivel: ausentismoMesDias >= 5 ? 'critical' : 'warning',
      mensaje: `Ausentismo elevado este mes: ${ausentismoMesDias} día${ausentismoMesDias === 1 ? '' : 's'} registrado${ausentismoMesDias === 1 ? '' : 's'}.`
    })
  }

  if (llegadasTardeMes >= 3) {
    alertas.push({
      nivel: llegadasTardeMes >= 5 ? 'critical' : 'warning',
      mensaje: `${llegadasTardeMes} llegada${llegadasTardeMes === 1 ? '' : 's'} tarde este mes.`
    })
  }

  if (disciplinariasAnio >= 2) {
    alertas.push({
      nivel: disciplinariasAnio >= 4 ? 'critical' : 'warning',
      mensaje: `${disciplinariasAnio} novedad${disciplinariasAnio === 1 ? '' : 'es'} disciplinaria${disciplinariasAnio === 1 ? '' : 's'} en los últimos 12 meses.`
    })
  }

  if (licenciasMedicasDias >= 15) {
    alertas.push({
      nivel: 'info',
      mensaje: `Licencias médicas acumuladas: ${licenciasMedicasDias} días en el historial.`
    })
  }

  if (disciplinariasMes >= 1 && disciplinariasMes < 2) {
    alertas.push({
      nivel: 'info',
      mensaje: `${disciplinariasMes} novedad disciplinaria registrada este mes.`
    })
  }

  return {
    ausentismoMesDias,
    ausentismoMesEventos,
    llegadasTardeMes,
    llegadasTardeTotal,
    licenciasMedicasDias,
    licenciasMedicasEventos,
    disciplinariasMes,
    disciplinariasAnio,
    porClasificacion,
    alertas
  }
}

import {
  clasificarPlanillaPorContenido,
  filtrarMovimientosDuplicados,
  TIPO_PLANILLA_LABEL,
  type TipoPlanillaDetectado
} from './cajaCoherencia'
import { resolverDestinoPlanilla } from './cajaPlanillaRouter'
import { resolverCajaSlugImport } from './cajaOperativa'
import {
  listCajas,
  listMovimientos,
  planillaYaImportada,
  saveMovimientosBulk,
  savePlanillaImport
} from './cajaRepository'
import { netoCtaCteDesdePlanilla, efectivoQuedaEnCajaDesdePlanilla } from './cajaTotales'
import { fmtArs } from './format'
import type { PlanillaCajaParsed } from './parsePlanillaCajaPdf'
import { fechaPlanillaImport, planillaAllToMovimientos, resumenImportacion } from './planillaMovimientos'
import { syncEgresosSolicitudesDesdePlanilla } from './planillaEgresosSync'
import type { CajaSectionId } from './types'

export type ImportarPlanillaResult = {
  success: boolean
  error?: string
  mensaje?: string
  planilla: PlanillaCajaParsed
  tipo: TipoPlanillaDetectado
  destino: CajaSectionId
  destinoTitulo: string
  destinoExplicacion: string
  movimientosNuevos: number
  omitidos: number
  yaExistiaArchivo: boolean
  planillaId?: string
}

async function resolverCajaSlugPlanilla(
  parsed: PlanillaCajaParsed,
  usuarioNombre: string,
  usuarioId?: number,
  esAdmin?: boolean
): Promise<string | null> {
  const cajas = await listCajas()
  return resolverCajaSlugImport({
    usuarioId,
    usuarioNombre,
    cajaNombrePdf: parsed.caja_nombre,
    cajas,
    esAdmin
  })
}

/** Lee el PDF, importa movimientos sin duplicar y resuelve a qué sección del módulo corresponde. */
export async function importarPlanillaAlSistema(input: {
  planilla: PlanillaCajaParsed
  usuarioNombre: string
  usuarioId?: number
  estadoOperativa?: { arqueoHecho?: boolean; cierreTurnoHecho?: boolean }
  onProgress?: (msg: string) => void
  permitirArchivoDuplicado?: boolean
  esAdmin?: boolean
}): Promise<ImportarPlanillaResult> {
  const { planilla, usuarioNombre, usuarioId, estadoOperativa, onProgress, permitirArchivoDuplicado, esAdmin } =
    input

  const tipo = clasificarPlanillaPorContenido(planilla)
  const destino = resolverDestinoPlanilla(planilla, estadoOperativa)

  const cajas = await listCajas()
  const cajaSlug = await resolverCajaSlugPlanilla(planilla, usuarioNombre, usuarioId, esAdmin)
  if (!cajaSlug) {
    return {
      success: false,
      error: 'No se pudo determinar la caja del usuario mostrador o el nombre en el PDF.',
      planilla,
      tipo,
      destino: destino.section,
      destinoTitulo: destino.titulo,
      destinoExplicacion: destino.explicacion,
      movimientosNuevos: 0,
      omitidos: 0,
      yaExistiaArchivo: false
    }
  }

  const yaExistiaArchivo = await planillaYaImportada(planilla, cajaSlug)
  if (yaExistiaArchivo && !permitirArchivoDuplicado) {
    return {
      success: true,
      mensaje: `«${planilla.archivo_nombre}» ya estaba importada. Te llevamos a ${destino.titulo}.`,
      planilla,
      tipo,
      destino: destino.section,
      destinoTitulo: destino.titulo,
      destinoExplicacion: destino.explicacion,
      movimientosNuevos: 0,
      omitidos: 0,
      yaExistiaArchivo: true
    }
  }

  let planillaId: string | undefined
  if (!yaExistiaArchivo) {
    onProgress?.('Guardando planilla…')
    const guardada = await savePlanillaImport(planilla, cajaSlug, usuarioNombre, usuarioId)
    planillaId = guardada.id
  }

  const fechaImp = fechaPlanillaImport(planilla)
  const todosMovs = planillaAllToMovimientos(planilla, cajas, cajaSlug, usuarioNombre, usuarioId)
  const existentes = await listMovimientos()
  const delDia = existentes.filter(
    (m) =>
      m.fecha === fechaImp && (m.destino_slug === cajaSlug || m.origen_slug === cajaSlug)
  )
  const { nuevos: movs, omitidos } = filtrarMovimientosDuplicados(todosMovs, delDia, {
    cajaSlug,
    fecha: fechaImp
  })

  if (movs.length) {
    onProgress?.(`Importando ${movs.length} movimiento(s)…`)
    const bulk = await saveMovimientosBulk(movs, { cajas })
    await syncEgresosSolicitudesDesdePlanilla({
      planilla,
      cajaSlug,
      fecha: fechaImp,
      usuarioNombre,
      usuarioId,
      movimientos: bulk.records
    })
  } else if (!yaExistiaArchivo && todosMovs.length === 0) {
    return {
      success: false,
      error: 'No se detectaron líneas con montos (FA, IV/IN, EG, MEC).',
      planilla,
      tipo,
      destino: destino.section,
      destinoTitulo: destino.titulo,
      destinoExplicacion: destino.explicacion,
      movimientosNuevos: 0,
      omitidos: 0,
      yaExistiaArchivo: false,
      planillaId
    }
  }

  const r = resumenImportacion(movs)
  const efectivoQ = efectivoQuedaEnCajaDesdePlanilla(planilla)
  const ctaCte = netoCtaCteDesdePlanilla(planilla)

  let mensaje = `Detectado: ${TIPO_PLANILLA_LABEL[tipo]}. `
  if (r.total > 0) {
    mensaje += `${r.total} mov. nuevos (${r.ventas} ventas, ${r.egresos} egresos). `
  } else if (omitidos.length) {
    mensaje += 'Sin movimientos nuevos (comprobantes ya registrados). '
  }
  if (omitidos.length) mensaje += `${omitidos.length} duplicado(s) omitido(s). `
  if (efectivoQ > 0 && destino.section === 'arqueo') {
    mensaje += `Efectivo en caja: $ ${fmtArs(efectivoQ)}. `
  }
  if (Math.abs(ctaCte) > 0) mensaje += `Cta. cte.: $ ${fmtArs(ctaCte)}. `
  mensaje += destino.explicacion

  return {
    success: true,
    mensaje,
    planilla,
    tipo,
    destino: destino.section,
    destinoTitulo: destino.titulo,
    destinoExplicacion: destino.explicacion,
    movimientosNuevos: r.total,
    omitidos: omitidos.length,
    yaExistiaArchivo,
    planillaId
  }
}

import type { Task } from '../types/board'
import type { OrdenTrabajo } from '../types/api'

/** Quita de un payload de update lo que no debe pisarse en las fichas hermanas (otro sector / misma OP). */
export function stripPayloadForEspejoGrupo(payload: Partial<OrdenTrabajo>): Partial<OrdenTrabajo> {
  const out: Partial<OrdenTrabajo> = { ...payload }
  const del = [
    'id',
    'estado',
    'sector',
    'sector_inicial',
    'fecha_creacion',
    'fecha_ingreso',
    'etapa_taller_grafico',
    'etapa_taller_grafico_fecha_inicio',
    'etapa_instalaciones',
    'etapa_instalaciones_fecha_inicio',
    'etapa_taller_imprenta',
    'etapa_taller_imprenta_fecha_inicio',
    'etapa_impresion_digital',
    'etapa_impresion_digital_fecha_inicio',
    'etapa_metalurgica',
    'etapa_metalurgica_fecha_inicio',
    'es_duplicado',
    'id_orden_original',
    'numero_op',
    'entregado',
    'fecha_entrega_efectiva',
    'eliminada',
    'visible_en_tablero'
  ] as const
  for (const k of del) {
    delete (out as Record<string, unknown>)[k]
  }
  return out
}

/** Campos de la ficha que se replican a las demás filas de la misma OP (otros sectores); no columna ni etapas por sector. */
export function mergeEspejoSiblingTask(sibling: Task, source: Task): Task {
  return {
    ...sibling,
    title: source.title,
    summary: source.summary,
    priority: source.priority,
    impact: source.impact,
    dueDate: source.dueDate,
    materials: [...source.materials],
    tags: [...source.tags],
    clientPhone: source.clientPhone,
    clientEmail: source.clientEmail,
    clientAddress: source.clientAddress,
    whatsappUrl: source.whatsappUrl,
    locationUrl: source.locationUrl,
    driveUrl: source.driveUrl,
    photoUrl: source.photoUrl,
    briefPublico: source.briefPublico,
    objetivoProyecto: source.objetivoProyecto,
    publicoObjetivo: source.publicoObjetivo,
    estiloDiseno: source.estiloDiseno,
    referencias: source.referencias,
    deadlineBrief: source.deadlineBrief,
    planillaPreliminar: source.planillaPreliminar,
    fichaTecnicaPdfUrl: source.fichaTecnicaPdfUrl,
    fichaTecnicaCargada: source.fichaTecnicaCargada,
    fichaTecnicaIncompleta: source.fichaTecnicaIncompleta,
    presupuestoEnviadoCliente: source.presupuestoEnviadoCliente,
    presupuestoArmado: source.presupuestoArmado,
    presupuestoEnEspera: source.presupuestoEnEspera,
    galeriaCarrusel: source.galeriaCarrusel ? [...source.galeriaCarrusel] : source.galeriaCarrusel,
    opBloqueada: source.opBloqueada,
    espejoSectoresOp: source.espejoSectoresOp,
    dniCuit: source.dniCuit,
    ownerId: source.ownerId,
    workingUser: source.workingUser,
    tipoImpresion: source.tipoImpresion,
    metrosCuadrados: source.metrosCuadrados,
    lineasMetrosM2: source.lineasMetrosM2 ? source.lineasMetrosM2.map((r) => ({ ...r })) : source.lineasMetrosM2,
    sectores: source.sectores ? [...source.sectores] : source.sectores,
    updatedAt: new Date().toISOString()
  }
}

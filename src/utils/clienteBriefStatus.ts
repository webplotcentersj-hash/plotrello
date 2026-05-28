/** Estado del brief para el portal cliente (etiquetas claras, sin jerga interna). */

export type BriefStatusInput = {
  id: number
  completado: boolean
  id_orden_asociada?: number | null
  numero_op?: string | null
  estado?: string | null
}

export type BriefFase = 'borrador' | 'enviado' | 'produccion' | 'entregado'

export type ClienteBriefStatus = {
  fase: BriefFase
  /** Texto corto en el badge */
  label: string
  /** Una línea que explica qué sigue */
  hint: string
  accent: string
  /** Paso actual 1–4 para la barra de progreso */
  step: 1 | 2 | 3 | 4
}

const OP_ESTADO_CLIENTE: Record<string, string> = {
  Pendiente: 'Recibimos tu pedido',
  'Asesor Técnico': 'Revisando tu pedido',
  Presupuestos: 'Preparando presupuesto',
  'Finalizado Asesor Presupuestos': 'Presupuesto listo',
  'Diseño Gráfico': 'Diseñando',
  'Diseño en Proceso': 'Diseñando',
  'En Espera': 'En cola de producción',
  'Imprenta (Área de Impresión)': 'Imprimiendo',
  'Taller de Imprenta': 'En imprenta',
  'Taller Gráfico': 'Taller gráfico',
  Instalaciones: 'Instalando',
  Metalúrgica: 'Metalúrgica',
  'Finalizado en Taller': 'Listo en taller',
  'Almacén de Entrega': 'Listo para retirar',
  Mostrador: 'En mostrador',
  Caja: 'En caja',
  'Entregado o Instalado': 'Entregado'
}

const OP_COLOR: Record<string, string> = {
  Pendiente: '#6b7280',
  'Asesor Técnico': '#8b5cf6',
  Presupuestos: '#8b5cf6',
  'Finalizado Asesor Presupuestos': '#10b981',
  'Diseño Gráfico': '#f97316',
  'Diseño en Proceso': '#f97316',
  'En Espera': '#6b7280',
  'Imprenta (Área de Impresión)': '#0ea5e9',
  'Taller de Imprenta': '#0ea5e9',
  'Taller Gráfico': '#6366f1',
  Instalaciones: '#a855f7',
  Metalúrgica: '#ec4899',
  'Finalizado en Taller': '#10b981',
  'Almacén de Entrega': '#10b981',
  Mostrador: '#10b981',
  Caja: '#eab308',
  'Entregado o Instalado': '#16a34a'
}

const ENTREGADO = new Set(['Entregado o Instalado'])

export function getClienteBriefStatus(brief: BriefStatusInput): ClienteBriefStatus {
  if (!brief.completado) {
    return {
      fase: 'borrador',
      label: 'Borrador',
      hint: 'Completá el formulario y enviálo',
      accent: '#f59e0b',
      step: 1
    }
  }

  if (!brief.id_orden_asociada) {
    return {
      fase: 'enviado',
      label: 'Enviado',
      hint: 'Plot Center revisa tu pedido y te asigna una orden',
      accent: '#3b82f6',
      step: 2
    }
  }

  const op = brief.numero_op || `OP-${brief.id_orden_asociada}`
  const estadoRaw = brief.estado?.trim() || ''

  if (estadoRaw && ENTREGADO.has(estadoRaw)) {
    return {
      fase: 'entregado',
      label: 'Entregado',
      hint: `${op} · trabajo finalizado`,
      accent: '#16a34a',
      step: 4
    }
  }

  const label = estadoRaw
    ? OP_ESTADO_CLIENTE[estadoRaw] || estadoRaw
    : 'En producción'

  return {
    fase: 'produccion',
    label,
    hint: `${op} · seguí el avance en tiempo real`,
    accent: (estadoRaw && OP_COLOR[estadoRaw]) || '#f97316',
    step: 3
  }
}

export function getBriefCardTitle(brief: {
  id: number
  tipo_producto_servicio?: string[] | null
  objetivo_proyecto?: string | null
  cliente_empresa?: string | null
}): string {
  if (brief.tipo_producto_servicio?.length) {
    const tipos = brief.tipo_producto_servicio.slice(0, 2).join(' · ')
    const extra =
      brief.tipo_producto_servicio.length > 2
        ? ` (+${brief.tipo_producto_servicio.length - 2})`
        : ''
    return tipos + extra
  }
  if (brief.objetivo_proyecto?.trim()) {
    const t = brief.objetivo_proyecto.trim()
    return t.length > 72 ? `${t.slice(0, 72)}…` : t
  }
  if (brief.cliente_empresa?.trim()) {
    return `Diseño · ${brief.cliente_empresa.trim()}`
  }
  return `Pedido de diseño #${brief.id}`
}

export const BRIEF_PIPELINE_STEPS = [
  { step: 1 as const, label: 'Brief' },
  { step: 2 as const, label: 'Revisión' },
  { step: 3 as const, label: 'Producción' },
  { step: 4 as const, label: 'Listo' }
]

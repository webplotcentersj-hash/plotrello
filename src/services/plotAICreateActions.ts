import type { Priority, Task, TaskStatus, TeamMember } from '../types/board'
import { buildWhatsappLink } from '../utils/whatsappLink'

export type PlotAICreateOpPayload = {
  type: 'create_op'
  cliente: string
  descripcion: string
  dni_cuit?: string | null
  op_number?: string | null
  prioridad?: Priority | string | null
  impacto?: Task['impact'] | string | null
  columna?: TaskStatus | string | null
  fecha_entrega?: string | null
  observaciones?: string | null
}

export type PlotAICreateVentaPayload = {
  type: 'create_venta'
  cliente: string
  monto: number
  dni_cuit?: string | null
  telefono?: string | null
  email?: string | null
  metodo_pago?: string | null
  estado_pago?: string | null
  observaciones?: string | null
}

export type PlotAIMoveOpPayload = {
  type: 'move_op'
  op_number: string
  task_id?: string | null
  columna?: TaskStatus | string | null
  responsable?: string | null
  responsable_id?: string | null
  nota?: string | null
}

export type PlotAIDraftPresupuestoPayload = {
  type: 'draft_presupuesto'
  cliente: string
  telefono?: string | null
  email?: string | null
  dni_cuit?: string | null
  items: Array<{
    descripcion: string
    cantidad: number
    /** Si no hay precio confiable, debe ser 0 y marcar precios_pendientes */
    precio_unitario: number
  }>
  observaciones?: string | null
  /** true = no inventó precios; hay que completarlos a mano */
  precios_pendientes?: boolean
}

export type PlotAIWhatsappAvisoPayload = {
  type: 'whatsapp_aviso'
  op_number?: string | null
  task_id?: string | null
  cliente?: string | null
  telefono?: string | null
  /** listo | falta_dato | demora | custom */
  plantilla?: 'listo' | 'falta_dato' | 'demora' | 'custom' | string | null
  mensaje: string
}

export type PlotAICreateAction =
  | PlotAICreateOpPayload
  | PlotAICreateVentaPayload
  | PlotAIMoveOpPayload
  | PlotAIDraftPresupuestoPayload
  | PlotAIWhatsappAvisoPayload

export type PlotAIPendingAction = {
  id: string
  action: PlotAICreateAction
  status: 'pending' | 'confirmed' | 'cancelled' | 'error' | 'done'
  resultMessage?: string
}

const ACTION_BLOCK_RE = /<<<PLOTAI_ACTION\s*([\s\S]*?)\s*>>>/i

const OP_INTENT =
  /\b(crea(r|me)?|hac[eé](me)?|arma(me)?|genera(me)?|abr[ií](me)?)\b.{0,40}\b(op|orden|ficha|trabajo)\b|\b(op|orden de (trabajo|producci[oó]n))\b.{0,20}\b(nueva|para|cliente)\b/i

const VENTA_INTENT =
  /\b(crea(r|me)?|hac[eé](me)?|registr(a|ame|á)|anot[aá](me)?|cobra(me)?)\b.{0,40}\b(venta|ticket|factura)\b|\bventa\b.{0,30}\b(de|por|cliente|mostrador)\b/i

const MOVE_INTENT =
  /\b(pas[aá](la|lo|me)?|mov[eé](la|lo|me)?|asign[aá](la|lo|me)?|mand[aá](la|lo)?|llev[aá](la|lo)?)\b.{0,50}\b(op|orden|ficha|imprenta|taller|dise[nñ]o|espera|instalaciones|metal[uú]rgica|[a-záéíóúñ]+)\b/i

const PRESUP_INTENT =
  /\b(presupuest|cotiz|brief|arm[aá].{0,20}presupuesto|borrador de presupuesto)\b/i

const WA_INTENT =
  /\b(whats?app|aviso(le)?|avis[aá](le|me)?|avisar|mensaje al cliente|decile al cliente|listo para retirar|falta (dato|foto|medida))\b/i

export type PlotAIAgentIntent =
  | 'op'
  | 'venta'
  | 'move_op'
  | 'draft_presupuesto'
  | 'whatsapp_aviso'
  | null

export function detectCreateIntent(message: string): PlotAIAgentIntent {
  const t = message.trim()
  if (!t) return null
  if (WA_INTENT.test(t)) return 'whatsapp_aviso'
  if (PRESUP_INTENT.test(t)) return 'draft_presupuesto'
  if (MOVE_INTENT.test(t)) return 'move_op'
  if (VENTA_INTENT.test(t)) return 'venta'
  if (OP_INTENT.test(t)) return 'op'
  return null
}

export function stripPlotAIActionBlock(text: string): string {
  return text.replace(ACTION_BLOCK_RE, '').trim()
}

function asStr(v: unknown): string {
  return String(v ?? '').trim()
}

function asNum(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : NaN
}

export function parsePlotAIActionBlock(text: string): PlotAICreateAction | null {
  const match = text.match(ACTION_BLOCK_RE)
  if (!match?.[1]) return null
  try {
    const raw = JSON.parse(match[1].trim()) as Record<string, unknown>
    const type = String(raw.type || '').toLowerCase()

    if (type === 'create_op' || type === 'op') {
      const cliente = asStr(raw.cliente || raw.cliente_nombre || raw.title)
      const descripcion = asStr(raw.descripcion || raw.summary || raw.detalle)
      if (!cliente || !descripcion) return null
      return {
        type: 'create_op',
        cliente,
        descripcion,
        dni_cuit: (raw.dni_cuit || raw.dniCuit || raw.cuit || null) as string | null,
        op_number: (raw.op_number || raw.opNumber || raw.numero_op || null) as string | null,
        prioridad: (raw.prioridad || raw.priority || 'media') as string,
        impacto: (raw.impacto || raw.impact || 'media') as string,
        columna: (raw.columna || raw.status || raw.sector || 'diseno-grafico') as string,
        fecha_entrega: (raw.fecha_entrega || raw.dueDate || raw.fecha || null) as string | null,
        observaciones: (raw.observaciones || null) as string | null
      }
    }

    if (type === 'create_venta' || type === 'venta') {
      const cliente = asStr(raw.cliente || raw.cliente_nombre)
      const monto = asNum(raw.monto ?? raw.valor_total ?? raw.total ?? raw.importe)
      if (!cliente || !(monto > 0)) return null
      return {
        type: 'create_venta',
        cliente,
        monto,
        dni_cuit: (raw.dni_cuit || raw.dniCuit || raw.cuit || null) as string | null,
        telefono: (raw.telefono || raw.cliente_telefono || null) as string | null,
        email: (raw.email || raw.cliente_email || null) as string | null,
        metodo_pago: (raw.metodo_pago || raw.metodoPago || 'Efectivo') as string,
        estado_pago: (raw.estado_pago || raw.estadoPago || 'Pagado') as string,
        observaciones: (raw.observaciones || null) as string | null
      }
    }

    if (type === 'move_op' || type === 'assign_op' || type === 'update_op') {
      const op_number = asStr(raw.op_number || raw.opNumber || raw.numero_op || raw.op)
      if (!op_number) return null
      const columna = raw.columna || raw.status || raw.destino || raw.sector || null
      const responsable = raw.responsable || raw.owner || raw.asignado || raw.operario || null
      if (!columna && !responsable) return null
      return {
        type: 'move_op',
        op_number,
        task_id: (raw.task_id || raw.taskId || null) as string | null,
        columna: columna as string | null,
        responsable: responsable as string | null,
        responsable_id: (raw.responsable_id || raw.ownerId || null) as string | null,
        nota: (raw.nota || raw.motivo || null) as string | null
      }
    }

    if (type === 'draft_presupuesto' || type === 'presupuesto' || type === 'create_presupuesto') {
      const cliente = asStr(raw.cliente || raw.cliente_nombre)
      const itemsRaw = Array.isArray(raw.items) ? raw.items : []
      const items = itemsRaw
        .map((it) => {
          const row = it as Record<string, unknown>
          const descripcion = asStr(row.descripcion || row.detalle || row.nombre)
          const cantidad = asNum(row.cantidad ?? 1) || 1
          const precio_unitario = asNum(row.precio_unitario ?? row.precio ?? 0)
          return {
            descripcion,
            cantidad: cantidad > 0 ? cantidad : 1,
            precio_unitario: Number.isFinite(precio_unitario) && precio_unitario > 0 ? precio_unitario : 0
          }
        })
        .filter((it) => it.descripcion)
      if (!cliente || items.length === 0) return null
      const precios_pendientes =
        raw.precios_pendientes === true || items.every((it) => it.precio_unitario <= 0)
      return {
        type: 'draft_presupuesto',
        cliente,
        telefono: (raw.telefono || null) as string | null,
        email: (raw.email || null) as string | null,
        dni_cuit: (raw.dni_cuit || raw.cuit || null) as string | null,
        items,
        observaciones: (raw.observaciones || raw.brief || null) as string | null,
        precios_pendientes
      }
    }

    if (type === 'whatsapp_aviso' || type === 'whatsapp' || type === 'aviso_cliente') {
      const mensaje = asStr(raw.mensaje || raw.message || raw.texto)
      if (!mensaje) return null
      return {
        type: 'whatsapp_aviso',
        op_number: (raw.op_number || raw.opNumber || raw.numero_op || null) as string | null,
        task_id: (raw.task_id || null) as string | null,
        cliente: (raw.cliente || null) as string | null,
        telefono: (raw.telefono || raw.phone || null) as string | null,
        plantilla: (raw.plantilla || 'custom') as string,
        mensaje
      }
    }
  } catch {
    return null
  }
  return null
}

export function normalizePriority(value?: string | null): Priority {
  const v = (value || 'media').toLowerCase()
  if (v.includes('alt')) return 'alta'
  if (v.includes('baj')) return 'baja'
  return 'media'
}

export function normalizeImpact(value?: string | null): Task['impact'] {
  const v = (value || 'media').toLowerCase()
  if (v.includes('alt')) return 'alta'
  if (v.includes('baj') || v === 'low') return 'low'
  return 'media'
}

const COLUMN_ALIASES: Array<{ id: TaskStatus; keys: string[] }> = [
  { id: 'diseno-grafico', keys: ['diseno', 'diseño', 'grafico', 'gráfico', 'diseno-grafico'] },
  { id: 'diseno-proceso', keys: ['proceso', 'diseno-proceso', 'diseño en proceso'] },
  { id: 'en-espera', keys: ['espera', 'en-espera', 'en espera'] },
  { id: 'imprenta', keys: ['imprenta', 'impresion', 'impresión'] },
  { id: 'taller-imprenta', keys: ['taller imprenta', 'taller-imprenta'] },
  { id: 'taller-grafico', keys: ['taller grafico', 'taller gráfico', 'taller-grafico'] },
  { id: 'instalaciones', keys: ['instalaciones', 'instalacion'] },
  { id: 'metalurgica', keys: ['metalurgica', 'metalúrgica'] },
  { id: 'finalizado-taller', keys: ['finalizado', 'entrega taller', 'finalizado-taller'] },
  { id: 'almacen-entrega', keys: ['almacen', 'almacén', 'retiro', 'almacen-entrega'] }
]

export function normalizeColumn(value?: string | null): TaskStatus {
  const v = (value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  if (!v) return 'diseno-grafico'
  for (const col of COLUMN_ALIASES) {
    if (col.keys.some((k) => v.includes(k.normalize('NFD').replace(/[\u0300-\u036f]/g, '')))) {
      return col.id
    }
  }
  const allowed = COLUMN_ALIASES.map((c) => c.id)
  if (allowed.includes(value as TaskStatus)) return value as TaskStatus
  return 'diseno-grafico'
}

const METODOS = [
  'Efectivo',
  'Transferencia',
  'Tarjeta',
  'Cheque',
  'Cuenta Corriente',
  'Mercado Pago',
  'Otro'
] as const

export type MetodoPagoVenta = (typeof METODOS)[number]

export function normalizeMetodoPago(value?: string | null): MetodoPagoVenta {
  const v = (value || 'Efectivo').toLowerCase()
  if (v.includes('transf')) return 'Transferencia'
  if (v.includes('tarj') || v.includes('débito') || v.includes('credito') || v.includes('crédito')) return 'Tarjeta'
  if (v.includes('cheque')) return 'Cheque'
  if (v.includes('cuenta')) return 'Cuenta Corriente'
  if (v.includes('mercado') || v.includes('mp')) return 'Mercado Pago'
  if (v.includes('otro')) return 'Otro'
  return 'Efectivo'
}

export function normalizeEstadoPago(value?: string | null): 'Pendiente' | 'Parcial' | 'Pagado' | 'Cancelado' {
  const v = (value || 'Pagado').toLowerCase()
  if (v.includes('pend')) return 'Pendiente'
  if (v.includes('parc')) return 'Parcial'
  if (v.includes('cancel')) return 'Cancelado'
  return 'Pagado'
}

export function findTaskByOpRef(tasks: Task[], opNumber?: string | null, taskId?: string | null): Task | null {
  if (taskId) {
    const byId = tasks.find((t) => t.id === taskId)
    if (byId) return byId
  }
  const ref = (opNumber || '').trim().toLowerCase()
  if (!ref) return null
  const digits = ref.replace(/\D/g, '')
  return (
    tasks.find((t) => t.opNumber?.toLowerCase() === ref) ||
    tasks.find((t) => t.opNumber?.toLowerCase().includes(ref)) ||
    (digits
      ? tasks.find((t) => (t.opNumber || '').replace(/\D/g, '').endsWith(digits))
      : undefined) ||
    null
  )
}

export function resolveTeamMemberId(
  teamMembers: TeamMember[],
  responsable?: string | null,
  responsableId?: string | null
): TeamMember | null {
  if (responsableId) {
    const byId = teamMembers.find((m) => m.id === responsableId)
    if (byId) return byId
  }
  const name = (responsable || '').trim().toLowerCase()
  if (!name) return null
  return (
    teamMembers.find((m) => m.name.toLowerCase() === name) ||
    teamMembers.find((m) => m.name.toLowerCase().includes(name)) ||
    null
  )
}

export function buildWhatsappAvisoHref(
  action: PlotAIWhatsappAvisoPayload,
  task?: Task | null
): string | undefined {
  const phone =
    action.telefono?.trim() ||
    task?.clientPhone?.trim() ||
    (task?.whatsappUrl ? null : null)
  const fromTaskUrl = task?.whatsappUrl?.trim()
  const message = action.mensaje.trim()
  if (fromTaskUrl && fromTaskUrl.includes('wa.me')) {
    try {
      const u = new URL(fromTaskUrl)
      u.searchParams.set('text', message)
      return u.toString()
    } catch {
      /* fall through */
    }
  }
  return buildWhatsappLink(phone, message)
}

export function intentLabel(intent: PlotAIAgentIntent): string {
  switch (intent) {
    case 'op':
      return 'OP (orden de trabajo)'
    case 'venta':
      return 'VENTA'
    case 'move_op':
      return 'MOVER/ASIGNAR OP'
    case 'draft_presupuesto':
      return 'BORRADOR DE PRESUPUESTO'
    case 'whatsapp_aviso':
      return 'AVISO WHATSAPP (solo se abre el chat; vos enviás)'
    default:
      return 'acción'
  }
}

/** Instrucciones para el modelo: proponer acciones; NUNCA asumir ejecución. */
export const PLOTAI_CREATE_ACTIONS_PROMPT = `
ACCIONES CONFIRMACIÓN OBLIGATORIA (NUNCA AUTOMÁTICAS):
Nunca digas que ya creaste, moviste, asignaste, presupuestaste o avisaste.
Solo PROPONÉ. El usuario debe pulsar Confirmar en la UI. Si falta un dato, preguntá; no inventes.

Si el usuario pide una acción y YA tenés datos mínimos, agregá AL FINAL (sin markdown):

<<<PLOTAI_ACTION
{...json...}
>>>

Tipos permitidos:

1) create_op
{"type":"create_op","cliente":"...","descripcion":"...","dni_cuit":null,"prioridad":"media","impacto":"media","columna":"diseno-grafico","fecha_entrega":null,"op_number":null,"observaciones":null}

2) create_venta
{"type":"create_venta","cliente":"...","monto":15000,"dni_cuit":null,"telefono":null,"email":null,"metodo_pago":"Efectivo","estado_pago":"Pagado","observaciones":null}

3) move_op (mover columna y/o asignar responsable)
{"type":"move_op","op_number":"104687","columna":"imprenta","responsable":"Nombre del equipo","responsable_id":null,"nota":"motivo breve"}

4) draft_presupuesto (borrador; NO inventar precios)
{"type":"draft_presupuesto","cliente":"...","telefono":null,"email":null,"dni_cuit":null,"precios_pendientes":true,"observaciones":"brief","items":[{"descripcion":"Vinilo 2x1","cantidad":1,"precio_unitario":0}]}
Si no conocés el precio de lista, precio_unitario=0 y precios_pendientes=true.

5) whatsapp_aviso (NO envía solo: abre WhatsApp para que el usuario mande)
{"type":"whatsapp_aviso","op_number":"104687","telefono":null,"plantilla":"listo","mensaje":"Hola..., tu trabajo OP ... está listo para retirar..."}
plantilla: listo | falta_dato | demora | custom

Reglas:
- Mínimos create_op: cliente + descripcion
- Mínimos create_venta: cliente + monto > 0
- Mínimos move_op: op_number + (columna o responsable)
- Mínimos draft_presupuesto: cliente + ≥1 ítem con descripción
- Mínimos whatsapp_aviso: mensaje (y op o teléfono si hace falta)
- columna: diseno-grafico | diseno-proceso | en-espera | imprenta | taller-imprenta | taller-grafico | instalaciones | metalurgica | finalizado-taller | almacen-entrega
- Dictado por voz = texto escrito
- En tu respuesta humana aclará: "Cuando confirmes, lo ejecuto" / "WhatsApp se abre para que vos envíes"
`

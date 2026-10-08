import { generateContent } from '../services/plotAIService'
import apiService from '../services/api'
import type { Task } from '../types/board'
import type { FacturaItemRecord, FacturaVentaRecord, Venta, VentaItem } from '../types/api'
import { parseTaskIdToOrdenId } from './dataMappers'
import { formatPlotAITodayReferenceParagraph } from './plotAIPromptToday'

const MAX_CONTEXT_CHARS = 10_000

type FacturaConItems = FacturaVentaRecord & { items?: FacturaItemRecord[] }

function money(n: unknown): string {
  const v = Number(n)
  if (!Number.isFinite(v)) return String(n ?? '—')
  return v.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function pushLine(lines: string[], label: string, value: unknown) {
  if (value === null || value === undefined || value === '') return
  if (Array.isArray(value) && value.length === 0) return
  const text = Array.isArray(value) ? value.join(', ') : String(value)
  if (!text.trim()) return
  lines.push(`${label}: ${text}`)
}

function buildOpItemsBlock(task: Task): string {
  const lines: string[] = ['## Ítem / trabajo de la ficha']
  pushLine(lines, 'Tipo', task.esFichaNoOP ? 'Ficha (sin OP)' : 'OP')
  pushLine(lines, 'Número', task.opNumber)
  pushLine(lines, 'Cliente', task.title)
  pushLine(lines, 'Descripción', task.summary?.trim() || null)
  pushLine(lines, 'Materiales', task.materials)
  pushLine(lines, 'Cantidades', task.cantidades)
  pushLine(lines, 'Tipo producto/servicio', task.tipoProductoServicio)
  pushLine(lines, 'Tipo impresión', task.tipoImpresion)
  pushLine(lines, 'm²', task.metrosCuadrados != null ? `${task.metrosCuadrados}` : null)
  if (task.lineasMetrosM2?.length) {
    pushLine(
      lines,
      'Líneas m²',
      task.lineasMetrosM2.map((l) => `${l.tipo || 'ítem'} ${l.metrosCuadrados} m²`)
    )
  }
  pushLine(lines, 'Marca pagada en ficha', task.marcadaPagada === true ? 'Sí' : 'No')
  pushLine(lines, 'Sin pago en ficha', task.sinPago === true ? 'Sí' : 'No')
  pushLine(lines, 'Cuenta corriente en ficha', task.pagoCuentaCorriente === true ? 'Sí' : 'No')
  pushLine(
    lines,
    'Seña / parcial en ficha',
    task.montoPagoParcial != null && Number(task.montoPagoParcial) > 0
      ? `$${money(task.montoPagoParcial)}`
      : null
  )
  return lines.join('\n')
}

function buildVentaBlock(venta: Venta, items: VentaItem[]): string {
  const lines: string[] = [`## Venta ${venta.numero_venta || venta.id}`]
  pushLine(lines, 'Cliente', venta.cliente_nombre)
  pushLine(lines, 'Total', `$${money(venta.valor_total)}`)
  pushLine(lines, 'Estado de pago', venta.estado_pago)
  pushLine(lines, 'Monto pagado', venta.monto_pagado != null ? `$${money(venta.monto_pagado)}` : null)
  pushLine(lines, 'Método', venta.metodo_pago)
  pushLine(lines, 'OP vinculada', venta.numero_op || (venta.id_op != null ? String(venta.id_op) : null))
  if (venta.detalle_pago) {
    pushLine(lines, 'Detalle de pago', JSON.stringify(venta.detalle_pago))
  }
  if (items.length) {
    lines.push('Ítems de venta:')
    for (const item of items) {
      lines.push(
        `- ${item.descripcion} · cant ${item.cantidad} · $${money(item.precio_unitario)} · subtotal $${money(item.precio_total)}`
      )
    }
  } else {
    lines.push('Ítems de venta: (ninguno cargado)')
  }
  return lines.join('\n')
}

function buildFacturaBlock(factura: FacturaConItems): string {
  const lines: string[] = [`## Factura ${factura.numero_factura || factura.id}`]
  pushLine(lines, 'Tipo', factura.tipo_comprobante)
  pushLine(lines, 'Estado', factura.estado)
  pushLine(lines, 'AFIP', factura.estado_afip)
  pushLine(lines, 'CAE', factura.cae || factura.numero_cae)
  pushLine(lines, 'Cliente', factura.cliente_nombre)
  pushLine(lines, 'Total', `$${money(factura.total)}`)
  pushLine(lines, 'id_venta', factura.id_venta)
  pushLine(lines, 'OP', factura.numero_op || (factura.id_op != null ? String(factura.id_op) : null))
  const items = factura.items ?? []
  if (items.length) {
    lines.push('Ítems de factura:')
    for (const item of items) {
      lines.push(
        `- ${item.descripcion} · cant ${item.cantidad} · $${money(item.precio_unitario)} · total $${money(item.total)}`
      )
    }
  } else {
    lines.push('Ítems de factura: (ninguno cargado)')
  }
  return lines.join('\n')
}

async function loadCorroborarContext(task: Task): Promise<string> {
  const idOp = parseTaskIdToOrdenId(task.id)
  const numeroOp = task.opNumber?.trim() || null
  const [ventasRes, facturasOpRes] = await Promise.all([
    apiService.obtenerVentasPorOp({ idOp, numeroOp }),
    idOp ? apiService.getFacturas({ id_op: idOp }) : Promise.resolve({ success: true, data: [] as FacturaVentaRecord[] })
  ])

  const ventas = ventasRes.success && ventasRes.data ? ventasRes.data : []
  const facturasById = new Map<number, FacturaConItems>()
  for (const f of (facturasOpRes.success && facturasOpRes.data ? facturasOpRes.data : []) as FacturaConItems[]) {
    facturasById.set(f.id, f)
  }

  const ventaIds = ventas.map((v) => v.id).filter((id) => Number.isFinite(id))
  const missingVentaIds = ventaIds.filter((id) => ![...facturasById.values()].some((f) => Number(f.id_venta) === id))
  await Promise.all(
    missingVentaIds.map(async (idVenta) => {
      const extra = await apiService.getFacturas({ id_venta: idVenta })
      if (!extra.success || !extra.data) return
      for (const f of extra.data as FacturaConItems[]) facturasById.set(f.id, f)
    })
  )

  const itemsPorVenta = await Promise.all(
    ventas.map(async (venta) => {
      const itemsRes = await apiService.getItemsVenta(venta.id)
      return { venta, items: itemsRes.success && itemsRes.data ? itemsRes.data : [] }
    })
  )

  const parts = [buildOpItemsBlock(task)]
  if (!ventasRes.success) {
    parts.push(`## Venta\nNo se pudo leer ventas: ${ventasRes.error || 'error'}`)
  } else if (itemsPorVenta.length === 0) {
    parts.push('## Venta\nNo hay venta vinculada a esta OP.')
  } else {
    for (const row of itemsPorVenta) parts.push(buildVentaBlock(row.venta, row.items))
  }

  const facturas = [...facturasById.values()]
  if (facturas.length === 0) {
    parts.push('## Factura\nNo hay factura emitida vinculada a esta OP ni a sus ventas.')
  } else {
    for (const factura of facturas) parts.push(buildFacturaBlock(factura))
  }

  let text = parts.join('\n\n')
  if (text.length > MAX_CONTEXT_CHARS) {
    text = `${text.slice(0, MAX_CONTEXT_CHARS)}\n[... contexto truncado ...]`
  }
  return text
}

function buildCorroborarPrefix(): string {
  return `${formatPlotAITodayReferenceParagraph()}

Sos PlotAI. Te pasan datos de una OP: el ítem/trabajo de la ficha, el pago (venta/cobro) y la factura.

Respondé SOLO esto, en español argentino, corto, en Markdown:

1. Si ítem, pago y factura coinciden (mismos productos/cantidades, montos que cierran, cobro acorde y factura emitida vinculada): empezá con **Todo coincide.** y una frase de por qué.
2. Si algo no cierra: empezá con **Falta o no coincide:** y listá únicamente lo que falta o no calza (ej. no hay venta, pago parcial vs ficha pagada, sin factura, ítems distintos, montos distintos, factura anulada, CAE pendiente).

Reglas:
- Nada de recomendaciones, ideas, buenas prácticas, saludos ni despedidas.
- No inventes datos. Si un bloque no existe, eso es lo que falta.
- Máximo 8 viñetas.`
}

export async function fetchPlotAICorroborarOp(task: Task): Promise<string> {
  const summary = await loadCorroborarContext(task)
  return generateContent({
    contents: `Datos para corroborar ítem / pago / factura:\n${summary}`,
    extraContextPrefix: buildCorroborarPrefix(),
    useCompleteContext: false,
    useMemory: false,
    learnFromResponse: false,
    includeAppManual: false
  })
}

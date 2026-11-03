/**
 * "Copiar como nueva": arma, a partir de un comprobante existente, los datos con los que se abre el
 * formulario de uno nuevo. Se copia lo que describe el pedido (cliente, líneas, condiciones) y se
 * deja afuera todo lo que identifica o registra el trámite original: números, CAE, fechas, cobros,
 * estados, vínculos con otras operaciones y marcas de duplicado. El comprobante nuevo sale por el
 * circuito normal (numeración, validaciones, stock, caja), no es un duplicado del anterior.
 */
import type {
  FacturaItemRecord,
  FacturaVentaRecord,
  PresupuestoVentaItemRecord,
  PresupuestoVentaRecord,
  Venta,
  VentaItem
} from '../../types/api'
import type { Task } from '../../types/board'
import type { PedidoCompra } from '../../types/pedidos'
import { emptyOpCreateDraft, type OpCreateDraftData } from '../../utils/opCreateDraft'
import { cant3, type LineaPendiente, type Remito } from '../remitos/remitosLogica'

const texto = (v: string | null | undefined): string => (v ?? '').trim()

// ── Venta ────────────────────────────────────────────────────────────────

export type PlantillaVenta = {
  cliente: {
    id_cliente: number | null
    nombre: string
    dni_cuit: string
    telefono: string
    email: string
    empresa: string
    direccion: string
  }
  observaciones: string
  items: Array<{
    id_articulo_stock?: number
    codigo_articulo?: string
    descripcion: string
    cantidad: number
    precio_unitario: number
    /** En pesos, como se guarda en la venta. */
    descuento: number
    observaciones?: string
  }>
}

/** Cliente, líneas y observaciones. No pasan ni el cobro, ni el método de pago, ni la OP, ni las facturas. */
export function plantillaVenta(
  venta: Pick<
    Venta,
    | 'id_cliente'
    | 'cliente_nombre'
    | 'cliente_dni_cuit'
    | 'cliente_telefono'
    | 'cliente_email'
    | 'cliente_empresa'
    | 'cliente_direccion'
    | 'observaciones'
  >,
  items: VentaItem[]
): PlantillaVenta {
  return {
    cliente: {
      id_cliente: venta.id_cliente ?? null,
      nombre: texto(venta.cliente_nombre),
      dni_cuit: texto(venta.cliente_dni_cuit),
      telefono: texto(venta.cliente_telefono),
      email: texto(venta.cliente_email),
      empresa: texto(venta.cliente_empresa),
      direccion: texto(venta.cliente_direccion)
    },
    observaciones: texto(venta.observaciones),
    items: items.map((it) => ({
      ...(it.id_articulo_stock ? { id_articulo_stock: it.id_articulo_stock } : {}),
      ...(texto(it.codigo_articulo) ? { codigo_articulo: texto(it.codigo_articulo) } : {}),
      descripcion: it.descripcion,
      cantidad: Number(it.cantidad) || 1,
      precio_unitario: Number(it.precio_unitario) || 0,
      descuento: Math.max(0, Number(it.descuento) || 0),
      ...(texto(it.observaciones) ? { observaciones: texto(it.observaciones) } : {})
    }))
  }
}

// ── Pedido de compra ─────────────────────────────────────────────────────

export type PlantillaPedidoCompra = {
  sector_solicitante: string
  id_proveedor: number | null
  motivo: string
  observaciones: string
  prioridad: PedidoCompra['prioridad']
  items: Array<{
    id_articulo_stock?: number
    codigo_articulo: string
    descripcion: string
    /** Lo que se pidió, no lo que se aprobó ni lo que llegó a comprarse. */
    cantidad: number
    unidad: string
    observaciones: string
  }>
}

/** Qué se pide y a quién. Sin número, estado, aprobación, rechazo, seguimiento, fechas ni cantidades compradas. */
export function plantillaPedidoCompra(p: PedidoCompra): PlantillaPedidoCompra {
  return {
    sector_solicitante: texto(p.sector_solicitante),
    id_proveedor: p.id_proveedor ?? null,
    motivo: texto(p.motivo),
    observaciones: texto(p.observaciones),
    prioridad: p.prioridad,
    items: (p.items ?? []).map((it) => ({
      ...(it.id_articulo_stock ? { id_articulo_stock: it.id_articulo_stock } : {}),
      codigo_articulo: texto(it.codigo_articulo),
      descripcion: it.descripcion,
      cantidad: Number(it.cantidad_solicitada) || 1,
      unidad: texto(it.unidad) || 'unidad',
      observaciones: texto(it.observaciones)
    }))
  }
}

// ── Presupuesto ──────────────────────────────────────────────────────────

export type PlantillaPresupuesto = {
  cliente: PlantillaVenta['cliente']
  observaciones_cliente: string
  /** Notas internas sin la marca de "precios sin IVA": esa marca pasa como `sin_iva`. */
  observaciones_internas: string
  sin_iva: boolean
  tipo_lista: 'lista_1' | 'lista_2'
  /** Códigos de medios de pago ofrecidos. */
  formas_pago: string[]
  items: PlantillaVenta['items']
}

const MARCA_SIN_IVA = /\[precios_sin_iva\]/gi

/** Sin número, fechas (creación, envío, validez), estado, vendedor ni vínculos con ventas u OP. */
export function plantillaPresupuesto(
  p: PresupuestoVentaRecord,
  items: PresupuestoVentaItemRecord[]
): PlantillaPresupuesto {
  const internas = String(p.observaciones_internas ?? '')
  return {
    cliente: {
      id_cliente: p.id_cliente ?? null,
      nombre: texto(p.cliente_nombre),
      dni_cuit: texto(p.cliente_dni_cuit),
      telefono: texto(p.cliente_telefono),
      email: texto(p.cliente_email),
      empresa: texto(p.cliente_empresa),
      direccion: texto(p.cliente_direccion)
    },
    observaciones_cliente: texto(p.observaciones_cliente),
    observaciones_internas: internas.replace(MARCA_SIN_IVA, '').replace(/[ \t]+/g, ' ').trim(),
    sin_iva: /\[precios_sin_iva\]/i.test(internas),
    tipo_lista: p.tipo_lista_precio === 'lista_2' ? 'lista_2' : 'lista_1',
    formas_pago: [...(p.formas_pago ?? [])],
    items: items.map((it) => ({
      ...(it.id_articulo_stock ? { id_articulo_stock: it.id_articulo_stock } : {}),
      ...(texto(it.codigo_articulo) ? { codigo_articulo: texto(it.codigo_articulo) } : {}),
      descripcion: it.descripcion,
      cantidad: Number(it.cantidad) || 1,
      precio_unitario: Number(it.precio_unitario) || 0,
      descuento: Math.max(0, Number(it.descuento) || 0),
      ...(texto(it.observaciones) ? { observaciones: texto(it.observaciones) } : {})
    }))
  }
}

// ── Factura ──────────────────────────────────────────────────────────────

export type PlantillaFactura = {
  tipo_comprobante: 'Factura A' | 'Factura B' | 'Factura C'
  concepto: 1 | 2 | 3
  observaciones: string
  cliente: {
    id_cliente: number | null
    nombre: string
    dni_cuit: string
    direccion: string
    condicion_iva: NonNullable<FacturaVentaRecord['cliente_condicion_iva']> | ''
  }
  /** Los importes de una factura guardada son netos de IVA: se vuelven a cargar como netos. */
  items: Array<{
    descripcion: string
    cantidad: number
    unidad_medida: string
    precio_unitario: number
    descuento: number
    iva_porcentaje: number
  }>
}

/**
 * Solo las facturas se copian: una nota de crédito o de débito depende de su comprobante original y
 * copiarla como factura cambiaría su sentido. Sin número, CAE, fechas, período de servicio, venta ni OP.
 */
export function plantillaFactura(
  factura: Pick<
    FacturaVentaRecord,
    | 'tipo_comprobante'
    | 'concepto'
    | 'observaciones'
    | 'id_cliente'
    | 'cliente_nombre'
    | 'cliente_dni_cuit'
    | 'cliente_direccion'
    | 'cliente_condicion_iva'
  >,
  items: FacturaItemRecord[]
): PlantillaFactura | null {
  const tipo = factura.tipo_comprobante
  if (tipo !== 'Factura A' && tipo !== 'Factura B' && tipo !== 'Factura C') return null
  return {
    tipo_comprobante: tipo,
    concepto: factura.concepto === 2 || factura.concepto === 3 ? factura.concepto : 1,
    observaciones: texto(factura.observaciones),
    cliente: {
      id_cliente: factura.id_cliente ?? null,
      nombre: texto(factura.cliente_nombre),
      dni_cuit: texto(factura.cliente_dni_cuit),
      direccion: texto(factura.cliente_direccion),
      condicion_iva: factura.cliente_condicion_iva ?? ''
    },
    items: [...items]
      .sort((a, b) => (a.item_numero ?? 0) - (b.item_numero ?? 0))
      .map((it) => ({
        descripcion: it.descripcion,
        cantidad: Number(it.cantidad) || 1,
        unidad_medida: texto(it.unidad_medida) || 'UN',
        precio_unitario: Number(it.precio_unitario) || 0,
        descuento: Math.max(0, Number(it.descuento) || 0),
        iva_porcentaje: Number(it.iva_porcentaje) || 0
      }))
  }
}

// ── OP (ficha del tablero) ───────────────────────────────────────────────

/**
 * Datos del formulario de alta de OP. Sin número de OP, fecha ni hora de entrega, operario, cobro,
 * archivos adjuntos ni brief/pedido web de origen: eso es del trabajo original. Se mantiene el
 * cliente, el trabajo (descripción, sectores, m², materiales, etiquetas) y las condiciones.
 */
export function plantillaOp(
  task: Task,
  /** Prioridad y complejidad ya en el vocabulario del formulario (mapPriorityToDb / mapImpactToComplejidad). */
  valores: { prioridad: string; complejidad: string }
): OpCreateDraftData {
  const sectores = task.sectores?.length ? task.sectores : [task.sectorInicial ?? task.assignedSector].filter(Boolean)
  return {
    ...emptyOpCreateDraft(),
    cliente: texto(task.title),
    dniCuit: texto(task.dniCuit),
    telefonoCliente: texto(task.clientPhone),
    emailCliente: texto(task.clientEmail),
    direccionCliente: texto(task.clientAddress),
    ubicacionUrl: texto(task.locationUrl),
    driveUrl: texto(task.driveUrl),
    selectedSectores: sectores as string[],
    complejidad: valores.complejidad,
    prioridad: valores.prioridad,
    descripcion: texto(task.summary),
    briefPublico: texto(task.briefPublico),
    objetivoProyecto: texto(task.objetivoProyecto),
    publicoObjetivo: texto(task.publicoObjetivo),
    estiloDiseno: texto(task.estiloDiseno),
    referencias: texto(task.referencias),
    materials: (task.materials ?? []).filter((m) => texto(m)).map((name) => ({ name, quantity: 1 })),
    metrosCuadrados: task.metrosCuadrados ? String(task.metrosCuadrados) : '',
    lineasMetrosM2: (task.lineasMetrosM2 ?? []).map((l) => ({ tipo: l.tipo, metrosCuadrados: l.metrosCuadrados })),
    tags: [...(task.tags ?? [])]
  }
}

// ── Remito ───────────────────────────────────────────────────────────────

export type PlantillaRemito = {
  entregado_a: string
  dni_retira: string
  transportista: string
  observaciones: string
  items: Array<{
    id_venta_item?: number
    id_op_linea?: number
    descripcion: string
    cantidad: number
  }>
}

/** Quién retira, cómo y qué cantidades. Sin número, fecha de emisión ni de entrega. */
export function plantillaRemito(remito: Remito): PlantillaRemito {
  return {
    entregado_a: texto(remito.entregado_a),
    dni_retira: texto(remito.dni_retira),
    transportista: texto(remito.transportista),
    observaciones: texto(remito.observaciones),
    items: remito.items.map((it) => ({
      ...(it.id_venta_item ? { id_venta_item: it.id_venta_item } : {}),
      ...(it.id_op_linea ? { id_op_linea: it.id_op_linea } : {}),
      descripcion: it.descripcion,
      cantidad: Number(it.cantidad) || 0
    }))
  }
}

/**
 * Cantidades iniciales del remito nuevo: las mismas del copiado, pero nunca más de lo que queda por
 * remitir (si ya se entregó parte, la copia propone el resto). Las líneas libres pasan como libres.
 */
export function seleccionDesdeCopia(
  lineas: LineaPendiente[],
  plantilla: PlantillaRemito
): { seleccion: Record<string, string>; libres: Array<{ descripcion: string; cantidad: string }>; omitidas: string[] } {
  const seleccion: Record<string, string> = {}
  const libres: Array<{ descripcion: string; cantidad: string }> = []
  const omitidas: string[] = []
  for (const it of plantilla.items) {
    const clave = it.id_venta_item ? `v:${it.id_venta_item}` : it.id_op_linea ? `o:${it.id_op_linea}` : null
    if (!clave) {
      libres.push({ descripcion: it.descripcion, cantidad: String(it.cantidad) })
      continue
    }
    const linea = lineas.find((l) => l.clave === clave)
    const cantidad = linea ? cant3(Math.min(it.cantidad, linea.pendiente)) : 0
    if (cantidad > 0) seleccion[clave] = String(cantidad)
    else omitidas.push(it.descripcion)
  }
  return { seleccion, libres, omitidas }
}

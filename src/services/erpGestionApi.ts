/**
 * Datos para los módulos de gestión del ERP: flujo de caja, cobranza, tablero del dueño,
 * cierre mensual y detección de anomalías. Sólo lectura sobre tablas existentes.
 */
import { stockSupabase, supabase } from './supabaseClient'

export type Resp<T> = { success: true; data: T } | { success: false; error: string }

const PAGINA = 1000

function cliente() {
  if (!supabase) throw new Error('Supabase no configurado')
  return supabase
}

async function envolver<T>(fn: () => Promise<T>): Promise<Resp<T>> {
  try {
    return { success: true, data: await fn() }
  } catch (e) {
    const msg = e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : String(e)
    return { success: false, error: msg }
  }
}

async function traerTodo<T>(
  construir: (desde: number, hasta: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  maximo = 50000
): Promise<T[]> {
  const todo: T[] = []
  for (let desde = 0; desde < maximo; desde += PAGINA) {
    const { data, error } = await construir(desde, desde + PAGINA - 1)
    if (error) throw new Error(error.message)
    const lote = data ?? []
    todo.push(...lote)
    if (lote.length < PAGINA) break
  }
  return todo
}

const num = (v: unknown) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

// ============================================================================ fechas

export function sumarDias(iso: string, n: number): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}

export function diasEntre(desde: string, hasta: string): number {
  const a = desde.slice(0, 10).split('-').map(Number)
  const b = hasta.slice(0, 10).split('-').map(Number)
  return Math.round((Date.UTC(b[0], b[1] - 1, b[2]) - Date.UTC(a[0], a[1] - 1, a[2])) / 86400000)
}

export function rangoMes(ym: string): { desde: string; hasta: string } {
  const [y, m] = ym.split('-').map(Number)
  return { desde: `${ym}-01`, hasta: `${ym}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}` }
}

export function mesMas(ym: string, n: number): string {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + n, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

// ============================================================================ cuentas por cobrar

export type CxcPendiente = {
  id: number
  id_factura: number
  id_cliente: number | null
  cliente_nombre: string
  numero_factura: string | null
  id_venta: number | null
  monto_pendiente: number
  fecha_emision: string
  fecha_vencimiento: string | null
}

/** Facturas con saldo pendiente. Excluye las de ventas fiadas que ya se siguen en cuenta corriente. */
export function cxcPendientes() {
  return envolver(async () => {
    type Fila = {
      id: number
      id_factura: number
      id_cliente: number | null
      cliente_nombre: string
      monto_pendiente: number
      fecha_emision: string
      fecha_vencimiento: string | null
      estado: string
      factura: FacturaRel | FacturaRel[] | null
    }
    type FacturaRel = { numero_factura: string | null; id_venta: number | null }
    const [crudas, ventasCc] = await Promise.all([
      traerTodo<Fila>((a, b) =>
        cliente()
          .from('cuentas_por_cobrar')
          .select('id,id_factura,id_cliente,cliente_nombre,monto_pendiente,fecha_emision,fecha_vencimiento,estado,factura:facturas_venta!cuentas_por_cobrar_id_factura_fkey(numero_factura,id_venta)')
          .not('estado', 'in', '("Pagado","Cancelado")')
          .gt('monto_pendiente', 0)
          .order('id', { ascending: true })
          .range(a, b)
      ),
      traerTodo<{ id_venta: number | null }>((a, b) =>
        cliente().from('cc_cuenta_movimientos').select('id_venta').not('id_venta', 'is', null).order('id', { ascending: true }).range(a, b)
      ).catch(() => [] as { id_venta: number | null }[])
    ])
    const enCc = new Set(ventasCc.map((v) => v.id_venta).filter((x): x is number => x != null))
    const filas = crudas.map((f) => ({ ...f, factura: Array.isArray(f.factura) ? f.factura[0] ?? null : f.factura }))
    return filas
      .filter((f) => !(f.factura?.id_venta && enCc.has(f.factura.id_venta)))
      .map<CxcPendiente>((f) => ({
        id: f.id,
        id_factura: f.id_factura,
        id_cliente: f.id_cliente,
        cliente_nombre: f.cliente_nombre,
        numero_factura: f.factura?.numero_factura ?? null,
        id_venta: f.factura?.id_venta ?? null,
        monto_pendiente: num(f.monto_pendiente),
        fecha_emision: String(f.fecha_emision).slice(0, 10),
        fecha_vencimiento: f.fecha_vencimiento ? String(f.fecha_vencimiento).slice(0, 10) : null
      }))
  })
}

/**
 * Comportamiento de pago por cliente: días promedio de atraso respecto del vencimiento
 * en las facturas ya cobradas (último cobro vs. vencimiento).
 */
export type HabitoPago = { id_cliente: number; facturas: number; atrasoPromedio: number; puntuales: number }

export function habitosDePago() {
  return envolver(async () => {
    const [cxc, cobros] = await Promise.all([
      traerTodo<{ id: number; id_cliente: number | null; fecha_vencimiento: string | null; fecha_emision: string }>((a, b) =>
        cliente()
          .from('cuentas_por_cobrar')
          .select('id,id_cliente,fecha_vencimiento,fecha_emision')
          .eq('estado', 'Pagado')
          .not('id_cliente', 'is', null)
          .order('id', { ascending: true })
          .range(a, b)
      ),
      traerTodo<{ id_cuenta_por_cobrar: number | null; fecha_pago: string }>((a, b) =>
        cliente()
          .from('pagos_cobros')
          .select('id_cuenta_por_cobrar,fecha_pago')
          .eq('tipo', 'Cobro')
          .not('id_cuenta_por_cobrar', 'is', null)
          .order('id', { ascending: true })
          .range(a, b)
      )
    ])
    const ultimoCobro = new Map<number, string>()
    for (const c of cobros) {
      if (!c.id_cuenta_por_cobrar) continue
      const f = String(c.fecha_pago).slice(0, 10)
      const prev = ultimoCobro.get(c.id_cuenta_por_cobrar)
      if (!prev || f > prev) ultimoCobro.set(c.id_cuenta_por_cobrar, f)
    }
    const porCliente = new Map<number, number[]>()
    for (const x of cxc) {
      const pago = ultimoCobro.get(x.id)
      if (!pago || !x.id_cliente) continue
      // Sin vencimiento: se toma 30 días desde la emisión como referencia.
      const vence = x.fecha_vencimiento ? String(x.fecha_vencimiento).slice(0, 10) : sumarDias(String(x.fecha_emision).slice(0, 10), 30)
      const lista = porCliente.get(x.id_cliente) ?? []
      lista.push(diasEntre(vence, pago))
      porCliente.set(x.id_cliente, lista)
    }
    const out = new Map<number, HabitoPago>()
    for (const [id, lista] of porCliente) {
      out.set(id, {
        id_cliente: id,
        facturas: lista.length,
        atrasoPromedio: Math.round(lista.reduce((s, d) => s + Math.max(0, d), 0) / lista.length),
        puntuales: lista.filter((d) => d <= 0).length
      })
    }
    return out
  })
}

// ============================================================================ cuenta corriente (ventas fiadas)

export type DeudaCc = {
  id_cliente: number
  saldo: number
  /** Partes del saldo por antigüedad (FIFO: los pagos cancelan lo más viejo). */
  tramos: { fecha: string; monto: number }[]
}

export function deudasCuentaCorriente() {
  return envolver(async () => {
    const movs = await traerTodo<{ id_cliente: number; debe: number; haber: number; fecha: string }>((a, b) =>
      cliente()
        .from('cc_cuenta_movimientos')
        .select('id_cliente,debe,haber,fecha')
        .order('fecha', { ascending: true })
        .order('id', { ascending: true })
        .range(a, b)
    )
    const porCliente = new Map<number, { debes: { fecha: string; monto: number }[]; haber: number }>()
    for (const m of movs) {
      const c = porCliente.get(m.id_cliente) ?? { debes: [], haber: 0 }
      if (num(m.debe) > 0) c.debes.push({ fecha: String(m.fecha).slice(0, 10), monto: num(m.debe) })
      c.haber += num(m.haber)
      porCliente.set(m.id_cliente, c)
    }
    const out: DeudaCc[] = []
    for (const [id, c] of porCliente) {
      let resto = c.haber
      const tramos: { fecha: string; monto: number }[] = []
      for (const d of c.debes) {
        const cubre = Math.min(resto, d.monto)
        resto -= cubre
        if (d.monto - cubre > 0.009) tramos.push({ fecha: d.fecha, monto: d.monto - cubre })
      }
      const saldo = tramos.reduce((s, t) => s + t.monto, 0)
      if (saldo > 0.009) out.push({ id_cliente: id, saldo, tramos })
    }
    return out
  })
}

// ============================================================================ clientes

export type ClienteContacto = {
  id: number
  nombre: string
  apellido: string | null
  empresa: string | null
  telefono: string | null
  email: string | null
}

export function contactosClientes(ids: number[]) {
  return envolver(async () => {
    const out = new Map<number, ClienteContacto>()
    const unicos = [...new Set(ids)]
    for (let i = 0; i < unicos.length; i += 300) {
      const { data, error } = await cliente()
        .from('clientes')
        .select('id,nombre,apellido,empresa,telefono,email')
        .in('id', unicos.slice(i, i + 300))
      if (error) throw new Error(error.message)
      for (const c of (data ?? []) as ClienteContacto[]) out.set(c.id, c)
    }
    return out
  })
}

export function nombreContacto(c: ClienteContacto | undefined, fallback: string): string {
  if (!c) return fallback
  return c.empresa?.trim() || [c.nombre, c.apellido].filter(Boolean).join(' ').trim() || fallback
}

// ============================================================================ cuentas por pagar

export type CxpPendiente = {
  id: number
  id_proveedor: number | null
  proveedor_nombre: string
  numero_documento: string | null
  monto_pendiente: number
  fecha_emision: string
  fecha_vencimiento: string | null
}

export function cxpPendientes() {
  return envolver(async () => {
    const filas = await traerTodo<CxpPendiente & { estado: string }>((a, b) =>
      cliente()
        .from('cuentas_por_pagar')
        .select('id,id_proveedor,proveedor_nombre,numero_documento,monto_pendiente,fecha_emision,fecha_vencimiento,estado')
        .not('estado', 'in', '("Pagado","Cancelado")')
        .gt('monto_pendiente', 0)
        .order('id', { ascending: true })
        .range(a, b)
    )
    return filas.map((f) => ({
      ...f,
      monto_pendiente: num(f.monto_pendiente),
      fecha_emision: String(f.fecha_emision).slice(0, 10),
      fecha_vencimiento: f.fecha_vencimiento ? String(f.fecha_vencimiento).slice(0, 10) : null
    }))
  })
}

// ============================================================================ bancos

export type CuentaBanco = { id: number; nombre: string; banco: string | null; saldo_inicial: number; activa: boolean }

export function cuentasBancarias() {
  return envolver(async () => {
    const { data, error } = await cliente().from('cuentas_bancarias').select('id,nombre,banco,saldo_inicial,activa').eq('activa', true).order('nombre')
    if (error) throw new Error(error.message)
    return ((data ?? []) as CuentaBanco[]).map((c) => ({ ...c, saldo_inicial: num(c.saldo_inicial) }))
  })
}

export function movimientosSinConciliar(desde: string, hasta: string) {
  return envolver(async () => {
    const { count, error } = await cliente()
      .from('movimientos_bancarios')
      .select('id', { count: 'exact', head: true })
      .eq('conciliado', false)
      .gte('fecha_movimiento', desde)
      .lte('fecha_movimiento', hasta)
    if (error) throw new Error(error.message)
    return count ?? 0
  })
}

// ============================================================================ gastos y compras (anomalías / cierre)

export type GastoRegistro = {
  id: number
  fecha_gasto: string
  proveedor: string | null
  proveedor_cuit: string | null
  categoria: string | null
  descripcion: string | null
  numero_comprobante: string | null
  ticket_url: string | null
  total: number
  id_gasto_fijo: number | null
}

export function gastosEntre(desde: string, hasta: string) {
  return envolver(async () => {
    const filas = await traerTodo<GastoRegistro>((a, b) =>
      cliente()
        .from('erp_gastos')
        .select('id,fecha_gasto,proveedor,proveedor_cuit,categoria,descripcion,numero_comprobante,ticket_url,total,id_gasto_fijo')
        .eq('anulado', false)
        .gte('fecha_gasto', desde)
        .lte('fecha_gasto', hasta)
        .order('id', { ascending: true })
        .range(a, b)
    )
    return filas.map((g) => ({ ...g, total: num(g.total), fecha_gasto: String(g.fecha_gasto).slice(0, 10) }))
  })
}

export type FacturaCompraRegistro = {
  id: number
  tipo_comprobante: string
  letra: string | null
  punto_venta: number
  numero_comprobante: number
  numero_factura: string | null
  fecha_emision: string
  id_proveedor: number | null
  proveedor_nombre: string
  proveedor_cuit: string | null
  total: number
}

export function facturasCompraEntre(desde: string, hasta: string) {
  return envolver(async () => {
    const filas = await traerTodo<FacturaCompraRegistro>((a, b) =>
      cliente()
        .from('facturas_compra')
        .select('id,tipo_comprobante,letra,punto_venta,numero_comprobante,numero_factura,fecha_emision,id_proveedor,proveedor_nombre,proveedor_cuit,total')
        .gte('fecha_emision', desde)
        .lte('fecha_emision', hasta)
        .order('id', { ascending: true })
        .range(a, b)
    )
    return filas.map((f) => ({ ...f, total: num(f.total), fecha_emision: String(f.fecha_emision).slice(0, 10) }))
  })
}

export function proveedoresConCuit() {
  return envolver(async () => {
    const filas = await traerTodo<{ id: number; nombre: string | null; razon_social: string | null; cuit: string | null }>((a, b) =>
      cliente().from('proveedores').select('id,nombre,razon_social,cuit').order('id', { ascending: true }).range(a, b)
    )
    return filas
  })
}

// ============================================================================ stock

export type ArticuloCritico = { id: number; nombre: string; stock: number; stock_minimo: number }

/** Artículos (base de stock) por debajo del mínimo. */
export function stockCritico() {
  return envolver(async () => {
    if (!stockSupabase) return [] as ArticuloCritico[]
    const { data, error } = await stockSupabase.from('articulos').select('id,descripcion,stock,stock_minimo').gt('stock_minimo', 0).limit(3000)
    if (error) throw new Error(error.message)
    return ((data ?? []) as Array<{ id: number; descripcion: string; stock: number; stock_minimo: number }>)
      .map((a) => ({ id: a.id, nombre: a.descripcion, stock: num(a.stock), stock_minimo: num(a.stock_minimo) }))
      .filter((a) => a.stock < a.stock_minimo)
      .sort((a, b) => a.stock / a.stock_minimo - b.stock / b.stock_minimo)
  })
}

// ============================================================================ presupuesto

export type TipoPresupuesto = 'ingreso' | 'gasto'
export type LineaPresupuesto = { id?: number; anio: number; mes: number; tipo: TipoPresupuesto; categoria: string; monto: number }

export function listPresupuesto(anio: number) {
  return envolver(async () => {
    const { data, error } = await cliente().from('erp_presupuestos').select('id,anio,mes,tipo,categoria,monto').eq('anio', anio)
    if (error) {
      if (/schema cache|does not exist|PGRST205|42P01/i.test(error.message)) {
        throw new Error('Falta ejecutar supabase/patches/2026-11-27_erp_presupuestos.sql en Supabase.')
      }
      throw new Error(error.message)
    }
    return ((data ?? []) as LineaPresupuesto[]).map((l) => ({ ...l, monto: num(l.monto) }))
  })
}

export function guardarPresupuesto(lineas: LineaPresupuesto[]) {
  return envolver(async () => {
    const filas = lineas.map(({ anio, mes, tipo, categoria, monto }) => ({ anio, mes, tipo, categoria: categoria.trim(), monto }))
    const { error } = await cliente().from('erp_presupuestos').upsert(filas, { onConflict: 'anio,mes,tipo,categoria' })
    if (error) throw new Error(error.message)
    return true
  })
}

export function borrarCategoriaPresupuesto(anio: number, tipo: TipoPresupuesto, categoria: string) {
  return envolver(async () => {
    const { error } = await cliente().from('erp_presupuestos').delete().eq('anio', anio).eq('tipo', tipo).eq('categoria', categoria)
    if (error) throw new Error(error.message)
    return true
  })
}

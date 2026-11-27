/**
 * Agenda de compromisos financieros: une los vencimientos cargados en /erp/compromisos con los
 * cheques pendientes de Tesorería, les pone semáforo y saca conclusiones (insights) para la
 * pantalla, el tablero del ERP y los avisos del navegador.
 */
import { supabase } from '../../services/supabaseClient'
import {
  listChequesPendientes,
  listCompromisos,
  type ChequeAgenda,
  type CompromisoConVencimientos,
  type SentidoCompromiso,
  type VencimientoCompromiso
} from '../../services/erpCompromisosApi'
import { nombreCliente, type ClienteBasico } from '../../services/erpContableApi'
import { diasHasta, urgenciaDe, type Urgencia } from '../../utils/compromisosUrgencia'

/** Los cheques de Tesorería no tienen días de aviso propios. */
export const DIAS_AVISO_CHEQUES = 7

export type FilaAgenda = {
  key: string
  origen: 'compromiso' | 'cheque'
  sentido: SentidoCompromiso
  tipo: string
  numero: string | null
  banco: string | null
  contraparte: string
  descripcion: string | null
  cuota: string | null
  fecha: string
  dias: number
  diasAviso: number
  importe: number
  estado: string
  pendiente: boolean
  urgencia: Urgencia
  compromiso?: CompromisoConVencimientos
  venc?: VencimientoCompromiso
  cheque?: ChequeAgenda
}

export type Nombres = {
  clientes: Map<number, Pick<ClienteBasico, 'nombre' | 'apellido' | 'empresa'>>
  proveedores: Map<number, { nombre: string | null; razon_social: string | null }>
}

export const nombreProveedor = (p: { nombre: string | null; razon_social: string | null } | undefined, id?: number | null) =>
  p?.razon_social || p?.nombre || (id ? `Proveedor #${id}` : '—')

export function armarFilas(
  compromisos: CompromisoConVencimientos[],
  cheques: ChequeAgenda[],
  nombres: Nombres,
  hoy: string,
  incluirCheques = true
): FilaAgenda[] {
  const cli = (id: number) => nombreCliente(nombres.clientes.get(id), id)
  const prov = (id: number) => nombreProveedor(nombres.proveedores.get(id), id)
  const out: FilaAgenda[] = []
  for (const c of compromisos) {
    const contraparte =
      c.contraparte_tipo === 'cliente' && c.id_cliente
        ? cli(c.id_cliente)
        : c.contraparte_tipo === 'proveedor' && c.id_proveedor
          ? prov(c.id_proveedor)
          : c.contraparte_nombre || '—'
    const total = c.vencimientos.length
    for (const v of c.vencimientos) {
      const pendiente = v.estado === 'Pendiente'
      out.push({
        key: `c${v.id}`,
        origen: 'compromiso',
        sentido: c.sentido,
        tipo: c.tipo,
        numero: v.numero_cheque || c.numero,
        banco: c.banco,
        contraparte,
        descripcion: c.descripcion,
        cuota: total > 1 ? `${v.nro_cuota}/${total}` : null,
        fecha: v.fecha,
        dias: diasHasta(v.fecha, hoy),
        diasAviso: c.dias_aviso,
        importe: v.importe,
        estado: v.estado,
        pendiente,
        urgencia: urgenciaDe(v.fecha, hoy, c.dias_aviso, pendiente),
        compromiso: c,
        venc: v
      })
    }
  }
  if (incluirCheques) {
    for (const ch of cheques) {
      const tercero = ch.tipo === 'Tercero'
      out.push({
        key: `t${ch.id}`,
        origen: 'cheque',
        sentido: tercero ? 'cobrar' : 'pagar',
        tipo: ch.es_echeq ? 'E-cheq' : 'Cheque',
        numero: ch.numero,
        banco: ch.banco,
        contraparte: tercero
          ? ch.id_cliente
            ? cli(ch.id_cliente)
            : ch.librador_nombre || ch.tercero_nombre || '—'
          : ch.id_proveedor
            ? prov(ch.id_proveedor)
            : ch.tercero_nombre || '—',
        descripcion: 'Cheque de Tesorería',
        cuota: null,
        fecha: ch.fecha_pago,
        dias: diasHasta(ch.fecha_pago, hoy),
        diasAviso: DIAS_AVISO_CHEQUES,
        importe: ch.importe,
        estado: ch.estado,
        pendiente: true,
        urgencia: urgenciaDe(ch.fecha_pago, hoy, DIAS_AVISO_CHEQUES, true),
        cheque: ch
      })
    }
  }
  return out.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.key.localeCompare(b.key))
}

/** Trae sólo los nombres de clientes/proveedores que aparecen en la agenda (liviano para el vigilante). */
async function nombresNecesarios(compromisos: CompromisoConVencimientos[], cheques: ChequeAgenda[]): Promise<Nombres> {
  const idsCli = new Set<number>()
  const idsProv = new Set<number>()
  for (const c of compromisos) {
    if (c.id_cliente) idsCli.add(c.id_cliente)
    if (c.id_proveedor) idsProv.add(c.id_proveedor)
  }
  for (const ch of cheques) {
    if (ch.id_cliente) idsCli.add(ch.id_cliente)
    if (ch.id_proveedor) idsProv.add(ch.id_proveedor)
  }
  const nombres: Nombres = { clientes: new Map(), proveedores: new Map() }
  if (!supabase) return nombres
  const [c, p] = await Promise.all([
    idsCli.size
      ? supabase.from('clientes_publico').select('id,nombre,apellido,empresa').in('id', [...idsCli])
      : Promise.resolve({ data: [] as { id: number; nombre: string; apellido: string | null; empresa: string | null }[] }),
    idsProv.size
      ? supabase.from('proveedores').select('id,nombre,razon_social').in('id', [...idsProv])
      : Promise.resolve({ data: [] as { id: number; nombre: string | null; razon_social: string | null }[] })
  ])
  for (const r of c.data ?? []) nombres.clientes.set(r.id, r)
  for (const r of p.data ?? []) nombres.proveedores.set(r.id, r)
  return nombres
}

export type AgendaCargada = {
  compromisos: CompromisoConVencimientos[]
  cheques: ChequeAgenda[]
  nombres: Nombres
}

export async function cargarAgenda(): Promise<{ ok: true; data: AgendaCargada } | { ok: false; error: string }> {
  const [c, ch] = await Promise.all([listCompromisos(), listChequesPendientes()])
  if (!c.success) return { ok: false, error: c.error }
  const cheques = ch.success ? ch.data : []
  return { ok: true, data: { compromisos: c.data, cheques, nombres: await nombresNecesarios(c.data, cheques) } }
}

// ----------------------------------------------------------------------------- proyección

function sumarDias(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}

/** Lunes de la semana de `iso`. */
export function lunesDe(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay() // 0 = domingo
  return sumarDias(iso, -((dow + 6) % 7))
}

export type Semana = { desde: string; hasta: string; cobrar: number; pagar: number; neto: number; acumulado: number; filas: FilaAgenda[] }

/** Semanas desde la actual. Los vencidos pendientes se suman a la semana actual (hay que resolverlos ya). */
export function proyeccionSemanal(filas: FilaAgenda[], hoy: string, semanas = 8): Semana[] {
  const pend = filas.filter((f) => f.pendiente)
  const inicio = lunesDe(hoy)
  const out: Semana[] = []
  let acumulado = 0
  for (let i = 0; i < semanas; i++) {
    const desde = sumarDias(inicio, i * 7)
    const hasta = sumarDias(desde, 6)
    const de = pend.filter((f) => (i === 0 ? f.fecha <= hasta : f.fecha >= desde && f.fecha <= hasta))
    const cobrar = de.filter((f) => f.sentido === 'cobrar').reduce((s, f) => s + f.importe, 0)
    const pagar = de.filter((f) => f.sentido === 'pagar').reduce((s, f) => s + f.importe, 0)
    acumulado += cobrar - pagar
    out.push({ desde, hasta, cobrar, pagar, neto: cobrar - pagar, acumulado, filas: de })
  }
  return out
}

// ----------------------------------------------------------------------------- insights

export type Insight = { tono: 'danger' | 'warn' | 'ok' | 'info'; icono: string; titulo: string; detalle: string; filtro?: { texto?: string; dia?: string; hasta?: string } }

const money = (n: number) => n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })
const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`

export function calcularInsights(filas: FilaAgenda[], hoy: string): Insight[] {
  const pend = filas.filter((f) => f.pendiente)
  const out: Insight[] = []
  const suma = (l: FilaAgenda[]) => l.reduce((s, f) => s + f.importe, 0)

  // 1) Cobros vencidos: a quién reclamar.
  const cobrarVencidos = pend.filter((f) => f.sentido === 'cobrar' && f.dias < 0)
  if (cobrarVencidos.length) {
    const porContraparte = new Map<string, FilaAgenda[]>()
    for (const f of cobrarVencidos) porContraparte.set(f.contraparte, [...(porContraparte.get(f.contraparte) ?? []), f])
    const [peor, lista] = [...porContraparte.entries()].sort((a, b) => suma(b[1]) - suma(a[1]))[0]
    const otros = porContraparte.size - 1
    out.push({
      tono: 'danger',
      icono: '📞',
      titulo: `Reclamar a ${peor}: ${money(suma(lista))} vencido${lista.length > 1 ? ` en ${lista.length} vencimientos` : ''}`,
      detalle: `El más viejo venció hace ${-Math.min(...lista.map((f) => f.dias))} días.${otros > 0 ? ` Hay ${otros} contraparte${otros > 1 ? 's' : ''} más con cobros vencidos.` : ''}`,
      filtro: { texto: peor }
    })
  }

  // 2) Pagos vencidos.
  const pagarVencidos = pend.filter((f) => f.sentido === 'pagar' && f.dias < 0)
  if (pagarVencidos.length) {
    out.push({
      tono: 'danger',
      icono: '⏰',
      titulo: `${pagarVencidos.length} pago${pagarVencidos.length > 1 ? 's' : ''} atrasado${pagarVencidos.length > 1 ? 's' : ''} por ${money(suma(pagarVencidos))}`,
      detalle: 'Si ya se pagaron, marcalos como pagados; si no, regularizalos para evitar intereses o rechazos.'
    })
  }

  // 3) Semana con faltante de caja.
  const semanas = proyeccionSemanal(filas, hoy, 8)
  const faltante = semanas.find((s) => s.neto < 0 && s.pagar > 0)
  if (faltante) {
    out.push({
      tono: 'warn',
      icono: '💸',
      titulo: `Semana del ${ddmm(faltante.desde)}: pagás ${money(faltante.pagar)} y cobrás ${money(faltante.cobrar)}`,
      detalle: `Faltan ${money(-faltante.neto)} para cubrir esa semana con lo que entra. Conviene prever fondos en el banco.`,
      filtro: { dia: faltante.desde, hasta: faltante.hasta }
    })
  }

  // 4) Día más cargado de pagos de los próximos 30 días.
  const proximosPagos = pend.filter((f) => f.sentido === 'pagar' && f.dias >= 0 && f.dias <= 30)
  if (proximosPagos.length >= 2) {
    const porDia = new Map<string, number>()
    for (const f of proximosPagos) porDia.set(f.fecha, (porDia.get(f.fecha) ?? 0) + f.importe)
    const [dia, monto] = [...porDia.entries()].sort((a, b) => b[1] - a[1])[0]
    const total = suma(proximosPagos)
    if (monto / total >= 0.4 && monto !== total) {
      out.push({
        tono: 'info',
        icono: '📌',
        titulo: `El ${ddmm(dia)} se concentra el ${Math.round((monto / total) * 100)}% de los pagos del mes`,
        detalle: `${money(monto)} ese día. Revisá que haya saldo en la cuenta un día antes.`,
        filtro: { dia }
      })
    }
  }

  // 5) Concentración de lo que hay que cobrar.
  const aCobrar = pend.filter((f) => f.sentido === 'cobrar')
  const totalCobrar = suma(aCobrar)
  if (aCobrar.length >= 3 && totalCobrar > 0) {
    const porCli = new Map<string, number>()
    for (const f of aCobrar) porCli.set(f.contraparte, (porCli.get(f.contraparte) ?? 0) + f.importe)
    const [cli, monto] = [...porCli.entries()].sort((a, b) => b[1] - a[1])[0]
    const pct = monto / totalCobrar
    if (pct >= 0.4 && porCli.size > 1) {
      out.push({
        tono: 'info',
        icono: '🎯',
        titulo: `${cli} concentra el ${Math.round(pct * 100)}% de lo que tenés a cobrar`,
        detalle: `${money(monto)} de ${money(totalCobrar)}. Si se atrasa, impacta fuerte en la caja.`,
        filtro: { texto: cli }
      })
    }
  }

  // 6) Todo tranquilo.
  if (!out.length) {
    const prox = pend.filter((f) => f.dias >= 0).sort((a, b) => a.dias - b.dias)[0]
    out.push({
      tono: 'ok',
      icono: '✅',
      titulo: 'Todo al día',
      detalle: prox
        ? `El próximo vencimiento es el ${ddmm(prox.fecha)} (${prox.sentido === 'cobrar' ? 'cobrar a' : 'pagar a'} ${prox.contraparte}, ${money(prox.importe)}).`
        : 'No hay vencimientos pendientes.'
    })
  }
  return out
}

/**
 * Flujo de caja proyectado: junta todo lo que entra y sale con fecha y lo reparte por semana.
 * - Compromisos y cheques de Tesorería (fecha exacta).
 * - Facturas por cobrar: vencimiento + atraso promedio del cliente (lo "esperable", no lo ideal).
 * - Cuentas por pagar a proveedores.
 * - Gastos fijos pendientes de cada período.
 * Lo vencido sin resolver cae en la semana actual.
 */
import { armarFilas, cargarAgenda } from '../compromisos/agenda'
import { aplicaEnPeriodo, listGastosFijos, listPagosGastosFijos, saldoPendienteGasto, totalPagadoPeriodo, vencimientoEnPeriodo } from '../../services/erpGastosFijosApi'
import { contactosClientes, cxcPendientes, cxpPendientes, habitosDePago, nombreContacto, sumarDias } from '../../services/erpGestionApi'

export const K_SALDO_INICIAL = 'erp_flujo_saldo_inicial'

/** "1.234.567,89" (AR) o "1234567.89" → número. */
export function parseMonto(s: string): number {
  const t = s.replace(/\s|\$/g, '')
  const n = Number(t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : /^\d{1,3}(\.\d{3})+$/.test(t) ? t.replace(/\./g, '') : t)
  return Number.isFinite(n) ? n : 0
}

/** Plata disponible hoy cargada en Flujo de caja (null si nunca se cargó). */
export function leerSaldoInicial(): number | null {
  const t = localStorage.getItem(K_SALDO_INICIAL)
  return t && t.trim() ? parseMonto(t) : null
}

export type OrigenFlujo ='compromiso' | 'factura' | 'proveedor' | 'gasto_fijo'

export const ORIGEN_LABEL: Record<OrigenFlujo, string> = {
  compromiso: 'Cheques y compromisos',
  factura: 'Facturas a cobrar',
  proveedor: 'Deudas con proveedores',
  gasto_fijo: 'Gastos fijos'
}

export type MovFlujo = {
  key: string
  origen: OrigenFlujo
  sentido: 'entra' | 'sale'
  fecha: string
  fechaOriginal: string
  concepto: string
  contraparte: string
  importe: number
  /** Texto corto cuando la fecha se corrió (vencido, atraso habitual del cliente…). */
  nota: string | null
}

export type SemanaFlujo = {
  desde: string
  hasta: string
  entra: number
  sale: number
  saldoFinal: number
  movs: MovFlujo[]
}

export async function cargarMovimientosFlujo(hoy: string, horizonteDias: number): Promise<{ movs: MovFlujo[]; errores: string[] }> {
  const errores: string[] = []
  const hasta = sumarDias(hoy, horizonteDias)
  const movs: MovFlujo[] = []
  const alHoy = (f: string) => (f < hoy ? hoy : f)

  const [agenda, cxc, cxp, habitos, fijos] = await Promise.all([cargarAgenda(), cxcPendientes(), cxpPendientes(), habitosDePago(), listGastosFijos()])

  // Compromisos + cheques
  if (agenda.ok) {
    for (const f of armarFilas(agenda.data.compromisos, agenda.data.cheques, agenda.data.nombres, hoy)) {
      if (!f.pendiente || f.fecha > hasta) continue
      movs.push({
        key: `k${f.key}`,
        origen: 'compromiso',
        sentido: f.sentido === 'cobrar' ? 'entra' : 'sale',
        fecha: alHoy(f.fecha),
        fechaOriginal: f.fecha,
        concepto: `${f.tipo}${f.numero ? ` N° ${f.numero}` : ''}${f.cuota ? ` · cuota ${f.cuota}` : ''}`,
        contraparte: f.contraparte,
        importe: f.importe,
        nota: f.fecha < hoy ? 'vencido' : null
      })
    }
  } else errores.push(`Compromisos: ${agenda.error}`)

  // Facturas por cobrar
  if (cxc.success) {
    const hab = habitos.success ? habitos.data : new Map()
    const contactos = await contactosClientes(cxc.data.map((c) => c.id_cliente).filter((x): x is number => x != null))
    for (const c of cxc.data) {
      const base = c.fecha_vencimiento ?? sumarDias(c.fecha_emision, 30)
      const atraso = c.id_cliente ? hab.get(c.id_cliente)?.atrasoPromedio ?? 0 : 0
      const esperada = alHoy(sumarDias(base, atraso))
      if (esperada > hasta) continue
      movs.push({
        key: `f${c.id}`,
        origen: 'factura',
        sentido: 'entra',
        fecha: esperada,
        fechaOriginal: base,
        concepto: `Factura ${c.numero_factura ?? `#${c.id_factura}`}`,
        contraparte: c.id_cliente && contactos.success ? nombreContacto(contactos.data.get(c.id_cliente), c.cliente_nombre) : c.cliente_nombre,
        importe: c.monto_pendiente,
        nota: base < hoy && atraso === 0 ? 'vencida' : atraso > 0 ? `suele pagar ${atraso} días tarde` : c.fecha_vencimiento ? null : 'sin vencimiento: +30 días'
      })
    }
  } else errores.push(`Facturas a cobrar: ${cxc.error}`)

  // Deudas con proveedores
  if (cxp.success) {
    for (const p of cxp.data) {
      const base = p.fecha_vencimiento ?? sumarDias(p.fecha_emision, 30)
      if (base > hasta) continue
      movs.push({
        key: `p${p.id}`,
        origen: 'proveedor',
        sentido: 'sale',
        fecha: alHoy(base),
        fechaOriginal: base,
        concepto: p.numero_documento ? `Comprobante ${p.numero_documento}` : 'Cuenta por pagar',
        contraparte: p.proveedor_nombre,
        importe: p.monto_pendiente,
        nota: base < hoy ? 'vencida' : p.fecha_vencimiento ? null : 'sin vencimiento: +30 días'
      })
    }
  } else errores.push(`Proveedores: ${cxp.error}`)

  // Gastos fijos: desde el mes actual hasta el horizonte
  if (fijos.success) {
    const pIni = hoy.slice(0, 7)
    const pFin = hasta.slice(0, 7)
    const pagos = await listPagosGastosFijos(pIni, pFin)
    const periodos: string[] = []
    for (let p = pIni; p <= pFin; ) {
      periodos.push(p)
      const [y, m] = p.split('-').map(Number)
      p = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`
    }
    for (const g of fijos.data) {
      if (!g.activo) continue
      for (const per of periodos) {
        if (!aplicaEnPeriodo(g, per)) continue
        const vence = vencimientoEnPeriodo(g.dia_vencimiento, per)
        if (vence > hasta) continue
        const pagado = pagos.success ? totalPagadoPeriodo(pagos.data, g.id, per) : 0
        const pendiente = saldoPendienteGasto(Number(g.monto), pagado)
        if (pendiente <= 0) continue
        movs.push({
          key: `g${g.id}-${per}`,
          origen: 'gasto_fijo',
          sentido: 'sale',
          fecha: alHoy(vence),
          fechaOriginal: vence,
          concepto: g.concepto,
          contraparte: g.proveedor || g.categoria || 'Gasto fijo',
          importe: pendiente,
          nota: vence < hoy ? 'vencido' : pagado > 0 ? 'pago parcial' : null
        })
      }
    }
  } else errores.push(`Gastos fijos: ${fijos.error}`)

  movs.sort((a, b) => a.fecha.localeCompare(b.fecha) || (a.sentido === b.sentido ? b.importe - a.importe : a.sentido === 'entra' ? -1 : 1))
  return { movs, errores }
}

function lunes(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  return sumarDias(iso, -((dow + 6) % 7))
}

export function semanasFlujo(movs: MovFlujo[], hoy: string, semanas: number, saldoInicial: number): SemanaFlujo[] {
  const ini = lunes(hoy)
  let saldo = saldoInicial
  return Array.from({ length: semanas }, (_, i) => {
    const desde = sumarDias(ini, i * 7)
    const hasta = sumarDias(desde, 6)
    const de = movs.filter((m) => m.fecha >= desde && m.fecha <= hasta)
    const entra = de.filter((m) => m.sentido === 'entra').reduce((s, m) => s + m.importe, 0)
    const sale = de.filter((m) => m.sentido === 'sale').reduce((s, m) => s + m.importe, 0)
    saldo += entra - sale
    return { desde, hasta, entra, sale, saldoFinal: saldo, movs: de }
  })
}

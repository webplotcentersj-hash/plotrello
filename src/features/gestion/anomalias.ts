/**
 * Detección de errores y anomalías en gastos, compras y cheques.
 * Todo se calcula en el navegador a partir de los datos ya cargados; no modifica nada.
 */
import type { ChequeAgenda } from '../../services/erpCompromisosApi'
import { diasEntre, type FacturaCompraRegistro, type GastoRegistro } from '../../services/erpGestionApi'

export type Severidad = 'alta' | 'media' | 'baja'
export type TipoAnomalia = 'duplicado' | 'atipico' | 'cuit' | 'doble_carga' | 'cheque'

export type Anomalia = {
  id: string
  tipo: TipoAnomalia
  severidad: Severidad
  titulo: string
  detalle: string
  monto: number | null
  fecha: string | null
  ir?: string
}

export const TIPO_LABEL: Record<TipoAnomalia, string> = {
  duplicado: 'Posibles duplicados',
  atipico: 'Montos fuera de lo normal',
  cuit: 'CUIT con problemas',
  doble_carga: 'Cargado dos veces (gasto y compra)',
  cheque: 'Cheques en riesgo'
}

const norm = (s: string | null | undefined) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\b(s\.?a\.?|s\.?r\.?l\.?|sas|s\.?a\.?s\.?)\b/g, '')
    .replace(/[^a-z0-9]/g, '')

const soloDigitos = (s: string | null | undefined) => String(s || '').replace(/\D/g, '')

const money = (n: number) => n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })
const ddmmaa = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(2, 4)}`

/** Valida el dígito verificador de un CUIT/CUIL (11 dígitos). */
export function cuitValido(cuit: string): boolean {
  const d = soloDigitos(cuit)
  if (d.length !== 11) return false
  const pesos = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]
  const suma = pesos.reduce((s, p, i) => s + p * Number(d[i]), 0)
  let dv = 11 - (suma % 11)
  if (dv === 11) dv = 0
  if (dv === 10) dv = 9
  return dv === Number(d[10])
}

function mediana(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

export function detectarAnomalias(input: {
  hoy: string
  gastos: GastoRegistro[]
  compras: FacturaCompraRegistro[]
  proveedores: { id: number; nombre: string | null; razon_social: string | null; cuit: string | null }[]
  cheques: ChequeAgenda[]
}): Anomalia[] {
  const { hoy, gastos, compras, proveedores, cheques } = input
  const out: Anomalia[] = []

  // 1) Facturas de compra con el mismo número para el mismo proveedor.
  const porNumero = new Map<string, FacturaCompraRegistro[]>()
  for (const f of compras) {
    const prov = soloDigitos(f.proveedor_cuit) || norm(f.proveedor_nombre)
    const k = `${prov}|${f.tipo_comprobante}|${f.letra ?? ''}|${f.punto_venta}|${f.numero_comprobante}`
    porNumero.set(k, [...(porNumero.get(k) ?? []), f])
  }
  for (const [k, l] of porNumero) {
    if (l.length < 2) continue
    const f = l[0]
    out.push({
      id: `fc-num-${k}`,
      tipo: 'duplicado',
      severidad: 'alta',
      titulo: `Factura de compra repetida: ${f.proveedor_nombre} ${f.numero_factura ?? `${f.punto_venta}-${f.numero_comprobante}`}`,
      detalle: `Cargada ${l.length} veces (IDs ${l.map((x) => x.id).join(', ')}). Si se pagó dos veces o se toma doble el IVA, es plata.`,
      monto: f.total * (l.length - 1),
      fecha: f.fecha_emision,
      ir: '/erp/compras'
    })
  }

  // 2) Gastos con el mismo comprobante, o mismo proveedor + importe + fecha.
  const gastoNum = new Map<string, GastoRegistro[]>()
  const gastoMismo = new Map<string, GastoRegistro[]>()
  for (const g of gastos) {
    const prov = soloDigitos(g.proveedor_cuit) || norm(g.proveedor)
    if (g.numero_comprobante?.trim()) {
      const k = `${prov}|${g.numero_comprobante.replace(/\s/g, '')}`
      gastoNum.set(k, [...(gastoNum.get(k) ?? []), g])
    } else if (prov) {
      const k = `${prov}|${g.total.toFixed(2)}|${g.fecha_gasto}`
      gastoMismo.set(k, [...(gastoMismo.get(k) ?? []), g])
    }
  }
  for (const [k, l] of gastoNum) {
    if (l.length < 2 || l.every((g) => g.id_gasto_fijo)) continue
    out.push({
      id: `g-num-${k}`,
      tipo: 'duplicado',
      severidad: 'alta',
      titulo: `Gasto repetido: ${l[0].proveedor || 'sin proveedor'} comprobante ${l[0].numero_comprobante}`,
      detalle: `El mismo comprobante aparece ${l.length} veces: ${l.map((g) => `${ddmmaa(g.fecha_gasto)} ${money(g.total)}`).join(' · ')}.`,
      monto: l.slice(1).reduce((s, g) => s + g.total, 0),
      fecha: l[0].fecha_gasto,
      ir: '/erp/gastos'
    })
  }
  for (const [k, l] of gastoMismo) {
    if (l.length < 2) continue
    out.push({
      id: `g-eq-${k}`,
      tipo: 'duplicado',
      severidad: 'media',
      titulo: `Posible gasto duplicado: ${l[0].proveedor} ${money(l[0].total)} el ${ddmmaa(l[0].fecha_gasto)}`,
      detalle: `${l.length} gastos iguales (mismo proveedor, importe y día) sin número de comprobante para distinguirlos.`,
      monto: l.slice(1).reduce((s, g) => s + g.total, 0),
      fecha: l[0].fecha_gasto,
      ir: '/erp/gastos'
    })
  }

  // 3) Gastos muy por encima de lo habitual en su categoría.
  const porCat = new Map<string, GastoRegistro[]>()
  for (const g of gastos) {
    const c = g.categoria?.trim()
    if (!c || g.id_gasto_fijo) continue
    porCat.set(c, [...(porCat.get(c) ?? []), g])
  }
  for (const [cat, l] of porCat) {
    if (l.length < 6) continue
    const med = mediana(l.map((g) => g.total))
    if (med <= 0) continue
    for (const g of l) {
      if (diasEntre(g.fecha_gasto, hoy) > 60) continue
      const veces = g.total / med
      if (veces >= 3 && g.total - med > 20000) {
        out.push({
          id: `atip-${g.id}`,
          tipo: 'atipico',
          severidad: veces >= 6 ? 'alta' : 'media',
          titulo: `${cat}: ${money(g.total)} es ${veces.toFixed(1)} veces lo habitual`,
          detalle: `${g.proveedor || 'Sin proveedor'} · ${ddmmaa(g.fecha_gasto)}${g.descripcion ? ` · ${g.descripcion}` : ''}. Lo normal en ${cat} es ~${money(med)}. ¿Un cero de más o un gasto extraordinario?`,
          monto: g.total,
          fecha: g.fecha_gasto,
          ir: '/erp/gastos'
        })
      }
    }
  }

  // 4) CUIT inválido o distinto para el mismo proveedor.
  const cuitsPorNombre = new Map<string, { nombre: string; cuits: Set<string> }>()
  const registrarCuit = (nombre: string | null | undefined, cuit: string | null | undefined) => {
    const n = norm(nombre)
    const c = soloDigitos(cuit)
    if (!n || c.length !== 11) return
    const e = cuitsPorNombre.get(n) ?? { nombre: String(nombre), cuits: new Set<string>() }
    e.cuits.add(c)
    cuitsPorNombre.set(n, e)
  }
  for (const p of proveedores) registrarCuit(p.razon_social || p.nombre, p.cuit)
  for (const f of compras) registrarCuit(f.proveedor_nombre, f.proveedor_cuit)
  for (const g of gastos) registrarCuit(g.proveedor, g.proveedor_cuit)
  for (const [n, e] of cuitsPorNombre) {
    if (e.cuits.size < 2) continue
    out.push({
      id: `cuit-multi-${n}`,
      tipo: 'cuit',
      severidad: 'media',
      titulo: `${e.nombre} aparece con ${e.cuits.size} CUIT distintos`,
      detalle: `${[...e.cuits].map((c) => `${c.slice(0, 2)}-${c.slice(2, 10)}-${c.slice(10)}`).join(' · ')}. Puede ser un error de tipeo o dos empresas distintas con nombre parecido.`,
      monto: null,
      fecha: null,
      ir: '/erp/compras'
    })
  }
  const invalidos = new Map<string, string>()
  for (const p of proveedores) if (p.cuit && soloDigitos(p.cuit).length >= 10 && !cuitValido(p.cuit)) invalidos.set(soloDigitos(p.cuit), p.razon_social || p.nombre || `Proveedor #${p.id}`)
  for (const f of compras) if (f.proveedor_cuit && soloDigitos(f.proveedor_cuit).length >= 10 && !cuitValido(f.proveedor_cuit)) invalidos.set(soloDigitos(f.proveedor_cuit), f.proveedor_nombre)
  for (const g of gastos) if (g.proveedor_cuit && soloDigitos(g.proveedor_cuit).length >= 10 && !cuitValido(g.proveedor_cuit)) invalidos.set(soloDigitos(g.proveedor_cuit), g.proveedor || 'Gasto')
  for (const [c, nombre] of invalidos) {
    out.push({
      id: `cuit-inv-${c}`,
      tipo: 'cuit',
      severidad: 'media',
      titulo: `CUIT inválido: ${c} (${nombre})`,
      detalle: 'El dígito verificador no coincide. ARCA puede rechazar el crédito fiscal de ese comprobante.',
      monto: null,
      fecha: null
    })
  }

  // 5) El mismo comprobante cargado como gasto y como factura de compra.
  const compraClave = new Map<string, FacturaCompraRegistro>()
  for (const f of compras) {
    const c = soloDigitos(f.proveedor_cuit)
    if (c) compraClave.set(`${c}|${f.total.toFixed(2)}`, f)
  }
  for (const g of gastos) {
    const c = soloDigitos(g.proveedor_cuit)
    if (!c) continue
    const f = compraClave.get(`${c}|${g.total.toFixed(2)}`)
    if (f && Math.abs(diasEntre(f.fecha_emision, g.fecha_gasto)) <= 5) {
      out.push({
        id: `doble-${g.id}-${f.id}`,
        tipo: 'doble_carga',
        severidad: 'media',
        titulo: `${f.proveedor_nombre} ${money(g.total)}: está en Gastos y en Compras`,
        detalle: `Gasto del ${ddmmaa(g.fecha_gasto)} y factura de compra ${f.numero_factura ?? ''} del ${ddmmaa(f.fecha_emision)}. Si es el mismo comprobante, el egreso y el IVA se cuentan dos veces.`,
        monto: g.total,
        fecha: g.fecha_gasto,
        ir: '/erp/gastos'
      })
    }
  }

  // 6) Cheques de terceros en cartera cerca de perder el plazo de depósito (30 días desde la fecha de pago).
  for (const ch of cheques) {
    if (ch.tipo !== 'Tercero' || ch.estado !== 'En cartera') continue
    const desde = diasEntre(ch.fecha_pago, hoy)
    if (desde < 20) continue
    const quedan = 30 - desde
    out.push({
      id: `cheque-${ch.id}`,
      tipo: 'cheque',
      severidad: quedan <= 3 ? 'alta' : 'media',
      titulo: quedan < 0 ? `Cheque N° ${ch.numero} vencido para depositar` : `Cheque N° ${ch.numero}: quedan ${quedan} días para depositarlo`,
      detalle: `${ch.banco ?? ''} · ${money(ch.importe)} · fecha de pago ${ddmmaa(ch.fecha_pago)}. Los cheques se pueden presentar hasta 30 días después de su fecha de pago.`,
      monto: ch.importe,
      fecha: ch.fecha_pago,
      ir: '/erp/tesoreria/cheques'
    })
  }

  const peso: Record<Severidad, number> = { alta: 0, media: 1, baja: 2 }
  return out.sort((a, b) => peso[a.severidad] - peso[b.severidad] || (b.monto ?? 0) - (a.monto ?? 0))
}

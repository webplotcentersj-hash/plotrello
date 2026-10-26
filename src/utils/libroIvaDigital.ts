/**
 * Libro IVA Digital (RG 4597): archivos TXT de ancho fijo de ventas y compras.
 *
 * - Ventas:  cabecera (266) + alícuotas (62)
 * - Compras: cabecera (325) + alícuotas (84)
 *
 * Los importes salen sin separadores, con 2 decimales implícitos, completados con ceros a la izquierda.
 * Las notas de crédito se informan con importes positivos (el tipo de comprobante da el signo).
 * Conviene validar el resultado con el importador de ARCA antes de presentarlo.
 */

export type ItemLibroIva = {
  iva_porcentaje?: number | string | null
  subtotal?: number | string | null
  iva_monto?: number | string | null
}

export type FacturaVentaLibro = {
  tipo_comprobante?: string | null
  punto_venta?: number | string | null
  numero_comprobante?: number | string | null
  fecha_emision?: string | null
  cliente_nombre?: string | null
  cliente_dni_cuit?: string | null
  subtotal?: number | string | null
  iva?: number | string | null
  total?: number | string | null
  cae?: string | null
  items?: ItemLibroIva[] | null
}

export type FacturaCompraLibro = {
  tipo_comprobante?: string | null
  letra?: string | null
  punto_venta?: number | string | null
  numero_comprobante?: number | string | null
  fecha_emision?: string | null
  proveedor_nombre?: string | null
  proveedor_cuit?: string | null
  subtotal?: number | string | null
  iva?: number | string | null
  total?: number | string | null
  no_gravado?: number | string | null
  exento?: number | string | null
  percepcion_iva?: number | string | null
  percepcion_otros_nac?: number | string | null
  percepcion_iibb?: number | string | null
  percepcion_municipal?: number | string | null
  impuestos_internos?: number | string | null
  otros_tributos?: number | string | null
  items?: ItemLibroIva[] | null
}

export type LibroIvaDigital = {
  ventasCbte: string
  ventasAlicuotas: string
  comprasCbte: string
  comprasAlicuotas: string
  warnings: string[]
  resumen: {
    ventas: { comprobantes: number; neto: number; iva: number; total: number }
    compras: { comprobantes: number; neto: number; iva: number; total: number }
  }
}

const EOL = '\r\n'

/** Código de alícuota de IVA (tabla ARCA) por porcentaje. */
const CODIGO_ALICUOTA: Array<{ pct: number; codigo: string }> = [
  { pct: 0, codigo: '0003' },
  { pct: 10.5, codigo: '0004' },
  { pct: 21, codigo: '0005' },
  { pct: 27, codigo: '0006' },
  { pct: 5, codigo: '0008' },
  { pct: 2.5, codigo: '0009' }
]

export function codigoAlicuota(pct: number): string | null {
  const hit = CODIGO_ALICUOTA.find((a) => Math.abs(a.pct - pct) < 0.0001)
  return hit ? hit.codigo : null
}

function num(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

/** Importe positivo sin separador, 2 decimales implícitos. */
export function fmtImporte(v: unknown, largo = 15): string {
  const cents = Math.round(Math.abs(num(v)) * 100 + 1e-9)
  return String(cents).padStart(largo, '0').slice(-largo)
}

/** Entero con ceros a la izquierda. */
export function fmtEntero(v: unknown, largo: number): string {
  const n = Math.trunc(Math.abs(num(v)))
  return String(n).padStart(largo, '0').slice(-largo)
}

/** Texto en mayúsculas, sin acentos, alineado a la izquierda y rellenado con espacios. */
export function fmtTexto(v: unknown, largo: number): string {
  const limpio = String(v ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\x20-\x7e]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
  return limpio.padEnd(largo, ' ').slice(0, largo)
}

export function soloDigitos(v: unknown): string {
  return String(v ?? '').replace(/\D/g, '')
}

function fechaAfip(v: unknown): string {
  const d = String(v ?? '').split('T')[0].replace(/-/g, '')
  return /^\d{8}$/.test(d) ? d : '00000000'
}

/** Código ARCA del tipo de comprobante a partir de "Factura A" / "Nota de Crédito B" / etc. */
export function codigoTipoComprobante(tipo: string, letraExplicita?: string | null): string | null {
  const t = String(tipo || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
  const letra = (letraExplicita || t.match(/\b([abc])\s*$/)?.[1] || '').toUpperCase()
  const familia = t.startsWith('nota de credito') ? 'nc' : t.startsWith('nota de debito') ? 'nd' : t.startsWith('factura') ? 'f' : ''
  if (!familia || !['A', 'B', 'C'].includes(letra)) return null
  const tabla: Record<string, Record<string, string>> = {
    A: { f: '001', nd: '002', nc: '003' },
    B: { f: '006', nd: '007', nc: '008' },
    C: { f: '011', nd: '012', nc: '013' }
  }
  return tabla[letra][familia]
}

type Documento = { codigo: string; numero: string }

function documento(v: unknown): Documento {
  const d = soloDigitos(v)
  if (d.length === 11) return { codigo: '80', numero: d }
  if (d.length >= 7 && d.length <= 8) return { codigo: '96', numero: d }
  return { codigo: '99', numero: '0' }
}

type LineaAlicuota = { pct: number; neto: number; iva: number }

/** Agrupa los ítems por alícuota. Sin ítems, usa subtotal/iva de la cabecera. */
function agruparAlicuotas(
  items: ItemLibroIva[] | null | undefined,
  respaldo: { subtotal: number; iva: number },
  avisos: string[],
  etiqueta: string
): LineaAlicuota[] {
  const mapa = new Map<number, LineaAlicuota>()
  const sumar = (pct: number, neto: number, iva: number) => {
    const clave = Math.round(pct * 1000) / 1000
    const prev = mapa.get(clave) ?? { pct: clave, neto: 0, iva: 0 }
    prev.neto += neto
    prev.iva += iva
    mapa.set(clave, prev)
  }

  const lista = Array.isArray(items) ? items : []
  for (const it of lista) {
    sumar(num(it.iva_porcentaje), Math.abs(num(it.subtotal)), Math.abs(num(it.iva_monto)))
  }

  if (mapa.size === 0 && (respaldo.subtotal !== 0 || respaldo.iva !== 0)) {
    const neto = Math.abs(respaldo.subtotal)
    const iva = Math.abs(respaldo.iva)
    const pct = neto > 0 && iva > 0 ? Math.round((iva / neto) * 1000) / 10 : 0
    sumar(pct, neto, iva)
    avisos.push(`${etiqueta}: sin ítems, la alícuota se dedujo de la cabecera (${pct}%).`)
  }

  return [...mapa.values()]
    .map((l) => ({ pct: l.pct, neto: round2(l.neto), iva: round2(l.iva) }))
    .sort((a, b) => a.pct - b.pct)
}

function etiquetaCbte(tipo: unknown, pv: unknown, nro: unknown): string {
  return `${String(tipo ?? '—')} ${fmtEntero(pv, 4)}-${fmtEntero(nro, 8)}`
}

export function generarLibroIvaDigital(
  ventas: FacturaVentaLibro[],
  compras: FacturaCompraLibro[]
): LibroIvaDigital {
  const warnings: string[] = []
  const ventasCbte: string[] = []
  const ventasAlic: string[] = []
  const comprasCbte: string[] = []
  const comprasAlic: string[] = []
  const resumen: LibroIvaDigital['resumen'] = {
    ventas: { comprobantes: 0, neto: 0, iva: 0, total: 0 },
    compras: { comprobantes: 0, neto: 0, iva: 0, total: 0 }
  }

  // ---- Ventas ----
  for (const f of ventas) {
    const etiqueta = etiquetaCbte(f.tipo_comprobante, f.punto_venta, f.numero_comprobante)
    const tipo = codigoTipoComprobante(String(f.tipo_comprobante || ''))
    if (!tipo) {
      warnings.push(`${etiqueta}: tipo de comprobante no reconocido, se omitió.`)
      continue
    }
    if (!f.cae) warnings.push(`${etiqueta}: no tiene CAE.`)

    const total = round2(Math.abs(num(f.total)))
    const lineas = agruparAlicuotas(f.items, { subtotal: num(f.subtotal), iva: num(f.iva) }, warnings, etiqueta)
    const sinCodigo = lineas.find((l) => !codigoAlicuota(l.pct))
    if (sinCodigo) {
      warnings.push(`${etiqueta}: alícuota ${sinCodigo.pct}% sin código ARCA, se omitió.`)
      continue
    }

    const neto = round2(lineas.reduce((s, l) => s + l.neto, 0))
    const iva = round2(lineas.reduce((s, l) => s + l.iva, 0))
    const noGravado = lineas.length === 0 ? total : round2(Math.max(0, total - neto - iva))
    if (lineas.length > 0 && Math.abs(total - neto - iva - noGravado) > 0.05) {
      warnings.push(`${etiqueta}: el total no cierra con neto + IVA.`)
    }
    if (noGravado > 0.05 && lineas.length > 0) {
      warnings.push(`${etiqueta}: total mayor a neto + IVA en ${noGravado.toFixed(2)}, se informó como no gravado.`)
    }

    const doc = documento(f.cliente_dni_cuit)
    if (doc.codigo === '99' && total >= 10_000_000) {
      warnings.push(`${etiqueta}: monto alto sin identificar al comprador.`)
    }

    const pv = fmtEntero(f.punto_venta, 5)
    const nro = fmtEntero(f.numero_comprobante, 20)

    ventasCbte.push(
      fechaAfip(f.fecha_emision) +
        tipo +
        pv +
        nro +
        nro +
        doc.codigo +
        doc.numero.padStart(20, '0') +
        fmtTexto(f.cliente_nombre, 30) +
        fmtImporte(total) +
        fmtImporte(noGravado) +
        fmtImporte(0) + // percepción a no categorizados
        fmtImporte(0) + // operaciones exentas
        fmtImporte(0) + // percepciones / pagos a cuenta nacionales
        fmtImporte(0) + // percepciones IIBB
        fmtImporte(0) + // percepciones municipales
        fmtImporte(0) + // impuestos internos
        'PES' +
        '0001000000' +
        String(lineas.length) +
        (lineas.length === 0 ? 'N' : '0') +
        fmtImporte(0) + // otros tributos
        '00000000' // vencimiento de pago
    )

    for (const l of lineas) {
      ventasAlic.push(tipo + pv + nro + fmtImporte(l.neto) + (codigoAlicuota(l.pct) as string) + fmtImporte(l.iva))
    }

    resumen.ventas.comprobantes += 1
    resumen.ventas.neto += neto
    resumen.ventas.iva += iva
    resumen.ventas.total += total
  }

  // ---- Compras ----
  for (const f of compras) {
    const etiqueta = etiquetaCbte(`${f.tipo_comprobante ?? ''} ${f.letra ?? ''}`.trim(), f.punto_venta, f.numero_comprobante)
    const tipo = codigoTipoComprobante(String(f.tipo_comprobante || ''), f.letra)
    if (!tipo) {
      warnings.push(`${etiqueta}: tipo de comprobante no reconocido, se omitió.`)
      continue
    }

    const letra = String(f.letra || '').toUpperCase()
    const discrimina = letra === 'A'
    const noGravadoExtra = round2(Math.abs(num(f.no_gravado)))
    const exento = round2(Math.abs(num(f.exento)))
    const percIva = round2(Math.abs(num(f.percepcion_iva)))
    const percOtrosNac = round2(Math.abs(num(f.percepcion_otros_nac)))
    const percIibb = round2(Math.abs(num(f.percepcion_iibb)))
    const percMuni = round2(Math.abs(num(f.percepcion_municipal)))
    const internos = round2(Math.abs(num(f.impuestos_internos)))
    const otros = round2(Math.abs(num(f.otros_tributos)))

    const lineas = discrimina
      ? agruparAlicuotas(f.items, { subtotal: num(f.subtotal), iva: num(f.iva) }, warnings, etiqueta)
      : []
    const sinCodigo = lineas.find((l) => !codigoAlicuota(l.pct))
    if (sinCodigo) {
      warnings.push(`${etiqueta}: alícuota ${sinCodigo.pct}% sin código ARCA, se omitió.`)
      continue
    }

    const total = round2(Math.abs(num(f.total)))
    const neto = round2(lineas.reduce((s, l) => s + l.neto, 0))
    const iva = round2(lineas.reduce((s, l) => s + l.iva, 0))

    // En B / C no hay crédito fiscal: todo el monto neto + IVA va como "no gravado".
    const baseSinDiscriminar = discrimina ? 0 : round2(Math.abs(num(f.subtotal)) + Math.abs(num(f.iva)))
    const noGravado = round2(noGravadoExtra + baseSinDiscriminar)

    const compuesto = round2(neto + iva + noGravado + exento + percIva + percOtrosNac + percIibb + percMuni + internos + otros)
    if (Math.abs(compuesto - total) > 0.05) {
      warnings.push(`${etiqueta}: el total (${total.toFixed(2)}) no cierra con sus componentes (${compuesto.toFixed(2)}).`)
    }

    const cuit = soloDigitos(f.proveedor_cuit)
    if (cuit.length !== 11) {
      warnings.push(`${etiqueta}: CUIT del proveedor ausente o inválido.`)
    }
    const doc: Documento = cuit.length === 11 ? { codigo: '80', numero: cuit } : { codigo: '99', numero: '0' }

    const pv = fmtEntero(f.punto_venta, 5)
    const nro = fmtEntero(f.numero_comprobante, 20)

    comprasCbte.push(
      fechaAfip(f.fecha_emision) +
        tipo +
        pv +
        nro +
        ''.padEnd(16, ' ') + // despacho de importación
        doc.codigo +
        doc.numero.padStart(20, '0') +
        fmtTexto(f.proveedor_nombre, 30) +
        fmtImporte(total) +
        fmtImporte(noGravado) +
        fmtImporte(exento) +
        fmtImporte(percIva) +
        fmtImporte(percOtrosNac) +
        fmtImporte(percIibb) +
        fmtImporte(percMuni) +
        fmtImporte(internos) +
        'PES' +
        '0001000000' +
        String(lineas.length) +
        (lineas.length === 0 ? 'N' : '0') +
        fmtImporte(iva) + // crédito fiscal computable
        fmtImporte(otros) +
        ''.padStart(11, '0') + // CUIT emisor / corredor
        fmtTexto('', 30) +
        fmtImporte(0) // IVA comisión
    )

    for (const l of lineas) {
      comprasAlic.push(
        tipo + pv + nro + doc.codigo + doc.numero.padStart(20, '0') + fmtImporte(l.neto) + (codigoAlicuota(l.pct) as string) + fmtImporte(l.iva)
      )
    }

    resumen.compras.comprobantes += 1
    resumen.compras.neto += neto
    resumen.compras.iva += iva
    resumen.compras.total += total
  }

  const cierre = (lineas: string[]) => (lineas.length ? lineas.join(EOL) + EOL : '')
  for (const grupo of [resumen.ventas, resumen.compras]) {
    grupo.neto = round2(grupo.neto)
    grupo.iva = round2(grupo.iva)
    grupo.total = round2(grupo.total)
  }

  return {
    ventasCbte: cierre(ventasCbte),
    ventasAlicuotas: cierre(ventasAlic),
    comprasCbte: cierre(comprasCbte),
    comprasAlicuotas: cierre(comprasAlic),
    warnings,
    resumen
  }
}

/** Nombres de archivo estándar del Libro IVA Digital. */
export const NOMBRES_LIBRO_IVA_DIGITAL = {
  ventasCbte: 'LIBRO_IVA_DIGITAL_VENTAS_CBTE.txt',
  ventasAlicuotas: 'LIBRO_IVA_DIGITAL_VENTAS_ALICUOTAS.txt',
  comprasCbte: 'LIBRO_IVA_DIGITAL_COMPRAS_CBTE.txt',
  comprasAlicuotas: 'LIBRO_IVA_DIGITAL_COMPRAS_ALICUOTAS.txt'
} as const

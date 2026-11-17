/**
 * Libro Diario según la normativa argentina (Código Civil y Comercial arts. 320 a 331, RT 9 y 16 FACPCE):
 * - partida doble: en cada asiento el debe es igual al haber;
 * - orden cronológico y numeración correlativa (el N° de orden del Libro Diario se asigna por fecha);
 * - cada asiento con su leyenda y el comprobante que lo respalda;
 * - un asiento contabilizado no se altera ni se borra: se corrige con un contraasiento (art. 329).
 * Todo cálculo es puro: la base sigue siendo la que valida (ver 2026-11-17_asientos_inalterables.sql).
 */

export type CuentaLD = { id?: number; codigo?: string | null; nombre?: string | null; activa?: boolean | null }

export type LineaLD = {
  id?: number
  id_cuenta: number
  debe: number
  haber: number
  concepto?: string | null
  cuenta?: CuentaLD | null
}

export type EstadoAsiento = 'Borrador' | 'Contabilizado' | 'Anulado'

export type AsientoLD = {
  id: number
  numero_asiento: string
  fecha: string
  concepto: string
  tipo_asiento: string
  tipo_origen?: string | null
  id_origen?: number | null
  estado: EstadoAsiento
  total_debe: number
  total_haber: number
  observaciones?: string | null
  detalles?: LineaLD[] | null
}

export type NivelControl = 'error' | 'aviso'
export type Control = { codigo: string; nivel: NivelControl; texto: string }

const n = (v: unknown) => Number(v) || 0
const r2 = (v: number) => Math.round(v * 100) / 100
const TOLERANCIA = 0.009

export function sumasLineas(lineas: LineaLD[]): { debe: number; haber: number } {
  return lineas.reduce((acc, l) => ({ debe: r2(acc.debe + n(l.debe)), haber: r2(acc.haber + n(l.haber)) }), { debe: 0, haber: 0 })
}

/** Número de la secuencia interna (AS-0042 → 42), para ordenar dentro de un mismo día. */
export function numeroInterno(numero: string | null | undefined): number {
  const m = String(numero ?? '').match(/(\d+)\s*$/)
  return m ? Number(m[1]) : 0
}

/** Origen documental del asiento: el comprobante que lo respalda (art. 330 CCyC). */
export function comprobanteRespaldatorio(a: Pick<AsientoLD, 'tipo_origen' | 'id_origen' | 'observaciones' | 'tipo_asiento'>): string | null {
  const t = String(a.tipo_origen ?? '').toLowerCase()
  if (t === 'factura' && a.id_origen) return `Factura #${a.id_origen}`
  if (t === 'pago_cobro' && a.id_origen) return `Cobro/Pago #${a.id_origen}`
  if (t === 'contraasiento' && a.id_origen) return `Contraasiento del asiento #${a.id_origen}`
  if (t && a.id_origen) return `${a.tipo_origen} #${a.id_origen}`
  const obs = String(a.observaciones ?? '').trim()
  return obs ? obs : null
}

/** Controles de un asiento. "error" impide contabilizarlo; "aviso" es para revisar. */
export function controlesAsiento(a: AsientoLD): Control[] {
  const out: Control[] = []
  const lineas = a.detalles ?? []
  const s = sumasLineas(lineas)

  if (!String(a.concepto ?? '').trim()) out.push({ codigo: 'sin-leyenda', nivel: 'error', texto: 'Falta la leyenda (concepto) del asiento.' })
  if (lineas.length < 2) out.push({ codigo: 'pocas-lineas', nivel: 'error', texto: 'Un asiento necesita al menos una cuenta al debe y otra al haber.' })
  if (lineas.length > 0 && !lineas.some((l) => n(l.debe) > 0)) out.push({ codigo: 'sin-debe', nivel: 'error', texto: 'No tiene ninguna cuenta al debe.' })
  if (lineas.length > 0 && !lineas.some((l) => n(l.haber) > 0)) out.push({ codigo: 'sin-haber', nivel: 'error', texto: 'No tiene ninguna cuenta al haber.' })
  if (Math.abs(s.debe - s.haber) > TOLERANCIA) {
    out.push({ codigo: 'desbalance', nivel: 'error', texto: `No cumple la partida doble: debe ${s.debe.toFixed(2)} ≠ haber ${s.haber.toFixed(2)}.` })
  }
  if (lineas.length > 0 && (Math.abs(s.debe - n(a.total_debe)) > TOLERANCIA || Math.abs(s.haber - n(a.total_haber)) > TOLERANCIA)) {
    out.push({ codigo: 'totales', nivel: 'error', texto: 'Los totales de la cabecera no coinciden con la suma de las líneas.' })
  }
  lineas.forEach((l, i) => {
    const d = n(l.debe)
    const h = n(l.haber)
    if (d < 0 || h < 0) out.push({ codigo: `negativo-${i}`, nivel: 'error', texto: `Línea ${i + 1}: importe negativo.` })
    else if (d > 0 && h > 0) out.push({ codigo: `ambos-${i}`, nivel: 'error', texto: `Línea ${i + 1}: tiene importe al debe y al haber a la vez.` })
    else if (d === 0 && h === 0) out.push({ codigo: `cero-${i}`, nivel: 'aviso', texto: `Línea ${i + 1}: sin importe.` })
    if (!l.id_cuenta) out.push({ codigo: `sin-cuenta-${i}`, nivel: 'error', texto: `Línea ${i + 1}: sin cuenta.` })
    else if (l.cuenta && l.cuenta.activa === false) {
      out.push({ codigo: `cuenta-inactiva-${i}`, nivel: 'aviso', texto: `Línea ${i + 1}: la cuenta ${l.cuenta.codigo ?? ''} está dada de baja.` })
    }
  })
  if (!comprobanteRespaldatorio(a)) {
    out.push({ codigo: 'sin-comprobante', nivel: 'aviso', texto: 'No indica el comprobante que lo respalda (cargalo en observaciones).' })
  }
  return out
}

export function puedeContabilizar(a: AsientoLD): boolean {
  return a.estado === 'Borrador' && !controlesAsiento(a).some((c) => c.nivel === 'error')
}

/**
 * N° de orden del Libro Diario: los asientos contabilizados del ejercicio en orden cronológico
 * (fecha y, dentro del día, número interno). Los borradores y anulados no van al libro.
 */
export function numerosDeOrden(asientos: AsientoLD[], inicioEjercicio = '01-01'): Map<number, number> {
  const out = new Map<number, number>()
  const porEjercicio = new Map<string, AsientoLD[]>()
  for (const a of asientos) {
    if (a.estado !== 'Contabilizado') continue
    const k = ejercicioDe(a.fecha, inicioEjercicio)
    const lista = porEjercicio.get(k) ?? []
    lista.push(a)
    porEjercicio.set(k, lista)
  }
  for (const lista of porEjercicio.values()) {
    ordenCronologico(lista).forEach((a, i) => out.set(a.id, i + 1))
  }
  return out
}

/** Ejercicio al que pertenece una fecha ("2026" si arranca el 1/1; "2025/2026" si cierra a mitad de año). */
export function ejercicioDe(fecha: string, inicioEjercicio = '01-01'): string {
  const y = Number(fecha.slice(0, 4))
  if (inicioEjercicio === '01-01') return String(y)
  return fecha.slice(5, 10) >= inicioEjercicio ? `${y}/${y + 1}` : `${y - 1}/${y}`
}

export function ordenCronologico<T extends Pick<AsientoLD, 'fecha' | 'numero_asiento' | 'id'>>(lista: T[]): T[] {
  return [...lista].sort(
    (a, b) =>
      a.fecha.localeCompare(b.fecha) || numeroInterno(a.numero_asiento) - numeroInterno(b.numero_asiento) || a.id - b.id
  )
}

/** Contabilizados cuyo número interno quedó fuera del orden de las fechas (se cargaron después). */
export function asientosFueraDeOrden(asientos: AsientoLD[]): number {
  // Un asiento está "fuera de orden" si se cargó después que otro de fecha posterior:
  // su número interno es mayor que alguno de los que le siguen en el orden cronológico.
  const libro = ordenCronologico(asientos.filter((a) => a.estado === 'Contabilizado'))
  let minimoPosterior = Infinity
  let fuera = 0
  for (let i = libro.length - 1; i >= 0; i--) {
    const num = numeroInterno(libro[i].numero_asiento)
    if (num > minimoPosterior) fuera++
    minimoPosterior = Math.min(minimoPosterior, num)
  }
  return fuera
}

export type ResumenLibro = {
  contabilizados: number
  borradores: number
  anulados: number
  debe: number
  haber: number
  balancea: boolean
  conErrores: number
  sinComprobante: number
  borradoresViejos: number
  fueraDeOrden: number
}

export function resumenLibro(asientos: AsientoLD[], hoy: string): ResumenLibro {
  const contab = asientos.filter((a) => a.estado === 'Contabilizado')
  const debe = r2(contab.reduce((s, a) => s + n(a.total_debe), 0))
  const haber = r2(contab.reduce((s, a) => s + n(a.total_haber), 0))
  const vivos = asientos.filter((a) => a.estado !== 'Anulado')
  return {
    contabilizados: contab.length,
    borradores: asientos.filter((a) => a.estado === 'Borrador').length,
    anulados: asientos.filter((a) => a.estado === 'Anulado').length,
    debe,
    haber,
    balancea: Math.abs(debe - haber) <= TOLERANCIA,
    conErrores: vivos.filter((a) => controlesAsiento(a).some((c) => c.nivel === 'error')).length,
    sinComprobante: vivos.filter((a) => !comprobanteRespaldatorio(a)).length,
    borradoresViejos: asientos.filter((a) => a.estado === 'Borrador' && a.fecha.slice(0, 7) < hoy.slice(0, 7)).length,
    fueraDeOrden: asientosFueraDeOrden(asientos)
  }
}

/** Contraasiento (art. 329 CCyC): mismas cuentas con debe y haber invertidos. */
export function contraasiento(a: AsientoLD, fecha: string, motivo: string) {
  const lineas = (a.detalles ?? []).filter((l) => n(l.debe) > 0 || n(l.haber) > 0)
  return {
    fecha,
    concepto: `Contraasiento de ${a.numero_asiento}: ${motivo.trim()}`,
    tipo_asiento: 'Ajuste' as const,
    tipo_origen: 'contraasiento',
    id_origen: a.id,
    observaciones: `Revierte ${a.numero_asiento} del ${a.fecha.split('-').reverse().join('/')} (${a.concepto})`,
    detalles: lineas.map((l) => ({
      id_cuenta: l.id_cuenta,
      debe: n(l.haber),
      haber: n(l.debe),
      concepto: l.concepto ? `Reversión: ${l.concepto}` : 'Reversión'
    }))
  }
}

/** Líneas en la forma clásica del Diario: primero las cuentas deudoras, después "a" las acreedoras. */
export function lineasFormaDiario(lineas: LineaLD[]): LineaLD[] {
  return [...lineas].sort((a, b) => Number(n(b.debe) > 0) - Number(n(a.debe) > 0))
}

export function nombreCuenta(l: LineaLD): string {
  const c = l.cuenta
  if (!c) return `Cuenta #${l.id_cuenta}`
  return [c.codigo, c.nombre].filter(Boolean).join(' ')
}

export function buscarEnAsiento(a: AsientoLD, q: string): boolean {
  if (!q) return true
  const texto = [
    a.numero_asiento,
    a.concepto,
    a.tipo_asiento,
    a.observaciones,
    comprobanteRespaldatorio(a),
    ...(a.detalles ?? []).flatMap((l) => [l.concepto, l.cuenta?.codigo, l.cuenta?.nombre])
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((t) => texto.includes(t))
}

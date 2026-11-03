/**
 * Lectura y validación del código de barras de comprobantes AFIP (Anexo I, RG 1702/04): 40 dígitos =
 * CUIT emisor (11) + tipo de comprobante (2) + punto de venta (4) + CAI/CAE (14)
 * + vencimiento aaaammdd (8) + dígito verificador módulo 10 (1).
 */

export const TIPOS_COMPROBANTE: Record<string, string> = {
  '01': 'Factura A',
  '02': 'Nota de Débito A',
  '03': 'Nota de Crédito A',
  '04': 'Recibo A',
  '06': 'Factura B',
  '07': 'Nota de Débito B',
  '08': 'Nota de Crédito B',
  '09': 'Recibo B',
  '11': 'Factura C',
  '12': 'Nota de Débito C',
  '13': 'Nota de Crédito C',
  '15': 'Recibo C',
  '51': 'Factura M',
  '52': 'Nota de Débito M',
  '53': 'Nota de Crédito M',
  '54': 'Recibo M'
}

export type DatosCodigo = {
  cuit: string
  tipoCodigo: string
  tipoNombre: string | null
  puntoVenta: string
  /** CAI (preimpreso) o CAE (electrónico). */
  cae: string
  /** yyyy-mm-dd, o null si la fecha del código no existe en el calendario. */
  vencimiento: string | null
  vencimientoRaw: string
}

export type Lectura =
  | { estado: 'valido'; codigo: string; datos: DatosCodigo; avisos: string[] }
  | { estado: 'dv-incorrecto'; codigo: string; datos: DatosCodigo; dvEsperado: number; avisos: string[] }
  | { estado: 'no-afip'; texto: string; motivo: string }

export type LecturaAfip = Exclude<Lectura, { estado: 'no-afip' }>

/** Módulo 10 de la RG 1702: (suma de posiciones impares × 3 + suma de pares) → complemento a 10. */
export function digitoVerificadorAfip(digitos: string): number {
  let impares = 0
  let pares = 0
  for (let i = 0; i < digitos.length; i++) {
    // posición 1 (impar) = índice 0
    if (i % 2 === 0) impares += Number(digitos[i])
    else pares += Number(digitos[i])
  }
  return (10 - ((impares * 3 + pares) % 10)) % 10
}

/** CUIT/CUIL de 11 dígitos con dígito verificador correcto. */
export function cuitValido(cuit: string): boolean {
  if (!/^\d{11}$/.test(cuit)) return false
  const pesos = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]
  const suma = pesos.reduce((acc, p, i) => acc + p * Number(cuit[i]), 0)
  let dv = 11 - (suma % 11)
  if (dv === 11) dv = 0
  if (dv === 10) return false
  return dv === Number(cuit[10])
}

export function formatearCuit(cuit: string): string {
  return `${cuit.slice(0, 2)}-${cuit.slice(2, 10)}-${cuit.slice(10)}`
}

/** yyyy-mm-dd → dd/mm/aaaa */
export function formatearFecha(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function fechaIso(aaaammdd: string): string | null {
  const y = Number(aaaammdd.slice(0, 4))
  const m = Number(aaaammdd.slice(4, 6))
  const d = Number(aaaammdd.slice(6, 8))
  const real = new Date(y, m - 1, d)
  if (real.getFullYear() !== y || real.getMonth() !== m - 1 || real.getDate() !== d) return null
  return `${aaaammdd.slice(0, 4)}-${aaaammdd.slice(4, 6)}-${aaaammdd.slice(6, 8)}`
}

function descomponer(codigo: string): DatosCodigo {
  const tipoCodigo = codigo.slice(11, 13)
  const vencimientoRaw = codigo.slice(31, 39)
  return {
    cuit: codigo.slice(0, 11),
    tipoCodigo,
    tipoNombre: TIPOS_COMPROBANTE[tipoCodigo] ?? null,
    puntoVenta: codigo.slice(13, 17),
    cae: codigo.slice(17, 31),
    vencimiento: fechaIso(vencimientoRaw),
    vencimientoRaw
  }
}

/**
 * Interpreta el texto que devolvió el lector (o que se tipeó). El dígito verificador solo detecta
 * ~90 % de las lecturas erróneas, por eso `avisos` marca datos improbables (CUIT, fecha, tipo, punto
 * de venta) para pedir una segunda lectura antes de darlas por buenas.
 */
export function analizarLectura(entrada: string): Lectura {
  const texto = entrada.replace(/\s/g, '')
  if (!/^\d+$/.test(texto)) {
    return { estado: 'no-afip', texto: entrada.trim(), motivo: 'Tiene caracteres que no son dígitos.' }
  }
  if (texto.length !== 40) {
    return { estado: 'no-afip', texto, motivo: `Tiene ${texto.length} dígitos y el código AFIP tiene 40.` }
  }

  const datos = descomponer(texto)
  const avisos: string[] = []
  if (!cuitValido(datos.cuit)) avisos.push('El CUIT no tiene un dígito verificador válido.')
  if (datos.vencimiento === null) avisos.push('La fecha de vencimiento no existe en el calendario.')
  if (datos.tipoNombre === null) avisos.push(`El código de comprobante ${datos.tipoCodigo} no está en la tabla habitual.`)
  if (Number(datos.puntoVenta) === 0) avisos.push('El punto de venta es 0000.')

  const dvEsperado = digitoVerificadorAfip(texto.slice(0, 39))
  if (dvEsperado !== Number(texto[39])) {
    return { estado: 'dv-incorrecto', codigo: texto, datos, dvEsperado, avisos }
  }
  return { estado: 'valido', codigo: texto, datos, avisos }
}

/** Días hasta el vencimiento (0 = vence hoy, negativo = ya venció). Cuenta por fecha de calendario. */
export function estadoVencimiento(vencimientoIso: string, hoy: Date = new Date()): { vencido: boolean; dias: number } {
  const [y, m, d] = vencimientoIso.split('-').map(Number)
  const dias = Math.round(
    (Date.UTC(y, m - 1, d) - Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())) / 86_400_000
  )
  return { vencido: dias < 0, dias }
}

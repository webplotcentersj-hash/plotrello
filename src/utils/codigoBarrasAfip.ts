import { codigoComprobanteAfip, cuitValido } from './afipFacturaUi'

/**
 * Código de barras de comprobantes AFIP según Anexo I de la RG 1702/04 (40 dígitos, ITF):
 * CUIT emisor (11) + tipo de comprobante (2) + punto de venta (4) + CAI/CAE (14)
 * + vencimiento del CAI/CAE aaaammdd (8) + dígito verificador módulo 10 (1).
 */
export type DatosCodigoBarrasAfip = {
  cuit: string
  /** Texto del tipo ('Factura A') o código AFIP numérico (1, '06', 11…). */
  tipoComprobante: string | number
  puntoVenta: number | string
  /** CAI (comprobante preimpreso) o CAE (factura electrónica): 14 dígitos. */
  cae: string
  /** Vencimiento del CAI/CAE: yyyy-mm-dd, yyyymmdd, dd/mm/yyyy o Date. */
  vencimiento: string | Date
}

export type CodigoBarrasAfipLeido = {
  cuit: string
  tipoComprobante: string
  puntoVenta: number
  cae: string
  /** yyyy-mm-dd */
  vencimiento: string
}

/** Módulo 10 de la RG 1702: (suma de posiciones impares × 3 + suma de pares) → complemento a 10. */
export function digitoVerificadorAfip(digitos: string): number {
  if (!/^\d+$/.test(digitos)) throw new Error('El dígito verificador se calcula solo sobre dígitos.')
  let impares = 0
  let pares = 0
  for (let i = 0; i < digitos.length; i++) {
    // posición 1 (impar) = índice 0
    if (i % 2 === 0) impares += Number(digitos[i])
    else pares += Number(digitos[i])
  }
  return (10 - ((impares * 3 + pares) % 10)) % 10
}

function codigoTipoComprobante(tipo: string | number): string {
  const raw = String(tipo).trim()
  if (/^\d{1,2}$/.test(raw)) return raw.padStart(2, '0')
  const codigo = codigoComprobanteAfip(raw)
  if (codigo === '—') throw new Error(`Tipo de comprobante no reconocido: "${raw}".`)
  return codigo
}

function fechaAaaammdd(valor: string | Date): string {
  let y: number
  let m: number
  let d: number
  if (valor instanceof Date) {
    y = valor.getFullYear()
    m = valor.getMonth() + 1
    d = valor.getDate()
  } else {
    const s = valor.trim()
    const ymd = /^(\d{4})-(\d{2})-(\d{2})/.exec(s) ?? /^(\d{4})(\d{2})(\d{2})$/.exec(s)
    const dmy = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s)
    if (ymd) [y, m, d] = [Number(ymd[1]), Number(ymd[2]), Number(ymd[3])]
    else if (dmy) [y, m, d] = [Number(dmy[3]), Number(dmy[2]), Number(dmy[1])]
    else throw new Error(`Fecha de vencimiento ilegible: "${valor}".`)
  }
  const real = new Date(y, m - 1, d)
  if (real.getFullYear() !== y || real.getMonth() !== m - 1 || real.getDate() !== d) {
    throw new Error('La fecha de vencimiento no existe en el calendario.')
  }
  return `${String(y).padStart(4, '0')}${String(m).padStart(2, '0')}${String(d).padStart(2, '0')}`
}

/** Arma los 40 dígitos del código de barras. Lanza Error con mensaje en castellano si un dato no es válido. */
export function armarCodigoBarrasAfip(datos: DatosCodigoBarrasAfip): string {
  const cuit = String(datos.cuit || '').replace(/\D/g, '')
  if (!cuitValido(cuit)) throw new Error('CUIT inválido: deben ser 11 dígitos con dígito verificador correcto.')

  const tipo = codigoTipoComprobante(datos.tipoComprobante)

  const pv = Number(String(datos.puntoVenta).trim())
  if (!Number.isInteger(pv) || pv < 1 || pv > 9999) {
    throw new Error('Punto de venta inválido: la RG 1702 admite de 1 a 9999 (4 dígitos).')
  }

  const cae = String(datos.cae || '').replace(/\s/g, '')
  if (!/^\d{14}$/.test(cae)) throw new Error('El CAI/CAE debe tener exactamente 14 dígitos.')

  const base = `${cuit}${tipo}${String(pv).padStart(4, '0')}${cae}${fechaAaaammdd(datos.vencimiento)}`
  return `${base}${digitoVerificadorAfip(base)}`
}

/** true si son 40 dígitos y el dígito verificador coincide. */
export function validarCodigoBarrasAfip(codigo: string): boolean {
  if (!/^\d{40}$/.test(codigo)) return false
  return digitoVerificadorAfip(codigo.slice(0, 39)) === Number(codigo[39])
}

/** Descompone un código de barras válido en sus campos; null si no pasa la validación. */
export function leerCodigoBarrasAfip(codigo: string): CodigoBarrasAfipLeido | null {
  if (!validarCodigoBarrasAfip(codigo)) return null
  const v = codigo.slice(31, 39)
  return {
    cuit: codigo.slice(0, 11),
    tipoComprobante: codigo.slice(11, 13),
    puntoVenta: Number(codigo.slice(13, 17)),
    cae: codigo.slice(17, 31),
    vencimiento: `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}`
  }
}

// Patrones ITF por dígito: 'n' = angosto, 'w' = ancho (5 elementos, 2 anchos).
const ITF_PATRONES = ['nnwwn', 'wnnnw', 'nwnnw', 'wwnnn', 'nnwnw', 'wnwnn', 'nwwnn', 'nnnww', 'wnnwn', 'nwnwn']

/**
 * Interleaved 2 of 5: anchos en módulos de cada barra/espacio, alternando barra, espacio, barra…
 * (índice par = barra). Incluye inicio (nnnn) y fin (wnn); no incluye zona de silencio (8 módulos por lado).
 * La RG 1702 pide módulo nominal mínimo de 0,191 mm. `ancho` es la relación ancho/angosto (2 a 3).
 */
export function codigoBarrasItf(digitos: string, ancho = 3): number[] {
  if (!/^\d+$/.test(digitos) || digitos.length % 2 !== 0) {
    throw new Error('ITF requiere una cantidad par de dígitos.')
  }
  const medida = (c: string) => (c === 'w' ? ancho : 1)
  const anchos = [1, 1, 1, 1]
  for (let i = 0; i < digitos.length; i += 2) {
    const barras = ITF_PATRONES[Number(digitos[i])]
    const espacios = ITF_PATRONES[Number(digitos[i + 1])]
    for (let j = 0; j < 5; j++) anchos.push(medida(barras[j]), medida(espacios[j]))
  }
  anchos.push(ancho, 1, 1)
  return anchos
}

/**
 * SVG del código ITF listo para mostrar, descargar o imprimir, con la zona de silencio de
 * 8 módulos por lado. `moduloMm` es el ancho del módulo angosto: la norma pide mínimo 0,191 mm.
 * Con `conTexto` imprime el número legible debajo de las barras, como exige la RG 1702.
 */
export function codigoBarrasItfSvg(
  digitos: string,
  opciones: { moduloMm?: number; altoMm?: number; ancho?: number; conTexto?: boolean } = {}
): string {
  const { moduloMm = 0.33, altoMm = 13, ancho = 3, conTexto = false } = opciones
  const silencio = 8
  const textoMm = conTexto ? 3.6 : 0
  const anchos = codigoBarrasItf(digitos, ancho)
  const total = anchos.reduce((a, b) => a + b, 0) + silencio * 2
  const alto = +(altoMm / moduloMm).toFixed(3)
  const altoTotal = +((altoMm + textoMm) / moduloMm).toFixed(3)
  let x = silencio
  let barras = ''
  anchos.forEach((a, i) => {
    if (i % 2 === 0) barras += `<rect x="${x}" y="0" width="${a}" height="${alto}"/>`
    x += a
  })
  const w = +(total * moduloMm).toFixed(3)
  const texto = conTexto
    ? `<text x="${total / 2}" y="${+(alto + (textoMm * 0.78) / moduloMm).toFixed(3)}" ` +
      `font-family="'Courier New',monospace" font-size="${+((textoMm * 0.8) / moduloMm).toFixed(3)}" ` +
      `text-anchor="middle" fill="#000">${digitos}</text>`
    : ''
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}mm" height="${altoMm + textoMm}mm" ` +
    `viewBox="0 0 ${total} ${altoTotal}" shape-rendering="crispEdges">` +
    `<rect width="${total}" height="${altoTotal}" fill="#fff"/>` +
    `<g fill="#000">${barras}</g>${texto}</svg>`
  )
}

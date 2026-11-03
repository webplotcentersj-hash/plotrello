import { BinaryBitmap, DecodeHintType, HybridBinarizer, ITFReader, RGBLuminanceSource } from '@zxing/library'

const LARGO_CODIGO = 40

// El código AFIP es siempre ITF de 40 dígitos. ZXing solo descarta los largos menores al permitido,
// por eso además se verifica el largo exacto después de leer.
const PISTAS = new Map<DecodeHintType, unknown>([
  [DecodeHintType.TRY_HARDER, true],
  [DecodeHintType.ALLOWED_LENGTHS, [LARGO_CODIGO]]
])

function leer(luminancia: Uint8ClampedArray, ancho: number, alto: number): string | null {
  try {
    const mapa = new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(luminancia, ancho, alto)))
    const texto = new ITFReader().decode(mapa, PISTAS).getText()
    return texto.length === LARGO_CODIGO ? texto : null
  } catch {
    return null
  }
}

// RGBLuminanceSource no sabe rotar: se traspone la imagen para leer códigos verticales. El espejo
// no importa porque ITF se lee igual en ambos sentidos.
function transponer(luminancia: Uint8ClampedArray, ancho: number, alto: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(luminancia.length)
  for (let y = 0; y < alto; y++) for (let x = 0; x < ancho; x++) out[x * alto + y] = luminancia[y * ancho + x]
  return out
}

/** Imagen en escala de grises (1 byte por píxel). Devuelve los 40 dígitos o null si no hay código. */
export function decodificarLuminancia(luminancia: Uint8ClampedArray, ancho: number, alto: number): string | null {
  return leer(luminancia, ancho, alto) ?? leer(transponer(luminancia, ancho, alto), alto, ancho)
}

/** Píxeles RGBA (ImageData de un canvas) → escala de grises → decodifica. */
export function decodificarRgba(rgba: Uint8ClampedArray, ancho: number, alto: number): string | null {
  const gris = new Uint8ClampedArray(ancho * alto)
  for (let i = 0, j = 0; i < gris.length; i++, j += 4) {
    gris[i] = (rgba[j] * 306 + rgba[j + 1] * 601 + rgba[j + 2] * 117) >> 10
  }
  return decodificarLuminancia(gris, ancho, alto)
}

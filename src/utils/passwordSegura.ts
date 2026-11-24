/**
 * Contraseñas para entregar a un humano (portal clientes, etc.).
 * Usa crypto.getRandomValues; evita caracteres ambiguos (0/O, 1/l/I).
 */

const LOWER = 'abcdefghijkmnopqrstuvwxyz'
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
const DIGITS = '23456789'
const SYMBOLS = '!@#$%&*-_+'
const ALL = LOWER + UPPER + DIGITS + SYMBOLS

function randomIndex(max: number): number {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const buf = new Uint32Array(1)
    crypto.getRandomValues(buf)
    return buf[0]! % max
  }
  return Math.floor(Math.random() * max)
}

function pick(alphabet: string): string {
  return alphabet[randomIndex(alphabet.length)]!
}

function shuffle(chars: string[]): string[] {
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1)
    const tmp = chars[i]!
    chars[i] = chars[j]!
    chars[j] = tmp
  }
  return chars
}

/** Contraseña fuerte (≥12): mayúscula, minúscula, dígito y símbolo. */
export function generarPasswordSegura(length = 14): string {
  const len = Math.max(12, Math.min(64, Math.floor(length)))
  const chars: string[] = [pick(LOWER), pick(UPPER), pick(DIGITS), pick(SYMBOLS)]
  while (chars.length < len) chars.push(pick(ALL))
  return shuffle(chars).join('')
}

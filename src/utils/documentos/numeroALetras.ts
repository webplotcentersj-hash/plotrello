const UNIDADES = [
  'cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'once', 'doce',
  'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve', 'veinte', 'veintiuno',
  'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve'
]
const DECENAS = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa']
const CENTENAS = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos']

/** 1..999. Con `apocopar`, "uno" pasa a "un" ("veintiún mil", "treinta y un millones"). */
function hasta999(n: number, apocopar: boolean): string {
  if (n === 100) return 'cien'
  const c = Math.floor(n / 100)
  const r = n % 100
  const partes: string[] = []
  if (c > 0) partes.push(CENTENAS[c])
  if (r > 0) {
    if (r < 30) partes.push(UNIDADES[r])
    else partes.push(DECENAS[Math.floor(r / 10)] + (r % 10 ? ` y ${UNIDADES[r % 10]}` : ''))
  }
  const texto = partes.join(' ')
  if (!apocopar) return texto
  return texto.replace(/veintiuno$/, 'veintiún').replace(/uno$/, 'un')
}

function entero(n: number, apocopar: boolean): string {
  if (n === 0) return 'cero'
  const millones = Math.floor(n / 1_000_000)
  const miles = Math.floor((n % 1_000_000) / 1000)
  const resto = n % 1000
  const partes: string[] = []
  if (millones > 0) partes.push(millones === 1 ? 'un millón' : `${entero(millones, true)} millones`)
  if (miles > 0) partes.push(miles === 1 ? 'mil' : `${hasta999(miles, true)} mil`)
  if (resto > 0) partes.push(hasta999(resto, apocopar))
  return partes.join(' ')
}

/** "diez mil quinientos con 50/100", para el importe de un recibo. Hasta 999.999.999.999. */
export function montoEnLetras(monto: number): string {
  const centavosTotales = Math.round(Math.abs(Number(monto) || 0) * 100)
  const pesos = Math.floor(centavosTotales / 100)
  const centavos = centavosTotales % 100
  return `${entero(pesos, false)} con ${String(centavos).padStart(2, '0')}/100`
}

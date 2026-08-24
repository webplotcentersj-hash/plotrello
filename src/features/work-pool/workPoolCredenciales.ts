const PLOT_PHI_DOMAIN = 'plotphi.com.ar'

const PASS_ALPHABET = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'

/** nombre + apellido → nombreapellido@plotphi.com.ar */
export function loginPlotPhiFromNombre(nombreCompleto: string): string {
  const parts = nombreCompleto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  const first = parts[0] ?? 'usuario'
  const last = parts.length > 1 ? parts[parts.length - 1] : ''
  const local = `${first}${last}`.replace(/[^a-z0-9]/g, '').slice(0, 48) || 'usuario'
  return `${local}@${PLOT_PHI_DOMAIN}`
}

/** Parte local comparable: ale@plotphi… y “ale” → “ale”. */
export function loginPlotPhiIdentidad(login: string): string {
  const raw = login.trim().toLowerCase()
  const local = raw.includes('@') ? raw.split('@')[0]! : raw
  return local.replace(/[^a-z0-9]/g, '')
}

function randomChars(len: number): string {
  const out: string[] = []
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const buf = new Uint32Array(len)
    crypto.getRandomValues(buf)
    for (let i = 0; i < len; i++) {
      out.push(PASS_ALPHABET[buf[i]! % PASS_ALPHABET.length]!)
    }
    return out.join('')
  }
  for (let i = 0; i < len; i++) {
    out.push(PASS_ALPHABET[Math.floor(Math.random() * PASS_ALPHABET.length)]!)
  }
  return out.join('')
}

/** Contraseña fuerte y distinta cada vez (no reutiliza el patrón corto PlotPhi####x). */
export function generarPasswordPlotPhi(): string {
  return `Pp${randomChars(10)}`
}

export { PLOT_PHI_DOMAIN }

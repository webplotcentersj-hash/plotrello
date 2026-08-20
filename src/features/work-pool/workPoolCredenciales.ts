const PLOT_PHI_DOMAIN = 'plotphi.com.ar'

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

export function generarPasswordPlotPhi(): string {
  const n = Math.floor(1000 + Math.random() * 9000)
  const letter = String.fromCharCode(97 + Math.floor(Math.random() * 26))
  return `PlotPhi${n}${letter}`
}

export { PLOT_PHI_DOMAIN }

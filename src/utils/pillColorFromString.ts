/** Paleta fija para pastillas (materiales / tipos m²) alineada visualmente con etiquetas. */
const PALETTE = [
  '#2563eb',
  '#7c3aed',
  '#db2777',
  '#059669',
  '#d97706',
  '#0891b2',
  '#4f46e5',
  '#b45309',
  '#0d9488',
  '#be185d',
  '#4338ca',
  '#ca8a04'
]

/** Color estable por texto (misma entrada → mismo color). */
export function pillColorFromString(value: string): string {
  const s = String(value ?? '').trim()
  if (!s) return '#6B7280'
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0
  }
  return PALETTE[Math.abs(h) % PALETTE.length]
}

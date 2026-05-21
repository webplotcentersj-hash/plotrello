export type CcScoreNivel = 'excelente' | 'bueno' | 'regular' | 'riesgo' | 'critico'

export const CC_SCORE_NIVEL_LABELS: Record<CcScoreNivel, string> = {
  excelente: 'Excelente',
  bueno: 'Bueno',
  regular: 'Regular',
  riesgo: 'Riesgo',
  critico: 'Crítico'
}

export const CC_SCORE_NIVEL_COLORS: Record<CcScoreNivel, { bg: string; text: string; ring: string }> = {
  excelente: { bg: 'rgba(16, 185, 129, 0.2)', text: '#6ee7b7', ring: '#34d399' },
  bueno: { bg: 'rgba(59, 130, 246, 0.2)', text: '#93c5fd', ring: '#60a5fa' },
  regular: { bg: 'rgba(245, 158, 11, 0.18)', text: '#fde68a', ring: '#fbbf24' },
  riesgo: { bg: 'rgba(249, 115, 22, 0.2)', text: '#fdba74', ring: '#fb923c' },
  critico: { bg: 'rgba(239, 68, 68, 0.2)', text: '#fca5a5', ring: '#f87171' }
}

export function nivelDesdeScore(score: number | null | undefined): CcScoreNivel {
  const s = score ?? 0
  if (s >= 80) return 'excelente'
  if (s >= 65) return 'bueno'
  if (s >= 50) return 'regular'
  if (s >= 35) return 'riesgo'
  return 'critico'
}

export function formatLimiteCredito(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—'
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0
  }).format(value)
}

/** Mostrador: alerta visible en venta CC si score bajo */
export function requiereAlertaScoring(nivel: CcScoreNivel | null | undefined): boolean {
  return nivel === 'riesgo' || nivel === 'critico'
}

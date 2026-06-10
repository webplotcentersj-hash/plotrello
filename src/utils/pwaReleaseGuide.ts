import type { PwaReleaseNotes } from '../data/pwaReleaseNotes'

export function buildReleaseGuideText(release: PwaReleaseNotes): string {
  const lines: string[] = [
    '═══════════════════════════════════════',
    `  GUÍA DE USO — PLOT (${release.label})`,
    '═══════════════════════════════════════',
    '',
    release.summary,
    '',
    '── QUÉ MEJORAMOS ──',
    ''
  ]

  for (const item of release.improvements) {
    lines.push(`${item.icon} ${item.title}`)
    lines.push(`   ${item.description}`)
    lines.push('')
  }

  const steps = release.guideSteps ?? []
  if (steps.length > 0) {
    lines.push('── CÓMO USARLO (PASO A PASO) ──', '')
    steps.forEach((step, index) => {
      lines.push(`${index + 1}. ${step.title}`)
      lines.push(`   ${step.description}`)
      lines.push('')
    })
  }

  lines.push(
    '── AYUDA ──',
    '',
    'Si algo no funciona, avisá a RRHH o al área de sistemas.',
    `Versión: ${release.id} · ${release.label}`,
    `Generado: ${new Date().toLocaleString('es-AR')}`,
    ''
  )

  return lines.join('\n')
}

export function downloadReleaseGuide(release: PwaReleaseNotes): void {
  const text = buildReleaseGuideText(release)
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `PLOT-guia-${release.id}.txt`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

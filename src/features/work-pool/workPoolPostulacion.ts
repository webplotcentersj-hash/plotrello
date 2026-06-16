export type PostulacionRubro = 'diseno' | 'instalaciones' | 'metalurgica'
export type PostulacionNivel =
  | 'estudiante'
  | 'junior'
  | 'semi_senior'
  | 'titulado'
  | 'experto'

export const MAX_POSTULACION_MB = 8

export const POSTULACION_DOC_EXT = ['pdf', 'doc', 'docx'] as const
export const POSTULACION_IMAGE_EXT = ['pdf', 'jpg', 'jpeg', 'png', 'webp'] as const
export const POSTULACION_PORTFOLIO_EXT = ['pdf', 'zip', 'jpg', 'jpeg', 'png', 'webp'] as const

export const POSTULACION_RUBROS: Array<{
  id: PostulacionRubro
  label: string
  desc: string
}> = [
  { id: 'diseno', label: 'Diseñador/a gráfico', desc: 'Plot Design — artes, adaptaciones y piezas' },
  { id: 'instalaciones', label: 'Instalador/a', desc: 'Bolsa Plot — montaje y cartelería en campo' },
  { id: 'metalurgica', label: 'Metalúrgico/a', desc: 'Bolsa Plot — estructuras, herrería y soldadura' }
]

export const POSTULACION_NIVELES: Array<{ id: PostulacionNivel; label: string; hint: string }> = [
  {
    id: 'estudiante',
    label: 'Estudiante',
    hint: 'Cursando la carrera o formación en el rubro'
  },
  {
    id: 'junior',
    label: 'Junior',
    hint: '0 a 2 años de experiencia en el rubro'
  },
  {
    id: 'semi_senior',
    label: 'Semi-senior',
    hint: '2 a 5 años de experiencia comprobable'
  },
  {
    id: 'titulado',
    label: 'Titulado / recibido',
    hint: 'Con título, certificación o recibo de materias'
  },
  {
    id: 'experto',
    label: 'Experto / senior',
    hint: 'Más de 5 años y referencias sólidas'
  }
]

export const POSTULACION_WIZARD_STEPS = [
  { id: 'rubro', label: 'Rubro y nivel' },
  { id: 'datos', label: 'Datos personales' },
  { id: 'formacion', label: 'Experiencia' },
  { id: 'documentos', label: 'Documentación' },
  { id: 'resumen', label: 'Resumen' }
] as const

export type PostulacionWizardStep = (typeof POSTULACION_WIZARD_STEPS)[number]['id']

export function rubroToTipo(rubro: PostulacionRubro): 'diseno' | 'bolsa' {
  return rubro === 'diseno' ? 'diseno' : 'bolsa'
}

export function rubroLabel(rubro: PostulacionRubro | string): string {
  return POSTULACION_RUBROS.find((r) => r.id === rubro)?.label ?? String(rubro)
}

export function nivelLabel(nivel: PostulacionNivel | string): string {
  return POSTULACION_NIVELES.find((n) => n.id === nivel)?.label ?? String(nivel)
}

export function requiereLibretaDiseno(rubro: PostulacionRubro, nivel: PostulacionNivel): boolean {
  return rubro === 'diseno' && nivel === 'estudiante'
}

export function requiereTituloCertificado(nivel: PostulacionNivel): boolean {
  return nivel === 'semi_senior' || nivel === 'titulado' || nivel === 'experto'
}

export function tituloCertificadoOpcional(nivel: PostulacionNivel): boolean {
  return nivel === 'junior'
}

export function requiereTituloUniversitarioDiseno(
  rubro: PostulacionRubro,
  nivel: PostulacionNivel
): boolean {
  return (
    rubro === 'diseno' &&
    (nivel === 'semi_senior' || nivel === 'titulado' || nivel === 'experto')
  )
}

export function requiereReferenciasObligatorias(
  rubro: PostulacionRubro,
  nivel: PostulacionNivel
): boolean {
  if (nivel === 'experto' || nivel === 'titulado') return true
  if (nivel === 'semi_senior' && rubro !== 'diseno') return true
  return false
}

export function referenciasRecomendadas(rubro: PostulacionRubro, nivel: PostulacionNivel): boolean {
  return !requiereReferenciasObligatorias(rubro, nivel) && nivel !== 'estudiante'
}

export function fileExtension(name: string): string {
  return name.split('.').pop()?.toLowerCase() ?? ''
}

/** Acepta URL con o sin https:// (evita bloqueo del input type=url del navegador). */
export function isValidPortfolioUrl(raw: string): boolean {
  const t = raw.trim()
  if (!t) return true
  try {
    const href = /^https?:\/\//i.test(t) ? t : `https://${t}`
    const u = new URL(href)
    return Boolean(u.hostname && u.hostname.includes('.'))
  } catch {
    return false
  }
}

export function normalizePortfolioUrl(raw: string): string {
  const t = raw.trim()
  if (!t) return ''
  return /^https?:\/\//i.test(t) ? t : `https://${t}`
}

export function validatePostulacionFile(
  file: File | null,
  allowedExt: readonly string[],
  label: string,
  required = true
): string | null {
  if (!file) return required ? `Adjuntá ${label}.` : null
  if (file.size > MAX_POSTULACION_MB * 1024 * 1024) {
    return `${label}: el archivo supera ${MAX_POSTULACION_MB} MB.`
  }
  const ext = fileExtension(file.name)
  if (!ext || !allowedExt.includes(ext)) {
    return `${label}: formato no permitido (${allowedExt.join(', ')}).`
  }
  return null
}

export type PostulacionFormInput = {
  rubro: PostulacionRubro
  nivel: PostulacionNivel
  nombre_completo: string
  email: string
  telefono?: string
  documento?: string
  titulo_texto?: string
  experiencia: string
  referencias?: string
  portfolio_url?: string
  zona_cobertura?: string
  skills?: string[]
  mensaje?: string
  cvFile: File | null
  tituloFile: File | null
  tituloUniversitarioFile: File | null
  libretaFile: File | null
  portfolioFile: File | null
}

export function validatePostulacionForm(input: PostulacionFormInput): string[] {
  const errors: string[] = []

  if (!input.nombre_completo.trim()) errors.push('El nombre completo es obligatorio.')
  if (!input.email.trim()) errors.push('El email es obligatorio.')
  if (!input.telefono?.trim()) errors.push('El teléfono es obligatorio.')
  if (!input.documento?.trim()) errors.push('El documento (DNI) es obligatorio.')
  if (!input.experiencia.trim()) errors.push('Contá tu experiencia en el rubro.')

  if (requiereReferenciasObligatorias(input.rubro, input.nivel) && !input.referencias?.trim()) {
    errors.push('Las referencias son obligatorias para tu nivel y rubro.')
  }

  const cvErr = validatePostulacionFile(input.cvFile, POSTULACION_DOC_EXT, 'tu CV', true)
  if (cvErr) errors.push(cvErr)

  if (requiereTituloCertificado(input.nivel)) {
    const tituloErr = validatePostulacionFile(
      input.tituloFile,
      POSTULACION_DOC_EXT,
      'el título o certificación',
      true
    )
    if (tituloErr) errors.push(tituloErr)
  } else if (input.tituloFile) {
    const tituloErr = validatePostulacionFile(
      input.tituloFile,
      POSTULACION_DOC_EXT,
      'el título o certificación',
      false
    )
    if (tituloErr) errors.push(tituloErr)
  }

  if (requiereLibretaDiseno(input.rubro, input.nivel)) {
    const libretaErr = validatePostulacionFile(
      input.libretaFile,
      POSTULACION_IMAGE_EXT,
      'la libreta universitaria o analítico parcial',
      true
    )
    if (libretaErr) errors.push(libretaErr)
  }

  if (requiereTituloUniversitarioDiseno(input.rubro, input.nivel)) {
    const tituloUniErr = validatePostulacionFile(
      input.tituloUniversitarioFile,
      POSTULACION_DOC_EXT,
      'el título universitario o analítico',
      true
    )
    if (tituloUniErr) errors.push(tituloUniErr)
  }

  if (input.rubro === 'diseno') {
    const hasPortfolio = Boolean(input.portfolio_url?.trim()) || Boolean(input.portfolioFile)
    if (!hasPortfolio) errors.push('Subí tu portafolio (archivo) o indicá una URL.')
    if (input.portfolio_url?.trim() && !isValidPortfolioUrl(input.portfolio_url)) {
      errors.push('La URL del portafolio no es válida. Ej: https://behance.net/tu-usuario')
    }
    if (input.portfolioFile) {
      const portfolioErr = validatePostulacionFile(
        input.portfolioFile,
        POSTULACION_PORTFOLIO_EXT,
        'el portafolio',
        false
      )
      if (portfolioErr) errors.push(portfolioErr)
    }
  }

  return errors
}

export function validatePostulacionWizardStep(
  step: PostulacionWizardStep,
  input: PostulacionFormInput
): string | null {
  switch (step) {
    case 'rubro':
      return input.rubro && input.nivel ? null : 'Elegí rubro y nivel.'
    case 'datos': {
      if (!input.nombre_completo.trim()) return 'El nombre completo es obligatorio.'
      if (!input.email.trim()) return 'El email es obligatorio.'
      if (input.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) {
        return 'Ingresá un email válido.'
      }
      if (!input.telefono?.trim()) return 'El teléfono es obligatorio.'
      if (!input.documento?.trim()) return 'El documento (DNI) es obligatorio.'
      return null
    }
    case 'formacion': {
      if (!input.experiencia.trim()) return 'Contá tu experiencia en el rubro.'
      if (requiereReferenciasObligatorias(input.rubro, input.nivel) && !input.referencias?.trim()) {
        return 'Las referencias son obligatorias para tu nivel.'
      }
      return null
    }
    case 'documentos': {
      const errors = validatePostulacionForm(input)
      const docErrors = errors.filter(
        (e) =>
          e.includes('CV') ||
          e.includes('título') ||
          e.includes('libreta') ||
          e.includes('portafolio') ||
          e.includes('certificación')
      )
      return docErrors[0] ?? null
    }
    case 'resumen':
      return validatePostulacionForm(input)[0] ?? null
    default:
      return null
  }
}

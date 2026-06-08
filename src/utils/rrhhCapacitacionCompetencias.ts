import type { Capacitacion, UserRole } from '../types/api'

/** Competencias organizacionales vinculables a formación y perfiles de puesto. */
export const COMPETENCIAS_RRHH: { id: string; label: string }[] = [
  { id: 'seguridad_higiene', label: 'Seguridad e higiene' },
  { id: 'calidad', label: 'Calidad y normas' },
  { id: 'operativa_produccion', label: 'Operativa de producción' },
  { id: 'atencion_cliente', label: 'Atención al cliente' },
  { id: 'liderazgo', label: 'Liderazgo y coordinación' },
  { id: 'tecnologia', label: 'Tecnología y sistemas' },
  { id: 'comercial', label: 'Gestión comercial' },
  { id: 'compras_logistica', label: 'Compras y logística' },
  { id: 'diseno_creativo', label: 'Diseño y creatividad' },
  { id: 'instalaciones', label: 'Instalaciones y montaje' },
  { id: 'metalurgica', label: 'Procesos metalúrgicos' },
  { id: 'rrhh_normativa', label: 'Normativa laboral y RRHH' }
]

const COMPETENCIA_LABEL = new Map(COMPETENCIAS_RRHH.map((c) => [c.id, c.label]))

/** Perfiles de puesto → competencias esperadas en el plan de formación. */
export const PERFIL_PUESTO_COMPETENCIAS: Record<string, { label: string; competencias: string[] }> = {
  'taller-grafico': {
    label: 'Taller Gráfico',
    competencias: ['operativa_produccion', 'calidad', 'seguridad_higiene', 'tecnologia']
  },
  'instalaciones': {
    label: 'Instalaciones',
    competencias: ['instalaciones', 'seguridad_higiene', 'atencion_cliente', 'operativa_produccion']
  },
  imprenta: {
    label: 'Imprenta',
    competencias: ['operativa_produccion', 'calidad', 'seguridad_higiene']
  },
  metalurgica: {
    label: 'Metalúrgica',
    competencias: ['metalurgica', 'seguridad_higiene', 'calidad', 'operativa_produccion']
  },
  diseno: {
    label: 'Diseño',
    competencias: ['diseno_creativo', 'atencion_cliente', 'tecnologia', 'calidad']
  },
  mostrador: {
    label: 'Mostrador',
    competencias: ['atencion_cliente', 'comercial', 'tecnologia']
  },
  compras: {
    label: 'Compras',
    competencias: ['compras_logistica', 'comercial', 'tecnologia']
  },
  caja: {
    label: 'Caja',
    competencias: ['atencion_cliente', 'comercial', 'tecnologia']
  },
  presupuestos: {
    label: 'Presupuestos',
    competencias: ['comercial', 'atencion_cliente', 'diseno_creativo']
  },
  'asesor-tecnico': {
    label: 'Asesor técnico',
    competencias: ['atencion_cliente', 'comercial', 'operativa_produccion', 'tecnologia']
  },
  'recursos-humanos': {
    label: 'Recursos Humanos',
    competencias: ['rrhh_normativa', 'liderazgo', 'atencion_cliente']
  },
  gerencia: {
    label: 'Gerencia',
    competencias: ['liderazgo', 'comercial', 'calidad', 'rrhh_normativa']
  }
}

const SECTOR_A_PERFIL: Record<string, string> = {
  'taller gráfico': 'taller-grafico',
  'taller grafico': 'taller-grafico',
  instalaciones: 'instalaciones',
  imprenta: 'imprenta',
  'taller de imprenta': 'imprenta',
  metalúrgica: 'metalurgica',
  metalurgica: 'metalurgica',
  'diseño gráfico': 'diseno',
  'diseno grafico': 'diseno',
  diseño: 'diseno',
  mostrador: 'mostrador',
  compras: 'compras',
  caja: 'caja',
  presupuestos: 'presupuestos',
  'asesor técnico': 'asesor-tecnico',
  'recursos humanos': 'recursos-humanos'
}

const CATEGORIA_A_COMPETENCIAS: Record<string, string[]> = {
  seguridad: ['seguridad_higiene'],
  'seguridad e higiene': ['seguridad_higiene'],
  calidad: ['calidad'],
  operativa: ['operativa_produccion'],
  producción: ['operativa_produccion'],
  produccion: ['operativa_produccion'],
  liderazgo: ['liderazgo'],
  tecnología: ['tecnologia'],
  tecnologia: ['tecnologia'],
  comercial: ['comercial'],
  ventas: ['comercial'],
  compras: ['compras_logistica'],
  logística: ['compras_logistica'],
  diseño: ['diseno_creativo'],
  diseno: ['diseno_creativo'],
  instalaciones: ['instalaciones'],
  metalúrgica: ['metalurgica'],
  metalurgica: ['metalurgica'],
  rrhh: ['rrhh_normativa'],
  normativa: ['rrhh_normativa', 'calidad'],
  atención: ['atencion_cliente'],
  atencion: ['atencion_cliente']
}

const KEYWORDS_TITULO: { pattern: RegExp; competencias: string[] }[] = [
  { pattern: /seguridad|higiene|epp|primeros auxilios/i, competencias: ['seguridad_higiene'] },
  { pattern: /calidad|iso|auditor/i, competencias: ['calidad'] },
  { pattern: /liderazgo|coordinaci[oó]n|equipo/i, competencias: ['liderazgo'] },
  { pattern: /cliente|venta|comercial|mostrador/i, competencias: ['atencion_cliente', 'comercial'] },
  { pattern: /diseño|diseño|creativ|adobe|illustrator/i, competencias: ['diseno_creativo'] },
  { pattern: /instalaci[oó]n|montaje|obra/i, competencias: ['instalaciones'] },
  { pattern: /metal|soldad|torno/i, competencias: ['metalurgica'] },
  { pattern: /compra|proveedor|logística/i, competencias: ['compras_logistica'] },
  { pattern: /sistema|software|plot|digital/i, competencias: ['tecnologia'] },
  { pattern: /laboral|ley|rrhh|recursos humanos/i, competencias: ['rrhh_normativa'] }
]

export function etiquetaCompetencia(id: string): string {
  return COMPETENCIA_LABEL.get(id) ?? id
}

export function resolverPerfilPuesto(sectorLegajo?: string | null, rol?: UserRole | string | null): {
  clave: string
  label: string
  competenciasEsperadas: string[]
} | null {
  if (rol && PERFIL_PUESTO_COMPETENCIAS[rol]) {
    const p = PERFIL_PUESTO_COMPETENCIAS[rol]
    return { clave: rol, label: p.label, competenciasEsperadas: p.competencias }
  }
  const sector = sectorLegajo?.trim().toLowerCase()
  if (sector) {
    const clave = SECTOR_A_PERFIL[sector]
    if (clave && PERFIL_PUESTO_COMPETENCIAS[clave]) {
      const p = PERFIL_PUESTO_COMPETENCIAS[clave]
      return { clave, label: p.label, competenciasEsperadas: p.competencias }
    }
  }
  return null
}

export function competenciasDeCapacitacion(c: Capacitacion): string[] {
  const found = new Set<string>()
  const cat = c.categoria?.trim().toLowerCase()
  if (cat) {
    const direct = CATEGORIA_A_COMPETENCIAS[cat]
    if (direct) direct.forEach((id) => found.add(id))
    for (const [key, ids] of Object.entries(CATEGORIA_A_COMPETENCIAS)) {
      if (cat.includes(key)) ids.forEach((id) => found.add(id))
    }
  }
  const titulo = `${c.titulo} ${c.descripcion ?? ''}`
  for (const { pattern, competencias } of KEYWORDS_TITULO) {
    if (pattern.test(titulo)) competencias.forEach((id) => found.add(id))
  }
  if (found.size === 0 && cat) {
    found.add('operativa_produccion')
  }
  return [...found]
}

export function competenciasDesarrolladas(capacitaciones: Capacitacion[]): string[] {
  const ids = new Set<string>()
  for (const c of capacitaciones) {
    if (!esCapacitacionCompletada(c)) continue
    competenciasDeCapacitacion(c).forEach((id) => ids.add(id))
  }
  return [...ids]
}

export function esCapacitacionCompletada(c: Capacitacion): boolean {
  return (
    c.estado_inscripcion === 'completado' ||
    (c.estado === 'completada' && c.asistio === true)
  )
}

export function esCapacitacionAsignada(c: Capacitacion): boolean {
  const est = c.estado_inscripcion
  if (!est) return true
  return !['rechazado', 'cancelado'].includes(est)
}

export const ETIQUETA_ESTADO_INSCRIPCION: Record<string, string> = {
  pendiente: 'Pendiente',
  inscrito: 'Inscrito',
  aprobado: 'Aprobado',
  rechazado: 'Rechazado',
  completado: 'Completado',
  ausente: 'Ausente',
  cancelado: 'Cancelado'
}

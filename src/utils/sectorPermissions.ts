// Mapeo de roles a sectores permitidos para el libro de actas
export const ROL_TO_SECTORES: Record<string, string[]> = {
  'diseno': ['Diseño Gráfico'],
  'imprenta': ['Taller de Imprenta'],
  'taller-grafico': ['Taller Gráfico'],
  'mostrador': ['Mostrador'],
  'caja': ['Caja'],
  'instalaciones': ['Instalaciones'],
  'metalurgica': ['Metalúrgica'],
  'asesor-tecnico': ['Asesor Técnico'],
  'recursos-humanos': ['Recursos Humanos'],
  'administracion': [
    'Diseño Gráfico',
    'Taller de Imprenta',
    'Taller Gráfico',
    'Mostrador',
    'Caja',
    'Instalaciones',
    'Metalúrgica',
    'Asesor Técnico',
    'Recursos Humanos'
  ],
  'gerencia': [
    'Diseño Gráfico',
    'Taller de Imprenta',
    'Taller Gráfico',
    'Mostrador',
    'Caja',
    'Instalaciones',
    'Metalúrgica',
    'Asesor Técnico',
    'Recursos Humanos'
  ]
}

/**
 * Verifica si un usuario puede acceder a un sector específico
 */
export function canAccessSector(rol: string | undefined, sectorNombre: string): boolean {
  if (!rol) return false
  
  // Administradores y gerencia pueden acceder a todos
  if (rol === 'administracion' || rol === 'gerencia') {
    return true
  }
  
  // Verificar si el rol tiene acceso al sector
  const sectoresPermitidos = ROL_TO_SECTORES[rol] || []
  return sectoresPermitidos.includes(sectorNombre)
}

/**
 * Obtiene los sectores permitidos para un rol
 */
export function getSectoresPermitidos(rol: string | undefined): string[] {
  if (!rol) return []
  
  // Administradores y gerencia pueden acceder a todos
  if (rol === 'administracion' || rol === 'gerencia') {
    return ROL_TO_SECTORES['administracion'] || []
  }
  
  return ROL_TO_SECTORES[rol] || []
}


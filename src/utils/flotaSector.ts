/** Etiqueta de sector para formulario de flota según rol del usuario logueado. */
const ROL_A_SECTOR: Record<string, string> = {
  administracion: 'Administración',
  gerencia: 'Gerencia',
  'recursos-humanos': 'Recursos Humanos',
  diseno: 'Diseño Gráfico',
  imprenta: 'Taller de Imprenta',
  'taller-grafico': 'Taller Gráfico',
  instalaciones: 'Instalaciones',
  metalurgica: 'Metalúrgica',
  caja: 'Caja',
  mostrador: 'Mostrador',
  compras: 'Compras',
  'asesor-tecnico': 'Asesor Técnico',
  presupuestos: 'Presupuestos'
}

export function sectorDesdeRolUsuario(rol?: string | null): string {
  if (!rol) return ''
  return ROL_A_SECTOR[rol] ?? ''
}

/** Temáticas evaluables en pruebas de conocimiento (vinculables a formación). */
export const TEMATICAS_PRUEBA: { id: string; label: string }[] = [
  { id: 'induccion', label: 'Inducción y onboarding' },
  { id: 'seguridad', label: 'Seguridad e higiene' },
  { id: 'calidad', label: 'Calidad y procesos' },
  { id: 'operativa', label: 'Operativa de producción' },
  { id: 'atencion', label: 'Atención al cliente' },
  { id: 'tecnologia', label: 'Tecnología y sistemas' },
  { id: 'comercial', label: 'Gestión comercial' },
  { id: 'normativa', label: 'Normativa laboral' },
  { id: 'liderazgo', label: 'Liderazgo' },
  { id: 'general', label: 'Conocimientos generales' }
]

const LABEL = new Map(TEMATICAS_PRUEBA.map((t) => [t.id, t.label]))

const PATRONES: { pattern: RegExp; id: string }[] = [
  { pattern: /inducci[oó]n|onboarding|ingreso|bienvenida/i, id: 'induccion' },
  { pattern: /seguridad|higiene|epp|primeros auxilios/i, id: 'seguridad' },
  { pattern: /calidad|iso|auditor|proceso/i, id: 'calidad' },
  { pattern: /operativ|producci[oó]n|taller|imprenta|metal/i, id: 'operativa' },
  { pattern: /cliente|mostrador|venta|comercial/i, id: 'comercial' },
  { pattern: /atenci[oó]n|servicio/i, id: 'atencion' },
  { pattern: /sistema|software|plot|digital|informática/i, id: 'tecnologia' },
  { pattern: /ley|laboral|rrhh|normativa/i, id: 'normativa' },
  { pattern: /liderazgo|coordinaci[oó]n|supervis/i, id: 'liderazgo' }
]

export function tematicaDePrueba(titulo: string, descripcion?: string | null): string {
  const texto = `${titulo} ${descripcion ?? ''}`
  for (const { pattern, id } of PATRONES) {
    if (pattern.test(texto)) return id
  }
  return 'general'
}

export function etiquetaTematicaPrueba(id: string): string {
  return LABEL.get(id) ?? id
}

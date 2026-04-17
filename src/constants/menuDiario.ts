/** Cupo por turno de almuerzo (comedor) */
export const MENU_ALMUERZO_CUPO_POR_TURNO = 10

/**
 * Hora tope en Argentina para pedir o cancelar el menú del día.
 * Debe coincidir con `seleccionar_plato_menu` / `cancelar_seleccion_menu` en Supabase (patches SQL).
 */
export const MENU_PEDIDO_HORA_TOPE_ARG = { hour: 10, minute: 30 } as const

export const MENU_PEDIDO_HORA_TOPE_TEXTO = '10:30'

export type MenuTurnoAlmuerzoId = 1 | 2 | 3

export const MENU_TURNOS_ALMUERZO: {
  id: MenuTurnoAlmuerzoId
  label: string
  horario: string
}[] = [
  { id: 1, label: 'Turno 1', horario: '13:30 – 14:15' },
  { id: 2, label: 'Turno 2', horario: '14:20 – 15:00' },
  { id: 3, label: 'Turno 3', horario: '15:05 – 15:45' }
]

export function getTurnoAlmuerzoLabel(turno: number): string {
  const t = MENU_TURNOS_ALMUERZO.find((x) => x.id === turno)
  return t ? `${t.label} (${t.horario})` : `Turno ${turno}`
}

/** Al menos 5 emojis para “cómo te sentís” (validados también en la BD) */
export const MENU_EMOJIS_ESTADO: { emoji: string; label: string }[] = [
  { emoji: '😊', label: 'Contento/a' },
  { emoji: '😋', label: 'Con hambre' },
  { emoji: '😐', label: 'Regular' },
  { emoji: '😴', label: 'Cansado/a' },
  { emoji: '🤩', label: 'Genial' },
  { emoji: '🙏', label: 'Agradecido/a' }
]

export const MENU_EMOJIS_PERMITIDOS = new Set(MENU_EMOJIS_ESTADO.map((e) => e.emoji))

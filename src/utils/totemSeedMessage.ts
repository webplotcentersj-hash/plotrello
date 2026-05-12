/** Mensaje inicial al ir de autogestión al tótem PlotAI (`/totem`). */
export const TOTEM_SEED_MESSAGE_KEY = 'plotrello_totem_seed_message'

export function consumeTotemSeedMessage(): string | null {
  try {
    const v = sessionStorage.getItem(TOTEM_SEED_MESSAGE_KEY)
    sessionStorage.removeItem(TOTEM_SEED_MESSAGE_KEY)
    const t = v?.trim()
    return t || null
  } catch {
    return null
  }
}

export function setTotemSeedMessage(text: string) {
  try {
    sessionStorage.setItem(TOTEM_SEED_MESSAGE_KEY, text)
  } catch {
    /* modo privado / cuota */
  }
}

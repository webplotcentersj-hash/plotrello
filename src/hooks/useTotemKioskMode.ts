import { useCallback, useEffect } from 'react'

/**
 * Marca el documento en modo kiosko (tótem / pantalla táctil).
 * Usar dentro de `TotemKioskLayout` o rutas de autogestión.
 */
export function useTotemKioskMode() {
  useEffect(() => {
    document.documentElement.classList.add('totem-kiosk-mode')
    return () => document.documentElement.classList.remove('totem-kiosk-mode')
  }, [])
}

export async function requestTotemKioskFullscreen(el?: HTMLElement | null): Promise<boolean> {
  try {
    const target = el ?? document.documentElement
    if (!document.fullscreenElement && target.requestFullscreen) {
      await target.requestFullscreen()
      return true
    }
  } catch {
    /* El navegador puede bloquear sin gesto del usuario */
  }
  return false
}

export function useTotemKioskFullscreen() {
  const toggle = useCallback(async (el?: HTMLElement | null) => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen()
        return false
      }
      return await requestTotemKioskFullscreen(el)
    } catch {
      return Boolean(document.fullscreenElement)
    }
  }, [])

  return { toggle }
}

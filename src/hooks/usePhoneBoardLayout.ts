import { useEffect, useState } from 'react'

/** Alineado con `plotlab-mobile.css`: tablero y chrome en modo teléfono. */
export const PHONE_BOARD_MAX_WIDTH_PX = 768

const QUERY = `(max-width: ${PHONE_BOARD_MAX_WIDTH_PX}px)`

/**
 * True en viewports estrechos (teléfono): sin DnD, filtros mínimos, sin flotantes de tablero.
 */
export function usePhoneBoardLayout(): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(QUERY).matches
      : false
  )

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined
    const mq = window.matchMedia(QUERY)
    const onChange = () => setMatches(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  return matches
}

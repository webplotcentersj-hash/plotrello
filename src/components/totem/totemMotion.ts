/**
 * Constantes de animación compartidas por las pantallas del tótem (motion).
 * Mismo "carácter" que la señalética: resortes con rebote, nada de latidos.
 */

export const SPRING = { type: 'spring', stiffness: 240, damping: 17, mass: 0.9 } as const
export const SPRING_SOFT = { type: 'spring', stiffness: 170, damping: 20, mass: 0.9 } as const
export const EASE_IN_OUT = 'easeInOut' as const

/**
 * Animación que se repite cada `period` segundos: dura `dur`, espera el resto y arranca
 * tras `delay`. Sirve para "secuenciar" gestos (salto → ícono → brillo) sin que se pisen.
 */
export function loop(delay: number, dur: number, period: number) {
  return {
    duration: dur,
    delay,
    repeat: Infinity,
    repeatDelay: Math.max(0, period - dur),
    ease: EASE_IN_OUT
  } as const
}

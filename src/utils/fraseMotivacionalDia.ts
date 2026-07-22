import { getArgentinaDateString } from './dateUtils'

export type FraseMotivacional = {
  texto: string
  autor: string
}

/** Frases cortas para el spotlight del header (rotación diaria). */
export const FRASES_MOTIVACIONALES: FraseMotivacional[] = [
  { texto: 'El éxito es la suma de pequeños esfuerzos repetidos día tras día.', autor: 'Robert Collier' },
  { texto: 'No hace falta ser perfecto para empezar; hace falta empezar para perfeccionarse.', autor: 'Anónimo' },
  { texto: 'La disciplina es el puente entre metas y logros.', autor: 'Jim Rohn' },
  { texto: 'Haz de cada día tu obra maestra.', autor: 'John Wooden' },
  { texto: 'Lo que hacés hoy puede mejorar todos tus mañanas.', autor: 'Ralph Marston' },
  { texto: 'El trabajo en equipo divide el trabajo y multiplica el éxito.', autor: 'Anónimo' },
  { texto: 'La constancia vence lo que la dicha no alcanza.', autor: 'Proverbio' },
  { texto: 'No cuentes los días; hacé que los días cuenten.', autor: 'Muhammad Ali' },
  { texto: 'La excelencia no es un acto, es un hábito.', autor: 'Aristóteles' },
  { texto: 'Si querés ir rápido, andá solo. Si querés llegar lejos, andá acompañado.', autor: 'Proverbio africano' },
  { texto: 'El único modo de hacer un gran trabajo es amar lo que hacés.', autor: 'Steve Jobs' },
  { texto: 'Pequeños pasos cada día llevan a grandes destinos.', autor: 'Anónimo' },
  { texto: 'La actitud es una pequeña cosa que marca una gran diferencia.', autor: 'Winston Churchill' },
  { texto: 'No te detengas cuando estés cansado; detente cuando hayas terminado.', autor: 'Anónimo' },
  { texto: 'La creatividad es la inteligencia divirtiéndose.', autor: 'Albert Einstein' },
  { texto: 'Hoy es una oportunidad nueva; usala bien.', autor: 'Anónimo' },
  { texto: 'El talento gana partidos, pero el trabajo en equipo y la inteligencia ganan campeonatos.', autor: 'Michael Jordan' },
  { texto: 'Sé el cambio que querés ver en el mundo.', autor: 'Mahatma Gandhi' },
  { texto: 'La mejor forma de predecir el futuro es creándolo.', autor: 'Peter Drucker' },
  { texto: 'Caerse siete veces, levantarse ocho.', autor: 'Proverbio japonés' },
  { texto: 'El entusiasmo mueve el mundo.', autor: 'Anónimo' },
  { texto: 'No hay atajos para ningún lugar que valga la pena.', autor: 'Beverly Sills' },
  { texto: 'La calidad no es un acto, es un hábito.', autor: 'Aristóteles' },
  { texto: 'Empezá donde estás. Usá lo que tenés. Hacé lo que puedas.', autor: 'Arthur Ashe' },
  { texto: 'Un equipo alineado supera a un genio solo.', autor: 'Anónimo' },
  { texto: 'La paciencia y la perseverancia tienen un efecto mágico.', autor: 'John Quincy Adams' },
  { texto: 'Hacé lo ordinario de manera extraordinaria.', autor: 'Anónimo' },
  { texto: 'El secreto de avanzar es empezar.', autor: 'Mark Twain' },
  { texto: 'La energía y la persistencia conquistan todas las cosas.', autor: 'Benjamin Franklin' },
  { texto: 'Tu actitud, no tu aptitud, determina tu altitud.', autor: 'Zig Ziglar' },
  { texto: 'Cada detalle cuenta cuando el resultado importa.', autor: 'Anónimo' }
]

/** Índice estable por día Argentina (cambia solo al pasar el día). */
export function indiceFraseDelDia(ymd = getArgentinaDateString()): number {
  const compact = ymd.replace(/-/g, '')
  const n = Number(compact)
  if (!Number.isFinite(n) || n <= 0) return 0
  return n % FRASES_MOTIVACIONALES.length
}

export function fraseMotivacionalDelDia(ymd = getArgentinaDateString()): FraseMotivacional {
  return FRASES_MOTIVACIONALES[indiceFraseDelDia(ymd)]!
}

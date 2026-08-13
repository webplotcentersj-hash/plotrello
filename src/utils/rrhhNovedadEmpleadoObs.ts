import type { RrhhNovedad } from '../types/api'

const STOP = new Set([
  'para',
  'dias',
  'dia',
  'este',
  'esta',
  'esto',
  'como',
  'todo',
  'todos',
  'todas',
  'desde',
  'hasta',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'viaje',
  'pide',
  'pedido',
  'queda',
  'quedan',
  'aprobado',
  'aprobados',
  'descuento',
  'vacaciones',
  'vacacion',
  'injustificada',
  'justificada',
  'permiso',
  'falta',
  'horas',
  'hora'
])

export function normalizarNombrePersona(s: string): string {
  return String(s || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function tokensNombrePersona(nombre: string): string[] {
  return normalizarNombrePersona(nombre)
    .split(' ')
    .filter((t) => t.length >= 4 && !STOP.has(t))
}

export type EmpleadoMencionadoObs = { id: number; nombre: string; score: number }

/** Otros empleados cuyo nombre aparece en la observación (no el titular). */
export function empleadosMencionadosEnObservacion(
  obs: string | null | undefined,
  nombres: Map<number, string>,
  idActual: number
): EmpleadoMencionadoObs[] {
  const texto = ` ${normalizarNombrePersona(obs || '')} `
  if (texto.trim().length < 4) return []
  const hits: EmpleadoMencionadoObs[] = []
  for (const [id, nombre] of nombres) {
    if (id === idActual) continue
    const tokens = tokensNombrePersona(nombre)
    if (!tokens.length) continue
    const mentioned = tokens.filter((t) => texto.includes(` ${t} `))
    if (!mentioned.length) continue
    hits.push({
      id,
      nombre,
      score: mentioned.includes(tokens[0]!) ? 2 : 1
    })
  }
  hits.sort((a, b) => b.score - a.score || a.nombre.localeCompare(b.nombre, 'es'))
  return hits
}

export function novedadEmpleadoIncorrecto(
  n: Pick<RrhhNovedad, 'id_usuario' | 'observaciones'>,
  nombres: Map<number, string>
): EmpleadoMencionadoObs[] {
  const propio = tokensNombrePersona(nombres.get(n.id_usuario) || '')
  const texto = ` ${normalizarNombrePersona(n.observaciones || '')} `
  const mencionaPropio = propio.some((t) => texto.includes(` ${t} `))
  if (mencionaPropio) return []
  return empleadosMencionadosEnObservacion(n.observaciones, nombres, n.id_usuario)
}

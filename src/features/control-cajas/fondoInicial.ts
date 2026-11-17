import type { CajaArqueo, CajaTransferenciaLote } from './types'
import { mismoCajaSlug } from './cajaSlug'

/**
 * Fondo con el que arranca el día una caja: el efectivo que quedó físicamente en el cajón.
 *
 * El fondo dejado se registra en el arqueo (saldos.fondo_para_otra_caja / fondo_destino_slug)
 * y en el cierre de turno (lote.fondo_monto / caja_fondo_destino_slug). El turno siguiente lo
 * vuelve a contar junto con lo vendido, así que tiene que formar parte del efectivo esperado;
 * si no, todos los días aparece un sobrante del tamaño del fondo.
 *
 * Solo cuentan eventos de días ANTERIORES: los traspasos del mismo día ya entran como
 * movimientos (traspasos_fisicos) en el teórico del día.
 */
export type EventoFondo = {
  fecha: string
  /** Desempate dentro del mismo día (created_at ISO). */
  orden: string
  origen: string
  destino: string
  monto: number
}

function clave(e: Pick<EventoFondo, 'fecha' | 'orden'>): string {
  return `${e.fecha}|${e.orden}`
}

export function eventosFondoDesdeArqueos(arqueos: CajaArqueo[]): EventoFondo[] {
  const out: EventoFondo[] = []
  for (const a of arqueos) {
    const s = (a.saldos ?? {}) as Record<string, unknown>
    if (s.fondo_para_otra_caja == null) continue
    const monto = Math.max(0, Number(s.fondo_para_otra_caja) || 0)
    const destino = String(s.fondo_destino_slug ?? '').trim() || a.caja_slug
    out.push({ fecha: a.fecha, orden: a.created_at ?? '', origen: a.caja_slug, destino, monto })
  }
  return out
}

export function eventosFondoDesdeLotes(lotes: CajaTransferenciaLote[]): EventoFondo[] {
  return lotes
    .filter((l) => l.origen_slug && l.caja_fondo_destino_slug)
    .map((l) => ({
      fecha: l.fecha,
      orden: l.created_at ?? '',
      origen: l.origen_slug,
      destino: l.caja_fondo_destino_slug,
      monto: Math.max(0, Number(l.fondo_monto) || 0)
    }))
}

/** Arqueo y cierre del mismo turno informan el mismo fondo: por caja y día vale el último. */
function ultimoPorOrigenYDia(eventos: EventoFondo[]): EventoFondo[] {
  const porClave = new Map<string, EventoFondo>()
  for (const e of eventos) {
    const k = `${e.origen}|${e.fecha}`
    const prev = porClave.get(k)
    if (!prev || clave(e) > clave(prev)) porClave.set(k, e)
  }
  return [...porClave.values()]
}

export function fondoInicialDelDia(input: {
  cajaSlug: string
  fecha: string
  eventos: EventoFondo[]
  /** Sin ningún arqueo/cierre previo: fondo configurado a mano en la caja. */
  fondoConfigurado?: number
}): number {
  const { cajaSlug, fecha } = input
  const previos = ultimoPorOrigenYDia(input.eventos.filter((e) => e.fecha < fecha))

  const propios = previos
    .filter((e) => mismoCajaSlug(e.origen, cajaSlug))
    .sort((a, b) => clave(b).localeCompare(clave(a)))
  const ultimoPropio = propios[0] ?? null

  const entrantes = (desde: string) =>
    previos.filter(
      (e) =>
        !mismoCajaSlug(e.origen, cajaSlug) &&
        mismoCajaSlug(e.destino, cajaSlug) &&
        clave(e) > desde
    )

  if (!ultimoPropio) {
    const recibidos = entrantes('')
    if (recibidos.length === 0) return Math.max(0, Number(input.fondoConfigurado) || 0)
    return redondear(recibidos.reduce((s, e) => s + e.monto, 0))
  }

  // Tras el último cierre/arqueo propio, el cajón quedó con su fondo (si lo dejó acá)
  // más lo que otras cajas le dejaron después.
  const base = mismoCajaSlug(ultimoPropio.destino, cajaSlug) ? ultimoPropio.monto : 0
  const recibidos = entrantes(clave(ultimoPropio)).reduce((s, e) => s + e.monto, 0)
  return redondear(base + recibidos)
}

function redondear(n: number): number {
  return Math.round(n * 100) / 100
}

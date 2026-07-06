import type { HistorialMovimiento, OrdenTrabajo } from '../types/api'
import { BOARD_COLUMNS } from '../data/mockData'

const digitsOnly = (s: string) => String(s ?? '').replace(/\D/g, '')

function findSectorDescripcion(nombre: string): string | null {
  const norm = nombre.trim().toLowerCase()
  if (!norm || norm === 'n/a') return null
  const col = BOARD_COLUMNS.find((c) => c.label.toLowerCase() === norm)
  return col?.description?.trim() || null
}

function parseTransicion(part: string): { anterior: string | null; nuevo: string } | null {
  const match = part.match(/^(.+?)\s*→\s*(.+)$/)
  if (!match) return null
  const anterior = match[1].trim()
  const nuevo = match[2].trim()
  return {
    anterior: anterior === 'N/A' ? null : anterior,
    nuevo
  }
}

/** Convierte comentarios técnicos del historial en texto claro para el cliente. */
export function formatConsultaTimelineComment(raw: string): string {
  const text = raw.trim()
  if (!text) return text

  let estadoTrans: { anterior: string | null; nuevo: string } | null = null
  let sectorTrans: { anterior: string | null; nuevo: string } | null = null
  const otros: string[] = []

  for (const part of text.split('|').map((p) => p.trim()).filter(Boolean)) {
    if (part.startsWith('Estado:')) {
      estadoTrans = parseTransicion(part.slice(7).trim())
    } else if (part.startsWith('Sector:')) {
      sectorTrans = parseTransicion(part.slice(7).trim())
    } else {
      otros.push(part)
    }
  }

  if (!estadoTrans && !sectorTrans) return text

  const destino = sectorTrans?.nuevo || estadoTrans?.nuevo
  if (!destino) return text

  const descripcion = findSectorDescripcion(destino)
  const origen = sectorTrans?.anterior || estadoTrans?.anterior

  const mismoDestino =
    estadoTrans &&
    sectorTrans &&
    estadoTrans.nuevo === sectorTrans.nuevo &&
    (estadoTrans.anterior ?? '') === (sectorTrans.anterior ?? '')

  if (mismoDestino || (estadoTrans && sectorTrans && estadoTrans.nuevo === sectorTrans.nuevo)) {
    if (origen) {
      return descripcion
        ? `Pasó de «${origen}» a «${destino}». ${descripcion}.`
        : `Pasó de «${origen}» a «${destino}».`
    }
    return descripcion ? `Ingresó a «${destino}»: ${descripcion}.` : `Estado: ${destino}.`
  }

  if (sectorTrans?.nuevo && descripcion) {
    const base = origen
      ? `Cambió de sector: «${origen}» → «${sectorTrans.nuevo}».`
      : `Sector: «${sectorTrans.nuevo}».`
    return `${base} ${descripcion}.`
  }

  if (estadoTrans?.nuevo) {
    const descEstado = findSectorDescripcion(estadoTrans.nuevo)
    if (descEstado) {
      return origen
        ? `Pasó de «${origen}» a «${estadoTrans.nuevo}». ${descEstado}.`
        : `Estado: «${estadoTrans.nuevo}». ${descEstado}.`
    }
  }

  if (otros.length > 0) return otros.join(' · ')
  return text
}

/** Reparte movimientos de una query .in(id_orden) por cada ficha, orden cronológico. */
export function historialPorOrdenId(
  movimientos: HistorialMovimiento[],
  ordenIds: number[]
): Record<number, HistorialMovimiento[]> {
  const map: Record<number, HistorialMovimiento[]> = {}
  for (const id of ordenIds) map[id] = []
  for (const m of movimientos) {
    if (map[m.id_orden] !== undefined) map[m.id_orden].push(m)
  }
  const t = (x: HistorialMovimiento) => new Date(x.timestamp).getTime()
  for (const id of ordenIds) {
    map[id].sort((a, b) => t(a) - t(b))
  }
  return map
}

/** Si hay varias fichas con el mismo número OP (solo dígitos), conviene mostrar un timeline único. */
export function historialUnificadoMismoNumeroOp(
  movimientos: HistorialMovimiento[],
  ordenes: OrdenTrabajo[]
): HistorialMovimiento[] | null {
  if (ordenes.length < 2) return null
  const d0 = digitsOnly(ordenes[0]?.numero_op ?? '')
  if (!d0) return null
  const mismo = ordenes.every((o) => digitsOnly(o.numero_op ?? '') === d0)
  if (!mismo) return null
  const t = (x: HistorialMovimiento) => new Date(x.timestamp).getTime()
  return [...movimientos].sort((a, b) => t(a) - t(b))
}

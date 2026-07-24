import type { ClienteRecord } from '../types/api'
import { normalizarDniCuit, nombreCompletoCliente } from './buscarClienteMatch'

export type CampoFusionCliente =
  | 'nombre'
  | 'apellido'
  | 'empresa'
  | 'dni_cuit'
  | 'telefono'
  | 'email'
  | 'direccion'

export const CAMPOS_FUSION_CLIENTE: { key: CampoFusionCliente; label: string }[] = [
  { key: 'nombre', label: 'Nombre' },
  { key: 'apellido', label: 'Apellido' },
  { key: 'empresa', label: 'Empresa' },
  { key: 'dni_cuit', label: 'DNI / CUIT' },
  { key: 'telefono', label: 'Teléfono' },
  { key: 'email', label: 'Email' },
  { key: 'direccion', label: 'Dirección' }
]

export type DatosFusionCliente = Record<CampoFusionCliente, string>

export type OrigenCampoFusion = Partial<Record<CampoFusionCliente, number>>

function valorCampo(c: ClienteRecord, key: CampoFusionCliente): string {
  const v = c[key]
  return typeof v === 'string' ? v.trim() : ''
}

/** Elige el mejor valor de un campo entre varias fichas (más completo / CUIT más largo). */
export function mejorValorCampo(
  clientes: ClienteRecord[],
  key: CampoFusionCliente,
  preferirId?: number
): { valor: string; idOrigen: number | null } {
  const preferido = preferirId != null ? clientes.find((c) => c.id === preferirId) : undefined
  const prefVal = preferido ? valorCampo(preferido, key) : ''

  let best = prefVal
  let bestId = prefVal ? (preferido?.id ?? null) : null

  for (const c of clientes) {
    const v = valorCampo(c, key)
    if (!v) continue
    if (!best) {
      best = v
      bestId = c.id
      continue
    }
    if (key === 'dni_cuit') {
      const digitsBest = normalizarDniCuit(best)
      const digitsV = normalizarDniCuit(v)
      if (digitsV.length > digitsBest.length) {
        best = v
        bestId = c.id
      }
      continue
    }
    if (v.length > best.length + 3) {
      best = v
      bestId = c.id
    }
  }

  return { valor: best, idOrigen: bestId }
}

/** Compone los datos finales de la ficha unificada a partir del grupo. */
export function componerDatosFusion(
  clientes: ClienteRecord[],
  idPrincipal: number,
  origenes?: OrigenCampoFusion
): DatosFusionCliente {
  const out = {} as DatosFusionCliente
  for (const { key } of CAMPOS_FUSION_CLIENTE) {
    const forcedId = origenes?.[key]
    if (forcedId != null) {
      const src = clientes.find((c) => c.id === forcedId)
      out[key] = src ? valorCampo(src, key) : ''
      if (out[key]) continue
    }
    out[key] = mejorValorCampo(clientes, key, idPrincipal).valor
  }
  if (!out.nombre.trim()) {
    const p = clientes.find((c) => c.id === idPrincipal)
    out.nombre = p?.nombre?.trim() || nombreCompletoCliente(p || clientes[0]) || 'Cliente'
  }
  return out
}

export function opcionesCampoFusion(
  clientes: ClienteRecord[],
  key: CampoFusionCliente
): { id: number; label: string; valor: string }[] {
  const seen = new Set<string>()
  const opts: { id: number; label: string; valor: string }[] = []
  for (const c of clientes) {
    const valor = valorCampo(c, key)
    if (!valor) continue
    const norm = valor.toLowerCase()
    if (seen.has(norm)) continue
    seen.add(norm)
    opts.push({
      id: c.id,
      valor,
      label: `#${c.id} · ${nombreCompletoCliente(c)}`
    })
  }
  return opts
}

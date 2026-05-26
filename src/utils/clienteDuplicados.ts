import type { ClienteRecord } from '../types/api'
import {
  nombreCompletoCliente,
  normalizarDniCuit,
  normalizarTelefono,
  normalizarTexto,
  tokensNombre
} from './buscarClienteMatch'

export type RazonDuplicado = 'dni_cuit' | 'telefono' | 'email' | 'nombre'

export type GrupoDuplicadoClientes = {
  ids: number[]
  clientes: ClienteRecord[]
  razones: RazonDuplicado[]
  /** 0–100 confianza del grupo */
  confianza: number
}

const RAZON_LABEL: Record<RazonDuplicado, string> = {
  dni_cuit: 'DNI / CUIT',
  telefono: 'Teléfono',
  email: 'Email',
  nombre: 'Nombre similar'
}

export function etiquetaRazonDuplicado(r: RazonDuplicado): string {
  return RAZON_LABEL[r]
}

function dnisCoinciden(a: string, b: string): boolean {
  if (a.length < 8 || b.length < 8) return false
  if (a === b) return true
  return a.endsWith(b) || b.endsWith(a)
}

function nombresMuySimilares(a: ClienteRecord, b: ClienteRecord): boolean {
  const na = normalizarTexto(nombreCompletoCliente(a))
  const nb = normalizarTexto(nombreCompletoCliente(b))
  if (!na || !nb) return false
  if (na === nb) return true
  if (na.includes(nb) || nb.includes(na)) return true

  const ta = tokensNombre(na)
  const tb = tokensNombre(nb)
  if (ta.length === 0 || tb.length === 0) return false

  const hits = ta.filter((t) => tb.some((o) => o === t || o.includes(t) || t.includes(o)))
  const minLen = Math.min(ta.length, tb.length)
  return hits.length >= minLen && hits.length >= 1
}

/** Par de fichas que el sistema considera posible duplicado. */
export function analizarParDuplicado(
  a: ClienteRecord,
  b: ClienteRecord
): { duplicado: boolean; razones: RazonDuplicado[]; confianza: number } {
  if (a.id === b.id) return { duplicado: false, razones: [], confianza: 0 }

  const razones: RazonDuplicado[] = []
  let puntos = 0

  const dniA = normalizarDniCuit(a.dni_cuit)
  const dniB = normalizarDniCuit(b.dni_cuit)
  if (dnisCoinciden(dniA, dniB)) {
    razones.push('dni_cuit')
    puntos += 45
  }

  const telA = normalizarTelefono(a.telefono)
  const telB = normalizarTelefono(b.telefono)
  if (telA.length >= 8 && telB.length >= 8 && telA === telB) {
    razones.push('telefono')
    puntos += 35
  }

  const mailA = normalizarTexto(a.email)
  const mailB = normalizarTexto(b.email)
  if (mailA && mailB && mailA.length >= 5 && mailA === mailB) {
    razones.push('email')
    puntos += 40
  }

  if (nombresMuySimilares(a, b)) {
    razones.push('nombre')
    puntos += 25
  }

  const empresaA = normalizarTexto(a.empresa)
  const empresaB = normalizarTexto(b.empresa)
  if (empresaA && empresaB && empresaA.length >= 3 && empresaA === empresaB) {
    if (!razones.includes('nombre')) razones.push('nombre')
    puntos += 15
  }

  const duplicado =
    razones.length > 0 &&
    (razones.includes('dni_cuit') ||
      razones.includes('telefono') ||
      razones.includes('email') ||
      (razones.includes('nombre') && puntos >= 25))

  const confianza = Math.min(100, puntos)
  return { duplicado, razones, confianza }
}

/** Agrupa clientes conectados por posibles duplicados (componentes). */
export function detectarGruposDuplicados(clientes: ClienteRecord[]): GrupoDuplicadoClientes[] {
  const n = clientes.length
  if (n < 2) return []

  const parent = clientes.map((_, i) => i)
  const find = (i: number): number => {
    if (parent[i] !== i) parent[i] = find(parent[i])
    return parent[i]
  }
  const union = (i: number, j: number) => {
    const ri = find(i)
    const rj = find(j)
    if (ri !== rj) parent[ri] = rj
  }

  const edgeRazones = new Map<string, RazonDuplicado[]>()
  const edgeConf = new Map<string, number>()

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const { duplicado, razones, confianza } = analizarParDuplicado(clientes[i], clientes[j])
      if (!duplicado) continue
      union(i, j)
      const key = `${Math.min(i, j)}-${Math.max(i, j)}`
      edgeRazones.set(key, razones)
      edgeConf.set(key, confianza)
    }
  }

  const buckets = new Map<number, number[]>()
  for (let i = 0; i < n; i++) {
    const root = find(i)
    const list = buckets.get(root) ?? []
    list.push(i)
    buckets.set(root, list)
  }

  const grupos: GrupoDuplicadoClientes[] = []

  for (const indices of buckets.values()) {
    if (indices.length < 2) continue

    const razonesSet = new Set<RazonDuplicado>()
    let confMax = 0
    for (let a = 0; a < indices.length; a++) {
      for (let b = a + 1; b < indices.length; b++) {
        const key = `${Math.min(indices[a], indices[b])}-${Math.max(indices[a], indices[b])}`
        const rs = edgeRazones.get(key)
        if (rs) rs.forEach((r) => razonesSet.add(r))
        const c = edgeConf.get(key)
        if (c != null) confMax = Math.max(confMax, c)
      }
    }

    const grupoClientes = indices.map((i) => clientes[i])
    grupos.push({
      ids: grupoClientes.map((c) => c.id),
      clientes: grupoClientes,
      razones: [...razonesSet],
      confianza: confMax
    })
  }

  return grupos.sort((a, b) => b.confianza - a.confianza)
}

export function clienteCoincideBusqueda(cliente: ClienteRecord, query: string): boolean {
  const tokens = tokenizarBusquedaCliente(query)
  if (tokens.length === 0) return true
  return tokens.every((t) => clienteCoincideToken(cliente, t))
}

/** Separa la búsqueda en palabras; ignora espacios múltiples. */
export function tokenizarBusquedaCliente(query: string): string[] {
  return query
    .trim()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 1)
}

function clienteCoincideToken(cliente: ClienteRecord, token: string): boolean {
  const tNorm = normalizarTexto(token)
  const tDigits = normalizarDniCuit(token)
  const tTel = normalizarTelefono(token)

  const camposTexto = [
    cliente.nombre,
    cliente.apellido,
    cliente.empresa,
    cliente.email,
    cliente.direccion,
    nombreCompletoCliente(cliente)
  ]
    .filter(Boolean)
    .map((v) => normalizarTexto(String(v)))

  if (tNorm.length >= 1 && camposTexto.some((c) => c.includes(tNorm))) return true

  const dni = normalizarDniCuit(cliente.dni_cuit)
  if (tDigits.length >= 4 && dni.includes(tDigits)) return true

  const tel = normalizarTelefono(cliente.telefono)
  if (tTel.length >= 4 && tel.includes(tTel)) return true

  return false
}

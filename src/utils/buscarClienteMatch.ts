import type { ClienteRecord, OrdenTrabajo } from '../types/api'

export function normalizarDniCuit(value: string | null | undefined): string {
  if (!value) return ''
  return value.replace(/\D/g, '')
}

export function normalizarTelefono(value: string | null | undefined): string {
  if (!value) return ''
  return value.replace(/\D/g, '').slice(-10)
}

export function normalizarTexto(value: string | null | undefined): string {
  if (!value) return ''
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

export function nombreCompletoCliente(c: ClienteRecord): string {
  const n = [c.nombre, c.apellido].filter(Boolean).join(' ').trim()
  return n || c.nombre || '—'
}

export function tokensNombre(texto: string): string[] {
  return normalizarTexto(texto)
    .split(' ')
    .filter((t) => t.length >= 2)
}

/** Coincidencia flexible nombre ↔ campo cliente de la OP. */
function nombresCoinciden(clienteNorm: string, ordenClienteNorm: string): boolean {
  if (!clienteNorm || !ordenClienteNorm) return false
  if (clienteNorm === ordenClienteNorm) return true
  if (ordenClienteNorm.includes(clienteNorm) || clienteNorm.includes(ordenClienteNorm)) return true

  const tc = tokensNombre(clienteNorm)
  const to = tokensNombre(ordenClienteNorm)
  if (tc.length === 0 || to.length === 0) return false

  const hits = tc.filter((t) => to.some((o) => o.includes(t) || t.includes(o)))
  return hits.length >= Math.min(tc.length, Math.max(1, Math.ceil(tc.length * 0.6)))
}

export function ordenPerteneceACliente(orden: OrdenTrabajo, cliente: ClienteRecord): boolean {
  const dniCliente = normalizarDniCuit(cliente.dni_cuit)
  const dniOrden = normalizarDniCuit(orden.dni_cuit)
  if (dniCliente.length >= 6 && dniOrden.length >= 6) {
    if (dniOrden === dniCliente) return true
    if (dniOrden.endsWith(dniCliente) || dniCliente.endsWith(dniOrden)) return true
  }

  const nombreCliente = normalizarTexto(nombreCompletoCliente(cliente))
  const nombreOrden = normalizarTexto(orden.cliente)
  if (nombresCoinciden(nombreCliente, nombreOrden)) return true

  const empresa = normalizarTexto(cliente.empresa)
  if (empresa && empresa.length >= 3 && nombreOrden.includes(empresa)) return true

  const telC = normalizarTelefono(cliente.telefono)
  const telO = normalizarTelefono(orden.telefono_cliente)
  if (telC.length >= 8 && telO.length >= 8 && telC === telO) return true

  const mailC = normalizarTexto(cliente.email)
  const mailO = normalizarTexto(orden.email_cliente)
  if (mailC && mailO && mailC === mailO) return true

  return false
}

export function filtrarOrdenesDeCliente(
  ordenes: OrdenTrabajo[],
  cliente: ClienteRecord
): OrdenTrabajo[] {
  const seen = new Set<number>()
  const out: OrdenTrabajo[] = []
  for (const o of ordenes) {
    if (o.id == null || seen.has(o.id)) continue
    if (!ordenPerteneceACliente(o, cliente)) continue
    seen.add(o.id)
    out.push(o)
  }
  return out.sort(
    (a, b) =>
      new Date(b.fecha_creacion || 0).getTime() - new Date(a.fecha_creacion || 0).getTime()
  )
}

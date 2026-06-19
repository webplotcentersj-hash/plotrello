import type { ClienteCuentaCorrienteRecord, ClienteRecord, OrdenTrabajo } from '../types/api'
import type { TipoClienteCuentaCorriente } from '../constants/cuentaCorriente'
import { nombreCompletoCliente } from './buscarClienteMatch'

export type DatosCcSugeridos = {
  tipo_cliente: TipoClienteCuentaCorriente
  cuit: string
  razon_social: string
  nombre: string
  apellido: string
  email: string
  whatsapp: string
  persona_contacto: string
  domicilio: string
  localidad: string
  provincia: string
  codigo_postal: string
}

function pick(...vals: Array<string | null | undefined>): string {
  for (const v of vals) {
    const t = (v ?? '').trim()
    if (t) return t
  }
  return ''
}

/** Completa ficha CC con datos del maestro de clientes y OPs vinculadas. */
export function inferirDatosCcDesdeCliente(
  cliente: ClienteRecord,
  ordenes: OrdenTrabajo[],
  cc?: ClienteCuentaCorrienteRecord | null
): DatosCcSugeridos {
  const opReciente = ordenes[0]
  const nombre = pick(cc?.nombre, cliente.nombre)
  const apellido = pick(cc?.apellido, cliente.apellido)
  const empresa = pick(cliente.empresa)

  let tipo: TipoClienteCuentaCorriente = 'empresa'
  if (cc?.tipo_cliente === 'persona_fisica' || cc?.tipo_cliente === 'empresa') {
    tipo = cc.tipo_cliente
  } else if (empresa) {
    tipo = 'empresa'
  } else if (apellido) {
    tipo = 'persona_fisica'
  }

  const razonSocial =
    pick(
      cc?.razon_social,
      empresa,
      tipo === 'persona_fisica' ? nombreCompletoCliente(cliente) : cliente.nombre
    ) || nombreCompletoCliente(cliente)

  return {
    tipo_cliente: tipo,
    cuit: pick(cc?.cuit, cliente.dni_cuit, opReciente?.dni_cuit),
    razon_social: razonSocial,
    nombre,
    apellido,
    email: pick(cc?.email, cliente.email, opReciente?.email_cliente),
    whatsapp: pick(cc?.whatsapp, cliente.telefono, opReciente?.telefono_cliente),
    persona_contacto: pick(cc?.persona_contacto, nombreCompletoCliente(cliente)),
    domicilio: pick(cc?.domicilio, cliente.direccion, opReciente?.direccion_cliente),
    localidad: pick(cc?.localidad),
    provincia: pick(cc?.provincia),
    codigo_postal: pick(cc?.codigo_postal)
  }
}

export function mergeClienteBusquedaCc(
  local: ClienteRecord[],
  remoto: ClienteRecord[]
): ClienteRecord[] {
  const map = new Map<number, ClienteRecord>()
  for (const c of local) map.set(c.id, c)
  for (const c of remoto) map.set(c.id, c)
  return Array.from(map.values()).sort((a, b) =>
    nombreCompletoCliente(a).localeCompare(nombreCompletoCliente(b), 'es')
  )
}

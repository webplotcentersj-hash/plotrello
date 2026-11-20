import { CONDICIONES_IVA_CLIENTE, cuitValido, type CondicionIvaCliente } from './afipFacturaUi'

/** Ruta pública del formulario (sin login) y ruta de la bandeja del personal. */
export const ALTA_CLIENTE_PUBLICO = '/alta-cliente'
export const CLIENTES_SOLICITUDES = '/clientes/solicitudes'

export type SolicitudAltaClienteForm = {
  nombre: string
  apellido: string
  dniCuit: string
  telefono: string
  direccion: string
  email: string
  condicionIva: CondicionIvaCliente | ''
  razonSocial: string
  observaciones: string
}

export const SOLICITUD_FORM_VACIO: SolicitudAltaClienteForm = {
  nombre: '',
  apellido: '',
  dniCuit: '',
  telefono: '',
  direccion: '',
  email: '',
  condicionIva: '',
  razonSocial: '',
  observaciones: ''
}

/** Las condiciones que exigen CUIT (no alcanza el DNI). */
export const CONDICIONES_CON_CUIT: CondicionIvaCliente[] = ['Responsable Inscripto', 'Monotributista', 'Exento']

/** Orden y explicación para quien completa el formulario. */
export const OPCIONES_IVA_FORM: Array<{ valor: CondicionIvaCliente; ayuda: string }> = [
  { valor: 'Consumidor Final', ayuda: 'Particular, sin CUIT para facturar' },
  { valor: 'Monotributista', ayuda: 'Inscripto en el Monotributo' },
  { valor: 'Responsable Inscripto', ayuda: 'Inscripto en IVA' },
  { valor: 'Exento', ayuda: 'Exento de IVA' },
  { valor: 'No Responsable', ayuda: 'No responsable frente al IVA' }
]

export const soloDigitos = (s: string | null | undefined) => String(s ?? '').replace(/\D/g, '')

/** 20123456783 → 20-12345678-3; DNI 12345678 → 12.345.678. */
export function formatearDniCuit(raw: string | null | undefined): string {
  const d = soloDigitos(raw)
  if (d.length === 11) return `${d.slice(0, 2)}-${d.slice(2, 10)}-${d.slice(10)}`
  if (d.length === 7 || d.length === 8) return Number(d).toLocaleString('es-AR')
  return String(raw ?? '')
}

export type ErroresSolicitud = Partial<Record<keyof SolicitudAltaClienteForm, string>>

/** Mismas reglas que valida la base (crear_solicitud_alta_cliente) + dígito verificador del CUIT. */
export function validarSolicitudAltaCliente(f: SolicitudAltaClienteForm): ErroresSolicitud {
  const e: ErroresSolicitud = {}
  if (!f.nombre.trim()) e.nombre = 'Ingresá tu nombre'
  if (!f.apellido.trim()) e.apellido = 'Ingresá tu apellido'
  const doc = soloDigitos(f.dniCuit)
  if (!doc) e.dniCuit = 'Ingresá tu DNI o CUIT'
  else if (doc.length === 11) {
    if (!cuitValido(doc)) e.dniCuit = 'El CUIT/CUIL no es válido: revisá los números'
  } else if (doc.length !== 7 && doc.length !== 8) {
    e.dniCuit = 'El DNI tiene 7 u 8 dígitos; el CUIT/CUIL, 11'
  }
  if (soloDigitos(f.telefono).length < 8) e.telefono = 'Ingresá un teléfono con código de área (mínimo 8 dígitos)'
  if (!f.direccion.trim()) e.direccion = 'Ingresá tu domicilio'
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email.trim())) e.email = 'Ingresá un email válido'
  if (!f.condicionIva || !CONDICIONES_IVA_CLIENTE.includes(f.condicionIva)) {
    e.condicionIva = 'Elegí tu condición frente al IVA'
  } else if (CONDICIONES_CON_CUIT.includes(f.condicionIva) && doc.length !== 11 && !e.dniCuit) {
    e.dniCuit = `Para ${f.condicionIva} necesitamos el CUIT (11 dígitos)`
  }
  return e
}

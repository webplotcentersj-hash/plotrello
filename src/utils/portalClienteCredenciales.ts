import { buildWhatsappLink } from './whatsappLink'

export const CLIENTE_LOGIN_PATH = '/cliente/login'

export function linkLoginPortalCliente(origin?: string): string {
  const base =
    (origin || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/$/, '') ||
    'https://trello.plotcenter.com.ar'
  return `${base}${CLIENTE_LOGIN_PATH}`
}

/** Texto listo para pegar / enviar por WhatsApp al cliente. */
export function mensajeWhatsappAccesoPortal(opts: {
  nombre?: string | null
  usuario: string
  password: string
  link?: string
}): string {
  const nombre = (opts.nombre || '').trim()
  const saludo = nombre ? `¡Hola ${nombre}!` : '¡Hola!'
  const link = opts.link || linkLoginPortalCliente()
  return (
    `${saludo} Ya tenés acceso al portal de clientes de Plot Center.\n\n` +
    `Usuario: ${opts.usuario.trim()}\n` +
    `Contraseña: ${opts.password}\n\n` +
    `Ingresá acá: ${link}\n\n` +
    `Si necesitás ayuda, escribinos.`
  )
}

/** URL wa.me con el mensaje (usa el teléfono del cliente si hay). */
export function urlWhatsappAccesoPortal(opts: {
  telefono?: string | null
  nombre?: string | null
  usuario: string
  password: string
  link?: string
}): string {
  const text = mensajeWhatsappAccesoPortal(opts)
  return (
    buildWhatsappLink(opts.telefono, text) || `https://wa.me/?text=${encodeURIComponent(text)}`
  )
}

/** Abre WhatsApp con el mensaje de acceso. Devuelve el texto y la URL. */
export function abrirWhatsappAccesoPortal(opts: {
  telefono?: string | null
  nombre?: string | null
  usuario: string
  password: string
  link?: string
}): { texto: string; url: string } {
  const texto = mensajeWhatsappAccesoPortal(opts)
  const url = urlWhatsappAccesoPortal({ ...opts, link: opts.link })
  if (typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener,noreferrer')
  }
  return { texto, url }
}

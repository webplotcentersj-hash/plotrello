type ContactoCliente = {
  nombre: string | null
  telefono: string | null
  completo: boolean
}

const NOMBRES_GENERICOS = new Set([
  'cliente web',
  'cliente desde chat',
  'cliente',
  'visitante',
  'usuario'
])

function digitsOnly(s: string): string {
  return String(s ?? '').replace(/\D/g, '')
}

function normalizarTelefonoAr(raw: string): string | null {
  let d = digitsOnly(raw)
  if (d.startsWith('0')) d = d.slice(1)
  if (d.startsWith('54') && d.length > 10) d = d.slice(2)
  if (d.startsWith('9') && d.length === 11) d = d.slice(1)
  if (d.length < 8 || d.length > 12) return null
  return d
}

/** Extrae el primer teléfono/WhatsApp válido del texto. */
export function extractTelefonoWhatsapp(text: string): string | null {
  const t = text.trim()
  if (!t) return null

  const candidates = t.match(/(?:\+?54[\s-]?)?(?:9[\s-]?)?\d[\d\s\-()]{6,}\d/g) || []
  for (const c of candidates) {
    const n = normalizarTelefonoAr(c)
    if (n) return n
  }

  const loose = t.match(/\b\d{8,12}\b/g)
  if (loose) {
    for (const c of loose) {
      const n = normalizarTelefonoAr(c)
      if (n) return n
    }
  }
  return null
}

/** Nombre + teléfono en un solo mensaje (ej. "Alejandro 2644440043"). */
export function extractNombreYTelefonoMensaje(text: string): { nombre?: string; telefono?: string } {
  const telefono = extractTelefonoWhatsapp(text)
  if (!telefono) return {}

  const phoneMatch = text.match(
    /(?:\+?54[\s-]?)?(?:9[\s-]?)?\d[\d\s\-()]{6,}\d|\b\d{8,12}\b/
  )
  if (!phoneMatch || phoneMatch.index == null) return { telefono }

  const antes = text.slice(0, phoneMatch.index).trim()
  const despues = text.slice(phoneMatch.index + phoneMatch[0].length).trim()

  const limpiarNombre = (s: string) =>
    s
      .replace(/\b(me llamo|mi nombre es|nombre|soy|whatsapp|wsp|celular|tel[eé]fono)\b/gi, '')
      .replace(/[:,;.-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()

  let nombre = limpiarNombre(antes)
  if (!nombre || nombre.length < 2) nombre = limpiarNombre(despues)
  if (nombre && nombre.length >= 2 && nombre.length <= 60 && !/^\d+$/.test(nombre)) {
    return { nombre, telefono }
  }
  return { telefono }
}

function extractNombreExplicito(text: string): string | null {
  const t = text.trim()
  if (!t) return null
  const patterns = [
    /\b(?:me\s+llamo|mi\s+nombre\s+es|nombre\s*:)\s*([^.,;\n\d]{2,60})/i,
    /\bsoy\s+([^.,;\n\d]{2,60})/i
  ]
  for (const re of patterns) {
    const m = t.match(re)
    if (m?.[1]) {
      const n = m[1].trim().replace(/\s+/g, ' ')
      if (n.length >= 2 && !NOMBRES_GENERICOS.has(n.toLowerCase())) return n
    }
  }
  return null
}

function esNombreValido(nombre: string | null | undefined): boolean {
  if (!nombre?.trim()) return false
  const n = nombre.trim()
  if (n.length < 2 || n.length > 80) return false
  if (NOMBRES_GENERICOS.has(n.toLowerCase())) return false
  if (/^cliente(\s|#)/i.test(n)) return false
  if (/^cliente portal #\d+$/i.test(n)) return false
  return true
}

export function buildWhatsappLinkApi(phone?: string | null): string | undefined {
  if (!phone) return undefined
  let digits = digitsOnly(phone)
  if (!digits) return undefined
  if (digits.startsWith('0')) digits = digits.slice(1)
  if (!digits.startsWith('54')) digits = `54${digits}`
  return `https://wa.me/${digits}`
}

export function resolveContactoCliente(params: {
  bodyNombre?: string
  bodyTelefono?: string
  userTexts: string[]
  convNombre?: string | null
  convTelefono?: string | null
}): ContactoCliente {
  let nombre: string | null = null
  let telefono: string | null = null

  if (esNombreValido(params.convNombre)) nombre = params.convNombre!.trim()
  if (params.convTelefono) telefono = normalizarTelefonoAr(params.convTelefono)

  if (esNombreValido(params.bodyNombre)) nombre = params.bodyNombre!.trim()
  if (params.bodyTelefono) telefono = normalizarTelefonoAr(params.bodyTelefono) || telefono

  for (const txt of params.userTexts) {
    const par = extractNombreYTelefonoMensaje(txt)
    if (par.telefono) telefono = par.telefono
    if (par.nombre && esNombreValido(par.nombre)) nombre = par.nombre

    const tel = extractTelefonoWhatsapp(txt)
    if (tel) telefono = tel

    const nom = extractNombreExplicito(txt)
    if (nom && esNombreValido(nom)) nombre = nom
  }

  return {
    nombre,
    telefono,
    completo: esNombreValido(nombre) && !!telefono
  }
}

export function modoRequiereContactoCliente(modo: string): boolean {
  const m = (modo || 'web_publico').toLowerCase()
  return (
    m === 'web_publico' ||
    m === 'totem' ||
    m === 'totem_autogestion' ||
    m === 'totem_consulta_cliente'
  )
}

export function buildSolicitudContactoReply(contacto: ContactoCliente): string {
  const faltaNombre = !esNombreValido(contacto.nombre)
  const faltaTelefono = !contacto.telefono

  if (!faltaNombre && !faltaTelefono) return ''

  if (faltaNombre && faltaTelefono) {
    return (
      '¡Hola! Antes de seguir, necesito tu nombre y tu número de WhatsApp (con código de área, sin 0 ni 15) ' +
      'para que el equipo de Plot Center pueda contactarte si hace falta. ' +
      'Podés mandarlo en un solo mensaje, por ejemplo: Juan 2644123456.'
    )
  }
  if (faltaNombre) {
    return (
      `Gracias por el WhatsApp. ¿Me decís tu nombre completo para registrar la consulta? ` +
      `Ya tengo el número ${contacto.telefono}.`
    )
  }
  return (
    `Gracias${contacto.nombre ? `, ${contacto.nombre}` : ''}. ` +
    '¿Me pasás tu número de WhatsApp (con código de área, sin 0 ni 15) para que podamos escribirte si hace falta?'
  )
}

export function buildContactoContextPrompt(contacto: ContactoCliente): string {
  if (!contacto.completo) {
    return (
      'DATOS DE CONTACTO DEL VISITANTE: INCOMPLETOS. ' +
      'Debés pedir nombre y WhatsApp antes de cotizar, dar precios o avanzar con un pedido nuevo. ' +
      `Estado actual: nombre=${contacto.nombre || 'pendiente'}, WhatsApp=${contacto.telefono || 'pendiente'}.`
    )
  }
  return (
    `DATOS DE CONTACTO DEL VISITANTE (registrados): Nombre: ${contacto.nombre}. WhatsApp: ${contacto.telefono}. ` +
    'Ya no pidas estos datos salvo que el cliente quiera corregirlos.'
  )
}

export type HistorialMensajeChat = {
  role: string
  text: string
  whatsapp?: string
  contacto_nombre?: string
}

export function enrichUserHistorialEntry(
  text: string,
  parsed?: { nombre?: string; telefono?: string }
): HistorialMensajeChat {
  const entry: HistorialMensajeChat = { role: 'user', text: text.slice(0, 5000) }
  const par = parsed || extractNombreYTelefonoMensaje(text)
  if (par.telefono) entry.whatsapp = par.telefono
  if (par.nombre && esNombreValido(par.nombre)) entry.contacto_nombre = par.nombre
  else if (extractNombreExplicito(text)) entry.contacto_nombre = extractNombreExplicito(text) || undefined
  return entry
}

type MensajeHistorial = {
  role: string
  text: string
  contacto_nombre?: string | null
  whatsapp?: string | null
}

const NOMBRES_GENERICOS = new Set([
  'cliente web',
  'cliente desde chat',
  'cliente',
  'visitante',
  'usuario'
])

function esNombreValido(nombre: string | null | undefined): boolean {
  if (!nombre?.trim()) return false
  const n = nombre.trim()
  if (n.length < 2 || n.length > 80) return false
  if (NOMBRES_GENERICOS.has(n.toLowerCase())) return false
  if (/^cliente(\s|#)/i.test(n)) return false
  if (/^cliente portal #\d+$/i.test(n)) return false
  return true
}

function normalizarTelefonoAr(digitsRaw: string): string | null {
  let d = digitsRaw.replace(/\D/g, '')
  if (!d) return null
  if (d.startsWith('0')) d = d.slice(1)
  if (d.startsWith('54') && d.length > 10) d = d.slice(2)
  if (d.startsWith('9') && d.length === 11) d = d.slice(1)
  if (d.length < 8 || d.length > 12) return null
  return d
}

function extractTelefono(text: string): string | null {
  const m = text.match(/(?:\+?54[\s-]?)?(?:9[\s-]?)?\d[\d\s\-()]{6,}\d|\b\d{8,12}\b/)
  if (!m) return null
  return normalizarTelefonoAr(m[0])
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
      if (esNombreValido(n)) return n
    }
  }
  return null
}

function extractNombreConTelefono(text: string): string | null {
  const telefono = extractTelefono(text)
  if (!telefono) return null
  const phoneMatch = text.match(
    /(?:\+?54[\s-]?)?(?:9[\s-]?)?\d[\d\s\-()]{6,}\d|\b\d{8,12}\b/
  )
  if (!phoneMatch || phoneMatch.index == null) return null

  const antes = text.slice(0, phoneMatch.index).trim()
  const limpiar = (s: string) =>
    s
      .replace(/\b(me llamo|mi nombre es|nombre|soy|whatsapp|wsp|celular|tel[eé]fono)\b/gi, '')
      .replace(/[:,;.-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()

  const nombre = limpiar(antes)
  return esNombreValido(nombre) ? nombre : null
}

function nombreDesdeHistorial(historial?: MensajeHistorial[] | null): string | null {
  if (!historial?.length) return null

  for (let i = historial.length - 1; i >= 0; i--) {
    const m = historial[i]
    if (m.contacto_nombre && esNombreValido(m.contacto_nombre)) return m.contacto_nombre.trim()
  }

  for (let i = historial.length - 1; i >= 0; i--) {
    const m = historial[i]
    if (m.role !== 'user') continue
    const text = (m.text || '').trim()
    if (!text) continue
    const explicito = extractNombreExplicito(text)
    if (explicito) return explicito
    const conTel = extractNombreConTelefono(text)
    if (conTel) return conTel
  }

  return null
}

/** Nombre visible en listados y cabeceras de Atención al público. */
export function nombreClienteAtencionVisible(input: {
  cliente_nombre?: string | null
  cliente_email?: string | null
  historial_mensajes?: MensajeHistorial[] | null
}): string {
  if (esNombreValido(input.cliente_nombre)) return input.cliente_nombre!.trim()

  const desdeHistorial = nombreDesdeHistorial(input.historial_mensajes)
  if (desdeHistorial) return desdeHistorial

  const email = input.cliente_email?.trim()
  if (email) return email

  return 'Cliente web'
}

function telefonoDesdeHistorial(historial?: MensajeHistorial[] | null): string | null {
  if (!historial?.length) return null

  for (let i = historial.length - 1; i >= 0; i--) {
    const wa = historial[i].whatsapp
    if (wa) {
      const n = normalizarTelefonoAr(wa)
      if (n) return n
    }
  }

  for (let i = historial.length - 1; i >= 0; i--) {
    const m = historial[i]
    if (m.role !== 'user') continue
    const tel = extractTelefono((m.text || '').trim())
    if (tel) return tel
  }

  return null
}

/** Teléfono/WhatsApp visible: BD, historial del chat o nombre con número embebido. */
export function telefonoWhatsappAtencionVisible(input: {
  cliente_telefono?: string | null
  cliente_nombre?: string | null
  historial_mensajes?: MensajeHistorial[] | null
}): string | null {
  const fromDb = normalizarTelefonoAr(input.cliente_telefono || '')
  if (fromDb) return fromDb

  const desdeHistorial = telefonoDesdeHistorial(input.historial_mensajes)
  if (desdeHistorial) return desdeHistorial

  const desdeNombre = extractTelefono(input.cliente_nombre || '')
  if (desdeNombre) return desdeNombre

  return null
}

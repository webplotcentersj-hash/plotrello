import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { GoogleGenAI } from '@google/genai'

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  ''
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null

function getGeminiKey() {
  return process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || ''
}

const PLOT_CENTER_KNOWLEDGE = `
EMPRESA: Plot Center (PlotCenter)
Web: https://plotcenter.com.ar/

QUÉ SOMOS:
Somos expertos en comunicación visual. Brindamos soluciones gráficas integrales que potencian la comunicación visual de empresas y profesionales. Nos adaptamos a cada proyecto con creatividad, estrategia y excelencia profesional. Garantizamos resultados destacados y trabajamos con compromiso en cada etapa del proceso.

SERVICIOS:
- Impresión Digital: impresiones digitales de alta calidad para tarjetas, folletos, catálogos y más.
- Gráfica Integral: acompañamos cada proyecto desde la idea hasta la instalación final para maximizar la visibilidad.
- Vía Pública: cartelería de gran formato, concesión exclusiva en zonas estratégicas.
- Diseño Gráfico: identidades visuales consistentes y piezas promocionales con enfoque estratégico.
- Desarrollo Web: soluciones digitales e inteligencia artificial para potenciar negocios.
- Servicios Mineros: manuales de operación y seguridad, folletos y catálogos, talonarios de calidad y procesos, tarjetas de presentación y papelería corporativa.

CONTACTO:
- Dirección: 9 de Julio 622 (OESTE)
- Email: contacto@plotcenter.com.ar
- Teléfono: 2646212163
- Redes: Instagram, Facebook, LinkedIn (plotcenter)
- Newsletter y más info en https://plotcenter.com.ar/
`.trim()

type Body = {
  message?: string
  nombre?: string
  empresa?: string
  dni?: string
  cuit?: string
  op?: string
  telefono?: string
  conversation_id?: number
  history?: Array<{ role: 'user' | 'model'; parts: { text: string }[] }>
  images?: Array<{ mimeType: string; data: string }>
}

/** Normaliza número de OP: solo dígitos, sin espacios ni guiones. */
function normalizeOp(op: string): string {
  return (op || '').trim().replace(/\D/g, '')
}

/** Extrae número de OP del texto (ej. "op 123", "la orden 456", "número 789", "OP-100", "91830"). */
function extractOpFromText(text: string): string | null {
  const t = text.trim()
  const match = t.match(/\b(?:op|orden|numero|número|nro|#)\s*[:\-]?\s*(\d{2,8})\b/i)
  if (match) return match[1]
  const onlyNum = t.match(/^\s*(\d{2,8})\s*$/)
  if (onlyNum) return onlyNum[1]
  const digitsInText = t.replace(/\D/g, '')
  if (digitsInText.length >= 2 && digitsInText.length <= 8) return digitsInText
  return null
}

/** Extrae nombre, empresa, DNI o CUIT del texto del mensaje para identificar al cliente. */
function extractIdentificacionFromText(text: string): {
  nombre?: string
  empresa?: string
  dni?: string
  cuit?: string
} {
  const t = text.trim()
  if (!t) return {}

  const out: { nombre?: string; empresa?: string; dni?: string; cuit?: string } = {}

  // Empresa: "empresa X", "trabajo en X", "soy de (la empresa) X", "pertenezco a X", "la empresa es X"
  const empresaRe = /\b(?:empresa\s+(?:es\s+)?|trabajo\s+en\s+|soy\s+de\s+(?:la\s+empresa\s+)?|pertenezco\s+a\s+(?:la\s+)?|la\s+empresa\s+es\s+)([^.,;\n]+)/i
  const empresaMatch = t.match(empresaRe)
  if (empresaMatch) {
    const emp = empresaMatch[1].trim().replace(/\s+/g, ' ')
    if (emp.length > 1 && emp.length < 80) out.empresa = emp
  }
  if (!out.empresa && /\bempresa\s*:\s*([^.,;\n]+)/i.test(t)) {
    const m = t.match(/\bempresa\s*:\s*([^.,;\n]+)/i)
    if (m) {
      const emp = m[1].trim().replace(/\s+/g, ' ')
      if (emp.length > 1 && emp.length < 80) out.empresa = emp
    }
  }

  // Nombre: "me llamo X", "soy X", "mi nombre es X", "nombre: X" (evitar capturar "soy de...")
  const nameRe = /\b(?:me\s+llamo|mi\s+nombre\s+es|nombre\s*:)\s*([^.,;\n]+)/i
  const nameMatch = t.match(nameRe)
  if (nameMatch) {
    const name = nameMatch[1].trim().replace(/\s+/g, ' ')
    if (name.length > 1 && name.length < 80) out.nombre = name
  }
  if (!out.nombre && /\bsoy\s+([^.,;\n]+)/i.test(t) && !/\bsoy\s+de\s+/i.test(t)) {
    const m = t.match(/\bsoy\s+([^.,;\n]+)/i)
    if (m) {
      const name = m[1].trim().replace(/\s+/g, ' ')
      if (name.length > 1 && name.length < 80) out.nombre = name
    }
  }

  // DNI: "DNI 12345678", "mi DNI es 123", "dni: 123"
  const dniRe = /\b(?:dni|documento)\s*:?\s*(\d[\d.\s-]*\d|\d{7,8})/gi
  const dniMatch = dniRe.exec(t)
  if (dniMatch) {
    const num = dniMatch[1].replace(/\D/g, '')
    if (num.length >= 7) out.dni = num
  }

  // CUIT: "CUIT 20-12345678-9", "mi CUIT es 20123456789", "cuit: 20-12345678-9"
  const cuitRe = /\b(?:cuit|cui)\s*:?\s*(\d[\d.\s-]*\d)/gi
  const cuitMatch = cuitRe.exec(t)
  if (cuitMatch) {
    const num = cuitMatch[1].replace(/\D/g, '')
    if (num.length >= 10) out.cuit = num
  }

  return out
}

const digitsOnly = (s: string) => String(s ?? '').replace(/\D/g, '')

/** Extrae un teléfono del texto (acepta formatos con +, espacios, guiones). */
function extractTelefonoFromText(text: string): string | null {
  const t = (text || '').trim()
  if (!t) return null

  // Si el usuario lo declara explícitamente
  const explicit = t.match(/\b(?:tel[eé]fono|telefono|cel|celular|whatsapp|wsp|wp)\s*[:\-]?\s*(\+?\d[\d\s().-]{6,}\d)\b/i)
  const candidate = explicit?.[1] || null
  const raw = candidate || t

  // Buscar un bloque de números suficientemente largo
  const m = raw.match(/(\+?\d[\d\s().-]{6,}\d)/)
  if (!m) return null

  const digits = m[1].replace(/\D/g, '')
  if (digits.length < 7 || digits.length > 15) return null
  return digits
}

/** Detecta si el mensaje del cliente pide explícitamente que le mandemos un formulario/brief. */
function detectBriefIntent(text: string): boolean {
  const t = (text || '').toLowerCase()
  if (!t.trim()) return false
  // Pedidos explícitos de formulario/enlace de brief
  if (/(enviame|envíame|mandame|pasame|pasar|enviar|enviarlo|link|enlace|formulario|form)\s*(de)?\s*(brief|presupuesto|proyecto)?/.test(t)) {
    return true
  }
  if (/(brief|formulario)\s*(para|del)?\s*(proyecto|trabajo|pedido)?\s*(por favor|pf|pls)?/.test(t)) {
    return true
  }
  return false
}

/** Construye la URL base del sitio (para armar links públicos) usando headers de la request o una variable de entorno. */
function buildBaseUrl(req: VercelRequest): string {
  const envBase = process.env.BRIEF_BASE_URL
  if (envBase && envBase.trim()) {
    return envBase.replace(/\/+$/, '')
  }
  const proto = (req.headers['x-forwarded-proto'] as string) || 'https'
  const host = (req.headers['x-forwarded-host'] as string) || req.headers.host || ''
  if (!host) return ''
  return `${proto}://${host}`
}

/** Columnas de ubicación/etapa en ordenes_trabajo (lectura explícita para no depender de nombres mágicos). */
const ORDEN_UBICACION_SELECT =
  'numero_op, cliente, dni_cuit, descripcion, estado, prioridad, fecha_entrega, fecha_creacion, telefono_cliente, email_cliente, sector, ubicacion_final, etapa_taller_grafico, etapa_impresion_digital, etapa_taller_imprenta, etapa_instalaciones, etapa_metalurgica'

/** Arma el texto "dónde está" a partir de las columnas de ubicación de una orden. */
function buildDondeEsta(o: Record<string, unknown>): string {
  const estado = (o.estado != null && String(o.estado).trim()) ? String(o.estado).trim() : null
  const sector = (o.sector != null && String(o.sector).trim()) ? String(o.sector).trim() : null
  const ubicacionFinal = (o.ubicacion_final != null && String(o.ubicacion_final).trim()) ? String(o.ubicacion_final).trim() : null
  const etapaTg = (o.etapa_taller_grafico != null && String(o.etapa_taller_grafico).trim()) ? String(o.etapa_taller_grafico).trim() : null
  const etapaImp = (o.etapa_impresion_digital != null && String(o.etapa_impresion_digital).trim()) ? String(o.etapa_impresion_digital).trim() : null
  const etapaTi = (o.etapa_taller_imprenta != null && String(o.etapa_taller_imprenta).trim()) ? String(o.etapa_taller_imprenta).trim() : null
  const etapaInst = (o.etapa_instalaciones != null && String(o.etapa_instalaciones).trim()) ? String(o.etapa_instalaciones).trim() : null
  const etapaMet = (o.etapa_metalurgica != null && String(o.etapa_metalurgica).trim()) ? String(o.etapa_metalurgica).trim() : null

  const partes: string[] = []
  if (estado) partes.push(`Estado: ${estado}`)
  if (sector) partes.push(`Sector: ${sector}`)
  if (ubicacionFinal) partes.push(`Lugar: ${ubicacionFinal}`)
  if (etapaTg) partes.push(`Etapa (Taller Gráfico): ${etapaTg}`)
  if (etapaImp) partes.push(`Etapa (Impresión): ${etapaImp}`)
  if (etapaTi) partes.push(`Etapa (Taller Imprenta): ${etapaTi}`)
  if (etapaInst) partes.push(`Etapa (Instalaciones): ${etapaInst}`)
  if (etapaMet) partes.push(`Etapa (Metalúrgica): ${etapaMet}`)

  if (partes.length === 0) return 'Sin datos de ubicación.'
  return partes.join('. ')
}

const LISTO_RETIRO_ESTADOS = ['Finalizado en Taller', 'Almacén de Entrega', 'Almacén de entrega', 'Mostrador', 'Caja']

/** Busca una orden por número de OP y arma contexto. Prueba coincidencia exacta y parcial por dígitos. */
async function getContextByOp(
  numeroOp: string
): Promise<{ clientContext: string; ordersContext: string }> {
  if (!supabase) return { clientContext: '', ordersContext: '' }
  const opNorm = normalizeOp(numeroOp)
  if (!opNorm) return { clientContext: '', ordersContext: '' }

  const digitsOnly = (s: string) => String(s ?? '').replace(/\D/g, '')

  // Buscar por número de OP (coincidencia por dígitos: "91830", "OP-91830", etc.)
  const { data: ordenesList, error } = await supabase
    .from('ordenes_trabajo')
    .select(ORDEN_UBICACION_SELECT)
    .ilike('numero_op', `%${opNorm}%`)
    .limit(15)

  const list = (ordenesList || []) as Array<Record<string, unknown>>
  const orden = list.find((o) => digitsOnly(String(o.numero_op ?? '')) === opNorm) || list[0] || null

  if (error || !orden) {
    return {
      clientContext: `El visitante consulta por la OP ${numeroOp}. No se encontró ninguna orden de trabajo con ese número. Podés sugerirle que verifique el número o que se contacte con Plot Center por teléfono o WhatsApp al 2646212163, o por email a contacto@plotcenter.com.ar.`,
      ordersContext: ''
    }
  }

  const o = orden as Record<string, unknown>
  const estado = (o.estado != null && String(o.estado).trim()) ? String(o.estado).trim() : '—'
  const dondeEsta = buildDondeEsta(o)
  const listoRetiro = LISTO_RETIRO_ESTADOS.includes(estado)
  const clientContext =
    `CLIENTE DE LA OP: ${o.cliente ?? '—'}. DNI/CUIT: ${o.dni_cuit ?? '—'}. Tel: ${o.telefono_cliente ?? '—'}. Email: ${o.email_cliente ?? '—'}.`
  const ordersContext =
    'INFORMACIÓN DE LA OP CONSULTADA (en tiempo real):\n' +
    `- OP ${o.numero_op ?? '—'}: ${o.descripcion ?? 'Sin descripción'} | Estado: ${estado} | Prioridad: ${o.prioridad ?? '—'} | Fecha entrega: ${o.fecha_entrega ?? '—'}\n` +
    `  Dónde está: ${dondeEsta}` +
    (listoRetiro ? '\n  LISTO PARA RETIRO: esta OP ya puede ser retirada. Avisale al cliente que puede pasar a buscarla.' : '')

  return { clientContext, ordersContext }
}

/** Detecta si el cliente pide hablar con un humano o con un sector. Devuelve rol (para notificación) y etiqueta para el mensaje. */
function detectSolicitudAtencionHumano(text: string): {
  solicita: boolean
  rol: string | null
  sectorLabel: string
} {
  const t = text.trim().toLowerCase()
  if (!t) return { solicita: false, rol: null, sectorLabel: '' }

  const sectorKeywords: Array<{ keys: string[]; rol: string; label: string }> = [
    { keys: ['diseño', 'diseno', 'diseñador', 'diseñadora', 'grafica', 'gráfica'], rol: 'diseno', label: 'Diseño Gráfico' },
    { keys: ['mostrador', 'atención al público', 'atencion al publico', 'ventas'], rol: 'mostrador', label: 'Mostrador' },
    { keys: ['imprenta', 'impresión', 'impresion'], rol: 'imprenta', label: 'Imprenta' },
    { keys: ['taller gráfico', 'taller grafico', 'acabados', 'montaje'], rol: 'taller-grafico', label: 'Taller Gráfico' },
    { keys: ['caja', 'cobro', 'pago'], rol: 'caja', label: 'Caja' },
    { keys: ['instalacion', 'instalaciones', 'instalador'], rol: 'instalaciones', label: 'Instalaciones' },
    { keys: ['compras', 'insumos'], rol: 'compras', label: 'Compras' },
    { keys: ['administración', 'administracion', 'gerencia'], rol: 'administracion', label: 'Administración' }
  ]

  for (const s of sectorKeywords) {
    if (s.keys.some((k) => t.includes(k))) {
      if (
        /\b(?:hablar|hablar con|quiero|necesito|me comunico|contactar|que me llamen|llamen|atender|atención|atencion)\b/.test(t) ||
        /\b(?:humano|persona|alguien|alguien de|un responsable)\b/.test(t)
      ) {
        return { solicita: true, rol: s.rol, sectorLabel: s.label }
      }
    }
  }

  if (
    /\b(?:hablar con (?:un |una )?(?:humano|persona|alguien|operador|asesor)|quiero (?:hablar|que me llamen)|necesito (?:hablar|que me atiendan|hablar con alguien)|me (?:pueden |podés )?(?:llamar|contactar)|atención humana|atencion humana)\b/i.test(t)
  ) {
    return { solicita: true, rol: 'mostrador', sectorLabel: 'Mostrador (atención al cliente)' }
  }

  return { solicita: false, rol: null, sectorLabel: '' }
}

async function findClientAndOrders(
  nombre?: string,
  dni?: string,
  cuit?: string,
  empresa?: string,
  telefono?: string
): Promise<{ clientContext: string; ordersContext: string }> {
  if (!supabase) {
    return { clientContext: '', ordersContext: '' }
  }

  const trim = (s?: string) => (s && typeof s === 'string' ? s.trim() : '')
  const n = trim(nombre)
  const e = trim(empresa)
  const d = trim(dni)
  const c = trim(cuit)
  const t = trim(telefono)
  const hasAny = n || e || d || c || t
  if (!hasAny) {
    return {
      clientContext: 'El visitante aún no dio nombre, empresa, DNI ni CUIT. Solo cuando pregunte por su trabajo u orden pedile: "¿Me decís tu nombre, DNI, CUIT o número de OP para buscarlo?"',
      ordersContext: ''
    }
  }

  let clientRow: Record<string, unknown> | null = null
  const dDigits = digitsOnly(d)
  const cDigits = digitsOnly(c)
  const tDigits = digitsOnly(t)
  const docDigits = dDigits.length >= 7 ? dDigits : cDigits.length >= 10 ? cDigits : ''

  // 1) Búsqueda por DNI/CUIT (normalizado: solo dígitos; DNI 7-8, CUIT 10-11)
  if (d || c) {
    const doc = (d || c).trim()
    const num = digitsOnly(doc)
    if (num.length >= 6) {
      const { data: byDoc } = await supabase
        .from('clientes')
        .select('*')
        .ilike('dni_cuit', `%${num}%`)
        .limit(10)
      const rows = (byDoc || []) as Record<string, unknown>[]
      const match = rows.find((r) => digitsOnly(String(r.dni_cuit || '')) === num) || rows[0]
      if (match) clientRow = match
    }
    if (!clientRow && doc.replace(/\D/g, '').length >= 4) {
      const safe = doc.replace(/%/g, '')
      const { data: byDoc2 } = await supabase
        .from('clientes')
        .select('*')
        .ilike('dni_cuit', `%${safe}%`)
        .limit(5)
      const rows = (byDoc2 || []) as Record<string, unknown>[]
      const numOnly = digitsOnly(doc)
      const match = rows.find((r) => digitsOnly(String(r.dni_cuit || '')) === numOnly) || rows[0]
      if (match) clientRow = match
    }
  }
  // 2) Búsqueda por teléfono
  if (!clientRow && tDigits.length >= 6) {
    const { data: byTel } = await supabase
      .from('clientes')
      .select('*')
      .ilike('telefono', `%${tDigits}%`)
      .limit(10)
    const rows = (byTel || []) as Record<string, unknown>[]
    const match = rows.find((r) => digitsOnly(String(r.telefono || '')) === tDigits) || rows[0]
    if (match) clientRow = match
  }
  // 3) Búsqueda por empresa
  if (!clientRow && e && e.length >= 2) {
    const empresaSafe = e.replace(/%/g, '')
    const { data: byEmpresa } = await supabase
      .from('clientes')
      .select('*')
      .ilike('empresa', `%${empresaSafe}%`)
      .limit(15)
    const rows = (byEmpresa || []) as Record<string, unknown>[]
    const eLower = e.toLowerCase()
    const match = rows.find((r) => String(r.empresa || '').toLowerCase().includes(eLower)) || rows[0]
    if (match) clientRow = match
  }
  // 4) Búsqueda por nombre (nombre, apellido o nombre completo en empresa)
  if (!clientRow && n && n.length >= 2) {
    const parts = n.split(/\s+/).filter(Boolean)
    const firstPart = (parts[0] || n).replace(/%/g, '')
    const allPartsSafe = n.replace(/%/g, ' ')
    const { data: byName } = await supabase
      .from('clientes')
      .select('*')
      .or(`nombre.ilike.%${firstPart}%,apellido.ilike.%${firstPart}%,empresa.ilike.%${allPartsSafe}%`)
      .limit(20)
    const rows = (byName || []) as Record<string, unknown>[]
    const nLower = n.toLowerCase()
    const fullMatch = rows.find(
      (r) =>
        `${String(r.nombre || '')} ${String(r.apellido || '')}`.toLowerCase().includes(nLower) ||
        `${String(r.apellido || '')} ${String(r.nombre || '')}`.toLowerCase().includes(nLower) ||
        String(r.empresa || '').toLowerCase().includes(nLower)
    )
    clientRow = fullMatch || rows[0] || null
  }

  const clientContext = clientRow
    ? `CLIENTE IDENTIFICADO: ${[clientRow.nombre, clientRow.apellido, clientRow.empresa].filter(Boolean).join(' ')}. DNI/CUIT: ${clientRow.dni_cuit || '—'}. Tel: ${clientRow.telefono || '—'}. Email: ${clientRow.email || '—'}.`
    : 'No se encontró un cliente con ese nombre, DNI/CUIT, teléfono o empresa. Podés decirle que no vemos sus datos todavía y ofrecerle seguir por este chat o, si prefiere, por teléfono/WhatsApp (2646212163) o email (contacto@plotcenter.com.ar).'

  const clienteNombre = clientRow
    ? [clientRow.nombre, clientRow.apellido].filter(Boolean).join(' ').trim() || String(clientRow.empresa || '')
    : ''
  const clienteDoc = clientRow ? String(clientRow.dni_cuit || '') : (d || c)
  const docNorm = digitsOnly(clienteDoc)
  const telNorm = tDigits
  const nombreParaOrdenes = (n || clienteNombre).toLowerCase().trim()

  // Órdenes: buscar por cliente en BD y/o filtrar en memoria; si hay DNI/CUIT o nombre, también buscar directo en ordenes_trabajo
  let ordersContext = ''
  const { data: ordenes } = await supabase
    .from('ordenes_trabajo')
    .select(ORDEN_UBICACION_SELECT)
    .order('fecha_creacion', { ascending: false })
    .limit(80)

  const list = (ordenes || []) as Array<Record<string, unknown>>
  const filtered: Array<Record<string, unknown>> = []

  for (const o of list) {
    const oDoc = digitsOnly(String(o.dni_cuit ?? ''))
    const oTel = digitsOnly(String(o.telefono_cliente ?? ''))
    const oCliente = String(o.cliente ?? '').toLowerCase().trim()
    const matchDoc = docNorm.length >= 6 && oDoc.length >= 6 && oDoc === docNorm
    const matchTel = telNorm.length >= 6 && oTel.length >= 6 && oTel === telNorm
    const matchNombre =
      nombreParaOrdenes.length >= 2 &&
      (oCliente.includes(nombreParaOrdenes) ||
        nombreParaOrdenes.split(/\s+/).filter(Boolean).every((p) => p.length >= 2 && oCliente.includes(p)))
    if (matchDoc || matchTel || matchNombre) filtered.push(o)
  }

  if (filtered.length > 0) {
    ordersContext =
      'ESTADO DE TRABAJOS DEL CLIENTE (en tiempo real, órdenes recientes):\n' +
      filtered
        .slice(0, 15)
        .map((o) => {
          const est = (o.estado != null && String(o.estado).trim()) ? String(o.estado).trim() : '—'
          const donde = buildDondeEsta(o)
          const retiro = LISTO_RETIRO_ESTADOS.includes(est) ? ' LISTO PARA RETIRO: puede pasar a buscarla.' : ''
          return `- OP ${o.numero_op ?? '—'}: ${o.descripcion ?? 'Sin descripción'} | Estado: ${est} | Prioridad: ${o.prioridad ?? '—'} | Fecha entrega: ${o.fecha_entrega ?? '—'}\n  Dónde está: ${donde}.${retiro}`
        })
        .join('\n')
  } else {
    ordersContext =
      'El cliente no tiene órdenes de trabajo registradas recientes con ese nombre o DNI/CUIT. Podés ofrecerle que se comunique por teléfono o email para confirmar.'
  }

  return { clientContext, ordersContext }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const apiKey = getGeminiKey()
  if (!apiKey) {
    res.status(500).json({ error: 'GEMINI_API_KEY no configurada en el servidor.' })
    return
  }

  const body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) as Body
  const message = (body?.message || '').trim()
  const images = Array.isArray(body.images) ? body.images : []
  const hasImages = images.length > 0
  if (!message && !hasImages) {
    res.status(400).json({ error: 'message o images es requerido' })
    return
  }

  try {
    const history = Array.isArray(body.history) ? body.history : []
    const allUserTexts = [
      ...history.filter((p) => p.role === 'user').map((p) => (p.parts?.[0]?.text ?? '')),
      message
    ]
    const extracted = allUserTexts.reduce(
      (acc, txt) => {
        const e = extractIdentificacionFromText(txt)
        if (e.nombre) acc.nombre = e.nombre
        if (e.empresa) acc.empresa = e.empresa
        if (e.dni) acc.dni = e.dni
        if (e.cuit) acc.cuit = e.cuit
        const tel = extractTelefonoFromText(txt)
        if (tel) acc.telefono = tel
        return acc
      },
      {} as { nombre?: string; empresa?: string; dni?: string; cuit?: string; telefono?: string }
    )
    const nombre = (body.nombre && body.nombre.trim()) || extracted.nombre
    const empresa = (body.empresa && body.empresa.trim()) || extracted.empresa
    const telefono = (body.telefono && body.telefono.trim()) || extracted.telefono
    const dniRaw = (body.dni && body.dni.trim()) || extracted.dni
    const cuitRaw = (body.cuit && body.cuit.trim()) || extracted.cuit
    const dni = dniRaw ? digitsOnly(dniRaw).length >= 7 ? digitsOnly(dniRaw) : dniRaw.trim() : undefined
    const cuit = cuitRaw ? digitsOnly(cuitRaw).length >= 10 ? digitsOnly(cuitRaw) : cuitRaw.trim() : undefined
    const opFromBody = body.op && body.op.trim() ? normalizeOp(body.op) : null
    const opFromMsg = allUserTexts.map(extractOpFromText).find(Boolean)
    const numeroOp = (opFromBody && opFromBody.length >= 2) ? opFromBody : (opFromMsg || null)

    // Pedir nombre+teléfono en el 2º o 3º mensaje del cliente (si todavía no los tenemos).
    // Consideramos que un envío de imagen cuenta como mensaje.
    const userMsgCount = history.filter((p) => p.role === 'user').length + (message ? 1 : 0) + (hasImages && !message ? 1 : 0)
    const alreadyAskedContact = history.some(
      (p) =>
        p.role === 'model' &&
        typeof p.parts?.[0]?.text === 'string' &&
        p.parts[0].text.includes('¿me pasás tu nombre y un teléfono de contacto?')
    )
    const shouldAskContact =
      !alreadyAskedContact &&
      (userMsgCount === 2 || userMsgCount === 3) &&
      (!nombre || !telefono)

    let clientContext: string
    let ordersContext: string
    if (numeroOp) {
      const byOp = await getContextByOp(numeroOp)
      clientContext = byOp.clientContext
      ordersContext = byOp.ordersContext
    } else {
      const byClient = await findClientAndOrders(nombre, dni, cuit, empresa, telefono)
      clientContext = byClient.clientContext
      ordersContext = byClient.ordersContext
    }

    const solicitudAtencion = detectSolicitudAtencionHumano(message)
    let notificacionEnviada = false
    let solicitudChatId: number | null = null
    const historialParaSolicitud = [
      ...history.map((p) => ({ role: p.role, text: (p.parts?.[0]?.text ?? '').slice(0, 2000) })),
      { role: 'user' as const, text: message.slice(0, 2000) }
    ]
    if (solicitudAtencion.solicita && solicitudAtencion.rol && supabase) {
      const clienteNombre = nombre || 'Cliente desde chat'
      try {
        const convIdForSolicitud = body.conversation_id && Number.isInteger(Number(body.conversation_id)) ? Number(body.conversation_id) : null
        const { data: solicitudRow, error: insertErr } = await supabase
          .from('solicitudes_atencion_chat')
          .insert({
            cliente_nombre: clienteNombre,
            sector_solicitado: solicitudAtencion.sectorLabel,
            rol_solicitado: solicitudAtencion.rol,
            mensaje_cliente: message.slice(0, 500),
            estado: 'pendiente',
            historial_mensajes: historialParaSolicitud,
            atencion_conversacion_id: convIdForSolicitud
          })
          .select('id')
          .single()

        if (insertErr || !solicitudRow?.id) throw insertErr || new Error('No id')

        const tituloEspecial = '💬 Un cliente quiere hablar con tu sector'
        const mensajeCorto = message.slice(0, 180) + (message.length > 180 ? '...' : '')
        const descripcionEspecial =
          `${clienteNombre} solicitó hablar con ${solicitudAtencion.sectorLabel} desde el chat de la web.\n\nMensaje: "${mensajeCorto}"\n\nAbrí esta notificación para ver la conversación y responder.`

        const { data: usuariosRol } = await supabase
          .from('usuarios')
          .select('id')
          .eq('rol', solicitudAtencion.rol)

        if (usuariosRol && usuariosRol.length > 0) {
          for (const u of usuariosRol) {
            await supabase.from('user_notifications').insert({
              user_id: u.id,
              title: tituloEspecial,
              description: descripcionEspecial,
              type: 'mention',
              is_read: false,
              solicitud_chat_id: solicitudRow.id
            })
          }
          notificacionEnviada = true
          solicitudChatId = solicitudRow.id
        }
      } catch (e) {
        console.error('Error registrando/notificando solicitud de atención:', e)
      }
    }

    const notaSolicitud =
      notificacionEnviada
        ? `\n\nNOTA IMPORTANTE: El cliente acaba de pedir hablar con ${solicitudAtencion.sectorLabel}. Ya se envió la notificación al sector. En tu respuesta debés confirmarle que recibimos su pedido y que alguien del sector lo va a contactar a la brevedad.`
        : ''

    const STAFF_ATTENDING_MSG = 'Un integrante del equipo ya te está atendiendo. Tu mensaje fue enviado; te responderán a la brevedad.'
    let replyText: string = ''
    let skipGemini = false
    if (body.conversation_id && Number.isInteger(Number(body.conversation_id)) && supabase) {
      const { data: convRow } = await supabase
        .from('atencion_conversaciones')
        .select('respuestas_staff, historial_mensajes')
        .eq('id', Number(body.conversation_id))
        .single()
      const staffReplies = Array.isArray((convRow as any)?.respuestas_staff) ? (convRow as any).respuestas_staff : []
      if (staffReplies.length > 0) {
        skipGemini = true
        const hist: Array<{ role: string; text: string }> = Array.isArray((convRow as any)?.historial_mensajes) ? (convRow as any).historial_mensajes : []
        const yaDijoAtendiendo = hist.some((h) => h.role === 'model' && (h.text || '').trim() === STAFF_ATTENDING_MSG.trim())
        replyText = yaDijoAtendiendo ? '' : STAFF_ATTENDING_MSG
      }
    }

    // Si no hay un humano atendiendo todavía, detectar si el cliente quiere iniciar un proyecto nuevo
    // y ofrecerle directamente el formulario de brief para que lo complete.
    let briefToken: string | null = null
    let briefUrl: string | null = null
    if (!skipGemini && supabase && !numeroOp && detectBriefIntent(message)) {
      try {
        const { data: token, error: rpcError } = await supabase.rpc('crear_brief_publico', {
          p_creado_por: null
        })
        if (!rpcError && token) {
          briefToken = typeof token === 'string' ? token : String(token)
          const baseUrl = buildBaseUrl(req)
          if (baseUrl) {
            briefUrl = `${baseUrl.replace(/\/+$/, '')}/brief/${briefToken}`
          }

          // Guardar nombre/empresa si los tenemos, para que en el dashboard se vea quién es el cliente.
          try {
            if (nombre || empresa) {
              await supabase
                .from('briefs_publicos')
                .update({
                  cliente_nombre_completo: nombre || null,
                  cliente_empresa: empresa || null
                })
                .eq('token', briefToken)
            }
          } catch (e) {
            console.warn('No se pudo actualizar datos del brief recién creado:', e)
          }

          const linkTexto = briefUrl || `formulario de brief (token: ${briefToken})`
          replyText =
            `¡Genial! Para poder ayudarte bien con tu proyecto, necesito que completes un formulario de brief con los detalles.\n\n` +
            `Ingresá a este enlace y completalo tranquilo:\n\n${linkTexto}\n\n` +
            `Ahí te vamos a pedir objetivo, medidas, textos, estilo de diseño y todo lo importante. ` +
            `Una vez que lo completes, nuestro equipo lo recibe y te contacta para seguir con tu pedido.`
          skipGemini = true
        }
      } catch (e) {
        console.error('Error creando brief desde el chat:', e)
      }
    }

    if (!skipGemini) {
      if (shouldAskContact) {
        const thanksImg = hasImages ? '¡Gracias por la imagen! ' : ''
        replyText =
          `${thanksImg}Antes de seguir, ¿me pasás tu nombre y un teléfono de contacto? ` +
          `Ejemplo: "Juan Pérez, 2644xxxxxx".`
        skipGemini = true
      }
    }

    if (!skipGemini) {
    const systemPrompt = `Eres el asistente virtual de Plot Center, experto en atención al cliente. Tu objetivo es que cada persona se sienta bien atendida: escuchada, con respuestas claras y con un trato cercano y profesional.${notaSolicitud}

REGLA CRÍTICA — NO ALUCINAR (obligatorio):
- Solo podés usar información que aparezca EXPLÍCITAMENTE en las secciones "CONOCIMIENTO DE LA EMPRESA" y "CLIENTE CON QUIEN ESTÁS HABLANDO" más abajo.
- NUNCA inventes: números de OP, fechas de entrega, estados de órdenes, precios, nombres de clientes, teléfonos, emails, direcciones ni ningún otro dato.
- Si el contexto dice "No se encontró" o "no tiene órdenes" o "no hay coincidencias", decilo tal cual; no digas que sí hay datos.
- Si no tenés un dato (ej. precio, fecha, estado), no lo inventes: decí que no lo tenés y podés ofrecer que un humano del equipo siga la conversación (por este chat, por teléfono/WhatsApp al 2646212163 o por email a contacto@plotcenter.com.ar).
- Muy importante: NO repitas el teléfono y el mail en todas las respuestas. Úsalos como opción de contacto solo cuando realmente haga falta (por ejemplo, si no podés resolver algo por chat o el cliente pide explícitamente otra vía) y, como máximo, una vez cada varias respuestas en la misma conversación.
- Para datos de Plot Center (dirección, teléfono, servicios) usá ÚNICAMENTE lo que está en CONOCIMIENTO DE LA EMPRESA.

IDIOMA Y TONO:
- Responde SIEMPRE en español (argentino): podés usar "vos", "tu trabajo", "te cuento", "cualquier cosa escribinos".
- Sé cálido y humano: agradecé, usá "por favor" cuando corresponda, mostrá que te importa resolver la consulta.
- Adaptá el tono al cliente: si hace una pregunta corta, respondé concreto; si cuenta un problema o inquietud, mostrá empatía antes de dar la solución.
- Si el contexto te da el nombre del cliente, usalo; si no, no inventes nombres.

CONOCIMIENTO DE LA EMPRESA (solo esta info es válida para datos de Plot Center):
${PLOT_CENTER_KNOWLEDGE}

CLIENTE CON QUIEN ESTÁS HABLANDO (solo esta info es válida para OPs, estados y datos del cliente):
${clientContext}
${ordersContext ? '\n' + ordersContext : ''}

CÓMO TRATAR AL CLIENTE (atención al público):
- Saludo y atención general: respondé con buena onda a cualquier consulta (horarios, servicios, contacto, ubicación). No pidas datos al inicio; solo ayudá con lo que pregunten.
- Solo cuando pregunte por SU trabajo u orden, pedile: "Para buscar tu trabajo necesito que me indiques tu nombre, DNI, CUIT o número de OP." Con uno alcanza.
- Para OPs y trabajos: citá SOLO los números, estados y fechas que aparecen en "CLIENTE CON QUIEN ESTÁS HABLANDO". Si ahí dice que no se encontró la OP o que no hay órdenes, decilo sin inventar nada.
- UBICACIÓN EN TIEMPO REAL: en el contexto figura "Dónde está" para cada OP. Decile al cliente dónde está su trabajo (ej. "Tu OP 12345 está en Taller Gráfico", "está en Almacén de Entrega").
- LISTO PARA RETIRO: cuando en el contexto diga "LISTO PARA RETIRO" para una OP, avisale claramente que ya puede pasar a retirarla (ej. "Tu pedido ya está listo, podés pasar a retirarlo por 9 de Julio 622 (Oeste)" o "Ya está en Almacén de Entrega, cuando quieras podés venir a buscarlo").
- NUNCA escribas placeholders como "[Aquí iría...]" ni relleno. Si tenés el dato, decilo; si no, decí que no lo tenés y ofrecé que un humano del equipo puede ayudarte (por este chat o, si el cliente lo pide, por teléfono/WhatsApp al 2646212163 o email contacto@plotcenter.com.ar). No vuelvas a repetir el mismo párrafo de contacto en cada mensaje.
- Resumí cuando haya muchas OPs. Cerrando: "¿Necesitás algo más?" o "Cualquier cosa, estamos acá."`

    const ai = new GoogleGenAI({ apiKey })

    let conversation = systemPrompt + '\n\n---\n\n'
    for (const p of history.slice(-10)) {
      const role = p.role === 'user' ? 'Usuario' : 'Asistente'
      const text = (p.parts && p.parts[0]?.text) || ''
      conversation += `${role}: ${text}\n\n`
    }
    conversation += `Usuario: ${message || (hasImages ? '[Imagen adjunta]' : '')}\n\n`
    if (hasImages) {
      conversation += `INSTRUCCIÓN EXTRA: El usuario adjuntó una o más imágenes. Interpretalas con cuidado y respondé en español. Si te falta información, preguntá.\n\n`
    }
    conversation += `Asistente:`

    const safeImages = images
      .filter((img) => img && typeof img.mimeType === 'string' && typeof img.data === 'string')
      .slice(0, 2)
      .filter((img) => /^image\//.test(img.mimeType))
      .filter((img) => img.data.length > 0 && img.data.length < 2_500_000)
    const imageDataUrlForHist =
      safeImages[0] ? `data:${safeImages[0].mimeType};base64,${safeImages[0].data}` : null

    const response = safeImages.length > 0
      ? await ai.models.generateContent({
          model: 'gemini-2.0-flash',
          contents: [
            {
              role: 'user',
              parts: [
                { text: conversation },
                ...safeImages.map((img) => ({
                  inlineData: { mimeType: img.mimeType, data: img.data }
                }))
              ]
            }
          ]
        } as any)
      : await ai.models.generateContent({
          model: 'gemini-2.0-flash',
          contents: conversation
        })

    const text = (response as any)?.text ?? ''
    replyText = text || 'No pude generar una respuesta. Por favor, intentá de nuevo o contactanos por teléfono o email.'
    }

    let conversationId: number | null = null
    const clienteNombreConv = nombre || 'Cliente web'
    if (supabase) {
      try {
        const hasId = body.conversation_id && Number.isInteger(Number(body.conversation_id))
        let existingHist: Array<{ role: string; text: string; imageDataUrl?: string }> | null = null
        let existingId: number | null = null

        if (hasId) {
          const idConv = Number(body.conversation_id)
          const { data: conv, error: selectErr } = await supabase
            .from('atencion_conversaciones')
            .select('id, historial_mensajes')
            .eq('id', idConv)
            .single()
          if (!selectErr && conv) {
            existingId = idConv
            existingHist = Array.isArray((conv as any)?.historial_mensajes)
              ? (conv as any).historial_mensajes
              : []
          } else if (selectErr) {
            console.warn('No se encontró conversación existente, se creará una nueva:', selectErr.message)
          }

        }

        if (existingId != null && existingHist) {
          // Actualizar conversación existente
          const userTextForHist = message ? message.slice(0, 5000) : (hasImages ? '[Imagen adjunta]' : '')
          const userEntry: any = { role: 'user', text: userTextForHist }
          if (imageDataUrlForHist) userEntry.imageDataUrl = imageDataUrlForHist
          const updated = replyText
            ? [...existingHist, userEntry, { role: 'model', text: replyText.slice(0, 5000) }]
            : [...existingHist, userEntry]
          const contactName = nombre || (empresa ? `Cliente (${empresa})` : null)
          const updatePayload: Record<string, unknown> = {
            historial_mensajes: updated,
            ultimo_mensaje_preview: message.slice(0, 200),
            updated_at: new Date().toISOString()
          }
          if (contactName) updatePayload.cliente_nombre = contactName
          if (telefono) updatePayload.cliente_telefono = telefono
          const { error: updateErr } = await supabase
            .from('atencion_conversaciones')
            .update(updatePayload as any)
            .eq('id', existingId)
          if (updateErr) console.error('Error actualizando conversación:', updateErr)
          conversationId = existingId
        } else {
          // Crear una nueva conversación (aunque el cliente haya mandado un conversation_id inválido)
          const { data: newConv, error: insertErr } = await supabase
            .from('atencion_conversaciones')
            .insert({
              cliente_nombre: nombre || clienteNombreConv,
              cliente_telefono: telefono || null,
              canal: 'chat_web',
              ultimo_mensaje_preview: message.slice(0, 200),
              estado: 'abierto',
              historial_mensajes: [
                {
                  role: 'user',
                  text: message ? message.slice(0, 5000) : (hasImages ? '[Imagen adjunta]' : ''),
                  ...(imageDataUrlForHist ? { imageDataUrl: imageDataUrlForHist } : {})
                },
                { role: 'model', text: replyText.slice(0, 5000) }
              ]
            })
            .select('id')
            .single()
          if (insertErr) console.error('Error creando conversación:', insertErr)
          if ((newConv as any)?.id) conversationId = (newConv as any).id
        }
      } catch (e) {
        console.error('Error guardando conversación:', e)
      }
    }

    res.status(200).json({
      success: true,
      reply: replyText,
      ...(conversationId != null && { conversation_id: conversationId }),
      ...(solicitudChatId != null && { solicitud_id: solicitudChatId }),
      ...(briefToken && {
        brief: {
          token: briefToken,
          ...(briefUrl ? { url: briefUrl } : {})
        }
      })
    })
  } catch (error: any) {
    console.error('Error en chat-public:', error)
    res.status(500).json({
      success: false,
      error: error?.message || 'Error al procesar el mensaje. Por favor, intentá más tarde.'
    })
  }
}

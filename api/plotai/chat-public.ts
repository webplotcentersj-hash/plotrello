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
  conversation_id?: number
  history?: Array<{ role: 'user' | 'model'; parts: { text: string }[] }>
}

/** Extrae número de OP del texto (ej. "op 123", "la orden 456", "número 789", "OP-100"). */
function extractOpFromText(text: string): string | null {
  const t = text.trim()
  const match = t.match(/\b(?:op|orden|numero|número|nro|#)\s*[:\-]?\s*(\d{2,8})\b/i)
  if (match) return match[1]
  const onlyNum = t.match(/^\s*(\d{3,8})\s*$/)
  if (onlyNum) return onlyNum[1]
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

/** Busca una orden por número de OP y arma contexto de esa OP y del cliente. Si no hay OP en BD, devuelve mensaje claro. */
async function getContextByOp(
  numeroOp: string
): Promise<{ clientContext: string; ordersContext: string }> {
  if (!supabase) return { clientContext: '', ordersContext: '' }
  const opNorm = numeroOp.replace(/\D/g, '').trim()
  if (!opNorm) return { clientContext: '', ordersContext: '' }

  const { data: ordenesList, error } = await supabase
    .from('ordenes_trabajo')
    .select('numero_op, cliente, dni_cuit, descripcion, estado, prioridad, fecha_entrega, fecha_creacion, telefono_cliente, email_cliente, sector, ubicacion_final')
    .ilike('numero_op', `%${opNorm}%`)
    .limit(10)

  const orden = (ordenesList && ordenesList.length > 0)
    ? (ordenesList as Array<Record<string, unknown>>).find(
        (o) => String(o.numero_op || '').replace(/\D/g, '') === opNorm
      ) || ordenesList[0]
    : null

  if (error || !orden) {
    return {
      clientContext: `El visitante consulta por la OP ${numeroOp}. No se encontró ninguna orden de trabajo con ese número en la base de datos. Sugerile que verifique el número o que se contacte por teléfono (2646212163) o email (contacto@plotcenter.com.ar).`,
      ordersContext: ''
    }
  }

  const o = orden as Record<string, unknown>
  const estado = String(o.estado || '—')
  const sector = String(o.sector || '—')
  const ubicacionFinal = o.ubicacion_final ? String(o.ubicacion_final).trim() : ''
  const dondeEsta = ubicacionFinal
    ? `Ubicación actual: ${estado} (${sector}). Lugar: ${ubicacionFinal}.`
    : `Ubicación actual: ${estado} (${sector}).`
  const listoRetiro = ['Finalizado en Taller', 'Almacén de Entrega', 'Almacén de entrega', 'Mostrador', 'Caja'].includes(estado)
  const clientContext =
    `CLIENTE DE LA OP: ${o.cliente || '—'}. DNI/CUIT: ${o.dni_cuit || '—'}. Tel: ${o.telefono_cliente || '—'}. Email: ${o.email_cliente || '—'}.`
  const ordersContext =
    'INFORMACIÓN DE LA OP CONSULTADA (en tiempo real):\n' +
    `- OP ${o.numero_op}: ${o.descripcion || 'Sin descripción'} | Estado: ${estado} | Prioridad: ${o.prioridad || '—'} | Fecha entrega: ${o.fecha_entrega || '—'}\n` +
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
  empresa?: string
): Promise<{ clientContext: string; ordersContext: string }> {
  if (!supabase) {
    return { clientContext: '', ordersContext: '' }
  }

  const trim = (s?: string) => (s && typeof s === 'string' ? s.trim() : '')
  const n = trim(nombre)
  const e = trim(empresa)
  const d = trim(dni)
  const c = trim(cuit)
  const hasAny = n || e || d || c
  if (!hasAny) {
    return {
      clientContext: 'El visitante aún no dio nombre, empresa, DNI ni CUIT. Solo cuando pregunte por su trabajo u orden pedile: "¿Me decís tu nombre, DNI, CUIT o número de OP para buscarlo?"',
      ordersContext: ''
    }
  }

  let clientRow: Record<string, unknown> | null = null
  const digitsOnly = (s: string) => s.replace(/\D/g, '')

  if (d || c) {
    const doc = (d || c).trim()
    const docDigits = digitsOnly(doc)
    if (docDigits.length >= 6) {
      const { data: byDoc } = await supabase
        .from('clientes')
        .select('*')
        .ilike('dni_cuit', `%${docDigits}%`)
        .limit(5)
      const rows = (byDoc || []) as Record<string, unknown>[]
      const match = rows.find((r) => digitsOnly(String(r.dni_cuit || '')) === docDigits) || rows[0]
      if (match) clientRow = match
    }
    if (!clientRow && doc.length >= 4) {
      const { data: byDoc2 } = await supabase
        .from('clientes')
        .select('*')
        .ilike('dni_cuit', `%${doc.replace(/%/g, '')}%`)
        .limit(1)
        .maybeSingle()
      if (byDoc2) clientRow = byDoc2 as Record<string, unknown>
    }
  }
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
  if (!clientRow && n && n.length >= 2) {
    const parts = n.split(/\s+/).filter(Boolean)
    const firstPart = (parts[0] || n).replace(/%/g, '')
    const empresaSafe = n.replace(/%/g, '')
    const { data: byName } = await supabase
      .from('clientes')
      .select('*')
      .or(`nombre.ilike.%${firstPart}%,apellido.ilike.%${firstPart}%,empresa.ilike.%${empresaSafe}%`)
      .limit(15)
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
    : 'No se encontró un cliente con ese nombre o empresa. Sugerile que verifique o que se contacte por teléfono (2646212163) o email (contacto@plotcenter.com.ar).'

  const clienteNombre = clientRow
    ? [clientRow.nombre, clientRow.apellido].filter(Boolean).join(' ').trim() || String(clientRow.empresa || '')
    : ''
  const clienteDoc = clientRow ? String(clientRow.dni_cuit || '') : (d || c)
  let ordersContext = ''

  if (clienteNombre || clienteDoc) {
    const { data: ordenes } = await supabase
      .from('ordenes_trabajo')
      .select('numero_op, cliente, dni_cuit, descripcion, estado, prioridad, fecha_entrega, fecha_creacion, sector, ubicacion_final')
      .order('fecha_creacion', { ascending: false })
      .limit(30)

    const list = (ordenes || []) as Array<{
      numero_op?: string
      cliente?: string
      dni_cuit?: string
      descripcion?: string
      estado?: string
      prioridad?: string
      fecha_entrega?: string
      fecha_creacion?: string
      sector?: string
      ubicacion_final?: string
    }>
    const docNorm = digitsOnly(clienteDoc)
    const clienteNombreLower = clienteNombre.toLowerCase()
    const filtered = list.filter((o) => {
      const oDoc = digitsOnly(String(o.dni_cuit || ''))
      const oCliente = String(o.cliente || '').toLowerCase()
      const matchDoc = docNorm && oDoc && oDoc.length >= 6 && oDoc === docNorm
      const matchName =
        clienteNombre &&
        (oCliente.includes(clienteNombreLower) ||
          clienteNombreLower.split(/\s+/).every((p) => oCliente.includes(p)))
      return matchDoc || matchName
    })
    const listoRetiroEstados = ['Finalizado en Taller', 'Almacén de Entrega', 'Almacén de entrega', 'Mostrador', 'Caja']
    if (filtered.length > 0) {
      ordersContext =
        'ESTADO DE TRABAJOS DEL CLIENTE (en tiempo real, órdenes recientes):\n' +
        filtered
          .map((o) => {
            const est = o.estado || '—'
            const sec = o.sector || '—'
            const ubi = o.ubicacion_final ? String(o.ubicacion_final).trim() : ''
            const donde = ubi ? `Dónde está: ${est} (${sec}). Lugar: ${ubi}.` : `Dónde está: ${est} (${sec}).`
            const retiro = listoRetiroEstados.includes(est) ? ' LISTO PARA RETIRO: puede pasar a buscarla.' : ''
            return `- OP ${o.numero_op}: ${o.descripcion || 'Sin descripción'} | Estado: ${est} | Prioridad: ${o.prioridad || '—'} | Fecha entrega: ${o.fecha_entrega || '—'}\n  ${donde}${retiro}`
          })
          .join('\n')
    } else {
      ordersContext =
        'El cliente no tiene órdenes de trabajo registradas recientes, o no coinciden los datos. Puedes ofrecerle que se comunique por teléfono o email para confirmar.'
    }
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
  if (!message) {
    res.status(400).json({ error: 'message es requerido' })
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
        return acc
      },
      {} as { nombre?: string; empresa?: string; dni?: string; cuit?: string }
    )
    const nombre = (body.nombre && body.nombre.trim()) || extracted.nombre
    const empresa = (body.empresa && body.empresa.trim()) || extracted.empresa
    const dni = (body.dni && body.dni.trim()) || extracted.dni
    const cuit = (body.cuit && body.cuit.trim()) || extracted.cuit
    const opFromBody = body.op && body.op.trim() ? body.op.trim().replace(/\D/g, '') : null
    const opFromMsg = allUserTexts.map(extractOpFromText).find(Boolean)
    const numeroOp = opFromBody || opFromMsg

    let clientContext: string
    let ordersContext: string
    if (numeroOp) {
      const byOp = await getContextByOp(numeroOp)
      clientContext = byOp.clientContext
      ordersContext = byOp.ordersContext
    } else {
      const byClient = await findClientAndOrders(nombre, dni, cuit, empresa)
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

    if (!skipGemini) {
    const systemPrompt = `Eres el asistente virtual de Plot Center, experto en atención al cliente. Tu objetivo es que cada persona se sienta bien atendida: escuchada, con respuestas claras y con un trato cercano y profesional.${notaSolicitud}

REGLA CRÍTICA — NO ALUCINAR (obligatorio):
- Solo podés usar información que aparezca EXPLÍCITAMENTE en las secciones "CONOCIMIENTO DE LA EMPRESA" y "CLIENTE CON QUIEN ESTÁS HABLANDO" más abajo.
- NUNCA inventes: números de OP, fechas de entrega, estados de órdenes, precios, nombres de clientes, teléfonos, emails, direcciones ni ningún otro dato.
- Si el contexto dice "No se encontró" o "no tiene órdenes" o "no hay coincidencias", decilo tal cual; no digas que sí hay datos.
- Si no tenés un dato (ej. precio, fecha, estado), no lo inventes: decí que no lo tenés y sugerí contactar por teléfono (2646212163) o email (contacto@plotcenter.com.ar).
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
- NUNCA escribas placeholders como "[Aquí iría...]" ni relleno. Si tenés el dato, decilo; si no, decí que no lo tenés y ofrecé contacto (2646212163 o contacto@plotcenter.com.ar).
- Resumí cuando haya muchas OPs. Cerrando: "¿Necesitás algo más?" o "Cualquier cosa, estamos acá."`

    const ai = new GoogleGenAI({ apiKey })

    let conversation = systemPrompt + '\n\n---\n\n'
    for (const p of history.slice(-10)) {
      const role = p.role === 'user' ? 'Usuario' : 'Asistente'
      const text = (p.parts && p.parts[0]?.text) || ''
      conversation += `${role}: ${text}\n\n`
    }
    conversation += `Usuario: ${message}\n\nAsistente:`

    const response = await ai.models.generateContent({
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
        if (body.conversation_id && Number.isInteger(Number(body.conversation_id))) {
          const idConv = Number(body.conversation_id)
          const { data: conv, error: selectErr } = await supabase
            .from('atencion_conversaciones')
            .select('historial_mensajes')
            .eq('id', idConv)
            .single()
          let hist: Array<{ role: string; text: string }> = Array.isArray((conv as any)?.historial_mensajes) ? (conv as any).historial_mensajes : []
          if (selectErr && Array.isArray(history) && history.length > 0) {
            hist = history.map((p) => ({ role: p.role, text: (p.parts?.[0]?.text ?? '').slice(0, 5000) }))
          } else if (selectErr) {
            console.error('Error leyendo conversación para actualizar:', selectErr)
          }
          const updated = replyText
            ? [...hist, { role: 'user', text: message.slice(0, 5000) }, { role: 'model', text: replyText.slice(0, 5000) }]
            : [...hist, { role: 'user', text: message.slice(0, 5000) }]
          const { error: updateErr } = await supabase
            .from('atencion_conversaciones')
            .update({
              historial_mensajes: updated,
              ultimo_mensaje_preview: message.slice(0, 200),
              updated_at: new Date().toISOString()
            })
            .eq('id', idConv)
          if (updateErr) console.error('Error actualizando conversación:', updateErr)
          conversationId = idConv
        } else {
          const { data: newConv, error: insertErr } = await supabase
            .from('atencion_conversaciones')
            .insert({
              cliente_nombre: clienteNombreConv,
              canal: 'chat_web',
              ultimo_mensaje_preview: message.slice(0, 200),
              estado: 'abierto',
              historial_mensajes: [
                { role: 'user', text: message.slice(0, 5000) },
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
      ...(solicitudChatId != null && { solicitud_id: solicitudChatId })
    })
  } catch (error: any) {
    console.error('Error en chat-public:', error)
    res.status(500).json({
      success: false,
      error: error?.message || 'Error al procesar el mensaje. Por favor, intentá más tarde.'
    })
  }
}

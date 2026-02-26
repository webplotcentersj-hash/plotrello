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
  dni?: string
  cuit?: string
  history?: Array<{ role: 'user' | 'model'; parts: { text: string }[] }>
}

async function findClientAndOrders(
  nombre?: string,
  dni?: string,
  cuit?: string
): Promise<{ clientContext: string; ordersContext: string }> {
  if (!supabase) {
    return { clientContext: '', ordersContext: '' }
  }

  const trim = (s?: string) => (s && typeof s === 'string' ? s.trim() : '')
  const n = trim(nombre)
  const d = trim(dni)
  const c = trim(cuit)
  const searchTerms: string[] = []
  if (n) searchTerms.push(n)
  if (d) searchTerms.push(d)
  if (c) searchTerms.push(c)
  if (searchTerms.length === 0) {
    return {
      clientContext: 'El visitante no se ha identificado (nombre, DNI o CUIT). Si pregunta por un trabajo u orden, pide amablemente que se identifique con nombre, DNI o CUIT para poder consultar su información.',
      ordersContext: ''
    }
  }

  let clientRow: Record<string, unknown> | null = null
  const q = searchTerms[0]

  if (d || c) {
    const doc = (d || c).replace(/%/g, '\\%')
    const { data: byDoc } = await supabase
      .from('clientes')
      .select('*')
      .ilike('dni_cuit', `%${doc}%`)
      .limit(1)
      .maybeSingle()
    if (byDoc) clientRow = byDoc as Record<string, unknown>
  }
  if (!clientRow && n) {
    const namePart = (n.split(/\s+/)[0] || n).replace(/%/g, '\\%')
    const empresaSafe = n.replace(/%/g, '\\%')
    const { data: byName } = await supabase
      .from('clientes')
      .select('*')
      .or(`nombre.ilike.%${namePart}%,apellido.ilike.%${namePart}%,empresa.ilike.%${empresaSafe}%`)
      .limit(5)
    const rows = (byName || []) as Record<string, unknown>[]
    const fullMatch = rows.find(
      (r) =>
        `${String(r.nombre || '')} ${String(r.apellido || '')}`.toLowerCase().includes(n.toLowerCase()) ||
        String(r.empresa || '').toLowerCase().includes(n.toLowerCase())
    )
    clientRow = fullMatch || rows[0] || null
  }

  const clientContext = clientRow
    ? `CLIENTE IDENTIFICADO: ${[clientRow.nombre, clientRow.apellido, clientRow.empresa].filter(Boolean).join(' ')}. DNI/CUIT: ${clientRow.dni_cuit || '—'}. Tel: ${clientRow.telefono || '—'}. Email: ${clientRow.email || '—'}.`
    : 'No se encontró un cliente con los datos indicados. Si el visitante insiste, sugiere que verifique nombre, DNI o CUIT o que se contacte por teléfono o email.'

  const clienteNombre = clientRow
    ? [clientRow.nombre, clientRow.apellido].filter(Boolean).join(' ').trim() || String(clientRow.empresa || '')
    : ''
  const clienteDoc = clientRow ? String(clientRow.dni_cuit || '') : (d || c)
  let ordersContext = ''

  if (clienteNombre || clienteDoc) {
    const { data: ordenes } = await supabase
      .from('ordenes_trabajo')
      .select('numero_op, cliente, dni_cuit, descripcion, estado, prioridad, fecha_entrega, fecha_creacion')
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
    }>
    const filtered = list.filter(
      (o) =>
        (clienteNombre && String(o.cliente || '').toLowerCase().includes(clienteNombre.toLowerCase())) ||
        (clienteDoc && String(o.dni_cuit || '').replace(/\D/g, '') === clienteDoc.replace(/\D/g, ''))
    )
    if (filtered.length > 0) {
      ordersContext =
        'ESTADO DE TRABAJOS DEL CLIENTE (órdenes recientes):\n' +
        filtered
          .map(
            (o) =>
              `- OP ${o.numero_op}: ${o.descripcion || 'Sin descripción'} | Estado: ${o.estado || '—'} | Prioridad: ${o.prioridad || '—'} | Fecha entrega: ${o.fecha_entrega || '—'}`
          )
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
    const { clientContext, ordersContext } = await findClientAndOrders(
      body.nombre,
      body.dni,
      body.cuit
    )

    const systemPrompt = `Eres el asistente virtual de Plot Center (web: https://plotcenter.com.ar/). Responde SIEMPRE en español (español argentino). Sé amable, profesional y conciso.

CONOCIMIENTO DE LA EMPRESA:
${PLOT_CENTER_KNOWLEDGE}

IDENTIFICACIÓN DEL VISITANTE Y SUS TRABAJOS:
${clientContext}
${ordersContext ? '\n' + ordersContext : ''}

INSTRUCCIONES:
- Usa solo la información anterior sobre la empresa y, si corresponde, sobre el cliente y sus trabajos.
- Si te piden datos que no tienes (ej. precios exactos, plazos no indicados), invita a contactar por teléfono (2646212163) o email (contacto@plotcenter.com.ar).
- No inventes estados de órdenes ni datos de clientes que no aparezcan en el contexto.`

    const ai = new GoogleGenAI({ apiKey })
    const model = ai.getGenerativeModel({ model: 'gemini-2.0-flash' })

    const history = Array.isArray(body.history) ? body.history : []
    let conversation = systemPrompt + '\n\n---\n\n'
    for (const p of history.slice(-10)) {
      const role = p.role === 'user' ? 'Usuario' : 'Asistente'
      const text = (p.parts && p.parts[0]?.text) || ''
      conversation += `${role}: ${text}\n\n`
    }
    conversation += `Usuario: ${message}\n\nAsistente:`

    const result = await model.generateContent(conversation)
    const response = result.response
    const text = response.text()

    res.status(200).json({
      success: true,
      reply: text || 'No pude generar una respuesta. Por favor, intentá de nuevo o contactanos por teléfono o email.'
    })
  } catch (error: any) {
    console.error('Error en chat-public:', error)
    res.status(500).json({
      success: false,
      error: error?.message || 'Error al procesar el mensaje. Por favor, intentá más tarde.'
    })
  }
}

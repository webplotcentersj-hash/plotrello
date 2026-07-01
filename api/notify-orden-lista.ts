import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import {
  authorizeNotifyOrdenLista,
  getSupabaseServerKey,
  getSupabaseServerUrl
} from './_lib/security'

const supabaseUrl = getSupabaseServerUrl()
const supabaseKey = getSupabaseServerKey()
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null

const RESEND_API_KEY = process.env.RESEND_API_KEY || ''
const EMAIL_FROM = process.env.EMAIL_FROM || 'Plot Center <noreply@plotcenter.com.ar>'

const ESTADO_LISTO_ENTREGA = 'Almacén de Entrega'

type OrdenRecord = {
  id?: number
  numero_op?: string
  cliente?: string
  email_cliente?: string | null
  estado?: string
  descripcion?: string | null
}

async function sendEmailResend(to: string, subject: string, html: string): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.warn('RESEND_API_KEY no configurada, no se envía el mail.')
    return false
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: EMAIL_FROM,
      to: [to],
      subject,
      html
    })
  })
  if (!res.ok) {
    const err = await res.text()
    console.error('Resend error:', res.status, err)
    return false
  }
  return true
}

function buildEmailHtml(numeroOp: string, cliente: string): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: system-ui, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #1f2937;">
  <p>Hola${cliente ? ` ${cliente.split(/\s+/)[0]}` : ''},</p>
  <p>Tu pedido <strong>OP ${numeroOp}</strong> está listo para retirar.</p>
  <p>Podés pasar por nuestro local en <strong>9 de Julio 622 (Oeste)</strong> para retirarlo.</p>
  <p>Si tenés dudas, escribinos por WhatsApp o llamanos al 2646212163.</p>
  <p>Saludos,<br><strong>Plot Center</strong></p>
</body>
</html>
`.trim()
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  if (!authorizeNotifyOrdenLista(req, res)) return

  try {
    let orden: OrdenRecord | null = null
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {}

    if (body.ordenId != null) {
      if (!supabase) {
        res.status(503).json({ error: 'Supabase no configurado' })
        return
      }
      const { data, error } = await supabase
        .from('ordenes_trabajo')
        .select('id, numero_op, cliente, email_cliente, estado, descripcion')
        .eq('id', Number(body.ordenId))
        .maybeSingle()
      if (error || !data) {
        res.status(404).json({ error: 'Orden no encontrada' })
        return
      }
      orden = data as OrdenRecord
    } else if (body.record && body.old_record) {
      const record = body.record as OrdenRecord
      const oldRecord = body.old_record as OrdenRecord
      if (
        record.estado === ESTADO_LISTO_ENTREGA &&
        oldRecord.estado !== ESTADO_LISTO_ENTREGA &&
        record.email_cliente
      ) {
        orden = record
      }
    }

    if (!orden || orden.estado !== ESTADO_LISTO_ENTREGA) {
      res.status(400).json({ error: 'La orden no está en estado listo para entregar o no aplica notificación' })
      return
    }

    const email = (orden.email_cliente || '').trim()
    if (!email) {
      res.status(400).json({ error: 'La orden no tiene email de cliente' })
      return
    }

    const numeroOp = orden.numero_op || 'N/A'
    const cliente = orden.cliente || ''
    const subject = `Tu pedido OP ${numeroOp} está listo para retirar - Plot Center`
    const html = buildEmailHtml(numeroOp, cliente)

    const sent = await sendEmailResend(email, subject, html)
    if (!sent) {
      res.status(503).json({ error: 'No se pudo enviar el email (revisar RESEND_API_KEY)' })
      return
    }

    res.status(200).json({ success: true, message: 'Email enviado' })
  } catch (e: any) {
    console.error('notify-orden-lista:', e)
    res.status(500).json({ error: e?.message || 'Error interno' })
  }
}

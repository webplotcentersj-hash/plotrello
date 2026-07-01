import type { VercelRequest, VercelResponse } from '@vercel/node'
import { processMercadoPagoPaymentId } from '../lib/mpPaymentRouter'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.status(405).json({ ok: false })
    return
  }

  try {
    if (req.method === 'GET') {
      const topic = String(req.query.topic || req.query.type || '')
      const id = String(req.query.id || req.query['data.id'] || '')
      if (topic === 'payment' && id) {
        await processMercadoPagoPaymentId(id)
      }
      res.status(200).send('OK')
      return
    }

    const body = (req.body ?? {}) as { type?: string; action?: string; data?: { id?: string | number } }
    const paymentId = body?.data?.id != null ? String(body.data.id) : ''
    if (paymentId && (body.type === 'payment' || String(body.action || '').startsWith('payment.'))) {
      await processMercadoPagoPaymentId(paymentId)
    }
    res.status(200).json({ ok: true })
  } catch (e) {
    console.error('[mp-webhook]', e)
    res.status(200).json({ ok: true })
  }
}

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import jsPDF from 'jspdf'

function getSupabase() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    ''
  return supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null
}

function getBearerToken(req: VercelRequest): string {
  const h = String(req.headers.authorization || '')
  const m = h.match(/^Bearer\s+(.+)$/i)
  return (m?.[1] || '').trim()
}

function splitLines(doc: jsPDF, text: string, maxWidth: number): string[] {
  const t = String(text || '').trim()
  if (!t) return []
  return doc.splitTextToSize(t, maxWidth)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')

  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const expected = (process.env.PLOT_LAB_BACKUP_TOKEN || '').trim()
  if (expected) {
    const got = getBearerToken(req)
    if (!got || got !== expected) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }
  }

  const supabase = getSupabase()
  if (!supabase) {
    res.status(503).json({ error: 'Supabase no está configurado' })
    return
  }

  try {
    const { data, error } = await supabase
      .from('ordenes_trabajo')
      .select(
        'id,numero_op,cliente,descripcion,estado,prioridad,fecha_entrega,sector,operario_asignado,telefono_cliente,email_cliente,materiales,visible_en_tablero,eliminada,entregado,fecha_creacion'
      )
      .order('fecha_creacion', { ascending: false })

    if (error) {
      res.status(502).json({ error: error.message })
      return
    }

    const rows = Array.isArray(data) ? (data as any[]) : []
    const activas = rows.filter((o) => {
      if (o?.eliminada === true) return false
      if (o?.visible_en_tablero === false) return false
      if (o?.entregado === true) return false
      return true
    })

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const pageW = doc.internal.pageSize.getWidth()
    const pageH = doc.internal.pageSize.getHeight()
    const margin = 14
    const contentW = pageW - margin * 2
    let y = margin

    const header = () => {
      doc.setFillColor(11, 13, 23)
      doc.rect(0, 0, pageW, 14, 'F')
      doc.setFillColor(235, 103, 27)
      doc.rect(0, 13, pageW, 1.2, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.text('Fichas activas del tablero', margin, 10)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(200, 206, 220)
      doc.text(`${activas.length} fichas`, pageW - margin, 10, { align: 'right' })
      doc.setTextColor(0, 0, 0)
    }

    const addPageIfNeeded = (needed: number) => {
      if (y + needed > pageH - 14) {
        doc.addPage()
        header()
        y = 26
      }
    }

    // Portada
    doc.setFillColor(11, 13, 23)
    doc.rect(0, 0, pageW, 40, 'F')
    doc.setFillColor(235, 103, 27)
    doc.rect(0, 38, pageW, 2, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(18)
    doc.text('Fichas activas del tablero', margin, 18)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(11)
    doc.setTextColor(230, 235, 245)
    doc.text('Plot Lab — snapshot operativo', margin, 26)
    doc.text(new Date().toLocaleString('es-AR'), margin, 33)
    doc.setTextColor(40, 44, 52)
    y = 48

    if (activas.length === 0) {
      doc.setFontSize(11)
      doc.setTextColor(80, 86, 96)
      doc.text('No hay fichas activas para exportar.', margin, y)
    } else {
      header()
      y = 26

      for (const o of activas) {
        const op = String(o.numero_op || o.id || '—')
        const title = String(o.cliente || '—')
        const estado = String(o.estado || '—')
        const prioridad = String(o.prioridad || 'Normal')
        const entrega = o.fecha_entrega ? String(o.fecha_entrega) : '—'
        const sector = o.sector ? String(o.sector) : '—'
        const asignado = o.operario_asignado ? String(o.operario_asignado) : ''
        const desc = String(o.descripcion || '').trim()

        const stripW = 3
        const pad = 4.5
        const innerW = contentW - stripW - pad * 2

        // Color por prioridad
        const pr = prioridad.toLowerCase()
        const [r, g, b] =
          pr.includes('alta') ? ([220, 76, 70] as const) : pr.includes('baja') ? ([37, 99, 235] as const) : ([217, 119, 6] as const)

        doc.setFont('helvetica', 'bold')
        doc.setFontSize(11)
        const headLines = splitLines(doc, `${op} · ${title}`, innerW).slice(0, 3)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(9)
        const descLines = desc ? splitLines(doc, desc, innerW).slice(0, 10) : []

        let h = 14 + headLines.length * 5 + 10 + (descLines.length ? descLines.length * 4.2 + 4 : 0)
        h += asignado ? 5 : 0
        h += 8
        h = Math.max(36, h)

        addPageIfNeeded(h + 6)

        doc.setFillColor(248, 250, 252)
        doc.setDrawColor(226, 232, 240)
        doc.roundedRect(margin, y, contentW, h, 2.5, 2.5, 'FD')
        doc.setFillColor(r, g, b)
        doc.rect(margin, y, stripW, h, 'F')

        const tx = margin + stripW + pad
        let ty = y + pad + 5

        doc.setFont('helvetica', 'bold')
        doc.setFontSize(11)
        doc.setTextColor(17, 24, 39)
        headLines.forEach((ln, i) => doc.text(ln, tx, ty + i * 5))
        ty += headLines.length * 5 + 2

        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8.5)
        doc.setTextColor(75, 85, 99)
        doc.text(`Estado: ${estado}  ·  Prioridad: ${prioridad}  ·  Sector: ${sector}`, tx, ty)
        ty += 6

        if (descLines.length) {
          doc.setFontSize(9)
          doc.setTextColor(40, 44, 52)
          descLines.forEach((ln) => {
            doc.text(ln, tx, ty)
            ty += 4.2
          })
          ty += 2
        }

        doc.setFontSize(8.5)
        doc.setTextColor(90, 98, 108)
        if (asignado) {
          doc.text(`Asignado: ${asignado}`, tx, ty)
          ty += 5
        }
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(55, 65, 81)
        doc.text(`Entrega objetivo: ${entrega}`, tx, ty)

        y += h + 5
      }
    }

    const totalPages = doc.getNumberOfPages()
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p)
      doc.setFontSize(8)
      doc.setTextColor(150, 156, 166)
      doc.text(`Plot Lab · ${new Date().toISOString().slice(0, 10)}`, margin, pageH - 8)
      doc.text(`Página ${p} / ${totalPages}`, pageW - margin, pageH - 8, { align: 'right' })
    }

    const buf = Buffer.from(doc.output('arraybuffer') as ArrayBuffer)
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=\"plotlab-fichas-activas-${new Date().toISOString().slice(0, 10)}.pdf\"`
    )
    res.status(200).send(buf)
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Error generando PDF' })
  }
}


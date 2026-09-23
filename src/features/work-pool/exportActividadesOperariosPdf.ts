import { jsPDF } from 'jspdf'
import type { OpDelDia, OpDelDiaActividad, WorkPoolNotaSupervision } from './workPoolOperarioNotas'

type OperarioGrupoPdf = {
  id: number
  nombre: string
  ops: OpDelDia[]
  notas: WorkPoolNotaSupervision[]
}

type ExportInformeDiaOpts = {
  fechaKey: string
  fechaLabel: string
  stats: {
    total: number
    bitacora: number
    checklist: number
    anotador: number
    ops: number
  }
  opsDelDia: OpDelDia[]
  grupos: OperarioGrupoPdf[]
}

const FUENTE: Record<OpDelDiaActividad['fuente'], string> = {
  tablero: 'Tablero',
  bitacora: 'Bitácora',
  checklist: 'Checklist',
  anotador: 'Anotador'
}

const TIPO: Record<string, string> = {
  bitacora: 'Bitácora',
  checklist: 'Checklist',
  anotador: 'Anotador'
}

function wrapText(doc: jsPDF, text: string, maxWidth: number): string[] {
  return doc.splitTextToSize(text, maxWidth) as string[]
}

function ensureSpace(doc: jsPDF, y: number, need: number): number {
  if (y + need <= 280) return y
  doc.addPage()
  return 20
}

function formatHora(iso: string): string {
  try {
    return new Date(iso).toLocaleString('es-AR', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: 'short'
    })
  } catch {
    return iso
  }
}

export function exportInformeActividadesDiaPdf(opts: ExportInformeDiaOpts): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const left = 14
  const maxW = 182
  let y = 18

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text('Informe de actividades de operarios', left, y)
  y += 8

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(`Día: ${opts.fechaLabel}`, left, y)
  y += 5
  doc.text(`Generado: ${new Date().toLocaleString('es-AR')}`, left, y)
  y += 8

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('Resumen', left, y)
  y += 6
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(
    `${opts.stats.total} actividades · ${opts.stats.bitacora} bitácora · ${opts.stats.checklist} checklist · ${opts.stats.anotador} anotador · ${opts.stats.ops} OPs`,
    left,
    y
  )
  y += 10

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text(`OPs trabajadas (${opts.opsDelDia.length})`, left, y)
  y += 7

  if (opts.opsDelDia.length === 0) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.text('Sin OPs registradas este día.', left, y)
    y += 8
  }

  for (const op of opts.opsDelDia) {
    y = ensureSpace(doc, y, 18)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    const titleLines = wrapText(doc, op.label, maxW)
    doc.text(titleLines, left, y)
    y += titleLines.length * 5

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    const metaParts = [
      `${op.entradas} ${op.entradas === 1 ? 'entrada' : 'entradas'}`,
      op.estado ? op.estado.replace(/_/g, ' ') : null,
      op.horario || null,
      op.operarios && op.operarios.length > 0
        ? op.operarios.map((o) => o.nombre).join(', ')
        : null
    ].filter(Boolean)
    const metaLines = wrapText(doc, metaParts.join(' · '), maxW)
    doc.text(metaLines, left, y)
    y += metaLines.length * 4.5 + 1

    for (const a of op.actividades ?? []) {
      y = ensureSpace(doc, y, 10)
      const line = `[${FUENTE[a.fuente]}] ${formatHora(a.timestamp)} — ${a.texto}`
      const lines = wrapText(doc, line, maxW - 4)
      doc.setFontSize(8)
      doc.setTextColor(60)
      doc.text(lines, left + 4, y)
      doc.setTextColor(0)
      y += lines.length * 4 + 1
    }
    y += 4
  }

  y = ensureSpace(doc, y, 16)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(0)
  doc.text(`Operarios (${opts.grupos.length})`, left, y)
  y += 8

  for (const g of opts.grupos) {
    y = ensureSpace(doc, y, 20)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text(g.nombre, left, y)
    y += 6

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.text(
      `${g.ops.length} OP${g.ops.length === 1 ? '' : 's'} · ${g.notas.length} nota${g.notas.length === 1 ? '' : 's'}`,
      left,
      y
    )
    y += 5

    for (const op of g.ops) {
      y = ensureSpace(doc, y, 10)
      const lines = wrapText(doc, `• ${op.label} (${op.entradas} entradas)`, maxW - 2)
      doc.text(lines, left + 2, y)
      y += lines.length * 4.2
      for (const a of (op.actividades ?? []).slice(0, 8)) {
        y = ensureSpace(doc, y, 8)
        const detail = wrapText(
          doc,
          `  - [${FUENTE[a.fuente]}] ${a.texto}`,
          maxW - 6
        )
        doc.setFontSize(8)
        doc.setTextColor(70)
        doc.text(detail, left + 4, y)
        doc.setTextColor(0)
        doc.setFontSize(9)
        y += detail.length * 3.8
      }
    }

    for (const n of g.notas) {
      y = ensureSpace(doc, y, 12)
      const tipo = TIPO[n.tipo] || n.tipo
      const texto = (n.titulo || n.detalle || '').trim() || '(sin detalle)'
      const head = `${tipo} · ${formatHora(n.created_at)}${n.numero_op ? ` · OP ${n.numero_op}` : ''}`
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.text(head, left + 2, y)
      y += 4
      doc.setFont('helvetica', 'normal')
      const body = wrapText(doc, texto, maxW - 4)
      doc.text(body, left + 2, y)
      y += body.length * 3.8 + 2
    }
    y += 5
  }

  doc.save(`informe-actividades-operarios-${opts.fechaKey}.pdf`)
}

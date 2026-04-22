import jsPDF from 'jspdf'
import type { Task, TaskStatus } from '../types/board'
import { BOARD_COLUMNS } from '../data/mockData'
import { mapStatusToEstado } from './dataMappers'
import { formatArgentinaDateOnly, getArgentinaDateString } from './dateUtils'

/** Misma regla que `BoardPage` (sin filtros de búsqueda ni sector): visible en tablero, no eliminada, no entregada. */
export function filterFichasActivasTablero(tasks: Task[]): Task[] {
  return tasks.filter((task) => {
    if (task.esSubTarea) return false
    if (task.ordenEliminada) return false
    if (task.visibleEnTablero === false) return false
    if (task.entregado) return false
    return true
  })
}

function statusBoardOrder(status: TaskStatus): number {
  const i = BOARD_COLUMNS.findIndex((c) => c.id === status)
  return i >= 0 ? i : 999
}

function priorityAccentRgb(priority: Task['priority']): [number, number, number] {
  if (priority === 'alta') return [220, 76, 70]
  if (priority === 'media') return [217, 119, 6]
  return [37, 99, 235]
}

function formatDue(task: Task): string {
  try {
    const d = new Date(task.dueDate)
    if (Number.isNaN(d.getTime())) return '—'
    return formatArgentinaDateOnly(d)
  } catch {
    return '—'
  }
}

function priorityLabel(p: Task['priority']): string {
  if (p === 'alta') return 'Alta'
  if (p === 'media') return 'Media'
  return 'Baja'
}

function splitLines(doc: jsPDF, text: string, maxWidth: number): string[] {
  const t = text.trim()
  if (!t) return []
  return doc.splitTextToSize(t, maxWidth)
}

/**
 * Catálogo PDF de fichas activas del tablero principal (una tarjeta por OP).
 */
export function exportTableroFichasActivasPdf(sourceTasks: Task[]): void {
  const tasks = [...filterFichasActivasTablero(sourceTasks)].sort((a, b) => {
    const da = statusBoardOrder(a.status)
    const db = statusBoardOrder(b.status)
    if (da !== db) return da - db
    return (a.opNumber || '').localeCompare(b.opNumber || '', undefined, { numeric: true })
  })

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const margin = 14
  const contentW = pageW - margin * 2
  let y = margin

  const nuevaPagina = (neededMm: number) => {
    if (y + neededMm > pageH - 14) {
      doc.addPage()
      y = margin
      drawPageHeaderSmall(doc, pageW, margin, tasks.length)
      y = 26
    }
  }

  const fechaKey = getArgentinaDateString()
  const fechaLarga = new Intl.DateTimeFormat('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    dateStyle: 'long'
  }).format(new Date())

  // Portada / cabecera primera página
  doc.setFillColor(11, 13, 23)
  doc.rect(0, 0, pageW, 40, 'F')
  doc.setFillColor(235, 103, 27)
  doc.rect(0, 38, pageW, 2, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text('Fichas activas del tablero', margin, 18)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(230, 235, 245)
  doc.text('Plot Lab — snapshot operativo', margin, 26)
  doc.text(`${fechaLarga}`, margin, 33)

  doc.setTextColor(40, 44, 52)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text(`${tasks.length} ficha${tasks.length === 1 ? '' : 's'}`, pageW - margin, 26, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(100, 108, 120)
  doc.text(
    'Criterio: visibles en tablero, no eliminadas, no entregadas (mismo filtro que el Kanban principal).',
    pageW - margin,
    32,
    { align: 'right', maxWidth: 90 }
  )

  y = 48

  if (tasks.length === 0) {
    doc.setFontSize(11)
    doc.setTextColor(80, 86, 96)
    doc.text('No hay fichas activas que coincidan con el tablero principal.', margin, y)
    doc.setFontSize(9)
    doc.text(`Generado el ${fechaLarga}`, margin, y + 8)
    doc.save(`plotlab-fichas-activas-${fechaKey}.pdf`)
    return
  }

  const drawCard = (task: Task): void => {
    const stripW = 3
    const pad = 4.5
    const innerTextW = contentW - stripW - pad * 2
    const [r, g, b] = priorityAccentRgb(task.priority)
    const lineTitle = 5
    const lineMeta = 4.2
    const lineBody = 4.1

    const op = (task.opNumber || task.id || '').trim() || '—'
    const headline = `${op} · ${task.title || '(Sin título)'}`

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    const titleLinesAll = splitLines(doc, headline, innerTextW)
    const titleLines = titleLinesAll.slice(0, 4)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    const rawSummary = (task.summary || '').trim()
    const summaryLinesAll = rawSummary ? splitLines(doc, rawSummary, innerTextW) : []
    let summaryLines = summaryLinesAll.slice(0, 14)
    if (summaryLinesAll.length > 14) {
      summaryLines = [...summaryLines.slice(0, 13), '… (descripción truncada)']
    }

    doc.setFontSize(8)
    const tagStr = task.tags?.length ? task.tags.join(' · ') : ''
    const tagLinesAll = tagStr ? splitLines(doc, tagStr, innerTextW) : []
    const tagLines = tagLinesAll.slice(0, 4)

    doc.setFontSize(8.5)
    const matStr = task.materials?.length ? task.materials.join(', ') : ''
    const matLinesAll = matStr ? splitLines(doc, `Materiales: ${matStr}`, innerTextW) : []
    const matLines = matLinesAll.slice(0, 5)

    const metaParts: string[] = [
      mapStatusToEstado(task.status),
      `Prioridad ${priorityLabel(task.priority)}`,
      task.assignedSector ? `Sector: ${task.assignedSector}` : ''
    ].filter(Boolean)
    const metaLine = metaParts.join('  ·  ')

    let bodyH =
      pad +
      titleLines.length * lineTitle +
      lineMeta +
      2 +
      (summaryLines.length ? 3 + summaryLines.length * lineBody : 0) +
      (matLines.length ? 3 + matLines.length * lineBody : 0) +
      (task.workingUser?.trim() ? 5 : 0) +
      (task.clientPhone?.trim() || task.clientEmail?.trim() ? 5 : 0) +
      5 +
      (tagLines.length ? 3 + tagLines.length * 3.8 : 0) +
      pad

    const cardH = Math.max(bodyH, 36)
    nuevaPagina(cardH + 6)

    const cardY = y

    doc.setFillColor(248, 250, 252)
    doc.setDrawColor(226, 232, 240)
    doc.roundedRect(margin, cardY, contentW, cardH, 2.5, 2.5, 'FD')

    doc.setFillColor(r, g, b)
    doc.rect(margin, cardY, stripW, cardH, 'F')

    let ty = cardY + pad + 5
    const tx = margin + stripW + pad

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(17, 24, 39)
    titleLines.forEach((line, i) => {
      doc.text(line, tx, ty + i * lineTitle)
    })
    ty += titleLines.length * lineTitle + 1

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(75, 85, 99)
    doc.text(metaLine, tx, ty)
    ty += lineMeta + 3

    if (summaryLines.length) {
      doc.setFontSize(9)
      doc.setTextColor(40, 44, 52)
      summaryLines.forEach((ln) => {
        doc.text(ln, tx, ty)
        ty += lineBody
      })
      ty += 2
    }

    doc.setFontSize(8.5)
    doc.setTextColor(90, 98, 108)
    matLines.forEach((ln) => {
      doc.text(ln, tx, ty)
      ty += lineBody
    })
    if (matLines.length) ty += 1

    if (task.workingUser?.trim()) {
      doc.text(`Asignado: ${task.workingUser.trim()}`, tx, ty)
      ty += 5
    }

    const contact = [task.clientPhone?.trim(), task.clientEmail?.trim()].filter(Boolean).join(' · ')
    if (contact) {
      doc.text(`Contacto: ${contact}`, tx, ty)
      ty += 5
    }

    doc.setFont('helvetica', 'bold')
    doc.setTextColor(55, 65, 81)
    doc.text(`Entrega objetivo: ${formatDue(task)}`, tx, ty)
    doc.setFont('helvetica', 'normal')
    ty += 5

    if (tagLines.length) {
      doc.setFontSize(8)
      doc.setTextColor(107, 114, 128)
      tagLines.forEach((ln) => {
        doc.text(ln, tx, ty)
        ty += 3.8
      })
    }

    y = cardY + cardH + 5
  }

  tasks.forEach(drawCard)

  const totalPages = doc.getNumberOfPages()
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p)
    doc.setFontSize(8)
    doc.setTextColor(150, 156, 166)
    doc.text(`Plot Lab · ${fechaKey}`, margin, pageH - 8)
    doc.text(`Página ${p} / ${totalPages}`, pageW - margin, pageH - 8, { align: 'right' })
  }

  doc.save(`plotlab-fichas-activas-${fechaKey}.pdf`)
}

function drawPageHeaderSmall(doc: jsPDF, pageW: number, margin: number, total: number): void {
  doc.setFillColor(11, 13, 23)
  doc.rect(0, 0, pageW, 14, 'F')
  doc.setFillColor(235, 103, 27)
  doc.rect(0, 13, pageW, 1.2, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('Fichas activas del tablero', margin, 10)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(200, 206, 220)
  doc.text(`${total} fichas`, pageW - margin, 10, { align: 'right' })
}

import jsPDF from 'jspdf'
import type { Task } from '../types/board'
import type { TeamMember } from '../types/board'
import type { SectorRecord } from '../types/api'

/**
 * Exporta las tareas filtradas a CSV
 */
export function exportToCSV(
  tasks: Task[],
  teamMembers: TeamMember[],
  _sectores: SectorRecord[],
  columns: ReadonlyArray<{ id: string; label: string }>
): void {
  // Encabezados del CSV
  const headers = [
    'N° OP',
    'Cliente',
    'Descripción',
    'Estado',
    'Prioridad',
    'Complejidad',
    'Sector',
    'Operario',
    'Fecha Creación',
    'Fecha Entrega',
    'Fecha Ingreso',
    'Materiales',
    'Etiquetas',
    'Progreso (%)'
  ]

  // Convertir tareas a filas CSV
  const rows = tasks.map((task) => {
    const owner = teamMembers.find((m) => m.id === task.ownerId)
    const column = columns.find((c) => c.id === task.status)

    return [
      task.opNumber || '',
      task.title || '', // title contiene el nombre del cliente
      task.summary || '',
      column?.label || task.status || '',
      task.priority || '',
      task.impact || '',
      task.assignedSector || '',
      owner?.name || '',
      task.createdAt ? new Date(task.createdAt).toLocaleDateString('es-AR') : '',
      task.dueDate ? new Date(task.dueDate).toLocaleDateString('es-AR') : '',
      task.updatedAt ? new Date(task.updatedAt).toLocaleDateString('es-AR') : '',
      task.materials?.join(', ') || '',
      task.tags?.join(', ') || '',
      task.progress?.toString() || '0'
    ]
  })

  // Función para escapar valores CSV (manejar comas y comillas)
  const escapeCSV = (value: string): string => {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`
    }
    return value
  }

  // Construir contenido CSV
  const csvContent = [
    headers.map(escapeCSV).join(','),
    ...rows.map((row) => row.map((cell) => escapeCSV(String(cell))).join(','))
  ].join('\n')

  // Crear blob y descargar
  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.setAttribute('href', url)
  link.setAttribute('download', `ordenes_trabajo_${new Date().toISOString().split('T')[0]}.csv`)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Exporta las tareas filtradas a PDF
 */
export function exportToPDF(
  tasks: Task[],
  teamMembers: TeamMember[],
  _sectores: SectorRecord[],
  columns: ReadonlyArray<{ id: string; label: string }>
): void {
  const doc = new jsPDF('l', 'mm', 'a4') // Landscape para más espacio
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 15
  const lineHeight = 7
  let yPos = margin
  let currentPage = 1

  // Función para agregar nueva página si es necesario
  const checkNewPage = (requiredSpace: number): void => {
    if (yPos + requiredSpace > pageHeight - margin) {
      doc.addPage()
      currentPage++
      yPos = margin
    }
  }

  // Título
  doc.setFontSize(18)
  doc.setTextColor(235, 103, 27) // Color naranja de la app
  doc.text('Reporte de Órdenes de Trabajo', margin, yPos)
  yPos += lineHeight * 2

  doc.setFontSize(10)
  doc.setTextColor(100, 100, 100)
  doc.text(`Generado el ${new Date().toLocaleDateString('es-AR')} - ${tasks.length} órdenes`, margin, yPos)
  yPos += lineHeight * 2

  // Tabla de resumen
  doc.setFontSize(12)
  doc.setTextColor(0, 0, 0)
  doc.text('Resumen', margin, yPos)
  yPos += lineHeight

  const estadosCount: Record<string, number> = {}
  tasks.forEach((task) => {
    const estado = columns.find((c) => c.id === task.status)?.label || task.status
    estadosCount[estado] = (estadosCount[estado] || 0) + 1
  })

  doc.setFontSize(10)
  Object.entries(estadosCount).forEach(([estado, count]) => {
    checkNewPage(lineHeight)
    doc.text(`  ${estado}: ${count}`, margin, yPos)
    yPos += lineHeight
  })
  yPos += lineHeight

  // Detalle de órdenes
  doc.setFontSize(12)
  doc.text('Detalle de Órdenes', margin, yPos)
  yPos += lineHeight * 1.5

  tasks.forEach((task, index) => {
    checkNewPage(lineHeight * 8)

    // Separador
    if (index > 0) {
      doc.setDrawColor(200, 200, 200)
      doc.line(margin, yPos, pageWidth - margin, yPos)
      yPos += lineHeight
    }

    doc.setFontSize(11)
    doc.setTextColor(235, 103, 27)
    doc.text(`OP: ${task.opNumber || 'N/A'}`, margin, yPos)
    yPos += lineHeight

    doc.setFontSize(10)
    doc.setTextColor(0, 0, 0)

    const owner = teamMembers.find((m) => m.id === task.ownerId)
    const column = columns.find((c) => c.id === task.status)

    const details = [
      `Cliente: ${task.title || 'N/A'}`, // title contiene el nombre del cliente
      `Estado: ${column?.label || task.status || 'N/A'}`,
      `Prioridad: ${task.priority || 'N/A'}`,
      `Sector: ${task.assignedSector || 'N/A'}`,
      `Operario: ${owner?.name || 'N/A'}`,
      `Fecha Creación: ${task.createdAt ? new Date(task.createdAt).toLocaleDateString('es-AR') : 'N/A'}`,
      `Fecha Entrega: ${task.dueDate ? new Date(task.dueDate).toLocaleDateString('es-AR') : 'N/A'}`
    ]

    details.forEach((detail) => {
      checkNewPage(lineHeight)
      doc.text(detail, margin + 5, yPos)
      yPos += lineHeight
    })

    if (task.summary) {
      checkNewPage(lineHeight * 2)
      const summaryLines = doc.splitTextToSize(`Descripción: ${task.summary}`, pageWidth - margin * 2 - 10)
      doc.text(summaryLines, margin + 5, yPos)
      yPos += lineHeight * summaryLines.length
    }

    if (task.materials && task.materials.length > 0) {
      checkNewPage(lineHeight)
      doc.text(`Materiales: ${task.materials.join(', ')}`, margin + 5, yPos)
      yPos += lineHeight
    }

    if (task.tags && task.tags.length > 0) {
      checkNewPage(lineHeight)
      doc.text(`Etiquetas: ${task.tags.join(', ')}`, margin + 5, yPos)
      yPos += lineHeight
    }

    yPos += lineHeight * 0.5
  })

  // Pie de página
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(150, 150, 150)
    doc.text(
      `Página ${i} de ${totalPages}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    )
  }

  // Descargar PDF
  doc.save(`ordenes_trabajo_${new Date().toISOString().split('T')[0]}.pdf`)
}


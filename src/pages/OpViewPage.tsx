import { useMemo, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { jsPDF } from 'jspdf'
import type { Task } from '../types/board'
import type { SectorRecord } from '../types/api'
import { useAuth } from '../hooks/useAuth'
import WorkPoolPublicarForm from '../features/work-pool/WorkPoolPublicarForm'
import {
  inferProductFromOpSectorName,
  inferSectorFromOpSectorName,
  WORK_POOL_PRODUCT_CONFIG
} from '../features/work-pool/workPoolConfig'
import './OpViewPage.css'

type OpViewPageProps = {
  tasks: Task[]
  sectores: SectorRecord[]
}

const badgeColorByPriority: Record<Task['priority'], string> = {
  alta: '#f87171',
  media: '#fbbf24',
  baja: '#34d399'
}

const OpViewPage = ({ tasks, sectores }: OpViewPageProps) => {
  const { opNumber } = useParams<{ opNumber: string }>()
  const navigate = useNavigate()
  const { usuario, canManageWorkPool } = useAuth()
  const contentRef = useRef<HTMLDivElement | null>(null)
  const [downloading, setDownloading] = useState(false)
  const [deriveOpen, setDeriveOpen] = useState(false)
  const [deriveSuccess, setDeriveSuccess] = useState('')

  const task = useMemo(() => {
    if (!opNumber) return null
    return (
      tasks.find((t) => t.opNumber === opNumber) ||
      tasks.find((t) => t.id === opNumber) ||
      null
    )
  }, [opNumber, tasks])

  const sectorColor =
    (task && sectores.find((s) => s.nombre === task.assignedSector)?.color) || '#4b5563'

  const deriveProduct = task ? inferProductFromOpSectorName(task.assignedSector ?? task.status) : null
  const deriveSector = task ? inferSectorFromOpSectorName(task.assignedSector ?? task.status) : null

  if (!opNumber) {
    return (
      <div className="opview-page">
        <div className="opview-card">
          <p>Sin número de OP.</p>
          <button className="ghost-button" onClick={() => navigate('/')}>
            Volver
          </button>
        </div>
      </div>
    )
  }

  if (!task) {
    return (
      <div className="opview-page">
        <div className="opview-card">
          <h2>OP {opNumber}</h2>
          <p>No se encontró la orden.</p>
          <button className="ghost-button" onClick={() => navigate('/')}>
            Volver al tablero
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="opview-page">
      <div className="opview-card" ref={contentRef}>
        <header className="opview-header">
          <div>
            <p className="opview-eyebrow">Orden de Producción</p>
            <h1>OP {task.opNumber}</h1>
            <p className="opview-title">{task.title}</p>
          </div>
          <div className="opview-badges">
            <span className="badge" style={{ background: `${sectorColor}20`, color: sectorColor }}>
              {task.assignedSector ?? task.status}
            </span>
            <span
              className="badge"
              style={{
                background: `${badgeColorByPriority[task.priority]}20`,
                color: badgeColorByPriority[task.priority]
              }}
            >
              Prioridad {task.priority}
            </span>
          </div>
        </header>

        <section className="opview-grid">
          <div className="opview-block">
            <p className="label">Descripción</p>
            <p className="value">{task.summary || 'Sin descripción'}</p>
          </div>
          <div className="opview-block">
            <p className="label">Cliente / DNI</p>
            <p className="value">
              {task.title}
              {task.dniCuit ? ` · ${task.dniCuit}` : ''}
            </p>
          </div>
          <div className="opview-block">
            <p className="label">Fechas</p>
            <p className="value">
              Creada: {new Date(task.createdAt).toLocaleString('es-AR')} <br />
              Entrega: {new Date(task.dueDate).toLocaleDateString('es-AR')}
            </p>
          </div>
          <div className="opview-block">
            <p className="label">Etiquetas</p>
            <div className="chips">
              {(task.tags ?? []).length === 0 && <span className="muted">Sin etiquetas</span>}
              {(task.tags ?? []).map((tag) => (
                <span key={tag} className="chip">
                  {tag}
                </span>
              ))}
            </div>
          </div>
          <div className="opview-block">
            <p className="label">Materiales</p>
            <div className="chips">
              {(task.materials ?? []).length === 0 && <span className="muted">Sin materiales</span>}
              {(task.materials ?? []).map((mat) => (
                <span key={mat} className="chip">
                  {mat}
                </span>
              ))}
            </div>
          </div>
          <div className="opview-block">
            <p className="label">Contacto</p>
            <p className="value">
              {task.clientPhone && <>Tel: {task.clientPhone}<br /></>}
              {task.clientEmail && <>Email: {task.clientEmail}<br /></>}
              {task.clientAddress && <>Dirección: {task.clientAddress}<br /></>}
              {!task.clientPhone && !task.clientEmail && !task.clientAddress && (
                <span className="muted">Sin datos de contacto</span>
              )}
            </p>
          </div>
        </section>

        {canManageWorkPool && usuario && task && (
          <section className="opview-derive">
            <div className="opview-derive__head">
              <div>
                <p className="opview-derive__eyebrow">Derivar trabajo</p>
                <h3>
                  {deriveProduct
                    ? `${WORK_POOL_PRODUCT_CONFIG[deriveProduct].icon} ${WORK_POOL_PRODUCT_CONFIG[deriveProduct].label}`
                    : 'Plot Design / Bolsa Plot'}
                </h3>
                <p className="opview-derive__hint">
                  Publicá en bolsa libre o asigná directo a un empleado desde esta OP.
                </p>
              </div>
              <button type="button" className="ghost-button" onClick={() => setDeriveOpen((v) => !v)}>
                {deriveOpen ? 'Ocultar' : 'Derivar desde OP'}
              </button>
            </div>
            {deriveSuccess && <p className="opview-derive__ok">{deriveSuccess}</p>}
            {deriveOpen && deriveProduct && (
              <WorkPoolPublicarForm
                product={deriveProduct}
                idUsuarioCreador={usuario.id}
                numeroOp={task.opNumber}
                descripcionInicial={task.summary || task.title}
                sectorInicial={deriveSector ?? undefined}
                compact
                onSuccess={() => {
                  setDeriveSuccess('Trabajo derivado correctamente desde la OP.')
                  setDeriveOpen(false)
                }}
                onError={() => setDeriveSuccess('')}
              />
            )}
            {deriveOpen && !deriveProduct && (
              <p className="opview-derive__warn">
                No se detectó sector compatible. Usá el panel admin de Plot Design o Bolsa Plot.
              </p>
            )}
          </section>
        )}

        <footer className="opview-footer">
          <button className="ghost-button" onClick={() => navigate('/')}>
            ← Volver al tablero
          </button>
          <button
            className="brand-button"
            disabled={downloading}
            onClick={() => {
              if (!task) return
              setDownloading(true)
              try {
                const doc = new jsPDF('p', 'mm', 'a4')
                const pageWidth = doc.internal.pageSize.getWidth()
                const pageHeight = doc.internal.pageSize.getHeight()
                const margin = 20
                let yPos = margin

                // Encabezado
                doc.setFontSize(20)
                doc.setTextColor(59, 130, 246)
                doc.setFont('helvetica', 'bold')
                doc.text('ORDEN DE PRODUCCIÓN', margin, yPos)
                yPos += 10

                doc.setFontSize(18)
                doc.setTextColor(0, 0, 0)
                doc.text(`OP ${task.opNumber}`, margin, yPos)
                yPos += 8

                doc.setFontSize(12)
                doc.setFont('helvetica', 'normal')
                doc.setTextColor(100, 100, 100)
                doc.text(`Cliente: ${task.title}`, margin, yPos)
                yPos += 7

                if (task.dniCuit) {
                  doc.text(`DNI/CUIT: ${task.dniCuit}`, margin, yPos)
                  yPos += 7
                }

                yPos += 5
                doc.setDrawColor(200, 200, 200)
                doc.line(margin, yPos, pageWidth - margin, yPos)
                yPos += 10

                // Descripción
                doc.setFontSize(11)
                doc.setFont('helvetica', 'bold')
                doc.setTextColor(0, 0, 0)
                doc.text('Descripción:', margin, yPos)
                yPos += 7

                doc.setFontSize(10)
                doc.setFont('helvetica', 'normal')
                const descripcion = task.summary || 'Sin descripción'
                const descripcionLines = doc.splitTextToSize(descripcion, pageWidth - margin * 2)
                descripcionLines.forEach((line: string) => {
                  if (yPos > pageHeight - margin - 10) {
                    doc.addPage()
                    yPos = margin
                  }
                  doc.text(line, margin + 5, yPos)
                  yPos += 6
                })
                yPos += 5

                // Fechas
                doc.setFontSize(11)
                doc.setFont('helvetica', 'bold')
                doc.text('Fechas:', margin, yPos)
                yPos += 7

                doc.setFontSize(10)
                doc.setFont('helvetica', 'normal')
                const fechaCreacion = new Date(task.createdAt).toLocaleString('es-AR')
                const fechaEntrega = new Date(task.dueDate).toLocaleDateString('es-AR')
                doc.text(`Creada: ${fechaCreacion}`, margin + 5, yPos)
                yPos += 6
                doc.text(`Entrega: ${fechaEntrega}`, margin + 5, yPos)
                yPos += 10

                // Estado y Prioridad
                doc.setFontSize(11)
                doc.setFont('helvetica', 'bold')
                doc.text('Estado y Prioridad:', margin, yPos)
                yPos += 7

                doc.setFontSize(10)
                doc.setFont('helvetica', 'normal')
                doc.text(`Sector: ${task.assignedSector ?? task.status}`, margin + 5, yPos)
                yPos += 6
                doc.text(`Prioridad: ${task.priority}`, margin + 5, yPos)
                yPos += 10

                // Etiquetas
                if (task.tags && task.tags.length > 0) {
                  doc.setFontSize(11)
                  doc.setFont('helvetica', 'bold')
                  doc.text('Etiquetas:', margin, yPos)
                  yPos += 7

                  doc.setFontSize(10)
                  doc.setFont('helvetica', 'normal')
                  doc.text(task.tags.join(', '), margin + 5, yPos)
                  yPos += 10
                }

                // Materiales
                if (task.materials && task.materials.length > 0) {
                  doc.setFontSize(11)
                  doc.setFont('helvetica', 'bold')
                  doc.text('Materiales:', margin, yPos)
                  yPos += 7

                  doc.setFontSize(10)
                  doc.setFont('helvetica', 'normal')
                  const materialesText = task.materials.join(', ')
                  const materialesLines = doc.splitTextToSize(materialesText, pageWidth - margin * 2)
                  materialesLines.forEach((line: string) => {
                    if (yPos > pageHeight - margin - 10) {
                      doc.addPage()
                      yPos = margin
                    }
                    doc.text(line, margin + 5, yPos)
                    yPos += 6
                  })
                  yPos += 5
                }

                // Contacto
                if (task.clientPhone || task.clientEmail || task.clientAddress) {
                  doc.setFontSize(11)
                  doc.setFont('helvetica', 'bold')
                  doc.text('Contacto:', margin, yPos)
                  yPos += 7

                  doc.setFontSize(10)
                  doc.setFont('helvetica', 'normal')
                  if (task.clientPhone) {
                    doc.text(`Tel: ${task.clientPhone}`, margin + 5, yPos)
                    yPos += 6
                  }
                  if (task.clientEmail) {
                    doc.text(`Email: ${task.clientEmail}`, margin + 5, yPos)
                    yPos += 6
                  }
                  if (task.clientAddress) {
                    const direccionLines = doc.splitTextToSize(`Dirección: ${task.clientAddress}`, pageWidth - margin * 2 - 10)
                    direccionLines.forEach((line: string) => {
                      if (yPos > pageHeight - margin - 10) {
                        doc.addPage()
                        yPos = margin
                      }
                      doc.text(line, margin + 5, yPos)
                      yPos += 6
                    })
                  }
                }

                // Pie de página
                const totalPages = doc.getNumberOfPages()
                for (let i = 1; i <= totalPages; i++) {
                  doc.setPage(i)
                  doc.setFontSize(8)
                  doc.setFont('helvetica', 'normal')
                  doc.setTextColor(100, 100, 100)
                  doc.text(
                    `Página ${i} de ${totalPages}`,
                    pageWidth / 2,
                    pageHeight - 10,
                    { align: 'center' }
                  )
                }

                doc.save(`OP-${task.opNumber}.pdf`)
              } catch (error) {
                console.error('Error generando PDF:', error)
                alert('Error al generar el PDF. Por favor intenta nuevamente.')
              } finally {
                setDownloading(false)
              }
            }}
          >
            {downloading ? 'Descargando...' : '⬇️ Descargar PDF'}
          </button>
        </footer>
      </div>
    </div>
  )
}

export default OpViewPage


import { useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import type { Task } from '../types/board'
import type { SectorRecord } from '../types/api'
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
      <div className="opview-card">
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

        <footer className="opview-footer">
          <button className="ghost-button" onClick={() => navigate('/')}>
            ← Volver al tablero
          </button>
          <button
            className="brand-button"
            onClick={() => {
              window.print()
            }}
          >
            🖨️ Imprimir
          </button>
        </footer>
      </div>
    </div>
  )
}

export default OpViewPage


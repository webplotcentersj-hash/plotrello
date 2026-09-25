import { useMemo } from 'react'
import type { Task } from '../types/board'
import { useTagColors } from '../hooks/useTagColors'
import { pillColorFromString } from '../utils/pillColorFromString'
import './EtiquetasNubePanel.css'

type Props = {
  tasks: Task[]
  etiquetaActiva?: string
  onElegir?: (etiqueta: string) => void
}

const EtiquetasNubePanel = ({ tasks, etiquetaActiva, onElegir }: Props) => {
  const { getTagColor } = useTagColors()

  const etiquetas = useMemo(() => {
    const counts = new Map<string, { label: string; n: number }>()
    for (const task of tasks) {
      for (const raw of task.tags ?? []) {
        const label = String(raw ?? '').trim()
        if (!label) continue
        const key = label.toLowerCase()
        const prev = counts.get(key)
        if (prev) prev.n += 1
        else counts.set(key, { label, n: 1 })
      }
    }
    return [...counts.values()]
      .sort((a, b) => b.n - a.n || a.label.localeCompare(b.label, 'es'))
      .slice(0, 32)
  }, [tasks])

  const max = etiquetas[0]?.n ?? 1
  const activaKey = (etiquetaActiva || '').trim().toLowerCase()

  return (
    <section className="etiquetas-nube" aria-label="Etiquetas más usadas">
      <p className="etiquetas-nube__eyebrow">Etiquetas</p>
      {etiquetas.length === 0 ? (
        <p className="etiquetas-nube__vacio">Todavía no hay etiquetas en el tablero.</p>
      ) : (
        <div className="etiquetas-nube__cloud">
          {etiquetas.map((e) => {
            const peso = 0.72 + (e.n / max) * 0.48
            const catalogo = getTagColor(e.label)
            const color = catalogo && catalogo !== '#6B7280' ? catalogo : pillColorFromString(e.label)
            const activa = activaKey === e.label.toLowerCase()
            return (
              <button
                key={e.label.toLowerCase()}
                type="button"
                className={activa ? 'is-activa' : undefined}
                style={{ fontSize: `${peso}rem`, background: color }}
                title={`${e.n} ${e.n === 1 ? 'ficha' : 'fichas'}`}
                onClick={() => onElegir?.(activa ? '' : e.label)}
              >
                {e.label}
              </button>
            )
          })}
        </div>
      )}
    </section>
  )
}

export default EtiquetasNubePanel

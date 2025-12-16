import type { RefObject } from 'react'
import type { ColumnConfig, Priority, TaskStatus } from '../types/board'
import { useAuth } from '../hooks/useAuth'
import apiService from '../services/api'
import './FiltersBar.css'

type FiltersBarProps = {
  searchQuery: string
  onSearchChange: (value: string) => void
  searchInputRef?: RefObject<HTMLInputElement | null>
  statusFocus: TaskStatus[]
  onStatusToggle: (status: TaskStatus) => void
  onStatusReset: () => void
  columns: ReadonlyArray<ColumnConfig>
  priorityFilter: Priority | 'todas'
  priorityFilters: ReadonlyArray<{ id: Priority | 'todas'; label: string }>
  onPriorityChange: (value: Priority | 'todas') => void
  onOpenLibrary?: () => void
  onAddNewOrder?: () => void
}

const FiltersBar = ({
  searchQuery,
  onSearchChange,
  searchInputRef,
  statusFocus,
  onStatusToggle,
  onStatusReset,
  columns,
  priorityFilter,
  priorityFilters,
  onPriorityChange,
  onOpenLibrary,
  onAddNewOrder
}: FiltersBarProps) => {
  const { isAdmin, isDiseno, usuario } = useAuth()
  const [copiandoBrief, setCopiandoBrief] = useState(false)

  const handleGenerarBriefLink = async () => {
    setCopiandoBrief(true)
    try {
      const usuarioId = usuario?.id ? parseInt(usuario.id.toString()) : undefined
      const response = await apiService.crearBriefPublico(usuarioId)
      
      if (response.success && response.data) {
        const token = response.data
        const url = `${window.location.origin}/brief/${token}`
        
        await navigator.clipboard.writeText(url)
        alert('✅ Link del brief copiado al portapapeles!\n\n' + url)
      } else {
        alert(`Error: ${response.error || 'No se pudo generar el link'}`)
      }
    } catch (error) {
      console.error('Error generando link de brief:', error)
      alert('Error al generar el link del brief')
    } finally {
      setCopiandoBrief(false)
    }
  }

  return (
    <section className="filters-bar">
      <div className="search-filter">
        <input
          type="text"
          placeholder="Buscar por ID, título o tags…"
          value={searchQuery}
          onChange={(event) => onSearchChange(event.target.value)}
          ref={searchInputRef}
        />
      </div>

      <div className="filter-grid">
        <div className="filter-control">
          <label>Prioridad</label>
          <div className="priority-group">
            {priorityFilters.map((filter) => (
              <button
                key={filter.id}
                type="button"
                className={filter.id === priorityFilter ? 'active' : ''}
                onClick={() => onPriorityChange(filter.id)}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>
        <div className="library-button-container">
          {onAddNewOrder && (
            <button
              type="button"
              className="brand-button"
              onClick={onAddNewOrder}
              title="Agregar Nueva Orden"
            >
              + Agregar Nueva Orden
            </button>
          )}
          {onOpenLibrary && (
            <button
              type="button"
              className="library-button"
              onClick={onOpenLibrary}
              title="Bibliotecas de OPs"
            >
              🔍 Bibliotecas de OPs
            </button>
          )}
          {(isAdmin || isDiseno) && (
            <button
              type="button"
              className="brief-link-button"
              onClick={handleGenerarBriefLink}
              disabled={copiandoBrief}
              title="Generar y copiar link del brief para enviar a clientes"
            >
              {copiandoBrief ? '⏳ Generando...' : '📋 Copiar Link Brief'}
            </button>
          )}
        </div>
      </div>

      <div className="status-chips">
        {columns.map((column) => (
          <button
            key={column.id}
            type="button"
            className={statusFocus.includes(column.id) ? 'chip active' : 'chip'}
            onClick={() => onStatusToggle(column.id)}
          >
            <span className="chip-dot" style={{ background: column.accent }} />
            {column.label}
          </button>
        ))}
        <button type="button" className="chip reset" onClick={onStatusReset}>
          Limpiar foco
        </button>
      </div>
    </section>
  )
}

export default FiltersBar


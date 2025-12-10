import type { ColumnConfig, Priority, TaskStatus } from '../types/board'
import './FiltersBar.css'

type FiltersBarProps = {
  searchQuery: string
  onSearchChange: (value: string) => void
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
  return (
    <section className="filters-bar">
      <div className="search-filter">
        <input
          type="text"
          placeholder="Buscar por ID, título o tags…"
          value={searchQuery}
          onChange={(event) => onSearchChange(event.target.value)}
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


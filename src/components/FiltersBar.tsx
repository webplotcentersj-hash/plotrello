import type { TeamMember } from '../types/board'
import './FiltersBar.css'

type FiltersBarProps = {
  searchQuery: string
  onSearchChange: (value: string) => void
  statusFocus: string[]
  onStatusToggle: (status: string) => void
  onStatusReset: () => void
  columns: ReadonlyArray<{ id: string; label: string; accent: string }>
}

const FiltersBar = ({
  searchQuery,
  onSearchChange,
  statusFocus,
  onStatusToggle,
  onStatusReset,
  columns
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


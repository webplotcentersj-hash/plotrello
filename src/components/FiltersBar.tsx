import type { TeamMember } from '../types/board'
import './FiltersBar.css'

type FiltersBarProps = {
  searchQuery: string
  onSearchChange: (value: string) => void
  ownerFilter: string
  onOwnerChange: (value: string) => void
  priorityFilter: string
  onPriorityChange: (value: string) => void
  priorityFilters: ReadonlyArray<{ id: string; label: string }>
  teamMembers: TeamMember[]
}

const FiltersBar = ({
  searchQuery,
  onSearchChange,
  ownerFilter,
  onOwnerChange,
  priorityFilter,
  onPriorityChange,
  priorityFilters,
  teamMembers
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
          <label>Responsable</label>
          <select value={ownerFilter} onChange={(event) => onOwnerChange(event.target.value)}>
            <option value="todos">Todo el equipo</option>
            {teamMembers.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
          </select>
        </div>

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
      </div>
    </section>
  )
}

export default FiltersBar


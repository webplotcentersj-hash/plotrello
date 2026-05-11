import { useState } from 'react'
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
  /** Solo en home: filtrar OPs donde el usuario es operario asignado o está trabajando la ficha */
  misTrabajosFilter?: boolean
  onMisTrabajosChange?: (value: boolean) => void
  sectorFilter?: string
  availableSectors?: string[]
  onSectorChange?: (value: string) => void
  onOpenLibrary?: () => void
  onAddNewOrder?: () => void
  onOptimizeSprint?: () => void
  /** Botón para abrir kanban de etapas del sector (solo si el sector tiene etapas internas) */
  showEtapaKanbanButton?: boolean
  onOpenEtapaKanban?: () => void
  /** Placeholder del buscador (ej. asesor-presupuestos: fichas FICHA-*, no OP de taller) */
  searchPlaceholder?: string
  /** Teléfono: solo buscador + sector (si aplica) + alta ficha; sin chips ni prioridad. */
  compactPhone?: boolean
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
  misTrabajosFilter = false,
  onMisTrabajosChange,
  sectorFilter = 'todos',
  availableSectors = [],
  onSectorChange,
  onOpenLibrary,
  onAddNewOrder,
  onOptimizeSprint,
  showEtapaKanbanButton = false,
  onOpenEtapaKanban,
  searchPlaceholder = 'Buscar: OP, cliente, descripción, etiquetas, contacto, materiales…',
  compactPhone = false
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

  if (compactPhone) {
    return (
      <section className="filters-bar filters-bar--phone" aria-label="Filtros del tablero">
        <div className="filters-bar-phone-row search-filter">
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
            ref={searchInputRef}
          />
        </div>
        {onSectorChange && availableSectors.length > 0 && (
          <div className="filters-bar-phone-row">
            <label className="filters-bar-phone-label" htmlFor="filters-bar-phone-sector">
              Sector
            </label>
            <select
              id="filters-bar-phone-sector"
              value={sectorFilter}
              onChange={(e) => onSectorChange(e.target.value)}
              className="sector-select filters-bar-phone-select"
            >
              <option value="todos">Todos</option>
              {availableSectors.map((sector) => (
                <option key={sector} value={sector}>
                  {sector}
                </option>
              ))}
            </select>
          </div>
        )}
        {onAddNewOrder && (
          <div className="filters-bar-phone-row">
            <button type="button" className="brand-button filters-bar-phone-add" onClick={onAddNewOrder}>
              + Agregar ficha
            </button>
          </div>
        )}
      </section>
    )
  }

  return (
    <section className="filters-bar">
      <div className="search-filter">
        <input
          type="text"
          placeholder={searchPlaceholder}
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
            {onMisTrabajosChange && (
              <button
                type="button"
                className={misTrabajosFilter ? 'active' : ''}
                onClick={() => onMisTrabajosChange(!misTrabajosFilter)}
                title="Solo fichas donde estás asignado como operario o figuras como quien trabaja la OP"
              >
                Mis trabajos
              </button>
            )}
          </div>
        </div>
        <div className="filter-right-section">
          {onSectorChange && availableSectors.length > 0 && (
            <div className="filter-control sector-filter-control">
              <label>Sector</label>
              <div className="sector-filter-row">
                <select
                  value={sectorFilter}
                  onChange={(e) => onSectorChange(e.target.value)}
                  className="sector-select"
                >
                  <option value="todos">Todos los sectores</option>
                  {availableSectors.map((sector) => (
                    <option key={sector} value={sector}>
                      {sector}
                    </option>
                  ))}
                </select>
                {showEtapaKanbanButton && onOpenEtapaKanban && (
                  <button
                    type="button"
                    className="etapa-kanban-expand-btn"
                    onClick={onOpenEtapaKanban}
                    title="Abrir vista ampliada: kanban solo con las etapas de este sector"
                  >
                    Kanban etapas
                  </button>
                )}
              </div>
            </div>
          )}
          <div className="library-button-container">
          {onAddNewOrder && (
            <button
              type="button"
              className="brand-button"
              onClick={onAddNewOrder}
              title="Agregar Ficha"
            >
              + Agregar Ficha
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
          {onOptimizeSprint && (
            <button
              type="button"
              className="brand-button"
              onClick={onOptimizeSprint}
              title="Optimizar Sprint"
            >
              ⚡ Optimizar Sprint
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


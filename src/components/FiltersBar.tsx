import { useState } from 'react'
import type { RefObject } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ColumnConfig, Priority, TaskStatus } from '../types/board'
import { useAuth } from '../hooks/useAuth'
import { getApiService } from '../services/apiLoader'
import VentaRapidaModal from './VentaRapidaModal'
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
  onOpenLibrary?: () => void
  onAddNewOrder?: () => void
  onOptimizeSprint?: () => void
  /** Placeholder del buscador (ej. asesor-presupuestos: fichas FICHA-*, no OP de taller) */
  searchPlaceholder?: string
  /** Teléfono: solo buscador + alta ficha; sin chips ni prioridad. */
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
  onOpenLibrary,
  onAddNewOrder,
  onOptimizeSprint,
  searchPlaceholder = 'Buscar: OP, cliente, descripción, etiquetas, contacto, materiales…',
  compactPhone = false
}: FiltersBarProps) => {
  const navigate = useNavigate()
  const { isAdmin, isDiseno, canAccessMostradorViews, usuario, nombreVisible } = useAuth()
  const [copiandoBrief, setCopiandoBrief] = useState(false)
  const [showVentaRapida, setShowVentaRapida] = useState(false)

  const handleGenerarBriefLink = async () => {
    setCopiandoBrief(true)
    try {
      const usuarioId = usuario?.id ? parseInt(usuario.id.toString()) : undefined
      const response = await (await getApiService()).crearBriefPublico(usuarioId)
      
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
        {onAddNewOrder && (
          <div className="filters-bar-phone-row">
            <button type="button" className="brand-button filters-bar-phone-add" onClick={onAddNewOrder}>
              + Agregar ficha
            </button>
          </div>
        )}
        {canAccessMostradorViews && usuario && (
          <div className="filters-bar-phone-row filters-bar-phone-row--acciones">
            <button
              type="button"
              className="venta-rapida-button filters-bar-phone-add"
              onClick={() => setShowVentaRapida(true)}
              title="Venta (tecla V)"
            >
              💰 Venta
            </button>
            <button
              type="button"
              className="factura-button filters-bar-phone-add"
              onClick={() => navigate('/erp/facturas/nueva')}
              title="Emitir factura electrónica"
            >
              Facturar
            </button>
            <button
              type="button"
              className="presupuesto-button filters-bar-phone-add"
              onClick={() => navigate('/ventas?tab=presupuestos')}
              title="Crear presupuesto de venta"
            >
              Presupuesto
            </button>
          </div>
        )}
      </section>
    )
  }

  return (
    <>
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
                className={`priority-mis-trabajos${misTrabajosFilter ? ' active' : ''}`}
                onClick={() => onMisTrabajosChange(!misTrabajosFilter)}
                title="Solo fichas donde estás asignado como operario o figuras como quien trabaja la OP"
              >
                Mis trabajos
              </button>
            )}
          </div>
        </div>
        <div className="filter-right-section">
          <div className="library-button-container">
          {canAccessMostradorViews && usuario && (
            <button
              type="button"
              className="venta-rapida-button"
              onClick={() => setShowVentaRapida(true)}
              title="Registrar una venta sin salir del tablero (tecla V)"
            >
              💰 Venta
            </button>
          )}
          {canAccessMostradorViews && usuario && (
            <button
              type="button"
              className="factura-button"
              onClick={() => navigate('/erp/facturas/nueva')}
              title="Emitir factura electrónica AFIP"
            >
              Facturar
            </button>
          )}
          {canAccessMostradorViews && usuario && (
            <button
              type="button"
              className="presupuesto-button"
              onClick={() => navigate('/ventas?tab=presupuestos')}
              title="Crear presupuesto de venta"
            >
              Presupuesto
            </button>
          )}
          {onAddNewOrder && (
            <button
              type="button"
              className="brand-button"
              onClick={onAddNewOrder}
              title="Agregar Ficha"
            >
              + Ficha
            </button>
          )}
          {onOpenLibrary && (
            <button
              type="button"
              className="library-button"
              onClick={onOpenLibrary}
              title="Bibliotecas de OPs"
            >
              🔍 Bibliotecas
            </button>
          )}
          {onOptimizeSprint && (
            <button
              type="button"
              className="brand-button"
              onClick={onOptimizeSprint}
              title="Optimizar Sprint"
            >
              ⚡ Sprint
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
              {copiandoBrief ? '⏳…' : '📋 Brief'}
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
            style={{ borderColor: column.accent }}
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

    {showVentaRapida && usuario && (
      <VentaRapidaModal
        uiVariant="mostrador"
        usuarioId={usuario.id}
        usuarioNombre={nombreVisible}
        onClose={() => setShowVentaRapida(false)}
        onSuccess={() => setShowVentaRapida(false)}
      />
    )}
    </>
  )
}

export default FiltersBar


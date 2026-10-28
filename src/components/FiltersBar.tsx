import { useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ColumnConfig, Priority, TaskStatus } from '../types/board'
import { useAuth } from '../hooks/useAuth'
import { getApiService } from '../services/apiLoader'
import { VENTAS } from '../utils/ventasRoutes'
import { CLIENTES_CUENTA_CORRIENTE, CLIENTES_DASHBOARD } from '../utils/clientesRoutes'
import VentaRapidaModal from './VentaRapidaModal'
import BuscadorPrecios from './BuscadorPrecios'
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

function Atajo({ teclas }: { teclas: string }) {
  return (
    <span className="btn-atajo" aria-hidden>
      {teclas.split('').map((tecla, index) => (
        <kbd key={`${tecla}-${index}`}>{tecla.toUpperCase()}</kbd>
      ))}
    </span>
  )
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
  const {
    isAdmin,
    isDiseno,
    isTallerImprenta,
    isTallerGrafico,
    canAccessMostradorViews,
    canManageCaja,
    canManageCompras,
    usuario,
    nombreVisible
  } = useAuth()
  const showAccionesMostrador =
    Boolean(usuario) && (canAccessMostradorViews || isTallerImprenta || isTallerGrafico)
  const [copiandoBrief, setCopiandoBrief] = useState(false)
  const [showVentaRapida, setShowVentaRapida] = useState(false)
  const accionesRef = useRef({
    navigate,
    onAddNewOrder,
    onOpenLibrary,
    usuario,
    showAccionesMostrador,
    canManageCaja
  })
  accionesRef.current = {
    navigate,
    onAddNewOrder,
    onOpenLibrary,
    usuario,
    showAccionesMostrador,
    canManageCaja
  }

  useEffect(() => {
    if (compactPhone) return

    const ir = (key: string) => {
      const a = accionesRef.current
      if (!a.usuario) return
      if (key === 'e') a.navigate(CLIENTES_DASHBOARD)
      else if (key === 'u' && a.showAccionesMostrador) a.navigate(CLIENTES_CUENTA_CORRIENTE)
      else if (key === 'f' && a.showAccionesMostrador) a.navigate('/erp/facturas/nueva')
      else if (key === 'p') a.navigate('/ventas?tab=presupuestos')
      else if (key === 'j' && (a.canManageCaja || a.showAccionesMostrador)) {
        a.navigate(isAdmin ? '/caja/dashboard/admin' : '/caja/dashboard/caja')
      } else if (key === 'b') a.onOpenLibrary?.()
      else if (key === 'r') window.dispatchEvent(new Event('plotlab-abrir-precios'))
    }

    const onKey = (event: KeyboardEvent) => {
      if (!accionesRef.current.usuario || event.defaultPrevented || event.repeat) return
      if (event.altKey || event.ctrlKey || event.metaKey) return
      const target = event.target as HTMLElement | null
      if (target) {
        const tag = target.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) return
      }
      const key = event.key.toLowerCase()
      if (key.length !== 1 || !'eufpjbr'.includes(key)) return
      event.preventDefault()
      event.stopPropagation()
      ir(key)
    }

    window.addEventListener('keydown', onKey, true)
    return () => {
      window.removeEventListener('keydown', onKey, true)
    }
  }, [compactPhone, isAdmin])

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
      <section className="filters-bar filters-bar--phone" aria-label="Buscar en el tablero">
        <div className="filters-bar-phone-toolbar">
          <div className="filters-bar-phone-row search-filter">
            <input
              type="search"
              placeholder={searchPlaceholder}
              value={searchQuery}
              onChange={(event) => onSearchChange(event.target.value)}
              ref={searchInputRef}
              enterKeyHint="search"
            />
          </div>
          {onAddNewOrder ? (
            <button type="button" className="brand-button filters-bar-phone-add" onClick={onAddNewOrder}>
              + Ficha
            </button>
          ) : null}
        </div>
      </section>
    )
  }

  return (
    <>
    <section className="filters-bar">
      <div className="search-filter">
        <label className="search-filter__label" htmlFor="tablero-buscar">
          Buscar
        </label>
        <input
          id="tablero-buscar"
          type="text"
          placeholder={searchPlaceholder}
          value={searchQuery}
          onChange={(event) => onSearchChange(event.target.value)}
          ref={searchInputRef}
        />
      </div>

      <div className="filter-grid">
        <BuscadorPrecios />
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
          <div className="library-button-container" role="toolbar" aria-label="Acciones rápidas">
            {(showAccionesMostrador || usuario || canManageCaja) && (
              <div className="library-button-group" data-group="comercial">
                {showAccionesMostrador && (
                  <button
                    type="button"
                    className="venta-rapida-button"
                    onClick={() => setShowVentaRapida(true)}
                    title="Registrar una venta sin salir del tablero"
                  >
                    <span className="btn-ico" aria-hidden>
                      💰
                    </span>
                    Venta
                    <Atajo teclas="v" />
                  </button>
                )}
                {showAccionesMostrador && (
                  <button
                    type="button"
                    className="cc-button"
                    onClick={() => navigate(CLIENTES_CUENTA_CORRIENTE)}
                    title="Cuenta corriente de clientes"
                  >
                    CC
                    <Atajo teclas="u" />
                  </button>
                )}
                {usuario && (
                  <button
                    type="button"
                    className="clientes-button"
                    onClick={() => navigate(CLIENTES_DASHBOARD)}
                    title="Buscar y editar clientes"
                  >
                    Clientes
                    <Atajo teclas="e" />
                  </button>
                )}
                {showAccionesMostrador && (
                  <button
                    type="button"
                    className="factura-button"
                    onClick={() => navigate('/erp/facturas/nueva')}
                    title="Emitir factura electrónica AFIP"
                  >
                    Facturar
                    <Atajo teclas="f" />
                  </button>
                )}
                {usuario && (
                  <button
                    type="button"
                    className="presupuesto-button"
                    onClick={() => navigate('/ventas?tab=presupuestos')}
                    title="Ver y crear presupuestos de venta"
                  >
                    Presupuesto
                    <Atajo teclas="p" />
                  </button>
                )}
                {usuario && (
                  <button
                    type="button"
                    className="ventas-nav-button"
                    onClick={() => navigate(VENTAS)}
                    title="Pipeline y listado de ventas"
                  >
                    Ventas
                  </button>
                )}
                {canManageCompras && (
                  <button
                    type="button"
                    className="compras-button"
                    onClick={() => navigate('/compras/dashboard')}
                    title="Pedidos y gestión de compras"
                  >
                    Compras
                  </button>
                )}
                {(canManageCaja || showAccionesMostrador) && (
                  <button
                    type="button"
                    className="caja-button"
                    onClick={() => navigate(isAdmin ? '/caja/dashboard/admin' : '/caja/dashboard/caja')}
                    title="Dashboard de caja"
                  >
                    Caja
                    <Atajo teclas="j" />
                  </button>
                )}
                {(isAdmin || showAccionesMostrador) && (
                  <button
                    type="button"
                    className="erp-button"
                    onClick={() => navigate('/erp')}
                    title="Panel ERP"
                  >
                    ERP
                  </button>
                )}
              </div>
            )}
            <div className="library-button-group" data-group="tablero">
              {onAddNewOrder && (
                <button type="button" className="brand-button" onClick={onAddNewOrder} title="Agregar Ficha">
                  <span className="btn-ico" aria-hidden>
                    +
                  </span>
                  Ficha
                  <Atajo teclas="c" />
                </button>
              )}
              {onOpenLibrary && (
                <button
                  type="button"
                  className="library-button"
                  onClick={onOpenLibrary}
                  title="Bibliotecas de OPs"
                >
                  <span className="btn-ico" aria-hidden>
                    🔍
                  </span>
                  Bibliotecas
                  <Atajo teclas="b" />
                </button>
              )}
              {onOptimizeSprint && (
                <button
                  type="button"
                  className="brand-button brand-button--sprint"
                  onClick={onOptimizeSprint}
                  title="Optimizar Sprint"
                >
                  <span className="btn-ico" aria-hidden>
                    ⚡
                  </span>
                  Sprint
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
                  {copiandoBrief ? '…' : (
                    <>
                      <span className="btn-ico" aria-hidden>
                        📋
                      </span>
                      Brief
                    </>
                  )}
                </button>
              )}
            </div>
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


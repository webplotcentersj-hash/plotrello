import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import './MenuOnlyPage.css'

type MenuItem = {
  id: string
  title: string
  description: string
  icon: string
  path: string
  enabled: boolean
}

export default function MenuOnlyPage({ onLogout }: { onLogout: () => void }) {
  const navigate = useNavigate()
  const {
    usuario,
    isAdmin,
    isMostrador,
    canManageCaja,
    canManageCompras,
    canManageRecursosHumanos,
    canManagePresupuestos,
    canAccessAtencionPublico
  } = useAuth()

  const items = useMemo<MenuItem[]>(() => {
    const common = [
      {
        id: 'tablero',
        title: 'Tablero',
        description: 'Kanban principal y seguimiento de OPs',
        icon: '🧩',
        path: '/',
        enabled: !!usuario
      },
      {
        id: 'atencion-publico',
        title: 'Atención al Público',
        description: 'Reclamos y atención al cliente',
        icon: '🗣️',
        path: '/atencion-publico',
        enabled: !!usuario && canAccessAtencionPublico
      }
    ] satisfies MenuItem[]

    const byRole: MenuItem[] = [
      {
        id: 'mostrador',
        title: 'Mostrador',
        description: 'Entregas, ventas, clientes y reportes',
        icon: '🖥️',
        path: '/mostrador/dashboard',
        enabled: isAdmin || isMostrador
      },
      {
        id: 'caja',
        title: 'Caja',
        description: 'Movimientos, cuentas y cobranzas',
        icon: '💳',
        path: '/caja/dashboard',
        enabled: isAdmin || canManageCaja
      },
      {
        id: 'compras',
        title: 'Compras',
        description: 'Pedidos, stock y proveedores',
        icon: '🛒',
        path: '/compras/dashboard',
        enabled: isAdmin || canManageCompras
      },
      {
        id: 'erp',
        title: 'ERP',
        description: 'Contabilidad, tesorería, impuestos y más',
        icon: '🏢',
        path: '/erp',
        enabled: isAdmin
      },
      {
        id: 'presupuestos',
        title: 'Presupuestos',
        description: 'Oportunidades, seguimiento y conversiones',
        icon: '🧾',
        path: '/asesor-presupuestos',
        enabled: isAdmin || canManagePresupuestos
      },
      {
        id: 'rrhh',
        title: 'RRHH',
        description: 'Usuarios, reportes, horarios y permisos',
        icon: '👥',
        path: '/rrhh/dashboard',
        enabled: isAdmin || canManageRecursosHumanos
      }
    ]

    return [...byRole.filter((i) => i.enabled), ...common]
  }, [
    canAccessAtencionPublico,
    canManageCaja,
    canManageCompras,
    canManagePresupuestos,
    canManageRecursosHumanos,
    isAdmin,
    isMostrador,
    usuario
  ])

  const [selectedId, setSelectedId] = useState<string | null>(items[0]?.id ?? null)
  const selected = useMemo(() => items.find((i) => i.id === selectedId) ?? null, [items, selectedId])

  const onEnter = useCallback(() => {
    if (!selected) return
    navigate(selected.path)
  }, [navigate, selected])

  return (
    <div className="menu-only-page">
      <header className="menu-only-header">
        <div className="menu-only-title">
          <h1>Menú</h1>
          <p>Seleccioná una sección para entrar</p>
        </div>
        <div className="menu-only-user">
          {usuario ? (
            <>
              <div className="menu-only-user-name">{usuario.nombre}</div>
              <div className="menu-only-user-role">{usuario.rol}</div>
            </>
          ) : (
            <div className="menu-only-user-name">Sin sesión</div>
          )}
        </div>
        <div className="menu-only-actions">
          <button type="button" className="btn-secondary" onClick={() => navigate('/')} disabled={!usuario}>
            Ir al tablero
          </button>
          <button type="button" className="btn-primary" onClick={onLogout}>
            Salir
          </button>
        </div>
      </header>

      <main className="menu-only-main">
        <section className="menu-only-grid" aria-label="Opciones del menú">
          {items.map((it) => {
            const isSelected = it.id === selectedId
            return (
              <button
                key={it.id}
                type="button"
                className={`menu-only-card${isSelected ? ' is-selected' : ''}`}
                onClick={() => setSelectedId(it.id)}
                onDoubleClick={() => navigate(it.path)}
              >
                <div className="menu-only-card-icon" aria-hidden>
                  {it.icon}
                </div>
                <div className="menu-only-card-body">
                  <div className="menu-only-card-title">{it.title}</div>
                  <div className="menu-only-card-desc">{it.description}</div>
                </div>
              </button>
            )
          })}
        </section>

        <footer className="menu-only-footer">
          <div className="menu-only-selected">
            {selected ? (
              <>
                <div className="menu-only-selected-title">
                  Seleccionado: <strong>{selected.title}</strong>
                </div>
                <div className="menu-only-selected-desc">{selected.description}</div>
              </>
            ) : (
              <div className="menu-only-selected-title">Seleccioná una opción</div>
            )}
          </div>
          <button type="button" className="btn-primary menu-only-enter" onClick={onEnter} disabled={!selected}>
            Entrar
          </button>
        </footer>
      </main>
    </div>
  )
}


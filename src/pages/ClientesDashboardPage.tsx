import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import apiService from '../services/api'
import {
  ATENCION_PUBLICO,
  CLIENTES_AGREGAR,
  CLIENTES_BUSCAR,
  CLIENTES_CUENTA_CORRIENTE,
  CLIENTES_FRECUENTES,
  CLIENTES_WEB_GESTION
} from '../utils/clientesRoutes'
import { VENTAS } from '../utils/ventasRoutes'
import './ClientesDashboardPage.css'

type NavTileProps = {
  title: string
  desc: string
  icon: string
  accent?: string
  badge?: number
  onClick: () => void
}

function NavTile({ title, desc, icon, accent, badge, onClick }: NavTileProps) {
  return (
    <button
      type="button"
      className={`cl-dash-tile${accent ? ` cl-dash-tile--${accent}` : ''}`}
      onClick={onClick}
    >
      <span className="cl-dash-tile__icon" aria-hidden>
        {icon}
      </span>
      <span className="cl-dash-tile__body">
        <strong>{title}</strong>
        <span>{desc}</span>
      </span>
      {badge != null && badge > 0 && <span className="cl-dash-tile__badge">{badge}</span>}
      <span className="cl-dash-tile__arrow" aria-hidden>
        →
      </span>
    </button>
  )
}

export default function ClientesDashboardPage() {
  const navigate = useNavigate()
  const { canAccessMostradorViews, canAccessClientesConsulta, loading: authLoading } = useAuth()
  const [stats, setStats] = useState({ ccPendientes: 0, ccAprobados: 0 })

  useEffect(() => {
    if (authLoading) return
    if (!canAccessClientesConsulta) {
      navigate('/', { replace: true })
      return
    }
    if (!canAccessMostradorViews) return
    void apiService.listClientesCuentaCorriente().then((res) => {
      if (!res.success || !res.data) return
      const rows = res.data
      setStats({
        ccPendientes: rows.filter((r) => r.estado === 'pendiente').length,
        ccAprobados: rows.filter((r) => r.estado === 'aprobada').length
      })
    })
  }, [authLoading, canAccessClientesConsulta, canAccessMostradorViews, navigate])

  if (authLoading) {
    return (
      <div className="cl-dash-page">
        <div className="cl-dash-loading">Cargando…</div>
      </div>
    )
  }

  if (!canAccessClientesConsulta) return null

  return (
    <div className="cl-dash-page">
      <header className="cl-dash-header">
        <div className="cl-dash-header__brand">
          <span className="cl-dash-header__icon" aria-hidden>
            👥
          </span>
          <div>
            <h1>Clientes</h1>
            <p>
              {canAccessMostradorViews
                ? 'Buscar, alta, portal web, atención y cuenta corriente'
                : 'Consulta de clientes, frecuentes y atención'}
            </p>
          </div>
        </div>
        <button
          type="button"
          className="cl-dash-btn cl-dash-btn--ghost"
          onClick={() => navigate('/admin')}
        >
          ← Volver a admin
        </button>
      </header>

      <section className="cl-dash-section">
        <header className="cl-dash-section__head">
          <h2>Gestión de clientes</h2>
          <p>
            {canAccessMostradorViews
              ? 'Buscar, alta, VIP, portal y cobranzas'
              : 'Buscar ficha, frecuentes y atención'}
          </p>
        </header>
        <div className="cl-dash-grid">
          <NavTile
            title="Buscar cliente"
            desc="Nombre, DNI, CUIT, teléfono o email"
            icon="🔍"
            accent="search"
            onClick={() => navigate(CLIENTES_BUSCAR)}
          />
          {canAccessMostradorViews && (
            <NavTile
              title="Agregar cliente"
              desc="Alta rápida sin acceso web"
              icon="➕"
              accent="add"
              onClick={() => navigate(CLIENTES_AGREGAR)}
            />
          )}
          <NavTile
            title="Clientes frecuentes"
            desc="VIP, preferencias y historial"
            icon="⭐"
            accent="vip"
            onClick={() => navigate(CLIENTES_FRECUENTES)}
          />
          {canAccessMostradorViews && (
            <NavTile
              title="Cuenta corriente"
              desc="Saldos, cobros y altas CC"
              icon="💳"
              accent="cc"
              badge={stats.ccPendientes}
              onClick={() => navigate(CLIENTES_CUENTA_CORRIENTE)}
            />
          )}
          {canAccessMostradorViews && (
            <NavTile
              title="Gestión clientes web"
              desc="Alta, edición y acceso al portal"
              icon="🌐"
              accent="web"
              onClick={() => navigate(CLIENTES_WEB_GESTION)}
            />
          )}
          {canAccessMostradorViews && (
            <NavTile
              title="Ventas"
              desc="Pipeline, cobros y venta rápida"
              icon="💰"
              accent="add"
              onClick={() => navigate(VENTAS)}
            />
          )}
          <NavTile
            title="Atención al público"
            desc="Cola, turnos y totem"
            icon="🙋"
            accent="atencion"
            onClick={() => navigate(ATENCION_PUBLICO)}
          />
        </div>
        {canAccessMostradorViews && stats.ccAprobados > 0 && (
          <p className="cl-dash-meta">
            {stats.ccAprobados} cuenta{stats.ccAprobados === 1 ? '' : 's'} corriente aprobada
            {stats.ccAprobados === 1 ? '' : 's'}
            {stats.ccPendientes > 0 ? ` · ${stats.ccPendientes} pendiente${stats.ccPendientes === 1 ? '' : 's'}` : ''}
          </p>
        )}
      </section>
    </div>
  )
}

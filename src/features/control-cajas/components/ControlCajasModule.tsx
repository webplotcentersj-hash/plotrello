import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../../hooks/useAuth'
import { NAV_ADMIN, NAV_CAJA } from '../constants'
import type { CajaSectionId } from '../types'
import { getParams, usesRemoteStorage } from '../cajaRepository'
import { resolveUsuarioCajaEtiqueta } from '../cajaUsuarioDisplay'
import { DEFAULT_CAJERAS } from '../constants'
import CajaSectionTablero from './CajaSectionTablero'
import CajaTableroAdmin from './CajaTableroAdmin'
import CajaSectionCierreForm from './CajaSectionCierreForm'
import CajaSectionCierresList from './CajaSectionCierresList'
import CajaSectionArqueo from './CajaSectionArqueo'
import CajaSectionMovimientos from './CajaSectionMovimientos'
import CajaSectionPaseCaja from './CajaSectionPaseCaja'
import CajaSectionCierreTurno from './CajaSectionCierreTurno'
import CajaSectionEgresos from './CajaSectionEgresos'
import CajaSectionHistorial, { CajaSectionArqueosAdmin } from './CajaSectionHistorial'
import CajaSectionConcilMP from './CajaSectionConcilMP'
import CajaSectionConcilBanco from './CajaSectionConcilBanco'
import CajaSectionDiferencias from './CajaSectionDiferencias'
import CajaSectionVentasDiarias from './CajaSectionVentasDiarias'
import CajaSectionConfig from './CajaSectionConfig'
import CajaPlotAI from './CajaPlotAI'
import CajaCentroInteligente from './CajaCentroInteligente'
import CajaInteligenciaBar from './CajaInteligenciaBar'
import '../../../pages/CajaDashboardPage.css'

const SECTION_TITLES: Record<CajaSectionId, string> = {
  tablero_admin: 'Tablero',
  centro_ia: 'Centro de inteligencia',
  tablero: 'Tablero ERP',
  cierres_new: 'Nuevo cierre',
  cierres: 'Cierres',
  arqueo: 'Mi arqueo',
  cierre_turno: 'Cierre de turno',
  pase_caja: 'Pase de caja',
  egresos: 'Egresos',
  movimientos: 'Mis movimientos',
  historial: 'Historial',
  arqueos_admin: 'Arqueos',
  movimientos_admin: 'Movimientos',
  concil_mp: 'Conciliación Mercado Pago',
  concil_banco: 'Conciliación bancaria',
  diferencias: 'Diferencias',
  ventas: 'Ventas diarias',
  config: 'Configuración',
  asistente: 'Asistente IA'
}

export default function ControlCajasModule() {
  const navigate = useNavigate()
  const {
    usuario,
    isAdmin,
    canManageCaja,
    canAccessTotemImpresionPanel,
    loading: authLoading
  } = useAuth()
  const canViewIngresos = isAdmin
  const usuarioId = usuario?.id
  const [usuarioEtiqueta, setUsuarioEtiqueta] = useState(
    () => resolveUsuarioCajaEtiqueta(usuario?.nombre ?? 'Usuario')
  )

  useEffect(() => {
    void getParams().then((p) => {
      const cajeras = p.cajeras?.length ? p.cajeras : DEFAULT_CAJERAS
      setUsuarioEtiqueta(resolveUsuarioCajaEtiqueta(usuario?.nombre ?? 'Usuario', cajeras))
    })
  }, [usuario?.nombre])

  const [section, setSection] = useState<CajaSectionId>(isAdmin ? 'tablero_admin' : 'arqueo')
  const [editCierreId, setEditCierreId] = useState<string | null>(null)
  const [remote, setRemote] = useState<boolean | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const nav = useMemo(() => (isAdmin ? NAV_ADMIN : NAV_CAJA), [isAdmin])

  useEffect(() => {
    if (!authLoading && !canManageCaja) navigate('/')
  }, [authLoading, canManageCaja, navigate])

  useEffect(() => {
    void usesRemoteStorage().then(setRemote)
  }, [])

  useEffect(() => {
    setSection(isAdmin ? 'tablero_admin' : 'arqueo')
    setEditCierreId(null)
  }, [isAdmin])

  const bumpRefresh = () => setRefreshKey((k) => k + 1)

  if (authLoading || !canManageCaja) {
    return (
      <div className="caja-dashboard-page">
        <div className="caja-loading-container">
          <p>Verificando permisos…</p>
        </div>
      </div>
    )
  }

  const showPageTitle =
    section !== 'tablero_admin' && section !== 'centro_ia' && section !== 'cierres_new'

  const goSection = (s: CajaSectionId) => {
    setEditCierreId(null)
    setSection(s)
  }

  const showIntelBar =
    isAdmin && section !== 'tablero_admin' && section !== 'centro_ia' && section !== 'asistente'

  return (
    <div className="caja-dashboard-page caja-control-module">
      <header className="caja-header caja-cc-module-header">
        <div className="caja-header-content">
          <div className="caja-header-title-block">
            <h1>Control de Cajas</h1>
            <p className="caja-header-lead">
              {isAdmin
                ? 'Cierre diario, conciliaciones MP y banco, movimientos entre cajas, seguimiento de diferencias.'
                : 'Arqueo, movimientos y planilla PDF (vista caja).'}
            </p>
            {remote === false && (
              <p className="caja-cc-storage-hint">
                Datos en este navegador. Ejecutá los patches SQL en Supabase para guardar en la nube.
              </p>
            )}
          </div>
          <div className="caja-header-actions">
            <button type="button" className="btn-secondary" onClick={() => navigate('/crm-ventas')}>
              CRM ventas
            </button>
            {canAccessTotemImpresionPanel && (
              <button type="button" className="btn-secondary" onClick={() => navigate('/impresoras/totem')}>
                Tótem
              </button>
            )}
            <button type="button" className="btn-primary" onClick={() => navigate('/erp')}>
              ERP
            </button>
          </div>
        </div>
      </header>

      <div className={`caja-cc-role-banner ${isAdmin ? 'admin' : 'caja'}`}>
        <span>
          <strong>{isAdmin ? 'Administración' : 'Caja'}</strong> — {usuarioEtiqueta}
          {!canViewIngresos && ' · Los ingresos del tablero ERP solo los ve administración.'}
        </span>
      </div>

      <div className="caja-cc-layout">
        <nav className="caja-cc-sidebar" aria-label="Secciones de caja">
          {nav.map((item, idx) =>
            'header' in item ? (
              <div key={`h-${idx}`} className="caja-cc-nav-section">
                {item.header}
              </div>
            ) : (
              <button
                key={item.section}
                type="button"
                className={`caja-cc-nav-item${section === item.section ? ' active' : ''}`}
                onClick={() => {
                  setEditCierreId(null)
                  setSection(item.section)
                }}
              >
                <span className="caja-cc-nav-icon">{item.icon}</span>
                {item.label}
              </button>
            )
          )}
        </nav>

        <main className="caja-cc-content" key={refreshKey}>
          {showIntelBar && (
            <CajaInteligenciaBar
              isAdmin={isAdmin}
              usuarioNombre={usuarioEtiqueta}
              usuarioId={usuarioId}
              onNavigate={goSection}
            />
          )}

          {showPageTitle && (
            <div className="caja-cc-page-head compact">
              <h2>{SECTION_TITLES[section]}</h2>
            </div>
          )}

          {section === 'tablero_admin' && isAdmin && (
            <>
              <CajaCentroInteligente
                isAdmin
                usuarioNombre={usuarioEtiqueta}
                usuarioId={usuarioId}
                onNavigate={goSection}
                compact
              />
              <CajaTableroAdmin
                onNuevoCierre={() => {
                  setEditCierreId(null)
                  setSection('cierres_new')
                }}
                onVerCierres={() => setSection('cierres')}
              />
            </>
          )}

          {section === 'centro_ia' && isAdmin && (
            <CajaCentroInteligente
              isAdmin
              usuarioNombre={usuarioEtiqueta}
              usuarioId={usuarioId}
              onNavigate={goSection}
            />
          )}

          {section === 'cierres_new' && isAdmin && (
            <CajaSectionCierreForm
              editId={editCierreId}
              onSaved={() => {
                setEditCierreId(null)
                bumpRefresh()
                setSection('cierres')
              }}
              onCancel={() => {
                setEditCierreId(null)
                setSection('cierres')
              }}
            />
          )}

          {section === 'cierres' && isAdmin && (
            <CajaSectionCierresList
              onNuevo={() => {
                setEditCierreId(null)
                setSection('cierres_new')
              }}
              onEditar={(id) => {
                setEditCierreId(id)
                setSection('cierres_new')
              }}
            />
          )}

          {section === 'tablero' && isAdmin && <CajaSectionTablero canViewIngresos={canViewIngresos} />}

          {section === 'arqueo' && (
            <>
              <CajaCentroInteligente
                isAdmin={false}
                usuarioNombre={usuarioEtiqueta}
                usuarioId={usuarioId}
                compact
              />
              <CajaSectionArqueo
                usuarioNombre={usuarioEtiqueta}
                usuarioId={usuarioId}
                soloCajasOperativas
                fijarCajaUsuario
              />
            </>
          )}

          {section === 'cierre_turno' && (
            <CajaSectionCierreTurno usuarioNombre={usuarioEtiqueta} usuarioId={usuarioId} />
          )}

          {section === 'pase_caja' && (
            <CajaSectionPaseCaja
              usuarioNombre={usuarioEtiqueta}
              usuarioId={usuarioId}
              soloMisPases={!isAdmin}
            />
          )}

          {section === 'egresos' && (
            <CajaSectionEgresos
              isAdmin={isAdmin}
              usuarioNombre={usuarioEtiqueta}
              usuarioId={usuarioId}
            />
          )}

          {section === 'movimientos' && (
            <CajaSectionMovimientos
              usuarioNombre={usuarioEtiqueta}
              usuarioId={usuarioId}
              soloMisMovimientos
              allowExcelImport
              title="Mis movimientos"
            />
          )}

          {section === 'historial' && (
            <CajaSectionHistorial usuarioNombre={usuarioEtiqueta} usuarioId={usuarioId} />
          )}

          {section === 'arqueos_admin' && isAdmin && <CajaSectionArqueosAdmin />}

          {section === 'movimientos_admin' && isAdmin && (
            <CajaSectionMovimientos
              usuarioNombre={usuarioEtiqueta}
              usuarioId={usuarioId}
              soloMisMovimientos={false}
              allowExcelImport
              title="Movimientos entre cajas"
            />
          )}

          {section === 'concil_mp' && isAdmin && <CajaSectionConcilMP />}
          {section === 'concil_banco' && isAdmin && <CajaSectionConcilBanco />}
          {section === 'diferencias' && isAdmin && <CajaSectionDiferencias />}
          {section === 'ventas' && isAdmin && <CajaSectionVentasDiarias />}
          {section === 'config' && isAdmin && <CajaSectionConfig />}
          {section === 'asistente' && (
            <CajaPlotAI isAdmin={isAdmin} usuarioNombre={usuarioEtiqueta} usuarioId={usuarioId} />
          )}
        </main>
      </div>
    </div>
  )
}

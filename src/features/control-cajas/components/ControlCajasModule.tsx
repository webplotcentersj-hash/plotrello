import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
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
import CajaSectionTraspasos from './CajaSectionTraspasos'
import CajaSectionHistorial, { CajaSectionArqueosAdmin } from './CajaSectionHistorial'
import CajaSectionConcilMP from './CajaSectionConcilMP'
import CajaSectionConcilBanco from './CajaSectionConcilBanco'
import CajaSectionDiferencias from './CajaSectionDiferencias'
import CajaSectionVentasDiarias from './CajaSectionVentasDiarias'
import CajaSectionConfig from './CajaSectionConfig'
import CajaPlotAI from './CajaPlotAI'
import CajaCentroInteligente from './CajaCentroInteligente'
import CajaImportPlanillaPdf from './CajaImportPlanillaPdf'
import CajaImportComprobantesMedios from './CajaImportComprobantesMedios'
import CajaPlanillasRecibidasPanel from './CajaPlanillasRecibidasPanel'
import CajaInteligenciaBar from './CajaInteligenciaBar'
import CajaVolverPlotLab from './CajaVolverPlotLab'
import type { PlanillaCajaParsed } from '../parsePlanillaCajaPdf'
import '../../../pages/CajaDashboardPage.css'

const SECTION_TITLES: Record<CajaSectionId, string> = {
  tablero_admin: 'Hoy',
  centro_ia: 'Centro de inteligencia',
  tablero: 'Tablero ERP',
  cierres_new: 'Nuevo cierre',
  cierres: 'Cierres',
  arqueo: 'Mi arqueo',
  cierre_turno: 'Cierre de turno',
  pase_caja: 'Pase de caja',
  traspasos: 'Traspasos',
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

export type VistaCajaModulo = 'admin' | 'operativa'

function vistaDesdePath(pathname: string): VistaCajaModulo | null {
  if (pathname.endsWith('/admin')) return 'admin'
  if (pathname.endsWith('/caja') && pathname.includes('/caja/dashboard/')) return 'operativa'
  return null
}

function seccionInicial(vista: VistaCajaModulo): CajaSectionId {
  return vista === 'admin' ? 'tablero_admin' : 'arqueo'
}

export default function ControlCajasModule() {
  const navigate = useNavigate()
  const location = useLocation()
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

  const pathVista = useMemo(() => vistaDesdePath(location.pathname), [location.pathname])
  const [vista, setVista] = useState<VistaCajaModulo>(() => {
    if (!isAdmin) return 'operativa'
    return pathVista ?? 'admin'
  })
  const enVistaAdmin = isAdmin && vista === 'admin'

  const [section, setSection] = useState<CajaSectionId>(() =>
    isAdmin ? seccionInicial(pathVista ?? 'admin') : 'arqueo'
  )
  const [editCierreId, setEditCierreId] = useState<string | null>(null)
  const [remote, setRemote] = useState<boolean | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  /** Recarga movimientos en arqueo sin remontar toda la página (evita cierre al importar planilla). */
  const [movimientosRefreshKey, setMovimientosRefreshKey] = useState(0)
  const [planillaActiva, setPlanillaActiva] = useState<PlanillaCajaParsed | null>(null)

  const nav = useMemo(() => (enVistaAdmin ? NAV_ADMIN : NAV_CAJA), [enVistaAdmin])

  const cambiarVista = (v: VistaCajaModulo) => {
    setVista(v)
    setEditCierreId(null)
    setPlanillaActiva(null)
    setSection(seccionInicial(v))
    navigate(v === 'admin' ? '/caja/dashboard/admin' : '/caja/dashboard/caja', { replace: true })
  }

  useEffect(() => {
    if (!authLoading && !canManageCaja) navigate('/')
  }, [authLoading, canManageCaja, navigate])

  useEffect(() => {
    if (authLoading || !canManageCaja || !isAdmin) return
    const p = location.pathname.replace(/\/$/, '')
    if (p === '/caja/dashboard') {
      navigate('/caja/dashboard/admin', { replace: true })
    }
  }, [authLoading, canManageCaja, isAdmin, location.pathname, navigate])

  useEffect(() => {
    if (pathVista) setVista(pathVista)
  }, [pathVista])

  useEffect(() => {
    void usesRemoteStorage().then(setRemote)
  }, [])

  useEffect(() => {
    if (!isAdmin) {
      setVista('operativa')
      setSection('arqueo')
      setEditCierreId(null)
      return
    }
    if (pathVista) {
      setVista(pathVista)
      setSection(seccionInicial(pathVista))
      setEditCierreId(null)
    }
  }, [isAdmin, pathVista])

  const bumpRefresh = () => setRefreshKey((k) => k + 1)

  if (authLoading || !canManageCaja) {
    return (
      <div className="caja-dashboard-page">
        <div className="caja-loading-container">
          <p>Verificando permisos…</p>
          <CajaVolverPlotLab />
        </div>
      </div>
    )
  }

  const showPageTitle =
    section !== 'tablero_admin' &&
    section !== 'centro_ia' &&
    section !== 'cierres_new' &&
    section !== 'cierres'

  const SECCIONES_PLANILLA: CajaSectionId[] = ['arqueo', 'movimientos', 'movimientos_admin', 'cierres']

  const goSection = (s: CajaSectionId) => {
    setEditCierreId(null)
    setSection(s)
    if (!SECCIONES_PLANILLA.includes(s)) setPlanillaActiva(null)
  }

  const seccionConPlanilla = SECCIONES_PLANILLA.includes(section)
  const adminVePlanillasRecibidas = enVistaAdmin && section === 'cierres'

  const refreshMovimientos = () => setMovimientosRefreshKey((k) => k + 1)

  const panelPlanillaIntel = seccionConPlanilla ? (
    <section className="caja-cc-planilla-hub" aria-label="Planilla PDF y concordancia">
      <CajaCentroInteligente
        isAdmin={isAdmin}
        usuarioNombre={usuarioEtiqueta}
        usuarioId={usuarioId}
        onNavigate={goSection}
        compact
        collapsible
        defaultExpanded={false}
        planillaActiva={planillaActiva}
      />
      <CajaImportPlanillaPdf
        usuarioNombre={usuarioEtiqueta}
        usuarioId={usuarioId}
        modoArqueo={section === 'arqueo'}
        onPlanillaParsed={setPlanillaActiva}
        onImported={() => {
          setPlanillaActiva(null)
          refreshMovimientos()
        }}
      />
      {section === 'arqueo' && (
        <p className="caja-cc-help caja-cc-arqueo-mp-hint">
          Los comprobantes MP / POS son para conciliar tarjetas y transferencias; no forman parte del conteo de
          billetes.
        </p>
      )}
      {section === 'arqueo' && (
        <CajaImportComprobantesMedios
          usuarioNombre={usuarioEtiqueta}
          usuarioId={usuarioId}
          onImported={refreshMovimientos}
        />
      )}
      {adminVePlanillasRecibidas && (
        <CajaPlanillasRecibidasPanel
          titulo="Planillas recibidas de caja (mismo detalle que el PDF)"
          onPlanillaLoaded={setPlanillaActiva}
        />
      )}
    </section>
  ) : null

  const showIntelBar =
    enVistaAdmin &&
    (section === 'concil_mp' || section === 'concil_banco' || section === 'centro_ia')

  return (
    <div className="caja-dashboard-page caja-control-module">
      <header className="caja-header caja-cc-module-header">
        <div className="caja-header-content">
          <div className="caja-header-title-block">
            <h1>Control de Cajas</h1>
            <p className="caja-header-lead">
              {enVistaAdmin
                ? 'Fondo recomendado $100.000 entre cajas (editable por cajeras), resto a administración, egresos e ingresos de hoy.'
                : 'Arqueo y cierre de turno. Podés ajustar el fondo de caja en cada cierre (recomendado $100.000).'}
            </p>
            {remote === false && (
              <p className="caja-cc-storage-hint">
                Datos en este navegador. Ejecutá los patches SQL en Supabase para guardar en la nube.
              </p>
            )}
          </div>
          <div className="caja-header-actions">
            <CajaVolverPlotLab />
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

      <div className={`caja-cc-role-banner ${enVistaAdmin ? 'admin' : 'caja'}`}>
        <span>
          <strong>{enVistaAdmin ? 'Administración' : 'Caja'}</strong> — {usuarioEtiqueta}
          {!canViewIngresos && enVistaAdmin && ' · Los ingresos del tablero ERP solo los ve administración.'}
        </span>
        {isAdmin && (
          <div className="caja-cc-vista-switch" role="tablist" aria-label="Vista del módulo de caja">
            <button
              type="button"
              role="tab"
              aria-selected={enVistaAdmin}
              className={`caja-cc-vista-btn${enVistaAdmin ? ' active' : ''}`}
              onClick={() => cambiarVista('admin')}
            >
              Administración
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={!enVistaAdmin}
              className={`caja-cc-vista-btn${!enVistaAdmin ? ' active' : ''}`}
              onClick={() => cambiarVista('operativa')}
            >
              Operación caja
            </button>
          </div>
        )}
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
          <div className="caja-cc-sidebar-foot">
            <CajaVolverPlotLab block />
          </div>
        </nav>

        <main className="caja-cc-content" key={refreshKey}>
          <div className="caja-cc-content-plotlab-bar">
            <CajaVolverPlotLab small />
          </div>
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
              <CajaVolverPlotLab small />
            </div>
          )}

          {section === 'tablero_admin' && enVistaAdmin && (
            <CajaTableroAdmin
              onCierreTurno={() => setSection('cierre_turno')}
              onEgresos={() => setSection('egresos')}
            />
          )}

          {section === 'centro_ia' && enVistaAdmin && (
            <CajaCentroInteligente
              isAdmin
              usuarioNombre={usuarioEtiqueta}
              usuarioId={usuarioId}
              onNavigate={goSection}
            />
          )}

          {section === 'cierres_new' && enVistaAdmin && (
            <CajaSectionCierreForm
              editId={editCierreId}
              usuarioNombre={usuarioEtiqueta}
              usuarioId={usuarioId}
              planillaActiva={planillaActiva}
              onPlanillaParsed={setPlanillaActiva}
              onSaved={() => {
                setEditCierreId(null)
                setPlanillaActiva(null)
                bumpRefresh()
                setSection('cierres')
              }}
              onCancel={() => {
                setEditCierreId(null)
                setSection('cierres')
              }}
            />
          )}

          {section === 'cierres' && enVistaAdmin && (
            <>
              {panelPlanillaIntel}
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
            </>
          )}

          {section === 'tablero' && enVistaAdmin && <CajaSectionTablero canViewIngresos={canViewIngresos} />}

          {section === 'arqueo' && (
            <>
              {panelPlanillaIntel}
              <CajaSectionArqueo
                usuarioNombre={usuarioEtiqueta}
                usuarioId={usuarioId}
                soloCajasOperativas
                fijarCajaUsuario
                planillaActiva={planillaActiva}
                movimientosRefreshKey={movimientosRefreshKey}
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

          {section === 'traspasos' && (
            <CajaSectionTraspasos
              isAdmin={isAdmin}
              usuarioNombre={usuarioEtiqueta}
              usuarioId={usuarioId}
            />
          )}

          {section === 'movimientos' && (
            <>
              {panelPlanillaIntel}
              <CajaSectionMovimientos
                usuarioNombre={usuarioEtiqueta}
                usuarioId={usuarioId}
                soloMisMovimientos
                allowExcelImport
                hidePlanillaImport
                title="Mis movimientos"
              />
            </>
          )}

          {section === 'historial' && (
            <CajaSectionHistorial usuarioNombre={usuarioEtiqueta} usuarioId={usuarioId} />
          )}

          {section === 'arqueos_admin' && enVistaAdmin && <CajaSectionArqueosAdmin />}

          {section === 'movimientos_admin' && enVistaAdmin && (
            <>
              {panelPlanillaIntel}
              <CajaSectionMovimientos
                usuarioNombre={usuarioEtiqueta}
                usuarioId={usuarioId}
                soloMisMovimientos={false}
                allowExcelImport
                hidePlanillaImport
                title="Movimientos entre cajas"
              />
            </>
          )}

          {section === 'concil_mp' && enVistaAdmin && <CajaSectionConcilMP />}
          {section === 'concil_banco' && enVistaAdmin && <CajaSectionConcilBanco />}
          {section === 'diferencias' && enVistaAdmin && <CajaSectionDiferencias />}
          {section === 'ventas' && enVistaAdmin && <CajaSectionVentasDiarias />}
          {section === 'config' && enVistaAdmin && <CajaSectionConfig />}
          {section === 'asistente' && (
            <CajaPlotAI isAdmin={isAdmin} usuarioNombre={usuarioEtiqueta} usuarioId={usuarioId} />
          )}
        </main>
      </div>
    </div>
  )
}

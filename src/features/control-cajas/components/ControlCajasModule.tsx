import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../../hooks/useAuth'
import { NAV_ADMIN, NAV_CAJA } from '../constants'
import { VENTAS } from '../../../utils/ventasRoutes'
import type { CajaSectionId } from '../types'
import { usesRemoteStorage } from '../cajaRepository'
import { resolveUsuarioCajaEtiqueta } from '../cajaUsuarioDisplay'
import CajaMenuOperativa from './CajaMenuOperativa'
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
import CajaAvisoPdfUnico from './CajaAvisoPdfUnico'
import CajaPlanillaResumenActiva from './CajaPlanillaResumenActiva'
import CajaSubidaInteligente from './CajaSubidaInteligente'
import CajaImportComprobantesMedios from './CajaImportComprobantesMedios'
import CajaPlanillasRecibidasPanel from './CajaPlanillasRecibidasPanel'
import CajaInteligenciaBar from './CajaInteligenciaBar'
import CajaVolverPlotLab from './CajaVolverPlotLab'
import type { PlanillaCajaParsed } from '../parsePlanillaCajaPdf'
import '../../../pages/CajaDashboardPage.css'

const SECTION_TITLES: Record<CajaSectionId, string> = {
  menu: 'Menú',
  tablero_admin: 'Calendario de cajas',
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
  return vista === 'admin' ? 'tablero_admin' : 'menu'
}

export default function ControlCajasModule() {
  const navigate = useNavigate()
  const location = useLocation()
  const {
    usuario,
    nombreVisible,
    isAdmin,
    canManageCaja,
    canAccessTotemImpresionPanel,
    isMostrador,
    loading: authLoading
  } = useAuth()
  const canViewIngresos = isAdmin
  const usuarioId = usuario?.id
  const usuarioEtiqueta = nombreVisible || resolveUsuarioCajaEtiqueta(usuario?.nombre ?? 'Usuario')

  const pathVista = useMemo(() => vistaDesdePath(location.pathname), [location.pathname])
  const [vista, setVista] = useState<VistaCajaModulo>(() => {
    if (!isAdmin) return 'operativa'
    return pathVista ?? 'admin'
  })
  const enVistaAdmin = isAdmin && vista === 'admin'

  const [section, setSection] = useState<CajaSectionId>(() =>
    isAdmin ? seccionInicial(pathVista ?? 'admin') : 'menu'
  )
  const [editCierreId, setEditCierreId] = useState<string | null>(null)
  const [remote, setRemote] = useState<boolean | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  /** Recarga movimientos en arqueo sin remontar toda la página (evita cierre al importar planilla). */
  const [movimientosRefreshKey, setMovimientosRefreshKey] = useState(0)
  const [planillaActiva, setPlanillaActiva] = useState<PlanillaCajaParsed | null>(null)
  const [menuRefreshToken, setMenuRefreshToken] = useState(0)

  const nav = useMemo(() => (enVistaAdmin ? NAV_ADMIN : NAV_CAJA), [enVistaAdmin])

  useEffect(() => {
    if (!enVistaAdmin && section === 'menu') setMenuRefreshToken((t) => t + 1)
  }, [enVistaAdmin, section])

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
    if (authLoading || !canManageCaja) return
    const p = location.pathname.replace(/\/$/, '')
    if (p === '/caja/dashboard') {
      navigate(isAdmin ? '/caja/dashboard/admin' : '/caja/dashboard/caja', { replace: true })
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
      setSection('menu')
      setEditCierreId(null)
      return
    }
    if (pathVista) {
      setVista(pathVista)
      setSection(seccionInicial(pathVista))
      setEditCierreId(null)
    }
  }, [isAdmin, pathVista])

  useEffect(() => {
    if (!enVistaAdmin && section === 'movimientos') setSection('historial')
  }, [enVistaAdmin, section])

  useEffect(() => {
    if (enVistaAdmin && (section === 'ventas' || section === 'config')) {
      setSection('tablero_admin')
    }
  }, [enVistaAdmin, section])

  const bumpRefresh = () => setRefreshKey((k) => k + 1)

  if (authLoading && !usuario) {
    return (
      <div className="caja-dashboard-page">
        <div className="caja-loading-container">
          <p>Verificando permisos…</p>
          <CajaVolverPlotLab />
        </div>
      </div>
    )
  }

  if (!canManageCaja) {
    return (
      <div className="caja-dashboard-page">
        <div className="caja-loading-container">
          <p>Redirigiendo…</p>
          <CajaVolverPlotLab />
        </div>
      </div>
    )
  }

  const showPageTitle =
    section !== 'menu' &&
    section !== 'tablero_admin' &&
    section !== 'centro_ia' &&
    section !== 'cierres_new' &&
    section !== 'cierres'

  const goSection = (s: CajaSectionId) => {
    setEditCierreId(null)
    const target = !enVistaAdmin && s === 'movimientos' ? 'historial' : s
    setSection(target)
  }

  const refreshMovimientos = () => setMovimientosRefreshKey((k) => k + 1)

  const onPlanillaImportada = () => {
    refreshMovimientos()
    bumpRefresh()
    setMenuRefreshToken((t) => t + 1)
  }

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
                ? 'Fondo recomendado $100.000 en tu caja (editable en cierre de turno), resto a administración, egresos e ingresos de hoy.'
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
            <button type="button" className="btn-secondary" onClick={() => navigate(VENTAS)}>
              Ventas
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
          <strong>
            {enVistaAdmin ? 'Administración' : isMostrador ? 'Mostrador · Mi caja' : 'Caja'}
          </strong>{' '}
          — {usuarioEtiqueta}
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
                onClick={() => goSection(item.section)}
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
            {!enVistaAdmin && section !== 'menu' ? (
              <button type="button" className="btn-link caja-cc-volver-menu" onClick={() => goSection('menu')}>
                ← Volver al menú
              </button>
            ) : null}
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

          {section === 'menu' && !enVistaAdmin && (
            <CajaMenuOperativa
              usuarioNombre={usuarioEtiqueta}
              usuarioId={usuarioId}
              refreshToken={menuRefreshToken}
              onNavigate={goSection}
              onPlanillaParsed={setPlanillaActiva}
              onImported={onPlanillaImportada}
            />
          )}

          {section === 'tablero_admin' && enVistaAdmin && (
            <CajaTableroAdmin
              refreshKey={refreshKey}
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
              onIrSubirPdf={() => setSection('cierres')}
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
              <section className="caja-cc-planilla-hub" aria-label="Subir PDF del día">
                <CajaSubidaInteligente
                  usuarioNombre={usuarioEtiqueta}
                  usuarioId={usuarioId}
                  onNavigate={goSection}
                  onPlanillaParsed={setPlanillaActiva}
                  onImported={onPlanillaImportada}
                  autoNavigate={false}
                />
                {planillaActiva ? (
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
                ) : null}
                <CajaPlanillasRecibidasPanel
                  titulo="Planillas recibidas de caja"
                  onPlanillaLoaded={setPlanillaActiva}
                />
              </section>
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
              {!enVistaAdmin ? (
                <section className="caja-cc-planilla-hub" aria-label="Planilla del día">
                  {planillaActiva ? (
                    <CajaPlanillaResumenActiva planilla={planillaActiva} />
                  ) : (
                    <CajaAvisoPdfUnico onIr={() => goSection('menu')} />
                  )}
                  {planillaActiva ? (
                    <CajaCentroInteligente
                      isAdmin={false}
                      usuarioNombre={usuarioEtiqueta}
                      usuarioId={usuarioId}
                      onNavigate={goSection}
                      compact
                      collapsible
                      defaultExpanded={false}
                      planillaActiva={planillaActiva}
                    />
                  ) : null}
                  <p className="caja-cc-help caja-cc-arqueo-mp-hint">
                    Los comprobantes MP / POS son para conciliar tarjetas; el PDF del día va en el Menú.
                  </p>
                  <CajaImportComprobantesMedios
                    usuarioNombre={usuarioEtiqueta}
                    usuarioId={usuarioId}
                    onImported={refreshMovimientos}
                  />
                </section>
              ) : null}
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
            <CajaSectionCierreTurno
              usuarioNombre={usuarioEtiqueta}
              usuarioId={usuarioId}
              onIrSubirPdf={() => goSection('menu')}
            />
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

          {section === 'historial' && (
            <CajaSectionHistorial usuarioNombre={usuarioEtiqueta} usuarioId={usuarioId} />
          )}

          {section === 'arqueos_admin' && enVistaAdmin && <CajaSectionArqueosAdmin />}

          {section === 'movimientos_admin' && enVistaAdmin && (
            <>
              <CajaAvisoPdfUnico onIr={() => goSection('cierres')} destinoLabel="Cierres" />
              <CajaSectionMovimientos
                usuarioNombre={usuarioEtiqueta}
                usuarioId={usuarioId}
                soloMisMovimientos={false}
                allowExcelImport
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

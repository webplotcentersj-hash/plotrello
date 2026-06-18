import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { CLIENTES_CUENTA_CORRIENTE, clientesPerfil } from '../utils/clientesRoutes'
import { useAuth } from '../hooks/useAuth'
import apiService from '../services/api'
import CuentaCorrienteScoreBadge from '../components/CuentaCorrienteScoreBadge'
import CuentaCorrienteScoringPanel from '../components/CuentaCorrienteScoringPanel'
import CuentaCorrienteInteresesPanel from '../components/CuentaCorrienteInteresesPanel'
import type { CcCobranzaAgingBucket, CcCuentaMovimiento, CcPerfilCliente, CcVentaResumen } from '../types/api'
import { TIPO_CLIENTE_CC_LABELS, labelCondicionIva } from '../constants/cuentaCorriente'
import {
  formatLimiteCredito,
  type CcScoreNivel
} from '../constants/cuentaCorrienteScoring'
import { uploadAttachmentAndGetUrl } from '../utils/storage'
import {
  CC_AGING_LABELS,
  estadoCobroVenta,
  resumenPorVendedor
} from '../utils/cuentaCorrienteCobranzas'
import {
  formatMontoArs,
  movimientosConSaldoCorrido,
  parseMontoArsInput
} from '../utils/cuentaCorrienteLedger'
import {
  buildInteresesCsvRows,
  buildMovimientosCsvRows,
  buildVentasCcCsvRows,
  descargarArchivoUrl,
  downloadCsv,
  downloadEstadoCuentaPdf,
  downloadPerfilCsvPack
} from '../utils/cuentaCorrienteExport'
import CcExportMenu from '../components/CcExportMenu'
import './CuentaCorrientePerfilPage.css'

type TabId = 'cuenta' | 'ventas' | 'pago'

export default function CuentaCorrientePerfilPage() {
  const { idCliente: idParam } = useParams<{ idCliente: string }>()
  const idCliente = Number(idParam)
  const navigate = useNavigate()
  const { isAdmin, usuario } = useAuth()

  const [loading, setLoading] = useState(true)
  const [perfil, setPerfil] = useState<CcPerfilCliente | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<TabId>('cuenta')
  const [showScoring, setShowScoring] = useState(false)
  const [syncing, setSyncing] = useState(false)

  const [pagoMonto, setPagoMonto] = useState('')
  const [pagoFecha, setPagoFecha] = useState(() => new Date().toISOString().slice(0, 10))
  const [pagoMetodo, setPagoMetodo] = useState('Transferencia')
  const [pagoRef, setPagoRef] = useState('')
  const [pagoNotas, setPagoNotas] = useState('')
  const [pagoVentaId, setPagoVentaId] = useState<string>('')
  const [pagoComprobanteUrl, setPagoComprobanteUrl] = useState('')
  const [pagoComprobanteNombre, setPagoComprobanteNombre] = useState('')
  const [subiendoComprobante, setSubiendoComprobante] = useState(false)
  const [guardandoPago, setGuardandoPago] = useState(false)
  const [pagoOk, setPagoOk] = useState<string | null>(null)

  const cargarPerfil = useCallback(async (syncPrimero = false) => {
    if (!Number.isFinite(idCliente) || idCliente <= 0) {
      setError('Cliente inválido')
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      if (syncPrimero) {
        setSyncing(true)
        await apiService.sincronizarVentasCuentaCorriente(idCliente)
        setSyncing(false)
      }
      const res = await apiService.getPerfilCuentaCorriente(idCliente)
      if (!res.success) throw new Error(res.error || 'Error al cargar')
      if (!res.data) throw new Error('Cliente sin cuenta corriente')
      setPerfil(res.data)
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : 'Error de conexión')
      setPerfil(null)
    } finally {
      setLoading(false)
      setSyncing(false)
    }
  }, [idCliente])

  useEffect(() => {
    void cargarPerfil(true)
  }, [cargarPerfil])

  const movimientosOrdenados = useMemo(
    () => (perfil ? movimientosConSaldoCorrido(perfil.movimientos) : []),
    [perfil]
  )

  const movimientosVista = useMemo(() => [...movimientosOrdenados].reverse(), [movimientosOrdenados])

  const nombre =
    perfil?.ficha.razon_social || perfil?.ficha.nombre || `Cliente #${idCliente}`

  const ventasPorVendedor = useMemo(() => {
    if (!perfil) return []
    const clienteNombre = nombre
    const items = perfil.ventas_cc
      .filter((v) => (v.monto_pendiente ?? 0) > 0.009)
      .map((v) => ({
        id_venta: v.id,
        numero_venta: v.numero_venta,
        id_cliente: idCliente,
        cliente_nombre: clienteNombre,
        valor_total: v.valor_total,
        monto_pendiente: v.monto_pendiente ?? v.valor_total,
        estado_pago: v.estado_pago,
        fecha_venta: v.fecha_venta?.slice(0, 10) ?? '',
        fecha_vencimiento: v.fecha_vencimiento ?? '',
        dias_vencido: v.dias_vencido ?? 0,
        bucket: (v.bucket ?? 'al_dia') as CcCobranzaAgingBucket,
        id_vendedor: v.id_vendedor ?? null,
        nombre_vendedor: v.nombre_vendedor?.trim() || 'Sin vendedor'
      }))
    return resumenPorVendedor(items)
  }, [perfil, idCliente, nombre])

  const limiteEfectivo =
    perfil?.resumen.limite_credito ?? perfil?.resumen.limite_credito_sugerido ?? null

  const excedeLimite =
    limiteEfectivo != null && (perfil?.resumen.saldo_actual ?? 0) > limiteEfectivo

  const handleComprobantePago = async (file: File | undefined) => {
    if (!file || !idCliente) return
    if (file.size > 8 * 1024 * 1024) {
      setError('El comprobante no puede superar 8 MB')
      return
    }
    setSubiendoComprobante(true)
    setError(null)
    try {
      const url = await uploadAttachmentAndGetUrl(file, `cuenta-corriente/${idCliente}/pagos`)
      setPagoComprobanteUrl(url)
      setPagoComprobanteNombre(file.name)
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : 'Error al subir comprobante')
      setPagoComprobanteUrl('')
      setPagoComprobanteNombre('')
    } finally {
      setSubiendoComprobante(false)
    }
  }

  const registrarPago = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!usuario?.id || !perfil) return
    const monto = parseMontoArsInput(pagoMonto)
    if (monto == null || monto <= 0) {
      setError('Indicá un monto válido')
      return
    }
    if (pagoVentaId) {
      const venta = perfil.ventas_cc.find((v) => String(v.id) === pagoVentaId)
      if (venta && monto < venta.valor_total) {
        const ok = window.confirm(
          `El pago (${formatMontoArs(monto)}) es menor que la venta (${formatMontoArs(venta.valor_total)}). ` +
            'La venta seguirá pendiente hasta cubrir el total. ¿Continuar?'
        )
        if (!ok) return
      }
    }
    if (!pagoComprobanteUrl) {
      setError('Subí el comprobante del pago (transferencia, depósito, etc.)')
      return
    }
    setGuardandoPago(true)
    setError(null)
    setPagoOk(null)
    try {
      const res = await apiService.registrarPagoCuentaCorriente({
        id_cliente: idCliente,
        monto,
        fecha_pago: pagoFecha,
        metodo_pago: pagoMetodo,
        url_comprobante: pagoComprobanteUrl,
        id_usuario: usuario.id,
        referencia: pagoRef.trim() || undefined,
        notas: pagoNotas.trim() || undefined,
        id_venta: pagoVentaId ? Number(pagoVentaId) : null
      })
      if (!res.success) throw new Error(res.error || 'No se pudo registrar')
      setPagoOk('Pago registrado. La cuenta y el scoring se actualizaron automáticamente.')
      setPagoMonto('')
      setPagoRef('')
      setPagoNotas('')
      setPagoVentaId('')
      setPagoComprobanteUrl('')
      setPagoComprobanteNombre('')
      setTab('cuenta')
      await cargarPerfil(false)
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : 'Error al registrar pago')
    } finally {
      setGuardandoPago(false)
    }
  }

  if (loading && !perfil) {
    return (
      <div className="cc-perfil-page">
        <div className="cc-perfil-loading">
          <div className="cc-perfil-spinner" />
          <p>{syncing ? 'Sincronizando ventas y movimientos…' : 'Cargando perfil…'}</p>
        </div>
      </div>
    )
  }

  if (!perfil) {
    return (
      <div className="cc-perfil-page">
        <p className="cc-perfil-error">{error || 'No se encontró el perfil'}</p>
        <Link to={CLIENTES_CUENTA_CORRIENTE} className="cc-btn cc-btn--secondary">
          Volver
        </Link>
      </div>
    )
  }

  const ficha = perfil.ficha
  const res = perfil.resumen

  return (
    <div className="cc-perfil-page">
      <header className="cc-perfil-header">
        <button
          type="button"
          className="cc-perfil-back"
          onClick={() => navigate(CLIENTES_CUENTA_CORRIENTE)}
        >
          ← Cuenta corriente
        </button>
        <div className="cc-perfil-header__main">
          <div>
            <h1>{nombre}</h1>
            <p className="cc-perfil-header__meta">
              {ficha.cuit && <span>CUIT/DNI {ficha.cuit}</span>}
              {ficha.tipo_cliente && (
                <span>{TIPO_CLIENTE_CC_LABELS[ficha.tipo_cliente === 'persona_fisica' ? 'persona_fisica' : 'empresa']}</span>
              )}
              {ficha.condicion_iva && <span>{labelCondicionIva(ficha.condicion_iva)}</span>}
            </p>
          </div>
          <div className="cc-perfil-header__actions">
            <CcExportMenu
              label="Descargar"
              items={[
                {
                  id: 'todo',
                  label: 'Todo (CSV + PDF estado de cuenta)',
                  onClick: () => {
                    downloadPerfilCsvPack(perfil, nombre)
                    downloadEstadoCuentaPdf(perfil, nombre)
                  }
                },
                {
                  id: 'pdf',
                  label: 'Estado de cuenta — PDF',
                  onClick: () => downloadEstadoCuentaPdf(perfil, nombre)
                },
                {
                  id: 'libro',
                  label: 'Libro de movimientos — CSV',
                  onClick: () =>
                    downloadCsv(
                      `${nombre.replace(/\s+/g, '-').slice(0, 40)}-libro.csv`,
                      buildMovimientosCsvRows(perfil.movimientos)
                    )
                },
                {
                  id: 'ventas',
                  label: 'Ventas CC — CSV',
                  onClick: () =>
                    downloadCsv(
                      `${nombre.replace(/\s+/g, '-').slice(0, 40)}-ventas.csv`,
                      buildVentasCcCsvRows(perfil.ventas_cc)
                    )
                },
                {
                  id: 'intereses',
                  label: 'Intereses devengados — CSV',
                  onClick: () =>
                    downloadCsv(
                      `${nombre.replace(/\s+/g, '-').slice(0, 40)}-intereses.csv`,
                      buildInteresesCsvRows(res.intereses_devengados)
                    )
                }
              ]}
            />
            <Link to={clientesPerfil(idCliente)} className="cc-btn cc-btn--secondary">
              Ver perfil cliente
            </Link>
            <CuentaCorrienteScoreBadge
              score={res.score}
              nivel={res.score_nivel as CcScoreNivel | undefined}
              onClick={() => setShowScoring(true)}
            />
            <button type="button" className="cc-btn cc-btn--secondary" onClick={() => setShowScoring(true)}>
              Scoring
            </button>
            <button
              type="button"
              className="cc-btn cc-btn--primary"
              onClick={() => setTab('pago')}
            >
              + Registrar pago
            </button>
          </div>
        </div>
      </header>

      {error && (
        <div className="cc-perfil-alert cc-perfil-alert--error" role="alert">
          {error}
          <button type="button" onClick={() => setError(null)} aria-label="Cerrar">
            ✕
          </button>
        </div>
      )}
      {pagoOk && (
        <div className="cc-perfil-alert cc-perfil-alert--ok" role="status">
          {pagoOk}
          <button type="button" onClick={() => setPagoOk(null)} aria-label="Cerrar">
            ✕
          </button>
        </div>
      )}

      <section className="cc-perfil-kpis">
        <article className={`cc-perfil-kpi${excedeLimite ? ' cc-perfil-kpi--warn' : ''}`}>
          <span className="cc-perfil-kpi__label">Saldo actual</span>
          <strong className="cc-perfil-kpi__value">{formatMontoArs(res.saldo_actual)}</strong>
          {excedeLimite && <span className="cc-perfil-kpi__hint">Supera el límite asignado</span>}
        </article>
        <article className="cc-perfil-kpi">
          <span className="cc-perfil-kpi__label">Total cargos (ventas CC)</span>
          <strong className="cc-perfil-kpi__value">{formatMontoArs(res.total_cargos)}</strong>
        </article>
        <article className="cc-perfil-kpi">
          <span className="cc-perfil-kpi__label">Total pagos / remesas</span>
          <strong className="cc-perfil-kpi__value">{formatMontoArs(res.total_pagos)}</strong>
        </article>
        <article className="cc-perfil-kpi">
          <span className="cc-perfil-kpi__label">Límite de crédito</span>
          <strong className="cc-perfil-kpi__value">{formatLimiteCredito(limiteEfectivo)}</strong>
        </article>
        <article className="cc-perfil-kpi">
          <span className="cc-perfil-kpi__label">Ventas pendientes</span>
          <strong className="cc-perfil-kpi__value">
            {res.ventas_pendientes} · {formatMontoArs(res.monto_pendiente_ventas)}
          </strong>
        </article>
        <article className="cc-perfil-kpi">
          <span className="cc-perfil-kpi__label">Último pago</span>
          <strong className="cc-perfil-kpi__value">
            {res.ultimo_pago_at
              ? new Date(res.ultimo_pago_at + 'T12:00:00').toLocaleDateString('es-AR')
              : '—'}
          </strong>
        </article>
        {(res.tasa_mora_vigente ?? 0) > 0 && (
          <article className="cc-perfil-kpi cc-perfil-kpi--interes">
            <span className="cc-perfil-kpi__label">Interés devengado</span>
            <strong className="cc-perfil-kpi__value">
              {formatMontoArs(res.intereses_devengados?.total_devengado ?? 0)}
            </strong>
            <span className="cc-perfil-kpi__hint">
              Tasa mora {res.tasa_mora_vigente}% · {res.intereses_devengados?.periodo}
            </span>
          </article>
        )}
      </section>

      <section className="cc-perfil-docs">
        <h2 className="cc-perfil-docs__title">Documentación y comprobantes</h2>
        <ul className="cc-perfil-docs__list">
          <CcDocDownload label="Constancia AFIP" url={ficha.url_constancia_afip} />
          <CcDocDownload label="Estatuto" url={ficha.url_estatuto} />
          <CcDocDownload label="Comprobante domicilio" url={ficha.url_comprobante_domicilio} />
          <CcDocDownload label="DNI" url={ficha.url_documento_dni} />
          <CcDocDownload label="Pagaré" url={ficha.url_pagare} />
        </ul>
      </section>

      {usuario?.id && (
        <CuentaCorrienteInteresesPanel
          idCliente={idCliente}
          idUsuario={usuario.id}
          isAdmin={isAdmin}
          ficha={ficha}
          intereses={res.intereses_devengados ?? null}
          onUpdated={() => void cargarPerfil(false)}
        />
      )}

      <nav className="cc-perfil-tabs" role="tablist">
        {(
          [
            ['cuenta', 'Estado de cuenta'],
            ['ventas', `Ventas CC (${perfil.ventas_cc.length})`],
            ['pago', 'Registrar pago']
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={`cc-perfil-tab${tab === id ? ' cc-perfil-tab--active' : ''}`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === 'cuenta' && (
        <section className="cc-perfil-section">
          <div className="cc-perfil-section__head">
            <h2>Libro de cuenta (automático)</h2>
            <button
              type="button"
              className="cc-btn cc-btn--secondary cc-btn--sm"
              disabled={syncing}
              onClick={() => void cargarPerfil(true)}
            >
              {syncing ? 'Sincronizando…' : '↻ Sincronizar ventas'}
            </button>
          </div>
          <p className="cc-perfil-section__hint">
            Cada venta en cuenta corriente genera un cargo; cada pago registrado con comprobante genera
            un crédito. El saldo se actualiza solo.
          </p>
          {movimientosVista.length === 0 ? (
            <p className="cc-perfil-empty">Sin movimientos aún.</p>
          ) : (
            <div className="cc-perfil-table-wrap">
              <table className="cc-perfil-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Tipo</th>
                    <th>Concepto</th>
                    <th>Venc.</th>
                    <th className="num">Debe</th>
                    <th className="num">Haber</th>
                    <th className="num">Saldo</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {movimientosVista.map((m) => (
                    <MovimientoRow key={m.id} mov={m} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {tab === 'ventas' && (
        <section className="cc-perfil-section">
          <h2>Historial de ventas en cuenta corriente</h2>
          {ventasPorVendedor.length > 0 && (
            <div className="cc-perfil-ventas-vendedores">
              <h3>Pendiente por vendedor</h3>
              <div className="cc-perfil-ventas-vendedores__grid">
                {ventasPorVendedor.map((v) => (
                  <article key={v.id_vendedor ?? v.nombre_vendedor} className="cc-perfil-vendedor-chip">
                    <span className="cc-perfil-vendedor-chip__name">{v.nombre_vendedor}</span>
                    <strong>{formatMontoArs(v.monto_pendiente)}</strong>
                    <span>{v.ventas_pendientes} venta{v.ventas_pendientes !== 1 ? 's' : ''}</span>
                  </article>
                ))}
              </div>
            </div>
          )}
          {perfil.ventas_cc.length === 0 ? (
            <p className="cc-perfil-empty">Sin ventas CC registradas.</p>
          ) : (
            <div className="cc-perfil-table-wrap">
              <table className="cc-perfil-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>N° venta</th>
                    <th>Vendedor</th>
                    <th className="num">Total</th>
                    <th className="num">Pagado</th>
                    <th className="num">Pendiente</th>
                    <th>Estado pago</th>
                    <th>Vencimiento</th>
                    <th>Cobranza</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {perfil.ventas_cc.map((v) => (
                    <VentaRow
                      key={v.id}
                      venta={v}
                      onImputar={() => {
                        setPagoVentaId(String(v.id))
                        setPagoMonto(String(v.monto_pendiente ?? v.valor_total))
                        setTab('pago')
                      }}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {tab === 'pago' && (
        <section className="cc-perfil-section cc-perfil-pago-form">
          <h2>Registrar pago / remesa</h2>
          <p className="cc-perfil-section__hint">
            Obligatorio adjuntar comprobante. Al guardar se acredita en la cuenta, actualiza saldo y
            scoring.
          </p>
          <form onSubmit={(e) => void registrarPago(e)} className="cc-perfil-pago-grid">
            <label>
              <span>Monto ($) *</span>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={pagoMonto}
                onChange={(e) => setPagoMonto(e.target.value)}
                required
              />
            </label>
            <label>
              <span>Fecha de pago *</span>
              <input
                type="date"
                value={pagoFecha}
                onChange={(e) => setPagoFecha(e.target.value)}
                required
              />
            </label>
            <label>
              <span>Método</span>
              <select value={pagoMetodo} onChange={(e) => setPagoMetodo(e.target.value)}>
                <option value="Transferencia">Transferencia</option>
                <option value="Depósito">Depósito</option>
                <option value="Efectivo">Efectivo</option>
                <option value="Cheque">Cheque</option>
                <option value="Mercado Pago">Mercado Pago</option>
                <option value="Otro">Otro</option>
              </select>
            </label>
            <label>
              <span>Referencia / N° operación</span>
              <input
                value={pagoRef}
                onChange={(e) => setPagoRef(e.target.value)}
                placeholder="Ej. transferencia 12/05"
              />
            </label>
            <label>
              <span>Imputar a venta (opcional)</span>
              <select value={pagoVentaId} onChange={(e) => setPagoVentaId(e.target.value)}>
                <option value="">Pago a cuenta general</option>
                {perfil.ventas_cc
                  .filter((v) => v.estado_pago !== 'Pagado' && v.estado_pago !== 'Cancelado')
                  .map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.numero_venta} — {formatMontoArs(v.valor_total)}
                    </option>
                  ))}
              </select>
            </label>
            <label className="wide">
              <span>Notas internas</span>
              <textarea
                rows={2}
                value={pagoNotas}
                onChange={(e) => setPagoNotas(e.target.value)}
              />
            </label>
            <label className="wide">
              <span>Comprobante de pago * (PDF o imagen)</span>
              <div className="cc-perfil-comprobante">
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/*"
                  disabled={subiendoComprobante || guardandoPago}
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    void handleComprobantePago(f)
                    e.target.value = ''
                  }}
                />
                {subiendoComprobante && <span>Subiendo…</span>}
                {pagoComprobanteUrl && (
                  <>
                    <span className="cc-perfil-comprobante__ok">✓ {pagoComprobanteNombre || 'Cargado'}</span>
                    <a href={pagoComprobanteUrl} target="_blank" rel="noopener noreferrer">
                      Ver
                    </a>
                  </>
                )}
              </div>
            </label>
            <div className="cc-perfil-pago-actions wide">
              <button
                type="submit"
                className="cc-btn cc-btn--primary"
                disabled={guardandoPago || subiendoComprobante || !pagoComprobanteUrl}
              >
                {guardandoPago ? 'Guardando…' : 'Registrar pago en cuenta'}
              </button>
            </div>
          </form>
        </section>
      )}

      {showScoring && usuario?.id && (
        <CuentaCorrienteScoringPanel
          record={ficha}
          isAdmin={isAdmin}
          idUsuario={usuario.id}
          onClose={() => setShowScoring(false)}
          onUpdated={() => void cargarPerfil(false)}
        />
      )}
    </div>
  )
}

function CcDocDownload({ label, url }: { label: string; url?: string | null }) {
  if (!url) return null
  return (
    <li>
      <span>{label}</span>
      <span className="cc-perfil-comprobante-actions">
        <a href={url} target="_blank" rel="noopener noreferrer" className="cc-perfil-link">
          Ver
        </a>
        <button
          type="button"
          className="cc-perfil-link cc-perfil-link--btn"
          onClick={() => descargarArchivoUrl(url, label)}
        >
          Descargar
        </button>
      </span>
    </li>
  )
}

function MovimientoRow({ mov }: { mov: CcCuentaMovimiento }) {
  const tipoLabel =
    mov.tipo === 'venta'
      ? 'Venta'
      : mov.tipo === 'pago'
        ? 'Pago'
        : mov.tipo === 'interes'
          ? 'Interés'
          : 'Ajuste'
  return (
    <tr className={`cc-perfil-mov--${mov.tipo}`}>
      <td>{mov.fecha ? new Date(mov.fecha + 'T12:00:00').toLocaleDateString('es-AR') : '—'}</td>
      <td>
        <span className={`cc-perfil-tipo cc-perfil-tipo--${mov.tipo}`}>{tipoLabel}</span>
      </td>
      <td>{mov.concepto}</td>
      <td>
        {mov.fecha_vencimiento
          ? new Date(mov.fecha_vencimiento + 'T12:00:00').toLocaleDateString('es-AR')
          : '—'}
      </td>
      <td className="num">{mov.debe > 0 ? formatMontoArs(mov.debe) : '—'}</td>
      <td className="num">{mov.haber > 0 ? formatMontoArs(mov.haber) : '—'}</td>
      <td className="num">
        <strong>{formatMontoArs(mov.saldo_acumulado)}</strong>
      </td>
      <td>
        {mov.url_comprobante && (
          <span className="cc-perfil-comprobante-actions">
            <a href={mov.url_comprobante} target="_blank" rel="noopener noreferrer" className="cc-perfil-link">
              Ver
            </a>
            <button
              type="button"
              className="cc-perfil-link cc-perfil-link--btn"
              onClick={() => descargarArchivoUrl(mov.url_comprobante!, `comprobante-mov-${mov.id}`)}
            >
              Descargar
            </button>
          </span>
        )}
      </td>
    </tr>
  )
}

function VentaRow({
  venta,
  onImputar
}: {
  venta: CcVentaResumen
  onImputar: () => void
}) {
  const pendiente =
    venta.estado_pago !== 'Pagado' && venta.estado_pago !== 'Cancelado'
  const pagado = venta.monto_pagado ?? 0
  const saldoPendiente = venta.monto_pendiente ?? Math.max(0, venta.valor_total - pagado)
  const diasVencido = venta.dias_vencido ?? 0
  const cobro = estadoCobroVenta(diasVencido)
  const vencLabel = venta.fecha_vencimiento
    ? new Date(venta.fecha_vencimiento + 'T12:00:00').toLocaleDateString('es-AR')
    : venta.fecha_venta
      ? new Date(
          new Date(venta.fecha_venta + 'T12:00:00').getTime() + 30 * 86400000
        ).toLocaleDateString('es-AR')
      : '—'

  return (
    <tr className={diasVencido > 0 && pendiente ? 'cc-perfil-venta--late' : ''}>
      <td>
        {venta.fecha_venta
          ? new Date(venta.fecha_venta + 'T12:00:00').toLocaleDateString('es-AR')
          : '—'}
      </td>
      <td>{venta.numero_venta}</td>
      <td>
        <span className="cc-perfil-vendedor" title={venta.nombre_vendedor || 'Sin vendedor'}>
          {venta.nombre_vendedor || 'Sin vendedor'}
        </span>
      </td>
      <td className="num">{formatMontoArs(venta.valor_total)}</td>
      <td className="num">{pagado > 0 ? formatMontoArs(pagado) : '—'}</td>
      <td className="num">{pendiente ? formatMontoArs(saldoPendiente) : '—'}</td>
      <td>
        <span className={`cc-perfil-estado-pago cc-perfil-estado-pago--${venta.estado_pago?.toLowerCase()}`}>
          {venta.estado_pago}
        </span>
      </td>
      <td>{vencLabel}</td>
      <td>
        {pendiente ? (
          <span className={`cc-perfil-cobro-badge cc-perfil-cobro-badge--${cobro.cls.replace('cc-cob--', '')}`}>
            {cobro.label}
            {venta.bucket && venta.bucket !== 'al_dia' && diasVencido > 0 && (
              <small> · {CC_AGING_LABELS[venta.bucket]}</small>
            )}
          </span>
        ) : (
          '—'
        )}
      </td>
      <td>
        {pendiente && (
          <button type="button" className="cc-btn cc-btn--sm cc-btn--secondary" onClick={onImputar}>
            Registrar pago
          </button>
        )}
        {venta.comprobante_pago_url && (
          <span className="cc-perfil-comprobante-actions">
            <a
              href={venta.comprobante_pago_url}
              target="_blank"
              rel="noopener noreferrer"
              className="cc-perfil-link"
            >
              Ver
            </a>
            <button
              type="button"
              className="cc-perfil-link cc-perfil-link--btn"
              onClick={() =>
                descargarArchivoUrl(venta.comprobante_pago_url!, `venta-${venta.numero_venta}`)
              }
            >
              Descargar
            </button>
          </span>
        )}
      </td>
    </tr>
  )
}

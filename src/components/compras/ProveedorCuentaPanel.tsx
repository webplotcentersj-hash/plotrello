import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import apiService from '../../services/api'
import type { MovimientoProveedorEnriquecido } from '../../types/api'
import { getArgentinaDateString } from '../../utils/dateUtils'
import { extraerDatosTicket, fileToDataUrl, type TicketExtract } from '../../utils/extractTicketAi'
import {
  adjuntosDeMovimiento,
  estadoCuentaProveedor,
  estadoVencimientoFactura,
  etiquetaEstadoVencimiento,
  facturasAlertaVencimiento,
  moneyProveedor,
  saldoCuentaProveedor,
  type AdjuntoProveedor
} from '../../utils/proveedorCuenta'
import {
  descargarCuentaProveedorPdf,
  descargarVencimientosProveedoresPdf
} from '../../utils/documentos/proveedorCuentaPdf'
import '../../pages/DeudasProveedoresPage.css'

type Props = {
  idProveedor?: number
  proveedorNombre?: string
  proveedorCuit?: string | null
  proveedorTelefono?: string | null
  proveedorEmail?: string | null
  proveedorDomicilio?: string | null
  saldoListado?: number | null
  onChanged?: () => void
}

function fmtFecha(iso: string): string {
  const raw = (iso || '').slice(0, 10)
  if (!raw) return '—'
  const [y, m, d] = raw.split('-')
  if (!y || !m || !d) return raw
  return `${d}/${m}/${y}`
}

function fmtFechaHora(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return fmtFecha(iso)
  return d.toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function esPagoMov(r: MovimientoProveedorEnriquecido): boolean {
  return (Number(r.haber) || 0) > 0.009 || /pago/i.test(r.tipo_movimiento)
}

function etiquetaTipo(r: MovimientoProveedorEnriquecido): string {
  const raw = (r.tipo_movimiento || '').trim()
  if (esPagoMov(r)) return raw && !/^pago$/i.test(raw) ? raw : 'Pago'
  if (/factura/i.test(raw)) return raw
  if (/nota/i.test(raw)) return raw
  return raw || 'Factura'
}

function csvEscape(v: string | number | null | undefined): string {
  const s = v == null ? '' : String(v)
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

/** Último movimiento por fecha_hora + id (tie-break si comparten medianoche). */
function ultimoMovimientoCronologico(
  rows: MovimientoProveedorEnriquecido[]
): MovimientoProveedorEnriquecido | undefined {
  if (rows.length === 0) return undefined
  return [...rows].sort((a, b) => {
    const ta = new Date(a.fecha_hora).getTime()
    const tb = new Date(b.fecha_hora).getTime()
    if (ta !== tb) return ta - tb
    return (Number(a.id) || 0) - (Number(b.id) || 0)
  })[rows.length - 1]
}

export default function ProveedorCuentaPanel({
  idProveedor,
  proveedorNombre,
  proveedorCuit,
  proveedorTelefono,
  proveedorEmail,
  proveedorDomicilio,
  saldoListado,
  onChanged
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const attachRef = useRef<HTMLInputElement>(null)
  const pendingAttachId = useRef<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<MovimientoProveedorEnriquecido[]>([])
  const [tipo, setTipo] = useState<'factura' | 'pago'>('factura')
  const [monto, setMonto] = useState('')
  const [fecha, setFecha] = useState(getArgentinaDateString())
  const [fechaVto, setFechaVto] = useState('')
  const [comprobante, setComprobante] = useState('')
  const [archivos, setArchivos] = useState<File[]>([])
  const [preview, setPreview] = useState<string | null>(null)
  const [extracting, setExtracting] = useState(false)
  const [extracto, setExtracto] = useState<TicketExtract | null>(null)
  const [q, setQ] = useState('')
  const [filtro, setFiltro] = useState<'todos' | 'factura' | 'pago'>('todos')
  const [ordenLibro, setOrdenLibro] = useState<'crono' | 'reciente'>('crono')
  const [adjuntandoId, setAdjuntandoId] = useState<number | null>(null)
  const [editandoSaldo, setEditandoSaldo] = useState(false)
  const [saldoEditDraft, setSaldoEditDraft] = useState('')
  const [guardandoSaldo, setGuardandoSaldo] = useState(false)
  const [reseteando, setReseteando] = useState(false)
  const [saldoDeuda, setSaldoDeuda] = useState<number | null>(null)
  const [resetMeta, setResetMeta] = useState<{ por: string | null; at: string | null }>({
    por: null,
    at: null
  })

  const load = useCallback(async () => {
    if (!idProveedor || idProveedor <= 0) {
      setRows([])
      setSaldoDeuda(null)
      setResetMeta({ por: null, at: null })
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    const [r, meta] = await Promise.all([
      apiService.getMovimientosProveedores({ idProveedor }),
      apiService.getCuentaProveedorResetMeta(idProveedor)
    ])
    if (r.success && r.data) setRows(r.data.filter((m) => !m.es_saldo_inicial))
    else {
      setRows([])
      setError(r.error || 'No se pudo cargar la cuenta')
    }
    if (meta.success && meta.data) {
      setSaldoDeuda(meta.data.saldo)
      setResetMeta({ por: meta.data.reset_por, at: meta.data.reset_at })
    }
    setLoading(false)
  }, [idProveedor])

  useEffect(() => {
    void load()
  }, [load])

  const saldo = useMemo(() => {
    const last = ultimoMovimientoCronologico(rows)
    if (last) return Number(last.saldo) || 0
    if (saldoDeuda != null) return saldoDeuda
    return saldoCuentaProveedor({ saldo_listado: saldoListado ?? null })
  }, [rows, saldoDeuda, saldoListado])

  const estado = estadoCuentaProveedor(saldo)

  const resumen = useMemo(() => {
    let totalDebe = 0
    let totalHaber = 0
    let facturas = 0
    let pagos = 0
    let conAdjunto = 0
    for (const r of rows) {
      totalDebe += Number(r.debe) || 0
      totalHaber += Number(r.haber) || 0
      if (esPagoMov(r)) pagos += 1
      else facturas += 1
      if (adjuntosDeMovimiento(r).length > 0) conAdjunto += 1
    }
    const ultimo = ultimoMovimientoCronologico(rows)
    const saldoActual =
      ultimo != null
        ? Number(ultimo.saldo) || 0
        : saldoDeuda != null
          ? saldoDeuda
          : saldoCuentaProveedor({ saldo_listado: saldoListado ?? null })
    // Si no hay facturas en libro pero hay deuda de listado, igual se muestra.
    const debeVisible =
      totalDebe > 0.009 ? totalDebe : saldoActual > 0.009 ? saldoActual : 0
    const debeSinFactura = totalDebe <= 0.009 && saldoActual > 0.009
    return {
      totalDebe,
      totalHaber,
      debeVisible,
      debeSinFactura,
      origenSaldo:
        ultimo != null
          ? ('libro' as const)
          : resetMeta.at
            ? ('reset' as const)
            : ('listado' as const),
      facturas,
      pagos,
      conAdjunto,
      sinAdjunto: rows.length - conAdjunto,
      ultimoFecha: ultimo ? fmtFecha(ultimo.fecha_comprobante || ultimo.fecha_hora) : null
    }
  }, [rows, saldoDeuda, saldoListado, resetMeta.at])

  const hoyIso = getArgentinaDateString()

  const alertasVto = useMemo(
    () => facturasAlertaVencimiento(rows, hoyIso),
    [rows, hoyIso]
  )

  const visibles = useMemo(() => {
    const query = q.trim().toLowerCase()
    const filtered = rows.filter((r) => {
      const pago = esPagoMov(r)
      if (filtro === 'factura' && pago) return false
      if (filtro === 'pago' && !pago) return false
      if (!query) return true
      const hay =
        `${r.id} ${r.comprobante} ${r.tipo_movimiento} ${r.fecha_comprobante || ''} ${r.fecha_vencimiento || ''} ${r.fecha_hora} ${r.enlace_tipo || ''}`.toLowerCase()
      return hay.includes(query)
    })
    if (ordenLibro === 'reciente') return [...filtered].reverse()
    return filtered
  }, [rows, q, filtro, ordenLibro])

  const handleArchivos = async (files: File[]) => {
    setArchivos(files)
    setExtracto(null)
    setPreview(null)
    setError(null)
    const first = files[0]
    if (!first) return
    setExtracting(true)
    try {
      const dataUrl = await fileToDataUrl(first)
      setPreview(dataUrl)
      const data = await extraerDatosTicket(first)
      setExtracto(data)
      if (data.total != null && Number(data.total) > 0) setMonto(String(data.total))
      if (data.fecha) setFecha(String(data.fecha).slice(0, 10))
      if (data.fecha_vencimiento) setFechaVto(String(data.fecha_vencimiento).slice(0, 10))
      const nro = (data.numero_comprobante || '').trim()
      if (nro) setComprobante(nro)
      else if (data.descripcion) setComprobante(String(data.descripcion))
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'No se pudo leer el comprobante. Completá los datos a mano.'
      )
    } finally {
      setExtracting(false)
    }
  }

  const subirArchivos = async (files: File[]) => {
    if (!idProveedor) return [] as AdjuntoProveedor[]
    const out: AdjuntoProveedor[] = []
    for (const file of files) {
      const up = await apiService.subirAdjuntoCuentaProveedor(idProveedor, file)
      if (!up.success || !up.data) throw new Error(up.error || `No se pudo subir ${file.name}`)
      out.push(up.data)
    }
    return out
  }

  const abrirEditarSaldo = () => {
    setEditandoSaldo(true)
    setSaldoEditDraft(String(Number(saldo.toFixed(2))))
    setError(null)
  }

  const cancelarEditarSaldo = () => {
    setEditandoSaldo(false)
    setSaldoEditDraft('')
  }

  const handleResetCuenta = async () => {
    if (!idProveedor || idProveedor <= 0) {
      setError('Este proveedor todavía no tiene ficha.')
      return
    }
    const ok = window.confirm(
      `Vas a resetear la cuenta de ${proveedorNombre || 'este proveedor'}:\n` +
        `• Borra todos los movimientos del libro\n` +
        `• Borra los pagos vinculados\n` +
        `• Deja el saldo en $ 0,00\n\n` +
        `Quedará registrado quién lo hizo. ¿Continuar?`
    )
    if (!ok) return

    setReseteando(true)
    setError(null)
    setEditandoSaldo(false)
    try {
      const r = await apiService.resetCuentaProveedor(idProveedor)
      if (!r.success || !r.data) throw new Error(r.error || 'No se pudo resetear la cuenta')
      setSaldoDeuda(0)
      setResetMeta({ por: r.data.reset_por, at: r.data.reset_at })
      setRows([])
      await load()
      onChanged?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo resetear la cuenta')
    } finally {
      setReseteando(false)
    }
  }

  /** Ajusta el saldo con un movimiento trazable (factura o pago de diferencia). */
  const guardarSaldoEditado = async () => {
    if (!idProveedor || idProveedor <= 0) {
      setError('Este proveedor todavía no tiene ficha.')
      return
    }
    const nuevo = Number(String(saldoEditDraft).replace(',', '.'))
    if (!Number.isFinite(nuevo)) {
      setError('Indicá un saldo válido. Positivo = le debemos; negativo = a favor nuestro.')
      return
    }
    const diff = Number((nuevo - saldo).toFixed(2))
    if (Math.abs(diff) < 0.01) {
      cancelarEditarSaldo()
      return
    }
    const ok = window.confirm(
      diff > 0
        ? `Vas a subir la deuda en ${moneyProveedor(diff)} (ajuste como factura). ¿Continuar?`
        : `Vas a bajar la deuda en ${moneyProveedor(Math.abs(diff))} (ajuste como “Le pagamos”). ¿Continuar?`
    )
    if (!ok) return

    setGuardandoSaldo(true)
    setError(null)
    try {
      const tipoAjuste: 'factura' | 'pago' = diff > 0 ? 'factura' : 'pago'
      // Comprobante único: el índice unique (proveedor, fecha_hora, comprobante) choca si se ajusta 2 veces el mismo día.
      const stamp = new Date()
        .toISOString()
        .replace(/[-:TZ.]/g, '')
        .slice(0, 14)
      const r = await apiService.registrarEnCuentaProveedor({
        id_proveedor: idProveedor,
        tipo: tipoAjuste,
        monto: Math.abs(diff),
        fecha: getArgentinaDateString(),
        comprobante: `AJUSTE-SALDO-${getArgentinaDateString()}-${stamp}`,
        usuario: 'Ajuste manual de saldo'
      })
      if (!r.success) throw new Error(r.error || 'No se pudo ajustar el saldo')
      setEditandoSaldo(false)
      setSaldoEditDraft('')
      if (tipoAjuste === 'pago') {
        setTipo('pago')
        setMonto('')
        setComprobante('')
      } else {
        setTipo('factura')
      }
      await load()
      onChanged?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo ajustar el saldo')
    } finally {
      setGuardandoSaldo(false)
    }
  }

  const handleRegistrar = async () => {
    if (!idProveedor || idProveedor <= 0) {
      setError('Este proveedor todavía no tiene ficha. Completala antes de cargar la cuenta.')
      return
    }
    const valor = Number(String(monto).replace(',', '.'))
    if (!(valor > 0)) {
      setError('El importe tiene que ser mayor a 0.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const adjuntos = await subirArchivos(archivos)
      const r = await apiService.registrarEnCuentaProveedor({
        id_proveedor: idProveedor,
        tipo,
        monto: valor,
        fecha,
        comprobante: comprobante.trim() || undefined,
        url_adjunto: adjuntos[0]?.url ?? null,
        url_adjuntos: adjuntos,
        fecha_vencimiento: tipo === 'factura' && fechaVto ? fechaVto : null
      })
      if (!r.success) throw new Error(r.error || 'No se pudo registrar')
      setMonto('')
      setComprobante('')
      setFechaVto('')
      setArchivos([])
      setPreview(null)
      setExtracto(null)
      if (fileRef.current) fileRef.current.value = ''
      await load()
      onChanged?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo registrar')
    } finally {
      setSaving(false)
    }
  }

  const handleAdjuntarExistente = async (idMovimiento: number, files: FileList | null) => {
    if (!files?.length || !idProveedor) return
    setAdjuntandoId(idMovimiento)
    setError(null)
    try {
      const adjuntos = await subirArchivos(Array.from(files))
      const r = await apiService.adjuntarComprobanteMovimientoProveedor(idMovimiento, adjuntos)
      if (!r.success) throw new Error(r.error || 'No se pudo adjuntar')
      await load()
      onChanged?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo adjuntar')
    } finally {
      setAdjuntandoId(null)
      if (attachRef.current) attachRef.current.value = ''
    }
  }

  const exportarPdfCuenta = () => {
    void descargarCuentaProveedorPdf({
      proveedor: {
        nombre: proveedorNombre || 'Proveedor',
        cuit: proveedorCuit,
        telefono: proveedorTelefono,
        email: proveedorEmail,
        domicilio: proveedorDomicilio
      },
      saldoActual: saldo,
      totalDebe: resumen.totalDebe,
      totalHaber: resumen.totalHaber,
      movimientos: rows
    })
  }

  const exportarPdfVencimientos = () => {
    if (alertasVto.length === 0) return
    void descargarVencimientosProveedoresPdf(alertasVto, {
      titulo: `Vencimientos · ${proveedorNombre || 'Proveedor'}`,
      nota: `Facturas de ${proveedorNombre || 'este proveedor'} vencidas o por vencer en 14 días.`
    })
  }

  const exportarCsv = () => {
    const header = [
      'id',
      'fecha_comprobante',
      'fecha_vencimiento',
      'fecha_registro',
      'tipo',
      'comprobante',
      'debe',
      'haber',
      'saldo',
      'enlace_tipo',
      'id_pago_proveedor',
      'url_adjuntos'
    ]
    const lines = [header.join(',')]
    for (const r of rows) {
      const urls = adjuntosDeMovimiento(r)
        .map((a) => a.url)
        .join(' | ')
      lines.push(
        [
          r.id,
          (r.fecha_comprobante || '').slice(0, 10),
          (r.fecha_vencimiento || '').slice(0, 10),
          r.fecha_hora || '',
          etiquetaTipo(r),
          r.comprobante || '',
          Number(r.debe) || 0,
          Number(r.haber) || 0,
          Number(r.saldo) || 0,
          r.enlace_tipo || '',
          r.id_pago_proveedor ?? '',
          urls
        ]
          .map(csvEscape)
          .join(',')
      )
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const slug = (proveedorNombre || `proveedor-${idProveedor}`).replace(/\s+/g, '-').slice(0, 40)
    a.href = url
    a.download = `${slug}-cuenta-${getArgentinaDateString()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (!idProveedor || idProveedor <= 0) {
    return (
      <div className="prov-cuenta">
        <p className="prov-cuenta__vacio">
          Completá la ficha de {proveedorNombre || 'este proveedor'} para poder cargarle facturas y
          pagos.
        </p>
      </div>
    )
  }

  if (loading) {
    return <div className="deudas-prov-loading">Cargando cuenta…</div>
  }

  return (
    <div className="prov-cuenta">
      <section className={`prov-cuenta__saldo prov-cuenta__saldo--${estado.cls}`}>
        <div className="prov-cuenta__saldo-top">
          <div className="prov-cuenta__hero">
            <span className="prov-cuenta__eyebrow">Situación con {proveedorNombre || 'el proveedor'}</span>
            <p className={`prov-cuenta__pill prov-cuenta__pill--${estado.cls}`}>{estado.label}</p>
            {editandoSaldo ? (
              <div className="prov-cuenta__saldo-edit">
                <label>
                  Nuevo saldo
                  <span>(+ le debemos · − a favor nuestro)</span>
                  <input
                    type="number"
                    step="0.01"
                    value={saldoEditDraft}
                    onChange={(e) => setSaldoEditDraft(e.target.value)}
                    autoFocus
                  />
                </label>
                <div className="prov-cuenta__saldo-edit-actions">
                  <button
                    type="button"
                    className="cp-btn cp-btn--primary"
                    disabled={guardandoSaldo}
                    onClick={() => void guardarSaldoEditado()}
                  >
                    {guardandoSaldo ? 'Guardando…' : 'Guardar saldo'}
                  </button>
                  <button
                    type="button"
                    className="cp-btn cp-btn--ghost"
                    disabled={guardandoSaldo}
                    onClick={cancelarEditarSaldo}
                  >
                    Cancelar
                  </button>
                </div>
                <p className="prov-cuenta__saldo-edit-hint">
                  La diferencia se registra en el libro (factura o “Le pagamos”) con comprobante
                  AJUSTE-SALDO, para que quede trazable.
                </p>
              </div>
            ) : (
              <>
                <div className="prov-cuenta__hero-amount-row">
                  <strong className="prov-cuenta__hero-amount">{moneyProveedor(Math.abs(saldo))}</strong>
                  <button
                    type="button"
                    className="prov-cuenta__edit-saldo"
                    onClick={abrirEditarSaldo}
                    title="Editar saldo"
                  >
                    Editar
                  </button>
                </div>
                <p className="prov-cuenta__hero-frase">{estado.frase}</p>
              </>
            )}
            <p className="prov-cuenta__origen">
              Origen del saldo:{' '}
              {resumen.origenSaldo === 'libro'
                ? 'último movimiento del libro'
                : resumen.origenSaldo === 'reset'
                  ? 'reset de cuenta'
                  : 'listado de deudas (aún sin factura en el libro)'}
            </p>
            {resetMeta.por && resetMeta.at ? (
              <p className="prov-cuenta__reset-meta">
                Último reset: <strong>{resetMeta.por}</strong>
                <span> · {fmtFechaHora(resetMeta.at)}</span>
              </p>
            ) : null}
          </div>
          <div className="prov-cuenta__saldo-actions">
            <button
              type="button"
              className="cp-btn cp-btn--secondary"
              onClick={() => {
                setTipo('pago')
                setEditandoSaldo(false)
                document.querySelector('.prov-cuenta__card')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }}
            >
              Le pagamos
            </button>
            <button
              type="button"
              className="cp-btn cp-btn--secondary"
              onClick={exportarPdfCuenta}
              disabled={rows.length === 0}
              title="PDF del libro con montos y fecha de vencimiento"
            >
              PDF cuenta
            </button>
            <button
              type="button"
              className="cp-btn cp-btn--secondary"
              onClick={exportarPdfVencimientos}
              disabled={alertasVto.length === 0}
              title="PDF de facturas vencidas o por vencer"
            >
              PDF vencimientos
            </button>
            <button type="button" className="cp-btn cp-btn--secondary" onClick={exportarCsv} disabled={rows.length === 0}>
              Exportar CSV
            </button>
            <button
              type="button"
              className="cp-btn cp-btn--ghost prov-cuenta__reset-btn"
              disabled={reseteando || guardandoSaldo}
              onClick={() => void handleResetCuenta()}
              title="Borra movimientos y pagos, deja saldo en 0"
            >
              {reseteando ? 'Reseteando…' : 'Reset de cuenta'}
            </button>
          </div>
        </div>
        <ul className="prov-cuenta__leyenda-chips" aria-label="Cómo leer la cuenta">
          <li>
            <span className="prov-cuenta__chip-dot prov-cuenta__chip-dot--debe" />
            <div>
              <strong>Debe</strong>
              <em>Nos facturó · sube la deuda</em>
            </div>
          </li>
          <li>
            <span className="prov-cuenta__chip-dot prov-cuenta__chip-dot--haber" />
            <div>
              <strong>Haber</strong>
              <em>Le pagamos / compensación · baja</em>
            </div>
          </li>
          <li>
            <span className="prov-cuenta__chip-dot prov-cuenta__chip-dot--saldo" />
            <div>
              <strong>Saldo</strong>
              <em>{estado.cls === 'deuda' ? 'Positivo = le debemos' : estado.cls === 'favor' ? 'Negativo = a favor' : 'Cero = al día'}</em>
            </div>
          </li>
        </ul>
        <div className="prov-cuenta__kpis">
          <article className="prov-cuenta__kpi prov-cuenta__kpi--debe">
            <em>{resumen.debeSinFactura ? 'Deuda (sin factura)' : 'Facturado (debe)'}</em>
            <b>{moneyProveedor(resumen.debeVisible)}</b>
            <small>
              {resumen.debeSinFactura
                ? 'Del listado · cargá facturas para detallar'
                : `${resumen.facturas} factura${resumen.facturas === 1 ? '' : 's'}`}
            </small>
          </article>
          <article className="prov-cuenta__kpi prov-cuenta__kpi--haber">
            <em>Pagado (haber)</em>
            <b>{moneyProveedor(resumen.totalHaber)}</b>
            <small>
              {resumen.pagos} pago{resumen.pagos === 1 ? '' : 's'}
            </small>
          </article>
          <article className="prov-cuenta__kpi prov-cuenta__kpi--saldo">
            <em>Saldo actual</em>
            <b>{moneyProveedor(saldo)}</b>
            <small>{estado.label}</small>
          </article>
          <article className="prov-cuenta__kpi prov-cuenta__kpi--trace">
            <em>Trazabilidad</em>
            <b>
              {resumen.conAdjunto}/{rows.length}
            </b>
            <small>
              con comprobante
              {resumen.sinAdjunto > 0 ? ` · ${resumen.sinAdjunto} sin adjunto` : ''}
              {resumen.ultimoFecha ? ` · último ${resumen.ultimoFecha}` : ''}
            </small>
          </article>
        </div>
      </section>

      <form
        className={`prov-cuenta__card prov-cuenta__card--${tipo}`}
        onSubmit={(e) => {
          e.preventDefault()
          void handleRegistrar()
        }}
      >
        <header className="prov-cuenta__card-head">
          <span className="prov-cuenta__step">1</span>
          <div>
            <h3>Nuevo movimiento</h3>
            <p>
              {tipo === 'factura'
                ? 'Suma al debe y aumenta lo que le debemos.'
                : 'Suma al haber y reduce la deuda (pago o compensación).'}
            </p>
          </div>
        </header>
        <div className="prov-cuenta__tipos" role="group" aria-label="Qué estás cargando">
          <button type="button" className={tipo === 'factura' ? 'is-on' : ''} onClick={() => setTipo('factura')}>
            Nos facturó
          </button>
          <button type="button" className={tipo === 'pago' ? 'is-on' : ''} onClick={() => setTipo('pago')}>
            Le pagamos
          </button>
        </div>

        <div className={`prov-cuenta__grid ${tipo === 'factura' ? 'prov-cuenta__grid--factura' : ''}`}>
          <label>
            Importe
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              placeholder="0,00"
              required
            />
          </label>
          <label>
            Fecha comprobante
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
          </label>
          {tipo === 'factura' ? (
            <label>
              Fecha de vencimiento
              <input
                type="date"
                value={fechaVto}
                onChange={(e) => setFechaVto(e.target.value)}
                min={fecha || undefined}
              />
            </label>
          ) : null}
          <label>
            N° comprobante
            <input
              type="text"
              value={comprobante}
              onChange={(e) => setComprobante(e.target.value)}
              placeholder={tipo === 'factura' ? '0001-00001234' : 'Recibo / transferencia / COMP-…'}
            />
          </label>
        </div>

        <label className="prov-cuenta__drop">
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf,image/*"
            multiple
            onChange={(e) => {
              const files = Array.from(e.target.files ?? [])
              void handleArchivos(files)
            }}
          />
          <strong>
            {tipo === 'factura' ? 'Adjuntar factura' : 'Adjuntar comprobante de pago'}
          </strong>
          <span>
            {extracting
              ? 'La IA está leyendo el comprobante…'
              : 'PDF o foto. La IA completa importe, fecha y número. Queda vinculado al movimiento.'}
          </span>
          {archivos.length > 0 && !extracting && (
            <em>
              {archivos.length} archivo{archivos.length === 1 ? '' : 's'}:{' '}
              {archivos.map((f) => f.name).join(', ')}
            </em>
          )}
        </label>

        {preview && (
          <div className="prov-cuenta__preview">
            {preview.startsWith('data:application/pdf') ? (
              <object data={preview} type="application/pdf" className="prov-cuenta__preview-pdf">
                <span>Vista previa PDF</span>
              </object>
            ) : (
              <img src={preview} alt="Comprobante" />
            )}
            {extracto && (
              <div className="prov-cuenta__ia">
                <strong>Leído por IA</strong>
                <span>
                  {extracto.total != null ? moneyProveedor(extracto.total) : 'sin total'}
                  {extracto.fecha ? ` · ${extracto.fecha.slice(0, 10)}` : ''}
                  {extracto.numero_comprobante ? ` · ${extracto.numero_comprobante}` : ''}
                  {extracto.proveedor ? ` · ${extracto.proveedor}` : ''}
                </span>
                {extracto.confidence != null && (
                  <em>Confianza {Math.round(extracto.confidence * 100)}% — revisá y guardá</em>
                )}
              </div>
            )}
          </div>
        )}

        <button type="submit" className="cp-btn cp-btn--primary" disabled={saving || extracting}>
          {extracting
            ? 'Leyendo comprobante…'
            : saving
              ? 'Guardando…'
              : tipo === 'factura'
                ? 'Registrar factura (debe)'
                : 'Registrar pago (haber)'}
        </button>
      </form>

      {error && <p className="prov-cuenta__error">{error}</p>}

      {alertasVto.length > 0 ? (
        <div className="prov-cuenta__alerta-vto" role="status">
          <div>
            <strong>
              {alertasVto.filter((a) => a.estado === 'vencida').length > 0
                ? 'Hay facturas vencidas'
                : 'Próximos vencimientos'}
            </strong>
            <span>
              {alertasVto.length} factura{alertasVto.length === 1 ? '' : 's'} ·{' '}
              {moneyProveedor(alertasVto.reduce((s, a) => s + a.monto, 0))}
              {alertasVto[0]
                ? ` · primera vto ${fmtFecha(alertasVto[0].fecha_vencimiento)}`
                : ''}
            </span>
          </div>
          <button type="button" className="cp-btn cp-btn--secondary" onClick={exportarPdfVencimientos}>
            Descargar PDF
          </button>
        </div>
      ) : null}

      <section className="prov-cuenta__libro">
        <div className="prov-cuenta__libro-head">
          <span className="prov-cuenta__step">2</span>
          <div>
            <h3>Libro de cuenta</h3>
            <p>
              Cada fila deja saldo corrido. Buscá por n° de comprobante, tipo o ID de movimiento.
            </p>
          </div>
        </div>

        <div className="prov-cuenta__toolbar">
          <input
            type="search"
            className="prov-cuenta__buscar"
            placeholder="Buscar ID, factura, recibo, fecha…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <div className="prov-cuenta__chips">
            {(
              [
                ['todos', 'Todo'],
                ['factura', 'Facturas'],
                ['pago', 'Pagos']
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={filtro === key ? 'is-on' : ''}
                onClick={() => setFiltro(key)}
              >
                {label}
              </button>
            ))}
            <button
              type="button"
              className={ordenLibro === 'crono' ? 'is-on' : ''}
              onClick={() => setOrdenLibro('crono')}
              title="Más viejo → más nuevo (trazabilidad)"
            >
              Cronológico
            </button>
            <button
              type="button"
              className={ordenLibro === 'reciente' ? 'is-on' : ''}
              onClick={() => setOrdenLibro('reciente')}
            >
              Más reciente
            </button>
          </div>
        </div>

        {visibles.length === 0 ? (
          <p className="prov-cuenta__vacio">
            {rows.length === 0
              ? `Todavía no hay movimientos. Cargá una factura de ${proveedorNombre || 'este proveedor'} o un pago.`
              : 'Ningún movimiento coincide con la búsqueda.'}
          </p>
        ) : (
          <div className="prov-cuenta__tabla-wrap">
            <table className="prov-cuenta__tabla-libro">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Fecha</th>
                  <th>Vto</th>
                  <th>Tipo</th>
                  <th>Comprobante</th>
                  <th className="num">Debe</th>
                  <th className="num">Haber</th>
                  <th className="num">Saldo</th>
                  <th>Comprobantes</th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((r) => {
                  const pago = esPagoMov(r)
                  const debe = Number(r.debe) || 0
                  const haber = Number(r.haber) || 0
                  const adjuntos = adjuntosDeMovimiento(r)
                  const estVto = pago
                    ? null
                    : estadoVencimientoFactura(r.fecha_vencimiento, hoyIso)
                  return (
                    <tr
                      key={r.id}
                      className={pago ? 'prov-cuenta__tr--pago' : 'prov-cuenta__tr--factura'}
                    >
                      <td className="prov-cuenta__id" title={`Registro #${r.id}`}>
                        #{r.id}
                        {r.id_pago_proveedor ? (
                          <small>pago #{r.id_pago_proveedor}</small>
                        ) : null}
                      </td>
                      <td>
                        <strong>{fmtFecha(r.fecha_comprobante || r.fecha_hora)}</strong>
                        <small className="prov-cuenta__meta">reg. {fmtFechaHora(r.fecha_hora)}</small>
                      </td>
                      <td>
                        {r.fecha_vencimiento ? (
                          <>
                            <strong>{fmtFecha(r.fecha_vencimiento)}</strong>
                            {estVto && estVto !== 'ok' ? (
                              <small className={`prov-cuenta__vto-badge prov-cuenta__vto-badge--${estVto}`}>
                                {etiquetaEstadoVencimiento(estVto)}
                              </small>
                            ) : null}
                          </>
                        ) : (
                          <span className="prov-cuenta__meta">—</span>
                        )}
                      </td>
                      <td>
                        <span className={`prov-mov__kind ${pago ? 'is-pago' : 'is-factura'}`}>
                          {etiquetaTipo(r)}
                        </span>
                        {r.enlace_tipo ? (
                          <small className="prov-cuenta__meta">enlace {r.enlace_tipo}</small>
                        ) : null}
                      </td>
                      <td>
                        <strong>{r.comprobante || '—'}</strong>
                      </td>
                      <td className="num">{debe > 0.009 ? moneyProveedor(debe) : '—'}</td>
                      <td className="num">{haber > 0.009 ? moneyProveedor(haber) : '—'}</td>
                      <td className="num">
                        <strong>{moneyProveedor(Number(r.saldo) || 0)}</strong>
                      </td>
                      <td>
                        {adjuntos.length > 0 ? (
                          <div className="prov-mov__files">
                            {adjuntos.map((a) => (
                              <a key={a.url} href={a.url} target="_blank" rel="noreferrer">
                                {a.nombre || 'Ver'}
                              </a>
                            ))}
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="prov-mov__attach"
                            disabled={adjuntandoId === r.id}
                            onClick={() => {
                              pendingAttachId.current = r.id
                              attachRef.current?.click()
                            }}
                          >
                            {adjuntandoId === r.id ? 'Subiendo…' : '+ Adjuntar'}
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <input
        ref={attachRef}
        type="file"
        accept="application/pdf,image/*"
        multiple
        hidden
        onChange={(e) => {
          const id = pendingAttachId.current
          if (id != null) void handleAdjuntarExistente(id, e.target.files)
        }}
      />
    </div>
  )
}

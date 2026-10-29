import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import apiService from '../../services/api'
import type { MovimientoProveedorEnriquecido } from '../../types/api'
import { getArgentinaDateString } from '../../utils/dateUtils'
import { extraerDatosTicket, fileToDataUrl, type TicketExtract } from '../../utils/extractTicketAi'
import {
  adjuntosDeMovimiento,
  estadoCuentaProveedor,
  moneyProveedor,
  saldoCuentaProveedor,
  type AdjuntoProveedor
} from '../../utils/proveedorCuenta'
import '../../pages/DeudasProveedoresPage.css'

type Props = {
  idProveedor?: number
  proveedorNombre?: string
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

export default function ProveedorCuentaPanel({
  idProveedor,
  proveedorNombre,
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

  const load = useCallback(async () => {
    if (!idProveedor || idProveedor <= 0) {
      setRows([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    const r = await apiService.getMovimientosProveedores({ idProveedor })
    if (r.success && r.data) setRows(r.data.filter((m) => !m.es_saldo_inicial))
    else {
      setRows([])
      setError(r.error || 'No se pudo cargar la cuenta')
    }
    setLoading(false)
  }, [idProveedor])

  useEffect(() => {
    void load()
  }, [load])

  const saldo = useMemo(() => {
    const last = rows[rows.length - 1]
    if (last) return Number(last.saldo) || 0
    return saldoCuentaProveedor({ saldo_listado: saldoListado ?? null })
  }, [rows, saldoListado])

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
    const ultimo = rows[rows.length - 1]
    const saldoActual =
      ultimo != null
        ? Number(ultimo.saldo) || 0
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
      origenSaldo: ultimo != null ? ('libro' as const) : ('listado' as const),
      facturas,
      pagos,
      conAdjunto,
      sinAdjunto: rows.length - conAdjunto,
      ultimoFecha: ultimo ? fmtFecha(ultimo.fecha_comprobante || ultimo.fecha_hora) : null
    }
  }, [rows, saldoListado])

  const visibles = useMemo(() => {
    const query = q.trim().toLowerCase()
    const filtered = rows.filter((r) => {
      const pago = esPagoMov(r)
      if (filtro === 'factura' && pago) return false
      if (filtro === 'pago' && !pago) return false
      if (!query) return true
      const hay =
        `${r.id} ${r.comprobante} ${r.tipo_movimiento} ${r.fecha_comprobante || ''} ${r.fecha_hora} ${r.enlace_tipo || ''}`.toLowerCase()
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
      const r = await apiService.registrarEnCuentaProveedor({
        id_proveedor: idProveedor,
        tipo: tipoAjuste,
        monto: Math.abs(diff),
        fecha: getArgentinaDateString(),
        comprobante: `AJUSTE-SALDO-${getArgentinaDateString()}`,
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
        url_adjuntos: adjuntos
      })
      if (!r.success) throw new Error(r.error || 'No se pudo registrar')
      setMonto('')
      setComprobante('')
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

  const exportarCsv = () => {
    const header = [
      'id',
      'fecha_comprobante',
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
                : 'listado de deudas (aún sin factura en el libro)'}
            </p>
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
            <button type="button" className="cp-btn cp-btn--secondary" onClick={exportarCsv} disabled={rows.length === 0}>
              Exportar CSV
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

        <div className="prov-cuenta__grid">
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

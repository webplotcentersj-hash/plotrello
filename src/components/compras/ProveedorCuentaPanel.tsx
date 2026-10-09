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

function esPagoMov(r: MovimientoProveedorEnriquecido): boolean {
  return (Number(r.haber) || 0) > 0.009 || /pago/i.test(r.tipo_movimiento)
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
  const [adjuntandoId, setAdjuntandoId] = useState<number | null>(null)

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

  const visibles = useMemo(() => {
    const query = q.trim().toLowerCase()
    return [...rows].reverse().filter((r) => {
      const pago = esPagoMov(r)
      if (filtro === 'factura' && pago) return false
      if (filtro === 'pago' && !pago) return false
      if (!query) return true
      const hay = `${r.comprobante} ${r.tipo_movimiento} ${r.fecha_comprobante || ''}`.toLowerCase()
      return hay.includes(query)
    })
  }, [rows, q, filtro])

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
        <span>Situación con {proveedorNombre || 'el proveedor'}</span>
        <strong>{estado.frase}</strong>
        <p>
          {rows.length} movimiento{rows.length === 1 ? '' : 's'} · factura suma deuda · pago la baja
        </p>
      </section>

      <form
        className="prov-cuenta__card"
        onSubmit={(e) => {
          e.preventDefault()
          void handleRegistrar()
        }}
      >
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
            Fecha
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
          </label>
          <label>
            N° comprobante
            <input
              type="text"
              value={comprobante}
              onChange={(e) => setComprobante(e.target.value)}
              placeholder={tipo === 'factura' ? '0001-00001234' : 'Recibo / transferencia'}
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
              ? 'La IA está leyendo el comprobante, como en Gastos…'
              : 'PDF o foto. La IA completa importe, fecha y número.'}
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
                ? 'Registrar deuda'
                : 'Registrar pago'}
        </button>
      </form>

      {error && <p className="prov-cuenta__error">{error}</p>}

      <div className="prov-cuenta__toolbar">
        <input
          type="search"
          className="prov-cuenta__buscar"
          placeholder="Buscar factura, recibo o fecha…"
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
        </div>
      </div>

      {visibles.length === 0 ? (
        <p className="prov-cuenta__vacio">
          {rows.length === 0
            ? `Todavía no hay movimientos. Cargá una factura de ${proveedorNombre || 'este proveedor'} o un pago.`
            : 'Ningún movimiento coincide con la búsqueda.'}
        </p>
      ) : (
        <ul className="prov-cuenta__lista">
          {visibles.map((r) => {
            const pago = esPagoMov(r)
            const importe = pago ? Number(r.haber) || 0 : Number(r.debe) || 0
            const adjuntos = adjuntosDeMovimiento(r)
            return (
              <li key={r.id} className={`prov-mov ${pago ? 'prov-mov--pago' : 'prov-mov--factura'}`}>
                <div className="prov-mov__kind">{pago ? 'Pago' : 'Factura'}</div>
                <div className="prov-mov__body">
                  <strong>{r.comprobante || (pago ? 'Pago' : 'Factura')}</strong>
                  <span>{fmtFecha(r.fecha_comprobante || r.fecha_hora)}</span>
                  {adjuntos.length > 0 ? (
                    <div className="prov-mov__files">
                      {adjuntos.map((a) => (
                        <a key={a.url} href={a.url} target="_blank" rel="noreferrer">
                          {a.nombre || 'Ver archivo'}
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
                      {adjuntandoId === r.id ? 'Subiendo…' : 'Adjuntar'}
                    </button>
                  )}
                </div>
                <div className="prov-mov__montos">
                  <b>
                    {pago ? '−' : '+'}
                    {moneyProveedor(importe)}
                  </b>
                  <small>Saldo {moneyProveedor(Number(r.saldo) || 0)}</small>
                </div>
              </li>
            )
          })}
        </ul>
      )}

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

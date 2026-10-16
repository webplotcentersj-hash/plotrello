import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'
import { supabase } from '../services/supabaseClient'
import { extraerDatosTicket, fileToDataUrl, type TicketExtract } from '../utils/extractTicketAi'
import { uploadAttachmentAndGetUrl } from '../utils/storage'
import { getArgentinaDateString } from '../utils/dateUtils'
import { gastoPuedeIrALibroIva, inferirAlicuotaIva, netoEIvaDesdeTotal } from '../utils/gastoIvaLibro'
import { syncGastoALibroIva } from '../utils/syncGastoALibroIva'
import './ErpSectionPage.css'

type GastosFilter = 'todo' | 'corrientes' | 'tickets'
type IvaFiltro = '' | 'con' | 'sin' | 'pendiente'

type ErpGastoRow = {
  id: number
  created_at: string
  updated_at: string
  fecha_gasto: string
  proveedor: string | null
  categoria: string | null
  descripcion: string | null
  total: number
  iva: number | null
  neto: number | null
  moneda: string | null
  metodo_pago: string | null
  ticket_url: string | null
  ticket_raw: Record<string, unknown> | null
  origen: 'manual' | 'ticket_ai' | string
  id_factura_compra?: number | null
  proveedor_cuit?: string | null
  numero_comprobante?: string | null
  punto_venta?: number | null
  letra?: string | null
  observaciones?: string | null
  iva_porcentaje?: number | null
  tipo_comprobante?: string | null
  cae?: string | null
  centro_costo?: string | null
}

type GastoForm = {
  fecha_gasto: string
  proveedor: string
  proveedor_cuit: string
  categoria: string
  descripcion: string
  centro_costo: string
  total: string
  iva: string
  neto: string
  iva_porcentaje: string
  moneda: string
  metodo_pago: string
  tipo_comprobante: string
  letra: string
  punto_venta: string
  numero_comprobante: string
  cae: string
  observaciones: string
  ticket_url: string
  enviar_libro_iva: boolean
}

const PIE_COLORS = ['#f97316', '#38bdf8', '#a78bfa', '#34d399', '#fbbf24', '#fb7185', '#94a3b8', '#e2e8f0']
const METODOS_PAGO = ['Efectivo', 'Tarjeta', 'Débito', 'Transferencia', 'Cheque', 'Cuenta corriente', 'Mercado Pago', 'Otro'] as const
const TIPOS_COMPROBANTE = ['Factura', 'Ticket', 'Recibo', 'Nota de Crédito', 'Nota de Débito'] as const
const ALICUOTAS = ['21', '10.5', '27', '5', '2.5', '0'] as const

function ymdToday() {
  return getArgentinaDateString()
}

function money(n: number | null | undefined) {
  return `$${(Number(n) || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
}

function emptyForm(): GastoForm {
  return {
    fecha_gasto: ymdToday(),
    proveedor: '',
    proveedor_cuit: '',
    categoria: '',
    descripcion: '',
    centro_costo: '',
    total: '',
    iva: '',
    neto: '',
    iva_porcentaje: '',
    moneda: 'ARS',
    metodo_pago: 'Efectivo',
    tipo_comprobante: 'Factura',
    letra: '',
    punto_venta: '',
    numero_comprobante: '',
    cae: '',
    observaciones: '',
    ticket_url: '',
    enviar_libro_iva: true
  }
}

function matchBusqueda(r: ErpGastoRow, q: string): boolean {
  if (!q) return true
  const hay = [
    r.proveedor,
    r.categoria,
    r.descripcion,
    r.metodo_pago,
    r.numero_comprobante,
    r.proveedor_cuit,
    r.letra,
    r.tipo_comprobante,
    r.cae,
    r.centro_costo,
    r.observaciones,
    String(r.total ?? ''),
    String(r.fecha_gasto || '')
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return hay.includes(q)
}

function safeNumber(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  const s = String(v ?? '').trim().replace(',', '.')
  if (!s) return null
  const n = Number(s)
  if (!Number.isFinite(n)) return null
  return n
}

function comprobanteLabel(r: Pick<ErpGastoRow, 'letra' | 'punto_venta' | 'numero_comprobante' | 'tipo_comprobante'>) {
  const nro = (r.numero_comprobante || '').trim()
  const tipo = (r.tipo_comprobante || '').trim()
  const letra = (r.letra || '').trim()
  const pv = r.punto_venta != null && r.punto_venta > 0 ? String(r.punto_venta).padStart(4, '0') : ''
  const parts = [tipo, letra, nro.includes('-') ? nro : pv && nro ? `${pv}-${nro}` : nro].filter(Boolean)
  return parts.join(' ') || '—'
}

function recalcForm(prev: GastoForm, patch: Partial<GastoForm>): GastoForm {
  const next = { ...prev, ...patch }
  const total = safeNumber(next.total)
  const alic = safeNumber(next.iva_porcentaje)
  if (patch.iva_porcentaje != null || (patch.total != null && alic != null && alic >= 0 && total != null)) {
    if (total != null && alic != null && alic >= 0) {
      const neto = total / (1 + alic / 100)
      next.neto = (Math.round(neto * 100) / 100).toFixed(2)
      next.iva = (Math.round((total - neto) * 100) / 100).toFixed(2)
      return next
    }
  }
  if (patch.iva != null && total != null) {
    const iva = safeNumber(next.iva) ?? 0
    next.neto = (Math.round((total - iva) * 100) / 100).toFixed(2)
  } else if (patch.neto != null && total != null) {
    const neto = safeNumber(next.neto) ?? 0
    next.iva = (Math.round((total - neto) * 100) / 100).toFixed(2)
  } else if (patch.total != null && total != null) {
    const iva = safeNumber(next.iva)
    if (iva != null) next.neto = (Math.round((total - iva) * 100) / 100).toFixed(2)
  }
  return next
}

export default function ErpGastosPage() {
  const navigate = useNavigate()
  const [filter, setFilter] = useState<GastosFilter>('todo')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<ErpGastoRow[]>([])
  const [catOptions, setCatOptions] = useState<string[]>([])
  const [ticketPreview, setTicketPreview] = useState<string | null>(null)
  const [ticketUploading, setTicketUploading] = useState(false)
  const [ticketExtracting, setTicketExtracting] = useState(false)
  const [ticketExtract, setTicketExtract] = useState<TicketExtract | null>(null)

  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [categoriaFiltro, setCategoriaFiltro] = useState('')
  const [buscar, setBuscar] = useState('')
  const [metodoFiltro, setMetodoFiltro] = useState('')
  const [ivaFiltro, setIvaFiltro] = useState<IvaFiltro>('')
  const [trazadoId, setTrazadoId] = useState<number | null>(null)
  const [syncingIva, setSyncingIva] = useState<number | null>(null)
  const [soloHoy, setSoloHoy] = useState(false)

  const [form, setForm] = useState<GastoForm>(() => emptyForm())

  const reload = async () => {
    if (!supabase) return
    setLoading(true)
    setError(null)
    try {
      const { data, error: err } = await supabase
        .from('erp_gastos')
        .select('*')
        .order('fecha_gasto', { ascending: false })
        .limit(500)
      if (err) throw new Error(err.message)
      setRows((data as ErpGastoRow[]) || [])
    } catch (e) {
      setRows([])
      const msg = e instanceof Error ? e.message : 'Error cargando gastos.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const loadCategorias = async () => {
    if (!supabase) return
    try {
      const { data, error: err } = await supabase.from('erp_gastos_categorias').select('nombre').order('nombre', { ascending: true })
      if (err) return
      const list = ((data as Array<{ nombre: string }>) || []).map((r) => r.nombre).filter(Boolean)
      setCatOptions(list)
    } catch {
      setCatOptions([])
    }
  }

  useEffect(() => {
    void reload()
    void loadCategorias()
  }, [])

  const subtitle = useMemo(() => {
    if (filter === 'corrientes') return 'Gastos corrientes · Alta manual y control'
    if (filter === 'tickets') return 'Tickets · Carga con extracción automática'
    return 'Gastos corrientes + tickets · Control, IVA y trazado'
  }, [filter])

  const hoy = ymdToday()

  const filteredRows = useMemo(() => {
    const q = buscar.trim().toLowerCase()
    let list = rows
    if (soloHoy) list = list.filter((r) => String(r.fecha_gasto).slice(0, 10) === hoy)
    if (fechaDesde) list = list.filter((r) => String(r.fecha_gasto).slice(0, 10) >= fechaDesde)
    if (fechaHasta) list = list.filter((r) => String(r.fecha_gasto).slice(0, 10) <= fechaHasta)
    if (categoriaFiltro) list = list.filter((r) => (r.categoria || '') === categoriaFiltro)
    if (metodoFiltro) list = list.filter((r) => (r.metodo_pago || '') === metodoFiltro)
    if (filter === 'corrientes') list = list.filter((r) => !r.ticket_url)
    if (filter === 'tickets') list = list.filter((r) => !!r.ticket_url)
    if (ivaFiltro === 'con') list = list.filter((r) => gastoPuedeIrALibroIva(r.iva))
    if (ivaFiltro === 'sin') list = list.filter((r) => !gastoPuedeIrALibroIva(r.iva))
    if (ivaFiltro === 'pendiente') {
      list = list.filter((r) => gastoPuedeIrALibroIva(r.iva) && !r.id_factura_compra)
    }
    if (q) list = list.filter((r) => matchBusqueda(r, q))
    return [...list].sort((a, b) => {
      const da = String(a.fecha_gasto || '').slice(0, 10)
      const db = String(b.fecha_gasto || '').slice(0, 10)
      const aHoy = da === hoy ? 0 : 1
      const bHoy = db === hoy ? 0 : 1
      if (aHoy !== bHoy) return aHoy - bHoy
      if (da !== db) return db.localeCompare(da)
      return (b.id || 0) - (a.id || 0)
    })
  }, [rows, filter, fechaDesde, fechaHasta, categoriaFiltro, metodoFiltro, buscar, ivaFiltro, soloHoy, hoy])

  const trazado = useMemo(
    () => (trazadoId != null ? rows.find((r) => r.id === trazadoId) ?? null : null),
    [rows, trazadoId]
  )

  const categorias = useMemo(() => catOptions, [catOptions])
  const countHoy = useMemo(
    () => rows.filter((r) => String(r.fecha_gasto).slice(0, 10) === hoy).length,
    [rows, hoy]
  )

  const kpis = useMemo(() => {
    const total = filteredRows.reduce((sum, r) => sum + (Number(r.total) || 0), 0)
    const iva = filteredRows.reduce((sum, r) => sum + (Number(r.iva) || 0), 0)
    const neto = filteredRows.reduce((sum, r) => sum + (Number(r.neto) || 0), 0)
    const count = filteredRows.length
    const tickets = filteredRows.filter((r) => !!r.ticket_url).length
    const proveedores = new Set(filteredRows.map((r) => (r.proveedor || '').trim()).filter(Boolean)).size
    const enLibro = filteredRows.filter((r) => r.id_factura_compra).length
    return { total, iva, neto, count, tickets, proveedores, enLibro }
  }, [filteredRows])

  const byCategoria = useMemo(() => {
    const acc = new Map<string, number>()
    for (const r of filteredRows) {
      const k = (r.categoria || 'Sin categoría').trim() || 'Sin categoría'
      acc.set(k, (acc.get(k) ?? 0) + (Number(r.total) || 0))
    }
    return Array.from(acc.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8)
  }, [filteredRows])

  const byMes = useMemo(() => {
    const acc = new Map<string, number>()
    for (const r of filteredRows) {
      const key = String(r.fecha_gasto || '').slice(0, 7) || '—'
      acc.set(key, (acc.get(key) ?? 0) + (Number(r.total) || 0))
    }
    return Array.from(acc.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([mes, total]) => ({ mes, total }))
  }, [filteredRows])

  const patchForm = (patch: Partial<GastoForm>) => setForm((p) => recalcForm(p, patch))

  const handleTicketFile = async (file?: File) => {
    if (!file || !supabase) return
    setError(null)
    setTicketExtract(null)
    setTicketPreview(null)
    setTicketUploading(true)
    try {
      const preview = await fileToDataUrl(file)
      setTicketPreview(preview)

      const url = await uploadAttachmentAndGetUrl(file, 'erp-gastos')
      setForm((p) => ({ ...p, ticket_url: url }))

      setTicketExtracting(true)
      const extracted = await extraerDatosTicket(file)
      setTicketExtract(extracted)

      const total = extracted.total != null ? Number(extracted.total) : null
      const iva = extracted.iva != null ? Number(extracted.iva) : null
      const neto = extracted.neto != null ? Number(extracted.neto) : null
      const alic =
        extracted.iva_porcentaje != null
          ? Number(extracted.iva_porcentaje)
          : inferirAlicuotaIva(neto, iva)
      const split = netoEIvaDesdeTotal(total ?? 0, iva, neto)

      setForm((p) => ({
        ...p,
        fecha_gasto: (extracted.fecha || p.fecha_gasto || ymdToday()).slice(0, 10),
        proveedor: extracted.proveedor ? String(extracted.proveedor) : p.proveedor,
        proveedor_cuit: extracted.cuit ? String(extracted.cuit).replace(/\D/g, '') : p.proveedor_cuit,
        categoria: extracted.categoria ? String(extracted.categoria) : p.categoria,
        descripcion: extracted.descripcion ? String(extracted.descripcion) : p.descripcion,
        total: extracted.total != null ? String(extracted.total) : p.total,
        iva: split.iva > 0 ? String(split.iva) : extracted.iva != null ? String(extracted.iva) : p.iva,
        neto: split.neto > 0 ? String(split.neto) : extracted.neto != null ? String(extracted.neto) : p.neto,
        iva_porcentaje: alic > 0 ? String(alic) : p.iva_porcentaje,
        moneda: extracted.moneda ? String(extracted.moneda) : p.moneda,
        metodo_pago: extracted.metodo_pago ? String(extracted.metodo_pago) : p.metodo_pago,
        tipo_comprobante: extracted.tipo_comprobante ? String(extracted.tipo_comprobante) : p.tipo_comprobante,
        letra: extracted.letra ? String(extracted.letra).toUpperCase().slice(0, 1) : p.letra,
        punto_venta: extracted.punto_venta != null ? String(extracted.punto_venta) : p.punto_venta,
        numero_comprobante: extracted.numero_comprobante ? String(extracted.numero_comprobante) : p.numero_comprobante,
        cae: extracted.cae ? String(extracted.cae) : p.cae,
        enviar_libro_iva: gastoPuedeIrALibroIva(split.iva || iva)
      }))

      if (extracted.categoria) {
        await loadCategorias()
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error con ticket.')
    } finally {
      setTicketExtracting(false)
      setTicketUploading(false)
    }
  }

  const enviarAlLibro = async (row: ErpGastoRow) => {
    setSyncingIva(row.id)
    setError(null)
    try {
      const r = await syncGastoALibroIva({
        gastoId: row.id,
        fecha: String(row.fecha_gasto).slice(0, 10),
        proveedor: row.proveedor,
        cuit: row.proveedor_cuit,
        descripcion: row.descripcion,
        total: Number(row.total) || 0,
        iva: row.iva,
        neto: row.neto,
        numero_comprobante: row.numero_comprobante,
        punto_venta: row.punto_venta,
        letra: row.letra,
        iva_porcentaje: row.iva_porcentaje,
        tipo_comprobante: row.tipo_comprobante
      })
      if (!r.ok) throw new Error(r.error || 'No se pudo enviar al libro IVA')
      await reload()
      return r
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error enviando IVA al libro.'
      setError(msg)
      return { ok: false as const, error: msg }
    } finally {
      setSyncingIva(null)
    }
  }

  const handleGuardar = async () => {
    if (!supabase) return
    setError(null)
    const total = safeNumber(form.total)
    if (total == null || total <= 0) {
      alert('Ingresá un total válido.')
      return
    }
    if (!form.fecha_gasto) {
      alert('Seleccioná la fecha.')
      return
    }
    setSaving(true)
    try {
      const categoriaClean = form.categoria.trim()
      if (categoriaClean) {
        await supabase.from('erp_gastos_categorias').insert({ nombre: categoriaClean }).select().maybeSingle()
      }
      const iva = safeNumber(form.iva)
      const neto = safeNumber(form.neto)
      const payload = {
        fecha_gasto: form.fecha_gasto,
        proveedor: form.proveedor.trim() || null,
        proveedor_cuit: form.proveedor_cuit.replace(/\D/g, '') || null,
        categoria: categoriaClean || null,
        descripcion: form.descripcion.trim() || null,
        centro_costo: form.centro_costo.trim() || null,
        total,
        iva,
        neto,
        iva_porcentaje: safeNumber(form.iva_porcentaje),
        moneda: form.moneda.trim() || 'ARS',
        metodo_pago: form.metodo_pago.trim() || null,
        tipo_comprobante: form.tipo_comprobante.trim() || null,
        letra: form.letra.trim().toUpperCase().slice(0, 1) || null,
        punto_venta: safeNumber(form.punto_venta),
        numero_comprobante: form.numero_comprobante.trim() || null,
        cae: form.cae.trim() || null,
        observaciones: form.observaciones.trim() || null,
        ticket_url: form.ticket_url.trim() || null,
        ticket_raw: ticketExtract ? (ticketExtract as unknown as Record<string, unknown>) : null,
        origen: form.ticket_url ? 'ticket_ai' : 'manual'
      }
      const { data: inserted, error: err } = await supabase.from('erp_gastos').insert(payload).select('id').single()
      if (err) throw new Error(err.message)
      const gastoId = Number(inserted?.id)

      let libroMsg = ''
      if (gastoId && form.enviar_libro_iva && gastoPuedeIrALibroIva(iva)) {
        const sync = await syncGastoALibroIva({
          gastoId,
          fecha: form.fecha_gasto,
          proveedor: form.proveedor,
          cuit: form.proveedor_cuit,
          descripcion: form.descripcion,
          total,
          iva,
          neto,
          numero_comprobante: form.numero_comprobante,
          punto_venta: safeNumber(form.punto_venta),
          letra: form.letra,
          iva_porcentaje: safeNumber(form.iva_porcentaje),
          tipo_comprobante: form.tipo_comprobante
        })
        if (sync.ok && !sync.omitido) {
          libroMsg = ' IVA enviado al libro de compras.'
          setTrazadoId(gastoId)
        } else if (!sync.ok) {
          libroMsg = ` El gasto se guardó, pero el libro IVA falló: ${sync.error}`
        }
      }

      setForm(emptyForm())
      setTicketPreview(null)
      setTicketExtract(null)
      await reload()
      await loadCategorias()
      alert(`Gasto guardado.${libroMsg}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error guardando gasto.')
    } finally {
      setSaving(false)
    }
  }

  const extractChips = ticketExtract
    ? [
        ['Proveedor', ticketExtract.proveedor],
        ['CUIT', ticketExtract.cuit],
        ['Fecha', ticketExtract.fecha],
        ['Comprobante', ticketExtract.numero_comprobante],
        ['Letra', ticketExtract.letra],
        ['PV', ticketExtract.punto_venta],
        ['Tipo', ticketExtract.tipo_comprobante],
        ['Total', ticketExtract.total],
        ['Neto', ticketExtract.neto],
        ['IVA $', ticketExtract.iva],
        ['IVA %', ticketExtract.iva_porcentaje],
        ['Pago', ticketExtract.metodo_pago],
        ['CAE', ticketExtract.cae]
      ].filter(([, v]) => v != null && String(v).trim() !== '')
    : []

  return (
    <div className="erp-section">
      <div className="erp-section-header">
        <div>
          <h1>Gastos</h1>
          <p className="erp-section-sub">{subtitle}</p>
        </div>
        <div className="erp-section-actions">
          <button type="button" className="btn-secondary" onClick={() => navigate('/erp/impuestos?tab=compras')}>
            Libro IVA compras
          </button>
          <button type="button" className="btn-secondary" onClick={() => navigate('/erp')}>
            ← Volver a ERP
          </button>
        </div>
      </div>

      <div className="erp-section-grid erp-gastos-grid">
        <div className="erp-panel erp-gastos-form">
          <h2>Ingreso</h2>
          <p className="erp-muted">
            Completá el gasto a mano o subí el ticket/factura: la IA rellena proveedor, CUIT, comprobante, neto e IVA. Si hay IVA, al
            guardar entra al libro de compras.
          </p>

          <div className="erp-gastos-tabs">
            <button type="button" className={filter === 'todo' ? 'btn-primary' : 'btn-secondary'} onClick={() => setFilter('todo')}>
              Todo
            </button>
            <button
              type="button"
              className={filter === 'corrientes' ? 'btn-primary' : 'btn-secondary'}
              onClick={() => setFilter('corrientes')}
            >
              Gastos corrientes
            </button>
            <button type="button" className={filter === 'tickets' ? 'btn-primary' : 'btn-secondary'} onClick={() => setFilter('tickets')}>
              Tickets
            </button>
          </div>

          {error && (
            <p className="erp-muted" style={{ marginTop: 10, color: '#c53030' }}>
              {error}
            </p>
          )}
          {error && /relation .*erp_gastos.* does not exist/i.test(error) && (
            <p className="erp-muted" style={{ marginTop: 8 }}>
              Parece que falta crear la tabla. Ejecutá el patch <code>supabase/patches/2026-04-28_erp_gastos.sql</code> en Supabase.
            </p>
          )}
          {error && /row-level security|violates row-level security|rls/i.test(error) && (
            <p className="erp-muted" style={{ marginTop: 8 }}>
              Esto es RLS (permisos). Ejecutá/actualizá el patch <code>supabase/patches/2026-04-28_erp_gastos.sql</code> para habilitar
              insert/select desde la app.
            </p>
          )}

          <div className="erp-gastos-form-body">
            <fieldset className="erp-gastos-fieldset">
              <legend>Gasto</legend>
              <div className="erp-gastos-fields">
                <label>
                  Fecha
                  <input type="date" className="erp-input" value={form.fecha_gasto} onChange={(e) => patchForm({ fecha_gasto: e.target.value })} />
                </label>
                <label>
                  Categoría
                  <input
                    className="erp-input"
                    list="erp-gastos-categorias"
                    value={form.categoria}
                    onChange={(e) => patchForm({ categoria: e.target.value })}
                    placeholder="Combustible, Limpieza, Insumos…"
                  />
                  <datalist id="erp-gastos-categorias">
                    {categorias.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </label>
                <label className="erp-gastos-span2">
                  Proveedor
                  <input className="erp-input" value={form.proveedor} onChange={(e) => patchForm({ proveedor: e.target.value })} />
                </label>
                <label>
                  CUIT
                  <input
                    className="erp-input"
                    value={form.proveedor_cuit}
                    onChange={(e) => patchForm({ proveedor_cuit: e.target.value })}
                    placeholder="20-12345678-9"
                    inputMode="numeric"
                  />
                </label>
                <label>
                  Centro de costo
                  <input
                    className="erp-input"
                    value={form.centro_costo}
                    onChange={(e) => patchForm({ centro_costo: e.target.value })}
                    placeholder="Sucursal, área, vehículo…"
                  />
                </label>
                <label className="erp-gastos-span2">
                  Descripción
                  <input
                    className="erp-input"
                    value={form.descripcion}
                    onChange={(e) => patchForm({ descripcion: e.target.value })}
                    placeholder="Nafta, insumos, service, alquiler…"
                  />
                </label>
                <label>
                  Método de pago
                  <select className="erp-input" value={form.metodo_pago} onChange={(e) => patchForm({ metodo_pago: e.target.value })}>
                    {METODOS_PAGO.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Moneda
                  <input className="erp-input" value={form.moneda} onChange={(e) => patchForm({ moneda: e.target.value })} />
                </label>
              </div>
            </fieldset>

            <fieldset className="erp-gastos-fieldset">
              <legend>Comprobante e IVA</legend>
              <div className="erp-gastos-fields">
                <label>
                  Tipo
                  <select
                    className="erp-input"
                    value={form.tipo_comprobante}
                    onChange={(e) => patchForm({ tipo_comprobante: e.target.value })}
                  >
                    {TIPOS_COMPROBANTE.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Letra
                  <select className="erp-input" value={form.letra} onChange={(e) => patchForm({ letra: e.target.value })}>
                    <option value="">—</option>
                    {['A', 'B', 'C', 'E', 'M'].map((l) => (
                      <option key={l} value={l}>
                        {l}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Punto de venta
                  <input
                    className="erp-input"
                    value={form.punto_venta}
                    onChange={(e) => patchForm({ punto_venta: e.target.value })}
                    placeholder="0003"
                    inputMode="numeric"
                  />
                </label>
                <label>
                  N° comprobante
                  <input
                    className="erp-input"
                    value={form.numero_comprobante}
                    onChange={(e) => patchForm({ numero_comprobante: e.target.value })}
                    placeholder="0003-00001234"
                  />
                </label>
                <label>
                  CAE
                  <input className="erp-input" value={form.cae} onChange={(e) => patchForm({ cae: e.target.value })} placeholder="Opcional" />
                </label>
                <label>
                  Alícuota IVA
                  <select className="erp-input" value={form.iva_porcentaje} onChange={(e) => patchForm({ iva_porcentaje: e.target.value })}>
                    <option value="">Sin alícuota</option>
                    {ALICUOTAS.map((a) => (
                      <option key={a} value={a}>
                        {a}%
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Total
                  <input className="erp-input" value={form.total} onChange={(e) => patchForm({ total: e.target.value })} />
                </label>
                <label>
                  Neto
                  <input className="erp-input" value={form.neto} onChange={(e) => patchForm({ neto: e.target.value })} />
                </label>
                <label>
                  IVA $
                  <input className="erp-input" value={form.iva} onChange={(e) => patchForm({ iva: e.target.value })} />
                </label>
              </div>
              <label className="erp-gastos-check">
                <input
                  type="checkbox"
                  checked={form.enviar_libro_iva}
                  onChange={(e) => patchForm({ enviar_libro_iva: e.target.checked })}
                />
                Enviar IVA al libro de compras al guardar
                {gastoPuedeIrALibroIva(safeNumber(form.iva)) ? (
                  <span className="erp-gastos-iva-hint"> · se va a registrar {money(safeNumber(form.iva))}</span>
                ) : (
                  <span className="erp-gastos-iva-hint"> · sin IVA no entra al libro</span>
                )}
              </label>
            </fieldset>

            <fieldset className="erp-gastos-fieldset">
              <legend>Ticket / factura</legend>
              <div className="erp-ticket-row">
                <label className="erp-ticket-upload">
                  Foto o PDF
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(e) => {
                      void handleTicketFile(e.target.files?.[0])
                      e.target.value = ''
                    }}
                  />
                </label>
                <div className="erp-muted">
                  {ticketUploading
                    ? 'Subiendo…'
                    : ticketExtracting
                      ? 'Extrayendo datos…'
                      : form.ticket_url
                        ? 'Ticket cargado. Revisá los campos y guardá.'
                        : 'Opcional. Si hay IVA, el libro se completa solo.'}
                </div>
              </div>

              {ticketPreview && (
                <div className="erp-ticket-preview">
                  {ticketPreview.startsWith('data:application/pdf') ? (
                    <object data={ticketPreview} type="application/pdf" className="erp-ticket-preview-pdf">
                      <div className="erp-muted" style={{ padding: 10 }}>
                        Vista previa PDF no disponible. Usá el botón “Abrir” del listado luego de guardar.
                      </div>
                    </object>
                  ) : (
                    <img src={ticketPreview} alt="" />
                  )}
                  {ticketExtract?.confidence != null && (
                    <div className="erp-ticket-confidence">Confianza IA: {Math.round(ticketExtract.confidence * 100)}%</div>
                  )}
                </div>
              )}

              {extractChips.length > 0 && (
                <div className="erp-gastos-extract">
                  <div className="erp-gastos-extract__title">Datos extraídos del comprobante</div>
                  <div className="erp-gastos-chips">
                    {extractChips.map(([k, v]) => (
                      <span key={k} className="erp-gastos-chip">
                        <strong>{k}</strong> {String(v)}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <label>
                Observaciones
                <textarea
                  className="erp-input erp-gastos-textarea"
                  rows={2}
                  value={form.observaciones}
                  onChange={(e) => patchForm({ observaciones: e.target.value })}
                  placeholder="Notas internas, dominio, viaje, referencia…"
                />
              </label>
            </fieldset>

            <div className="erp-gastos-form-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setForm(emptyForm())
                  setTicketPreview(null)
                  setTicketExtract(null)
                }}
              >
                Limpiar
              </button>
              <button type="button" className="btn-secondary" onClick={() => void reload()} disabled={loading}>
                Recargar
              </button>
              <button type="button" className="btn-primary" onClick={() => void handleGuardar()} disabled={saving || ticketUploading || ticketExtracting}>
                {saving ? 'Guardando…' : 'Guardar gasto'}
              </button>
            </div>
          </div>
        </div>

        <div className="erp-panel">
          <h2>Estadísticas</h2>
          <div className="erp-kpi" style={{ marginBottom: 12 }}>
            <div className="erp-kpi-item">
              <div className="erp-kpi-value">{money(kpis.total)}</div>
              <div className="erp-kpi-label">Total (filtro)</div>
            </div>
            <div className="erp-kpi-item">
              <div className="erp-kpi-value">{money(kpis.neto)}</div>
              <div className="erp-kpi-label">Neto</div>
            </div>
            <div className="erp-kpi-item">
              <div className="erp-kpi-value">{money(kpis.iva)}</div>
              <div className="erp-kpi-label">IVA</div>
            </div>
            <div className="erp-kpi-item">
              <div className="erp-kpi-value">{kpis.count}</div>
              <div className="erp-kpi-label">Gastos</div>
            </div>
            <div className="erp-kpi-item">
              <div className="erp-kpi-value">{kpis.tickets}</div>
              <div className="erp-kpi-label">Con ticket</div>
            </div>
            <div className="erp-kpi-item">
              <div className="erp-kpi-value">{kpis.enLibro}</div>
              <div className="erp-kpi-label">En libro IVA</div>
            </div>
            <div className="erp-kpi-item">
              <div className="erp-kpi-value">{kpis.proveedores}</div>
              <div className="erp-kpi-label">Proveedores</div>
            </div>
            <div className="erp-kpi-item">
              <div className="erp-kpi-value">{countHoy}</div>
              <div className="erp-kpi-label">Hoy</div>
            </div>
          </div>

          <div style={{ display: 'grid', gap: 14 }}>
            <div className="erp-chart-card">
              <h3 className="erp-chart-title">Por categoría (torta)</h3>
              <div className="erp-chart-wrap">
                {byCategoria.length === 0 ? (
                  <div className="erp-muted">Sin datos.</div>
                ) : (
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie data={byCategoria} dataKey="value" nameKey="name" innerRadius={58} outerRadius={92} paddingAngle={2}>
                        {byCategoria.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => [`$${Number(v || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`, 'Total']} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className="erp-chart-card">
              <h3 className="erp-chart-title">Gasto por mes (barra)</h3>
              <div className="erp-chart-wrap">
                {byMes.length === 0 ? (
                  <div className="erp-muted">—</div>
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={byMes} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="mes" />
                      <YAxis />
                      <Tooltip formatter={(v: number) => [`$${Number(v || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`, 'Total']} />
                      <Bar dataKey="total" fill="#4299e1" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="erp-panel">
        <div className="erp-panel__head">
          <h2>Listado</h2>
          <p className="erp-panel__hint">
            Primero las de hoy ({countHoy}). Buscá por proveedor, CUIT, comprobante o descripción.
          </p>
        </div>

        <div className="erp-toolbar erp-gastos-toolbar">
          <label className="erp-field erp-field--grow">
            <span className="erp-field__label">Buscar</span>
            <input
              className="erp-input"
              style={{ marginTop: 0 }}
              value={buscar}
              onChange={(e) => setBuscar(e.target.value)}
              placeholder="Proveedor, CUIT, ticket, n°…"
            />
          </label>
          <label className="erp-field">
            <span className="erp-field__label">Desde</span>
            <input type="date" className="erp-input" style={{ marginTop: 0 }} value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} />
          </label>
          <label className="erp-field">
            <span className="erp-field__label">Hasta</span>
            <input type="date" className="erp-input" style={{ marginTop: 0 }} value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} />
          </label>
          <label className="erp-field">
            <span className="erp-field__label">Categoría</span>
            <select className="erp-input" style={{ marginTop: 0 }} value={categoriaFiltro} onChange={(e) => setCategoriaFiltro(e.target.value)}>
              <option value="">Todas</option>
              {categorias.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="erp-field">
            <span className="erp-field__label">Pago</span>
            <select className="erp-input" style={{ marginTop: 0 }} value={metodoFiltro} onChange={(e) => setMetodoFiltro(e.target.value)}>
              <option value="">Todos</option>
              {METODOS_PAGO.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>
          <label className="erp-field">
            <span className="erp-field__label">IVA</span>
            <select
              className="erp-input"
              style={{ marginTop: 0 }}
              value={ivaFiltro}
              onChange={(e) => setIvaFiltro(e.target.value as IvaFiltro)}
            >
              <option value="">Todos</option>
              <option value="con">Con IVA</option>
              <option value="sin">Sin IVA</option>
              <option value="pendiente">Pendiente de libro</option>
            </select>
          </label>
          <button type="button" className={soloHoy ? 'btn-primary' : 'btn-secondary'} onClick={() => setSoloHoy((v) => !v)}>
            Hoy {countHoy}
          </button>
          {(buscar || fechaDesde || fechaHasta || categoriaFiltro || metodoFiltro || ivaFiltro || soloHoy) && (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setBuscar('')
                setFechaDesde('')
                setFechaHasta('')
                setCategoriaFiltro('')
                setMetodoFiltro('')
                setIvaFiltro('')
                setSoloHoy(false)
              }}
            >
              Limpiar filtros
            </button>
          )}
        </div>

        {loading ? (
          <p className="erp-muted">Cargando…</p>
        ) : filteredRows.length === 0 ? (
          <p className="erp-muted">Sin gastos con esos filtros.</p>
        ) : (
          <div className="erp-table-wrap">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Proveedor</th>
                  <th>Comprobante</th>
                  <th>Categoría</th>
                  <th>Descripción</th>
                  <th>Total</th>
                  <th>IVA</th>
                  <th>Libro</th>
                  <th>Ticket</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.slice(0, 160).map((r) => {
                  const esHoy = String(r.fecha_gasto).slice(0, 10) === hoy
                  const enLibro = !!r.id_factura_compra
                  const puedeIva = gastoPuedeIrALibroIva(r.iva)
                  return (
                    <tr key={r.id} className={esHoy ? 'erp-row-hoy' : undefined}>
                      <td>
                        {String(r.fecha_gasto).slice(0, 10)}
                        {esHoy ? <span className="erp-hoy-badge">Hoy</span> : null}
                      </td>
                      <td>
                        <div>{r.proveedor || '—'}</div>
                        {r.proveedor_cuit ? <div className="erp-cell-sub">{r.proveedor_cuit}</div> : null}
                      </td>
                      <td>{comprobanteLabel(r)}</td>
                      <td>{r.categoria || '—'}</td>
                      <td>{r.descripcion || '—'}</td>
                      <td>{money(r.total)}</td>
                      <td>{puedeIva ? money(r.iva) : '—'}</td>
                      <td>
                        {enLibro ? (
                          <button type="button" className="erp-linkish" onClick={() => navigate('/erp/impuestos?tab=compras')}>
                            #{r.id_factura_compra}
                          </button>
                        ) : puedeIva ? (
                          <button
                            type="button"
                            className="btn-secondary"
                            disabled={syncingIva === r.id}
                            onClick={() => void enviarAlLibro(r)}
                          >
                            {syncingIva === r.id ? 'Enviando…' : 'Enviar'}
                          </button>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>{r.ticket_url ? <a href={r.ticket_url} target="_blank" rel="noreferrer">Abrir</a> : '—'}</td>
                      <td>
                        <button
                          type="button"
                          className={trazadoId === r.id ? 'btn-primary' : 'btn-secondary'}
                          onClick={() => setTrazadoId(trazadoId === r.id ? null : r.id)}
                        >
                          Trazado
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {trazado && (
          <div className="erp-trazado">
            <div className="erp-trazado__head">
              <h3>Trazado · gasto #{trazado.id}</h3>
              <button type="button" className="btn-secondary" onClick={() => setTrazadoId(null)}>
                Cerrar
              </button>
            </div>
            <ol className="erp-trazado-steps">
              <li className="is-done">
                <strong>Carga</strong>
                <span>
                  {trazado.origen === 'ticket_ai' ? 'Ticket con IA' : 'Manual'} · {new Date(trazado.created_at).toLocaleString('es-AR')}
                </span>
              </li>
              <li className={trazado.ticket_url ? 'is-done' : ''}>
                <strong>Comprobante adjunto</strong>
                <span>
                  {trazado.ticket_url ? (
                    <a href={trazado.ticket_url} target="_blank" rel="noreferrer">
                      Ver ticket / factura
                    </a>
                  ) : (
                    'Sin archivo'
                  )}
                </span>
              </li>
              <li className="is-done">
                <strong>Datos</strong>
                <span>
                  {trazado.proveedor || 'Sin proveedor'}
                  {trazado.proveedor_cuit ? ` · CUIT ${trazado.proveedor_cuit}` : ''}
                  {` · ${comprobanteLabel(trazado)}`}
                  {trazado.cae ? ` · CAE ${trazado.cae}` : ''}
                  {trazado.metodo_pago ? ` · ${trazado.metodo_pago}` : ''}
                  {trazado.centro_costo ? ` · ${trazado.centro_costo}` : ''}
                </span>
              </li>
              <li className={gastoPuedeIrALibroIva(trazado.iva) ? 'is-done' : ''}>
                <strong>IVA extraído</strong>
                <span>
                  {gastoPuedeIrALibroIva(trazado.iva)
                    ? `${money(trazado.iva)} sobre neto ${money(trazado.neto)}${trazado.iva_porcentaje ? ` (${trazado.iva_porcentaje}%)` : ''}`
                    : 'Sin IVA discriminado'}
                </span>
              </li>
              <li className={trazado.id_factura_compra ? 'is-done' : gastoPuedeIrALibroIva(trazado.iva) ? 'is-pending' : ''}>
                <strong>Libro IVA compras</strong>
                <span>
                  {trazado.id_factura_compra ? (
                    <>
                      Factura #{trazado.id_factura_compra}{' '}
                      <button type="button" className="erp-linkish" onClick={() => navigate('/erp/impuestos?tab=compras')}>
                        Abrir libro
                      </button>
                    </>
                  ) : gastoPuedeIrALibroIva(trazado.iva) ? (
                    <>
                      Pendiente.{' '}
                      <button
                        type="button"
                        className="btn-primary"
                        disabled={syncingIva === trazado.id}
                        onClick={() => void enviarAlLibro(trazado)}
                      >
                        {syncingIva === trazado.id ? 'Enviando…' : 'Enviar ahora'}
                      </button>
                    </>
                  ) : (
                    'No aplica'
                  )}
                </span>
              </li>
            </ol>
            {trazado.observaciones ? <p className="erp-muted">Obs.: {trazado.observaciones}</p> : null}
          </div>
        )}
      </div>
    </div>
  )
}

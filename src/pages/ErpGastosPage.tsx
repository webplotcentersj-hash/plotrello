import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'
import { supabase } from '../services/supabaseClient'
import { uploadAttachmentAndGetUrl } from '../utils/storage'
import './ErpSectionPage.css'

type GastosFilter = 'todo' | 'corrientes' | 'tickets'

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
}

type TicketExtract = {
  fecha?: string | null
  proveedor?: string | null
  categoria?: string | null
  descripcion?: string | null
  total?: number | null
  iva?: number | null
  neto?: number | null
  moneda?: string | null
  metodo_pago?: string | null
  confidence?: number | null
  raw_text_hint?: string | null
}

const PIE_COLORS = ['#f97316', '#38bdf8', '#a78bfa', '#34d399', '#fbbf24', '#fb7185', '#94a3b8', '#e2e8f0']
const METODOS_PAGO = ['Efectivo', 'Tarjeta', 'Transferencia'] as const

function ymdToday() {
  return new Date().toISOString().slice(0, 10)
}

function safeNumber(v: unknown): number | null {
  const n = typeof v === 'number' ? v : Number(String(v ?? '').replace(',', '.'))
  if (!Number.isFinite(n)) return null
  return n
}

async function fileToDataUrl(file: File): Promise<string> {
  const buf = await file.arrayBuffer()
  const bytes = new Uint8Array(buf)
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return `data:${file.type};base64,${btoa(binary)}`
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

  const [fechaDesde, setFechaDesde] = useState(() => {
    const d = new Date()
    d.setMonth(d.getMonth() - 2)
    return d.toISOString().slice(0, 10)
  })
  const [fechaHasta, setFechaHasta] = useState(() => ymdToday())
  const [categoriaFiltro, setCategoriaFiltro] = useState('')

  const [form, setForm] = useState({
    fecha_gasto: ymdToday(),
    proveedor: '',
    categoria: '',
    descripcion: '',
    total: '',
    iva: '',
    neto: '',
    moneda: 'ARS',
    metodo_pago: 'Efectivo',
    ticket_url: ''
  })

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
    return 'Gastos corrientes + tickets · Control y estadísticas'
  }, [filter])

  const filteredRows = useMemo(() => {
    let list = rows
    if (fechaDesde) list = list.filter((r) => String(r.fecha_gasto).slice(0, 10) >= fechaDesde)
    if (fechaHasta) list = list.filter((r) => String(r.fecha_gasto).slice(0, 10) <= fechaHasta)
    if (categoriaFiltro) list = list.filter((r) => (r.categoria || '') === categoriaFiltro)
    if (filter === 'corrientes') list = list.filter((r) => !r.ticket_url)
    if (filter === 'tickets') list = list.filter((r) => !!r.ticket_url)
    return list
  }, [rows, filter, fechaDesde, fechaHasta, categoriaFiltro])

  const categorias = useMemo(() => catOptions, [catOptions])

  const kpis = useMemo(() => {
    const total = filteredRows.reduce((sum, r) => sum + (Number(r.total) || 0), 0)
    const count = filteredRows.length
    const tickets = filteredRows.filter((r) => !!r.ticket_url).length
    const proveedores = new Set(filteredRows.map((r) => (r.proveedor || '').trim()).filter(Boolean)).size
    return { total, count, tickets, proveedores }
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

  const handleTicketFile = async (file?: File) => {
    if (!file || !supabase) return
    setError(null)
    setTicketExtract(null)
    setTicketPreview(null)
    setTicketUploading(true)
    try {
      const preview = await fileToDataUrl(file)
      setTicketPreview(preview)

      // Subir archivo a Storage (bucket "archivos", carpeta "erp-gastos")
      const url = await uploadAttachmentAndGetUrl(file, 'erp-gastos')
      setForm((p) => ({ ...p, ticket_url: url }))

      // Extraer datos con IA (servidor)
      setTicketExtracting(true)
      const res = await fetch('/api/erp/extract-ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mimeType: file.type || 'image/jpeg',
          dataUrl: preview
        })
      })
      const j = (await res.json().catch(() => null)) as { success?: boolean; data?: TicketExtract; error?: string } | null
      if (!res.ok || !j?.data) throw new Error(j?.error || 'No se pudo extraer el ticket.')
      setTicketExtract(j.data)

      // Autocompletar
      setForm((p) => ({
        ...p,
        fecha_gasto: (j.data?.fecha || p.fecha_gasto || ymdToday()).slice(0, 10),
        proveedor: j.data?.proveedor ? String(j.data.proveedor) : p.proveedor,
        categoria: j.data?.categoria ? String(j.data.categoria) : p.categoria,
        descripcion: j.data?.descripcion ? String(j.data.descripcion) : p.descripcion,
        total: j.data?.total != null ? String(j.data.total) : p.total,
        iva: j.data?.iva != null ? String(j.data.iva) : p.iva,
        neto: j.data?.neto != null ? String(j.data.neto) : p.neto,
        moneda: j.data?.moneda ? String(j.data.moneda) : p.moneda,
        metodo_pago: j.data?.metodo_pago ? String(j.data.metodo_pago) : p.metodo_pago
      }))

      if (j.data?.categoria) {
        // Pre-cargar sugerencias para autocompletar.
        await loadCategorias()
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error con ticket.')
    } finally {
      setTicketExtracting(false)
      setTicketUploading(false)
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
        // Guardar categoría (si no existe) para autocomplete.
        await supabase.from('erp_gastos_categorias').insert({ nombre: categoriaClean }).select().maybeSingle()
      }
      const payload = {
        fecha_gasto: form.fecha_gasto,
        proveedor: form.proveedor.trim() || null,
        categoria: categoriaClean || null,
        descripcion: form.descripcion.trim() || null,
        total,
        iva: safeNumber(form.iva),
        neto: safeNumber(form.neto),
        moneda: form.moneda.trim() || 'ARS',
        metodo_pago: form.metodo_pago.trim() || null,
        ticket_url: form.ticket_url.trim() || null,
        ticket_raw: ticketExtract ? (ticketExtract as unknown as Record<string, unknown>) : null,
        origen: form.ticket_url ? 'ticket_ai' : 'manual'
      }
      const { error: err } = await supabase.from('erp_gastos').insert(payload)
      if (err) throw new Error(err.message)
      setForm({
        fecha_gasto: ymdToday(),
        proveedor: '',
        categoria: '',
        descripcion: '',
        total: '',
        iva: '',
        neto: '',
        moneda: 'ARS',
        metodo_pago: 'Efectivo',
        ticket_url: ''
      })
      setTicketPreview(null)
      setTicketExtract(null)
      await reload()
      await loadCategorias()
      alert('Gasto guardado.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error guardando gasto.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="erp-section">
      <div className="erp-section-header">
        <div>
          <h1>Gastos</h1>
          <p className="erp-section-sub">{subtitle}</p>
        </div>
        <div className="erp-section-actions">
          <button type="button" className="btn-secondary" onClick={() => navigate('/erp')}>
            ← Volver a ERP
          </button>
        </div>
      </div>

      <div className="erp-section-grid">
        <div className="erp-panel erp-gastos-form">
          <h2>Ingreso</h2>
          <p className="erp-muted">
            Cargá un gasto manual o subí un ticket y dejá que la IA te complete los datos. Después lo ajustás y guardás.
          </p>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              className={filter === 'todo' ? 'btn-primary' : 'btn-secondary'}
              onClick={() => setFilter('todo')}
            >
              Todo
            </button>
            <button
              type="button"
              className={filter === 'corrientes' ? 'btn-primary' : 'btn-secondary'}
              onClick={() => setFilter('corrientes')}
            >
              Gastos corrientes
            </button>
            <button
              type="button"
              className={filter === 'tickets' ? 'btn-primary' : 'btn-secondary'}
              onClick={() => setFilter('tickets')}
            >
              Tickets
            </button>
          </div>

          {error && (
            <p className="erp-muted" style={{ marginTop: 10, color: '#c53030' }}>
              {error}
            </p>
          )}
          {error && /relation .*erp_gastos.* does not exist|erp_gastos/i.test(error) && (
            <p className="erp-muted" style={{ marginTop: 8 }}>
              Parece que falta crear la tabla. Ejecutá el patch{' '}
              <code>supabase/patches/2026-04-28_erp_gastos.sql</code> en Supabase.
            </p>
          )}

          <div style={{ marginTop: 14, display: 'grid', gap: 10 }}>
            <label>
              Fecha
              <input
                type="date"
                className="erp-input"
                value={form.fecha_gasto}
                onChange={(e) => setForm((p) => ({ ...p, fecha_gasto: e.target.value }))}
              />
            </label>

            <label>
              Proveedor
              <input className="erp-input" value={form.proveedor} onChange={(e) => setForm((p) => ({ ...p, proveedor: e.target.value }))} />
            </label>

            <label>
              Categoría
              <input
                className="erp-input"
                list="erp-gastos-categorias"
                value={form.categoria}
                onChange={(e) => setForm((p) => ({ ...p, categoria: e.target.value }))}
                placeholder="Ej. Combustible, Limpieza, Insumos…"
              />
              <datalist id="erp-gastos-categorias">
                {categorias.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </label>

            <label>
              Descripción
              <input
                className="erp-input"
                value={form.descripcion}
                onChange={(e) => setForm((p) => ({ ...p, descripcion: e.target.value }))}
                placeholder="Ej. Combustible, insumos, repuesto, limpieza…"
              />
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
              <label>
                Total
                <input className="erp-input" value={form.total} onChange={(e) => setForm((p) => ({ ...p, total: e.target.value }))} />
              </label>
              <label>
                IVA
                <input className="erp-input" value={form.iva} onChange={(e) => setForm((p) => ({ ...p, iva: e.target.value }))} />
              </label>
              <label>
                Neto
                <input className="erp-input" value={form.neto} onChange={(e) => setForm((p) => ({ ...p, neto: e.target.value }))} />
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
              <label>
                Moneda
                <input className="erp-input" value={form.moneda} onChange={(e) => setForm((p) => ({ ...p, moneda: e.target.value }))} />
              </label>
              <label>
                Método de pago
                <select
                  className="erp-input"
                  value={form.metodo_pago}
                  onChange={(e) => setForm((p) => ({ ...p, metodo_pago: e.target.value }))}
                >
                  {METODOS_PAGO.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="erp-ticket-row">
              <label className="erp-ticket-upload">
                Ticket (foto/PDF)
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
                {ticketUploading ? 'Subiendo…' : ticketExtracting ? 'Extrayendo datos…' : form.ticket_url ? 'Ticket cargado.' : 'Opcional.'}
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

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10, marginBottom: 12 }}>
            <label>
              Desde
              <input type="date" className="erp-input" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} />
            </label>
            <label>
              Hasta
              <input type="date" className="erp-input" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} />
            </label>
            <label>
              Categoría
              <select className="erp-input" value={categoriaFiltro} onChange={(e) => setCategoriaFiltro(e.target.value)}>
                <option value="">Todas</option>
                {categorias.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="erp-kpi" style={{ marginBottom: 12 }}>
            <div className="erp-kpi-item">
              <div className="erp-kpi-value">${kpis.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div>
              <div className="erp-kpi-label">Total (filtro)</div>
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
              <div className="erp-kpi-value">{kpis.proveedores}</div>
              <div className="erp-kpi-label">Proveedores</div>
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
        <h2>Listado</h2>
        {loading ? (
          <p className="erp-muted">Cargando…</p>
        ) : filteredRows.length === 0 ? (
          <p className="erp-muted">Sin gastos cargados.</p>
        ) : (
          <div className="erp-table-wrap">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Proveedor</th>
                  <th>Categoría</th>
                  <th>Descripción</th>
                  <th>Total</th>
                  <th>Ticket</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.slice(0, 120).map((r) => (
                  <tr key={r.id}>
                    <td>{String(r.fecha_gasto).slice(0, 10)}</td>
                    <td>{r.proveedor || '—'}</td>
                    <td>{r.categoria || '—'}</td>
                    <td>{r.descripcion || '—'}</td>
                    <td>${Number(r.total || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                    <td>{r.ticket_url ? <a href={r.ticket_url} target="_blank" rel="noreferrer">Abrir</a> : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}


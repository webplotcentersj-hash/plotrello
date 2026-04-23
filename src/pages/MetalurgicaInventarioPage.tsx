import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis } from 'recharts'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../services/supabaseClient'
import './MetalurgicaInventarioPage.css'

export type MetalInvItem = {
  id: number
  cantidad: number
  herramienta: string
  tipo_marca: string | null
  descripcion: string | null
  foto_url: string | null
  slot_pañol: string | null
  umbral_minimo: number
  created_at: string
  updated_at: string
}

export type MetalInvMovimiento = {
  id: number
  herramienta_id: number | null
  herramienta_nombre: string
  cantidad_anterior: number | null
  cantidad_nueva: number | null
  usuario_nombre: string | null
  detalle: string | null
  created_at: string
}

const SLOT_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'] as const
const SLOT_NUMS = [1, 2, 3, 4] as const
const ALL_SLOTS: string[] = SLOT_LETTERS.flatMap((l) => SLOT_NUMS.map((n) => `${l}${n}`))

const PIE_COLORS = ['#f97316', '#38bdf8', '#a78bfa', '#34d399', '#fbbf24', '#fb7185', '#94a3b8', '#e2e8f0']

function normalizarSlot(raw: string | null | undefined): string | null {
  if (!raw || !String(raw).trim()) return null
  const s = String(raw).trim().toUpperCase().replace(/\s+/g, '')
  if (ALL_SLOTS.includes(s)) return s
  return s
}

export default function MetalurgicaInventarioPage() {
  const navigate = useNavigate()
  const { usuario, isAdmin, isMetalurgica } = useAuth()
  /** Administración, gerencia (incluida en isAdmin) y metalúrgica. */
  const canAccess = isAdmin || isMetalurgica

  const [items, setItems] = useState<MetalInvItem[]>([])
  const [movimientos, setMovimientos] = useState<MetalInvMovimiento[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<number | null>(null)
  const [creating, setCreating] = useState(false)
  const [search, setSearch] = useState('')
  const [toast, setToast] = useState<string | null>(null)
  const [browserNotify, setBrowserNotify] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)

  const [newItem, setNewItem] = useState({
    herramienta: '',
    tipo_marca: '',
    descripcion: '',
    cantidad: '1',
    foto_url: '',
    slot_pañol: '',
    umbral_minimo: '2'
  })

  const logMovimiento = useCallback(
    async (payload: {
      herramienta_id: number | null
      herramienta_nombre: string
      cantidad_anterior: number | null
      cantidad_nueva: number | null
      detalle: string
    }) => {
      if (!supabase) return
      await supabase.from('metalurgica_inventario_movimientos').insert({
        herramienta_id: payload.herramienta_id,
        herramienta_nombre: payload.herramienta_nombre,
        cantidad_anterior: payload.cantidad_anterior,
        cantidad_nueva: payload.cantidad_nueva,
        usuario_nombre: usuario?.nombre ?? null,
        detalle: payload.detalle
      })
    },
    [usuario?.nombre]
  )

  const reload = useCallback(async () => {
    if (!supabase || !canAccess) return
    setError(null)
    try {
      const [rItems, rMov] = await Promise.all([
        supabase
          .from('metalurgica_inventario_herramientas')
          .select('*')
          .order('herramienta', { ascending: true }),
        supabase
          .from('metalurgica_inventario_movimientos')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(80)
      ])
      if (rItems.error) setError(rItems.error.message)
      else setItems((rItems.data as MetalInvItem[]) || [])
      if (rMov.error && !rItems.error) setError(rMov.error.message)
      else if (!rMov.error) setMovimientos((rMov.data as MetalInvMovimiento[]) || [])
    } catch {
      setError('No se pudo cargar el inventario.')
    }
  }, [canAccess])

  useEffect(() => {
    if (!canAccess) {
      setLoading(false)
      return
    }
    if (!supabase) {
      setError('Supabase no está configurado')
      setLoading(false)
      return
    }
    let cancelled = false
    ;(async () => {
      setLoading(true)
      await reload()
      if (!cancelled) setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [canAccess, reload])

  const filtered = useMemo(() => {
    if (!search.trim()) return items
    const q = search.toLowerCase()
    return items.filter(
      (it) =>
        it.herramienta.toLowerCase().includes(q) ||
        (it.tipo_marca || '').toLowerCase().includes(q) ||
        (it.descripcion || '').toLowerCase().includes(q) ||
        (it.slot_pañol || '').toLowerCase().includes(q)
    )
  }, [items, search])

  const slotMap = useMemo(() => {
    const m = new Map<string, MetalInvItem>()
    for (const it of items) {
      const sl = normalizarSlot(it.slot_pañol)
      if (sl && ALL_SLOTS.includes(sl)) m.set(sl, it)
    }
    return m
  }, [items])

  const alertas = useMemo(
    () => items.filter((it) => it.cantidad <= it.umbral_minimo),
    [items]
  )

  useEffect(() => {
    if (!browserNotify || alertas.length === 0) return
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
    const key = alertas.map((a) => `${a.id}:${a.cantidad}`).join('|')
    const last = sessionStorage.getItem('metal-inv-notify-key')
    if (last === key) return
    sessionStorage.setItem('metal-inv-notify-key', key)
    try {
      new Notification('Metalúrgica · Pañol', {
        body: `${alertas.length} herramienta(s) con stock bajo o en mínimo. Revisá el inventario.`,
        tag: 'metal-inv-stock'
      })
    } catch {
      /* noop */
    }
  }, [alertas, browserNotify])

  const pieByMarca = useMemo(() => {
    const acc = new Map<string, number>()
    for (const it of items) {
      const k = (it.tipo_marca || 'Sin tipo/marca').trim() || 'Sin tipo/marca'
      acc.set(k, (acc.get(k) ?? 0) + it.cantidad)
    }
    return Array.from(acc.entries()).map(([name, value]) => ({ name, value }))
  }, [items])

  const pieStock = useMemo(() => {
    let bajo = 0
    let ok = 0
    for (const it of items) {
      if (it.cantidad <= it.umbral_minimo) bajo += 1
      else ok += 1
    }
    return [
      { name: 'Stock bajo', value: bajo },
      { name: 'En orden', value: ok }
    ].filter((x) => x.value > 0)
  }, [items])

  const barTop = useMemo(() => {
    return [...items]
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 8)
      .map((it) => ({
        nombre: it.herramienta.length > 18 ? `${it.herramienta.slice(0, 16)}…` : it.herramienta,
        cantidad: it.cantidad
      }))
  }, [items])

  const activarNotificacionesNavegador = async () => {
    if (typeof Notification === 'undefined') {
      setToast('Este navegador no soporta notificaciones.')
      return
    }
    const p = await Notification.requestPermission()
    if (p === 'granted') {
      setBrowserNotify(true)
      setToast('Notificaciones del navegador activadas.')
    } else {
      setToast('Permisos de notificación denegados.')
    }
  }

  if (!canAccess) {
    return (
      <div className="met-inv met-inv--denied">
        <div className="met-inv-card met-inv-card--denied">
          <h1>Sin acceso</h1>
          <p>Solo Administración / Gerencia o Metalúrgica pueden ver el inventario del pañol.</p>
          <button type="button" className="met-inv-btn met-inv-btn--primary" onClick={() => navigate('/')}>
            Volver al tablero
          </button>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="met-inv">
        <div className="met-inv-loading">
          <div className="met-inv-spinner" />
          <p>Cargando pañol de metalúrgica…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="met-inv">
      <div className="met-inv-bg" aria-hidden />

      <header className="met-inv-header">
        <div className="met-inv-header-text">
          <p className="met-inv-kicker">Plot Lab · Metalúrgica</p>
          <h1>Inventario del pañol</h1>
          <p className="met-inv-sub">
            Herramientas con cantidad, tipo/marca, descripción, foto y ubicación. Historial y alertas de stock.
          </p>
        </div>
        <div className="met-inv-header-actions">
          {alertas.length > 0 && (
            <div className="met-inv-alert-pill" title="Stock bajo">
              <span className="met-inv-alert-dot" />
              {alertas.length} alerta{alertas.length === 1 ? '' : 's'}
            </div>
          )}
          <button type="button" className="met-inv-btn met-inv-btn--ghost" onClick={activarNotificacionesNavegador}>
            Campana del navegador
          </button>
          <button type="button" className="met-inv-btn met-inv-btn--ghost" onClick={() => void reload()}>
            Actualizar
          </button>
          <button type="button" className="met-inv-btn met-inv-btn--primary" onClick={() => navigate('/')}>
            ← Tablero
          </button>
        </div>
      </header>

      {toast && (
        <div className="met-inv-toast" role="status">
          {toast}
          <button type="button" onClick={() => setToast(null)} className="met-inv-toast-close">
            ×
          </button>
        </div>
      )}

      {error && (
        <div className="met-inv-banner met-inv-banner--error">
          <strong>Error</strong>
          <span>{error}</span>
          <span className="met-inv-banner-hint">
            Si la tabla no existe, ejecutá el parche SQL{' '}
            <code>supabase/patches/2026-04-23_metalurgica_inventario_herramientas.sql</code> en Supabase.
          </span>
        </div>
      )}

      <section className="met-inv-hero-grid">
        <div className="met-inv-panel met-inv-panel--charts">
          <h2 className="met-inv-h2">Cantidades por tipo / marca</h2>
          <div className="met-inv-chart-wrap">
            {pieByMarca.length === 0 ? (
              <p className="met-inv-muted">Sin datos todavía.</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={pieByMarca} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={52} outerRadius={80} paddingAngle={2}>
                    {pieByMarca.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => [`${v} u.`, 'Cantidad']} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          <h2 className="met-inv-h2 met-inv-h2--spaced">Estado del stock</h2>
          <div className="met-inv-chart-wrap met-inv-chart-wrap--small">
            {pieStock.length === 0 ? (
              <p className="met-inv-muted">Sin ítems cargados.</p>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={pieStock} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={68} paddingAngle={2}>
                    <Cell fill="#f97316" />
                    <Cell fill="#22c55e" />
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="met-inv-panel met-inv-panel--bar">
          <h2 className="met-inv-h2">Top cantidades</h2>
          {barTop.length === 0 ? (
            <p className="met-inv-muted">Agregá herramientas para ver el ranking.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={barTop} layout="vertical" margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
                <XAxis type="number" allowDecimals={false} stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <YAxis type="category" dataKey="nombre" width={100} stroke="#94a3b8" tick={{ fill: '#cbd5e1', fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="cantidad" fill="#f97316" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      <section className="met-inv-panel met-inv-panel--pañol">
        <div className="met-inv-pañol-head">
          <h2 className="met-inv-h2">Pañol · vista cajones</h2>
          <p className="met-inv-muted">
            Cada celda es un lugar del pañol (A1–F4). Asigná el slot en la tabla de abajo. Clic en una celda para filtrar.
          </p>
        </div>
        <div className="met-inv-pañol-grid" role="grid" aria-label="Pañol de herramientas">
          {ALL_SLOTS.map((slot) => {
            const it = slotMap.get(slot)
            const selected = selectedSlot === slot
            return (
              <button
                key={slot}
                type="button"
                className={`met-inv-slot ${it ? 'met-inv-slot--ocupado' : ''} ${selected ? 'met-inv-slot--selected' : ''}`}
                onClick={() => setSelectedSlot((s) => (s === slot ? null : slot))}
              >
                <span className="met-inv-slot-label">{slot}</span>
                {it ? (
                  <>
                    <div className="met-inv-slot-img-wrap">
                      {it.foto_url ? (
                        <img src={it.foto_url} alt="" className="met-inv-slot-img" onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')} />
                      ) : (
                        <span className="met-inv-slot-ph">🔧</span>
                      )}
                    </div>
                    <span className="met-inv-slot-name">{it.herramienta}</span>
                    <span className="met-inv-slot-qty">{it.cantidad} u.</span>
                  </>
                ) : (
                  <span className="met-inv-slot-free">Libre</span>
                )}
              </button>
            )
          })}
        </div>
      </section>

      <section className="met-inv-split">
        <div className="met-inv-panel">
          <h2 className="met-inv-h2">Nueva herramienta</h2>
          <div className="met-inv-form">
            <label>
              Herramienta *
              <input
                className="met-inv-input"
                value={newItem.herramienta}
                onChange={(e) => setNewItem((p) => ({ ...p, herramienta: e.target.value }))}
                placeholder="Ej. Llave tubo 24mm"
              />
            </label>
            <label>
              Tipo / marca
              <input
                className="met-inv-input"
                value={newItem.tipo_marca}
                onChange={(e) => setNewItem((p) => ({ ...p, tipo_marca: e.target.value }))}
                placeholder="Ej. Gedore · Cromo"
              />
            </label>
            <label className="met-inv-form-wide">
              Descripción
              <input
                className="met-inv-input"
                value={newItem.descripcion}
                onChange={(e) => setNewItem((p) => ({ ...p, descripcion: e.target.value }))}
              />
            </label>
            <label>
              Cantidad
              <input
                type="number"
                min={0}
                className="met-inv-input"
                value={newItem.cantidad}
                onChange={(e) => setNewItem((p) => ({ ...p, cantidad: e.target.value }))}
              />
            </label>
            <label>
              Umbral mínimo (alerta)
              <input
                type="number"
                min={0}
                className="met-inv-input"
                value={newItem.umbral_minimo}
                onChange={(e) => setNewItem((p) => ({ ...p, umbral_minimo: e.target.value }))}
              />
            </label>
            <label>
              Slot pañol
              <select
                className="met-inv-input"
                value={newItem.slot_pañol}
                onChange={(e) => setNewItem((p) => ({ ...p, slot_pañol: e.target.value }))}
              >
                <option value="">— Sin asignar —</option>
                {ALL_SLOTS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="met-inv-form-wide">
              URL de foto
              <input
                className="met-inv-input"
                value={newItem.foto_url}
                onChange={(e) => setNewItem((p) => ({ ...p, foto_url: e.target.value }))}
                placeholder="https://…"
              />
            </label>
            <div className="met-inv-form-actions met-inv-form-wide">
              <button
                type="button"
                className="met-inv-btn met-inv-btn--primary"
                disabled={creating || !newItem.herramienta.trim() || !supabase}
                onClick={async () => {
                  if (!supabase) return
                  setCreating(true)
                  setError(null)
                  try {
                    const cant = Math.max(0, parseInt(newItem.cantidad, 10) || 0)
                    const umb = Math.max(0, parseInt(newItem.umbral_minimo, 10) || 0)
                    const slot = normalizarSlot(newItem.slot_pañol || null)
                    const payload = {
                      herramienta: newItem.herramienta.trim(),
                      tipo_marca: newItem.tipo_marca.trim() || null,
                      descripcion: newItem.descripcion.trim() || null,
                      cantidad: cant,
                      foto_url: newItem.foto_url.trim() || null,
                      slot_pañol: slot,
                      umbral_minimo: umb
                    }
                    const { data, error: err } = await supabase
                      .from('metalurgica_inventario_herramientas')
                      .insert(payload)
                      .select()
                      .single()
                    if (err) {
                      setError(err.message)
                    } else if (data) {
                      const row = data as MetalInvItem
                      await logMovimiento({
                        herramienta_id: row.id,
                        herramienta_nombre: row.herramienta,
                        cantidad_anterior: null,
                        cantidad_nueva: row.cantidad,
                        detalle: 'Alta de herramienta'
                      })
                      await reload()
                      setNewItem({
                        herramienta: '',
                        tipo_marca: '',
                        descripcion: '',
                        cantidad: '1',
                        foto_url: '',
                        slot_pañol: '',
                        umbral_minimo: '2'
                      })
                      setToast('Herramienta agregada.')
                    }
                  } finally {
                    setCreating(false)
                  }
                }}
              >
                {creating ? 'Guardando…' : 'Agregar al pañol'}
              </button>
            </div>
          </div>
        </div>

        <div className="met-inv-panel met-inv-panel--timeline">
          <h2 className="met-inv-h2">Historial y fechas</h2>
          <p className="met-inv-muted">Últimos movimientos (altas y cambios de cantidad).</p>
          <ul className="met-inv-timeline">
            {movimientos.length === 0 ? (
              <li className="met-inv-muted">Sin movimientos registrados.</li>
            ) : (
              movimientos.map((m) => (
                <li key={m.id} className="met-inv-tl-item">
                  <div className="met-inv-tl-dot" />
                  <div className="met-inv-tl-body">
                    <div className="met-inv-tl-title">{m.herramienta_nombre}</div>
                    <div className="met-inv-tl-meta">
                      {new Date(m.created_at).toLocaleString('es-AR')}
                      {m.usuario_nombre ? ` · ${m.usuario_nombre}` : ''}
                    </div>
                    <div className="met-inv-tl-detail">
                      {m.detalle}
                      {m.cantidad_anterior != null && m.cantidad_nueva != null
                        ? ` · ${m.cantidad_anterior} → ${m.cantidad_nueva} u.`
                        : m.cantidad_nueva != null
                          ? ` · ${m.cantidad_nueva} u.`
                          : ''}
                    </div>
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>
      </section>

      <section className="met-inv-panel">
        <div className="met-inv-table-head">
          <h2 className="met-inv-h2">Listado</h2>
          <input
            className="met-inv-input met-inv-search"
            placeholder="Buscar herramienta, marca, descripción, slot…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="met-inv-table-wrap">
          <table className="met-inv-table">
            <thead>
              <tr>
                <th>Foto</th>
                <th>Herramienta</th>
                <th>Tipo / marca</th>
                <th>Descripción</th>
                <th>Cantidad</th>
                <th>Umbral</th>
                <th>Slot</th>
                <th>Actualizado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered
                .filter((it) => !selectedSlot || normalizarSlot(it.slot_pañol) === selectedSlot)
                .map((it) => {
                  const bajo = it.cantidad <= it.umbral_minimo
                  return (
                    <tr key={it.id} className={bajo ? 'met-inv-tr--warn' : undefined}>
                      <td className="met-inv-td-photo">
                        {it.foto_url ? (
                          <img src={it.foto_url} alt="" className="met-inv-thumb" onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')} />
                        ) : (
                          <span className="met-inv-thumb-ph">🔧</span>
                        )}
                      </td>
                      <td>
                        <input
                          className="met-inv-input met-inv-input--table"
                          value={it.herramienta}
                          onChange={(e) =>
                            setItems((prev) => prev.map((x) => (x.id === it.id ? { ...x, herramienta: e.target.value } : x)))
                          }
                        />
                      </td>
                      <td>
                        <input
                          className="met-inv-input met-inv-input--table"
                          value={it.tipo_marca ?? ''}
                          onChange={(e) =>
                            setItems((prev) => prev.map((x) => (x.id === it.id ? { ...x, tipo_marca: e.target.value || null } : x)))
                          }
                        />
                      </td>
                      <td>
                        <input
                          className="met-inv-input met-inv-input--table"
                          value={it.descripcion ?? ''}
                          onChange={(e) =>
                            setItems((prev) => prev.map((x) => (x.id === it.id ? { ...x, descripcion: e.target.value || null } : x)))
                          }
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min={0}
                          className="met-inv-input met-inv-input--table met-inv-input--num"
                          value={it.cantidad}
                          onChange={(e) =>
                            setItems((prev) =>
                              prev.map((x) =>
                                x.id === it.id ? { ...x, cantidad: Math.max(0, parseInt(e.target.value, 10) || 0) } : x
                              )
                            )
                          }
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min={0}
                          className="met-inv-input met-inv-input--table met-inv-input--num"
                          value={it.umbral_minimo}
                          onChange={(e) =>
                            setItems((prev) =>
                              prev.map((x) =>
                                x.id === it.id ? { ...x, umbral_minimo: Math.max(0, parseInt(e.target.value, 10) || 0) } : x
                              )
                            )
                          }
                        />
                      </td>
                      <td>
                        <select
                          className="met-inv-input met-inv-input--table"
                          value={it.slot_pañol ?? ''}
                          onChange={(e) =>
                            setItems((prev) =>
                              prev.map((x) =>
                                x.id === it.id ? { ...x, slot_pañol: e.target.value ? normalizarSlot(e.target.value) : null } : x
                              )
                            )
                          }
                        >
                          <option value="">—</option>
                          {ALL_SLOTS.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="met-inv-td-date">{new Date(it.updated_at).toLocaleString('es-AR')}</td>
                      <td className="met-inv-td-actions">
                        <button
                          type="button"
                          className="met-inv-btn met-inv-btn--sm met-inv-btn--primary"
                          disabled={savingId === it.id || !supabase}
                          onClick={async () => {
                            if (!supabase) return
                            const prev = items.find((x) => x.id === it.id)
                            if (!prev) return
                            setSavingId(it.id)
                            setError(null)
                            try {
                              const { error: err } = await supabase
                                .from('metalurgica_inventario_herramientas')
                                .update({
                                  herramienta: it.herramienta,
                                  tipo_marca: it.tipo_marca,
                                  descripcion: it.descripcion,
                                  cantidad: it.cantidad,
                                  foto_url: it.foto_url,
                                  slot_pañol: it.slot_pañol,
                                  umbral_minimo: it.umbral_minimo
                                })
                                .eq('id', it.id)
                              if (err) setError(err.message)
                              else {
                                const nowIso = new Date().toISOString()
                                setItems((p) =>
                                  p.map((x) => (x.id === it.id ? { ...x, updated_at: nowIso } : x))
                                )
                                if (prev.cantidad !== it.cantidad) {
                                  await logMovimiento({
                                    herramienta_id: it.id,
                                    herramienta_nombre: it.herramienta,
                                    cantidad_anterior: prev.cantidad,
                                    cantidad_nueva: it.cantidad,
                                    detalle: 'Ajuste de cantidad'
                                  })
                                } else {
                                  await logMovimiento({
                                    herramienta_id: it.id,
                                    herramienta_nombre: it.herramienta,
                                    cantidad_anterior: prev.cantidad,
                                    cantidad_nueva: it.cantidad,
                                    detalle: 'Edición de datos'
                                  })
                                }
                                await reload()
                                setToast('Cambios guardados.')
                              }
                            } finally {
                              setSavingId(null)
                            }
                          }}
                        >
                          {savingId === it.id ? '…' : 'Guardar'}
                        </button>
                        <input
                          className="met-inv-input met-inv-input--table met-inv-input--url"
                          placeholder="URL foto"
                          value={it.foto_url ?? ''}
                          onChange={(e) =>
                            setItems((prev) => prev.map((x) => (x.id === it.id ? { ...x, foto_url: e.target.value || null } : x)))
                          }
                        />
                      </td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </div>
        {selectedSlot && (
          <p className="met-inv-filter-hint">
            Filtrando slot <strong>{selectedSlot}</strong> ·{' '}
            <button type="button" className="met-inv-link" onClick={() => setSelectedSlot(null)}>
              Quitar filtro
            </button>
          </p>
        )}
      </section>
    </div>
  )
}

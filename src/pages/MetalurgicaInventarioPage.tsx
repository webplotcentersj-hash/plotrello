import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis } from 'recharts'
import QRCode from 'qrcode'
import { useAuth } from '../hooks/useAuth'
import apiService from '../services/api'
import { supabase } from '../services/supabaseClient'
import { uploadAttachmentAndGetUrl } from '../utils/storage'
import {
  METAL_INV_ESTADOS,
  type MetalInvEstado,
  type MetalInvItemRow,
  type MetalInvMovRow,
  compressMetalInvImage,
  exportMetalInvCsv,
  exportMetalInvPdf,
  exportMetalInvXlsx,
  normalizeMetalInvRow,
  parseFotosUrls,
  primaryPhoto,
  qrPayloadForTool,
  slugEstado,
  syncFotoFieldsFromUrls
} from '../utils/metalurgicaInventario'
import './MetalurgicaInventarioPage.css'

const SLOT_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'] as const
const SLOT_NUMS = [1, 2, 3, 4] as const
const ALL_SLOTS: string[] = SLOT_LETTERS.flatMap((l) => SLOT_NUMS.map((n) => `${l}${n}`))

const PIE_COLORS = ['#f97316', '#38bdf8', '#a78bfa', '#34d399', '#fbbf24', '#fb7185', '#94a3b8', '#e2e8f0']

const MAX_PHOTO_BYTES = 6 * 1024 * 1024
const MAX_FOTOS_PER_ITEM = 8

function validateMetalInvImageFile(file: File): string | null {
  if (!file.type.startsWith('image/')) return 'Elegí un archivo de imagen (JPG, PNG, WebP, etc.).'
  if (file.size > MAX_PHOTO_BYTES) return 'La imagen supera 6 MB (antes de comprimir).'
  return null
}

function normalizarSlot(raw: string | null | undefined): string | null {
  if (!raw || !String(raw).trim()) return null
  const s = String(raw).trim().toUpperCase().replace(/\s+/g, '')
  if (ALL_SLOTS.includes(s)) return s
  return s
}

function MetalInvQrThumb({ payload }: { payload: string }) {
  const [src, setSrc] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    QRCode.toDataURL(payload, { width: 56, margin: 1, errorCorrectionLevel: 'M' })
      .then((u) => {
        if (!cancelled) setSrc(u)
      })
      .catch(() => {
        if (!cancelled) setSrc(null)
      })
    return () => {
      cancelled = true
    }
  }, [payload])
  if (!src) return <span className="met-inv-qr-ph">…</span>
  return <img src={src} alt="" className="met-inv-qr" title={payload} />
}

type Item = MetalInvItemRow

export default function MetalurgicaInventarioPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const readonly =
    searchParams.get('readonly') === '1' ||
    searchParams.get('sololectura') === '1' ||
    searchParams.get('lectura') === '1'

  const { usuario, isAdmin, isMetalurgica } = useAuth()
  const canAccess = isAdmin || isMetalurgica

  const [items, setItems] = useState<Item[]>([])
  const [movimientos, setMovimientos] = useState<MetalInvMovRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<number | null>(null)
  const [creating, setCreating] = useState(false)
  const [search, setSearch] = useState('')
  const [filterEstado, setFilterEstado] = useState<'' | MetalInvEstado>('')
  const [soloBajoStock, setSoloBajoStock] = useState(false)
  const [soloConFoto, setSoloConFoto] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [browserNotify, setBrowserNotify] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)
  const [lightbox, setLightbox] = useState<{ url: string; title: string; gallery?: string[] } | null>(null)
  const [uploadingPhoto, setUploadingPhoto] = useState<'new' | number | null>(null)

  const [newItem, setNewItem] = useState({
    herramienta: '',
    codigo_interno: '',
    tipo_marca: '',
    descripcion: '',
    cantidad: '1',
    slot_pañol: '',
    umbral_minimo: '2',
    estado: 'ok' as MetalInvEstado,
    proveedor: '',
    fecha_compra: '',
    prestado_a: '',
    fecha_prestamo: '',
    observaciones: ''
  })
  const [newFotosUrls, setNewFotosUrls] = useState<string[]>([])

  const logMovimiento = useCallback(
    async (payload: {
      herramienta_id: number | null
      herramienta_nombre: string
      cantidad_anterior: number | null
      cantidad_nueva: number | null
      detalle: string
      metadata?: Record<string, unknown>
    }) => {
      if (!supabase) return
      await supabase.from('metalurgica_inventario_movimientos').insert({
        herramienta_id: payload.herramienta_id,
        herramienta_nombre: payload.herramienta_nombre,
        cantidad_anterior: payload.cantidad_anterior,
        cantidad_nueva: payload.cantidad_nueva,
        usuario_nombre: usuario?.nombre ?? null,
        detalle: payload.detalle,
        metadata: payload.metadata ?? {}
      })
    },
    [usuario?.nombre]
  )

  const reload = useCallback(async () => {
    if (!supabase || !canAccess) return
    setError(null)
    try {
      const [rItems, rMov] = await Promise.all([
        supabase.from('metalurgica_inventario_herramientas').select('*').order('herramienta', { ascending: true }),
        supabase.from('metalurgica_inventario_movimientos').select('*').order('created_at', { ascending: false }).limit(120)
      ])
      if (rItems.error) setError(rItems.error.message)
      else {
        const rows = ((rItems.data as Record<string, unknown>[]) || []).map((r) => normalizeMetalInvRow(r))
        setItems(rows)
      }
      if (rMov.error && !rItems.error) setError(rMov.error.message)
      else if (!rMov.error) setMovimientos((rMov.data as MetalInvMovRow[]) || [])
    } catch {
      setError('No se pudo cargar el inventario.')
    }
  }, [canAccess])

  useEffect(() => {
    if (!supabase || !canAccess) return
    const client = supabase
    const ch = client
      .channel('metal-inv-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'metalurgica_inventario_herramientas' },
        () => void reload()
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'metalurgica_inventario_movimientos' },
        () => void reload()
      )
      .subscribe()
    return () => {
      void client.removeChannel(ch)
    }
  }, [supabase, canAccess, reload])

  const rowPayloadForDb = useCallback((it: Item) => {
    const urls = parseFotosUrls(it)
    const synced = syncFotoFieldsFromUrls(urls)
    return {
      herramienta: it.herramienta,
      tipo_marca: it.tipo_marca,
      descripcion: it.descripcion,
      cantidad: it.cantidad,
      foto_url: synced.foto_url,
      fotos_urls: synced.fotos_urls,
      slot_pañol: it.slot_pañol,
      umbral_minimo: it.umbral_minimo,
      codigo_interno: it.codigo_interno?.trim() || null,
      estado: (it.estado as MetalInvEstado) || 'ok',
      prestado_a: it.prestado_a?.trim() || null,
      fecha_prestamo: it.fecha_prestamo || null,
      proveedor: it.proveedor?.trim() || null,
      fecha_compra: it.fecha_compra || null,
      observaciones: it.observaciones?.trim() || null
    }
  }, [])

  const handlePhotoFile = useCallback(
    async (
      file: File | undefined,
      ctx:
        | { kind: 'new'; mode: 'append' | 'replace' }
        | { kind: 'row'; id: number; herramientaNombre: string; mode: 'append' | 'replace' }
    ) => {
      if (!file || !supabase) return
      const bad = validateMetalInvImageFile(file)
      if (bad) {
        setToast(bad)
        return
      }
      setError(null)
      const compressed = await compressMetalInvImage(file)
      const bad2 = validateMetalInvImageFile(compressed)
      if (bad2) {
        setToast(bad2)
        return
      }

      setUploadingPhoto(ctx.kind === 'new' ? 'new' : ctx.id)
      try {
        const url = await uploadAttachmentAndGetUrl(compressed, 'metalurgica-inventario')
        if (ctx.kind === 'new') {
          setNewFotosUrls((prev) => {
            if (ctx.mode === 'replace') return [url]
            if (prev.length >= MAX_FOTOS_PER_ITEM) return prev
            return [...prev, url]
          })
          setToast('Foto agregada al borrador.')
        } else {
          const prevItem = items.find((x) => x.id === ctx.id)
          if (!prevItem) return
          const prevUrls = parseFotosUrls(prevItem)
          let nextUrls: string[]
          if (ctx.mode === 'replace') nextUrls = [url]
          else nextUrls = prevUrls.length >= MAX_FOTOS_PER_ITEM ? prevUrls : [...prevUrls, url]

          const synced = syncFotoFieldsFromUrls(nextUrls)
          setItems((p) =>
            p.map((x) =>
              x.id === ctx.id ? { ...x, foto_url: synced.foto_url, fotos_urls: synced.fotos_urls as unknown as Item['fotos_urls'] } : x
            )
          )

          const { error: err } = await supabase
            .from('metalurgica_inventario_herramientas')
            .update({
              foto_url: synced.foto_url,
              fotos_urls: synced.fotos_urls
            })
            .eq('id', ctx.id)

          if (err) {
            setError(err.message)
            if (prevItem) setItems((p) => p.map((x) => (x.id === ctx.id ? prevItem : x)))
            return
          }

          await logMovimiento({
            herramienta_id: ctx.id,
            herramienta_nombre: ctx.herramientaNombre,
            cantidad_anterior: prevItem.cantidad,
            cantidad_nueva: prevItem.cantidad,
            detalle: ctx.mode === 'replace' ? 'Reemplazo de foto principal' : 'Foto adicional agregada',
            metadata: { fotos: nextUrls.length }
          })
          await reload()
          setToast('Foto guardada.')
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'No se pudo subir la foto.')
      } finally {
        setUploadingPhoto(null)
      }
    },
    [items, logMovimiento, reload]
  )

  useEffect(() => {
    if (!lightbox) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightbox(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightbox])

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
    let list = items
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        (it) =>
          it.herramienta.toLowerCase().includes(q) ||
          (it.tipo_marca || '').toLowerCase().includes(q) ||
          (it.descripcion || '').toLowerCase().includes(q) ||
          (it.slot_pañol || '').toLowerCase().includes(q) ||
          (it.codigo_interno || '').toLowerCase().includes(q) ||
          (it.observaciones || '').toLowerCase().includes(q) ||
          (it.prestado_a || '').toLowerCase().includes(q)
      )
    }
    if (filterEstado) list = list.filter((it) => (it.estado || 'ok') === filterEstado)
    if (soloBajoStock) list = list.filter((it) => it.cantidad <= it.umbral_minimo)
    if (soloConFoto) list = list.filter((it) => parseFotosUrls(it).length > 0)
    return list
  }, [items, search, filterEstado, soloBajoStock, soloConFoto])

  const slotMap = useMemo(() => {
    const m = new Map<string, Item>()
    for (const it of items) {
      const sl = normalizarSlot(it.slot_pañol)
      if (sl && ALL_SLOTS.includes(sl)) m.set(sl, it)
    }
    return m
  }, [items])

  const alertas = useMemo(() => items.filter((it) => it.cantidad <= it.umbral_minimo), [items])

  useEffect(() => {
    if (!browserNotify || alertas.length === 0) return
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
    const key = alertas.map((a) => `${a.id}:${a.cantidad}`).join('|')
    const last = sessionStorage.getItem('metal-inv-notify-key')
    if (last === key) return
    sessionStorage.setItem('metal-inv-notify-key', key)
    try {
      new Notification('Metalúrgica · Pañol', {
        body: `${alertas.length} herramienta(s) con stock bajo o en mínimo.`,
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

  const pieByEstado = useMemo(() => {
    const acc = new Map<string, number>()
    for (const it of items) {
      const k = slugEstado(it.estado as string)
      acc.set(k, (acc.get(k) ?? 0) + 1)
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

  const stockKpis = useMemo(() => {
    let totalUnidades = 0
    let sinStock = 0
    let bajoUmbral = 0
    let sobreUmbral = 0
    for (const it of items) {
      totalUnidades += it.cantidad
      if (it.cantidad <= 0) sinStock += 1
      else if (it.cantidad <= it.umbral_minimo) bajoUmbral += 1
      else sobreUmbral += 1
    }
    return { totalUnidades, sinStock, bajoUmbral, sobreUmbral }
  }, [items])

  const copiarListaAlertas = () => {
    const lines = alertas.map((a) => `- ${a.herramienta} (${a.cantidad} u., umbral ${a.umbral_minimo})`).join('\n')
    void navigator.clipboard.writeText(lines || 'Sin alertas de stock.').then(() => setToast('Lista copiada al portapapeles.'))
  }

  const mailtoAlertas = () => {
    const body = encodeURIComponent(
      `Hola,\n\nStock bajo en pañol metalúrgica:\n\n${alertas
        .map((a) => `• ${a.herramienta} — ${a.cantidad} u. (umbral ${a.umbral_minimo})`)
        .join('\n')}\n`
    )
    window.location.href = `mailto:?subject=${encodeURIComponent('Metalúrgica · reposición pañol')}&body=${body}`
  }

  const pedidoComprasAlertas = async () => {
    if (alertas.length === 0) {
      setToast('No hay ítems en alerta.')
      return
    }
    const solicitanteId = Number(localStorage.getItem('usuario_id')) || usuario?.id || 0
    const nombre = usuario?.nombre || 'Metalúrgica'
    const observaciones = `Reposición pañol metalúrgica — ${alertas.length} ítem(s) bajo umbral`
    const res = await apiService.crearPedidoCompra({
      id_solicitante: solicitanteId,
      nombre_solicitante: nombre,
      sector_solicitante: 'Metalúrgica',
      prioridad: 'Alta',
      motivo: 'Inventario pañol · stock mínimo',
      observaciones,
      items: alertas.map((a) => ({
        descripcion: `${a.herramienta}${a.tipo_marca ? ` (${a.tipo_marca})` : ''}`,
        cantidad_solicitada: Math.max(a.umbral_minimo - a.cantidad + 1, 1),
        unidad: 'unidad',
        observaciones: `Slot ${a.slot_pañol ?? '—'} · actual ${a.cantidad} u. · umbral ${a.umbral_minimo}`
      }))
    })
    if (res.success && res.data) {
      setToast(`Pedido #${res.data.numero_pedido ?? res.data.id} enviado a Compras.`)
      await logMovimiento({
        herramienta_id: null,
        herramienta_nombre: '—',
        cantidad_anterior: null,
        cantidad_nueva: null,
        detalle: `Pedido de compra por alertas (#${res.data.numero_pedido ?? res.data.id})`,
        metadata: { ids: alertas.map((x) => x.id) }
      })
      await reload()
    } else setToast(res.error ?? 'No se pudo crear el pedido.')
  }

  const activarNotificacionesNavegador = async () => {
    if (typeof Notification === 'undefined') {
      setToast('Este navegador no soporta notificaciones.')
      return
    }
    const p = await Notification.requestPermission()
    if (p === 'granted') {
      setBrowserNotify(true)
      setToast('Notificaciones del navegador activadas.')
    } else setToast('Permisos denegados.')
  }

  const openGallery = (it: Item, startUrl?: string) => {
    const urls = parseFotosUrls(it)
    if (!urls.length) return
    const url = startUrl && urls.includes(startUrl) ? startUrl : urls[0]
    setLightbox({
      url,
      title: it.herramienta,
      gallery: urls.length > 1 ? urls : undefined
    })
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
            Herramientas, fotos (galería), estado operativo, préstamos y exportaciones.{' '}
            {readonly ? <strong className="met-inv-readonly-tag">Solo lectura</strong> : null}
          </p>
        </div>
        <div className="met-inv-header-actions">
          {alertas.length > 0 && (
            <div className="met-inv-alert-pill" title="Stock bajo">
              <span className="met-inv-alert-dot" />
              {alertas.length} alerta{alertas.length === 1 ? '' : 's'}
            </div>
          )}
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
            Si faltan columnas nuevas, ejecutá{' '}
            <code>supabase/patches/2026-04-24_metalurgica_inventario_extend_features.sql</code>. Fotos en Storage{' '}
            <code>archivos/metalurgica-inventario</code>.
          </span>
        </div>
      )}

      <section className="met-inv-zone met-inv-zone--stock" aria-labelledby="met-inv-stock-title">
        <div className="met-inv-zone-head">
          <span className="met-inv-zone-badge met-inv-zone-badge--stock">Stock</span>
          <h2 id="met-inv-stock-title" className="met-inv-zone-title">
            Cantidades y reposición
          </h2>
          <p className="met-inv-zone-desc">
            Aquí resolvemos <strong>cuánto hay</strong> frente al mínimo: alertas, pedidos y ranking por cantidad.
          </p>
        </div>

        <div className="met-inv-kpis">
          <div className="met-inv-kpi met-inv-kpi--total">
            <span className="met-inv-kpi-value">{stockKpis.totalUnidades}</span>
            <span className="met-inv-kpi-label">Unidades totales</span>
          </div>
          <div className="met-inv-kpi met-inv-kpi--ok">
            <span className="met-inv-kpi-value">{stockKpis.sobreUmbral}</span>
            <span className="met-inv-kpi-label">Ítems sobre umbral</span>
          </div>
          <div className="met-inv-kpi met-inv-kpi--warn">
            <span className="met-inv-kpi-value">{stockKpis.bajoUmbral}</span>
            <span className="met-inv-kpi-label">Bajo / en umbral</span>
          </div>
          <div className="met-inv-kpi met-inv-kpi--danger">
            <span className="met-inv-kpi-value">{stockKpis.sinStock}</span>
            <span className="met-inv-kpi-label">Sin stock</span>
          </div>
        </div>

        <div className="met-inv-zone-toolbar">
          <button type="button" className="met-inv-btn met-inv-btn--ghost" onClick={copiarListaAlertas}>
            Copiar alertas
          </button>
          <button type="button" className="met-inv-btn met-inv-btn--ghost" onClick={mailtoAlertas}>
            Mail alertas
          </button>
          {!readonly && (
            <>
              <button type="button" className="met-inv-btn met-inv-btn--ghost" onClick={() => void pedidoComprasAlertas()}>
                Pedido compras (alertas)
              </button>
              <button type="button" className="met-inv-btn met-inv-btn--ghost" onClick={activarNotificacionesNavegador}>
                Campana navegador
              </button>
            </>
          )}
        </div>

        <div className="met-inv-panel met-inv-panel--flush met-inv-stock-filter-panel">
          <label className="met-inv-filter-check">
            <input type="checkbox" checked={soloBajoStock} onChange={(e) => setSoloBajoStock(e.target.checked)} />
            Filtrar listado abajo: solo ítems con stock bajo o en mínimo
          </label>
        </div>

        <div className="met-inv-stock-charts">
          <div className="met-inv-panel met-inv-panel--charts met-inv-panel--stock-chart">
            <h2 className="met-inv-h2">Stock vs umbral</h2>
            <div className="met-inv-chart-wrap met-inv-chart-wrap--small">
              {pieStock.length === 0 ? (
                <p className="met-inv-muted">Sin ítems.</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={pieStock}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={48}
                      outerRadius={78}
                      paddingAngle={2}
                    >
                      <Cell fill="#f97316" />
                      <Cell fill="#22c55e" />
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="met-inv-panel met-inv-panel--bar met-inv-panel--stock-chart">
            <h2 className="met-inv-h2">Top cantidades (stock)</h2>
            {barTop.length === 0 ? (
              <p className="met-inv-muted">—</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={barTop} layout="vertical" margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
                  <XAxis type="number" allowDecimals={false} stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <YAxis type="category" dataKey="nombre" width={96} stroke="#94a3b8" tick={{ fill: '#cbd5e1', fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="cantidad" fill="#34d399" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </section>

      <section className="met-inv-zone met-inv-zone--inventario" aria-labelledby="met-inv-inv-title">
        <div className="met-inv-zone-head">
          <span className="met-inv-zone-badge met-inv-zone-badge--inv">Inventario</span>
          <h2 id="met-inv-inv-title" className="met-inv-zone-title">
            Catálogo y pañol
          </h2>
          <p className="met-inv-zone-desc">
            Identidad de cada herramienta: <strong>marca, estado operativo, fotos, código, ubicación</strong> en el pañol (distinto del foco numérico de Stock).
          </p>
        </div>

        <div className="met-inv-zone-toolbar">
          <button type="button" className="met-inv-btn met-inv-btn--ghost" onClick={() => exportMetalInvCsv(filtered)}>
            CSV
          </button>
          <button type="button" className="met-inv-btn met-inv-btn--ghost" onClick={() => exportMetalInvXlsx(filtered)}>
            Excel
          </button>
          <button type="button" className="met-inv-btn met-inv-btn--ghost" onClick={() => exportMetalInvPdf(filtered)}>
            PDF
          </button>
        </div>

        <section className="met-inv-filters met-inv-panel met-inv-panel--flush">
          <div className="met-inv-filters-row met-inv-filters-row--wrap">
            <label className="met-inv-filter-field">
              Estado operativo
              <select
                className="met-inv-input"
                value={filterEstado}
                onChange={(e) => setFilterEstado((e.target.value || '') as '' | MetalInvEstado)}
              >
                <option value="">Todos</option>
                {METAL_INV_ESTADOS.map((e) => (
                  <option key={e.value} value={e.value}>
                    {e.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="met-inv-filter-check">
              <input type="checkbox" checked={soloConFoto} onChange={(e) => setSoloConFoto(e.target.checked)} />
              Solo con foto
            </label>
            <label className="met-inv-filter-field met-inv-filter-search">
              Buscar en catálogo
              <input
                className="met-inv-input"
                placeholder="Código, herramienta, marca, observaciones…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            <span className="met-inv-muted met-inv-filter-hint">
              Solo lectura: <code>?readonly=1</code>
            </span>
          </div>
        </section>

        <section className="met-inv-hero-grid met-inv-hero-grid--dual">
          <div className="met-inv-panel met-inv-panel--charts">
            <h2 className="met-inv-h2">Por tipo / marca (catálogo)</h2>
            <div className="met-inv-chart-wrap">
              {pieByMarca.length === 0 ? (
                <p className="met-inv-muted">Sin datos.</p>
              ) : (
                <ResponsiveContainer width="100%" height={210}>
                  <PieChart>
                    <Pie
                      data={pieByMarca}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={48}
                      outerRadius={76}
                      paddingAngle={2}
                    >
                      {pieByMarca.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => [`${v} u.`, 'Cantidad']} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="met-inv-panel met-inv-panel--charts">
            <h2 className="met-inv-h2">Estado operativo (ítems)</h2>
            <div className="met-inv-chart-wrap">
              {pieByEstado.length === 0 ? (
                <p className="met-inv-muted">—</p>
              ) : (
                <ResponsiveContainer width="100%" height={210}>
                  <PieChart>
                    <Pie
                      data={pieByEstado}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={44}
                      outerRadius={74}
                      paddingAngle={2}
                    >
                      {pieByEstado.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[(i + 3) % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </section>

      <section className="met-inv-panel met-inv-panel--pañol">
        <div className="met-inv-pañol-head">
          <h2 className="met-inv-h2">Pañol · cajones (semáforo)</h2>
          <p className="met-inv-muted">
            Verde OK · naranja bajo umbral · rojo sin stock. Doble clic en la foto para agrandar. Clic en celda para filtrar.
          </p>
        </div>
        <div className="met-inv-pañol-grid" role="grid" aria-label="Pañol de herramientas">
          {ALL_SLOTS.map((slot) => {
            const it = slotMap.get(slot)
            const selected = selectedSlot === slot
            const thumb = it ? primaryPhoto(it) : null
            const sem =
              it && it.cantidad <= 0
                ? 'danger'
                : it && it.cantidad <= it.umbral_minimo
                  ? 'warn'
                  : 'ok'
            return (
              <button
                key={slot}
                type="button"
                className={`met-inv-slot met-inv-slot--sem-${sem} ${it ? 'met-inv-slot--ocupado' : ''} ${selected ? 'met-inv-slot--selected' : ''}`}
                onClick={() => setSelectedSlot((s) => (s === slot ? null : slot))}
              >
                <span className="met-inv-slot-label">{slot}</span>
                {it ? (
                  <>
                    <div className="met-inv-slot-img-wrap">
                      {thumb ? (
                        <img
                          src={thumb}
                          alt=""
                          className="met-inv-slot-img"
                          title="Doble clic para agrandar"
                          onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
                          onDoubleClick={(e) => {
                            e.stopPropagation()
                            openGallery(it)
                          }}
                        />
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

      {!readonly && (
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
                Código interno
                <input
                  className="met-inv-input"
                  value={newItem.codigo_interno}
                  onChange={(e) => setNewItem((p) => ({ ...p, codigo_interno: e.target.value }))}
                  placeholder="Opcional · único"
                />
              </label>
              <label>
                Tipo / marca
                <input
                  className="met-inv-input"
                  value={newItem.tipo_marca}
                  onChange={(e) => setNewItem((p) => ({ ...p, tipo_marca: e.target.value }))}
                />
              </label>
              <label>
                Estado
                <select
                  className="met-inv-input"
                  value={newItem.estado}
                  onChange={(e) => setNewItem((p) => ({ ...p, estado: e.target.value as MetalInvEstado }))}
                >
                  {METAL_INV_ESTADOS.map((e) => (
                    <option key={e.value} value={e.value}>
                      {e.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="met-inv-form-wide">
                Descripción
                <input
                  className="met-inv-input"
                  value={newItem.descripcion}
                  onChange={(e) => setNewItem((p) => ({ ...p, descripcion: e.target.value }))}
                />
              </label>
              <label className="met-inv-form-wide">
                Observaciones
                <textarea
                  className="met-inv-input met-inv-textarea"
                  rows={2}
                  value={newItem.observaciones}
                  onChange={(e) => setNewItem((p) => ({ ...p, observaciones: e.target.value }))}
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
                Umbral mínimo
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
              <label>
                Proveedor
                <input
                  className="met-inv-input"
                  value={newItem.proveedor}
                  onChange={(e) => setNewItem((p) => ({ ...p, proveedor: e.target.value }))}
                />
              </label>
              <label>
                Fecha compra
                <input
                  type="date"
                  className="met-inv-input"
                  value={newItem.fecha_compra}
                  onChange={(e) => setNewItem((p) => ({ ...p, fecha_compra: e.target.value }))}
                />
              </label>
              <label>
                Prestado a
                <input
                  className="met-inv-input"
                  value={newItem.prestado_a}
                  onChange={(e) => setNewItem((p) => ({ ...p, prestado_a: e.target.value }))}
                  placeholder="Persona que retiró"
                />
              </label>
              <label>
                Fecha préstamo
                <input
                  type="datetime-local"
                  className="met-inv-input"
                  value={newItem.fecha_prestamo}
                  onChange={(e) => setNewItem((p) => ({ ...p, fecha_prestamo: e.target.value }))}
                />
              </label>

              <div className="met-inv-form-wide met-inv-photo-block">
                <span className="met-inv-photo-label">Fotos (galería)</span>
                <div className="met-inv-photo-row">
                  <label className="met-inv-file-btn">
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      className="met-inv-file-hidden"
                      disabled={uploadingPhoto === 'new'}
                      onChange={(e) => {
                        void handlePhotoFile(e.target.files?.[0], { kind: 'new', mode: 'append' })
                        e.target.value = ''
                      }}
                    />
                    {uploadingPhoto === 'new' ? 'Subiendo…' : 'Agregar foto'}
                  </label>
                  <label className="met-inv-file-btn met-inv-file-btn--ghost">
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      className="met-inv-file-hidden"
                      disabled={uploadingPhoto === 'new' || newFotosUrls.length === 0}
                      onChange={(e) => {
                        void handlePhotoFile(e.target.files?.[0], { kind: 'new', mode: 'replace' })
                        e.target.value = ''
                      }}
                    />
                    Reemplazar principal
                  </label>
                  {newFotosUrls.map((u, idx) => (
                    <button
                      key={`${u}-${idx}`}
                      type="button"
                      className="met-inv-mini-thumb"
                      onClick={() =>
                        setLightbox({
                          url: u,
                          title: newItem.herramienta || 'Vista previa',
                          gallery: newFotosUrls.length > 1 ? newFotosUrls : undefined
                        })
                      }
                    >
                      <img src={u} alt="" />
                    </button>
                  ))}
                  {newFotosUrls.length > 0 && (
                    <button type="button" className="met-inv-link" onClick={() => setNewFotosUrls([])}>
                      Quitar todas
                    </button>
                  )}
                </div>
              </div>

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
                      const synced = syncFotoFieldsFromUrls(newFotosUrls)
                      const cant = Math.max(0, parseInt(newItem.cantidad, 10) || 0)
                      const umb = Math.max(0, parseInt(newItem.umbral_minimo, 10) || 0)
                      const slot = normalizarSlot(newItem.slot_pañol || null)
                      const payload = {
                        herramienta: newItem.herramienta.trim(),
                        codigo_interno: newItem.codigo_interno.trim() || null,
                        tipo_marca: newItem.tipo_marca.trim() || null,
                        descripcion: newItem.descripcion.trim() || null,
                        observaciones: newItem.observaciones.trim() || null,
                        cantidad: cant,
                        foto_url: synced.foto_url,
                        fotos_urls: synced.fotos_urls,
                        slot_pañol: slot,
                        umbral_minimo: umb,
                        estado: newItem.estado,
                        proveedor: newItem.proveedor.trim() || null,
                        fecha_compra: newItem.fecha_compra || null,
                        prestado_a: newItem.prestado_a.trim() || null,
                        fecha_prestamo: newItem.fecha_prestamo ? new Date(newItem.fecha_prestamo).toISOString() : null
                      }
                      const { data, error: err } = await supabase.from('metalurgica_inventario_herramientas').insert(payload).select().single()
                      if (err) setError(err.message)
                      else if (data) {
                        const row = normalizeMetalInvRow(data as Record<string, unknown>)
                        await logMovimiento({
                          herramienta_id: row.id,
                          herramienta_nombre: row.herramienta,
                          cantidad_anterior: null,
                          cantidad_nueva: row.cantidad,
                          detalle: 'Alta de herramienta',
                          metadata: { codigo: row.codigo_interno }
                        })
                        await reload()
                        setNewItem({
                          herramienta: '',
                          codigo_interno: '',
                          tipo_marca: '',
                          descripcion: '',
                          cantidad: '1',
                          slot_pañol: '',
                          umbral_minimo: '2',
                          estado: 'ok',
                          proveedor: '',
                          fecha_compra: '',
                          prestado_a: '',
                          fecha_prestamo: '',
                          observaciones: ''
                        })
                        setNewFotosUrls([])
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
            <h2 className="met-inv-h2">Historial</h2>
            <p className="met-inv-muted">Últimos eventos con usuario y metadata.</p>
            <ul className="met-inv-timeline">
              {movimientos.length === 0 ? (
                <li className="met-inv-muted">Sin movimientos.</li>
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
                          : ''}
                      </div>
                      {m.metadata && Object.keys(m.metadata).length > 0 && (
                        <pre className="met-inv-meta-pre">{JSON.stringify(m.metadata, null, 2)}</pre>
                      )}
                    </div>
                  </li>
                ))
              )}
            </ul>
          </div>
        </section>
      )}

      <section className="met-inv-panel">
        <div className="met-inv-table-head">
          <h2 className="met-inv-h2">Listado ({filtered.length})</h2>
          <span className="met-inv-muted met-inv-table-head-hint">Usá el buscador arriba (zona Inventario).</span>
        </div>
        <div className="met-inv-table-wrap">
          <table className="met-inv-table">
            <thead>
              <tr>
                <th>QR</th>
                <th>Código</th>
                <th>Fotos</th>
                <th>Herramienta</th>
                <th>Marca</th>
                <th>Estado</th>
                <th>Desc.</th>
                <th>Obs.</th>
                <th>Cant.</th>
                <th>Umb.</th>
                <th>Slot</th>
                <th>Proveedor</th>
                <th>Compra</th>
                <th>Préstamo</th>
                <th>Actualizado</th>
                {!readonly && <th />}
              </tr>
            </thead>
            <tbody>
              {filtered
                .filter((it) => !selectedSlot || normalizarSlot(it.slot_pañol) === selectedSlot)
                .map((it) => {
                  const bajo = it.cantidad <= it.umbral_minimo
                  const fotos = parseFotosUrls(it)
                  const main = primaryPhoto(it)
                  return (
                    <tr key={it.id} className={bajo ? 'met-inv-tr--warn' : undefined}>
                      <td className="met-inv-td-qr">
                        <MetalInvQrThumb payload={qrPayloadForTool(it)} />
                      </td>
                      <td>
                        <input
                          className="met-inv-input met-inv-input--table"
                          value={it.codigo_interno ?? ''}
                          disabled={readonly}
                          onChange={(e) =>
                            setItems((prev) =>
                              prev.map((x) => (x.id === it.id ? { ...x, codigo_interno: e.target.value || null } : x))
                            )
                          }
                        />
                      </td>
                      <td className="met-inv-td-photo">
                        <div className="met-inv-photo-stack">
                          <button
                            type="button"
                            className="met-inv-thumb-hit"
                            disabled={!main}
                            onClick={() => main && openGallery(it)}
                          >
                            {main ? (
                              <img src={main} alt="" className="met-inv-thumb" />
                            ) : (
                              <span className="met-inv-thumb-ph">🔧</span>
                            )}
                          </button>
                          {!readonly && (
                            <>
                              <label className="met-inv-file-mini">
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="met-inv-file-hidden"
                                  disabled={uploadingPhoto === it.id}
                                  onChange={(e) => {
                                    void handlePhotoFile(e.target.files?.[0], {
                                      kind: 'row',
                                      id: it.id,
                                      herramientaNombre: it.herramienta,
                                      mode: 'append'
                                    })
                                    e.target.value = ''
                                  }}
                                />
                                + foto
                              </label>
                              <label className="met-inv-file-mini">
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="met-inv-file-hidden"
                                  disabled={uploadingPhoto === it.id || !fotos.length}
                                  onChange={(e) => {
                                    void handlePhotoFile(e.target.files?.[0], {
                                      kind: 'row',
                                      id: it.id,
                                      herramientaNombre: it.herramienta,
                                      mode: 'replace'
                                    })
                                    e.target.value = ''
                                  }}
                                />
                                principal
                              </label>
                            </>
                          )}
                          {fotos.length > 1 && (
                            <div className="met-inv-gallery-strip">
                              {fotos.map((u) => (
                                <button key={u} type="button" className="met-inv-strip-thumb" onClick={() => openGallery(it, u)}>
                                  <img src={u} alt="" />
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>
                      <td>
                        <input
                          className="met-inv-input met-inv-input--table"
                          value={it.herramienta}
                          disabled={readonly}
                          onChange={(e) =>
                            setItems((prev) => prev.map((x) => (x.id === it.id ? { ...x, herramienta: e.target.value } : x)))
                          }
                        />
                      </td>
                      <td>
                        <input
                          className="met-inv-input met-inv-input--table"
                          value={it.tipo_marca ?? ''}
                          disabled={readonly}
                          onChange={(e) =>
                            setItems((prev) =>
                              prev.map((x) => (x.id === it.id ? { ...x, tipo_marca: e.target.value || null } : x))
                            )
                          }
                        />
                      </td>
                      <td>
                        <select
                          className="met-inv-input met-inv-input--table"
                          value={(it.estado as string) || 'ok'}
                          disabled={readonly}
                          onChange={(e) =>
                            setItems((prev) =>
                              prev.map((x) =>
                                x.id === it.id ? { ...x, estado: e.target.value as MetalInvEstado } : x
                              )
                            )
                          }
                        >
                          {METAL_INV_ESTADOS.map((e) => (
                            <option key={e.value} value={e.value}>
                              {e.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          className="met-inv-input met-inv-input--table"
                          value={it.descripcion ?? ''}
                          disabled={readonly}
                          onChange={(e) =>
                            setItems((prev) =>
                              prev.map((x) => (x.id === it.id ? { ...x, descripcion: e.target.value || null } : x))
                            )
                          }
                        />
                      </td>
                      <td>
                        <textarea
                          className="met-inv-input met-inv-input--table met-inv-textarea-sm"
                          rows={2}
                          value={it.observaciones ?? ''}
                          disabled={readonly}
                          onChange={(e) =>
                            setItems((prev) =>
                              prev.map((x) => (x.id === it.id ? { ...x, observaciones: e.target.value || null } : x))
                            )
                          }
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min={0}
                          className="met-inv-input met-inv-input--table met-inv-input--num"
                          value={it.cantidad}
                          disabled={readonly}
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
                          disabled={readonly}
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
                          disabled={readonly}
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
                      <td>
                        <input
                          className="met-inv-input met-inv-input--table"
                          value={it.proveedor ?? ''}
                          disabled={readonly}
                          onChange={(e) =>
                            setItems((prev) =>
                              prev.map((x) => (x.id === it.id ? { ...x, proveedor: e.target.value || null } : x))
                            )
                          }
                        />
                      </td>
                      <td>
                        <input
                          type="date"
                          className="met-inv-input met-inv-input--table"
                          value={it.fecha_compra ? String(it.fecha_compra).slice(0, 10) : ''}
                          disabled={readonly}
                          onChange={(e) =>
                            setItems((prev) =>
                              prev.map((x) => (x.id === it.id ? { ...x, fecha_compra: e.target.value || null } : x))
                            )
                          }
                        />
                      </td>
                      <td>
                        <input
                          className="met-inv-input met-inv-input--table"
                          value={it.prestado_a ?? ''}
                          placeholder="—"
                          disabled={readonly}
                          onChange={(e) =>
                            setItems((prev) =>
                              prev.map((x) => (x.id === it.id ? { ...x, prestado_a: e.target.value || null } : x))
                            )
                          }
                        />
                        <input
                          type="datetime-local"
                          className="met-inv-input met-inv-input--table met-inv-input--dt"
                          value={
                            it.fecha_prestamo
                              ? new Date(it.fecha_prestamo).toISOString().slice(0, 16)
                              : ''
                          }
                          disabled={readonly}
                          onChange={(e) =>
                            setItems((prev) =>
                              prev.map((x) =>
                                x.id === it.id
                                  ? {
                                      ...x,
                                      fecha_prestamo: e.target.value ? new Date(e.target.value).toISOString() : null
                                    }
                                  : x
                              )
                            )
                          }
                        />
                      </td>
                      <td className="met-inv-td-date">{new Date(it.updated_at).toLocaleString('es-AR')}</td>
                      {!readonly && (
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
                                const payload = rowPayloadForDb(it)
                                const diff: Record<string, unknown> = {}
                                const prevPayload = rowPayloadForDb(prev)
                                for (const key of Object.keys(payload) as (keyof typeof payload)[]) {
                                  const a = prevPayload[key]
                                  const b = payload[key]
                                  if (JSON.stringify(a) !== JSON.stringify(b)) diff[key as string] = { de: a, a: b }
                                }
                                const { error: err } = await supabase
                                  .from('metalurgica_inventario_herramientas')
                                  .update(payload)
                                  .eq('id', it.id)
                                if (err) setError(err.message)
                                else {
                                  const nowIso = new Date().toISOString()
                                  setItems((p) => p.map((x) => (x.id === it.id ? { ...x, updated_at: nowIso } : x)))
                                  await logMovimiento({
                                    herramienta_id: it.id,
                                    herramienta_nombre: it.herramienta,
                                    cantidad_anterior: prev.cantidad,
                                    cantidad_nueva: it.cantidad,
                                    detalle:
                                      prev.cantidad !== it.cantidad ? 'Ajuste de cantidad / datos' : 'Edición de datos',
                                    metadata: diff
                                  })
                                  await reload()
                                  setToast('Guardado.')
                                }
                              } finally {
                                setSavingId(null)
                              }
                            }}
                          >
                            {savingId === it.id ? '…' : 'Guardar'}
                          </button>
                        </td>
                      )}
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
      </section>

      {lightbox && (
        <div
          className="met-inv-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="Foto ampliada"
          onClick={() => setLightbox(null)}
        >
          <div className="met-inv-lightbox-inner" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="met-inv-lightbox-close" onClick={() => setLightbox(null)} aria-label="Cerrar">
              ×
            </button>
            <img src={lightbox.url} alt={lightbox.title} className="met-inv-lightbox-img" />
            {lightbox.gallery && lightbox.gallery.length > 1 && (
              <div className="met-inv-lightbox-strip">
                {lightbox.gallery.map((u) => (
                  <button
                    key={u}
                    type="button"
                    className={u === lightbox.url ? 'met-inv-lb-thumb met-inv-lb-thumb--active' : 'met-inv-lb-thumb'}
                    onClick={() => setLightbox((lb) => (lb ? { ...lb, url: u } : null))}
                  >
                    <img src={u} alt="" />
                  </button>
                ))}
              </div>
            )}
            <p className="met-inv-lightbox-caption">{lightbox.title}</p>
          </div>
        </div>
      )}
    </div>
  )
}

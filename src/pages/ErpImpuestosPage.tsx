import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import apiService from '../services/api'
import type { PedidoCompra } from '../types/pedidos'
import './ErpSectionPage.css'

function proveedorNombreDesdePedido(p: PedidoCompra): string {
  const items = p.items || []
  for (const it of items) {
    const n = String(it.proveedor || '').trim()
    if (n) return n
  }
  const prov = (p as { proveedor?: { razon_social?: string; nombre_fantasia?: string; nombre?: string } | null })
    .proveedor
  if (prov?.razon_social) return prov.razon_social
  if (prov?.nombre_fantasia) return prov.nombre_fantasia
  if (prov?.nombre) return prov.nombre
  return ''
}

function matchProveedorSelectId(proveedores: any[], nombre: string): string {
  const n = nombre.trim().toLowerCase()
  if (!n) return ''
  const hit = proveedores.find(
    (p: any) =>
      String(p?.nombre || '')
        .trim()
        .toLowerCase() === n ||
      String(p?.razon_social || '')
        .trim()
        .toLowerCase() === n
  )
  return hit?.id != null ? String(hit.id) : ''
}

export default function ErpImpuestosPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  /** Evita repetir la misma precarga en bucle; se limpia al guardar factura o recargando la página. */
  const prefillIntentos = useRef<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [facturasEmitidas, setFacturasEmitidas] = useState<any[]>([])
  const [facturasCompra, setFacturasCompra] = useState<any[]>([])
  const [proveedores, setProveedores] = useState<any[]>([])
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<'ventas' | 'compras'>('ventas')

  const today = useMemo(() => new Date(), [])
  const defaultFrom = useMemo(() => {
    const d = new Date(today.getFullYear(), today.getMonth(), 1)
    return d.toISOString().split('T')[0]
  }, [today])
  const defaultTo = useMemo(() => today.toISOString().split('T')[0], [today])
  const [range, setRange] = useState({ from: defaultFrom, to: defaultTo })

  const [compraForm, setCompraForm] = useState({
    tipo_comprobante: 'Factura' as 'Factura' | 'Nota de Crédito' | 'Nota de Débito',
    letra: 'A' as 'A' | 'B' | 'C',
    punto_venta: 1,
    numero_comprobante: '',
    fecha_emision: defaultTo,
    id_proveedor: '',
    proveedor_nombre: '',
    proveedor_cuit: '',
    observaciones: ''
  })
  const [compraItems, setCompraItems] = useState<Array<{
    descripcion: string
    cantidad: number
    precio_unitario: number
    descuento: number
    iva_porcentaje: number
  }>>([])
  const [vinculoPedidoId, setVinculoPedidoId] = useState<number | null>(null)
  const [vinculoCxpId, setVinculoCxpId] = useState<number | null>(null)
  const [prefillBanner, setPrefillBanner] = useState<string | null>(null)

  useEffect(() => {
    const tabParam = (searchParams.get('tab') || '').toLowerCase()
    if (tabParam === 'compras') setTab('compras')

    const pedidoRaw = searchParams.get('pedido')
    const cxpRaw = searchParams.get('cxp')
    const pid = pedidoRaw ? Number(pedidoRaw) : NaN
    const cid = cxpRaw ? Number(cxpRaw) : NaN
    const tienePedido = Number.isFinite(pid) && pid > 0
    const tieneCxp = Number.isFinite(cid) && cid > 0
    if (!tienePedido && !tieneCxp) return

    const marca = `${pedidoRaw || ''}|${cxpRaw || ''}`
    if (prefillIntentos.current.has(marca)) return
    prefillIntentos.current.add(marca)

    let cancelled = false
    void (async () => {
      const rp = await apiService.getProveedores(true)
      if (cancelled) return
      if (rp.success && rp.data) setProveedores(Array.isArray(rp.data) ? rp.data : [])

      const provList = (rp.success && rp.data && Array.isArray(rp.data) ? rp.data : []) as any[]

      setVinculoPedidoId(tienePedido ? pid : null)
      setVinculoCxpId(tieneCxp ? cid : null)

      if (tienePedido) {
        const r = await apiService.getPedidoCompra(pid)
        if (cancelled || !r.success || !r.data) {
          setPrefillBanner('No se pudo cargar el pedido para precargar el formulario.')
          return
        }
        const p = r.data
        const nombreProv = proveedorNombreDesdePedido(p)
        const idSel = matchProveedorSelectId(provList, nombreProv)
        const itemsFromPedido = (p.items || [])
          .map((it) => {
            const qty = Number(it.cantidad_comprada ?? it.cantidad_aprobada ?? it.cantidad_solicitada) || 1
            let pu = Number(it.precio_unitario) || 0
            if (!pu && it.precio_total != null && qty > 0) pu = Number(it.precio_total) / qty
            return {
              descripcion: String(it.descripcion || '').trim() || 'Ítem',
              cantidad: qty,
              precio_unitario: Math.round(pu * 100) / 100,
              descuento: 0,
              iva_porcentaje: 21
            }
          })
          .filter((row) => row.descripcion.trim() !== '')

        const fechaSol = p.fecha_solicitud ? String(p.fecha_solicitud).split('T')[0] : defaultTo
        setCompraForm((f) => ({
          ...f,
          fecha_emision: fechaSol,
          id_proveedor: idSel,
          proveedor_nombre: nombreProv || f.proveedor_nombre,
          proveedor_cuit: f.proveedor_cuit,
          observaciones: `Pedido ${p.numero_pedido}${tieneCxp ? ` · CxP #${cid}` : ''}`
        }))
        setCompraItems(
          itemsFromPedido.length > 0
            ? itemsFromPedido
            : [{ descripcion: `Pedido ${p.numero_pedido}`, cantidad: 1, precio_unitario: 0, descuento: 0, iva_porcentaje: 21 }]
        )
        setPrefillBanner(`Formulario precargado desde el pedido ${p.numero_pedido}. Completá PV, número de comprobante y revisá ítems.`)
        setTab('compras')
        return
      }

      if (tieneCxp) {
        const r = await apiService.getCuentasPorPagar({ id: cid })
        if (cancelled || !r.success || !r.data?.length) {
          setPrefillBanner('No se encontró la cuenta por pagar para precargar.')
          return
        }
        const cxp = r.data[0] as any
        const monto = Number(cxp.monto_total) || 0
        const neto21 = monto > 0 ? Math.round((monto / 1.21) * 100) / 100 : 0
        const idSel = matchProveedorSelectId(provList, String(cxp.proveedor_nombre || ''))
        const fe = cxp.fecha_emision ? String(cxp.fecha_emision).split('T')[0] : defaultTo
        const nroDoc = cxp.numero_documento != null ? String(cxp.numero_documento).trim() : ''
        setCompraForm((f) => ({
          ...f,
          fecha_emision: fe,
          id_proveedor: idSel,
          proveedor_nombre: String(cxp.proveedor_nombre || ''),
          proveedor_cuit: f.proveedor_cuit,
          numero_comprobante: nroDoc && /^\d+$/.test(nroDoc) ? nroDoc : f.numero_comprobante,
          observaciones: `CxP #${cxp.id}${cxp.id_pedido_compra ? ` · pedido compra #${cxp.id_pedido_compra}` : ''}`
        }))
        setCompraItems([
          {
            descripcion: `Imputación CxP #${cxp.id} (${cxp.proveedor_nombre || 'proveedor'})`,
            cantidad: 1,
            precio_unitario: neto21,
            descuento: 0,
            iva_porcentaje: 21
          }
        ])
        setPrefillBanner(
          'Formulario precargado desde cuenta por pagar (total repartido en una línea al 21 %; ajustá alícuotas si corresponde).'
        )
        setTab('compras')
      }
    })()

    return () => {
      cancelled = true
    }
  }, [searchParams, defaultTo])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    const p = tab === 'ventas'
      ? apiService.getFacturas({
          estado: 'Emitida',
          fechaDesde: range.from || undefined,
          fechaHasta: range.to || undefined
        })
      : apiService.getFacturasCompra({
          fechaDesde: range.from || undefined,
          fechaHasta: range.to || undefined
        })

    void Promise.all([p, apiService.getProveedores(true)]).then(([r, rp]) => {
      if (cancelled) return

      if (rp.success && rp.data) setProveedores(Array.isArray(rp.data) ? rp.data : [])
      else setProveedores([])

      if (tab === 'ventas') {
        if ((r as any).success && (r as any).data) setFacturasEmitidas(Array.isArray((r as any).data) ? (r as any).data : [])
        else {
          setFacturasEmitidas([])
          if (!(r as any).success) setError((r as any).error || 'No se pudieron cargar facturas.')
        }
      } else {
        if ((r as any).success && (r as any).data) setFacturasCompra(Array.isArray((r as any).data) ? (r as any).data : [])
        else {
          setFacturasCompra([])
          if (!(r as any).success) setError((r as any).error || 'No se pudieron cargar compras.')
        }
      }
    })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [range.from, range.to, tab])

  const kpis = useMemo(() => {
    const monto = facturasEmitidas.reduce((sum: number, f: any) => sum + (Number(f?.total) || 0), 0)
    return { emitidas: facturasEmitidas.length, monto }
  }, [facturasEmitidas])

  const libroIvaVentas = useMemo(() => {
    const rows = (facturasEmitidas || []).map((f: any) => {
      const items = Array.isArray(f?.items) ? f.items : []
      const acc = {
        neto_21: 0,
        iva_21: 0,
        neto_105: 0,
        iva_105: 0,
        neto_0: 0,
        iva_0: 0,
        otros_neto: 0,
        otros_iva: 0
      }

      for (const it of items) {
        const alic = Number(it?.iva_porcentaje)
        const neto = Number(it?.subtotal) || 0
        const iva = Number(it?.iva_monto) || 0
        if (Math.abs(alic - 21) < 0.0001) {
          acc.neto_21 += neto
          acc.iva_21 += iva
        } else if (Math.abs(alic - 10.5) < 0.0001) {
          acc.neto_105 += neto
          acc.iva_105 += iva
        } else if (Math.abs(alic - 0) < 0.0001) {
          acc.neto_0 += neto
          acc.iva_0 += iva
        } else {
          acc.otros_neto += neto
          acc.otros_iva += iva
        }
      }

      const fecha = (String(f?.fecha_emision || '').split('T')[0] || '').trim()
      return {
        id: f?.id,
        fecha,
        tipo: f?.tipo_comprobante || '—',
        pv: f?.punto_venta ?? '—',
        nro: f?.numero_comprobante ?? '—',
        cliente: f?.cliente_nombre || '—',
        cuit: f?.cliente_dni_cuit || '',
        ...acc,
        total: Number(f?.total) || 0
      }
    })

    const totals = rows.reduce(
      (t: any, r: any) => {
        for (const k of ['neto_21', 'iva_21', 'neto_105', 'iva_105', 'neto_0', 'iva_0', 'otros_neto', 'otros_iva'] as const) {
          t[k] += Number(r[k]) || 0
        }
        t.total += Number(r.total) || 0
        t.cantidad += 1
        return t
      },
      {
        neto_21: 0,
        iva_21: 0,
        neto_105: 0,
        iva_105: 0,
        neto_0: 0,
        iva_0: 0,
        otros_neto: 0,
        otros_iva: 0,
        total: 0,
        cantidad: 0
      }
    )

    return { rows, totals }
  }, [facturasEmitidas])

  const libroIvaCompras = useMemo(() => {
    const rows = (facturasCompra || []).map((f: any) => {
      const items = Array.isArray(f?.items) ? f.items : []
      const acc = {
        neto_21: 0,
        iva_21: 0,
        neto_105: 0,
        iva_105: 0,
        neto_0: 0,
        iva_0: 0,
        otros_neto: 0,
        otros_iva: 0
      }

      for (const it of items) {
        const alic = Number(it?.iva_porcentaje)
        const neto = Number(it?.subtotal) || 0
        const iva = Number(it?.iva_monto) || 0
        if (Math.abs(alic - 21) < 0.0001) {
          acc.neto_21 += neto
          acc.iva_21 += iva
        } else if (Math.abs(alic - 10.5) < 0.0001) {
          acc.neto_105 += neto
          acc.iva_105 += iva
        } else if (Math.abs(alic - 0) < 0.0001) {
          acc.neto_0 += neto
          acc.iva_0 += iva
        } else {
          acc.otros_neto += neto
          acc.otros_iva += iva
        }
      }

      const fecha = (String(f?.fecha_emision || '').split('T')[0] || '').trim()
      return {
        id: f?.id,
        fecha,
        tipo: `${f?.tipo_comprobante || '—'} ${f?.letra || ''}`.trim(),
        pv: f?.punto_venta ?? '—',
        nro: f?.numero_comprobante ?? '—',
        cliente: f?.proveedor_nombre || '—',
        cuit: f?.proveedor_cuit || '',
        id_pedido_compra: f?.id_pedido_compra ?? null,
        id_cuenta_por_pagar: f?.id_cuenta_por_pagar ?? null,
        ...acc,
        total: Number(f?.total) || 0
      }
    })

    const totals = rows.reduce(
      (t: any, r: any) => {
        for (const k of ['neto_21', 'iva_21', 'neto_105', 'iva_105', 'neto_0', 'iva_0', 'otros_neto', 'otros_iva'] as const) {
          t[k] += Number(r[k]) || 0
        }
        t.total += Number(r.total) || 0
        t.cantidad += 1
        return t
      },
      {
        neto_21: 0,
        iva_21: 0,
        neto_105: 0,
        iva_105: 0,
        neto_0: 0,
        iva_0: 0,
        otros_neto: 0,
        otros_iva: 0,
        total: 0,
        cantidad: 0
      }
    )

    return { rows, totals }
  }, [facturasCompra])

  const exportLibroIvaVentasCsv = () => {
    const esc = (v: any) => {
      const s = v === null || v === undefined ? '' : String(v)
      if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
      return s
    }
    const num = (n: any) => {
      const x = Number(n) || 0
      return x.toFixed(2)
    }

    const header = [
      'fecha',
      'tipo',
      'punto_venta',
      'numero',
      'cliente',
      'cuit',
      'neto_21',
      'iva_21',
      'neto_10_5',
      'iva_10_5',
      'neto_0',
      'iva_0',
      'otros_neto',
      'otros_iva',
      'total'
    ]
    const lines = [header.join(',')]
    for (const r of libroIvaVentas.rows) {
      lines.push(
        [
          esc(r.fecha),
          esc(r.tipo),
          esc(r.pv),
          esc(r.nro),
          esc(r.cliente),
          esc(r.cuit),
          num(r.neto_21),
          num(r.iva_21),
          num(r.neto_105),
          num(r.iva_105),
          num(r.neto_0),
          num(r.iva_0),
          num(r.otros_neto),
          num(r.otros_iva),
          num(r.total)
        ].join(',')
      )
    }
    lines.push('')
    lines.push('RESUMEN,,,,,,,,,,,,,,')
    lines.push(
      [
        'cantidad',
        libroIvaVentas.totals.cantidad,
        'total',
        num(libroIvaVentas.totals.total),
        'neto_21',
        num(libroIvaVentas.totals.neto_21),
        'iva_21',
        num(libroIvaVentas.totals.iva_21),
        'neto_10_5',
        num(libroIvaVentas.totals.neto_105),
        'iva_10_5',
        num(libroIvaVentas.totals.iva_105),
        'neto_0',
        num(libroIvaVentas.totals.neto_0),
        'iva_0',
        num(libroIvaVentas.totals.iva_0)
      ].join(',')
    )

    const csv = lines.join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `libro-iva-ventas_${range.from || 'desde'}_${range.to || 'hasta'}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  const exportLibroIvaComprasCsv = () => {
    const esc = (v: any) => {
      const s = v === null || v === undefined ? '' : String(v)
      if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
      return s
    }
    const num = (n: any) => {
      const x = Number(n) || 0
      return x.toFixed(2)
    }

    const header = [
      'fecha',
      'tipo',
      'punto_venta',
      'numero',
      'proveedor',
      'cuit',
      'id_pedido_compra',
      'id_cuenta_por_pagar',
      'neto_21',
      'iva_21',
      'neto_10_5',
      'iva_10_5',
      'neto_0',
      'iva_0',
      'otros_neto',
      'otros_iva',
      'total'
    ]
    const lines = [header.join(',')]
    for (const r of libroIvaCompras.rows) {
      lines.push(
        [
          esc(r.fecha),
          esc(r.tipo),
          esc(r.pv),
          esc(r.nro),
          esc(r.cliente),
          esc(r.cuit),
          esc(r.id_pedido_compra != null ? r.id_pedido_compra : ''),
          esc(r.id_cuenta_por_pagar != null ? r.id_cuenta_por_pagar : ''),
          num(r.neto_21),
          num(r.iva_21),
          num(r.neto_105),
          num(r.iva_105),
          num(r.neto_0),
          num(r.iva_0),
          num(r.otros_neto),
          num(r.otros_iva),
          num(r.total)
        ].join(',')
      )
    }
    const csv = lines.join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `libro-iva-compras_${range.from || 'desde'}_${range.to || 'hasta'}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  const addCompraItem = () => {
    setCompraItems((p) => [...p, { descripcion: '', cantidad: 1, precio_unitario: 0, descuento: 0, iva_porcentaje: 21 }])
  }

  const updateCompraItem = (idx: number, field: string, value: any) => {
    setCompraItems((p) => {
      const next = [...p]
      next[idx] = { ...next[idx], [field]: value }
      return next
    })
  }

  const removeCompraItem = (idx: number) => {
    setCompraItems((p) => p.filter((_, i) => i !== idx))
  }

  const guardarCompra = async () => {
    const nro = Number(String(compraForm.numero_comprobante || '').trim())
    if (!Number.isFinite(nro) || nro <= 0) {
      alert('Ingresá un número de comprobante válido.')
      return
    }
    if (!compraForm.fecha_emision) {
      alert('Seleccioná la fecha.')
      return
    }
    if (compraItems.length === 0) {
      alert('Agregá al menos un item.')
      return
    }
    if (compraItems.some((x) => !x.descripcion || x.cantidad <= 0)) {
      alert('Completá descripción y cantidad en los items.')
      return
    }

    const provId = compraForm.id_proveedor ? Number(compraForm.id_proveedor) : null
    const provNombre =
      provId && proveedores.find((p: any) => p.id === provId)?.nombre
        ? String(proveedores.find((p: any) => p.id === provId)?.nombre)
        : compraForm.proveedor_nombre.trim()

    if (!provNombre) {
      alert('Seleccioná un proveedor o ingresá el nombre.')
      return
    }

    setLoading(true)
    setError(null)
    try {
      const r = await apiService.createFacturaCompra({
        tipo_comprobante: compraForm.tipo_comprobante,
        letra: compraForm.letra,
        punto_venta: Number(compraForm.punto_venta) || 1,
        numero_comprobante: nro,
        fecha_emision: compraForm.fecha_emision,
        id_proveedor: provId,
        proveedor_nombre: provNombre,
        proveedor_cuit: compraForm.proveedor_cuit?.trim() || null,
        items: compraItems,
        observaciones: compraForm.observaciones?.trim() || null,
        id_pedido_compra: vinculoPedidoId,
        id_cuenta_por_pagar: vinculoCxpId
      })
      if (!r.success) {
        alert('Error guardando compra: ' + (r.error || 'desconocido'))
        return
      }
      alert('Comprobante de compra guardado.')
      setCompraForm((p) => ({ ...p, numero_comprobante: '', proveedor_nombre: '', proveedor_cuit: '', observaciones: '' }))
      setCompraItems([])
      setVinculoPedidoId(null)
      setVinculoCxpId(null)
      setPrefillBanner(null)
      prefillIntentos.current.clear()
      setSearchParams({ tab: 'compras' }, { replace: true })
      setTab('compras')
    } finally {
      setLoading(false)
    }
  }

  const activeLibro = tab === 'ventas' ? libroIvaVentas : libroIvaCompras
  const activeEntidadLabel = tab === 'ventas' ? 'Cliente' : 'Proveedor'

  return (
    <div className="erp-section">
      <div className="erp-section-header">
        <div>
          <h1>🧾 Impuestos</h1>
          <p className="erp-section-sub">Libro IVA Ventas / Compras, reportes impositivos y control fiscal</p>
        </div>
        <div className="erp-section-actions">
          <button type="button" className="btn-secondary" onClick={() => navigate('/erp')}>
            ← Volver a ERP
          </button>
          <button type="button" className="btn-primary" onClick={() => navigate('/erp/configuracion-afip')}>
            Configuración AFIP
          </button>
        </div>
      </div>

      {error && <div className="erp-panel"><span className="erp-pill danger">Error</span> <span className="erp-muted">{error}</span></div>}

      <div className="erp-panel">
        <div className="erp-section-actions">
          <button type="button" className={tab === 'ventas' ? 'btn-primary' : 'btn-secondary'} onClick={() => setTab('ventas')}>
            IVA Ventas
          </button>
          <button type="button" className={tab === 'compras' ? 'btn-primary' : 'btn-secondary'} onClick={() => setTab('compras')}>
            IVA Compras
          </button>
        </div>
      </div>

      {tab === 'compras' && (
        <div className="erp-panel">
          <h2>Cargar comprobante de compra (proveedor)</h2>
          {prefillBanner && (
            <div
              style={{
                marginBottom: 12,
                padding: '10px 12px',
                borderRadius: 8,
                background: '#ebf8ff',
                border: '1px solid #bee3f8',
                color: '#2c5282',
                fontSize: '0.9rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 10,
                flexWrap: 'wrap' as const
              }}
            >
              <span>{prefillBanner}</span>
              <button type="button" className="btn-secondary" onClick={() => setPrefillBanner(null)}>
                Cerrar aviso
              </button>
            </div>
          )}
          {(vinculoPedidoId != null || vinculoCxpId != null) && (
            <p className="erp-muted" style={{ marginTop: 0, marginBottom: 10, fontSize: '0.88rem' }}>
              {vinculoPedidoId != null && <>Pedido compra #{vinculoPedidoId}. </>}
              {vinculoCxpId != null && <>CxP #{vinculoCxpId}. </>}
              Al guardar, estos vínculos se persisten en la factura de compra (aplicá en Supabase el patch 2026-04-17_facturas_compra_vinculos_pedido_cxp.sql si aún no está).
            </p>
          )}
          <div className="erp-section-actions" style={{ marginBottom: 10, flexWrap: 'wrap' as any }}>
            <label className="erp-muted">
              Tipo{' '}
              <select
                value={compraForm.tipo_comprobante}
                onChange={(e) => setCompraForm((p) => ({ ...p, tipo_comprobante: e.target.value as any }))}
                style={{ marginLeft: 8 }}
              >
                <option value="Factura">Factura</option>
                <option value="Nota de Crédito">Nota de Crédito</option>
                <option value="Nota de Débito">Nota de Débito</option>
              </select>
            </label>
            <label className="erp-muted">
              Letra{' '}
              <select value={compraForm.letra} onChange={(e) => setCompraForm((p) => ({ ...p, letra: e.target.value as any }))} style={{ marginLeft: 8 }}>
                <option value="A">A</option>
                <option value="B">B</option>
                <option value="C">C</option>
              </select>
            </label>
            <label className="erp-muted">
              PV{' '}
              <input
                type="number"
                value={compraForm.punto_venta}
                onChange={(e) => setCompraForm((p) => ({ ...p, punto_venta: Number(e.target.value) || 1 }))}
                style={{ marginLeft: 8, width: 90 }}
              />
            </label>
            <label className="erp-muted">
              N°{' '}
              <input
                type="number"
                value={compraForm.numero_comprobante}
                onChange={(e) => setCompraForm((p) => ({ ...p, numero_comprobante: e.target.value }))}
                style={{ marginLeft: 8, width: 140 }}
              />
            </label>
            <label className="erp-muted">
              Fecha{' '}
              <input
                type="date"
                value={compraForm.fecha_emision}
                onChange={(e) => setCompraForm((p) => ({ ...p, fecha_emision: e.target.value }))}
                style={{ marginLeft: 8 }}
              />
            </label>
          </div>

          <div className="erp-section-actions" style={{ marginBottom: 10, flexWrap: 'wrap' as any }}>
            <label className="erp-muted">
              Proveedor{' '}
              <select
                value={compraForm.id_proveedor}
                onChange={(e) => {
                  const v = e.target.value
                  const prov = proveedores.find((p: any) => String(p.id) === String(v))
                  setCompraForm((p) => ({
                    ...p,
                    id_proveedor: v,
                    proveedor_nombre: prov?.nombre || p.proveedor_nombre,
                    proveedor_cuit: prov?.cuit || p.proveedor_cuit
                  }))
                }}
                style={{ marginLeft: 8, minWidth: 240 }}
              >
                <option value="">(seleccionar)</option>
                {proveedores.map((p: any) => (
                  <option key={p.id} value={String(p.id)}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            </label>
            <label className="erp-muted">
              Nombre (manual){' '}
              <input
                type="text"
                value={compraForm.proveedor_nombre}
                onChange={(e) => setCompraForm((p) => ({ ...p, proveedor_nombre: e.target.value }))}
                style={{ marginLeft: 8, minWidth: 260 }}
                placeholder="Si no está en lista…"
              />
            </label>
            <label className="erp-muted">
              CUIT{' '}
              <input
                type="text"
                value={compraForm.proveedor_cuit}
                onChange={(e) => setCompraForm((p) => ({ ...p, proveedor_cuit: e.target.value }))}
                style={{ marginLeft: 8, width: 160 }}
              />
            </label>
          </div>

          <div className="erp-section-actions" style={{ marginBottom: 10 }}>
            <button type="button" className="btn-secondary" onClick={addCompraItem} disabled={loading}>
              + Agregar item
            </button>
          </div>

          {compraItems.length === 0 ? (
            <p className="erp-muted">Agregá items para totalizar IVA por alícuota.</p>
          ) : (
            <div className="erp-table-wrap">
              <table className="erp-table">
                <thead>
                  <tr>
                    <th>Descripción</th>
                    <th>Cant.</th>
                    <th>Precio</th>
                    <th>Desc.</th>
                    <th>IVA %</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {compraItems.map((it, idx) => (
                    <tr key={idx}>
                      <td>
                        <input
                          type="text"
                          value={it.descripcion}
                          onChange={(e) => updateCompraItem(idx, 'descripcion', e.target.value)}
                          style={{ width: '100%' }}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          value={it.cantidad}
                          onChange={(e) => updateCompraItem(idx, 'cantidad', parseFloat(e.target.value) || 0)}
                          style={{ width: 90 }}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          value={it.precio_unitario}
                          onChange={(e) => updateCompraItem(idx, 'precio_unitario', parseFloat(e.target.value) || 0)}
                          style={{ width: 110 }}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          value={it.descuento}
                          onChange={(e) => updateCompraItem(idx, 'descuento', parseFloat(e.target.value) || 0)}
                          style={{ width: 110 }}
                        />
                      </td>
                      <td>
                        <select
                          value={it.iva_porcentaje}
                          onChange={(e) => updateCompraItem(idx, 'iva_porcentaje', parseFloat(e.target.value) || 0)}
                        >
                          <option value={21}>21%</option>
                          <option value={10.5}>10.5%</option>
                          <option value={0}>0%</option>
                        </select>
                      </td>
                      <td>
                        <button type="button" className="btn-secondary" onClick={() => removeCompraItem(idx)}>
                          Quitar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="erp-section-actions" style={{ marginTop: 12, justifyContent: 'flex-end' }}>
            <button type="button" className="btn-primary" onClick={guardarCompra} disabled={loading}>
              Guardar compra
            </button>
          </div>
        </div>
      )}

      <div className="erp-section-grid">
        <div className="erp-panel">
          <h2>KPIs (rango)</h2>
          {loading ? (
            <p className="erp-muted">Cargando…</p>
          ) : (
            <div className="erp-kpi">
              <div className="erp-kpi-item">
                <div className="erp-kpi-value">{activeLibro.totals.cantidad}</div>
                <div className="erp-kpi-label">{tab === 'ventas' ? 'Facturas emitidas' : 'Comprobantes de compra'}</div>
              </div>
              <div className="erp-kpi-item">
                <div className="erp-kpi-value">
                  ${(tab === 'ventas' ? kpis.monto : activeLibro.totals.total).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </div>
                <div className="erp-kpi-label">{tab === 'ventas' ? 'Monto emitido' : 'Total compras'}</div>
              </div>
            </div>
          )}
        </div>

        <div className="erp-panel">
          <h2>{tab === 'ventas' ? 'Libro IVA Ventas' : 'Libro IVA Compras'}</h2>
          <div className="erp-section-actions" style={{ marginBottom: 10 }}>
            <label className="erp-muted">
              Desde{' '}
              <input
                type="date"
                value={range.from}
                onChange={(e) => setRange((p) => ({ ...p, from: e.target.value }))}
                style={{ marginLeft: 8 }}
              />
            </label>
            <label className="erp-muted">
              Hasta{' '}
              <input
                type="date"
                value={range.to}
                onChange={(e) => setRange((p) => ({ ...p, to: e.target.value }))}
                style={{ marginLeft: 8 }}
              />
            </label>
            {tab === 'ventas' ? (
              <button type="button" className="btn-primary" onClick={exportLibroIvaVentasCsv} disabled={loading}>
                Export CSV
              </button>
            ) : (
              <button type="button" className="btn-primary" onClick={exportLibroIvaComprasCsv} disabled={loading}>
                Export CSV
              </button>
            )}
          </div>
          <p className="erp-section-sub" style={{ marginTop: 0 }}>
            Totales por alícuota y detalle por comprobante. Ideal para enviar al contador.
          </p>
        </div>
      </div>

      <div className="erp-panel">
        <h2>Resumen por alícuota</h2>
        {loading ? (
          <p className="erp-muted">Cargando…</p>
        ) : (
          <div className="erp-table-wrap">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Alícuota</th>
                  <th>Neto</th>
                  <th>IVA</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>21%</td>
                  <td>${activeLibro.totals.neto_21.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                  <td>${activeLibro.totals.iva_21.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                  <td>${(activeLibro.totals.neto_21 + activeLibro.totals.iva_21).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                </tr>
                <tr>
                  <td>10,5%</td>
                  <td>${activeLibro.totals.neto_105.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                  <td>${activeLibro.totals.iva_105.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                  <td>${(activeLibro.totals.neto_105 + activeLibro.totals.iva_105).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                </tr>
                <tr>
                  <td>0% (exento/no gravado)</td>
                  <td>${activeLibro.totals.neto_0.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                  <td>${activeLibro.totals.iva_0.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                  <td>${(activeLibro.totals.neto_0 + activeLibro.totals.iva_0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                </tr>
                {(activeLibro.totals.otros_neto !== 0 || activeLibro.totals.otros_iva !== 0) && (
                  <tr>
                    <td>Otros</td>
                    <td>${activeLibro.totals.otros_neto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                    <td>${activeLibro.totals.otros_iva.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                    <td>${(activeLibro.totals.otros_neto + activeLibro.totals.otros_iva).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                  </tr>
                )}
                <tr>
                  <td><strong>Total</strong></td>
                  <td colSpan={2} />
                  <td><strong>${activeLibro.totals.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</strong></td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="erp-panel">
        <h2>Detalle ({tab === 'ventas' ? 'Libro IVA Ventas' : 'Libro IVA Compras'})</h2>
        {loading ? (
          <p className="erp-muted">Cargando…</p>
        ) : activeLibro.rows.length === 0 ? (
          <p className="erp-muted">Sin comprobantes para el rango.</p>
        ) : (
          <div className="erp-table-wrap">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Tipo</th>
                  <th>PV</th>
                  <th>N°</th>
                  <th>{activeEntidadLabel}</th>
                  <th>CUIT</th>
                  <th>Neto 21</th>
                  <th>IVA 21</th>
                  <th>Neto 10,5</th>
                  <th>IVA 10,5</th>
                  <th>Neto 0</th>
                  <th>Total</th>
                  {tab === 'compras' && (
                    <>
                      <th>Pedido compra</th>
                      <th>CxP</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {activeLibro.rows
                  .sort((a: any, b: any) => (a.fecha < b.fecha ? -1 : 1))
                  .slice(0, 250)
                  .map((r: any) => (
                    <tr key={r.id}>
                      <td>{r.fecha ? new Date(r.fecha).toLocaleDateString('es-AR') : '—'}</td>
                      <td>{r.tipo}</td>
                      <td>{r.pv}</td>
                      <td>{r.nro}</td>
                      <td>{r.cliente}</td>
                      <td>{r.cuit || '—'}</td>
                      <td>${Number(r.neto_21 || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                      <td>${Number(r.iva_21 || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                      <td>${Number(r.neto_105 || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                      <td>${Number(r.iva_105 || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                      <td>${Number(r.neto_0 || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                      <td>${Number(r.total || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                      {tab === 'compras' && (
                        <>
                          <td>{r.id_pedido_compra != null ? r.id_pedido_compra : '—'}</td>
                          <td>{r.id_cuenta_por_pagar != null ? r.id_cuenta_por_pagar : '—'}</td>
                        </>
                      )}
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
        {!loading && activeLibro.rows.length > 250 && (
          <p className="erp-muted" style={{ marginTop: 10 }}>
            Mostrando 250 filas. Usá Export CSV para el archivo completo.
          </p>
        )}
      </div>
    </div>
  )
}


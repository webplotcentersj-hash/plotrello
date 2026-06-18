import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import apiService from '../services/api'
import type { ConfiguracionAFIPRecord, OrdenTrabajo, Venta } from '../types/api'
import {
  calcularLineaItem,
  calcularTotalesFactura,
  codigoComprobanteAfip,
  formatFechaAr,
  formatPvNumero,
  inferirCondicionIva,
  inferirTipoFactura,
  letraComprobante,
  type CondicionIvaCliente,
  type TipoFactura
} from '../utils/afipFacturaUi'
import './CrearFacturaPage.css'

type ItemRow = {
  descripcion: string
  cantidad: number
  precio_unitario: number
  descuento: number
  iva_porcentaje: number
}

export default function CrearFacturaPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const idOP = searchParams.get('id_op')
  const idVentaParam = searchParams.get('id_venta')

  const [loading, setLoading] = useState(false)
  const [bootLoading, setBootLoading] = useState(true)
  const [afipConfig, setAfipConfig] = useState<ConfiguracionAFIPRecord | null>(null)
  const [ventasDisponibles, setVentasDisponibles] = useState<Venta[]>([])
  const [ventaSeleccionadaId, setVentaSeleccionadaId] = useState<string>('')
  const [op, setOP] = useState<OrdenTrabajo | null>(null)
  const [venta, setVenta] = useState<Venta | null>(null)
  const [emitirAlGuardar, setEmitirAlGuardar] = useState(true)
  const [errorConfig, setErrorConfig] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    tipo_comprobante: 'Factura B' as TipoFactura,
    fecha_emision: new Date().toISOString().split('T')[0],
    fecha_vencimiento: '',
    observaciones: ''
  })

  const [cliente, setCliente] = useState({
    nombre: '',
    dni_cuit: '',
    direccion: '',
    condicion_iva: '' as '' | CondicionIvaCliente,
    id_cliente: null as number | null
  })

  const [items, setItems] = useState<ItemRow[]>([])

  const aplicarCliente = useCallback(
    (data: {
      nombre: string
      dni_cuit?: string | null
      direccion?: string | null
      condicion_iva?: CondicionIvaCliente | '' | null
      id_cliente?: number | null
    }) => {
      const cuit = data.dni_cuit || ''
      const cond = (data.condicion_iva || inferirCondicionIva(cuit)) as CondicionIvaCliente
      setCliente({
        nombre: data.nombre || 'Cliente',
        dni_cuit: cuit,
        direccion: data.direccion || '',
        condicion_iva: cond,
        id_cliente: data.id_cliente ?? null
      })
      setFormData((prev) => ({
        ...prev,
        tipo_comprobante: inferirTipoFactura(cuit, cond)
      }))
    },
    []
  )

  const aplicarVenta = useCallback(
    async (ventaId: number) => {
      const response = await apiService.getVenta(ventaId)
      if (!response.success || !response.data) return
      const v = response.data
      setVenta(v)
      setVentaSeleccionadaId(String(v.id))
      aplicarCliente({
        nombre: v.cliente_nombre,
        dni_cuit: v.cliente_dni_cuit,
        direccion: v.cliente_direccion,
        id_cliente: v.id_cliente ?? null
      })
      if (v.fecha_venta) {
        setFormData((prev) => ({ ...prev, fecha_emision: String(v.fecha_venta).split('T')[0] }))
      }
      const itemsResponse = await apiService.getItemsVenta(ventaId)
      if (itemsResponse.success && itemsResponse.data?.length) {
        setItems(
          itemsResponse.data.map((item) => ({
            descripcion: item.descripcion,
            cantidad: item.cantidad,
            precio_unitario: item.precio_unitario,
            descuento: item.descuento || 0,
            iva_porcentaje: 21
          }))
        )
      } else if (v.valor_total > 0) {
        setItems([
          {
            descripcion: `Venta ${v.numero_venta}${v.numero_op ? ` · OP ${v.numero_op}` : ''}`,
            cantidad: 1,
            precio_unitario: Math.round((v.valor_total / 1.21) * 100) / 100,
            descuento: 0,
            iva_porcentaje: 21
          }
        ])
      }
      if (v.id_op) {
        const opRes = await apiService.getOrden(v.id_op)
        if (opRes.success && opRes.data) setOP(opRes.data)
      }
    },
    [aplicarCliente]
  )

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setBootLoading(true)
      setErrorConfig(null)
      try {
        const [cfgRes, ventasRes] = await Promise.all([
          apiService.getConfiguracionAFIP(),
          apiService.listVentasPendientesFacturacion()
        ])
        if (cancelled) return
        if (cfgRes.success && cfgRes.data) setAfipConfig(cfgRes.data)
        else setErrorConfig(cfgRes.error || 'Configurá AFIP antes de facturar (Contable → Configuración AFIP).')
        if (ventasRes.success && ventasRes.data) setVentasDisponibles(ventasRes.data)
      } finally {
        if (!cancelled) setBootLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (bootLoading) return
    if (idVentaParam) {
      void aplicarVenta(parseInt(idVentaParam, 10))
      return
    }
    if (idOP) void loadOP(parseInt(idOP, 10))
  }, [bootLoading, idOP, idVentaParam, aplicarVenta])

  const loadOP = async (opId: number) => {
    try {
      const response = await apiService.getOrden(opId)
      if (response.success && response.data) {
        setOP(response.data)
        aplicarCliente({
          nombre: response.data.cliente,
          dni_cuit: response.data.dni_cuit,
          direccion: response.data.direccion_cliente,
          id_cliente: null
        })
        const ventasRes = await apiService.obtenerVentas(undefined, undefined, undefined, 'todos')
        const ventaVinculada = ventasRes.success ? ventasRes.data?.find((v) => v.id_op === opId) : undefined
        if (ventaVinculada) {
          await aplicarVenta(ventaVinculada.id)
          return
        }
        setItems([
          {
            descripcion: response.data.descripcion || `Trabajo ${response.data.numero_op}`,
            cantidad: 1,
            precio_unitario: 0,
            descuento: 0,
            iva_porcentaje: 21
          }
        ])
      }
    } catch (error) {
      console.error('Error cargando OP:', error)
    }
  }

  const handleSelectVenta = async (ventaId: string) => {
    setVentaSeleccionadaId(ventaId)
    if (!ventaId) {
      setVenta(null)
      return
    }
    const vid = parseInt(ventaId, 10)
    if (!Number.isFinite(vid)) return
    setSearchParams(
      (prev) => {
        const p = new URLSearchParams(prev)
        p.set('id_venta', String(vid))
        p.delete('id_op')
        return p
      },
      { replace: true }
    )
    await aplicarVenta(vid)
  }

  const handleAddItem = () => {
    setItems((prev) => [...prev, { descripcion: '', cantidad: 1, precio_unitario: 0, descuento: 0, iva_porcentaje: 21 }])
  }

  const handleUpdateItem = (index: number, field: keyof ItemRow, value: string | number) => {
    setItems((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: value }
      return next
    })
  }

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  const totales = useMemo(() => calcularTotalesFactura(items), [items])

  const proximoNumero = useMemo(() => {
    if (!afipConfig) return 1
    const t = formData.tipo_comprobante
    if (t.includes(' A')) return (afipConfig.ultimo_numero_factura_a || 0) + 1
    if (t.includes(' C')) return (afipConfig.ultimo_numero_factura_c || 0) + 1
    return (afipConfig.ultimo_numero_factura_b || 0) + 1
  }, [afipConfig, formData.tipo_comprobante])

  const numeroPreview = useMemo(
    () => formatPvNumero(afipConfig?.punto_venta || 1, proximoNumero),
    [afipConfig?.punto_venta, proximoNumero]
  )

  const letra = letraComprobante(formData.tipo_comprobante)
  const codigoAfip = codigoComprobanteAfip(formData.tipo_comprobante)

  const handleGuardar = async () => {
    if (!afipConfig) {
      alert(errorConfig || 'Falta configuración AFIP activa.')
      return
    }
    if (!cliente.nombre.trim()) {
      alert('Ingresá el nombre del cliente.')
      return
    }
    if (items.length === 0) {
      alert('Agregá al menos un ítem.')
      return
    }
    if (items.some((item) => !item.descripcion.trim() || item.precio_unitario <= 0 || item.cantidad <= 0)) {
      alert('Todos los ítems deben tener descripción, cantidad y precio válidos.')
      return
    }

    setLoading(true)
    try {
      const response = await apiService.crearFactura({
        tipo_comprobante: formData.tipo_comprobante,
        fecha_emision: formData.fecha_emision,
        fecha_vencimiento: formData.fecha_vencimiento || null,
        id_cliente: cliente.id_cliente,
        cliente_nombre: cliente.nombre.trim(),
        cliente_dni_cuit: cliente.dni_cuit?.trim() || null,
        cliente_direccion: cliente.direccion?.trim() || null,
        cliente_condicion_iva: cliente.condicion_iva || null,
        id_op: op?.id || venta?.id_op || null,
        numero_op: op?.numero_op || venta?.numero_op || null,
        id_venta: venta?.id || null,
        items,
        observaciones: formData.observaciones?.trim() || null
      })

      if (!response.success || !response.data) {
        alert('Error al crear factura: ' + (response.error || 'desconocido'))
        return
      }

      let facturaId = response.data.id
      if (emitirAlGuardar) {
        const emit = await apiService.emitirFactura(facturaId)
        if (!emit.success) {
          alert('Factura creada en borrador, pero no se pudo emitir: ' + (emit.error || 'desconocido'))
          navigate(`/erp/facturas/${facturaId}`)
          return
        }
      }

      alert(emitirAlGuardar ? 'Factura creada y emitida correctamente.' : 'Factura creada en borrador.')
      navigate(`/erp/facturas/${facturaId}`)
    } catch (error) {
      console.error('Error creando factura:', error)
      alert('Error al crear factura')
    } finally {
      setLoading(false)
    }
  }

  if (bootLoading) {
    return (
      <div className="crear-factura-page">
        <div className="crear-factura-loading">Cargando datos de facturación…</div>
      </div>
    )
  }

  return (
    <div className="crear-factura-page">
      <header className="crear-factura-header">
        <div className="crear-factura-header__brand">
          <div className="crear-factura-header__icon" aria-hidden>
            🧾
          </div>
          <div>
            <p className="crear-factura-header__eyebrow">Contable · AFIP</p>
            <h1>Nueva factura de venta</h1>
            <p className="crear-factura-header__sub">
              Comprobante fiscal con datos de ventas del CRM · {afipConfig?.ambiente || 'Sin ambiente'}
            </p>
          </div>
        </div>
        <div className="crear-factura-header__actions">
          <button type="button" className="btn-secondary" onClick={() => navigate('/erp/facturas')}>
            ← Facturas
          </button>
          <button type="button" className="btn-secondary" onClick={() => navigate('/erp/configuracion-afip')}>
            Config AFIP
          </button>
        </div>
      </header>

      {errorConfig && (
        <div className="crear-factura-alert crear-factura-alert--warn">
          {errorConfig}
        </div>
      )}

      <div className="crear-factura-layout">
        <aside className="crear-factura-sidebar">
          <section className="crear-factura-panel">
            <h2>Origen · Ventas</h2>
            <label className="crear-factura-field">
              <span>Venta del CRM / mostrador</span>
              <select value={ventaSeleccionadaId} onChange={(e) => void handleSelectVenta(e.target.value)}>
                <option value="">(manual / sin venta)</option>
                {ventasDisponibles.map((v) => (
                  <option key={v.id} value={String(v.id)}>
                    {v.numero_venta} · {v.cliente_nombre} · ${Number(v.valor_total).toLocaleString('es-AR')}
                    {v.numero_op ? ` · OP ${v.numero_op}` : ''}
                  </option>
                ))}
              </select>
            </label>
            {venta && (
              <div className="crear-factura-origen-meta">
                <span className="crear-factura-pill">Venta {venta.numero_venta}</span>
                {venta.numero_op && <span className="crear-factura-pill">OP {venta.numero_op}</span>}
                <span className="crear-factura-pill">{venta.estado_pago}</span>
              </div>
            )}
          </section>

          <section className="crear-factura-panel">
            <h2>Comprobante</h2>
            <label className="crear-factura-field">
              <span>Tipo</span>
              <select
                value={formData.tipo_comprobante}
                onChange={(e) => setFormData((p) => ({ ...p, tipo_comprobante: e.target.value as TipoFactura }))}
              >
                <option value="Factura A">Factura A (RI → RI)</option>
                <option value="Factura B">Factura B</option>
                <option value="Factura C">Factura C (Monotributo)</option>
              </select>
            </label>
            <label className="crear-factura-field">
              <span>Fecha emisión</span>
              <input
                type="date"
                value={formData.fecha_emision}
                onChange={(e) => setFormData((p) => ({ ...p, fecha_emision: e.target.value }))}
              />
            </label>
            <label className="crear-factura-field">
              <span>Fecha vencimiento</span>
              <input
                type="date"
                value={formData.fecha_vencimiento}
                onChange={(e) => setFormData((p) => ({ ...p, fecha_vencimiento: e.target.value }))}
              />
            </label>
            <label className="crear-factura-check">
              <input type="checkbox" checked={emitirAlGuardar} onChange={(e) => setEmitirAlGuardar(e.target.checked)} />
              Emitir al guardar (genera CxC y asiento)
            </label>
          </section>

          <section className="crear-factura-panel">
            <h2>Cliente receptor</h2>
            <label className="crear-factura-field">
              <span>Razón social / Nombre</span>
              <input
                type="text"
                value={cliente.nombre}
                onChange={(e) => setCliente((p) => ({ ...p, nombre: e.target.value }))}
              />
            </label>
            <label className="crear-factura-field">
              <span>CUIT / DNI</span>
              <input
                type="text"
                value={cliente.dni_cuit}
                onChange={(e) => {
                  const cuit = e.target.value
                  const cond = cliente.condicion_iva || inferirCondicionIva(cuit)
                  setCliente((p) => ({ ...p, dni_cuit: cuit, condicion_iva: cond }))
                  setFormData((p) => ({ ...p, tipo_comprobante: inferirTipoFactura(cuit, cond) }))
                }}
              />
            </label>
            <label className="crear-factura-field">
              <span>Condición IVA</span>
              <select
                value={cliente.condicion_iva}
                onChange={(e) => {
                  const cond = e.target.value as CondicionIvaCliente
                  setCliente((p) => ({ ...p, condicion_iva: cond }))
                  setFormData((p) => ({ ...p, tipo_comprobante: inferirTipoFactura(cliente.dni_cuit, cond) }))
                }}
              >
                <option value="Consumidor Final">Consumidor Final</option>
                <option value="Responsable Inscripto">Responsable Inscripto</option>
                <option value="Monotributista">Monotributista</option>
                <option value="Exento">Exento</option>
                <option value="No Responsable">No Responsable</option>
              </select>
            </label>
            <label className="crear-factura-field">
              <span>Domicilio</span>
              <input
                type="text"
                value={cliente.direccion}
                onChange={(e) => setCliente((p) => ({ ...p, direccion: e.target.value }))}
              />
            </label>
          </section>

          <section className="crear-factura-panel">
            <div className="crear-factura-panel__head">
              <h2>Ítems</h2>
              <button type="button" className="btn-secondary btn-sm" onClick={handleAddItem}>
                + Ítem
              </button>
            </div>
            <div className="crear-factura-items-editor">
              {items.length === 0 ? (
                <p className="crear-factura-muted">Sin ítems. Elegí una venta o agregá manualmente.</p>
              ) : (
                items.map((item, index) => (
                  <div key={index} className="crear-factura-item-edit">
                    <input
                      type="text"
                      placeholder="Descripción"
                      value={item.descripcion}
                      onChange={(e) => handleUpdateItem(index, 'descripcion', e.target.value)}
                    />
                    <div className="crear-factura-item-edit__nums">
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        title="Cantidad"
                        value={item.cantidad}
                        onChange={(e) => handleUpdateItem(index, 'cantidad', parseFloat(e.target.value) || 0)}
                      />
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        title="Precio unitario"
                        value={item.precio_unitario}
                        onChange={(e) => handleUpdateItem(index, 'precio_unitario', parseFloat(e.target.value) || 0)}
                      />
                      <select
                        value={item.iva_porcentaje}
                        onChange={(e) => handleUpdateItem(index, 'iva_porcentaje', parseFloat(e.target.value) || 0)}
                      >
                        <option value={21}>IVA 21%</option>
                        <option value={10.5}>IVA 10,5%</option>
                        <option value={0}>IVA 0%</option>
                      </select>
                      <button type="button" className="btn-remove-item" onClick={() => handleRemoveItem(index)} aria-label="Quitar">
                        ✕
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <label className="crear-factura-field">
            <span>Observaciones</span>
            <textarea
              rows={3}
              value={formData.observaciones}
              onChange={(e) => setFormData((p) => ({ ...p, observaciones: e.target.value }))}
              placeholder="Texto adicional en la factura…"
            />
          </label>

          <div className="crear-factura-actions">
            <button type="button" className="btn-secondary" onClick={() => navigate('/erp/facturas')}>
              Cancelar
            </button>
            <button type="button" className="btn-primary" onClick={handleGuardar} disabled={loading || !afipConfig}>
              {loading ? 'Guardando…' : emitirAlGuardar ? 'Crear y emitir' : 'Guardar borrador'}
            </button>
          </div>
        </aside>

        <div className="afip-comprobante-wrap">
          <div className="afip-comprobante" aria-label="Vista previa comprobante AFIP">
            <div className="afip-comprobante__ribbon">ORIGINAL</div>

            <div className="afip-comprobante__header">
              <div className="afip-comprobante__emisor">
                <strong className="afip-comprobante__razon">{afipConfig?.razon_social || '— Configurar emisor —'}</strong>
                <div>Razón Social</div>
                <div>
                  <strong>Domicilio Comercial:</strong> {afipConfig?.domicilio_comercial || '—'}
                </div>
                <div>
                  <strong>Condición frente al IVA:</strong> {afipConfig?.condicion_iva || '—'}
                </div>
              </div>

              <div className="afip-comprobante__tipo-box">
                <div className="afip-comprobante__letra">{letra}</div>
                <div className="afip-comprobante__cod">Cod. {codigoAfip}</div>
              </div>

              <div className="afip-comprobante__ident">
                <div className="afip-comprobante__titulo">FACTURA</div>
                <div>
                  <strong>Punto de Venta:</strong> {String(afipConfig?.punto_venta || 1).padStart(4, '0')}
                </div>
                <div>
                  <strong>Comp. Nro:</strong> {String(proximoNumero).padStart(8, '0')}
                </div>
                <div>
                  <strong>Fecha de Emisión:</strong> {formatFechaAr(formData.fecha_emision)}
                </div>
                <div>
                  <strong>CUIT:</strong> {afipConfig?.cuit || '—'}
                </div>
                <div>
                  <strong>Ingresos Brutos:</strong> {afipConfig?.ingresos_brutos || '—'}
                </div>
                <div>
                  <strong>Fecha de Inicio de Actividades:</strong>{' '}
                  {afipConfig?.fecha_inicio_actividades ? formatFechaAr(afipConfig.fecha_inicio_actividades) : '—'}
                </div>
              </div>
            </div>

            <div className="afip-comprobante__receptor">
              <div>
                <strong>Apellido y Nombre / Razón Social:</strong> {cliente.nombre || '—'}
              </div>
              <div>
                <strong>CUIT / DNI:</strong> {cliente.dni_cuit || '—'}
              </div>
              <div>
                <strong>Domicilio:</strong> {cliente.direccion || '—'}
              </div>
              <div>
                <strong>Condición frente al IVA:</strong> {cliente.condicion_iva || '—'}
              </div>
              <div>
                <strong>Condición de venta:</strong> {venta?.metodo_pago || 'Contado'}
              </div>
              {formData.fecha_vencimiento && (
                <div>
                  <strong>Fecha de Vto. para el pago:</strong> {formatFechaAr(formData.fecha_vencimiento)}
                </div>
              )}
            </div>

            <table className="afip-comprobante__items">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Producto / Servicio</th>
                  <th>Cantidad</th>
                  <th>U. medida</th>
                  <th>Precio Unit.</th>
                  <th>% Bonif</th>
                  <th>Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="afip-comprobante__empty">
                      Sin ítems cargados
                    </td>
                  </tr>
                ) : (
                  items.map((item, idx) => {
                    const linea = calcularLineaItem(item)
                    const bonifPct =
                      item.cantidad * item.precio_unitario > 0
                        ? ((item.descuento / (item.cantidad * item.precio_unitario)) * 100).toFixed(1)
                        : '0.0'
                    return (
                      <tr key={idx}>
                        <td>{String(idx + 1).padStart(3, '0')}</td>
                        <td>{item.descripcion || '—'}</td>
                        <td>{item.cantidad.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                        <td>unidades</td>
                        <td>${item.precio_unitario.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                        <td>{bonifPct}%</td>
                        <td>${linea.neto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>

            <div className="afip-comprobante__footer">
              <div className="afip-comprobante__iva-detail">
                <strong>Detalle de alícuotas</strong>
                <table>
                  <thead>
                    <tr>
                      <th>Alícuota</th>
                      <th>Neto gravado</th>
                      <th>IVA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(totales.porAlicuota).length === 0 ? (
                      <tr>
                        <td colSpan={3}>—</td>
                      </tr>
                    ) : (
                      Object.entries(totales.porAlicuota).map(([alic, vals]) => (
                        <tr key={alic}>
                          <td>{alic}%</td>
                          <td>${vals.neto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                          <td>${vals.iva.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="afip-comprobante__totales">
                <div>
                  <span>Subtotal</span>
                  <strong>${totales.subtotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</strong>
                </div>
                <div>
                  <span>IVA</span>
                  <strong>${totales.iva.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</strong>
                </div>
                <div className="afip-comprobante__total-final">
                  <span>Importe Total</span>
                  <strong>${totales.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</strong>
                </div>
              </div>
            </div>

            <div className="afip-comprobante__cae">
              <div>
                <strong>CAE N°:</strong> <span className="afip-comprobante__cae-pending">Pendiente de autorización AFIP</span>
              </div>
              <div>
                <strong>Fecha de Vto. de CAE:</strong> —
              </div>
              <div className="afip-comprobante__qr-placeholder" aria-hidden>
                QR AFIP
              </div>
            </div>

            {formData.observaciones && (
              <div className="afip-comprobante__obs">
                <strong>Observaciones:</strong> {formData.observaciones}
              </div>
            )}

            <div className="afip-comprobante__preview-note">
              Vista previa · Nº estimado {numeroPreview} · Autorizá en el detalle de la factura
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

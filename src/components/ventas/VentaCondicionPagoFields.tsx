import { useEffect, useMemo, useState } from 'react'
import type { CuentaBancariaRecord } from '../../types/api'
import type {
  ConfigCondicionesVenta,
  MedioPagoCodigo,
  VentaDetallePago
} from '../../constants/ventasCondicionesPago'
import './VentaCondicionPagoFields.css'

type Props = {
  condicion: MedioPagoCodigo
  config: ConfigCondicionesVenta
  detalle: VentaDetallePago
  cuentasBancarias: CuentaBancariaRecord[]
  onChange: (next: VentaDetallePago) => void
  /** Total de la venta: se usa como monto de cheque por defecto. */
  montoVenta?: number
}

function patchDetalle(prev: VentaDetallePago, patch: Partial<VentaDetallePago>): VentaDetallePago {
  return { ...prev, ...patch }
}

function esEcheq(tipoId?: string): boolean {
  return (tipoId || '').toLowerCase() === 'echeq'
}

export default function VentaCondicionPagoFields({
  condicion,
  config,
  detalle,
  cuentasBancarias,
  onChange,
  montoVenta
}: Props) {
  const [bancoNuevo, setBancoNuevo] = useState('')
  const [bancosExtra, setBancosExtra] = useState<string[]>([])

  const cuentasTransferencia = useMemo(() => {
    const activas = cuentasBancarias.filter((c) => c.activa)
    if (config.cuentas_transferencia_ids.length > 0) {
      const ids = new Set(config.cuentas_transferencia_ids)
      return activas.filter((c) => ids.has(c.id))
    }
    const visibles = activas.filter((c) => c.visible_venta_rapida)
    return visibles.length ? visibles : activas
  }, [cuentasBancarias, config.cuentas_transferencia_ids])

  const tiposChequeActivos = config.tipos_cheque.filter((t) => t.activo)

  const bancosLista = useMemo(() => {
    const set = new Set<string>()
    const out: string[] = []
    for (const b of [...config.bancos_cheque, ...bancosExtra]) {
      const t = b.trim()
      if (!t || set.has(t.toLowerCase())) continue
      set.add(t.toLowerCase())
      out.push(t)
    }
    if (detalle.banco_cheque?.trim() && !set.has(detalle.banco_cheque.trim().toLowerCase())) {
      out.push(detalle.banco_cheque.trim())
    }
    return out
  }, [config.bancos_cheque, bancosExtra, detalle.banco_cheque])

  useEffect(() => {
    if (condicion !== 'Cheque') return
    if (detalle.monto_cheque != null && Number(detalle.monto_cheque) > 0) return
    if (montoVenta != null && montoVenta > 0) {
      onChange(patchDetalle(detalle, { monto_cheque: montoVenta }))
    }
    // Solo al elegir Cheque / primer total disponible.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [condicion, montoVenta])

  const agregarBanco = () => {
    const nombre = bancoNuevo.trim()
    if (!nombre) return
    setBancosExtra((prev) =>
      prev.some((b) => b.toLowerCase() === nombre.toLowerCase()) ? prev : [...prev, nombre]
    )
    onChange(patchDetalle(detalle, { banco_cheque: nombre }))
    setBancoNuevo('')
  }

  if (condicion === 'Transferencia') {
    const cuentaSel = cuentasTransferencia.find((c) => c.id === detalle.id_cuenta_bancaria)

    return (
      <div className="venta-condicion-fields venta-condicion-fields--transferencia">
        <p className="venta-condicion-fields__hint">
          Indicá al cliente a qué cuenta transferir.{' '}
          {config.transferencia_requiere_comprobante
            ? 'Adjuntá el comprobante más abajo.'
            : 'El comprobante es opcional.'}
        </p>

        {cuentasTransferencia.length === 0 ? (
          <p className="venta-condicion-fields__warn">
            No hay cuentas bancarias configuradas. Configuralas en ERP → Administración → Condiciones de venta.
          </p>
        ) : (
          <div className="form-group">
            <label>Cuenta destino *</label>
            <select
              className="form-select"
              value={detalle.id_cuenta_bancaria ?? ''}
              onChange={(e) => {
                const id = Number(e.target.value)
                const cuenta = cuentasTransferencia.find((c) => c.id === id)
                onChange(
                  patchDetalle(detalle, {
                    id_cuenta_bancaria: id || undefined,
                    banco_destino: cuenta?.banco || cuenta?.nombre || undefined,
                    cbu: cuenta?.cbu || undefined,
                    alias: cuenta?.alias_cvu || undefined,
                    titular_cuenta: cuenta?.titular || undefined
                  })
                )
              }}
            >
              <option value="">Seleccionar cuenta…</option>
              {cuentasTransferencia.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                  {c.banco ? ` — ${c.banco}` : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        {cuentaSel ? (
          <div className="venta-condicion-cuenta-card">
            <div className="venta-condicion-cuenta-card__row">
              <span className="venta-condicion-cuenta-card__label">Titular</span>
              <strong>{cuentaSel.titular || '—'}</strong>
            </div>
            {cuentaSel.cbu ? (
              <div className="venta-condicion-cuenta-card__row">
                <span className="venta-condicion-cuenta-card__label">CBU/CVU</span>
                <code>{cuentaSel.cbu}</code>
              </div>
            ) : null}
            {cuentaSel.alias_cvu ? (
              <div className="venta-condicion-cuenta-card__row">
                <span className="venta-condicion-cuenta-card__label">Alias</span>
                <code>{cuentaSel.alias_cvu}</code>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    )
  }

  if (condicion === 'Cheque') {
    const montoMostrar =
      detalle.monto_cheque != null && Number.isFinite(Number(detalle.monto_cheque))
        ? String(detalle.monto_cheque)
        : montoVenta != null && montoVenta > 0
          ? String(montoVenta)
          : ''

    return (
      <div className="venta-condicion-fields venta-condicion-fields--cheque">
        <div className="form-row venta-condicion-fields__grid">
          <div className="form-group">
            <label>Tipo de cheque *</label>
            <select
              className="form-select"
              value={detalle.tipo_cheque ?? ''}
              onChange={(e) => {
                const id = e.target.value
                const tipo = tiposChequeActivos.find((t) => t.id === id)
                onChange(
                  patchDetalle(detalle, {
                    tipo_cheque: id || undefined,
                    tipo_cheque_label: tipo?.label,
                    ...(id !== 'echeq' ? { codigo_echeq: undefined } : {})
                  })
                )
              }}
            >
              <option value="">Seleccionar…</option>
              {tiposChequeActivos.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Banco emisor</label>
            <select
              className="form-select"
              value={detalle.banco_cheque ?? ''}
              onChange={(e) =>
                onChange(patchDetalle(detalle, { banco_cheque: e.target.value || undefined }))
              }
            >
              <option value="">Seleccionar…</option>
              {bancosLista.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
            <div className="venta-condicion-banco-add">
              <input
                type="text"
                className="form-input"
                value={bancoNuevo}
                onChange={(e) => setBancoNuevo(e.target.value)}
                placeholder="Agregar banco…"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    agregarBanco()
                  }
                }}
              />
              <button type="button" className="btn-secondary venta-condicion-banco-add__btn" onClick={agregarBanco}>
                Agregar
              </button>
            </div>
          </div>
        </div>

        <div className="form-row venta-condicion-fields__grid">
          <div className="form-group">
            <label>Nº cheque *</label>
            <input
              type="text"
              className="form-input"
              value={detalle.numero_cheque ?? ''}
              onChange={(e) =>
                onChange(patchDetalle(detalle, { numero_cheque: e.target.value || undefined }))
              }
              placeholder="Número de cheque"
            />
          </div>

          {esEcheq(detalle.tipo_cheque) ? (
            <div className="form-group">
              <label>Código eCheq *</label>
              <input
                type="text"
                className="form-input"
                value={detalle.codigo_echeq ?? ''}
                onChange={(e) =>
                  onChange(patchDetalle(detalle, { codigo_echeq: e.target.value || undefined }))
                }
                placeholder="Código eCheq"
              />
            </div>
          ) : (
            <div className="form-group">
              <label>Plazo</label>
              <select
                className="form-select"
                value={detalle.plazo_cheque ?? ''}
                onChange={(e) =>
                  onChange(patchDetalle(detalle, { plazo_cheque: e.target.value || undefined }))
                }
              >
                <option value="">Seleccionar…</option>
                {config.plazos_cheque.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {esEcheq(detalle.tipo_cheque) ? (
          <div className="form-row venta-condicion-fields__grid">
            <div className="form-group">
              <label>Plazo</label>
              <select
                className="form-select"
                value={detalle.plazo_cheque ?? ''}
                onChange={(e) =>
                  onChange(patchDetalle(detalle, { plazo_cheque: e.target.value || undefined }))
                }
              >
                <option value="">Seleccionar…</option>
                {config.plazos_cheque.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Monto del cheque *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="form-input"
                value={montoMostrar}
                onChange={(e) => {
                  const n = parseFloat(e.target.value)
                  onChange(
                    patchDetalle(detalle, {
                      monto_cheque: Number.isFinite(n) ? n : undefined
                    })
                  )
                }}
                placeholder="0.00"
              />
            </div>
          </div>
        ) : (
          <div className="form-row venta-condicion-fields__grid">
            <div className="form-group">
              <label>Monto del cheque *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="form-input"
                value={montoMostrar}
                onChange={(e) => {
                  const n = parseFloat(e.target.value)
                  onChange(
                    patchDetalle(detalle, {
                      monto_cheque: Number.isFinite(n) ? n : undefined
                    })
                  )
                }}
                placeholder="0.00"
              />
            </div>
            <div className="form-group">
              <label>Nº cuenta del cliente</label>
              <input
                type="text"
                className="form-input"
                value={detalle.numero_cuenta_cliente ?? ''}
                onChange={(e) =>
                  onChange(
                    patchDetalle(detalle, { numero_cuenta_cliente: e.target.value || undefined })
                  )
                }
                placeholder="Cuenta bancaria del librador"
              />
            </div>
          </div>
        )}

        <div className="form-row venta-condicion-fields__grid">
          <div className="form-group">
            <label>Fecha de emisión</label>
            <input
              type="date"
              className="form-input"
              value={detalle.fecha_emision_cheque ?? ''}
              onChange={(e) =>
                onChange(patchDetalle(detalle, { fecha_emision_cheque: e.target.value || undefined }))
              }
            />
          </div>

          <div className="form-group">
            <label>Fecha de cobro</label>
            <input
              type="date"
              className="form-input"
              value={detalle.fecha_cheque ?? ''}
              onChange={(e) =>
                onChange(patchDetalle(detalle, { fecha_cheque: e.target.value || undefined }))
              }
            />
          </div>
        </div>

        {esEcheq(detalle.tipo_cheque) ? (
          <div className="form-group">
            <label>Nº cuenta del cliente</label>
            <input
              type="text"
              className="form-input"
              value={detalle.numero_cuenta_cliente ?? ''}
              onChange={(e) =>
                onChange(
                  patchDetalle(detalle, { numero_cuenta_cliente: e.target.value || undefined })
                )
              }
              placeholder="Cuenta bancaria del librador"
            />
          </div>
        ) : null}

        <div className="form-row venta-condicion-fields__grid">
          <div className="form-group">
            <label>CUIT titular</label>
            <input
              type="text"
              className="form-input"
              value={detalle.cuit_titular_cheque ?? ''}
              onChange={(e) =>
                onChange(patchDetalle(detalle, { cuit_titular_cheque: e.target.value || undefined }))
              }
              placeholder="20-12345678-9"
            />
          </div>

          <div className="form-group">
            <label>Titular del cheque</label>
            <input
              type="text"
              className="form-input"
              value={detalle.titular_cheque ?? ''}
              onChange={(e) =>
                onChange(patchDetalle(detalle, { titular_cheque: e.target.value || undefined }))
              }
              placeholder="Nombre del librador"
            />
          </div>
        </div>
      </div>
    )
  }

  if (condicion === 'Mercado Pago') {
    return (
      <div className="venta-condicion-fields venta-condicion-fields--mp">
        <p className="venta-condicion-fields__hint">
          Al confirmar la venta se generará un código QR de Mercado Pago. El comprobante del pago queda
          registrado automáticamente al aprobarse el cobro.
        </p>
      </div>
    )
  }

  return null
}

export function validarDetallePago(
  condicion: MedioPagoCodigo,
  config: ConfigCondicionesVenta,
  detalle: VentaDetallePago
): string | null {
  if (condicion === 'Transferencia') {
    if (!detalle.id_cuenta_bancaria) {
      return 'Seleccioná la cuenta bancaria de destino para la transferencia.'
    }
  }
  if (condicion === 'Cheque') {
    if (!detalle.tipo_cheque) return 'Seleccioná el tipo de cheque.'
    if (!detalle.numero_cheque?.trim()) return 'Ingresá el número de cheque.'
    if (esEcheq(detalle.tipo_cheque) && !detalle.codigo_echeq?.trim()) {
      return 'Ingresá el código eCheq.'
    }
    const monto = Number(detalle.monto_cheque)
    if (!(monto > 0)) return 'Ingresá el monto del cheque.'
  }
  if (condicion === 'Transferencia' && config.transferencia_requiere_comprobante) {
    // comprobante se valida aparte en el modal (archivo)
  }
  return null
}

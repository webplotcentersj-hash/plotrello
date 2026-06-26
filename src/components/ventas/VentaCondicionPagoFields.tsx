import { useMemo } from 'react'
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
}

function patchDetalle(prev: VentaDetallePago, patch: Partial<VentaDetallePago>): VentaDetallePago {
  return { ...prev, ...patch }
}

export default function VentaCondicionPagoFields({
  condicion,
  config,
  detalle,
  cuentasBancarias,
  onChange
}: Props) {
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
                    tipo_cheque_label: tipo?.label
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
              onChange={(e) => onChange(patchDetalle(detalle, { banco_cheque: e.target.value || undefined }))}
            >
              <option value="">Seleccionar…</option>
              {config.bancos_cheque.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-row venta-condicion-fields__grid">
          <div className="form-group">
            <label>Nº cheque / eCheq</label>
            <input
              type="text"
              className="form-input"
              value={detalle.numero_cheque ?? ''}
              onChange={(e) => onChange(patchDetalle(detalle, { numero_cheque: e.target.value || undefined }))}
              placeholder="Número"
            />
          </div>

          <div className="form-group">
            <label>Plazo</label>
            <select
              className="form-select"
              value={detalle.plazo_cheque ?? ''}
              onChange={(e) => onChange(patchDetalle(detalle, { plazo_cheque: e.target.value || undefined }))}
            >
              <option value="">Seleccionar…</option>
              {config.plazos_cheque.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-row venta-condicion-fields__grid">
          <div className="form-group">
            <label>Fecha de cobro</label>
            <input
              type="date"
              className="form-input"
              value={detalle.fecha_cheque ?? ''}
              onChange={(e) => onChange(patchDetalle(detalle, { fecha_cheque: e.target.value || undefined }))}
            />
          </div>

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
        </div>

        <div className="form-group">
          <label>Titular del cheque</label>
          <input
            type="text"
            className="form-input"
            value={detalle.titular_cheque ?? ''}
            onChange={(e) => onChange(patchDetalle(detalle, { titular_cheque: e.target.value || undefined }))}
            placeholder="Nombre del librador"
          />
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
    if (!detalle.numero_cheque?.trim()) return 'Ingresá el número de cheque o eCheq.'
  }
  if (condicion === 'Transferencia' && config.transferencia_requiere_comprobante) {
    // comprobante se valida aparte en el modal (archivo)
  }
  return null
}

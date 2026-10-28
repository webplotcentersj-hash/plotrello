import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import apiService from '../services/api'
import { formatMontoArs, parseMontoArsInput } from '../utils/cuentaCorrienteLedger'
import {
  pickProveedorVinculo,
  posicionNetaCruzada,
  type ProveedorVinculoCc
} from '../utils/ccCompensacionProveedor'
import { estadoCuentaProveedor, moneyProveedor } from '../utils/proveedorCuenta'
import { uploadAttachmentAndGetUrl } from '../utils/storage'
import type { ProveedorConFinanzas } from '../types/api'
import './CcCompensacionProveedorPanel.css'

type Props = {
  idCliente: number
  cuitCliente: string | null | undefined
  saldoCliente: number
  proveedores: ProveedorConFinanzas[]
  usuarioId: number
  usuarioNombre: string
  onDone: () => void
  onError: (msg: string) => void
  onOk: (msg: string) => void
}

export default function CcCompensacionProveedorPanel({
  idCliente,
  cuitCliente,
  saldoCliente,
  proveedores,
  usuarioId,
  usuarioNombre,
  onDone,
  onError,
  onOk
}: Props) {
  const vinculo = useMemo(
    () => pickProveedorVinculo(proveedores, cuitCliente),
    [proveedores, cuitCliente]
  )

  if (!vinculo) {
    return (
      <section className="cc-comp-panel cc-comp-panel--empty">
        <h2>Cliente y proveedor</h2>
        <p>
          No hay un proveedor con el mismo CUIT/DNI. Si este tercero también les vende, cargalo en{' '}
          <Link to="/compras/proveedores">Proveedores</Link> con el mismo documento para poder
          compensar acá.
        </p>
      </section>
    )
  }

  return (
    <CcCompensacionForm
      idCliente={idCliente}
      saldoCliente={saldoCliente}
      vinculo={vinculo}
      usuarioId={usuarioId}
      usuarioNombre={usuarioNombre}
      onDone={onDone}
      onError={onError}
      onOk={onOk}
    />
  )
}

function CcCompensacionForm({
  idCliente,
  saldoCliente,
  vinculo,
  usuarioId,
  usuarioNombre,
  onDone,
  onError,
  onOk
}: {
  idCliente: number
  saldoCliente: number
  vinculo: ProveedorVinculoCc
  usuarioId: number
  usuarioNombre: string
  onDone: () => void
  onError: (msg: string) => void
  onOk: (msg: string) => void
}) {
  const pos = posicionNetaCruzada(saldoCliente, vinculo.saldoProveedor)
  const estProv = estadoCuentaProveedor(vinculo.saldoProveedor)
  const [monto, setMonto] = useState(() =>
    pos.maxCompensable > 0 ? String(pos.maxCompensable) : ''
  )
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10))
  const [notas, setNotas] = useState('')
  const [urlComp, setUrlComp] = useState('')
  const [nombreComp, setNombreComp] = useState('')
  const [subiendo, setSubiendo] = useState(false)
  const [guardando, setGuardando] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const m = parseMontoArsInput(monto)
    if (m == null || m <= 0) {
      onError('Indicá un monto válido para la compensación.')
      return
    }
    if (m > pos.maxCompensable + 0.02) {
      onError(
        `El máximo compensable es ${formatMontoArs(pos.maxCompensable)} (mínimo entre lo que nos deben y lo que le debemos).`
      )
      return
    }
    setGuardando(true)
    try {
      const res = await apiService.registrarCompensacionCcProveedor({
        id_cliente: idCliente,
        id_proveedor: vinculo.id,
        monto: m,
        fecha,
        id_usuario: usuarioId,
        actor_nombre: usuarioNombre,
        notas: notas.trim() || undefined,
        url_comprobante: urlComp || null
      })
      if (!res.success) throw new Error(res.error || 'No se pudo registrar')
      onOk(
        `Compensación de ${formatMontoArs(m)} registrada. Ref. ${res.data?.referencia || '—'}. ` +
          `Quedó asentado en cuenta corriente y en la cuenta del proveedor.`
      )
      setNotas('')
      setUrlComp('')
      setNombreComp('')
      onDone()
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Error al compensar')
    } finally {
      setGuardando(false)
    }
  }

  const onFile = async (file: File | null) => {
    if (!file) return
    setSubiendo(true)
    try {
      const url = await uploadAttachmentAndGetUrl(file, `cuenta-corriente/${idCliente}/compensaciones`)
      setUrlComp(url)
      setNombreComp(file.name)
    } catch (err) {
      onError(err instanceof Error ? err.message : 'No se pudo subir el comprobante')
    } finally {
      setSubiendo(false)
    }
  }

  return (
    <section className="cc-comp-panel">
      <div className="cc-comp-panel__head">
        <h2>Cliente y proveedor (mismo CUIT)</h2>
        <Link
          className="cc-btn cc-btn--secondary cc-btn--sm"
          to={`/compras/deudas-proveedores?id_proveedor=${vinculo.id}`}
        >
          Ver cuenta proveedor
        </Link>
      </div>
      <p className="cc-comp-panel__lead">
        Vinculado a <strong>{vinculo.nombre}</strong>
        {vinculo.cuit ? ` · CUIT ${vinculo.cuit}` : ''}. Acá podés descontar (compensar) lo que nos
        deben como cliente contra lo que le debemos como proveedor, sin pasar por caja.
      </p>

      <div className="cc-comp-saldos">
        <article>
          <span>Nos deben (CC cliente)</span>
          <strong>{formatMontoArs(Math.max(0, saldoCliente))}</strong>
        </article>
        <article className={`cc-comp-saldos__prov cc-comp-saldos__prov--${estProv.cls}`}>
          <span>{estProv.label}</span>
          <strong>{moneyProveedor(Math.abs(vinculo.saldoProveedor))}</strong>
        </article>
        <article>
          <span>Posición neta</span>
          <strong>
            {pos.neto >= 0
              ? `A favor Plot ${formatMontoArs(pos.neto)}`
              : `A favor tercero ${formatMontoArs(Math.abs(pos.neto))}`}
          </strong>
        </article>
        <article>
          <span>Máx. a compensar</span>
          <strong>{formatMontoArs(pos.maxCompensable)}</strong>
        </article>
      </div>

      {!pos.puedeCompensar ? (
        <p className="cc-comp-panel__hint">
          Para compensar hace falta saldo a cobrar del cliente y saldo a pagar al proveedor al mismo
          tiempo.
        </p>
      ) : (
        <form className="cc-comp-form" onSubmit={(e) => void submit(e)}>
          <label>
            Monto a compensar
            <input
              type="text"
              inputMode="decimal"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              placeholder="0,00"
            />
          </label>
          <label>
            Fecha
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </label>
          <label className="cc-comp-form__full">
            Notas
            <input
              type="text"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Opcional"
            />
          </label>
          <label className="cc-comp-form__full">
            Comprobante (opcional)
            <input
              type="file"
              accept="image/*,.pdf"
              disabled={subiendo}
              onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
            />
            {nombreComp ? <span className="cc-comp-form__file">{nombreComp}</span> : null}
            {urlComp ? (
              <a href={urlComp} target="_blank" rel="noopener noreferrer">
                Ver adjunto
              </a>
            ) : null}
          </label>
          <div className="cc-comp-form__actions">
            <button
              type="button"
              className="cc-btn cc-btn--secondary"
              disabled={!pos.puedeCompensar}
              onClick={() => setMonto(String(pos.maxCompensable))}
            >
              Usar máximo
            </button>
            <button type="submit" className="cc-btn cc-btn--primary" disabled={guardando || subiendo}>
              {guardando ? 'Registrando…' : 'Registrar compensación'}
            </button>
          </div>
        </form>
      )}
    </section>
  )
}

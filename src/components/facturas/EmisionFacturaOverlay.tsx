import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { EtapaEmision, ResultadoFacturaVenta } from '../../utils/emitirFacturaDesdeVenta'
import './EmisionFacturaOverlay.css'

const PASOS: { id: EtapaEmision; titulo: string; detalle: string }[] = [
  { id: 'comprobante', titulo: 'Comprobante', detalle: 'Armando los datos de la venta' },
  { id: 'arca', titulo: 'ARCA', detalle: 'Conectando con el punto de venta' },
  { id: 'cae', titulo: 'CAE', detalle: 'Esperando la autorización' }
]

const ESPERA = [
  'Validando el comprobante…',
  'Consultando el último número…',
  'ARCA está firmando el CAE…',
  'Casi listo…'
]

function pesos(valor: number) {
  return valor.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })
}

type Props = {
  cliente: string
  total: number
  etapa: EtapaEmision
  resultado: ResultadoFacturaVenta | null
  onClose: () => void
}

export default function EmisionFacturaOverlay({ cliente, total, etapa, resultado, onClose }: Props) {
  const [pulso, setPulso] = useState(0)
  const indice = Math.max(0, PASOS.findIndex((paso) => paso.id === etapa))

  useEffect(() => {
    if (resultado) return
    const timer = window.setInterval(() => setPulso((n) => n + 1), 1700)
    return () => window.clearInterval(timer)
  }, [resultado, etapa])

  const esperando = !resultado
  const ok = resultado?.ok === true

  return createPortal(
    <div className="emision-afip" role="dialog" aria-modal="true" aria-labelledby="emision-afip-titulo">
      <div className={`emision-afip__panel${ok ? ' emision-afip__panel--ok' : ''}${resultado && !ok ? ' emision-afip__panel--error' : ''}`}>
        <div className="emision-afip__sello" aria-hidden="true">
          <span>A</span>
        </div>
        <p className="emision-afip__kicker">Factura electrónica</p>
        <h2 id="emision-afip-titulo">{ok ? 'Autorizada' : resultado ? 'No se autorizó' : 'Emitiendo'}</h2>
        <p className="emision-afip__cliente">
          {cliente}
          <strong>{pesos(total)}</strong>
        </p>

        {esperando ? (
          <>
            <ol className="emision-afip__pasos">
              {PASOS.map((paso, i) => {
                const estado = i < indice ? 'listo' : i === indice ? 'activo' : 'pendiente'
                return (
                  <li key={paso.id} className={`emision-afip__paso emision-afip__paso--${estado}`}>
                    <span className="emision-afip__marca">{i < indice ? '✓' : i + 1}</span>
                    <span>
                      <strong>{paso.titulo}</strong>
                      <small>{paso.detalle}</small>
                    </span>
                  </li>
                )
              })}
            </ol>
            <p className="emision-afip__espera">{ESPERA[pulso % ESPERA.length]}</p>
          </>
        ) : ok ? (
          <div className="emision-afip__resultado">
            <p className="emision-afip__numero">{resultado.numero || 'Comprobante emitido'}</p>
            {resultado.cae ? (
              <p className="emision-afip__cae">
                CAE <span>{resultado.cae}</span>
              </p>
            ) : null}
            <p className="emision-afip__mensaje">{resultado.mensaje}</p>
          </div>
        ) : (
          <p className="emision-afip__mensaje emision-afip__mensaje--error">{resultado?.mensaje}</p>
        )}

        {resultado ? (
          <button type="button" className="emision-afip__cerrar" onClick={onClose}>
            {ok ? 'Listo' : 'Cerrar'}
          </button>
        ) : null}
      </div>
    </div>,
    document.body
  )
}

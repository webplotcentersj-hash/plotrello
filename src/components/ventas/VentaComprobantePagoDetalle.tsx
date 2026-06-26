import { useCallback, useEffect, useState } from 'react'
import type { ComprobanteMedioParsed } from '../../features/control-cajas/comprobanteMediosTypes'
import { isComprobanteAiAvailable } from '../../features/control-cajas/parseComprobanteImagenGemini'
import apiService from '../../services/api'
import {
  extraerComprobantePagoDesdeUrl,
  resumenTextoComprobanteParsed,
  urlEsImagenComprobante,
  urlEsPdfComprobante
} from '../../utils/ventaComprobantePago'
import './VentaComprobantePagoDetalle.css'

type Props = {
  ventaId: number
  url: string
  iaInicial?: ComprobanteMedioParsed | null
  textoInicial?: string | null
  onGuardado?: (ia: ComprobanteMedioParsed, texto: string) => void
}

export default function VentaComprobantePagoDetalle({
  ventaId,
  url,
  iaInicial,
  textoInicial,
  onGuardado
}: Props) {
  const [ia, setIa] = useState<ComprobanteMedioParsed | null>(iaInicial ?? null)
  const [texto, setTexto] = useState(textoInicial?.trim() || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const extraerYGuardar = useCallback(async () => {
    if (!isComprobanteAiAvailable()) {
      setError('PlotAI no está configurado para leer comprobantes.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const parsed = await extraerComprobantePagoDesdeUrl(url)
      const resumen = resumenTextoComprobanteParsed(parsed)
      const save = await apiService.guardarComprobantePagoIaVenta(ventaId, parsed, resumen)
      if (!save.success) {
        setIa(parsed)
        setTexto(resumen)
        setError(save.error || 'No se pudo guardar la lectura en la venta.')
        onGuardado?.(parsed, resumen)
        return
      }
      setIa(parsed)
      setTexto(resumen)
      onGuardado?.(parsed, resumen)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo leer el comprobante')
    } finally {
      setLoading(false)
    }
  }, [url, ventaId, onGuardado])

  useEffect(() => {
    setIa(iaInicial ?? null)
    setTexto(textoInicial?.trim() || '')
    setError(null)
  }, [ventaId, url, iaInicial, textoInicial])

  useEffect(() => {
    if (iaInicial || textoInicial?.trim()) return
    void extraerYGuardar()
    // Solo al abrir otra venta / URL distinta
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ventaId, url])

  const esImagen = urlEsImagenComprobante(url)
  const esPdf = urlEsPdfComprobante(url)

  return (
    <div className="venta-detail-block venta-detail-block--comprobante">
      <h3 className="venta-detail-block__title">Comprobante de pago</h3>

      <div className="venta-comprobante-preview">
        {esImagen ? (
          <a href={url} target="_blank" rel="noopener noreferrer" className="venta-comprobante-preview__img-wrap">
            <img src={url} alt="Comprobante de pago" className="venta-comprobante-preview__img" />
          </a>
        ) : (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="venta-comprobante-preview__file"
          >
            {esPdf ? '📄 Abrir PDF del comprobante' : '📎 Abrir archivo del comprobante'}
          </a>
        )}
      </div>

      <div className="venta-comprobante-ia">
        <div className="venta-comprobante-ia__head">
          <strong>Lectura PlotAI</strong>
          {!loading ? (
            <button type="button" className="btn-link venta-comprobante-ia__retry" onClick={() => void extraerYGuardar()}>
              Releer
            </button>
          ) : null}
        </div>

        {loading ? (
          <p className="venta-comprobante-ia__loading">Leyendo comprobante con PlotAI…</p>
        ) : error ? (
          <p className="venta-comprobante-ia__error">{error}</p>
        ) : texto ? (
          <pre className="venta-comprobante-ia__texto">{texto}</pre>
        ) : ia ? (
          <pre className="venta-comprobante-ia__texto">{resumenTextoComprobanteParsed(ia)}</pre>
        ) : (
          <p className="venta-comprobante-ia__empty">Sin datos extraídos todavía.</p>
        )}
      </div>
    </div>
  )
}

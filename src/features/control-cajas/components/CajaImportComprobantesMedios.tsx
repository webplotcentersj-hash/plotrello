import { useRef, useState } from 'react'
import {
  getParams,
  listCajas,
  resolveCajaSlugForUsuario,
  resolveCajaSlugFromHistorial,
  saveMovimientosBulk
} from '../cajaRepository'
import { setStoredCajaSlug } from '../cajaUsuarioDisplay'
import { DEFAULT_CAJERAS } from '../constants'
import { fmtArs, fmtDateAr, montoVisibleMovimiento } from '../format'
import {
  comprobantesToMovimientos,
  resumenImportComprobantes
} from '../comprobantesMediosImport'
import type { ComprobanteLoteParsed } from '../comprobanteMediosTypes'
import {
  isComprobanteAiAvailable,
  parseComprobantesImagenes
} from '../parseComprobanteImagenGemini'
import { notifyAdminsCaja } from '../cajaNotificaciones'
import { CajaMensajeOkPlotLab } from './CajaVolverPlotLab'

type Props = {
  usuarioNombre: string
  usuarioId?: number
  onImported?: () => void
  /** Embebido en cierre de turno: no volcar hasta que el padre registre el cierre. */
  embedEnCierre?: boolean
  onPreviewChange?: (lote: ComprobanteLoteParsed | null) => void
}

export default function CajaImportComprobantesMedios({
  usuarioNombre,
  usuarioId,
  onImported,
  embedEnCierre = false,
  onPreviewChange
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [parsing, setParsing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [progress, setProgress] = useState<string | null>(null)
  const [preview, setPreview] = useState<ComprobanteLoteParsed | null>(null)
  const [thumbs, setThumbs] = useState<string[]>([])
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const iaDisponible = isComprobanteAiAvailable()

  const handleFiles = async (files: FileList | File[]) => {
    const list = Array.from(files).filter((f) =>
      /\.(jpe?g|png|webp|heic)$/i.test(f.name) || f.type.startsWith('image/')
    )
    if (!list.length) {
      setErr('Subí fotos JPG o PNG de tickets Mercado Pago, POSnet o tarjetas.')
      return
    }
    setParsing(true)
    setErr(null)
    setMsg(null)
    setPreview(null)
    setThumbs(list.map((f) => URL.createObjectURL(f)))
    setProgress(`Leyendo 0 / ${list.length} con PlotAI…`)
    try {
      const lote = await parseComprobantesImagenes(list, (done, total) => {
        setProgress(`Leyendo ${done} / ${total} con PlotAI…`)
      })
      if (!lote.comprobantes.length) {
        setErr(
          lote.warnings.join(' ') || 'No se pudo leer ningún comprobante. Revisá la iluminación de la foto.'
        )
        return
      }
      setPreview(lote)
      onPreviewChange?.(lote)
      if (lote.warnings.length) {
        setErr(lote.warnings.slice(0, 4).join(' · '))
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error al leer comprobantes')
    } finally {
      setParsing(false)
      setProgress(null)
    }
  }

  const handleImportar = async () => {
    if (!preview) return
    setSaving(true)
    setErr(null)
    setMsg(null)
    try {
      const [cajas, params] = await Promise.all([listCajas(), getParams()])
      const operativas = cajas.filter((c) => c.slug !== 'admin' && c.slug !== 'vuelto')
      const cajeras = params.cajeras?.length ? params.cajeras : DEFAULT_CAJERAS

      let cajaSlug =
        resolveCajaSlugForUsuario(usuarioNombre, operativas, cajeras, { usuarioId }) ?? ''
      if (!cajaSlug && usuarioId) {
        cajaSlug = (await resolveCajaSlugFromHistorial(usuarioId, operativas)) ?? ''
      }
      if (!cajaSlug) cajaSlug = operativas[0]?.slug ?? ''
      if (!cajaSlug) throw new Error('No se pudo determinar tu caja.')

      if (usuarioId) setStoredCajaSlug(usuarioId, cajaSlug)

      const movs = comprobantesToMovimientos(
        preview,
        cajaSlug,
        usuarioNombre,
        usuarioId,
        cajas
      )
      if (!movs.length) {
        throw new Error('No se generaron movimientos. Revisá que los tickets tengan monto aprobado.')
      }

      setProgress(`Importando 0 / ${movs.length}…`)
      const bulk = await saveMovimientosBulk(movs, {
        cajas,
        onProgress: (done, total) => setProgress(`Importando ${done} / ${total}…`)
      })

      const r = resumenImportComprobantes(movs)
      const totalVolcado = movs.reduce((s, m) => s + montoVisibleMovimiento(m), 0)
      let ok =
        `Volcado al sistema: ${r.total} movimiento(s) por $ ${fmtArs(totalVolcado)} ` +
        `(${r.tickets} cobro(s) MP/tarjeta`
      if (r.resumenes) ok += `, ${r.resumenes} línea(s) de resumen`
      if (r.egresos) ok += `, ${r.egresos} egreso(s)`
      ok += '). Revisá en Historial.'
      if (!bulk.persistedRemote && bulk.remoteError) {
        ok += ` Guardados en este navegador (${bulk.remoteError}).`
      }
      setPreview(null)
      setThumbs([])
      setMsg(ok)
      onImported?.()

      void notifyAdminsCaja({
        titulo: 'Comprobantes MP/POS volcados',
        descripcion: `${usuarioNombre} importó ${r.total} movimiento(s) por $ ${fmtArs(totalVolcado)} desde comprobantes.`,
        tipo: 'info',
        excluirUsuarioId: usuarioId
      })
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error al importar')
    } finally {
      setSaving(false)
      setProgress(null)
    }
  }

  const tipoLabel = (t: string) => {
    if (t === 'resumen_mp') return 'Resumen MP'
    if (t === 'ticket_mp') return 'Ticket MP'
    if (t === 'ticket_posnet') return 'POSnet'
    if (t === 'egreso') return 'Egreso'
    return 'Comprobante'
  }

  return (
    <section
      className={`caja-cc-planilla-import caja-cc-comprobantes-import${embedEnCierre ? ' caja-cc-comprobantes-import--embed' : ''}`}
      aria-label="Comprobantes MP y tarjetas"
    >
      {!embedEnCierre && (
        <header className="caja-cc-planilla-zone-head">
          <div>
            <h3 className="caja-cc-planilla-zone-title">Comprobantes MP · POS · tarjetas</h3>
            <p className="caja-cc-sub caja-cc-planilla-zone-lead">
              Subí fotos de tickets Mercado Pago (Point), POSnet o cierres de lote. PlotAI lee los montos y,
              al confirmar <strong>Volcar al sistema</strong>, se registran como movimientos de caja en PlotLab
              (ingresos con tarjeta/MP, visibles en Historial). No suman al conteo de billetes del arqueo.
            </p>
          </div>
        </header>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/*"
        multiple
        hidden
        onChange={(e) => {
          const fs = e.target.files
          if (fs?.length) void handleFiles(fs)
          e.target.value = ''
        }}
      />

      {!preview && (
        <button
          type="button"
          className="caja-cc-planilla-drop caja-cc-comprobantes-drop"
          disabled={parsing || !iaDisponible}
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            e.currentTarget.classList.add('drag')
          }}
          onDragLeave={(e) => e.currentTarget.classList.remove('drag')}
          onDrop={(e) => {
            e.preventDefault()
            e.currentTarget.classList.remove('drag')
            if (e.dataTransfer.files.length) void handleFiles(e.dataTransfer.files)
          }}
        >
          <span className="caja-cc-planilla-drop-icon" aria-hidden>
            📷
          </span>
          <strong>
            {parsing
              ? progress ?? 'PlotAI leyendo fotos…'
              : iaDisponible
                ? 'Subir fotos de comprobantes'
                : 'PlotAI no disponible (falta API key)'}
          </strong>
          <span className="caja-cc-planilla-drop-hint">
            Podés elegir varias: resumen del Point, tickets individuales, POSnet. Misma lógica que los
            comprobantes de egresos: la IA lee y vos confirmás antes de importar.
          </span>
        </button>
      )}

      {preview && (
        <div className="caja-cc-planilla-result caja-cc-comprobantes-result">
          <div className="caja-cc-comprobantes-preview-head">
            <h4>
              {preview.comprobantes.length} comprobante(s) leído(s) · operaciones $
              {fmtArs(preview.total_monto_operaciones)}
            </h4>
            <button
              type="button"
              className="btn-secondary btn-small"
              onClick={() => {
                setPreview(null)
                onPreviewChange?.(null)
                thumbs.forEach((u) => URL.revokeObjectURL(u))
                setThumbs([])
              }}
            >
              Cambiar fotos
            </button>
          </div>

          {thumbs.length > 0 && (
            <div className="caja-cc-comprobantes-thumbs">
              {thumbs.map((src, i) => (
                <img key={i} src={src} alt="" className="caja-cc-comprobantes-thumb" />
              ))}
            </div>
          )}

          <ul className="caja-cc-comprobantes-list">
            {preview.comprobantes.map((c, i) => (
              <li key={`${c.archivo_nombre}-${i}`} className="caja-cc-comprobantes-item">
                <span className="caja-cc-comprobantes-tipo">{tipoLabel(c.tipo)}</span>
                <strong>
                  {c.es_resumen && c.lineas_resumen.length
                    ? `Resumen — ${c.lineas_resumen.length} línea(s)`
                    : `$ ${fmtArs(c.monto)}`}
                </strong>
                <span className="caja-cc-comprobantes-meta">
                  {fmtDateAr(c.fecha)}
                  {c.hora ? ` ${c.hora}` : ''}
                  {c.operacion_numero ? ` · Op. ${c.operacion_numero}` : ''}
                  {c.marca_tarjeta ? ` · ${c.marca_tarjeta.toUpperCase()}` : ''}
                </span>
                {c.es_resumen && c.lineas_resumen.length > 0 && (
                  <ul className="caja-cc-egresos-mini-list">
                    {c.lineas_resumen.map((l, j) => (
                      <li key={j}>
                        {l.concepto}: $ {fmtArs(l.monto)}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>

          <div className="caja-cc-planilla-actions">
            {embedEnCierre ? (
              <p className="caja-cc-help caja-cc-comprobantes-volcar-hint">
                Los comprobantes se volcarán al sistema al pulsar <strong>Registrar cierre de turno</strong> y quedarán
                vinculados a este cierre para administración.
              </p>
            ) : (
              <>
                <p className="caja-cc-help caja-cc-comprobantes-volcar-hint">
                  Al volcar, cada monto aprobado del comprobante queda guardado en el sistema con fecha, operación
                  y concepto (Mercado Pago / tarjeta).
                </p>
                <button
                  type="button"
                  className="btn-primary"
                  disabled={saving}
                  onClick={() => void handleImportar()}
                >
                  {saving ? progress ?? 'Volcando al sistema…' : 'Volcar al sistema'}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {err && <p className="caja-cc-error">{err}</p>}
      {msg && (
        <CajaMensajeOkPlotLab className="caja-cc-comprobantes-done">
          <p className="caja-cc-ok">{msg}</p>
        </CajaMensajeOkPlotLab>
      )}
    </section>
  )
}

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
import { fmtArs, fmtDateAr } from '../format'
import {
  comprobantesToMovimientos,
  resumenImportComprobantes
} from '../comprobantesMediosImport'
import type { ComprobanteLoteParsed } from '../comprobanteMediosTypes'
import {
  isComprobanteAiAvailable,
  parseComprobantesImagenes
} from '../parseComprobanteImagenGemini'

type Props = {
  usuarioNombre: string
  usuarioId?: number
  onImported?: () => void
}

export default function CajaImportComprobantesMedios({
  usuarioNombre,
  usuarioId,
  onImported
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
      let ok = `Importados ${r.total} movimiento(s): ${r.tickets} cobro(s) con tarjeta/MP`
      if (r.resumenes) ok += `, ${r.resumenes} del resumen`
      if (r.egresos) ok += `, ${r.egresos} egreso(s)`
      if (!bulk.persistedRemote && bulk.remoteError) {
        ok += `. Guardados en este navegador (${bulk.remoteError}).`
      }
      setPreview(null)
      setThumbs([])
      setMsg(ok)
      onImported?.()
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
    <section className="caja-cc-planilla-import caja-cc-comprobantes-import" aria-label="Comprobantes MP y tarjetas">
      <header className="caja-cc-planilla-zone-head">
        <div>
          <h3 className="caja-cc-planilla-zone-title">Comprobantes MP · POS · tarjetas</h3>
          <p className="caja-cc-sub caja-cc-planilla-zone-lead">
            Subí fotos de tickets Mercado Pago (Point), POSnet o cierres de lote. PlotAI transcribe montos,
            operación y tarjeta, y los importa como ingresos electrónicos en tu caja (no reemplazan el
            conteo de billetes del arqueo).
          </p>
        </div>
      </header>

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
            <button
              type="button"
              className="btn-primary"
              disabled={saving}
              onClick={() => void handleImportar()}
            >
              {saving ? progress ?? 'Importando…' : 'Importar a movimientos de caja'}
            </button>
          </div>
        </div>
      )}

      {err && <p className="caja-cc-error">{err}</p>}
      {msg && <p className="caja-cc-ok">{msg}</p>}
    </section>
  )
}

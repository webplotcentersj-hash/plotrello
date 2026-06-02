import { useRef, useState } from 'react'
import { listCajas, resolveCajaSlug, saveMovimientosBulk, savePlanillaImport } from '../cajaRepository'
import { calcularTotalesDesdePlanilla } from '../cajaTotales'
import { fmtArs, fmtDateAr } from '../format'
import { parsePlanillaCajaPdf, type PlanillaCajaParsed } from '../parsePlanillaCajaPdf'
import { planillaAllToMovimientos } from '../planillaMovimientos'

type Props = {
  usuarioNombre: string
  usuarioId?: number
  onImported?: () => void
}

export default function CajaImportPlanillaPdf({ usuarioNombre, usuarioId, onImported }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [parsing, setParsing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [preview, setPreview] = useState<PlanillaCajaParsed | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [verDetalle, setVerDetalle] = useState(false)

  const handleFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setErr('Elegí un archivo PDF exportado desde PLOT CENTER.')
      return
    }
    setParsing(true)
    setMsg(null)
    setErr(null)
    setPreview(null)
    setVerDetalle(false)
    try {
      const buf = await file.arrayBuffer()
      const parsed = await parsePlanillaCajaPdf(buf, file.name)
      setPreview(parsed)
      if (!parsed.ventas.length && !parsed.egresos.length && !parsed.movimientos_mec.length) {
        setErr('No se leyeron comprobantes. Reexportá el listado desde el sistema.')
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'No se pudo leer el PDF')
    } finally {
      setParsing(false)
    }
  }

  const handleGuardar = async () => {
    if (!preview) return
    if (preview.lineas_cuadre_invalido > 0) {
      if (
        !confirm(
          `Hay ${preview.lineas_cuadre_invalido} línea(s) sin cuadrar. ¿Importar igual?`
        )
      ) {
        return
      }
    }
    setSaving(true)
    setErr(null)
    try {
      const cajas = await listCajas()
      const cajaSlug = resolveCajaSlug(preview.caja_nombre, cajas)
      await savePlanillaImport(preview, cajaSlug, usuarioNombre, usuarioId)
      const movs = planillaAllToMovimientos(preview, cajas, cajaSlug, usuarioNombre, usuarioId)
      if (movs.length) await saveMovimientosBulk(movs)

      setMsg(
        `Listo: ${preview.cantidad_ventas} ventas para el cierre, ${movs.length} movimiento(s) importados.`
      )
      setPreview(null)
      onImported?.()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const t = preview?.totales
  const resumen = preview ? calcularTotalesDesdePlanilla(preview) : null
  const egresosTotal =
    (preview?.egresos.length ?? 0) +
    (preview?.egresos_compras.length ?? 0) +
    (preview?.egresos_pagos_proveedores.length ?? 0)

  return (
    <section className="caja-cc-planilla-zone">
      <input
        ref={fileRef}
        type="file"
        accept=".pdf,application/pdf"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void handleFile(f)
          e.target.value = ''
        }}
      />

      {!preview ? (
        <button
          type="button"
          className="caja-cc-planilla-drop"
          disabled={parsing}
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            e.currentTarget.classList.add('drag')
          }}
          onDragLeave={(e) => e.currentTarget.classList.remove('drag')}
          onDrop={(e) => {
            e.preventDefault()
            e.currentTarget.classList.remove('drag')
            const f = e.dataTransfer.files?.[0]
            if (f) void handleFile(f)
          }}
        >
          <span className="caja-cc-planilla-drop-icon" aria-hidden>
            📄
          </span>
          <strong>{parsing ? 'Leyendo PDF…' : 'Subir planilla de caja (PDF)'}</strong>
          <span className="caja-cc-planilla-drop-hint">
            Exportá el listado desde PLOT CENTER y arrastralo acá o hacé clic
          </span>
        </button>
      ) : (
        <div className="caja-cc-planilla-result">
          <div className="caja-cc-planilla-result-head">
            <div>
              <h3>Planilla leída</h3>
              <p className="caja-cc-planilla-result-sub">
                {preview.caja_nombre || 'Caja'} · {fmtDateAr(preview.fecha_desde)}
                {preview.fecha_hasta !== preview.fecha_desde
                  ? ` → ${fmtDateAr(preview.fecha_hasta)}`
                  : ''}
              </p>
            </div>
            <button type="button" className="btn-secondary btn-small" onClick={() => setPreview(null)}>
              Cambiar PDF
            </button>
          </div>

          {preview.warnings.length > 0 && (
            <ul className="caja-cc-planilla-warns">
              {preview.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          )}

          <div className="caja-cc-metrics">
            <div className="caja-cc-metric">
              <span className="caja-cc-metric-l">Ventas FA/FB</span>
              <span className="caja-cc-metric-v">{preview.cantidad_ventas}</span>
            </div>
            <div className="caja-cc-metric">
              <span className="caja-cc-metric-l">Egresos EG</span>
              <span className="caja-cc-metric-v">{egresosTotal}</span>
            </div>
            <div className="caja-cc-metric">
              <span className="caja-cc-metric-l">MEC</span>
              <span className="caja-cc-metric-v">{preview.movimientos_mec.length}</span>
            </div>
            {t && (
              <>
                <div className="caja-cc-metric highlight">
                  <span className="caja-cc-metric-l">Ingresos</span>
                  <span className="caja-cc-metric-v">$ {fmtArs(t.ingresos_total)}</span>
                </div>
                <div className="caja-cc-metric">
                  <span className="caja-cc-metric-l">Egresos</span>
                  <span className="caja-cc-metric-v">$ {fmtArs(t.egresos_total)}</span>
                </div>
                <div className="caja-cc-metric highlight">
                  <span className="caja-cc-metric-l">Neto</span>
                  <span className="caja-cc-metric-v">$ {fmtArs(t.neto)}</span>
                </div>
              </>
            )}
            {preview.lineas_cuadre_invalido > 0 && (
              <div className="caja-cc-metric warn">
                <span className="caja-cc-metric-l">Sin cuadrar</span>
                <span className="caja-cc-metric-v">{preview.lineas_cuadre_invalido}</span>
              </div>
            )}
          </div>

          {resumen && (
            <p className="caja-cc-planilla-fisico">
              Efectivo físico neto: <strong>$ {fmtArs(resumen.neto.fisico_neto)}</strong>
              <span className="caja-cc-field-hint">
                {' '}
                · Tarjetas/MP: $ {fmtArs(resumen.neto.electronico_neto)}
              </span>
            </p>
          )}

          <button
            type="button"
            className="caja-cc-planilla-toggle-detail"
            onClick={() => setVerDetalle((v) => !v)}
          >
            {verDetalle ? 'Ocultar detalle' : 'Ver resumen por bloque'}
          </button>

          {verDetalle && (
            <ul className="caja-cc-planilla-bloques">
              {preview.ingresos_varios.length > 0 && (
                <li>IV — {preview.ingresos_varios.length} · $ {fmtArs(preview.ingresos_varios.reduce((s, l) => s + l.total, 0))}</li>
              )}
              {preview.ventas.length > 0 && (
                <li>Ventas — {preview.ventas.length} · $ {fmtArs(preview.ventas.reduce((s, l) => s + l.total, 0))}</li>
              )}
              {preview.ingresos_pagos_clientes.length > 0 && (
                <li>
                  IPC — {preview.ingresos_pagos_clientes.length} · ${' '}
                  {fmtArs(preview.ingresos_pagos_clientes.reduce((s, l) => s + l.total, 0))}
                </li>
              )}
              {egresosTotal > 0 && (
                <li>
                  EG — {egresosTotal} · ${' '}
                  {fmtArs(
                    [...preview.egresos, ...preview.egresos_compras, ...preview.egresos_pagos_proveedores].reduce(
                      (s, l) => s + l.total,
                      0
                    )
                  )}
                </li>
              )}
              {preview.movimientos_mec.length > 0 && (
                <li>
                  MEC — {preview.movimientos_mec.length} · ${' '}
                  {fmtArs(preview.movimientos_mec.reduce((s, l) => s + l.total, 0))}
                </li>
              )}
            </ul>
          )}

          <div className="caja-cc-planilla-actions">
            <button type="button" className="btn-primary" disabled={saving} onClick={() => void handleGuardar()}>
              {saving ? 'Importando…' : 'Importar planilla'}
            </button>
          </div>
          <p className="caja-cc-planilla-foot">
            Las ventas quedan para el <strong>cierre</strong>. Solo se crean movimientos de egresos y pases MEC.
          </p>
        </div>
      )}

      {err && <p className="caja-cc-error">{err}</p>}
      {msg && <p className="caja-cc-ok">{msg}</p>}
    </section>
  )
}

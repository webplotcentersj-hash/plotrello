import { useRef, useState } from 'react'
import { listCajas, resolveCajaSlug, saveMovimientosBulk, savePlanillaImport } from '../cajaRepository'
import { calcularTotalesDesdePlanilla } from '../cajaTotales'
import { fmtArs, fmtDateAr } from '../format'
import { isPlanillaAiAvailable } from '../planillaCajaGemini'
import { parsePlanillaCajaPdf, type PlanillaCajaParsed } from '../parsePlanillaCajaPdf'
import { planillaAllToMovimientos, resumenImportacion } from '../planillaMovimientos'
import PlanillaLineasTable from './PlanillaLineasTable'
import PlanillaMediosResumen from './PlanillaMediosResumen'

type Props = {
  usuarioNombre: string
  usuarioId?: number
  onImported?: () => void
  /** Se dispara al leer el PDF (antes de importar) para alimentar concordancia / arqueo. */
  onPlanillaParsed?: (planilla: PlanillaCajaParsed | null) => void
}

export default function CajaImportPlanillaPdf({
  usuarioNombre,
  usuarioId,
  onImported,
  onPlanillaParsed
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [parsing, setParsing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [preview, setPreview] = useState<PlanillaCajaParsed | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [verLineas, setVerLineas] = useState(true)
  const [useAi, setUseAi] = useState(() => isPlanillaAiAvailable())
  const iaDisponible = isPlanillaAiAvailable()

  const setPreviewAndNotify = (p: PlanillaCajaParsed | null) => {
    setPreview(p)
    onPlanillaParsed?.(p)
  }

  const handleFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setErr('Elegí un archivo PDF exportado desde PLOT CENTER.')
      return
    }
    setParsing(true)
    setMsg(null)
    setErr(null)
    setPreviewAndNotify(null)
    setVerLineas(true)
    try {
      const buf = await file.arrayBuffer()
      const parsed = await parsePlanillaCajaPdf(buf, file.name, { useAi })
      setPreviewAndNotify(parsed)
      const totalLineas =
        parsed.ventas.length +
        parsed.ingresos_varios.length +
        parsed.ingresos_pagos_clientes.length +
        parsed.egresos.length +
        parsed.egresos_compras.length +
        parsed.egresos_pagos_proveedores.length +
        parsed.movimientos_mec.length
      if (totalLineas === 0) {
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
      const guardada = await savePlanillaImport(preview, cajaSlug, usuarioNombre, usuarioId)
      const movs = planillaAllToMovimientos(preview, cajas, cajaSlug, usuarioNombre, usuarioId)
      if (movs.length) {
        await saveMovimientosBulk(movs)
      } else {
        throw new Error(
          'La planilla se guardó pero no se generaron movimientos. Revisá que el PDF tenga líneas FA/FB, EG o MEC con montos.'
        )
      }

      const r = resumenImportacion(movs)
      setMsg(
        `Planilla guardada (${guardada.id.slice(0, 8)}…). Subidos: ${r.ventas} ventas, ${r.ingresos - r.ventas} otros ingresos, ${r.egresos} egresos, ${r.traspasos} traspasos (${r.total} movimientos). Los datos quedan en movimientos, cierre y concordancia.`
      )
      setPreviewAndNotify(null)
      onImported?.()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const t = preview?.totales
  const resumen = preview ? calcularTotalesDesdePlanilla(preview) : null
  const egresosLineas = preview
    ? [...preview.egresos, ...preview.egresos_compras, ...preview.egresos_pagos_proveedores]
    : []
  const totalLineas = preview
    ? preview.ventas.length +
      preview.ingresos_varios.length +
      preview.ingresos_pagos_clientes.length +
      egresosLineas.length +
      preview.movimientos_mec.length
    : 0

  return (
    <section className="caja-cc-planilla-zone" aria-label="Importar planilla PDF">
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

      {!preview && (
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
          <strong>
            {parsing
              ? useAi && iaDisponible
                ? 'PlotAI está leyendo el PDF…'
                : 'Leyendo PDF…'
              : 'Subir planilla de caja (PDF)'}
          </strong>
          <span className="caja-cc-planilla-drop-hint">
            Exportá el listado desde PLOT CENTER. {iaDisponible ? 'PlotAI (Gemini) interpreta el PDF' : 'Lectura local'}{' '}
            y extrae <strong>todas</strong> las líneas (FA, FB, IV, IPC, EG, MEC) con cada medio de pago para PlotLab.
          </span>
        </button>
      )}

      {!preview && iaDisponible && (
        <label className="caja-cc-planilla-ia-toggle">
          <input type="checkbox" checked={useAi} onChange={(e) => setUseAi(e.target.checked)} />
          <span>
            <strong>Leer con PlotAI</strong> — IA interpreta tablas y columnas del PDF (recomendado)
          </span>
        </label>
      )}

      {preview && (
        <div className="caja-cc-planilla-result">
          <div className="caja-cc-planilla-result-head">
            <div>
              <h3>
                Planilla leída — {totalLineas} líneas{' '}
                <span className="caja-cc-planilla-ia-badge">
                  {preview.warnings.some((w) => w.includes('PlotAI')) ? '✨ PlotAI' : '📋 Local'}
                </span>
              </h3>
              <p className="caja-cc-planilla-result-sub">
                {preview.caja_nombre || 'Caja'} · {fmtDateAr(preview.fecha_desde)}
                {preview.fecha_hasta !== preview.fecha_desde
                  ? ` → ${fmtDateAr(preview.fecha_hasta)}`
                  : ''}
                {preview.empresa ? ` · ${preview.empresa}` : ''}
              </p>
            </div>
            <button
              type="button"
              className="btn-secondary btn-small"
              onClick={() => setPreviewAndNotify(null)}
            >
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
              <span className="caja-cc-metric-v">{preview.ventas.length}</span>
            </div>
            <div className="caja-cc-metric">
              <span className="caja-cc-metric-l">Ingresos IV</span>
              <span className="caja-cc-metric-v">{preview.ingresos_varios.length}</span>
            </div>
            <div className="caja-cc-metric">
              <span className="caja-cc-metric-l">IPC</span>
              <span className="caja-cc-metric-v">{preview.ingresos_pagos_clientes.length}</span>
            </div>
            <div className="caja-cc-metric">
              <span className="caja-cc-metric-l">Egresos EG</span>
              <span className="caja-cc-metric-v">{egresosLineas.length}</span>
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
            <>
              <p className="caja-cc-planilla-fisico">
                Efectivo físico neto: <strong>$ {fmtArs(resumen.neto.fisico_neto)}</strong>
                <span className="caja-cc-field-hint">
                  {' '}
                  · Tarjetas/MP: $ {fmtArs(resumen.neto.electronico_neto)} · Cta. cte.: $ {fmtArs(resumen.neto.cta_cte)}
                </span>
              </p>
              <PlanillaMediosResumen
                ingresos={resumen.ingresos}
                egresos={resumen.egresos}
                neto={resumen.neto}
              />
            </>
          )}

          <button
            type="button"
            className="caja-cc-planilla-toggle-detail"
            onClick={() => setVerLineas((v) => !v)}
          >
            {verLineas ? 'Ocultar todas las líneas' : `Ver las ${totalLineas} líneas del PDF`}
          </button>

          {verLineas && (
            <div className="caja-cc-planilla-lineas-all">
              <PlanillaLineasTable title="Ingresos varios (IV)" lineas={preview.ingresos_varios} />
              <PlanillaLineasTable title="Ventas (FA / FB)" lineas={preview.ventas} />
              <PlanillaLineasTable title="Pagos de clientes (IPC)" lineas={preview.ingresos_pagos_clientes} />
              <PlanillaLineasTable title="Egresos varios" lineas={preview.egresos} />
              <PlanillaLineasTable title="Compras" lineas={preview.egresos_compras} />
              <PlanillaLineasTable title="Pagos a proveedores" lineas={preview.egresos_pagos_proveedores} />
              <PlanillaLineasTable title="Movimientos entre cajas (MEC)" lineas={preview.movimientos_mec} />
            </div>
          )}

          <div className="caja-cc-planilla-actions">
            <button type="button" className="btn-primary" disabled={saving} onClick={() => void handleGuardar()}>
              {saving ? 'Importando…' : 'Importar todo al sistema'}
            </button>
          </div>
          <p className="caja-cc-planilla-foot">
            Se importan <strong>todas las líneas</strong> con desglose por medio. La planilla alimenta movimientos, el
            motor de concordancia y el cierre del día.
          </p>
        </div>
      )}

      {err && <p className="caja-cc-error">{err}</p>}
      {msg && <p className="caja-cc-ok">{msg}</p>}
    </section>
  )
}

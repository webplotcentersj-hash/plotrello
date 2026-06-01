import { useRef, useState } from 'react'
import { listCajas, resolveCajaSlug, saveMovimientosBulk, savePlanillaImport } from '../cajaRepository'
import { fmtArs, fmtDateAr } from '../format'
import {
  parsePlanillaCajaPdf,
  planillaEgresosToMovimientos,
  planillaMecToMovimientos,
  PLANILLA_LINEA_COLUMNAS,
  type PlanillaCajaParsed
} from '../parsePlanillaCajaPdf'
import { downloadPlanillaPdf } from '../exportPlanillaPdf'
import PlanillaLineasTable from './PlanillaLineasTable'

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

  const handleFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setMsg('Subí el PDF del listado «Planilla de Caja» (exportado del sistema).')
      return
    }
    setParsing(true)
    setMsg(null)
    setPreview(null)
    try {
      const buf = await file.arrayBuffer()
      const parsed = await parsePlanillaCajaPdf(buf, file.name)
      setPreview(parsed)
      if (parsed.warnings.length) {
        setMsg(parsed.warnings.join(' '))
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'No se pudo leer el PDF')
    } finally {
      setParsing(false)
    }
  }

  const handleGuardar = async () => {
    if (!preview) return
    setSaving(true)
    setMsg(null)
    try {
      const cajas = await listCajas()
      const cajaSlug = resolveCajaSlug(preview.caja_nombre, cajas)
      await savePlanillaImport(preview, cajaSlug, usuarioNombre, usuarioId)

      const movsMec = planillaMecToMovimientos(preview, cajas, usuarioNombre, usuarioId)
      const movsEg = planillaEgresosToMovimientos(preview, cajas, cajaSlug, usuarioNombre, usuarioId)
      const movs = [...movsMec, ...movsEg]
      if (movs.length) {
        await saveMovimientosBulk(movs)
      }

      setMsg(
        `Planilla guardada (${preview.archivo_nombre}).` +
          (movsMec.length ? ` ${movsMec.length} MEC.` : '') +
          (movsEg.length ? ` ${movsEg.length} egreso(s) EG.` : '') +
          (preview.cantidad_ventas ? ` ${preview.cantidad_ventas} ventas FA/FB en planilla.` : '')
      )
      setPreview(null)
      onImported?.()
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const t = preview?.totales

  return (
    <div className="caja-cc-card caja-cc-planilla-import">
      <div className="caja-cc-card-head-row">
        <div>
          <h3>Planilla de caja (PDF)</h3>
          <p className="caja-cc-sub">
            Subí el <strong>Listado de Planilla de Caja</strong> de PLOT CENTER (mismo PDF del mail diario).
            Columnas: Comprobante, Concepto, Total, Cta. cte., Efectivo, cheques, Tarjetas, Docum., C.
            contab., Trans. B. y Otros.
          </p>
        </div>
        <div className="caja-cc-page-actions">
          <button
            type="button"
            className="btn-primary"
            disabled={parsing}
            onClick={() => fileRef.current?.click()}
          >
            {parsing ? 'Leyendo PDF…' : 'Subir PDF planilla'}
          </button>
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
        </div>
      </div>

      {msg && <p className="caja-cc-help">{msg}</p>}

      {preview && (
        <div className="caja-cc-planilla-preview">
          <div className="caja-cc-planilla-meta">
            <span>
              <strong>{preview.caja_nombre || '—'}</strong>
            </span>
            <span>
              {fmtDateAr(preview.fecha_desde)} → {fmtDateAr(preview.fecha_hasta)}
            </span>
            <span>{preview.cantidad_ventas} ventas FA/FB</span>
            <span>{preview.egresos.length} egresos EG</span>
            <span>{preview.movimientos_mec.length} MEC</span>
          </div>

          {t && (
            <table className="caja-cc-table caja-cc-planilla-totales">
              <thead>
                <tr>
                  <th />
                  <th className="num">Total</th>
                  <th className="num">Cta. cte.</th>
                  <th className="num">Efectivo</th>
                  <th className="num">Tarjetas</th>
                  <th className="num">Trans. B.</th>
                  <th className="num">Otros</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Ingresos</td>
                  <td className="num">$ {fmtArs(t.ingresos_total)}</td>
                  <td className="num">$ {fmtArs(t.ingresos_cta_cte)}</td>
                  <td className="num">$ {fmtArs(t.ingresos_efectivo)}</td>
                  <td className="num">$ {fmtArs(t.ingresos_tarjetas)}</td>
                  <td className="num">$ {fmtArs(t.ingresos_trans_b)}</td>
                  <td className="num">$ {fmtArs(t.ingresos_otros)}</td>
                </tr>
                <tr>
                  <td>Egresos</td>
                  <td className="num">$ {fmtArs(t.egresos_total)}</td>
                  <td className="num">$ {fmtArs(t.egresos_cta_cte)}</td>
                  <td className="num">$ {fmtArs(t.egresos_efectivo)}</td>
                  <td className="num">$ {fmtArs(t.egresos_tarjetas)}</td>
                  <td className="num">$ {fmtArs(t.egresos_trans_b)}</td>
                  <td className="num">$ {fmtArs(t.egresos_otros)}</td>
                </tr>
                <tr className="caja-cc-row-neto">
                  <td>Ingresos − Egresos</td>
                  <td className="num" colSpan={6}>
                    <strong>$ {fmtArs(t.neto)}</strong>
                  </td>
                </tr>
              </tbody>
            </table>
          )}

          <p className="caja-cc-help caja-cc-planilla-cols-hint">
            Columnas por línea (como en el PDF):{' '}
            {PLANILLA_LINEA_COLUMNAS.map((c) => c.label).join(' · ')}
          </p>

          <PlanillaLineasTable title="Ingresos ventas (FA / FB)" lineas={preview.ventas} />
          <PlanillaLineasTable title="Egresos (EG)" lineas={preview.egresos} maxRows={15} />
          <PlanillaLineasTable title="Movimientos entre cajas (MEC)" lineas={preview.movimientos_mec} maxRows={10} />

          <div className="caja-cc-actions">
            <button type="button" className="btn-secondary" onClick={() => setPreview(null)}>
              Cancelar
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => downloadPlanillaPdf(preview, preview.caja_nombre)}
            >
              Descargar PDF
            </button>
            <button type="button" className="btn-primary" disabled={saving} onClick={() => void handleGuardar()}>
              {saving ? 'Guardando…' : 'Guardar planilla y movimientos'}
            </button>
          </div>
          <p className="caja-cc-help">
            Al guardar se importan como movimientos los <strong>MEC</strong> y los <strong>EG</strong> (egresos).
            Las ventas FA/FB quedan en la planilla para cierre y conciliación.
          </p>
        </div>
      )}
    </div>
  )
}

import { useRef, useState } from 'react'
import { listCajas, resolveCajaSlug, saveMovimientosBulk, savePlanillaImport } from '../cajaRepository'
import { calcularTotalesDesdePlanilla } from '../cajaTotales'
import { fmtArs, fmtDateAr } from '../format'
import { parsePlanillaCajaPdf, PLANILLA_LINEA_COLUMNAS, type PlanillaCajaParsed } from '../parsePlanillaCajaPdf'
import { planillaAllToMovimientos } from '../planillaMovimientos'
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
      setMsg('Subí el PDF del listado «Planilla de Caja» (exportado del sistema PLOT CENTER).')
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
    if (preview.lineas_cuadre_invalido > 0) {
      if (
        !confirm(
          `Hay ${preview.lineas_cuadre_invalido} línea(s) donde Total ≠ suma de medios. ¿Guardar igual?`
        )
      ) {
        return
      }
    }
    setSaving(true)
    setMsg(null)
    try {
      const cajas = await listCajas()
      const cajaSlug = resolveCajaSlug(preview.caja_nombre, cajas)
      await savePlanillaImport(preview, cajaSlug, usuarioNombre, usuarioId)

      const movs = planillaAllToMovimientos(preview, cajas, cajaSlug, usuarioNombre, usuarioId)
      if (movs.length) {
        await saveMovimientosBulk(movs)
      }

      setMsg(
        `Planilla guardada (${preview.archivo_nombre}). ${movs.length} movimiento(s) importados. ${preview.cantidad_ventas} ventas FA/FB en planilla para cierre.`
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
  const resumen = preview ? calcularTotalesDesdePlanilla(preview) : null

  return (
    <div className="caja-cc-card caja-cc-planilla-import">
      <div className="caja-cc-card-head-row">
        <div>
          <h3>Planilla de caja (PDF)</h3>
          <p className="caja-cc-sub">
            Listado <strong>PLOT CENTER</strong>: bloques Ingresos (Varios, Ventas FA/FB, Pagos clientes), Egresos,
            MEC entre cajas y <strong>Totales de caja</strong>. Cada línea valida: Total = Cta.Cte + Efectivo + cheques
            + Tarjetas + Trans.B + Otros.
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
              <strong>{preview.empresa}</strong> · {preview.caja_nombre || '—'}
            </span>
            <span>
              {fmtDateAr(preview.fecha_desde)} → {fmtDateAr(preview.fecha_hasta)}
            </span>
            <span>{preview.cantidad_ventas} ventas FA/FB</span>
            <span>{preview.egresos.length + preview.egresos_compras.length} egresos EG</span>
            <span>{preview.movimientos_mec.length} MEC</span>
            {preview.lineas_cuadre_invalido > 0 && (
              <span className="caja-cc-tag bad">{preview.lineas_cuadre_invalido} líneas sin cuadrar</span>
            )}
          </div>

          {resumen && (
            <p className="caja-cc-sub">
              Físico neto (efectivo+cheques+doc): $ {fmtArs(resumen.neto.fisico_neto)} · Electrónico: ${' '}
              {fmtArs(resumen.neto.electronico_neto)} · Contable (cta.cte): $ {fmtArs(resumen.neto.contable_neto)}
            </p>
          )}

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
                  <td className="num">
                    <strong>$ {fmtArs(t.neto)}</strong>
                  </td>
                  <td className="num">
                    $ {fmtArs(t.neto_por_columna?.cta_cte ?? resumen?.neto.cta_cte ?? 0)}
                  </td>
                  <td className="num">
                    $ {fmtArs(t.neto_por_columna?.efectivo ?? resumen?.neto.efectivo ?? 0)}
                  </td>
                  <td className="num">
                    $ {fmtArs(t.neto_por_columna?.tarjetas ?? resumen?.neto.tarjetas ?? 0)}
                  </td>
                  <td className="num">
                    $ {fmtArs(t.neto_por_columna?.trans_b ?? resumen?.neto.trans_b ?? 0)}
                  </td>
                  <td className="num">—</td>
                </tr>
              </tbody>
            </table>
          )}

          <p className="caja-cc-help caja-cc-planilla-cols-hint">
            Columnas por línea: {PLANILLA_LINEA_COLUMNAS.map((c) => c.label).join(' · ')}
          </p>

          <PlanillaLineasTable title="Ingresos varios (IV)" lineas={preview.ingresos_varios} />
          <PlanillaLineasTable title="Ingresos ventas (FA / FB)" lineas={preview.ventas} />
          <PlanillaLineasTable title="Ingresos pagos clientes (IPC)" lineas={preview.ingresos_pagos_clientes} />
          <PlanillaLineasTable title="Egresos varios (EG)" lineas={preview.egresos} maxRows={15} />
          <PlanillaLineasTable title="Egresos compras" lineas={preview.egresos_compras} maxRows={10} />
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
            Las ventas FA/FB quedan en la planilla para el <strong>cierre</strong> (ingresos por medio). Se importan
            MEC y EG como movimientos con desglose JSON de medios de pago.
          </p>
        </div>
      )}
    </div>
  )
}

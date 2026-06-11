import { useEffect, useRef, useState } from 'react'
import { getArgentinaDateString } from '../../../utils/dateUtils'
import {
  getParams,
  getPlanillaById,
  listCajas,
  listPlanillas,
  planillaYaImportada,
  resolveCajaSlug,
  resolveCajaSlugForUsuario,
  resolveCajaSlugFromHistorial,
  saveMovimientosBulk,
  savePlanillaImport
} from '../cajaRepository'
import { setStoredCajaSlug } from '../cajaUsuarioDisplay'
import { DEFAULT_CAJERAS } from '../constants'
import {
  calcularTotalesDesdePlanilla,
  efectivoQuedaEnCajaDesdePlanilla,
  netoCtaCteDesdePlanilla
} from '../cajaTotales'
import { fmtArs, fmtDateAr } from '../format'
import { countPlanillaLineas, isPlanillaAiAvailable, mergePlanillaPreferComplete } from '../planillaCajaGemini'
import {
  parsePlanillaCajaPdf,
  parsePlanillaCajaPdfLocal,
  type PlanillaCajaParsed
} from '../parsePlanillaCajaPdf'
import { fechaPlanillaImport, planillaAllToMovimientos, resumenImportacion } from '../planillaMovimientos'
import { syncEgresosSolicitudesDesdePlanilla } from '../planillaEgresosSync'
import PlanillaLineasTable from './PlanillaLineasTable'
import PlanillaMediosResumen from './PlanillaMediosResumen'
import { CajaMensajeOkPlotLab } from './CajaVolverPlotLab'

type Props = {
  usuarioNombre: string
  usuarioId?: number
  onImported?: () => void
  /** Se dispara al leer el PDF (antes de importar) para alimentar concordancia / arqueo. */
  onPlanillaParsed?: (planilla: PlanillaCajaParsed | null) => void
  /** Vista reducida para embeber en Nuevo cierre. */
  compact?: boolean
  /** Solo leer PDF; la importación al sistema la hace el cierre de turno. */
  deferImport?: boolean
  /** En Mi arqueo: el PDF documenta el efectivo que queda en caja. */
  modoArqueo?: boolean
}

export default function CajaImportPlanillaPdf({
  usuarioNombre,
  usuarioId,
  onImported,
  onPlanillaParsed,
  compact = false,
  deferImport = false,
  modoArqueo = false
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [parsing, setParsing] = useState(false)
  const [parsingEtapa, setParsingEtapa] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [importProgress, setImportProgress] = useState<string | null>(null)
  const [preview, setPreview] = useState<PlanillaCajaParsed | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [verLineas, setVerLineas] = useState(true)
  const [lineSearch, setLineSearch] = useState('')
  const [useAi, setUseAi] = useState(() => isPlanillaAiAvailable())
  const [importLocked, setImportLocked] = useState(false)
  const restoredPlanillaRef = useRef(false)
  const iaDisponible = isPlanillaAiAvailable()

  useEffect(() => {
    if (!modoArqueo || restoredPlanillaRef.current || preview) return
    restoredPlanillaRef.current = true
    void (async () => {
      const hoy = getArgentinaDateString()
      const list = await listPlanillas(40)
      const match = list.find(
        (p) =>
          (p.fecha_hasta === hoy || p.fecha_desde === hoy) &&
          (usuarioId == null || p.id_usuario == null || p.id_usuario === usuarioId)
      )
      if (!match) return
      const full = await getPlanillaById(match.id)
      if (!full) return
      setPreviewAndNotify(full)
      setImportLocked(true)
      setMsg(`Planilla del día ya importada (${match.archivo_nombre}). Completá el conteo de billetes abajo.`)
    })()
  }, [modoArqueo, usuarioId, preview])

  const setPreviewAndNotify = (p: PlanillaCajaParsed | null) => {
    setPreview(p)
    onPlanillaParsed?.(p)
  }

  const resolverCajaSlugPlanilla = async (parsed: PlanillaCajaParsed): Promise<string | null> => {
    const [cajas, params] = await Promise.all([listCajas(), getParams()])
    const operativas = cajas.filter((c) => c.slug !== 'admin' && c.slug !== 'vuelto')
    const cajeras = params.cajeras?.length ? params.cajeras : DEFAULT_CAJERAS
    let cajaSlug =
      resolveCajaSlug(parsed.caja_nombre, cajas) ??
      resolveCajaSlugForUsuario(usuarioNombre, operativas, cajeras, { usuarioId }) ??
      null
    if (!cajaSlug && usuarioId) {
      cajaSlug = (await resolveCajaSlugFromHistorial(usuarioId, operativas)) ?? null
    }
    return cajaSlug ?? operativas[0]?.slug ?? null
  }

  const handleFile = async (file: File) => {
    if (importLocked) {
      setErr('Esta planilla ya fue importada. Continuá con el conteo de billetes abajo.')
      return
    }
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setErr('Elegí un archivo PDF exportado desde PLOT CENTER.')
      return
    }
    setParsing(true)
    setParsingEtapa(null)
    setMsg(null)
    setErr(null)
    setPreviewAndNotify(null)
    setVerLineas(true)
    setLineSearch('')
    try {
      const buf = (await file.arrayBuffer()).slice(0)
      let parsed: PlanillaCajaParsed

      if (useAi && iaDisponible) {
        setParsingEtapa('Lectura rápida local…')
        const local = await parsePlanillaCajaPdfLocal(buf, file.name)
        if (countPlanillaLineas(local) > 0) {
          setPreviewAndNotify(local)
        }
        setParsingEtapa('PlotAI extrayendo datos…')
        parsed = await parsePlanillaCajaPdf(buf, file.name, { useAi: true })
        if (countPlanillaLineas(local) > 0) {
          parsed = mergePlanillaPreferComplete(parsed, local)
        }
      } else {
        setParsingEtapa('Leyendo PDF…')
        parsed = await parsePlanillaCajaPdf(buf, file.name, { useAi: false })
      }

      const cajaSlug = await resolverCajaSlugPlanilla(parsed)
      const duplicada = await planillaYaImportada(parsed, cajaSlug)
      if (duplicada) {
        setErr(
          `«${parsed.archivo_nombre}» ya está importada para este día. No podés subir el mismo PDF otra vez.`
        )
        if (modoArqueo) {
          setPreviewAndNotify(parsed)
          setImportLocked(true)
        }
        return
      }

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
      setParsingEtapa(null)
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
    if (importLocked) {
      setErr('Esta planilla ya fue importada.')
      return
    }
    setSaving(true)
    setErr(null)
    setImportProgress(null)
    try {
      const [cajas] = await Promise.all([listCajas()])
      const cajaSlug = await resolverCajaSlugPlanilla(preview)
      if (!cajaSlug) {
        throw new Error('No se pudo determinar la caja. Revisá Maestros → Cajeras o el nombre en el PDF.')
      }
      if (await planillaYaImportada(preview, cajaSlug)) {
        throw new Error(`«${preview.archivo_nombre}» ya está importada. No podés importar el mismo PDF otra vez.`)
      }
      if (usuarioId) setStoredCajaSlug(usuarioId, cajaSlug)

      setImportProgress('Guardando planilla…')
      const guardada = await savePlanillaImport(preview, cajaSlug, usuarioNombre, usuarioId)
      const movs = planillaAllToMovimientos(preview, cajas, cajaSlug, usuarioNombre, usuarioId)
      if (!movs.length) {
        throw new Error(
          'La planilla se guardó pero no se generaron movimientos. Revisá que el PDF tenga líneas FA/FB, EG o MEC con montos.'
        )
      }

      setImportProgress(`Importando 0 / ${movs.length} movimientos…`)
      const bulk = await saveMovimientosBulk(movs, {
        cajas,
        onProgress: (done, total) => setImportProgress(`Importando ${done} / ${total} movimientos…`)
      })

      const r = resumenImportacion(movs)
      const efectivoQ = efectivoQuedaEnCajaDesdePlanilla(preview)
      const egresosSol = await syncEgresosSolicitudesDesdePlanilla({
        planilla: preview,
        cajaSlug,
        fecha: fechaPlanillaImport(preview),
        usuarioNombre,
        usuarioId,
        movimientos: bulk.records
      })
      const ctaCte = netoCtaCteDesdePlanilla(preview)
      let okMsg = `Planilla guardada (${guardada.id.slice(0, 8)}…). Importados: ${r.total} movimientos (${r.ventas} ventas, ${r.egresos} egresos, ${r.traspasos} traspasos) en ${cajas.find((c) => c.slug === cajaSlug)?.nombre ?? cajaSlug}.`
      if (egresosSol > 0) {
        okMsg += ` ${egresosSol} egreso(s) registrados (efectivo + tarjetas) en la sección Egresos.`
      }
      if (Math.abs(ctaCte) > 0) {
        okMsg += ` Cta. cte. neta: $ ${fmtArs(ctaCte)} (ver en Nuevo cierre → Paso 5).`
      }
      if (modoArqueo && efectivoQ > 0) {
        okMsg += ` Efectivo que queda: $ ${fmtArs(efectivoQ)} — contá billetes abajo.`
      }
      if (!bulk.persistedRemote && bulk.remoteError) {
        okMsg += ` Quedaron en este navegador (servidor: ${bulk.remoteError}).`
      } else if (!bulk.persistedRemote) {
        okMsg += ' Guardados en este navegador.'
      }

      if (modoArqueo) {
        onPlanillaParsed?.(preview)
        setImportLocked(true)
      } else {
        setPreviewAndNotify(null)
      }
      setMsg(okMsg)
      onImported?.()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error al guardar')
      setMsg(null)
    } finally {
      setSaving(false)
      setImportProgress(null)
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

  const qLine = lineSearch.trim()
  const lineasCoinciden = (arr: { comprobante: string; concepto: string }[]) =>
    !qLine ||
    arr.some(
      (row) =>
        row.comprobante.toLowerCase().includes(qLine.toLowerCase()) ||
        row.concepto.toLowerCase().includes(qLine.toLowerCase())
    )
  const hayCoincidenciasLineas =
    !qLine ||
    lineasCoinciden(preview?.ingresos_varios ?? []) ||
    lineasCoinciden(preview?.ventas ?? []) ||
    lineasCoinciden(preview?.ingresos_pagos_clientes ?? []) ||
    lineasCoinciden(preview?.egresos ?? []) ||
    lineasCoinciden(preview?.egresos_compras ?? []) ||
    lineasCoinciden(preview?.egresos_pagos_proveedores ?? []) ||
    lineasCoinciden(preview?.movimientos_mec ?? [])

  return (
    <section
      className={`caja-cc-planilla-zone caja-cc-planilla-import${compact ? ' caja-cc-planilla-import--compact' : ''}`}
      aria-label="Importar planilla PDF"
    >
      {!compact && (
        <header className="caja-cc-planilla-zone-head">
          <div>
            <h3 className="caja-cc-planilla-zone-title">Planilla PDF · PLOT CENTER</h3>
            <p className="caja-cc-sub caja-cc-planilla-zone-lead">
              {modoArqueo
                ? 'Subí el PDF del día: la columna Efectivo indica cuánto queda en caja. Contá billetes contra ese monto.'
                : 'Importá el listado exportado: ventas, ingresos, egresos y MEC con medios de pago para movimientos y cierre.'}
            </p>
          </div>
        </header>
      )}
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

      {importLocked && !preview && (
        <p className="caja-cc-help caja-cc-planilla-locked">
          La planilla del día ya fue importada. Completá el conteo de billetes en el formulario de arqueo.
        </p>
      )}

      {!preview && !importLocked && (
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
              ? parsingEtapa ?? (useAi && iaDisponible ? 'PlotAI…' : 'Leyendo PDF…')
              : 'Subir planilla de caja (PDF)'}
          </strong>
          <span className="caja-cc-planilla-drop-hint">
            {modoArqueo ? (
              <>
                Exportá el listado desde PLOT CENTER. PlotLab lee el <strong>efectivo que queda</strong> para que lo
                compares con tu conteo de billetes.
              </>
            ) : (
              <>
                Exportá el listado desde PLOT CENTER. {iaDisponible ? 'PlotAI (Gemini) interpreta el PDF' : 'Lectura local'}{' '}
                y extrae <strong>todas</strong> las líneas (FA, FB, IV, IPC, EG, MEC) con cada medio de pago para PlotLab.
              </>
            )}
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
            {!importLocked && (
              <button
                type="button"
                className="btn-secondary btn-small"
                onClick={() => setPreviewAndNotify(null)}
              >
                Cambiar PDF
              </button>
            )}
            {importLocked && (
              <span className="caja-cc-planilla-imported-badge">Importada</span>
            )}
          </div>

          {preview.warnings.length > 0 && (
            <ul className="caja-cc-planilla-warns">
              {preview.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          )}

          <div className="caja-cc-metrics caja-cc-metrics--counts">
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
            {preview.lineas_cuadre_invalido > 0 && (
              <div className="caja-cc-metric warn">
                <span className="caja-cc-metric-l">Sin cuadrar</span>
                <span className="caja-cc-metric-v">{preview.lineas_cuadre_invalido}</span>
              </div>
            )}
          </div>
          {t && (
            <div className="caja-cc-metrics caja-cc-metrics--money">
              <div className="caja-cc-metric highlight">
                <span className="caja-cc-metric-l">Ingresos</span>
                <span className="caja-cc-metric-v money">$ {fmtArs(t.ingresos_total)}</span>
              </div>
              <div className="caja-cc-metric">
                <span className="caja-cc-metric-l">Egresos</span>
                <span className="caja-cc-metric-v money">$ {fmtArs(t.egresos_total)}</span>
              </div>
              <div className="caja-cc-metric highlight">
                <span className="caja-cc-metric-l">Neto</span>
                <span className="caja-cc-metric-v money">$ {fmtArs(t.neto)}</span>
              </div>
            </div>
          )}

          {resumen && (
            <>
              <p className="caja-cc-planilla-fisico">
                {modoArqueo ? (
                  <>
                    Efectivo para arqueo (columna <strong>Efectivo</strong>, fila Neto del PDF):{' '}
                    <strong>$ {fmtArs(efectivoQuedaEnCajaDesdePlanilla(preview))}</strong>
                  </>
                ) : (
                  <>
                    Efectivo neto (arqueo): <strong>$ {fmtArs(efectivoQuedaEnCajaDesdePlanilla(preview))}</strong>
                    <span className="caja-cc-field-hint">
                      {' '}
                      · Tarjetas/MP: $ {fmtArs(resumen.neto.electronico_neto)} · Cta. cte. neta: $ {fmtArs(netoCtaCteDesdePlanilla(preview))}
                      {' '}
                      (va al cierre del día)
                    </span>
                  </>
                )}
              </p>
              <PlanillaMediosResumen
                ingresos={resumen.ingresos}
                egresos={resumen.egresos}
                neto={resumen.neto}
              />
            </>
          )}

          <div className="caja-cc-planilla-lineas-toolbar">
            <button
              type="button"
              className="caja-cc-planilla-toggle-detail"
              onClick={() => setVerLineas((v) => !v)}
            >
              {verLineas ? 'Ocultar todas las líneas' : `Ver las ${totalLineas} líneas del PDF`}
            </button>
            {verLineas && (
              <label className="caja-cc-search caja-cc-search--inline">
                <span className="caja-cc-search-icon" aria-hidden>
                  ⌕
                </span>
                <input
                  type="search"
                  className="caja-cc-search-input"
                  placeholder="Buscar comprobante o concepto…"
                  value={lineSearch}
                  onChange={(e) => setLineSearch(e.target.value)}
                  aria-label="Buscar en líneas del PDF"
                />
              </label>
            )}
          </div>

          {verLineas && (
            <div className="caja-cc-planilla-lineas-all">
              {!hayCoincidenciasLineas ? (
                <p className="caja-cc-empty">Ninguna línea coincide con «{qLine}».</p>
              ) : (
                <>
                  <PlanillaLineasTable
                    title="Ingresos varios (IV)"
                    lineas={preview.ingresos_varios}
                    searchQuery={lineSearch}
                  />
                  <PlanillaLineasTable title="Ventas (FA / FB)" lineas={preview.ventas} searchQuery={lineSearch} />
                  <PlanillaLineasTable
                    title="Pagos de clientes (IPC)"
                    lineas={preview.ingresos_pagos_clientes}
                    searchQuery={lineSearch}
                  />
                  <PlanillaLineasTable title="Egresos varios" lineas={preview.egresos} searchQuery={lineSearch} />
                  <PlanillaLineasTable title="Compras" lineas={preview.egresos_compras} searchQuery={lineSearch} />
                  <PlanillaLineasTable
                    title="Pagos a proveedores"
                    lineas={preview.egresos_pagos_proveedores}
                    searchQuery={lineSearch}
                  />
                  <PlanillaLineasTable
                    title="Movimientos entre cajas (MEC)"
                    lineas={preview.movimientos_mec}
                    searchQuery={lineSearch}
                  />
                </>
              )}
            </div>
          )}

          {!deferImport && !importLocked && (
            <div className="caja-cc-planilla-actions">
              <button type="button" className="btn-primary" disabled={saving} onClick={() => void handleGuardar()}>
                {saving ? importProgress ?? 'Importando…' : 'Importar todo al sistema'}
              </button>
              {saving && importProgress && (
                <p className="caja-cc-help" role="status">
                  {importProgress}
                </p>
              )}
            </div>
          )}
          {deferImport ? (
            <p className="caja-cc-planilla-foot">
              La planilla quedará vinculada al <strong>Registrar cierre de turno</strong> (movimientos + detalle para
              administración).
            </p>
          ) : (
            <p className="caja-cc-planilla-foot">
              Se importan <strong>todas las líneas</strong> con desglose por medio. La planilla alimenta movimientos, el
              motor de concordancia y el cierre del día.
            </p>
          )}
        </div>
      )}

      {err && <p className="caja-cc-error">{err}</p>}
      {msg && (
        <CajaMensajeOkPlotLab>
          <p className="caja-cc-ok">{msg}</p>
        </CajaMensajeOkPlotLab>
      )}
    </section>
  )
}

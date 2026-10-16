import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import apiService from '../../../services/api'
import { getArgentinaDateString } from '../../../utils/dateUtils'
import type { NormalizedMovement } from '../../conciliacion-mp/domain/types'
import {
  listWorkbookSheetNames,
  readSheetRows
} from '../../conciliacion-mp/parsers/spreadsheetCore'
import { normalizeBankRows, normalizeMercadoPagoRows } from '../../conciliacion-mp/parsers/normalizeMovements'
import {
  cruzarPorMonto,
  esCobroExtractoMp,
  esIngresoExtractoBanco,
  fechaIsoDia
} from '../cajaConcilCanal'
import { labelFuenteSistema, sistemaBancoParaFecha, sistemaMpParaFecha } from '../cajaDashboardData'
import { cobrosPorCanalDia, ventasMpPagadasIds } from '../conciliacionDiaCaja'
import { fmtArs, fmtDateAr, parseNum } from '../format'
import { sincronizarVentasPlotLabRango } from '../plotlabVentaCajaSync'
import {
  getParams,
  listCierres,
  listConcilBanco,
  listConcilMP,
  listMovimientosPorFecha,
  listPlanillas,
  saveConcilBanco,
  saveConcilMP
} from '../cajaRepository'
import type { CajaCierreEstado, CajaMovimiento } from '../types'
import CajaBadge from './CajaBadge'
import CajaVolverPlotLab from './CajaVolverPlotLab'

export type CajaConcilCanal = 'mp' | 'banco'

type Props = {
  canal: CajaConcilCanal
  usuarioId?: number
}

const COPY = {
  mp: {
    sub: 'Cobros Mercado Pago del día (PlotLab / caja) vs actividad de la app. No mezcla tarjetas POS.',
    extraLabel: 'Dashboard MP',
    extraTag: 'app MP',
    extraHint: 'Total de cobros del Excel o el que ves en Mercado Pago.',
    fileLabel: 'Excel / CSV de actividad Mercado Pago',
    fullHref: '/compras/conciliacion-mercadopago',
    fullLabel: 'Cruce MP ↔ banco (línea a línea)',
    saveOk: 'Conciliación MP guardada.',
    saveNeed: 'Ingresá el monto del dashboard o subí el Excel de actividad.',
    canalCobro: 'mercado_pago' as const
  },
  banco: {
    sub: 'Transferencias cobradas en caja vs acreditaciones del extracto bancario.',
    extraLabel: 'Extracto banco',
    extraTag: 'homebanking',
    extraHint: 'Suma de acreditaciones del día en el Excel, o el total que ves en el banco.',
    fileLabel: 'Excel / CSV del extracto bancario',
    fullHref: '/compras/conciliacion-bancaria',
    fullLabel: 'Conciliación bancaria completa',
    saveOk: 'Conciliación bancaria guardada.',
    saveNeed: 'Ingresá el monto del extracto o subí el Excel del banco.',
    canalCobro: 'transferencia' as const
  }
}

function parseExtracto(ab: ArrayBuffer, canal: CajaConcilCanal): NormalizedMovement[] {
  const sheets = listWorkbookSheetNames(ab)
  if (canal === 'mp') {
    const mp = sheets.flatMap((s) => normalizeMercadoPagoRows(readSheetRows(ab, s), s))
    if (mp.length) return mp
    return sheets.flatMap((s) => normalizeBankRows(readSheetRows(ab, s), s, true))
  }
  const bank = sheets.flatMap((s) => normalizeBankRows(readSheetRows(ab, s), s, true))
  if (bank.length) return bank
  return sheets.flatMap((s) => normalizeMercadoPagoRows(readSheetRows(ab, s), s))
}

function esLineaComparable(row: NormalizedMovement, canal: CajaConcilCanal): boolean {
  if (canal === 'mp') return esCobroExtractoMp(row.classification || row.subtipo || '', row.importeNeto)
  return esIngresoExtractoBanco(row.importeNeto)
}

export default function CajaSectionConcilCanal({ canal, usuarioId }: Props) {
  const copy = COPY[canal]
  const [historial, setHistorial] = useState<
    Awaited<ReturnType<typeof listConcilMP>> | Awaited<ReturnType<typeof listConcilBanco>>
  >([])
  const [cierres, setCierres] = useState<Awaited<ReturnType<typeof listCierres>>>([])
  const [planillas, setPlanillas] = useState<Awaited<ReturnType<typeof listPlanillas>>>([])
  const [movimientos, setMovimientos] = useState<CajaMovimiento[]>([])
  const [fecha, setFecha] = useState(getArgentinaDateString())
  const [extra, setExtra] = useState('')
  const [extraManual, setExtraManual] = useState(false)
  const [observacion, setObservacion] = useState('')
  const [tolerancia, setTolerancia] = useState(0)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [fileRows, setFileRows] = useState<NormalizedMovement[]>([])
  const [fileError, setFileError] = useState<string | null>(null)
  const [parsing, setParsing] = useState(false)
  const [ventasMpPagadas, setVentasMpPagadas] = useState<ReadonlySet<number>>(() => new Set())

  const loadDia = useCallback(
    async (dia: string) => {
      setLoading(true)
      try {
        const [, movs, ventasRes] = await Promise.all([
          sincronizarVentasPlotLabRango(dia, dia).catch(() => ({ sincronizadas: 0, errores: 0 })),
          listMovimientosPorFecha(dia),
          apiService.obtenerVentas(undefined, dia, dia)
        ])
        setMovimientos(movs)
        const ventas = ventasRes.success && ventasRes.data ? ventasRes.data : []
        setVentasMpPagadas(ventasMpPagadasIds(ventas))
      } finally {
        setLoading(false)
      }
    },
    []
  )

  const reloadMeta = useCallback(() => {
    void Promise.all([
      canal === 'mp' ? listConcilMP() : listConcilBanco(),
      listCierres(),
      listPlanillas(200),
      getParams()
    ]).then(([h, c, p, par]) => {
      setHistorial(h)
      setCierres(c)
      setPlanillas(p)
      setTolerancia(par.tolerancia)
    })
  }, [canal])

  useEffect(() => {
    reloadMeta()
  }, [reloadMeta])

  useEffect(() => {
    void loadDia(fecha)
  }, [fecha, loadDia])

  const cobros = useMemo(
    () => cobrosPorCanalDia(movimientos, fecha, copy.canalCobro, ventasMpPagadas),
    [movimientos, fecha, copy.canalCobro, ventasMpPagadas]
  )

  const sistemaInfo = useMemo(() => {
    const fromFn =
      canal === 'mp'
        ? sistemaMpParaFecha(fecha, cierres, planillas, movimientos)
        : sistemaBancoParaFecha(fecha, cierres, planillas, movimientos)
    const sumaCobros = cobros.reduce((s, c) => s + c.monto, 0)
    if (sumaCobros > 0) {
      return {
        valor: sumaCobros,
        fuente: fromFn.fuente === 'ninguno' ? ('movimientos' as const) : fromFn.fuente
      }
    }
    return fromFn
  }, [canal, fecha, cierres, planillas, movimientos, cobros])

  const rowsDia = useMemo(
    () => fileRows.filter((r) => fechaIsoDia(r.fecha) === fecha),
    [fileRows, fecha]
  )
  const comparables = useMemo(
    () => rowsDia.filter((r) => esLineaComparable(r, canal)),
    [rowsDia, canal]
  )
  const otrosExtracto = useMemo(
    () => rowsDia.filter((r) => !esLineaComparable(r, canal)),
    [rowsDia, canal]
  )
  const extraAuto = useMemo(
    () => comparables.reduce((s, r) => s + r.importeNeto, 0),
    [comparables]
  )

  useEffect(() => {
    if (!extraManual && fileRows.length) {
      setExtra(extraAuto ? String(Math.round(extraAuto * 100) / 100).replace('.', ',') : '')
    }
  }, [extraAuto, extraManual, fileRows.length])

  const extraNum = parseNum(extra)
  const dif = extraNum - sistemaInfo.valor
  const estado: CajaCierreEstado = Math.abs(dif) <= tolerancia ? 'OK' : 'REVISAR'

  const cruce = useMemo(
    () =>
      cruzarPorMonto(
        cobros.map((c) => ({ id: c.mov.id, monto: c.monto })),
        comparables.map((r) => ({ id: r.id, monto: r.importeNeto })),
        Math.max(tolerancia, 0.51)
      ),
    [cobros, comparables, tolerancia]
  )
  const matchBySistema = useMemo(() => {
    const m = new Map<string, (typeof cruce)[number]>()
    for (const l of cruce) if (l.sistemaId) m.set(l.sistemaId, l)
    return m
  }, [cruce])
  const matchByExtracto = useMemo(() => {
    const m = new Map<string, (typeof cruce)[number]>()
    for (const l of cruce) if (l.extractoId) m.set(l.extractoId, l)
    return m
  }, [cruce])
  const matched = cruce.filter((l) => l.estado === 'ok').length
  const soloSist = cruce.filter((l) => l.estado === 'solo_sistema').length
  const soloExt = cruce.filter((l) => l.estado === 'solo_extracto').length

  const onFile = async (file: File | undefined) => {
    if (!file) return
    setParsing(true)
    setFileError(null)
    setMsg(null)
    try {
      const ab = await file.arrayBuffer()
      const rows = parseExtracto(ab, canal)
      if (!rows.length) {
        setFileRows([])
        setFileName(null)
        setFileError(
          'No pude leer fechas e importes. Exportá la actividad de Mercado Pago o el extracto del banco (xlsx/csv).'
        )
        return
      }
      setFileRows(rows)
      setFileName(file.name)
      setExtraManual(false)
    } catch (e) {
      setFileRows([])
      setFileName(null)
      setFileError(e instanceof Error ? e.message : 'No se pudo leer el archivo')
    } finally {
      setParsing(false)
    }
  }

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!extra.trim() && extraNum <= 0 && sistemaInfo.valor <= 0) {
      setMsg(copy.saveNeed)
      return
    }
    if (!extra.trim()) {
      setMsg(copy.saveNeed)
      return
    }
    setSaving(true)
    setMsg(null)
    try {
      const actor = usuarioId != null ? { actor: { id: usuarioId, esAdmin: true } } : undefined
      const nota = [
        observacion.trim(),
        fileName ? `Archivo: ${fileName}` : '',
        comparables.length ? `Líneas cobro extracto: ${comparables.length} · matcheadas: ${matched}` : ''
      ]
        .filter(Boolean)
        .join(' · ')
      if (canal === 'mp') {
        await saveConcilMP(
          {
            fecha,
            sistema: sistemaInfo.valor,
            dashboard: extraNum,
            diferencia: dif,
            estado,
            observacion: nota || undefined
          },
          actor
        )
      } else {
        await saveConcilBanco(
          {
            fecha,
            sistema: sistemaInfo.valor,
            extracto: extraNum,
            diferencia: dif,
            estado,
            observacion: nota || undefined
          },
          actor
        )
      }
      setObservacion('')
      setMsg(copy.saveOk)
      reloadMeta()
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="caja-cc-inline-plotlab">
        <CajaVolverPlotLab small />
      </div>
      <p className="caja-cc-sub">{copy.sub}</p>
      <p className="caja-cc-concil-canal-links">
        <Link to={copy.fullHref} className="btn-secondary btn-small">
          {copy.fullLabel}
        </Link>
      </p>

      {msg && (
        <p className={msg.includes('Error') || msg.includes('Ingres') ? 'caja-cc-error' : 'caja-cc-ok'}>{msg}</p>
      )}

      <form className="caja-cc-card" onSubmit={(e) => void guardar(e)}>
        <h3>{canal === 'mp' ? 'Conciliar Mercado Pago' : 'Conciliar banco'}</h3>
        <div className="caja-cc-grid-3">
          <label className="caja-cc-field">
            Fecha
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
          </label>
          <label className="caja-cc-field">
            Sistema <span className="caja-cc-tag auto">auto</span>
            <input readOnly value={loading ? 'Cargando…' : `$ ${fmtArs(sistemaInfo.valor)}`} />
            <span className="caja-cc-help">
              {labelFuenteSistema(sistemaInfo.fuente)}
              {cobros.length ? ` · ${cobros.length} cobro(s)` : ''}
            </span>
          </label>
          <label className="caja-cc-field">
            {copy.extraLabel} <span className="caja-cc-tag input">{copy.extraTag}</span>
            <input
              type="text"
              inputMode="decimal"
              value={extra}
              onChange={(e) => {
                setExtraManual(true)
                setExtra(e.target.value)
              }}
              placeholder="0,00"
            />
            <span className="caja-cc-help">{copy.extraHint}</span>
          </label>
        </div>

        <div className={`caja-cc-result ${estado === 'OK' ? 'ok' : 'bad'}`}>
          <span>
            Diferencia · <CajaBadge estado={estado} />
          </span>
          <strong>$ {fmtArs(dif)}</strong>
        </div>

        <label className="caja-cc-field caja-cc-concil-canal-file">
          {copy.fileLabel}
          <input
            type="file"
            accept=".xlsx,.xls,.csv,.txt"
            disabled={parsing}
            onChange={(e) => void onFile(e.target.files?.[0])}
          />
          {parsing && <span className="caja-cc-help">Leyendo archivo…</span>}
          {fileName && !fileError && (
            <span className="caja-cc-help">
              {fileName} · {fileRows.length} movimiento(s) · {comparables.length} cobro(s) el {fmtDateAr(fecha)}
            </span>
          )}
          {fileError && <span className="caja-cc-error">{fileError}</span>}
        </label>

        {fileRows.length > 0 && (
          <div className="caja-cc-concil-canal-cruce-kpis">
            <span>
              Matcheados <strong>{matched}</strong>
            </span>
            <span>
              Solo sistema <strong>{soloSist}</strong>
            </span>
            <span>
              Solo extracto <strong>{soloExt}</strong>
            </span>
            {otrosExtracto.length > 0 && (
              <span>
                Fees / otros <strong>{otrosExtracto.length}</strong>
              </span>
            )}
          </div>
        )}

        <label className="caja-cc-field">
          Observación
          <textarea value={observacion} onChange={(e) => setObservacion(e.target.value)} rows={2} />
        </label>
        <div className="caja-cc-actions">
          <button type="submit" className="btn-primary" disabled={saving || loading}>
            {saving ? 'Guardando…' : 'Guardar conciliación'}
          </button>
        </div>
      </form>

      <div className="caja-cc-concil-canal-tables">
        <div className="caja-cc-card">
          <h3>Cobros en caja · {fmtDateAr(fecha)}</h3>
          {loading ? (
            <p className="caja-cc-empty">Cargando cobros del día…</p>
          ) : cobros.length === 0 ? (
            <p className="caja-cc-empty">
              No hay cobros {canal === 'mp' ? 'Mercado Pago' : 'por transferencia'} en esta fecha.
            </p>
          ) : (
            <table className="caja-cc-table">
              <thead>
                <tr>
                  <th>Hora</th>
                  <th>Concepto</th>
                  <th className="num">Monto</th>
                  <th>Cruce</th>
                </tr>
              </thead>
              <tbody>
                {cobros.map(({ mov, monto }) => {
                  const hit = matchBySistema.get(mov.id)
                  const ok = hit?.estado === 'ok'
                  return (
                    <tr key={mov.id} className={fileRows.length ? (ok ? 'caja-cc-concil-row-ok' : 'caja-cc-concil-row-miss') : undefined}>
                      <td>{mov.hora || '—'}</td>
                      <td>
                        {mov.tercero_nombre || mov.concepto}
                        {mov.nro_comprobante ? (
                          <span className="caja-cc-help"> · {mov.nro_comprobante}</span>
                        ) : null}
                      </td>
                      <td className="num">$ {fmtArs(monto)}</td>
                      <td>{fileRows.length ? (ok ? 'OK' : 'Sin extracto') : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="caja-cc-card">
          <h3>{canal === 'mp' ? 'Actividad MP' : 'Extracto'} · {fmtDateAr(fecha)}</h3>
          {fileRows.length === 0 ? (
            <p className="caja-cc-empty">Subí el Excel para cruzar línea a línea por monto.</p>
          ) : comparables.length === 0 ? (
            <p className="caja-cc-empty">El archivo no tiene cobros / acreditaciones en esa fecha.</p>
          ) : (
            <table className="caja-cc-table">
              <thead>
                <tr>
                  <th>Detalle</th>
                  <th className="num">Importe</th>
                  <th>Cruce</th>
                </tr>
              </thead>
              <tbody>
                {comparables.map((r) => {
                  const hit = matchByExtracto.get(r.id)
                  const ok = hit?.estado === 'ok'
                  return (
                    <tr key={r.id} className={ok ? 'caja-cc-concil-row-ok' : 'caja-cc-concil-row-miss'}>
                      <td>
                        {r.descripcion}
                        {r.referencia ? <span className="caja-cc-help"> · {r.referencia}</span> : null}
                      </td>
                      <td className="num">$ {fmtArs(r.importeNeto)}</td>
                      <td>{ok ? 'OK' : 'Sin cobro caja'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="caja-cc-card">
        <h3>Historial</h3>
        {historial.length === 0 ? (
          <p className="caja-cc-empty">Sin conciliaciones guardadas todavía.</p>
        ) : (
          <table className="caja-cc-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th className="num">Sistema</th>
                <th className="num">{copy.extraLabel}</th>
                <th className="num">Diferencia</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {historial.map((r) => (
                <tr key={r.id}>
                  <td>{fmtDateAr(r.fecha)}</td>
                  <td className="num">$ {fmtArs(r.sistema)}</td>
                  <td className="num">
                    $ {fmtArs(canal === 'mp' ? (r as { dashboard: number }).dashboard : (r as { extracto: number }).extracto)}
                  </td>
                  <td className="num">$ {fmtArs(r.diferencia)}</td>
                  <td>
                    <CajaBadge estado={r.estado} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}

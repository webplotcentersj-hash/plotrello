import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CONCEPTOS_MOVIMIENTO } from '../constants'
import {
  deleteMovimiento,
  listCajas,
  listMovimientos,
  saveMovimiento,
  saveMovimientosBulk
} from '../cajaRepository'
import { fmtArs, parseNum } from '../format'
import {
  downloadMovimientosPlantilla,
  parseMovimientosWorkbook
} from '../parseMovimientosExcel'
import { getArgentinaDateString } from '../../../utils/dateUtils'
import CajaMovimientosList from './CajaMovimientosList'
import CajaImportPlanillaPdf from './CajaImportPlanillaPdf'
import CajaCollapsibleCard, { CajaListSearch } from './CajaCollapsibleCard'
import { LIST_PAGE_SIZE, matchSearchQuery } from '../listFilters'
import type { CajaMovimiento, CajaRegistro } from '../types'

type Props = {
  usuarioNombre: string
  usuarioId?: number
  soloMisMovimientos?: boolean
  allowExcelImport?: boolean
  allowDelete?: boolean
  title?: string
  /** Si el padre ya muestra la zona PDF (arqueo/movimientos unificado). */
  hidePlanillaImport?: boolean
}

export default function CajaSectionMovimientos({
  usuarioNombre,
  usuarioId,
  soloMisMovimientos = false,
  allowExcelImport = true,
  allowDelete = true,
  title = 'Movimientos de caja',
  hidePlanillaImport = false
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [cajas, setCajas] = useState<CajaRegistro[]>([])
  const [movimientos, setMovimientos] = useState<CajaMovimiento[]>([])
  const [loading, setLoading] = useState(true)
  const [concepto, setConcepto] = useState('Fondo de caja')
  const [fecha, setFecha] = useState(getArgentinaDateString())
  const [hora, setHora] = useState(() => new Date().toTimeString().slice(0, 5))
  const [origen, setOrigen] = useState('')
  const [destino, setDestino] = useState('')
  const [efectivo, setEfectivo] = useState('')
  const [otros, setOtros] = useState('')
  const [nro, setNro] = useState('')
  const [observacion, setObservacion] = useState('')
  const [importMsg, setImportMsg] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [listSearch, setListSearch] = useState('')
  const [filtConcepto, setFiltConcepto] = useState('')
  const [filtDesde, setFiltDesde] = useState('')
  const [filtHasta, setFiltHasta] = useState('')
  const [listLimit, setListLimit] = useState(LIST_PAGE_SIZE)
  const reload = useCallback(async () => {
    setLoading(true)
    const [c, m] = await Promise.all([
      listCajas(),
      listMovimientos(
        soloMisMovimientos ? { usuario: usuarioNombre, usuarioId: usuarioId ?? undefined } : undefined
      )
    ])
    setCajas(c)
    setMovimientos(m)
    if (c.length && !origen) setOrigen(c[0].slug)
    if (c.length && !destino) setDestino(c[1]?.slug ?? c[0].slug)
    setLoading(false)
  }, [soloMisMovimientos, usuarioNombre, usuarioId, origen])

  useEffect(() => {
    void reload()
  }, [reload])

  const total = parseNum(efectivo) + parseNum(otros)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!origen || !destino) return
    setSaving(true)
    try {
      await saveMovimiento({
        fecha,
        hora,
        concepto,
        origen_slug: origen,
        destino_slug: destino,
        efectivo: parseNum(efectivo),
        otros: parseNum(otros),
        nro_comprobante: nro || null,
        observacion: observacion || null,
        id_usuario: usuarioId ?? null,
        usuario_nombre: usuarioNombre,
        origen_importacion: 'manual'
      })
      setEfectivo('')
      setOtros('')
      setNro('')
      setObservacion('')
      await reload()
    } finally {
      setSaving(false)
    }
  }

  const handleExcel = async (file: File) => {
    const buf = await file.arrayBuffer()
    const { rows, errors, skipped } = parseMovimientosWorkbook(buf, cajas, usuarioNombre)
    if (!rows.length) {
      setImportMsg(errors.join(' ') || 'No se encontraron filas válidas.')
      return
    }
    await saveMovimientosBulk(
      rows.map((r) => ({
        ...r,
        id_usuario: usuarioId ?? null,
        usuario_nombre: r.usuario_nombre ?? usuarioNombre
      }))
    )
    setImportMsg(
      `Importados ${rows.length} movimiento(s).${skipped ? ` Omitidas ${skipped}.` : ''}${errors.length ? ` Avisos: ${errors.slice(0, 3).join(' ')}` : ''}`
    )
    await reload()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este movimiento?')) return
    await deleteMovimiento(id)
    await reload()
  }

  const cajaNombre = (slug: string) => cajas.find((c) => c.slug === slug)?.nombre ?? slug

  const movimientosFiltrados = useMemo(() => {
    return movimientos.filter((m) => {
      if (filtConcepto && m.concepto !== filtConcepto) return false
      if (filtDesde && m.fecha < filtDesde) return false
      if (filtHasta && m.fecha > filtHasta) return false
      return matchSearchQuery(listSearch, [
        m.concepto,
        m.observacion,
        m.nro_comprobante,
        cajaNombre(m.origen_slug),
        cajaNombre(m.destino_slug),
        m.usuario_nombre,
        fmtArs(m.efectivo + m.otros),
        m.fecha
      ])
    })
  }, [movimientos, listSearch, filtConcepto, filtDesde, filtHasta, cajas])

  const movimientosVisibles = movimientosFiltrados.slice(0, listLimit)
  const conceptosEnLista = useMemo(
    () => [...new Set(movimientos.map((m) => m.concepto))].sort(),
    [movimientos]
  )

  const listaToolbar = (
    <div className="caja-cc-card-toolbar caja-cc-card-toolbar--stack">
      <CajaListSearch
        value={listSearch}
        onChange={(v) => {
          setListSearch(v)
          setListLimit(LIST_PAGE_SIZE)
        }}
        placeholder="Buscar concepto, caja, monto, comprobante…"
      />
      <div className="caja-cc-filters-row">
        <label className="caja-cc-filter-chip">
          <span>Tipo</span>
          <select
            value={filtConcepto}
            onChange={(e) => {
              setFiltConcepto(e.target.value)
              setListLimit(LIST_PAGE_SIZE)
            }}
          >
            <option value="">Todos</option>
            {conceptosEnLista.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="caja-cc-filter-chip">
          <span>Desde</span>
          <input
            type="date"
            value={filtDesde}
            onChange={(e) => {
              setFiltDesde(e.target.value)
              setListLimit(LIST_PAGE_SIZE)
            }}
          />
        </label>
        <label className="caja-cc-filter-chip">
          <span>Hasta</span>
          <input
            type="date"
            value={filtHasta}
            onChange={(e) => {
              setFiltHasta(e.target.value)
              setListLimit(LIST_PAGE_SIZE)
            }}
          />
        </label>
        {(listSearch || filtConcepto || filtDesde || filtHasta) && (
          <button
            type="button"
            className="btn-tiny"
            onClick={() => {
              setListSearch('')
              setFiltConcepto('')
              setFiltDesde('')
              setFiltHasta('')
              setListLimit(LIST_PAGE_SIZE)
            }}
          >
            Limpiar
          </button>
        )}
      </div>
    </div>
  )

  return (
    <div>
      <div className="caja-cc-page-head">
        <div>
          <h2>{title}</h2>
          <p>Fondos, pases entre cajas y cierres de turno.</p>
        </div>
        {allowExcelImport && (
          <div className="caja-cc-page-actions">
            <button type="button" className="btn-secondary" onClick={downloadMovimientosPlantilla}>
              Plantilla Excel (opcional)
            </button>
            <button type="button" className="btn-secondary" onClick={() => fileRef.current?.click()}>
              Importar Excel
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void handleExcel(f)
                e.target.value = ''
              }}
            />
          </div>
        )}
      </div>

      {importMsg && <p className="caja-cc-help">{importMsg}</p>}

      {!hidePlanillaImport && (
        <CajaImportPlanillaPdf
          usuarioNombre={usuarioNombre}
          usuarioId={usuarioId}
          onImported={() => void reload()}
        />
      )}

      <form className="caja-cc-card" onSubmit={(e) => void handleSubmit(e)}>
        <h3>Nuevo movimiento</h3>
        <div className="caja-cc-grid-2">
          <label className="caja-cc-field">
            Tipo
            <select value={concepto} onChange={(e) => setConcepto(e.target.value)}>
              {CONCEPTOS_MOVIMIENTO.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            {concepto === 'Pase de caja' && (
              <span className="caja-cc-field-hint">
                Para pases con montos antes/después e historial completo, usá la sección <strong>Pase de caja</strong>{' '}
                del menú.
              </span>
            )}
          </label>
          <label className="caja-cc-field">
            Nº comprobante
            <input value={nro} onChange={(e) => setNro(e.target.value)} placeholder="MEC-0000…" />
          </label>
        </div>
        <div className="caja-cc-grid-2">
          <label className="caja-cc-field">
            Fecha
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
          </label>
          <label className="caja-cc-field">
            Hora
            <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
          </label>
        </div>
        {soloMisMovimientos && (
          <p className="caja-cc-help caja-cc-mov-usuario-hint">
            Registrado a nombre de <strong>{usuarioNombre}</strong>
          </p>
        )}
        <div className="caja-cc-grid-2">
          <label className="caja-cc-field">
            Caja origen
            <select value={origen} onChange={(e) => setOrigen(e.target.value)} required>
              {cajas.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </label>
          <label className="caja-cc-field">
            Caja destino
            <select value={destino} onChange={(e) => setDestino(e.target.value)} required>
              {cajas.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="caja-cc-grid-2">
          <label className="caja-cc-field">
            Efectivo
            <input
              type="number"
              step="0.01"
              value={efectivo}
              onChange={(e) => setEfectivo(e.target.value)}
            />
          </label>
          <label className="caja-cc-field">
            Tarjetas / otros
            <input type="number" step="0.01" value={otros} onChange={(e) => setOtros(e.target.value)} />
          </label>
        </div>
        <div className="caja-cc-result neutral">
          <span>Total del movimiento</span>
          <strong>$ {fmtArs(total)}</strong>
        </div>
        <label className="caja-cc-field">
          Observación
          <textarea value={observacion} onChange={(e) => setObservacion(e.target.value)} rows={2} />
        </label>
        <div className="caja-cc-actions">
          <button type="submit" className="btn-primary" disabled={saving}>
            Guardar movimiento
          </button>
        </div>
      </form>

      <CajaCollapsibleCard
        title={soloMisMovimientos ? 'Mis movimientos' : 'Todos los movimientos'}
        count={movimientosFiltrados.length}
        toolbar={listaToolbar}
        bodyClassName="caja-cc-card-body-scroll"
      >
        {loading ? (
          <p className="caja-cc-empty">Cargando…</p>
        ) : (
          <>
            <CajaMovimientosList
              movimientos={movimientosVisibles}
              cajas={cajas}
              showUsuario={!soloMisMovimientos}
              onDelete={allowDelete ? handleDelete : undefined}
            />
            {movimientosFiltrados.length > listLimit && (
              <button
                type="button"
                className="btn-link caja-cc-show-more"
                onClick={() => setListLimit((n) => n + LIST_PAGE_SIZE)}
              >
                Ver más ({movimientosFiltrados.length - listLimit} restantes)
              </button>
            )}
          </>
        )}
      </CajaCollapsibleCard>
    </div>
  )
}

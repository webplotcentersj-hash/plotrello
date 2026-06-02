import { useCallback, useEffect, useRef, useState } from 'react'
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
import { crearTraspasoCaja, movimientoDesdeMedios, type MediosPagoInput } from '../movimientoCaja'
import CajaMovimientosList from './CajaMovimientosList'
import CajaImportPlanillaPdf from './CajaImportPlanillaPdf'
import CajaFormMovimientoMedios from './CajaFormMovimientoMedios'
import type { CajaMovimiento, CajaRegistro } from '../types'

const MEDIOS_VACIOS: MediosPagoInput = {
  total: 0,
  cuenta_corriente: 0,
  efectivo: 0,
  cheque_propio: 0,
  cheque_tercero: 0,
  tarjeta: 0,
  documento: 0,
  cuenta_contable: 0,
  transferencia_bancaria: 0,
  otros: 0
}

type Props = {
  usuarioNombre: string
  usuarioId?: number
  soloMisMovimientos?: boolean
  allowExcelImport?: boolean
  allowDelete?: boolean
  title?: string
}

export default function CajaSectionMovimientos({
  usuarioNombre,
  usuarioId,
  soloMisMovimientos = false,
  allowExcelImport = true,
  allowDelete = true,
  title = 'Movimientos de caja'
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
  const [modoForm, setModoForm] = useState<'simple' | 'medios'>('simple')
  const [tipoMov, setTipoMov] = useState<'ingreso' | 'egreso' | 'traspaso'>('egreso')
  const [conceptoMedios, setConceptoMedios] = useState('')
  const [medios, setMedios] = useState<MediosPagoInput>({ ...MEDIOS_VACIOS })

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

  const handleSubmitMedios = async () => {
    setSaving(true)
    try {
      if (tipoMov === 'traspaso') {
        const { movimientos } = crearTraspasoCaja({
          fecha,
          caja_origen_slug: origen,
          caja_destino_slug: destino,
          comprobante: nro || null,
          medios,
          observacion: conceptoMedios || null,
          id_usuario: usuarioId ?? null,
          usuario_nombre: usuarioNombre,
          confirmar: true
        })
        await saveMovimientosBulk(movimientos)
      } else {
        const caja = tipoMov === 'ingreso' ? destino : origen
        const mov = movimientoDesdeMedios(
          {
            fecha,
            hora,
            caja_slug: caja,
            tipo_movimiento: tipoMov,
            categoria: conceptoMedios || tipoMov,
            comprobante: nro || null,
            concepto: conceptoMedios || tipoMov,
            medios,
            id_usuario: usuarioId ?? null,
            usuario_nombre: usuarioNombre
          },
          {
            origen_slug: tipoMov === 'ingreso' ? 'admin' : origen,
            destino_slug: tipoMov === 'ingreso' ? destino : 'admin'
          }
        )
        await saveMovimiento(mov)
      }
      setMedios({ ...MEDIOS_VACIOS })
      setConceptoMedios('')
      setNro('')
      await reload()
    } catch (e) {
      setImportMsg(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este movimiento?')) return
    await deleteMovimiento(id)
    await reload()
  }

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

      <CajaImportPlanillaPdf
        usuarioNombre={usuarioNombre}
        usuarioId={usuarioId}
        onImported={() => void reload()}
      />

      <div className="caja-cc-tabs">
        <button
          type="button"
          className={modoForm === 'simple' ? 'active' : ''}
          onClick={() => setModoForm('simple')}
        >
          Efectivo / otros
        </button>
        <button
          type="button"
          className={modoForm === 'medios' ? 'active' : ''}
          onClick={() => setModoForm('medios')}
        >
          Medios planilla (10 columnas)
        </button>
      </div>

      {modoForm === 'medios' ? (
        <CajaFormMovimientoMedios
          cajas={cajas}
          fecha={fecha}
          setFecha={setFecha}
          origen={origen}
          setOrigen={setOrigen}
          destino={destino}
          setDestino={setDestino}
          tipoMov={tipoMov}
          setTipoMov={setTipoMov}
          comprobante={nro}
          setComprobante={setNro}
          concepto={conceptoMedios}
          setConcepto={setConceptoMedios}
          medios={medios}
          setMedios={setMedios}
          onSubmit={() => void handleSubmitMedios()}
          saving={saving}
        />
      ) : (
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
      )}

      <div className="caja-cc-card">
        <h3>{soloMisMovimientos ? 'Mis movimientos' : 'Todos los movimientos'}</h3>
        {loading ? (
          <p className="caja-cc-empty">Cargando…</p>
        ) : (
          <CajaMovimientosList
            movimientos={movimientos}
            cajas={cajas}
            showUsuario={!soloMisMovimientos}
            onDelete={allowDelete ? handleDelete : undefined}
          />
        )}
      </div>
    </div>
  )
}

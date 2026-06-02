import { useCallback, useEffect, useState } from 'react'
import {
  createEgresoSolicitud,
  listCajas,
  listEgresoSolicitudes,
  resolverEgresoSolicitud
} from '../cajaRepository'
import { fmtArs, fmtDateAr } from '../format'
import { getArgentinaDateString } from '../../../utils/dateUtils'
import type { CajaEgresoSolicitud, CajaRegistro } from '../types'

type Props = {
  isAdmin: boolean
  usuarioNombre: string
  usuarioId?: number
}

export default function CajaSectionEgresos({ isAdmin, usuarioNombre, usuarioId }: Props) {
  const [cajas, setCajas] = useState<CajaRegistro[]>([])
  const [lista, setLista] = useState<CajaEgresoSolicitud[]>([])
  const [fecha, setFecha] = useState(getArgentinaDateString())
  const [cajaSlug, setCajaSlug] = useState('')
  const [concepto, setConcepto] = useState('')
  const [montoEf, setMontoEf] = useState('')
  const [montoOt, setMontoOt] = useState('')
  const [obs, setObs] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const reload = useCallback(async () => {
    const [c, s] = await Promise.all([
      listCajas(),
      listEgresoSolicitudes(isAdmin ? { soloPendientes: false } : undefined)
    ])
    setCajas(c.filter((x) => x.slug !== 'admin' && x.slug !== 'vuelto'))
    setLista(s)
    if (c.length && !cajaSlug) {
      const op = c.find((x) => x.slug !== 'admin')?.slug ?? c[0].slug
      setCajaSlug(op)
    }
  }, [isAdmin, cajaSlug])

  useEffect(() => {
    void reload()
  }, [reload])

  const solicitar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!cajaSlug || !concepto.trim()) return
    setSaving(true)
    setMsg(null)
    try {
      await createEgresoSolicitud({
        fecha,
        caja_slug: cajaSlug,
        concepto: concepto.trim(),
        monto_efectivo: parseFloat(montoEf) || 0,
        monto_otros: parseFloat(montoOt) || 0,
        solicitante_id: usuarioId ?? null,
        solicitante_nombre: usuarioNombre,
        observacion: obs || null
      })
      setConcepto('')
      setMontoEf('')
      setMontoOt('')
      setObs('')
      setMsg('Solicitud enviada. Administración debe aprobarla antes de que el egreso se ejecute.')
      await reload()
    } finally {
      setSaving(false)
    }
  }

  const resolver = async (id: string, accion: 'aprobado' | 'rechazado') => {
    if (!usuarioId) {
      setMsg('Usuario sin ID; no se puede registrar el aprobador.')
      return
    }
    let motivo: string | undefined
    if (accion === 'rechazado') {
      motivo = window.prompt('Motivo del rechazo:') ?? undefined
      if (!motivo?.trim()) return
    }
    await resolverEgresoSolicitud(id, accion, { id: usuarioId, nombre: usuarioNombre }, {
      motivo_rechazo: motivo
    })
    await reload()
    setMsg(accion === 'aprobado' ? 'Egreso aprobado y movimiento generado.' : 'Solicitud rechazada.')
  }

  const cajaNombre = (slug: string) => cajas.find((c) => c.slug === slug)?.nombre ?? slug
  const pendientes = lista.filter((s) => s.estado === 'pendiente')

  return (
    <div>
      <div className="caja-cc-page-head">
        <div>
          <h2>Egresos de caja</h2>
          <p>
            {isAdmin
              ? 'Aprobá o rechazá egresos solicitados por las cajeras. Sin aprobación no se ejecutan.'
              : 'Cada egreso requiere permiso de administración antes de descontarse del arqueo y del cierre.'}
          </p>
        </div>
      </div>

      {!isAdmin && (
        <form className="caja-cc-card" onSubmit={(e) => void solicitar(e)}>
          <h3>Solicitar egreso</h3>
          <div className="caja-cc-grid-2">
            <label className="caja-cc-field">
              Fecha
              <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
            </label>
            <label className="caja-cc-field">
              Caja
              <select value={cajaSlug} onChange={(e) => setCajaSlug(e.target.value)} required>
                {cajas.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="caja-cc-field">
            Concepto
            <input value={concepto} onChange={(e) => setConcepto(e.target.value)} required placeholder="Ej: Pago proveedor" />
          </label>
          <div className="caja-cc-grid-2">
            <label className="caja-cc-field">
              Efectivo
              <input type="number" step="0.01" value={montoEf} onChange={(e) => setMontoEf(e.target.value)} />
            </label>
            <label className="caja-cc-field">
              Otros
              <input type="number" step="0.01" value={montoOt} onChange={(e) => setMontoOt(e.target.value)} />
            </label>
          </div>
          <label className="caja-cc-field">
            Observación
            <textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} />
          </label>
          <button type="submit" className="btn-primary" disabled={saving}>
            Pedir autorización
          </button>
        </form>
      )}

      {isAdmin && pendientes.length > 0 && (
        <div className="caja-cc-card caja-cc-egreso-pendientes">
          <h3>Pendientes de aprobación ({pendientes.length})</h3>
          <table className="caja-cc-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Caja</th>
                <th>Concepto</th>
                <th className="num">Monto</th>
                <th>Solicitó</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {pendientes.map((s) => (
                <tr key={s.id}>
                  <td>{fmtDateAr(s.fecha)}</td>
                  <td>{cajaNombre(s.caja_slug)}</td>
                  <td>{s.concepto}</td>
                  <td className="num">$ {fmtArs(s.monto_efectivo + s.monto_otros)}</td>
                  <td>{s.solicitante_nombre ?? '—'}</td>
                  <td className="caja-cc-actions-cell">
                    <button type="button" className="btn-small" onClick={() => void resolver(s.id, 'aprobado')}>
                      Aprobar
                    </button>
                    <button
                      type="button"
                      className="btn-small danger"
                      onClick={() => void resolver(s.id, 'rechazado')}
                    >
                      Rechazar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="caja-cc-card">
        <h3>Historial</h3>
        {lista.length === 0 ? (
          <p className="caja-cc-empty">Sin solicitudes.</p>
        ) : (
          <table className="caja-cc-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Caja</th>
                <th>Concepto</th>
                <th className="num">Monto</th>
                <th>Estado</th>
                <th>Trazabilidad</th>
              </tr>
            </thead>
            <tbody>
              {lista.slice(0, 40).map((s) => (
                <tr key={s.id}>
                  <td>{fmtDateAr(s.fecha)}</td>
                  <td>{cajaNombre(s.caja_slug)}</td>
                  <td>{s.concepto}</td>
                  <td className="num">$ {fmtArs(s.monto_efectivo + s.monto_otros)}</td>
                  <td>
                    <span className={`caja-cc-badge ${s.estado === 'aprobado' ? 'ok' : s.estado === 'rechazado' ? 'bad' : 'pen'}`}>
                      {s.estado}
                    </span>
                  </td>
                  <td className="caja-cc-meta">
                    {s.solicitante_nombre}
                    {s.aprobador_nombre ? ` → ${s.aprobador_nombre}` : ''}
                    {s.id_movimiento ? ` · mov ${s.id_movimiento.slice(0, 8)}` : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {msg && <p className="caja-cc-help">{msg}</p>}
    </div>
  )
}

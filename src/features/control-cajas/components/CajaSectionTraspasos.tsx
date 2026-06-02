import { useCallback, useEffect, useState } from 'react'
import { fmtArs, fmtDateAr } from '../format'
import { listCajas, listTraspasos, setTraspasoEstado } from '../cajaRepository'
import type { CajaRegistro, CajaTraspaso, CajaTraspasoEstado } from '../types'

type Props = {
  isAdmin?: boolean
  usuarioNombre?: string
  usuarioId?: number
}

const ESTADO_LABEL: Record<CajaTraspasoEstado, string> = {
  pendiente: 'Pendiente',
  confirmado: 'Confirmado',
  anulado: 'Anulado'
}

export default function CajaSectionTraspasos({ isAdmin = false, usuarioNombre, usuarioId }: Props) {
  const [cajas, setCajas] = useState<CajaRegistro[]>([])
  const [traspasos, setTraspasos] = useState<CajaTraspaso[]>([])
  const [filtroEstado, setFiltroEstado] = useState<CajaTraspasoEstado | ''>('pendiente')
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    const [c, t] = await Promise.all([
      listCajas(),
      listTraspasos(filtroEstado ? { estado: filtroEstado } : undefined)
    ])
    setCajas(c)
    let list = t
    if (!isAdmin && (usuarioId != null || usuarioNombre)) {
      const norm = usuarioNombre?.trim().toLowerCase()
      list = list.filter(
        (x) =>
          (usuarioId != null && x.id_usuario === usuarioId) ||
          (norm && x.usuario_nombre?.trim().toLowerCase() === norm)
      )
    }
    setTraspasos(list)
    setLoading(false)
  }, [filtroEstado, isAdmin, usuarioId, usuarioNombre])

  useEffect(() => {
    void reload()
  }, [reload])

  const cajaNombre = (slug: string) => cajas.find((x) => x.slug === slug)?.nombre ?? slug

  const onConfirmar = async (id: string) => {
    if (!confirm('¿Confirmar este traspaso? Los movimientos quedarán vigentes.')) return
    try {
      await setTraspasoEstado(id, 'confirmado')
      setMsg('Traspaso confirmado.')
      await reload()
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Error al confirmar')
    }
  }

  const onAnular = async (id: string) => {
    if (!confirm('¿Anular el traspaso? Se marcarán los movimientos vinculados como anulados.')) return
    try {
      await setTraspasoEstado(id, 'anulado')
      setMsg('Traspaso anulado.')
      await reload()
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Error al anular')
    }
  }

  return (
    <div>
      <div className="caja-cc-page-head">
        <div>
          <h2>Traspasos entre cajas</h2>
          <p>
            Movimientos con desglose por medio de pago. {isAdmin ? 'Administración confirma o anula.' : 'Consultá el estado de tus traspasos.'}
          </p>
        </div>
      </div>

      <div className="caja-cc-card">
        <label className="caja-cc-field">
          Filtrar por estado
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value as CajaTraspasoEstado | '')}
          >
            <option value="">Todos</option>
            <option value="pendiente">Pendiente</option>
            <option value="confirmado">Confirmado</option>
            <option value="anulado">Anulado</option>
          </select>
        </label>
      </div>

      {msg && <p className="caja-cc-help">{msg}</p>}

      <div className="caja-cc-card">
        {loading ? (
          <p className="caja-cc-empty">Cargando…</p>
        ) : traspasos.length === 0 ? (
          <p className="caja-cc-empty">No hay traspasos con ese filtro.</p>
        ) : (
          <table className="caja-cc-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Origen → Destino</th>
                <th className="num">Total</th>
                <th className="num">Efectivo</th>
                <th>Estado</th>
                <th>Usuario</th>
                {isAdmin && <th />}
              </tr>
            </thead>
            <tbody>
              {traspasos.map((t) => (
                <tr key={t.id}>
                  <td>{fmtDateAr(t.fecha)}</td>
                  <td>
                    {cajaNombre(t.caja_origen_slug)} → {cajaNombre(t.caja_destino_slug)}
                    {t.comprobante && (
                      <span className="caja-cc-field-hint"> · {t.comprobante}</span>
                    )}
                  </td>
                  <td className="num">$ {fmtArs(t.monto_total)}</td>
                  <td className="num">$ {fmtArs(t.efectivo)}</td>
                  <td>
                    <span className={`caja-cc-tag ${t.estado === 'pendiente' ? 'warn' : t.estado === 'anulado' ? 'bad' : 'ok'}`}>
                      {ESTADO_LABEL[t.estado]}
                    </span>
                  </td>
                  <td>{t.usuario_nombre ?? '—'}</td>
                  {isAdmin && (
                    <td className="caja-cc-actions-cell">
                      {t.estado === 'pendiente' && (
                        <>
                          <button type="button" className="btn-small" onClick={() => void onConfirmar(t.id)}>
                            Confirmar
                          </button>
                          <button type="button" className="btn-small danger" onClick={() => void onAnular(t.id)}>
                            Anular
                          </button>
                        </>
                      )}
                      {t.estado === 'confirmado' && (
                        <button type="button" className="btn-small danger" onClick={() => void onAnular(t.id)}>
                          Anular
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { listArqueos, listCajas, listMovimientos } from '../cajaRepository'
import { fmtArs, fmtDateAr } from '../format'
import type { CajaArqueo, CajaMovimiento, CajaRegistro } from '../types'

type Props = { usuarioNombre: string; usuarioId?: number }

export default function CajaSectionHistorial({ usuarioNombre, usuarioId }: Props) {
  const [arqueos, setArqueos] = useState<CajaArqueo[]>([])
  const [movimientos, setMovimientos] = useState<CajaMovimiento[]>([])
  const [cajas, setCajas] = useState<CajaRegistro[]>([])

  useEffect(() => {
    void Promise.all([
      listArqueos({ usuario: usuarioNombre, usuarioId }),
      listMovimientos({ usuario: usuarioNombre, usuarioId }),
      listCajas()
    ]).then(([a, m, c]) => {
      setArqueos(a.slice(0, 15))
      setMovimientos(m.slice(0, 15))
      setCajas(c)
    })
  }, [usuarioNombre, usuarioId])

  const cajaNombre = (slug: string) => cajas.find((c) => c.slug === slug)?.nombre ?? slug

  return (
    <div className="caja-cc-grid-2">
      <div className="caja-cc-card">
        <h3>Últimos arqueos</h3>
        {arqueos.length === 0 ? (
          <p className="caja-cc-empty">Sin arqueos</p>
        ) : (
          <table className="caja-cc-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Caja</th>
                <th className="num">Total</th>
              </tr>
            </thead>
            <tbody>
              {arqueos.map((a) => (
                <tr key={a.id}>
                  <td>{fmtDateAr(a.fecha)}</td>
                  <td>{cajaNombre(a.caja_slug)}</td>
                  <td className="num">$ {fmtArs(a.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="caja-cc-card">
        <h3>Últimos movimientos</h3>
        {movimientos.length === 0 ? (
          <p className="caja-cc-empty">Sin movimientos</p>
        ) : (
          <table className="caja-cc-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Concepto</th>
                <th className="num">Total</th>
              </tr>
            </thead>
            <tbody>
              {movimientos.map((m) => (
                <tr key={m.id}>
                  <td>{fmtDateAr(m.fecha)}</td>
                  <td>{m.concepto}</td>
                  <td className="num">$ {fmtArs(m.efectivo + m.otros)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

export { default as CajaSectionArqueosAdmin } from './CajaSectionArqueosAdmin'

import { useEffect, useMemo, useState } from 'react'
import { recolectarDiferencias } from '../cajaDashboardData'
import { fmtArs, fmtDateAr } from '../format'
import {
  getParams,
  listArqueos,
  listCajas,
  listCierres,
  listConcilBanco,
  listConcilMP,
  listDiferencias,
  listMovimientos,
  saveDiferencia
} from '../cajaRepository'
import CajaCollapsibleCard from './CajaCollapsibleCard'
import CajaMiniPlotAI from './CajaMiniPlotAI'
import CajaVolverPlotLab from './CajaVolverPlotLab'
import type { CajaRegistro } from '../types'

export default function CajaSectionDiferencias() {
  const [cierres, setCierres] = useState<Awaited<ReturnType<typeof listCierres>>>([])
  const [manual, setManual] = useState<Awaited<ReturnType<typeof listDiferencias>>>([])
  const [arqueos, setArqueos] = useState<Awaited<ReturnType<typeof listArqueos>>>([])
  const [movimientos, setMovimientos] = useState<Awaited<ReturnType<typeof listMovimientos>>>([])
  const [concilMp, setConcilMp] = useState<Awaited<ReturnType<typeof listConcilMP>>>([])
  const [concilBanco, setConcilBanco] = useState<Awaited<ReturnType<typeof listConcilBanco>>>([])
  const [cajas, setCajas] = useState<CajaRegistro[]>([])
  const [tolerancia, setTolerancia] = useState(0)
  const [msg, setMsg] = useState<string | null>(null)

  const reload = () => {
    void Promise.all([
      listCierres(),
      listDiferencias(),
      listArqueos(),
      listMovimientos(),
      listConcilMP(),
      listConcilBanco(),
      listCajas(),
      getParams()
    ]).then(([c, d, a, m, mp, b, ca, p]) => {
      setCierres(c)
      setManual(d)
      setArqueos(a)
      setMovimientos(m)
      setConcilMp(mp)
      setConcilBanco(b)
      setCajas(ca)
      setTolerancia(p.tolerancia)
    })
  }

  useEffect(() => {
    reload()
  }, [])

  const cajaNombre = (slug?: string | null) =>
    slug ? cajas.find((c) => c.slug === slug)?.nombre ?? slug : '—'

  const todos = useMemo(
    () =>
      recolectarDiferencias(cierres, manual, arqueos, concilMp, concilBanco, movimientos, tolerancia),
    [cierres, manual, arqueos, concilMp, concilBanco, movimientos, tolerancia]
  )

  const pendientes = todos.filter((d) => d.estado === 'Pendiente')

  const marcarResuelto = async (id: string) => {
    const d = todos.find((x) => x.id === id)
    if (!d) return
    if (d.auto_desde_cierre && id.startsWith('auto_')) {
      setMsg('Registro automático: corregí el cierre, arqueo o conciliación origen. Podés archivarlo en manual si hace falta.')
      return
    }
    try {
      await saveDiferencia({ ...d, estado: 'Resuelto' })
      setMsg('Marcada como resuelta.')
      reload()
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Error al guardar')
    }
  }

  const ctxAi = `Diferencias pendientes: ${pendientes.length}.
${pendientes
  .slice(0, 12)
  .map(
    (d) =>
      `${d.fecha} ${cajaNombre(d.caja_slug)} ${d.tipo} $${fmtArs(d.monto)} — ${d.motivo} (${d.responsable ?? 'sin responsable'})`
  )
  .join('\n') || 'Ninguna.'}`

  return (
    <>
      <div className="caja-cc-inline-plotlab">
        <CajaVolverPlotLab small />
      </div>
      <p className="caja-cc-sub">
        Faltantes y sobrantes detectados en cierres, arqueos, conciliaciones MP/banco y movimientos con cuadre
        inválido.
      </p>

      {msg && <p className="caja-cc-ok">{msg}</p>}

      <CajaMiniPlotAI
        titulo="PlotAI — resolver diferencias"
        contexto={ctxAi}
        preguntaDefault="Priorizá estas diferencias y decime pasos concretos para resolver cada una."
      />

      <CajaCollapsibleCard
        title="Diferencias pendientes"
        count={pendientes.length}
        defaultOpen={pendientes.length > 0 && pendientes.length <= 10}
      >
        {pendientes.length === 0 ? (
          <p className="caja-cc-empty">Ninguna diferencia pendiente. Todo cuadra.</p>
        ) : (
          <div className="caja-cc-table-scroll">
            <table className="caja-cc-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Caja</th>
                  <th>Tipo</th>
                  <th className="num">Monto</th>
                  <th>Motivo</th>
                  <th>Responsable</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {pendientes.map((d) => (
                  <tr key={d.id}>
                    <td>{fmtDateAr(d.fecha)}</td>
                    <td>{cajaNombre(d.caja_slug)}</td>
                    <td>{d.tipo}</td>
                    <td className="num">$ {fmtArs(d.monto)}</td>
                    <td>{d.motivo || '—'}</td>
                    <td>{d.responsable || '—'}</td>
                    <td className="caja-cc-actions-cell">
                      {!d.auto_desde_cierre && (
                        <button type="button" className="btn-small" onClick={() => void marcarResuelto(d.id)}>
                          Resolver
                        </button>
                      )}
                      {d.auto_desde_cierre && (
                        <span className="caja-cc-tag auto">auto</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CajaCollapsibleCard>

      {todos.filter((d) => d.estado === 'Resuelto').length > 0 && (
        <CajaCollapsibleCard title="Resueltas" count={todos.filter((d) => d.estado === 'Resuelto').length}>
          <div className="caja-cc-table-scroll">
            <table className="caja-cc-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Tipo</th>
                  <th className="num">Monto</th>
                  <th>Motivo</th>
                </tr>
              </thead>
              <tbody>
                {todos
                  .filter((d) => d.estado === 'Resuelto')
                  .map((d) => (
                    <tr key={d.id}>
                      <td>{fmtDateAr(d.fecha)}</td>
                      <td>{d.tipo}</td>
                      <td className="num">$ {fmtArs(d.monto)}</td>
                      <td>{d.motivo || '—'}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </CajaCollapsibleCard>
      )}
    </>
  )
}

import { useEffect, useState } from 'react'
import {
  listCajasOperativasUsuarios,
  ultimoArqueoCajaOperativa
} from '../cajaOperativa'
import { fmtArs } from '../format'
import { getParams, listCajasAll, saveCajasMaestro, saveParams, updateCajaFondoFijo } from '../cajaRepository'
import type { CajaRegistro } from '../types'
import { CajaMensajeOkPlotLab } from './CajaVolverPlotLab'
import CajaVolverPlotLab from './CajaVolverPlotLab'

const CAJAS_SISTEMA = new Set(['admin', 'vuelto'])

type CajaOperativaRow = CajaRegistro & { ultimoArqueo?: string | null }

export default function CajaSectionConfig() {
  const [cajasSistema, setCajasSistema] = useState<CajaRegistro[]>([])
  const [cajasOperativas, setCajasOperativas] = useState<CajaOperativaRow[]>([])
  const [tolerancia, setTolerancia] = useState(0)
  const [msg, setMsg] = useState<string | null>(null)

  const reload = () => {
    void Promise.all([listCajasAll(), listCajasOperativasUsuarios(), getParams()]).then(
      async ([todas, operativas, p]) => {
        setCajasSistema(todas.filter((x) => CAJAS_SISTEMA.has(x.slug)))
        const rows: CajaOperativaRow[] = []
        for (const c of operativas) {
          const ult = await ultimoArqueoCajaOperativa(c.slug)
          rows.push({
            ...c,
            ultimoArqueo: ult ? `${ult.fecha} · $ ${fmtArs(ult.total)}` : null
          })
        }
        rows.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
        setCajasOperativas(rows)
        setTolerancia(p.tolerancia)
      }
    )
  }

  useEffect(() => {
    reload()
  }, [])

  const guardar = async () => {
    const invalida = cajasSistema.find((c) => (c.fondo_fijo || 0) < 0)
    if (invalida) {
      setMsg(`Fondo de "${invalida.nombre}" no puede ser negativo.`)
      return
    }
    const todas = await listCajasAll()
    const otrasOperativas = todas.filter(
      (c) => !CAJAS_SISTEMA.has(c.slug) && !cajasOperativas.some((o) => o.slug === c.slug)
    )
    await saveCajasMaestro([...otrasOperativas, ...cajasOperativas, ...cajasSistema])
    await saveParams({ tolerancia })
    setMsg('Configuración guardada')
    reload()
  }

  const onFondoOperativa = async (slug: string, fondo: number) => {
    await updateCajaFondoFijo(slug, fondo)
    setCajasOperativas((prev) =>
      prev.map((c) => (c.slug === slug ? { ...c, fondo_fijo: fondo } : c))
    )
  }

  const resetDatos = () => {
    if (!confirm('¿Borrar TODOS los datos de caja en este navegador? No se puede deshacer.')) return
    localStorage.removeItem('plotlab_control_cajas_v1')
    window.location.reload()
  }

  return (
    <>
      <div className="caja-cc-inline-plotlab">
        <CajaVolverPlotLab small />
      </div>

      <div className="caja-cc-card">
        <h3>Cajas de mostrador</h3>
        <p className="caja-cc-sub">
          Se crean solas al iniciar sesión (<strong>Caja [usuario]</strong>, slug <code>u-{'{id}'}</code>).
          Podés cargar el fondo por operador en el cierre de turno. No se asigna solo (arranca en $ 0).
        </p>
        {cajasOperativas.length === 0 ? (
          <p className="caja-cc-empty">Todavía no hay cajas de mostrador registradas.</p>
        ) : (
          <table className="caja-cc-table">
            <thead>
              <tr>
                <th>Caja</th>
                <th>Usuario ID</th>
                <th className="num">Fondo fijo</th>
                <th>Último arqueo</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {cajasOperativas.map((c) => (
                <tr key={c.slug}>
                  <td>{c.nombre}</td>
                  <td>{c.id_usuario ?? '—'}</td>
                  <td>
                    <input
                      type="number"
                      step="0.01"
                      className="caja-cc-table-input num"
                      value={c.fondo_fijo}
                      onChange={(e) =>
                        void onFondoOperativa(c.slug, parseFloat(e.target.value) || 0)
                      }
                    />
                  </td>
                  <td>{c.ultimoArqueo ?? '—'}</td>
                  <td>{c.activa ? 'Activa' : 'Inactiva'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="caja-cc-card">
        <h3>Cajas de sistema</h3>
        <p className="caja-cc-sub">Administración y vuelto.</p>
        <table className="caja-cc-table">
          <thead>
            <tr>
              <th>Caja</th>
              <th className="num">Fondo fijo</th>
              <th>Activa</th>
            </tr>
          </thead>
          <tbody>
            {cajasSistema.map((c) => (
              <tr key={c.slug}>
                <td>{c.nombre}</td>
                <td>
                  <input
                    type="number"
                    step="0.01"
                    className="caja-cc-table-input num"
                    value={c.fondo_fijo}
                    onChange={(e) =>
                      setCajasSistema((prev) =>
                        prev.map((x) =>
                          x.slug === c.slug ? { ...x, fondo_fijo: parseFloat(e.target.value) || 0 } : x
                        )
                      )
                    }
                  />
                </td>
                <td>
                  <input
                    type="checkbox"
                    checked={c.activa}
                    onChange={(e) =>
                      setCajasSistema((prev) =>
                        prev.map((x) => (x.slug === c.slug ? { ...x, activa: e.target.checked } : x))
                      )
                    }
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="caja-cc-card">
        <h3>Parámetros generales</h3>
        <label className="caja-cc-field">
          Tolerancia de diferencia ($)
          <input
            type="number"
            step="0.01"
            value={tolerancia}
            onChange={(e) => setTolerancia(parseFloat(e.target.value) || 0)}
          />
        </label>
      </div>

      {msg && (
        <CajaMensajeOkPlotLab>
          <p className="caja-cc-ok">{msg}</p>
        </CajaMensajeOkPlotLab>
      )}

      <div className="caja-cc-actions spread">
        <button type="button" className="btn-secondary danger" onClick={resetDatos}>
          Borrar datos locales
        </button>
        <button type="button" className="btn-primary" onClick={() => void guardar()}>
          Guardar configuración
        </button>
      </div>
    </>
  )
}

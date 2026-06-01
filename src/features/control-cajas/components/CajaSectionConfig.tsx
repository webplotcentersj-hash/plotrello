import { useEffect, useState } from 'react'
import { DEFAULT_CAJERAS } from '../constants'
import { newId } from '../format'
import { getParams, listCajasAll, saveCajasMaestro, saveParams } from '../cajaRepository'
import type { CajaCajera, CajaRegistro } from '../types'

export default function CajaSectionConfig() {
  const [cajas, setCajas] = useState<CajaRegistro[]>([])
  const [cajeras, setCajeras] = useState<CajaCajera[]>([])
  const [tolerancia, setTolerancia] = useState(0)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    void Promise.all([listCajasAll(), getParams()]).then(([c, p]) => {
      setCajas(c.length ? c : [])
      setCajeras(p.cajeras.length ? p.cajeras : [...DEFAULT_CAJERAS])
      setTolerancia(p.tolerancia)
    })
  }, [])

  const guardar = async () => {
    await saveCajasMaestro(cajas)
    await saveParams({ tolerancia, cajeras })
    setMsg('Configuración guardada')
  }

  const resetDatos = () => {
    if (!confirm('¿Borrar TODOS los datos de caja en este navegador? No se puede deshacer.')) return
    localStorage.removeItem('plotlab_control_cajas_v1')
    window.location.reload()
  }

  return (
    <>
      <div className="caja-cc-card">
        <h3>Cajas y fondos fijos</h3>
        <table className="caja-cc-table">
          <thead>
            <tr>
              <th>Caja</th>
              <th className="num">Fondo fijo</th>
              <th>Activa</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {cajas.map((c) => (
              <tr key={c.slug}>
                <td>
                  <input
                    className="caja-cc-table-input"
                    value={c.nombre}
                    onChange={(e) =>
                      setCajas((prev) =>
                        prev.map((x) => (x.slug === c.slug ? { ...x, nombre: e.target.value } : x))
                      )
                    }
                  />
                </td>
                <td>
                  <input
                    type="number"
                    step="0.01"
                    className="caja-cc-table-input num"
                    value={c.fondo_fijo}
                    onChange={(e) =>
                      setCajas((prev) =>
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
                      setCajas((prev) =>
                        prev.map((x) => (x.slug === c.slug ? { ...x, activa: e.target.checked } : x))
                      )
                    }
                  />
                </td>
                <td>
                  <button
                    type="button"
                    className="btn-small danger"
                    onClick={() => setCajas((prev) => prev.filter((x) => x.slug !== c.slug))}
                  >
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button
          type="button"
          className="btn-secondary"
          style={{ marginTop: 10 }}
          onClick={() =>
            setCajas((prev) => [
              ...prev,
              { slug: newId().slice(0, 8), nombre: 'Nueva caja', fondo_fijo: 0, activa: true }
            ])
          }
        >
          Agregar caja
        </button>
      </div>

      <div className="caja-cc-card">
        <h3>Cajeras / usuarios</h3>
        <table className="caja-cc-table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Usuario</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {cajeras.map((c, i) => (
              <tr key={i}>
                <td>
                  <input
                    className="caja-cc-table-input"
                    value={c.nombre}
                    onChange={(e) => {
                      const n = [...cajeras]
                      n[i] = { ...n[i], nombre: e.target.value }
                      setCajeras(n)
                    }}
                  />
                </td>
                <td>
                  <input
                    className="caja-cc-table-input"
                    value={c.usuario}
                    onChange={(e) => {
                      const n = [...cajeras]
                      n[i] = { ...n[i], usuario: e.target.value }
                      setCajeras(n)
                    }}
                  />
                </td>
                <td>
                  <button
                    type="button"
                    className="btn-small danger"
                    onClick={() => setCajeras((prev) => prev.filter((_, j) => j !== i))}
                  >
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button
          type="button"
          className="btn-secondary"
          style={{ marginTop: 10 }}
          onClick={() =>
            setCajeras((prev) => [...prev, { nombre: 'Nueva', usuario: `USER${prev.length}` }])
          }
        >
          Agregar cajera
        </button>
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

      {msg && <p className="caja-cc-ok">{msg}</p>}

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

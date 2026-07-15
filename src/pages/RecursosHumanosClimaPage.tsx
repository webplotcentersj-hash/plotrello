import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import {
  rrhhClimaCrearPlantilla,
  rrhhClimaListar,
  rrhhClimaResultados,
  rrhhClimaSetEstado
} from '../services/rrhhExtendidoService'
import type { RrhhClimaEncuesta } from '../types/api'
import './rrhhExtendido.css'

const RecursosHumanosClimaPage = () => {
  const navigate = useNavigate()
  const { usuario, canManageRecursosHumanos, loading: authLoading } = useAuth()
  const canAccess = !!usuario && (canManageRecursosHumanos || usuario.rol === 'gerencia')
  const [encuestas, setEncuestas] = useState<RrhhClimaEncuesta[]>([])
  const [selected, setSelected] = useState<RrhhClimaEncuesta | null>(null)
  const [resultados, setResultados] = useState<
    Array<{ id_pregunta: number; texto: string; tipo: string; promedio: number | null; n: number }>
  >([])
  const [titulo, setTitulo] = useState('Encuesta de clima')
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const res = await rrhhClimaListar()
    if (res.success && res.data) setEncuestas(res.data)
    else setError(res.error || 'Error')
  }, [])

  useEffect(() => {
    if (authLoading) return
    if (!canAccess) {
      navigate('/rrhh')
      return
    }
    void load()
  }, [authLoading, canAccess, navigate, load])

  useEffect(() => {
    if (!selected) return
    void rrhhClimaResultados(selected.id).then((r) => {
      if (r.success && r.data) setResultados(r.data)
    })
  }, [selected])

  const crear = async () => {
    if (!usuario) return
    const res = await rrhhClimaCrearPlantilla({ titulo: titulo.trim() || 'Encuesta de clima', created_by: usuario.id })
    if (!res.success) setError(res.error || 'Error')
    else {
      await load()
      if (res.data) setSelected(res.data)
    }
  }

  const linkPublico = selected ? `${window.location.origin}/encuesta-clima/${selected.id}` : ''

  return (
    <div className="rrhh-ext-page">
      <header className="rrhh-ext-header">
        <div>
          <h1>Encuestas de clima</h1>
          <p>eNPS + preguntas Likert anónimas.</p>
        </div>
        <button type="button" className="rrhh-ext-btn ghost" onClick={() => navigate('/rrhh')}>
          Volver
        </button>
      </header>
      {error ? <p className="rrhh-ext-error">{error}</p> : null}

      <div className="rrhh-ext-grid">
        <div className="rrhh-ext-card">
          <h3>Encuestas</h3>
          <div className="rrhh-ext-form" style={{ marginBottom: 12 }}>
            <label>
              Título
              <input value={titulo} onChange={(e) => setTitulo(e.target.value)} />
            </label>
            <button type="button" className="rrhh-ext-btn primary" onClick={() => void crear()}>
              Crear con plantilla
            </button>
          </div>
          <ul className="rrhh-ext-list">
            {encuestas.map((e) => (
              <li
                key={e.id}
                className={selected?.id === e.id ? 'active' : ''}
                onClick={() => setSelected(e)}
              >
                <span>{e.titulo}</span>
                <span className={`rrhh-ext-badge ${e.estado === 'activa' ? 'ok' : ''}`}>{e.estado}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rrhh-ext-card">
          {selected ? (
            <>
              <h3>{selected.titulo}</h3>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                {selected.estado === 'borrador' ? (
                  <button
                    type="button"
                    className="rrhh-ext-btn primary"
                    onClick={() =>
                      void rrhhClimaSetEstado(selected.id, 'activa').then(() => {
                        void load()
                        setSelected({ ...selected, estado: 'activa' })
                      })
                    }
                  >
                    Activar
                  </button>
                ) : null}
                {selected.estado === 'activa' ? (
                  <button
                    type="button"
                    className="rrhh-ext-btn"
                    onClick={() =>
                      void rrhhClimaSetEstado(selected.id, 'cerrada').then(() => {
                        void load()
                        setSelected({ ...selected, estado: 'cerrada' })
                      })
                    }
                  >
                    Cerrar
                  </button>
                ) : null}
                <button
                  type="button"
                  className="rrhh-ext-btn ghost"
                  onClick={() => {
                    void navigator.clipboard.writeText(linkPublico)
                    alert('Link copiado')
                  }}
                >
                  Copiar link público
                </button>
              </div>
              <p style={{ fontSize: '0.85rem', color: '#94a3b8', wordBreak: 'break-all' }}>{linkPublico}</p>
              <h4>Resultados</h4>
              <table className="rrhh-ext-table">
                <thead>
                  <tr>
                    <th>Pregunta</th>
                    <th>Promedio</th>
                    <th>N</th>
                  </tr>
                </thead>
                <tbody>
                  {resultados.map((r) => (
                    <tr key={r.id_pregunta}>
                      <td>{r.texto}</td>
                      <td>{r.promedio ?? '—'}</td>
                      <td>{r.n}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : (
            <p>Seleccioná una encuesta</p>
          )}
        </div>
      </div>
    </div>
  )
}

export default RecursosHumanosClimaPage

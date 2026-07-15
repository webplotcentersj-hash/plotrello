import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import {
  rrhhOnboardingIniciar,
  rrhhOnboardingListarInstancias,
  rrhhOnboardingToggleItem
} from '../services/rrhhExtendidoService'
import type { RrhhOnboardingInstancia } from '../types/api'
import './rrhhExtendido.css'

const RecursosHumanosOnboardingPage = () => {
  const navigate = useNavigate()
  const { usuario, canManageRecursosHumanos, loading: authLoading } = useAuth()
  const canAccess = !!usuario && (canManageRecursosHumanos || usuario.rol === 'gerencia')
  const [rows, setRows] = useState<RrhhOnboardingInstancia[]>([])
  const [selected, setSelected] = useState<RrhhOnboardingInstancia | null>(null)
  const [loading, setLoading] = useState(true)
  const [nuevoId, setNuevoId] = useState('')
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await rrhhOnboardingListarInstancias()
    if (res.success && res.data) {
      setRows(res.data)
      setSelected((prev) => (prev ? res.data!.find((x) => x.id === prev.id) || null : null))
    } else setError(res.error || 'Error')
    setLoading(false)
  }, [])

  useEffect(() => {
    if (authLoading) return
    if (!canAccess) {
      navigate('/rrhh')
      return
    }
    void load()
  }, [authLoading, canAccess, navigate, load])

  const pct = (inst: RrhhOnboardingInstancia) => {
    const total = inst.progreso?.length || 0
    const hechos = inst.progreso?.filter((p) => p.hecho).length || 0
    return total ? Math.round((hechos / total) * 100) : 0
  }

  const toggle = async (idProgreso: number, hecho: boolean) => {
    if (!usuario || !selected) return
    await rrhhOnboardingToggleItem({
      idProgreso,
      hecho,
      hechoPor: usuario.id,
      idInstancia: selected.id
    })
    await load()
  }

  const iniciarManual = async () => {
    const id = Number(nuevoId)
    if (!id) {
      setError('ID de usuario inválido')
      return
    }
    const res = await rrhhOnboardingIniciar(id)
    if (!res.success) setError(res.error || 'Error')
    else {
      setNuevoId('')
      await load()
    }
  }

  return (
    <div className="rrhh-ext-page">
      <header className="rrhh-ext-header">
        <div>
          <h1>Onboarding / checklist de ingreso</h1>
          <p>Seguimiento de altas: documentación, inducción y accesos.</p>
        </div>
        <button type="button" className="rrhh-ext-btn ghost" onClick={() => navigate('/rrhh')}>
          Volver
        </button>
      </header>

      {error ? <p className="rrhh-ext-error">{error}</p> : null}

      <div className="rrhh-ext-card" style={{ marginBottom: 16 }}>
        <div className="rrhh-ext-form" style={{ flexDirection: 'row', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <label>
            Iniciar checklist para usuario ID
            <input value={nuevoId} onChange={(e) => setNuevoId(e.target.value)} placeholder="Ej. 42" />
          </label>
          <button type="button" className="rrhh-ext-btn primary" onClick={() => void iniciarManual()}>
            Iniciar
          </button>
        </div>
      </div>

      {loading ? (
        <p>Cargando…</p>
      ) : (
        <div className="rrhh-ext-grid">
          <div className="rrhh-ext-card">
            <h3>Ingresos</h3>
            <ul className="rrhh-ext-list">
              {rows.map((r) => (
                <li
                  key={r.id}
                  className={selected?.id === r.id ? 'active' : ''}
                  onClick={() => setSelected(r)}
                >
                  <span>
                    {r.nombre_usuario}
                    <br />
                    <small className={`rrhh-ext-badge ${r.estado === 'completo' ? 'ok' : 'warn'}`}>
                      {r.estado} · {pct(r)}%
                    </small>
                  </span>
                  <span>
                    {r.progreso?.filter((p) => p.hecho).length || 0}/{r.progreso?.length || 0}
                  </span>
                </li>
              ))}
              {rows.length === 0 ? <li style={{ cursor: 'default' }}>Sin instancias</li> : null}
            </ul>
          </div>
          <div className="rrhh-ext-card">
            {selected ? (
              <>
                <h3>
                  {selected.nombre_usuario} — {pct(selected)}%
                </h3>
                {(selected.progreso || [])
                  .slice()
                  .sort((a, b) => (a.item?.orden || 0) - (b.item?.orden || 0))
                  .map((p) => (
                    <label key={p.id} className="rrhh-ext-check">
                      <input
                        type="checkbox"
                        checked={p.hecho}
                        onChange={(e) => void toggle(p.id, e.target.checked)}
                      />
                      <span>
                        <strong>{p.item?.titulo || `Ítem ${p.id_item}`}</strong>
                        {p.item?.obligatorio ? ' · obligatorio' : ''}
                      </span>
                    </label>
                  ))}
              </>
            ) : (
              <p>Seleccioná un ingreso</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default RecursosHumanosOnboardingPage

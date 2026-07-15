import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { rrhhMedicinaCrear, rrhhMedicinaListar } from '../services/rrhhExtendidoService'
import apiService from '../services/api'
import type { RrhhMedicinaRegistro, RrhhMedicinaResultado, RrhhMedicinaTipo } from '../types/api'
import './rrhhExtendido.css'

const RecursosHumanosMedicinaPage = () => {
  const navigate = useNavigate()
  const { usuario, canManageRecursosHumanos, loading: authLoading } = useAuth()
  const canAccess = !!usuario && (canManageRecursosHumanos || usuario.rol === 'gerencia')
  const [rows, setRows] = useState<RrhhMedicinaRegistro[]>([])
  const [usuarios, setUsuarios] = useState<Array<{ id: number; nombre: string }>>([])
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    id_usuario: '',
    tipo: 'preocupacional' as RrhhMedicinaTipo,
    fecha: new Date().toISOString().slice(0, 10),
    resultado: 'apto' as RrhhMedicinaResultado,
    proxima_revision: '',
    proveedor: '',
    observaciones: ''
  })

  const load = useCallback(async () => {
    const [med, us] = await Promise.all([rrhhMedicinaListar(), apiService.getUsuarios()])
    if (med.success && med.data) setRows(med.data)
    else setError(med.error || 'Error')
    if (us.success && us.data) setUsuarios(us.data.map((u) => ({ id: u.id, nombre: u.nombre })))
  }, [])

  useEffect(() => {
    if (authLoading) return
    if (!canAccess) {
      navigate('/rrhh')
      return
    }
    void load()
  }, [authLoading, canAccess, navigate, load])

  const alertas = useMemo(() => {
    const lim = new Date()
    lim.setDate(lim.getDate() + 30)
    return rows.filter((r) => {
      if (!r.proxima_revision) return false
      const d = new Date(r.proxima_revision + 'T12:00:00')
      return d <= lim
    })
  }, [rows])

  const guardar = async () => {
    if (!usuario) return
    const idUsuario = Number(form.id_usuario)
    if (!idUsuario) {
      setError('Elegí empleado')
      return
    }
    const res = await rrhhMedicinaCrear({
      id_usuario: idUsuario,
      tipo: form.tipo,
      fecha: form.fecha,
      resultado: form.resultado,
      proxima_revision: form.proxima_revision || null,
      proveedor: form.proveedor || null,
      observaciones: form.observaciones || null,
      registrado_por: usuario.id
    })
    if (!res.success) setError(res.error || 'Error')
    else {
      setForm((f) => ({ ...f, observaciones: '', proveedor: '', proxima_revision: '' }))
      await load()
    }
  }

  return (
    <div className="rrhh-ext-page">
      <header className="rrhh-ext-header">
        <div>
          <h1>Medicina laboral / ART</h1>
          <p>Exámenes, aptos y próximas revisiones.</p>
        </div>
        <button type="button" className="rrhh-ext-btn ghost" onClick={() => navigate('/rrhh')}>
          Volver
        </button>
      </header>
      {error ? <p className="rrhh-ext-error">{error}</p> : null}

      {alertas.length > 0 ? (
        <div className="rrhh-ext-card" style={{ marginBottom: 16 }}>
          <strong className="rrhh-ext-badge warn">{alertas.length} por vencer / vencidos (30 días)</strong>
          <ul className="rrhh-ext-list">
            {alertas.slice(0, 8).map((a) => (
              <li key={a.id} style={{ cursor: 'default' }}>
                {a.nombre_usuario || a.id_usuario} — {a.proxima_revision} ({a.resultado})
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="rrhh-ext-grid">
        <div className="rrhh-ext-card">
          <h3>Nuevo registro</h3>
          <div className="rrhh-ext-form">
            <label>
              Empleado
              <select
                value={form.id_usuario}
                onChange={(e) => setForm({ ...form, id_usuario: e.target.value })}
              >
                <option value="">—</option>
                {usuarios.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nombre}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Tipo
              <select
                value={form.tipo}
                onChange={(e) => setForm({ ...form, tipo: e.target.value as RrhhMedicinaTipo })}
              >
                <option value="preocupacional">Preocupacional</option>
                <option value="periodico">Periódico</option>
                <option value="egreso">Egreso</option>
                <option value="accidente">Accidente</option>
                <option value="otro">Otro</option>
              </select>
            </label>
            <label>
              Fecha
              <input
                type="date"
                value={form.fecha}
                onChange={(e) => setForm({ ...form, fecha: e.target.value })}
              />
            </label>
            <label>
              Resultado
              <select
                value={form.resultado}
                onChange={(e) => setForm({ ...form, resultado: e.target.value as RrhhMedicinaResultado })}
              >
                <option value="apto">Apto</option>
                <option value="apto_con_restricciones">Apto con restricciones</option>
                <option value="no_apto">No apto</option>
                <option value="pendiente">Pendiente</option>
              </select>
            </label>
            <label>
              Próxima revisión
              <input
                type="date"
                value={form.proxima_revision}
                onChange={(e) => setForm({ ...form, proxima_revision: e.target.value })}
              />
            </label>
            <label>
              Proveedor / ART
              <input
                value={form.proveedor}
                onChange={(e) => setForm({ ...form, proveedor: e.target.value })}
              />
            </label>
            <label>
              Observaciones
              <textarea
                rows={2}
                value={form.observaciones}
                onChange={(e) => setForm({ ...form, observaciones: e.target.value })}
              />
            </label>
            <button type="button" className="rrhh-ext-btn primary" onClick={() => void guardar()}>
              Guardar
            </button>
          </div>
        </div>
        <div className="rrhh-ext-card">
          <h3>Historial</h3>
          <div style={{ overflowX: 'auto' }}>
            <table className="rrhh-ext-table">
              <thead>
                <tr>
                  <th>Empleado</th>
                  <th>Tipo</th>
                  <th>Fecha</th>
                  <th>Resultado</th>
                  <th>Próx.</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.nombre_usuario || r.id_usuario}</td>
                    <td>{r.tipo}</td>
                    <td>{r.fecha}</td>
                    <td>
                      <span
                        className={`rrhh-ext-badge ${
                          r.resultado === 'apto' ? 'ok' : r.resultado === 'no_apto' ? 'bad' : 'warn'
                        }`}
                      >
                        {r.resultado}
                      </span>
                    </td>
                    <td>{r.proxima_revision || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

export default RecursosHumanosMedicinaPage

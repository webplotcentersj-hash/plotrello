import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import {
  rrhhLegajoAsignarPuestoJefe,
  rrhhLegajosOrgListar,
  rrhhPuestoCrear,
  rrhhPuestosListar
} from '../services/rrhhExtendidoService'
import type { RrhhPuesto } from '../types/api'
import './rrhhExtendido.css'

type LegajoOrg = {
  id_usuario: number
  nombre: string
  apellido: string
  sector: string
  id_puesto: number | null
  id_jefe: number | null
}

const RecursosHumanosOrganigramaPage = () => {
  const navigate = useNavigate()
  const { usuario, canManageRecursosHumanos, loading: authLoading } = useAuth()
  const canAccess = !!usuario && (canManageRecursosHumanos || usuario.rol === 'gerencia')
  const [puestos, setPuestos] = useState<RrhhPuesto[]>([])
  const [legajos, setLegajos] = useState<LegajoOrg[]>([])
  const [nuevoNombre, setNuevoNombre] = useState('')
  const [nuevoSector, setNuevoSector] = useState('')
  const [padreId, setPadreId] = useState('')
  const [editUser, setEditUser] = useState('')
  const [editPuesto, setEditPuesto] = useState('')
  const [editJefe, setEditJefe] = useState('')
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [p, l] = await Promise.all([rrhhPuestosListar(), rrhhLegajosOrgListar()])
    if (p.success && p.data) setPuestos(p.data)
    else setError(p.error || 'Error puestos')
    if (l.success && l.data) setLegajos(l.data)
  }, [])

  useEffect(() => {
    if (authLoading) return
    if (!canAccess) {
      navigate('/rrhh')
      return
    }
    void load()
  }, [authLoading, canAccess, navigate, load])

  const roots = useMemo(() => puestos.filter((p) => !p.id_puesto_padre), [puestos])
  const childrenOf = (id: number) => puestos.filter((p) => p.id_puesto_padre === id)
  const empleadosEn = (puestoId: number) =>
    legajos.filter((l) => l.id_puesto === puestoId)

  const renderTree = (nodes: RrhhPuesto[]) => (
    <ul>
      {nodes.map((n) => (
        <li key={n.id}>
          <strong>{n.nombre}</strong>
          {n.sector ? ` · ${n.sector}` : ''}
          <ul>
            {empleadosEn(n.id).map((e) => (
              <li key={e.id_usuario}>
                {e.nombre} {e.apellido}
                {e.id_jefe ? ` (jefe #${e.id_jefe})` : ''}
              </li>
            ))}
          </ul>
          {renderTree(childrenOf(n.id))}
        </li>
      ))}
    </ul>
  )

  const crearPuesto = async () => {
    if (!nuevoNombre.trim()) return
    const res = await rrhhPuestoCrear({
      nombre: nuevoNombre.trim(),
      sector: nuevoSector.trim() || null,
      id_puesto_padre: padreId ? Number(padreId) : null
    })
    if (!res.success) setError(res.error || 'Error')
    else {
      setNuevoNombre('')
      setNuevoSector('')
      setPadreId('')
      await load()
    }
  }

  const asignar = async () => {
    const idUsuario = Number(editUser)
    if (!idUsuario) {
      setError('Elegí colaborador')
      return
    }
    const res = await rrhhLegajoAsignarPuestoJefe({
      idUsuario,
      idPuesto: editPuesto ? Number(editPuesto) : null,
      idJefe: editJefe ? Number(editJefe) : null
    })
    if (!res.success) setError(res.error || 'Error')
    else await load()
  }

  return (
    <div className="rrhh-ext-page">
      <header className="rrhh-ext-header">
        <div>
          <h1>Organigrama / puestos</h1>
          <p>Estructura de puestos y asignación de colaboradores / jefes.</p>
        </div>
        <button type="button" className="rrhh-ext-btn ghost" onClick={() => navigate('/rrhh')}>
          Volver
        </button>
      </header>
      {error ? <p className="rrhh-ext-error">{error}</p> : null}

      <div className="rrhh-ext-grid">
        <div className="rrhh-ext-card rrhh-ext-tree">
          <h3>Árbol</h3>
          {roots.length ? renderTree(roots) : <p>Sin puestos</p>}
          {puestos.filter((p) => p.id_puesto_padre && !puestos.some((x) => x.id === p.id_puesto_padre)).length >
          0 ? (
            <div>
              <h4>Sin padre resuelto</h4>
              {renderTree(
                puestos.filter((p) => p.id_puesto_padre && !puestos.some((x) => x.id === p.id_puesto_padre))
              )}
            </div>
          ) : null}
        </div>
        <div className="rrhh-ext-card">
          <h3>Nuevo puesto</h3>
          <div className="rrhh-ext-form">
            <label>
              Nombre
              <input value={nuevoNombre} onChange={(e) => setNuevoNombre(e.target.value)} />
            </label>
            <label>
              Sector
              <input value={nuevoSector} onChange={(e) => setNuevoSector(e.target.value)} />
            </label>
            <label>
              Puesto padre
              <select value={padreId} onChange={(e) => setPadreId(e.target.value)}>
                <option value="">(raíz)</option>
                {puestos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className="rrhh-ext-btn primary" onClick={() => void crearPuesto()}>
              Crear
            </button>
          </div>
          <h3 style={{ marginTop: 20 }}>Asignar colaborador</h3>
          <div className="rrhh-ext-form">
            <label>
              Colaborador
              <select value={editUser} onChange={(e) => setEditUser(e.target.value)}>
                <option value="">—</option>
                {legajos.map((l) => (
                  <option key={l.id_usuario} value={l.id_usuario}>
                    {l.nombre} {l.apellido} (#{l.id_usuario})
                  </option>
                ))}
              </select>
            </label>
            <label>
              Puesto
              <select value={editPuesto} onChange={(e) => setEditPuesto(e.target.value)}>
                <option value="">—</option>
                {puestos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Jefe (usuario)
              <select value={editJefe} onChange={(e) => setEditJefe(e.target.value)}>
                <option value="">—</option>
                {legajos.map((l) => (
                  <option key={l.id_usuario} value={l.id_usuario}>
                    {l.nombre} {l.apellido}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className="rrhh-ext-btn primary" onClick={() => void asignar()}>
              Guardar asignación
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default RecursosHumanosOrganigramaPage

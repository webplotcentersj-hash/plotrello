import { useCallback, useEffect, useMemo, useState, type MouseEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import {
  rrhhLegajoAsignarPuestoJefe,
  rrhhLegajosOrgListar,
  rrhhPuestoActualizar,
  rrhhPuestoCrear,
  rrhhPuestosListar
} from '../services/rrhhExtendidoService'
import type { RrhhPuesto } from '../types/api'
import './rrhhExtendido.css'
import './RecursosHumanosOrganigramaPage.css'

type LegajoOrg = {
  id_usuario: number
  nombre: string
  apellido: string
  sector: string
  id_puesto: number | null
  id_jefe: number | null
  foto_url: string | null
}

function PersonAvatar({
  person,
  className
}: {
  person: Pick<LegajoOrg, 'nombre' | 'apellido' | 'foto_url'>
  className?: string
}) {
  const label = `${person.nombre} ${person.apellido}`.trim()
  if (person.foto_url) {
    return (
      <span className={`org-avatar org-avatar--photo ${className || ''}`} title={label}>
        <img src={person.foto_url} alt={label} loading="lazy" />
      </span>
    )
  }
  return (
    <span className={`org-avatar ${className || ''}`} title={label}>
      {initials(person.nombre, person.apellido)}
    </span>
  )
}

const SECTOR_COLORS: Record<string, string> = {
  Gerencia: '#f59e0b',
  Administración: '#ef4444',
  'Recursos Humanos': '#ec4899',
  Diseño: '#f97316',
  Imprenta: '#38bdf8',
  'Taller gráfico': '#6366f1',
  Instalaciones: '#a855f7',
  Metalúrgica: '#f472b6',
  Mostrador: '#10b981',
  Caja: '#eab308',
  Compras: '#06b6d4',
  'Asesor técnico': '#14b8a6',
  Presupuestos: '#a78bfa',
  'Desarrollo Web': '#22d3ee'
}

function colorForSector(sector: string | null | undefined): string {
  if (!sector) return '#64748b'
  return SECTOR_COLORS[sector] || '#64748b'
}

function initials(nombre: string, apellido: string): string {
  const a = (nombre || '').trim()[0] || ''
  const b = (apellido || '').trim()[0] || ''
  return (a + b).toUpperCase() || '?'
}

const RecursosHumanosOrganigramaPage = () => {
  const navigate = useNavigate()
  const { usuario, canManageRecursosHumanos, loading: authLoading } = useAuth()
  const canAccess = !!usuario && (canManageRecursosHumanos || usuario.rol === 'gerencia')
  const [puestos, setPuestos] = useState<RrhhPuesto[]>([])
  const [legajos, setLegajos] = useState<LegajoOrg[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [panel, setPanel] = useState<'editar' | 'crear' | 'asignar'>('crear')
  const [formNombre, setFormNombre] = useState('')
  const [formSector, setFormSector] = useState('')
  const [formPadre, setFormPadre] = useState('')
  const [formDesc, setFormDesc] = useState('')
  const [editUser, setEditUser] = useState('')
  const [editPuesto, setEditPuesto] = useState('')
  const [editJefe, setEditJefe] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set())

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

  const selected = useMemo(
    () => (selectedId != null ? puestos.find((p) => p.id === selectedId) || null : null),
    [puestos, selectedId]
  )

  const roots = useMemo(() => puestos.filter((p) => !p.id_puesto_padre), [puestos])
  const orphans = useMemo(
    () =>
      puestos.filter(
        (p) => p.id_puesto_padre != null && !puestos.some((x) => x.id === p.id_puesto_padre)
      ),
    [puestos]
  )
  const childrenOf = useCallback(
    (id: number) => puestos.filter((p) => p.id_puesto_padre === id),
    [puestos]
  )
  const empleadosEn = useCallback(
    (puestoId: number) => legajos.filter((l) => l.id_puesto === puestoId),
    [legajos]
  )
  const nombreUsuario = useCallback(
    (id: number | null) => {
      if (!id) return '—'
      const l = legajos.find((x) => x.id_usuario === id)
      return l ? `${l.nombre} ${l.apellido}`.trim() : `#${id}`
    },
    [legajos]
  )

  const openEdit = (p: RrhhPuesto) => {
    setSelectedId(p.id)
    setPanel('editar')
    setFormNombre(p.nombre)
    setFormSector(p.sector || '')
    setFormPadre(p.id_puesto_padre != null ? String(p.id_puesto_padre) : '')
    setFormDesc(p.descripcion || '')
    setError(null)
    setMsg(null)
  }

  const openCreate = (parentId?: number) => {
    setSelectedId(null)
    setPanel('crear')
    setFormNombre('')
    setFormSector('')
    setFormPadre(parentId != null ? String(parentId) : '')
    setFormDesc('')
    setError(null)
    setMsg(null)
  }

  const openAsignar = (puestoId?: number) => {
    setPanel('asignar')
    setEditPuesto(puestoId != null ? String(puestoId) : selectedId != null ? String(selectedId) : '')
    setEditUser('')
    setEditJefe('')
    setError(null)
    setMsg(null)
  }

  const toggleCollapse = (id: number, e: MouseEvent) => {
    e.stopPropagation()
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const guardarPuesto = async () => {
    if (!formNombre.trim()) {
      setError('El nombre es obligatorio')
      return
    }
    setSaving(true)
    setError(null)
    try {
      if (panel === 'editar' && selected) {
        const res = await rrhhPuestoActualizar(selected.id, {
          nombre: formNombre.trim(),
          sector: formSector.trim() || null,
          id_puesto_padre: formPadre ? Number(formPadre) : null,
          descripcion: formDesc.trim() || null
        })
        if (!res.success) throw new Error(res.error || 'Error al guardar')
        setMsg('Puesto actualizado')
      } else {
        const res = await rrhhPuestoCrear({
          nombre: formNombre.trim(),
          sector: formSector.trim() || null,
          id_puesto_padre: formPadre ? Number(formPadre) : null,
          descripcion: formDesc.trim() || null
        })
        if (!res.success) throw new Error(res.error || 'Error al crear')
        setMsg('Puesto creado')
        if (res.data) openEdit(res.data)
      }
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setSaving(false)
    }
  }

  const desactivarPuesto = async () => {
    if (!selected) return
    if (!confirm(`¿Desactivar el puesto "${selected.nombre}"?`)) return
    setSaving(true)
    const res = await rrhhPuestoActualizar(selected.id, {
      nombre: selected.nombre,
      sector: selected.sector,
      id_puesto_padre: selected.id_puesto_padre,
      descripcion: selected.descripcion,
      activo: false
    })
    setSaving(false)
    if (!res.success) setError(res.error || 'Error')
    else {
      setSelectedId(null)
      setPanel('crear')
      setMsg('Puesto desactivado')
      await load()
    }
  }

  const asignar = async () => {
    const idUsuario = Number(editUser)
    if (!idUsuario) {
      setError('Elegí colaborador')
      return
    }
    setSaving(true)
    const res = await rrhhLegajoAsignarPuestoJefe({
      idUsuario,
      idPuesto: editPuesto ? Number(editPuesto) : null,
      idJefe: editJefe ? Number(editJefe) : null
    })
    setSaving(false)
    if (!res.success) setError(res.error || 'Error')
    else {
      setMsg('Asignación guardada')
      await load()
    }
  }

  const renderNode = (nodes: RrhhPuesto[], depth = 0): ReactNode => {
    if (!nodes.length) return null
    return (
      <ul className={`org-level${depth === 0 ? ' org-level--root' : ''}`}>
        {nodes.map((n) => {
          const kids = childrenOf(n.id)
          const people = empleadosEn(n.id)
          const isOpen = !collapsed.has(n.id)
          const accent = colorForSector(n.sector)
          const active = selectedId === n.id
          return (
            <li key={n.id} className="org-branch">
              <article
                className={`org-node${active ? ' org-node--active' : ''}`}
                style={{ ['--org-accent' as string]: accent }}
                onClick={() => openEdit(n)}
              >
                <div className="org-node-top">
                  <span className="org-node-dot" aria-hidden />
                  <div className="org-node-titles">
                    <h4>{n.nombre}</h4>
                    <p>{n.sector || 'Sin sector'}</p>
                  </div>
                  {kids.length > 0 ? (
                    <button
                      type="button"
                      className="org-node-toggle"
                      onClick={(e) => toggleCollapse(n.id, e)}
                      title={isOpen ? 'Contraer' : 'Expandir'}
                    >
                      {isOpen ? '−' : '+'}
                    </button>
                  ) : null}
                </div>
                {people.length > 0 ? (
                  <div className="org-people">
                    {people.slice(0, 6).map((e) => (
                      <PersonAvatar key={e.id_usuario} person={e} />
                    ))}
                    {people.length > 6 ? (
                      <span className="org-avatar org-avatar--more">+{people.length - 6}</span>
                    ) : null}
                  </div>
                ) : (
                  <p className="org-empty-people">Sin colaboradores</p>
                )}
                <div className="org-node-actions" onClick={(e) => e.stopPropagation()}>
                  <button type="button" onClick={() => openEdit(n)}>
                    Editar
                  </button>
                  <button type="button" onClick={() => openCreate(n.id)}>
                    + Hijo
                  </button>
                  <button type="button" onClick={() => openAsignar(n.id)}>
                    Asignar
                  </button>
                </div>
              </article>
              {kids.length > 0 && isOpen ? renderNode(kids, depth + 1) : null}
            </li>
          )
        })}
      </ul>
    )
  }

  const padresOptions = puestos.filter((p) => p.id !== selectedId)

  return (
    <div className="rrhh-ext-page org-page">
      <header className="rrhh-ext-header">
        <div>
          <h1>Organigrama / puestos</h1>
          <p>Vista gráfica de la estructura. Clic en un puesto para editarlo.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="rrhh-ext-btn primary" onClick={() => openCreate()}>
            + Nuevo puesto
          </button>
          <button type="button" className="rrhh-ext-btn" onClick={() => openAsignar()}>
            Asignar persona
          </button>
          <button type="button" className="rrhh-ext-btn ghost" onClick={() => navigate('/rrhh')}>
            Volver
          </button>
        </div>
      </header>
      {error ? <p className="rrhh-ext-error">{error}</p> : null}
      {msg ? <p className="org-msg">{msg}</p> : null}

      <div className="org-layout">
        <section className="org-canvas">
          <div className="org-canvas-inner">
            {roots.length ? renderNode(roots) : <p className="org-empty">Sin puestos aún</p>}
            {orphans.length > 0 ? (
              <div className="org-orphans">
                <h3>Sin padre en el árbol</h3>
                {renderNode(orphans)}
              </div>
            ) : null}
          </div>
        </section>

        <aside className="org-side">
          <div className="org-tabs">
            <button
              type="button"
              className={panel === 'editar' ? 'active' : ''}
              disabled={!selected}
              onClick={() => selected && openEdit(selected)}
            >
              Editar
            </button>
            <button
              type="button"
              className={panel === 'crear' ? 'active' : ''}
              onClick={() => openCreate()}
            >
              Crear
            </button>
            <button
              type="button"
              className={panel === 'asignar' ? 'active' : ''}
              onClick={() => openAsignar()}
            >
              Asignar
            </button>
          </div>

          {panel === 'asignar' ? (
            <div className="rrhh-ext-form">
              <h3>Asignar colaborador</h3>
              <label>
                Colaborador
                <select value={editUser} onChange={(e) => setEditUser(e.target.value)}>
                  <option value="">—</option>
                  {legajos.map((l) => (
                    <option key={l.id_usuario} value={l.id_usuario}>
                      {l.nombre} {l.apellido}
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
                Jefe
                <select value={editJefe} onChange={(e) => setEditJefe(e.target.value)}>
                  <option value="">—</option>
                  {legajos.map((l) => (
                    <option key={l.id_usuario} value={l.id_usuario}>
                      {l.nombre} {l.apellido}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="rrhh-ext-btn primary"
                disabled={saving}
                onClick={() => void asignar()}
              >
                Guardar asignación
              </button>
            </div>
          ) : (
            <div className="rrhh-ext-form">
              <h3>{panel === 'editar' ? `Editar: ${selected?.nombre || ''}` : 'Nuevo puesto'}</h3>
              <label>
                Nombre
                <input value={formNombre} onChange={(e) => setFormNombre(e.target.value)} />
              </label>
              <label>
                Sector
                <input
                  value={formSector}
                  onChange={(e) => setFormSector(e.target.value)}
                  list="org-sectores"
                />
                <datalist id="org-sectores">
                  {Object.keys(SECTOR_COLORS).map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              </label>
              <label>
                Puesto padre
                <select value={formPadre} onChange={(e) => setFormPadre(e.target.value)}>
                  <option value="">(raíz)</option>
                  {padresOptions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Descripción
                <textarea rows={3} value={formDesc} onChange={(e) => setFormDesc(e.target.value)} />
              </label>
              <button
                type="button"
                className="rrhh-ext-btn primary"
                disabled={saving}
                onClick={() => void guardarPuesto()}
              >
                {panel === 'editar' ? 'Guardar cambios' : 'Crear puesto'}
              </button>
              {panel === 'editar' && selected ? (
                <>
                  <div className="org-side-meta">
                    <p>
                      <strong>{empleadosEn(selected.id).length}</strong> en este puesto
                    </p>
                    {empleadosEn(selected.id).map((e) => (
                      <div key={e.id_usuario} className="org-side-person">
                        <PersonAvatar person={e} />
                        <span>
                          {e.nombre} {e.apellido}
                          <small>Jefe: {nombreUsuario(e.id_jefe)}</small>
                        </span>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="rrhh-ext-btn"
                    disabled={saving}
                    onClick={() => void desactivarPuesto()}
                  >
                    Desactivar puesto
                  </button>
                </>
              ) : null}
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}

export default RecursosHumanosOrganigramaPage

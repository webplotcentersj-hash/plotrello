import { useEffect, useMemo, useState } from 'react'
import type {
  WorkPoolFreelancerResumen,
  WorkPoolProduct,
  WorkPoolSector,
  WorkPoolValoracion
} from '../../types/workPool'
import { WORK_POOL_ESTADO_LABELS, WORK_POOL_SECTOR_LABELS } from '../../types/workPool'
import { sectorsForProduct, defaultSectorForProduct } from './workPoolConfig'
import {
  crearWorkPoolValoracion,
  listValoracionesClientePorOps,
  listWorkPoolValoraciones,
  loadOperarioWorkPoolDetail,
  upsertWorkPoolProfile,
  updateWorkPoolUsuarioNombre,
  type WorkPoolOperarioTrabajoItem
} from './workPoolRepository'

type Props = {
  f: WorkPoolFreelancerResumen
  product: WorkPoolProduct
  idUsuarioAdmin?: number
  onPay: () => void
  onSaved?: () => void
}

function formatArs(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function initials(nombre: string) {
  return nombre
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}

function stars(n: number) {
  const r = Math.round(n)
  return '★'.repeat(Math.max(0, Math.min(5, r))) + '☆'.repeat(Math.max(0, 5 - Math.min(5, r)))
}

export default function WorkPoolFreelancerFicha({
  f,
  product,
  idUsuarioAdmin,
  onPay,
  onSaved
}: Props) {
  const sectors = sectorsForProduct(product)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [okMsg, setOkMsg] = useState('')

  const [sector, setSector] = useState<WorkPoolSector>(
    f.sectores[0] ?? defaultSectorForProduct(product)
  )
  const [nombre, setNombre] = useState(f.nombre)
  const [skills, setSkills] = useState(f.skills.join(', '))
  const [zona, setZona] = useState(f.zona_cobertura ?? '')
  const [activo, setActivo] = useState(f.perfil_activo)
  const [aprobado, setAprobado] = useState(f.perfil_aprobado)
  const [notas, setNotas] = useState(f.notas_admin ?? '')
  const [dirty, setDirty] = useState(false)

  const [trabajos, setTrabajos] = useState<WorkPoolOperarioTrabajoItem[]>([])
  const [valoraciones, setValoraciones] = useState<WorkPoolValoracion[]>([])
  const [newRating, setNewRating] = useState(5)
  const [newComentario, setNewComentario] = useState('')
  const [newOp, setNewOp] = useState('')
  const [savingVal, setSavingVal] = useState(false)

  useEffect(() => {
    if (!open) return
    setSector(f.sectores[0] ?? defaultSectorForProduct(product))
    setSkills(f.skills.join(', '))
    setZona(f.zona_cobertura ?? '')
    setActivo(f.perfil_activo)
    setAprobado(f.perfil_aprobado)
    setNotas(f.notas_admin ?? '')
    setNombre(f.nombre)
    setDirty(false)
    setError('')
    setOkMsg('')
    // Solo al abrir: no pisar lo que el admin está tipeando si el padre re-renderiza.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const markDirty = () => {
    setDirty(true)
    setOkMsg('')
  }

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    void (async () => {
      const detailRes = await loadOperarioWorkPoolDetail({
        idUsuario: f.id_usuario,
        nombre: f.nombre,
        sector: f.sectores[0] ?? defaultSectorForProduct(product)
      })
      if (cancelled) return
      const jobs = detailRes.data?.trabajos ?? []
      setTrabajos(jobs)

      const adminVal = await listWorkPoolValoraciones(f.id_usuario)
      const ops = jobs.map((j) => j.numero_op).filter((x): x is string => Boolean(x))
      const clienteVal = await listValoracionesClientePorOps(ops)
      if (cancelled) return

      const merged = [
        ...(adminVal.data ?? []),
        ...(clienteVal.data ?? [])
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      setValoraciones(merged)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [open, f.id_usuario, f.nombre, f.sectores, product])

  const promedio = useMemo(() => {
    if (valoraciones.length === 0) return null
    const sum = valoraciones.reduce((s, v) => s + v.rating, 0)
    return sum / valoraciones.length
  }, [valoraciones])

  const handleSave = async () => {
    setSaving(true)
    setError('')
    setOkMsg('')
    const skillsArr = skills
      .split(/[,;]+/)
      .map((s) => s.trim())
      .filter(Boolean)

    const nombreTrim = nombre.trim()
    if (!nombreTrim) {
      setSaving(false)
      setError('El nombre no puede quedar vacío')
      return
    }

    if (nombreTrim !== f.nombre.trim()) {
      const nomRes = await updateWorkPoolUsuarioNombre(f.id_usuario, nombreTrim)
      if (!nomRes.success) {
        setSaving(false)
        setError(nomRes.error || 'No se pudo actualizar el nombre')
        return
      }
    }

    const res = await upsertWorkPoolProfile({
      id_usuario: f.id_usuario,
      sector,
      skills: skillsArr,
      zona_cobertura: zona.trim() || null,
      activo,
      aprobado,
      notas_admin: notas.trim() || null
    })
    setSaving(false)
    if (!res.success) {
      setError(res.error || 'No se pudo guardar el perfil')
      return
    }
    setDirty(false)
    setOkMsg('Cambios guardados')
    onSaved?.()
  }

  const handleAddValoracion = async () => {
    setSavingVal(true)
    setError('')
    const res = await crearWorkPoolValoracion({
      id_usuario: f.id_usuario,
      rating: newRating,
      comentario: newComentario,
      numero_op: newOp || undefined,
      id_usuario_autor: idUsuarioAdmin
    })
    setSavingVal(false)
    if (!res.success) {
      setError(res.error || 'No se pudo guardar la valoración')
      return
    }
    setNewComentario('')
    setNewOp('')
    setNewRating(5)
    const adminVal = await listWorkPoolValoraciones(f.id_usuario)
    const ops = trabajos.map((j) => j.numero_op).filter((x): x is string => Boolean(x))
    const clienteVal = await listValoracionesClientePorOps(ops)
    setValoraciones(
      [...(adminVal.data ?? []), ...(clienteVal.data ?? [])].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
    )
  }

  return (
    <article
      className={`work-pool-admin__freelancer-card work-pool-admin__freelancer-card--ficha${open ? ' is-open' : ''}${f.saldo_pendiente > 0 ? ' has-debt' : ''}`}
    >
      <button
        type="button"
        className="work-pool-admin__freelancer-toggle"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {f.foto_url ? (
          <img src={f.foto_url} alt="" className="work-pool-admin__avatar work-pool-admin__avatar--photo" />
        ) : (
          <span className="work-pool-admin__avatar" aria-hidden>
            {initials(f.nombre)}
          </span>
        )}
        <span className="work-pool-admin__freelancer-id">
          <strong className="work-pool-admin__freelancer-name" title={open ? nombre : f.nombre}>
            {open ? nombre || f.nombre : f.nombre}
          </strong>
          <span className="work-pool-admin__freelancer-meta">
            {open ? 'Editá los datos abajo · Guardar cambios' : null}
            {!open ? (
              <>
                {f.sectores.map((s) => WORK_POOL_SECTOR_LABELS[s]).join(' · ') || '—'}
                {f.trabajos_activos > 0 ? ` · ${f.trabajos_activos} activos` : ''}
                {promedio != null ? ` · ${promedio.toFixed(1)}★` : ''}
                {' · expandir'}
              </>
            ) : null}
          </span>
        </span>
        <span className="work-pool-admin__freelancer-saldo" title="Saldo pendiente">
          <small>Saldo</small>
          <b>{formatArs(f.saldo_pendiente)}</b>
        </span>
        <span className="work-pool-admin__freelancer-chev" aria-hidden>
          {open ? '▲' : '▼'}
        </span>
      </button>

      {open ? (
        <div
          className="work-pool-admin__freelancer-body work-pool-ficha-body"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <div className="work-pool-admin__freelancer-stats">
            <div>
              <small>Activos</small>
              <strong>{f.trabajos_activos}</strong>
            </div>
            <div>
              <small>Aprobados</small>
              <strong>{f.trabajos_aprobados}</strong>
            </div>
            <div>
              <small>Revisión</small>
              <strong>{f.pendientes_revision}</strong>
            </div>
            <div>
              <small>Valoración</small>
              <strong>{promedio != null ? promedio.toFixed(1) : '—'}</strong>
            </div>
          </div>

          <section className="work-pool-ficha-block work-pool-ficha-edit">
            <h5>Datos editables {dirty ? <em className="work-pool-ficha-dirty">sin guardar</em> : null}</h5>
            <div className="work-pool-ficha-edit__grid">
              <label>
                Nombre
                <input
                  value={nombre}
                  onChange={(e) => {
                    setNombre(e.target.value)
                    markDirty()
                  }}
                  placeholder="Nombre completo"
                  autoComplete="off"
                />
              </label>
              <label>
                Sector
                <select
                  value={sector}
                  onChange={(e) => {
                    setSector(e.target.value as WorkPoolSector)
                    markDirty()
                  }}
                >
                  {sectors.map((s) => (
                    <option key={s} value={s}>
                      {WORK_POOL_SECTOR_LABELS[s]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Zona
                <input
                  value={zona}
                  onChange={(e) => {
                    setZona(e.target.value)
                    markDirty()
                  }}
                  placeholder="Capital, interior…"
                  autoComplete="off"
                />
              </label>
              <label className="work-pool-ficha-edit__full">
                Skills (separadas por coma)
                <input
                  value={skills}
                  onChange={(e) => {
                    setSkills(e.target.value)
                    markDirty()
                  }}
                  placeholder="illustrator, photoshop, branding…"
                  autoComplete="off"
                />
              </label>
              <label className="work-pool-ficha-edit__full">
                Notas admin
                <textarea
                  value={notas}
                  onChange={(e) => {
                    setNotas(e.target.value)
                    markDirty()
                  }}
                  rows={3}
                  placeholder="Observaciones internas…"
                />
              </label>
            </div>
            <div className="work-pool-ficha-checks">
              <label>
                <input
                  type="checkbox"
                  checked={activo}
                  onChange={(e) => {
                    setActivo(e.target.checked)
                    markDirty()
                  }}
                />
                Activo en bolsa
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={aprobado}
                  onChange={(e) => {
                    setAprobado(e.target.checked)
                    markDirty()
                  }}
                />
                Perfil aprobado
              </label>
            </div>
            <div className="work-pool-ficha-actions">
              <button
                type="button"
                className="work-pool-module__btn work-pool-module__btn--primary"
                disabled={saving || !dirty}
                onClick={() => void handleSave()}
              >
                {saving ? 'Guardando…' : 'Guardar cambios'}
              </button>
              {f.saldo_pendiente > 0 ? (
                <button type="button" className="work-pool-module__btn work-pool-module__btn--ghost" onClick={onPay}>
                  Registrar pago
                </button>
              ) : null}
            </div>
          </section>

          <section className="work-pool-ficha-block">
            <h5>Trabajos ({trabajos.length})</h5>
            {loading ? (
              <p className="work-pool-publicar__muted">Cargando trabajos…</p>
            ) : trabajos.length === 0 ? (
              <p className="work-pool-publicar__muted">Todavía no hay trabajos registrados.</p>
            ) : (
              <ul className="work-pool-ficha-trabajos">
                {trabajos.slice(0, 12).map((t) => (
                  <li key={t.id}>
                    <strong>{t.titulo}</strong>
                    <span>
                      {WORK_POOL_ESTADO_LABELS[t.estado as keyof typeof WORK_POOL_ESTADO_LABELS] ?? t.estado}
                      {t.numero_op ? ` · OP ${t.numero_op}` : ''}
                      {t.monto != null ? ` · ${formatArs(t.monto)}` : ''}
                    </span>
                    <em>{formatDate(t.fecha)}</em>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="work-pool-ficha-block">
            <h5>
              Valoraciones
              {promedio != null ? (
                <span className="work-pool-ficha-promedio">
                  {stars(promedio)} {promedio.toFixed(1)}
                </span>
              ) : null}
            </h5>

            <div className="work-pool-ficha-val-form">
              <label>
                Estrellas
                <select value={newRating} onChange={(e) => setNewRating(Number(e.target.value))}>
                  {[5, 4, 3, 2, 1].map((n) => (
                    <option key={n} value={n}>
                      {n} ★
                    </option>
                  ))}
                </select>
              </label>
              <label>
                OP (opc.)
                <input value={newOp} onChange={(e) => setNewOp(e.target.value)} placeholder="102745" />
              </label>
              <label style={{ gridColumn: '1 / -1' }}>
                Comentario
                <input
                  value={newComentario}
                  onChange={(e) => setNewComentario(e.target.value)}
                  placeholder="Calidad, plazos, comunicación…"
                />
              </label>
              <button
                type="button"
                className="work-pool-module__btn work-pool-module__btn--ghost"
                disabled={savingVal}
                onClick={() => void handleAddValoracion()}
              >
                {savingVal ? 'Guardando…' : 'Agregar valoración'}
              </button>
            </div>

            {valoraciones.length === 0 ? (
              <p className="work-pool-publicar__muted">Sin valoraciones todavía.</p>
            ) : (
              <ul className="work-pool-ficha-vals">
                {valoraciones.map((v) => (
                  <li key={`${v.origen}-${v.id}`}>
                    <strong>
                      {stars(v.rating)}{' '}
                      <em>{v.origen === 'cliente' ? 'Cliente' : 'Admin'}</em>
                    </strong>
                    <span>
                      {v.numero_op ? `OP ${v.numero_op} · ` : ''}
                      {v.comentario || 'Sin comentario'}
                    </span>
                    <small>{formatDate(v.created_at)}</small>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {error ? <div className="work-pool-module__alert work-pool-module__alert--error">{error}</div> : null}
          {okMsg ? <div className="work-pool-module__alert work-pool-module__alert--info">{okMsg}</div> : null}
        </div>
      ) : null}
    </article>
  )
}

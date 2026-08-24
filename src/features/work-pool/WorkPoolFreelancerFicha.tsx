import { useEffect, useMemo, useRef, useState } from 'react'
import type {
  WorkPoolFreelancerResumen,
  WorkPoolProduct,
  WorkPoolSector,
  WorkPoolValoracion
} from '../../types/workPool'
import { WORK_POOL_ESTADO_LABELS, WORK_POOL_SECTOR_LABELS } from '../../types/workPool'
import { sectorsForProduct, defaultSectorForProduct } from './workPoolConfig'
import {
  listValoracionesClientePorOps,
  loadOperarioWorkPoolDetail,
  loadWorkPoolLegajoPersona,
  obtenerLoginUsuarioWorkPool,
  regenerarCredencialesWorkPool,
  saveWorkPoolLegajoPersona,
  sugerirLoginPlotPhiDisponible,
  sugerirPasswordPlotPhiDisponible,
  upsertWorkPoolProfile,
  updateWorkPoolUsuarioNombre,
  type WorkPoolOperarioTrabajoItem
} from './workPoolRepository'
import { loginPlotPhiFromNombre, PLOT_PHI_DOMAIN } from './workPoolCredenciales'
import { OPERARIO_EXTERNO_LOGIN } from './workPoolOperarioExterno'
import { apiService } from '../../services/api'

type Props = {
  f: WorkPoolFreelancerResumen
  product: WorkPoolProduct
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

  const [loginActual, setLoginActual] = useState('')
  const [loginEdit, setLoginEdit] = useState('')
  const [passNueva, setPassNueva] = useState('')
  const [credMsg, setCredMsg] = useState('')
  const [savingCred, setSavingCred] = useState(false)

  const [telefono, setTelefono] = useState('')
  const [dni, setDni] = useState('')
  const [fechaNac, setFechaNac] = useState('')
  const [domicilio, setDomicilio] = useState('')
  const [apellido, setApellido] = useState('')
  const [fotoUrl, setFotoUrl] = useState<string | null>(f.foto_url)
  const [fechaIngreso, setFechaIngreso] = useState<string | null>(null)
  const [uploadingFoto, setUploadingFoto] = useState(false)
  const fotoInputRef = useRef<HTMLInputElement>(null)

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
    setCredMsg('')
    setPassNueva('')
    setFotoUrl(f.foto_url)
    void obtenerLoginUsuarioWorkPool(f.id_usuario).then((res) => {
      if (res.success && res.data) {
        setLoginActual(res.data)
        setLoginEdit(res.data)
      } else {
        const base = loginPlotPhiFromNombre(f.nombre)
        setLoginActual('')
        setLoginEdit(base)
      }
    })
    void loadWorkPoolLegajoPersona(f.id_usuario).then((res) => {
      if (!res.success || !res.data) return
      const L = res.data
      if (L.nombre || L.apellido) {
        const full = [L.nombre, L.apellido].filter(Boolean).join(' ').trim()
        if (full) setNombre(full)
      }
      setApellido(L.apellido ?? '')
      setTelefono(L.telefono ?? '')
      setDni(L.dni ?? '')
      setFechaNac(L.fecha_nacimiento ? String(L.fecha_nacimiento).slice(0, 10) : '')
      setDomicilio(L.direccion ?? '')
      setFechaIngreso(L.fecha_ingreso ? String(L.fecha_ingreso).slice(0, 10) : null)
      if (L.foto_url) setFotoUrl(L.foto_url)
    })
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

      const ops = jobs.map((j) => j.numero_op).filter((x): x is string => Boolean(x))
      const clienteVal = await listValoracionesClientePorOps(ops)
      if (cancelled) return

      setValoraciones(
        (clienteVal.data ?? []).sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
      )
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [open, f.id_usuario, f.nombre, f.sectores, product])

  const promedio = useMemo(() => {
    if (valoraciones.length === 0) return f.valoracion_promedio
    const sum = valoraciones.reduce((s, v) => s + v.rating, 0)
    return Math.round((sum / valoraciones.length) * 10) / 10
  }, [valoraciones, f.valoracion_promedio])

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

    // No pisar el login (usuarios.nombre tipo email) con el nombre visible
    const loginEsEmail = (loginActual || loginEdit).includes('@')
    if (nombreTrim !== f.nombre.trim() && !loginEsEmail) {
      const nomRes = await updateWorkPoolUsuarioNombre(f.id_usuario, nombreTrim)
      if (!nomRes.success) {
        setSaving(false)
        setError(nomRes.error || 'No se pudo actualizar el nombre')
        return
      }
    }

    const parts = nombreTrim.split(/\s+/).filter(Boolean)
    const legajoNombre = parts[0] || nombreTrim
    const legajoApellido = apellido.trim() || (parts.length > 1 ? parts.slice(1).join(' ') : '')

    const legajoRes = await saveWorkPoolLegajoPersona(f.id_usuario, {
      nombre: legajoNombre,
      apellido: legajoApellido || null,
      telefono: telefono.trim() || null,
      dni: dni.trim() || null,
      fecha_nacimiento: fechaNac.trim() || null,
      direccion: domicilio.trim() || null,
      foto_url: fotoUrl,
      email: loginActual.includes('@') ? loginActual : null,
      fecha_ingreso: fechaIngreso,
      sector: WORK_POOL_SECTOR_LABELS[sector] ?? sector
    })
    if (!legajoRes.success) {
      setSaving(false)
      setError(legajoRes.error || 'No se pudo guardar datos personales')
      return
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

  const handleFotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Elegí una imagen (JPG/PNG)')
      return
    }
    setUploadingFoto(true)
    setError('')
    const up = await apiService.uploadFotoEmpleado(file, f.id_usuario)
    if (!up.success || !up.data) {
      setUploadingFoto(false)
      setError(up.error || 'No se pudo subir la foto')
      if (fotoInputRef.current) fotoInputRef.current.value = ''
      return
    }
    setFotoUrl(up.data)
    const legajoRes = await saveWorkPoolLegajoPersona(f.id_usuario, {
      nombre: nombre.trim().split(/\s+/)[0] || f.nombre,
      apellido: apellido.trim() || null,
      telefono: telefono.trim() || null,
      dni: dni.trim() || null,
      fecha_nacimiento: fechaNac.trim() || null,
      direccion: domicilio.trim() || null,
      foto_url: up.data,
      email: loginActual.includes('@') ? loginActual : null,
      fecha_ingreso: fechaIngreso,
      sector: WORK_POOL_SECTOR_LABELS[sector] ?? sector
    })
    setUploadingFoto(false)
    if (!legajoRes.success) {
      setError(legajoRes.error || 'Foto subida pero no se guardó en el legajo')
    } else {
      setOkMsg('Foto actualizada')
      setDirty(true)
      onSaved?.()
    }
    if (fotoInputRef.current) fotoInputRef.current.value = ''
  }

  const regenerarLoginSugerido = async () => {
    setCredMsg('')
    setError('')
    const base = loginPlotPhiFromNombre(nombre || f.nombre)
    setLoginEdit(base)
    const res = await sugerirLoginPlotPhiDisponible(base)
    if (res.success && res.data) setLoginEdit(res.data)
  }

  const regenerarPasswordSugerida = () => {
    setCredMsg('')
    setPassNueva('…')
    void sugerirPasswordPlotPhiDisponible(f.id_usuario).then((res) => {
      if (res.success && res.data) setPassNueva(res.data)
    })
  }

  const handleGuardarCredenciales = async () => {
    setSavingCred(true)
    setError('')
    setCredMsg('')
    const loginTrim = loginEdit.trim().toLowerCase()
    const passTrim = passNueva.trim()
    if (!loginTrim && !passTrim) {
      setSavingCred(false)
      setError('Generá o editá usuario y/o contraseña')
      return
    }

    const loginChanged = loginTrim && loginTrim !== loginActual.trim().toLowerCase()
    if (!loginChanged && !passTrim) {
      setSavingCred(false)
      setError('No hay cambios en las credenciales')
      return
    }

    const res = await regenerarCredencialesWorkPool({
      id_usuario: f.id_usuario,
      nuevo_login: loginChanged ? loginTrim : undefined,
      nueva_password: passTrim || undefined
    })
    setSavingCred(false)
    if (!res.success) {
      setError(res.error || 'No se pudieron regenerar las credenciales')
      return
    }
    const nuevoLogin = res.data?.nombre ?? loginTrim
    setLoginActual(nuevoLogin)
    setLoginEdit(nuevoLogin)
    setCredMsg(
      passTrim
        ? `Credenciales actualizadas y acceso activo. Login: ${nuevoLogin} · Contraseña: ${passTrim} · Ingreso: ${OPERARIO_EXTERNO_LOGIN}`
        : `Login actualizado a ${nuevoLogin} y acceso activo. La contraseña no cambió.`
    )
    setPassNueva('')
    onSaved?.()
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
        {fotoUrl || f.foto_url ? (
          <img src={fotoUrl || f.foto_url || ''} alt="" className="work-pool-admin__avatar work-pool-admin__avatar--photo" />
        ) : (
          <span className="work-pool-admin__avatar" aria-hidden>
            {initials(open ? nombre || f.nombre : f.nombre)}
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
                {promedio != null ? ` · ${promedio.toFixed(1)}★` : ' · sin valoración'}
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

            <div className="work-pool-ficha-foto">
              {fotoUrl ? (
                <img src={fotoUrl} alt="" className="work-pool-ficha-foto__img" />
              ) : (
                <span className="work-pool-ficha-foto__placeholder" aria-hidden>
                  {initials(nombre || f.nombre)}
                </span>
              )}
              <div className="work-pool-ficha-foto__actions">
                <input
                  ref={fotoInputRef}
                  type="file"
                  accept="image/*"
                  className="work-pool-ficha-foto__input"
                  onChange={(e) => void handleFotoChange(e)}
                />
                <button
                  type="button"
                  className="work-pool-module__btn work-pool-module__btn--ghost"
                  disabled={uploadingFoto}
                  onClick={() => fotoInputRef.current?.click()}
                >
                  {uploadingFoto ? 'Subiendo…' : fotoUrl ? 'Cambiar foto' : 'Agregar foto'}
                </button>
                {fotoUrl ? (
                  <button
                    type="button"
                    className="work-pool-module__btn work-pool-module__btn--ghost"
                    onClick={() => {
                      setFotoUrl(null)
                      markDirty()
                    }}
                  >
                    Quitar
                  </button>
                ) : null}
              </div>
            </div>

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
                Apellido
                <input
                  value={apellido}
                  onChange={(e) => {
                    setApellido(e.target.value)
                    markDirty()
                  }}
                  placeholder="Apellido"
                  autoComplete="off"
                />
              </label>
              <label>
                Teléfono
                <input
                  value={telefono}
                  onChange={(e) => {
                    setTelefono(e.target.value)
                    markDirty()
                  }}
                  placeholder="11 1234-5678"
                  inputMode="tel"
                  autoComplete="off"
                />
              </label>
              <label>
                DNI
                <input
                  value={dni}
                  onChange={(e) => {
                    setDni(e.target.value)
                    markDirty()
                  }}
                  placeholder="Documento"
                  autoComplete="off"
                />
              </label>
              <label>
                Fecha de nacimiento
                <input
                  type="date"
                  value={fechaNac}
                  onChange={(e) => {
                    setFechaNac(e.target.value)
                    markDirty()
                  }}
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
              <label className="work-pool-ficha-edit__full">
                Domicilio
                <input
                  value={domicilio}
                  onChange={(e) => {
                    setDomicilio(e.target.value)
                    markDirty()
                  }}
                  placeholder="Calle, número, localidad…"
                  autoComplete="off"
                />
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

          <section className="work-pool-ficha-block work-pool-ficha-creds">
            <h5>Acceso (si olvidó usuario o clave)</h5>
            <p className="work-pool-ficha-creds__hint">
              Login actual: <strong>{loginActual || '—'}</strong>
              {loginActual ? null : ` · sugerido @${PLOT_PHI_DOMAIN}`}
            </p>
            <div className="work-pool-ficha-edit__grid">
              <label className="work-pool-ficha-edit__full">
                Usuario de login
                <div className="work-pool-admin__approve-pass-row">
                  <input
                    value={loginEdit}
                    onChange={(e) => setLoginEdit(e.target.value.trim().toLowerCase())}
                    placeholder={`nombreapellido@${PLOT_PHI_DOMAIN}`}
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    className="work-pool-module__btn work-pool-module__btn--ghost"
                    onClick={() => void regenerarLoginSugerido()}
                  >
                    Regenerar
                  </button>
                </div>
              </label>
              <label className="work-pool-ficha-edit__full">
                Nueva contraseña
                <div className="work-pool-admin__approve-pass-row">
                  <input
                    type="text"
                    value={passNueva}
                    onChange={(e) => setPassNueva(e.target.value)}
                    placeholder="Tocá Regenerar o escribí una"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="work-pool-module__btn work-pool-module__btn--ghost"
                    onClick={regenerarPasswordSugerida}
                  >
                    Regenerar
                  </button>
                </div>
              </label>
            </div>
            <div className="work-pool-ficha-actions">
              <button
                type="button"
                className="work-pool-module__btn work-pool-module__btn--primary"
                disabled={savingCred}
                onClick={() => void handleGuardarCredenciales()}
              >
                {savingCred ? 'Guardando…' : 'Guardar credenciales'}
              </button>
            </div>
            {credMsg ? (
              <div className="work-pool-module__alert work-pool-module__alert--info work-pool-ficha-creds__msg">
                {credMsg}
              </div>
            ) : null}
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
            <p className="work-pool-publicar__muted work-pool-ficha-val-hint">
              Las pone el cliente en la encuesta de entrega (portal / firma).
            </p>

            {valoraciones.length === 0 ? (
              <p className="work-pool-publicar__muted">
                Todavía no hay calificaciones en las OPs de este perfil.
              </p>
            ) : (
              <ul className="work-pool-ficha-vals">
                {valoraciones.map((v) => (
                  <li key={`${v.origen}-${v.id}`}>
                    <strong>
                      {stars(v.rating)} <em>Cliente</em>
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

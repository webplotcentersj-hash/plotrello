import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import {
  aceptarSolicitudAltaCliente,
  listarSolicitudesAltaCliente,
  rechazarSolicitudAltaCliente,
  type EstadoSolicitudAltaCliente,
  type SolicitudAltaCliente
} from '../services/solicitudesAltaClienteService'
import { CONDICIONES_IVA_CLIENTE, cuitValido } from '../utils/afipFacturaUi'
import { CLIENTES_DASHBOARD, clientesPerfil } from '../utils/clientesRoutes'
import { ALTA_CLIENTE_PUBLICO, formatearDniCuit, soloDigitos } from '../utils/solicitudAltaCliente'
import './SolicitudesAltaClientePage.css'

type Filtro = EstadoSolicitudAltaCliente | 'todas'

const FILTROS: Array<{ id: Filtro; label: string }> = [
  { id: 'pendiente', label: 'Pendientes' },
  { id: 'aceptada', label: 'Aceptadas' },
  { id: 'rechazada', label: 'Rechazadas' },
  { id: 'todas', label: 'Todas' }
]

type Edicion = {
  nombre: string
  apellido: string
  dni_cuit: string
  telefono: string
  direccion: string
  email: string
  condicion_iva: string
  razon_social: string
}

function edicionDe(s: SolicitudAltaCliente): Edicion {
  return {
    nombre: s.nombre,
    apellido: s.apellido,
    dni_cuit: s.dni_cuit,
    telefono: s.telefono,
    direccion: s.direccion,
    email: s.email,
    condicion_iva: s.condicion_iva,
    razon_social: s.razon_social || ''
  }
}

function hace(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const min = Math.round(ms / 60000)
  if (min < 1) return 'recién'
  if (min < 60) return `hace ${min} min`
  const h = Math.round(min / 60)
  if (h < 24) return `hace ${h} h`
  const d = Math.round(h / 24)
  return d === 1 ? 'ayer' : `hace ${d} días`
}

export default function SolicitudesAltaClientePage() {
  const navigate = useNavigate()
  const { canAccessMostradorViews, usuario } = useAuth()
  const [filtro, setFiltro] = useState<Filtro>('pendiente')
  const [todas, setTodas] = useState<SolicitudAltaCliente[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ texto: string; idCliente?: number } | null>(null)
  const [selId, setSelId] = useState<number | null>(null)
  const [edicion, setEdicion] = useState<Edicion | null>(null)
  const [vincular, setVincular] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [rechazando, setRechazando] = useState(false)
  const [busy, setBusy] = useState(false)
  const [copiado, setCopiado] = useState(false)

  const linkPublico = `${window.location.origin}${ALTA_CLIENTE_PUBLICO}`

  const cargar = useCallback(async () => {
    if (!usuario?.id) return
    setCargando(true)
    setError(null)
    const res = await listarSolicitudesAltaCliente(usuario.id, null)
    if (res.success) setTodas(res.data)
    else setError(res.error)
    setCargando(false)
  }, [usuario?.id])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const conteo = useMemo(() => {
    const c: Record<Filtro, number> = { pendiente: 0, aceptada: 0, rechazada: 0, todas: todas.length }
    for (const s of todas) c[s.estado] += 1
    return c
  }, [todas])

  const lista = useMemo(() => (filtro === 'todas' ? todas : todas.filter((s) => s.estado === filtro)), [todas, filtro])
  const sel = todas.find((s) => s.id === selId) || null

  useEffect(() => {
    if (sel && lista.some((s) => s.id === sel.id)) return
    const primero = lista[0] || null
    setSelId(primero?.id ?? null)
  }, [lista, sel])

  useEffect(() => {
    setEdicion(sel ? edicionDe(sel) : null)
    setVincular(!!sel?.posible_duplicado_id)
    setMotivo('')
    setRechazando(false)
    // Solo al cambiar de solicitud.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel?.id])

  if (!canAccessMostradorViews) {
    return (
      <div className="sac-page">
        <p className="sac-vacio">No tenés permiso para gestionar clientes.</p>
      </div>
    )
  }

  const copiarLink = async () => {
    try {
      await navigator.clipboard.writeText(linkPublico)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 1800)
    } catch {
      setCopiado(false)
    }
  }

  const textoWhatsapp = encodeURIComponent(
    `¡Hola! Para darte de alta como cliente de Plot Center completá tus datos acá: ${linkPublico}`
  )

  const docEditado = edicion ? soloDigitos(edicion.dni_cuit) : ''
  const avisoDoc =
    edicion && docEditado.length === 11 && !cuitValido(docEditado)
      ? 'El CUIT no pasa el dígito verificador'
      : edicion && ![7, 8, 11].includes(docEditado.length)
        ? 'DNI de 7–8 dígitos o CUIT de 11'
        : null

  const aceptar = async () => {
    if (!sel || !edicion || !usuario?.id) return
    setBusy(true)
    setError(null)
    setMsg(null)
    const original = edicionDe(sel)
    const correcciones: Partial<Edicion> = {}
    for (const k of Object.keys(edicion) as Array<keyof Edicion>) {
      if (edicion[k].trim() !== original[k].trim()) correcciones[k] = edicion[k].trim()
    }
    const res = await aceptarSolicitudAltaCliente({
      id: sel.id,
      actorId: usuario.id,
      vincularClienteId: vincular ? sel.posible_duplicado_id : null,
      correcciones
    })
    setBusy(false)
    if (!res.success) {
      setError(
        /email/i.test(res.error) && /registrado/i.test(res.error)
          ? `${res.error}. Si es el mismo cliente, vinculalo con el existente; si no, corregí el email.`
          : res.error
      )
      return
    }
    setMsg({
      texto: vincular
        ? `${sel.nombre} ${sel.apellido} quedó vinculado al cliente existente.`
        : `${sel.nombre} ${sel.apellido} quedó dado de alta como cliente.`,
      idCliente: res.data
    })
    await cargar()
  }

  const rechazar = async () => {
    if (!sel || !usuario?.id) return
    setBusy(true)
    setError(null)
    setMsg(null)
    const res = await rechazarSolicitudAltaCliente(sel.id, usuario.id, motivo.trim())
    setBusy(false)
    if (!res.success) {
      setError(res.error)
      return
    }
    setMsg({ texto: `Solicitud de ${sel.nombre} ${sel.apellido} rechazada.` })
    await cargar()
  }

  const campo = (k: keyof Edicion, label: string, opts?: { span2?: boolean; aviso?: string | null }) => (
    <label className={opts?.span2 ? 'sac-span2' : undefined}>
      {label}
      <input
        value={edicion?.[k] ?? ''}
        disabled={!sel || sel.estado !== 'pendiente' || busy}
        onChange={(e) => setEdicion((p) => (p ? { ...p, [k]: e.target.value } : p))}
      />
      {opts?.aviso ? <small className="sac-aviso">{opts.aviso}</small> : null}
    </label>
  )

  return (
    <div className="sac-page">
      <header className="sac-header">
        <button type="button" className="sac-back" onClick={() => navigate(CLIENTES_DASHBOARD)}>
          ← Clientes
        </button>
        <div className="sac-header-row">
          <div>
            <h1>Solicitudes de alta de cliente</h1>
            <p>Lo que completan los clientes nuevos en el formulario. Al aceptar, se cargan en Clientes.</p>
          </div>
          <button type="button" className="sac-btn" onClick={() => void cargar()} disabled={cargando}>
            {cargando ? 'Actualizando…' : 'Actualizar'}
          </button>
        </div>
      </header>

      <section className="sac-compartir">
        <div>
          <strong>Link para el cliente</strong>
          <span>Mandáselo a quien quiera ser cliente: lo completa desde el celular, sin usuario.</span>
        </div>
        <div className="sac-compartir-acciones">
          <code>{linkPublico}</code>
          <button type="button" className="sac-btn" onClick={() => void copiarLink()}>
            {copiado ? '¡Copiado!' : 'Copiar'}
          </button>
          <a className="sac-btn sac-btn--wa" href={`https://wa.me/?text=${textoWhatsapp}`} target="_blank" rel="noreferrer">
            WhatsApp
          </a>
          <a className="sac-btn sac-btn--ghost" href={ALTA_CLIENTE_PUBLICO} target="_blank" rel="noreferrer">
            Ver formulario
          </a>
        </div>
      </section>

      {error ? (
        <p className="sac-error" role="alert">
          {error}
        </p>
      ) : null}
      {msg ? (
        <p className="sac-ok" role="status">
          {msg.texto}{' '}
          {msg.idCliente ? (
            <button type="button" className="sac-link" onClick={() => navigate(clientesPerfil(msg.idCliente!))}>
              Ver ficha del cliente →
            </button>
          ) : null}
        </p>
      ) : null}

      <nav className="sac-filtros" aria-label="Estado">
        {FILTROS.map((f) => (
          <button
            key={f.id}
            type="button"
            className={`sac-filtro${filtro === f.id ? ' is-on' : ''}`}
            onClick={() => setFiltro(f.id)}
          >
            {f.label}
            <span className={`sac-badge${f.id === 'pendiente' && conteo.pendiente > 0 ? ' is-hot' : ''}`}>
              {conteo[f.id]}
            </span>
          </button>
        ))}
      </nav>

      <div className="sac-main">
        <section className="sac-lista" aria-label="Solicitudes">
          {cargando && !todas.length ? <p className="sac-vacio">Cargando…</p> : null}
          {!cargando && !lista.length ? (
            <p className="sac-vacio">
              {filtro === 'pendiente' ? 'No hay solicitudes pendientes.' : 'No hay solicitudes en esta vista.'}
            </p>
          ) : null}
          {lista.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`sac-item${s.id === selId ? ' is-sel' : ''}`}
              onClick={() => setSelId(s.id)}
            >
              <span className="sac-item-top">
                <strong>
                  {s.nombre} {s.apellido}
                </strong>
                <span className={`sac-estado is-${s.estado}`}>{s.estado}</span>
              </span>
              <span className="sac-item-sub">
                {s.condicion_iva} · {formatearDniCuit(s.dni_cuit)}
              </span>
              <span className="sac-item-sub">
                {hace(s.created_at)}
                {s.posible_duplicado_id ? <span className="sac-dup-tag">¿ya es cliente?</span> : null}
              </span>
            </button>
          ))}
        </section>

        <section className="sac-detalle">
          {!sel || !edicion ? (
            <p className="sac-vacio">Elegí una solicitud.</p>
          ) : (
            <>
              <div className="sac-detalle-head">
                <div>
                  <h2>
                    {sel.nombre} {sel.apellido}
                  </h2>
                  <span className="sac-muted">
                    Recibida {new Date(sel.created_at).toLocaleString('es-AR')}
                    {sel.revisado_at
                      ? ` · ${sel.estado} por ${sel.revisado_por_nombre || 'personal'} el ${new Date(sel.revisado_at).toLocaleString('es-AR')}`
                      : ''}
                  </span>
                </div>
                <span className={`sac-estado is-${sel.estado}`}>{sel.estado}</span>
              </div>

              {sel.estado === 'aceptada' && sel.id_cliente ? (
                <p className="sac-ok">
                  {sel.cliente_existente ? 'Vinculada a un cliente que ya existía.' : 'Cliente creado.'}{' '}
                  <button type="button" className="sac-link" onClick={() => navigate(clientesPerfil(sel.id_cliente!))}>
                    Ver ficha →
                  </button>
                </p>
              ) : null}
              {sel.estado === 'rechazada' ? (
                <p className="sac-error">Rechazada{sel.motivo_rechazo ? `: ${sel.motivo_rechazo}` : '.'}</p>
              ) : null}

              {sel.estado === 'pendiente' && sel.posible_duplicado_id ? (
                <div className="sac-dup">
                  <p>
                    Ya hay un cliente con el mismo DNI/CUIT o email:{' '}
                    <button
                      type="button"
                      className="sac-link"
                      onClick={() => window.open(clientesPerfil(sel.posible_duplicado_id!), '_blank')}
                    >
                      {sel.posible_duplicado_nombre || `#${sel.posible_duplicado_id}`}
                    </button>
                  </p>
                  <label className="sac-check">
                    <input type="radio" checked={vincular} onChange={() => setVincular(true)} /> Es el mismo:
                    vincular y completar los datos que falten en su ficha
                  </label>
                  <label className="sac-check">
                    <input type="radio" checked={!vincular} onChange={() => setVincular(false)} /> Es otra persona:
                    crear un cliente nuevo
                  </label>
                </div>
              ) : null}

              <div className="sac-form">
                {campo('nombre', 'Nombre')}
                {campo('apellido', 'Apellido')}
                {campo('dni_cuit', 'DNI / CUIT', { aviso: avisoDoc })}
                <label>
                  Condición de IVA
                  <select
                    value={edicion.condicion_iva}
                    disabled={sel.estado !== 'pendiente' || busy}
                    onChange={(e) => setEdicion((p) => (p ? { ...p, condicion_iva: e.target.value } : p))}
                  >
                    {CONDICIONES_IVA_CLIENTE.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </label>
                {campo('telefono', 'Teléfono')}
                {campo('email', 'Email')}
                {campo('direccion', 'Domicilio', { span2: true })}
                {campo('razon_social', 'Razón social / empresa', { span2: true })}
                {sel.observaciones ? (
                  <div className="sac-span2 sac-obs">
                    <span>Comentario del cliente</span>
                    <p>{sel.observaciones}</p>
                  </div>
                ) : null}
              </div>

              {sel.estado === 'pendiente' ? (
                rechazando ? (
                  <div className="sac-rechazo">
                    <label>
                      Motivo del rechazo (queda registrado)
                      <input
                        value={motivo}
                        onChange={(e) => setMotivo(e.target.value)}
                        placeholder="Ej. datos falsos, duplicada, spam…"
                        autoFocus
                      />
                    </label>
                    <div className="sac-acciones">
                      <button type="button" className="sac-btn sac-btn--danger" onClick={() => void rechazar()} disabled={busy}>
                        Confirmar rechazo
                      </button>
                      <button type="button" className="sac-btn sac-btn--ghost" onClick={() => setRechazando(false)} disabled={busy}>
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="sac-acciones">
                    <button
                      type="button"
                      className="sac-btn sac-btn--primary"
                      onClick={() => void aceptar()}
                      disabled={busy || !edicion.nombre.trim() || !!avisoDoc}
                    >
                      {busy ? 'Guardando…' : vincular && sel.posible_duplicado_id ? 'Aceptar y vincular' : 'Aceptar y dar de alta'}
                    </button>
                    <button type="button" className="sac-btn sac-btn--ghost" onClick={() => setRechazando(true)} disabled={busy}>
                      Rechazar
                    </button>
                  </div>
                )
              ) : null}
            </>
          )}
        </section>
      </div>
    </div>
  )
}

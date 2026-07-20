import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useDmMensajeriaUnread } from '../hooks/useDmMensajeriaUnread'
import apiService from '../services/api'
import { supabase } from '../services/supabaseClient'
import RrhhMessagingCenter from '../components/RrhhMessagingCenter'
import type { Notification, SolicitudPermiso, UsuarioRecord } from '../types/api'
import './AvisarAusenciaPage.css'

const MOTIVOS = [
  'Enfermedad / consulta médica',
  'Familiar a cargo',
  'Trámite personal',
  'Otro'
] as const

const LOGO_URL = '/plot-lab-logo.png'

async function uploadCertificado(userId: number, file: File): Promise<string> {
  if (!supabase) throw new Error('No hay conexión a Supabase')
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
  const path = `solicitudes-permisos/${userId}/${Date.now()}.${ext}`
  const { error } = await supabase.storage.from('archivos').upload(path, file, {
    upsert: true,
    contentType: file.type || undefined
  })
  if (error) throw new Error(error.message)
  const { data } = supabase.storage.from('archivos').getPublicUrl(path)
  if (!data?.publicUrl) throw new Error('No se obtuvo la URL del archivo')
  return data.publicUrl
}

function formatNotifTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat('es-AR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

export default function AvisarAusenciaPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { usuario, loading: authLoading, nombreVisible } = useAuth()
  const dmUnread = useDmMensajeriaUnread(usuario?.id)

  const [motivo, setMotivo] = useState<string>(MOTIVOS[0])
  const [motivoOtro, setMotivoOtro] = useState('')
  const [ubicacion, setUbicacion] = useState('')
  const [fechaInicio, setFechaInicio] = useState(() => new Date().toISOString().slice(0, 10))
  const [fechaFin, setFechaFin] = useState(() => new Date().toISOString().slice(0, 10))
  const [detalle, setDetalle] = useState('')
  const [archivo, setArchivo] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [okMsg, setOkMsg] = useState<string | null>(null)
  const [historial, setHistorial] = useState<SolicitudPermiso[]>([])
  const [histLoading, setHistLoading] = useState(false)
  const [comunicados, setComunicados] = useState<Notification[]>([])
  const [comLoading, setComLoading] = useState(false)
  const [highlightSolicitudId, setHighlightSolicitudId] = useState<number | null>(null)
  const [highlightComunicadoId, setHighlightComunicadoId] = useState<number | null>(null)
  const [usuariosMsg, setUsuariosMsg] = useState<UsuarioRecord[]>([])
  const [msgLoading, setMsgLoading] = useState(false)
  const [dmPeerId, setDmPeerId] = useState<number | null>(null)
  const [showMensajeria, setShowMensajeria] = useState(false)

  const histRefs = useRef<Map<number, HTMLLIElement>>(new Map())
  const comRefs = useRef<Map<number, HTMLLIElement>>(new Map())
  const mensajeriaRef = useRef<HTMLElement | null>(null)

  const dias = useMemo(() => {
    const a = Date.parse(fechaInicio)
    const b = Date.parse(fechaFin)
    if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return 1
    return Math.ceil((b - a) / 86400000) + 1
  }, [fechaInicio, fechaFin])

  const loadHistorial = useCallback(async () => {
    if (!usuario?.id) return
    setHistLoading(true)
    try {
      const r = await apiService.obtenerSolicitudesPermisos(usuario.id, null, null, null, null)
      if (r.success && r.data) {
        const ausencias = r.data
          .filter((s) => s.tipo_solicitud === 'ausencia' || s.tipo_solicitud === 'permiso')
          .sort((x, y) => Date.parse(y.fecha_solicitud) - Date.parse(x.fecha_solicitud))
          .slice(0, 20)
        setHistorial(ausencias)
      } else {
        setHistorial([])
      }
    } catch {
      setHistorial([])
    } finally {
      setHistLoading(false)
    }
  }, [usuario?.id])

  const loadComunicados = useCallback(async () => {
    if (!usuario?.id) return
    setComLoading(true)
    try {
      const r = await apiService.getUserNotificationsRrhhMasivos(usuario.id, 30)
      if (r.success && r.data) {
        setComunicados(r.data)
      } else {
        setComunicados([])
      }
    } catch {
      setComunicados([])
    } finally {
      setComLoading(false)
    }
  }, [usuario?.id])

  const loadUsuariosMsg = useCallback(async () => {
    setMsgLoading(true)
    try {
      const r = await apiService.getUsuarios()
      setUsuariosMsg(r.success && r.data ? r.data : [])
    } catch {
      setUsuariosMsg([])
    } finally {
      setMsgLoading(false)
    }
  }, [])

  useEffect(() => {
    if (authLoading) return
    if (!usuario) {
      const next = encodeURIComponent('/avisar-ausencia')
      navigate(`/login?next=${next}`, { replace: true })
      return
    }
    void loadHistorial()
    void loadComunicados()
  }, [authLoading, usuario, navigate, loadHistorial, loadComunicados])

  useEffect(() => {
    if (!showMensajeria || usuariosMsg.length > 0 || msgLoading) return
    void loadUsuariosMsg()
  }, [showMensajeria, usuariosMsg.length, msgLoading, loadUsuariosMsg])

  useEffect(() => {
    const m = searchParams.get('motivo')
    if (m && MOTIVOS.includes(m as (typeof MOTIVOS)[number])) setMotivo(m)

    const solRaw = searchParams.get('solicitud')
    const solId = solRaw ? Number(solRaw) : NaN
    setHighlightSolicitudId(Number.isFinite(solId) && solId > 0 ? solId : null)

    const comRaw = searchParams.get('comunicado')
    const comId = comRaw ? Number(comRaw) : NaN
    setHighlightComunicadoId(Number.isFinite(comId) && comId > 0 ? comId : null)

    const dmRaw = searchParams.get('dm')
    const dmId = dmRaw ? Number(dmRaw) : NaN
    const openMsg =
      searchParams.get('mensajeria') === '1' ||
      searchParams.get('mensajeria') === 'true' ||
      (Number.isFinite(dmId) && dmId > 0)
    if (openMsg) setShowMensajeria(true)
    setDmPeerId(Number.isFinite(dmId) && dmId > 0 ? dmId : null)
  }, [searchParams])

  useEffect(() => {
    if (!showMensajeria) return
    const t = window.setTimeout(() => {
      mensajeriaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 80)
    return () => window.clearTimeout(t)
  }, [showMensajeria])

  useEffect(() => {
    if (highlightSolicitudId == null || histLoading) return
    const el = histRefs.current.get(highlightSolicitudId)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [highlightSolicitudId, histLoading, historial])

  useEffect(() => {
    if (highlightComunicadoId == null || comLoading) return
    const el = comRefs.current.get(highlightComunicadoId)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
    const target = comunicados.find((c) => c.id === highlightComunicadoId)
    if (target && !target.is_read) {
      void apiService.markNotificationAsRead(target.id)
      setComunicados((prev) =>
        prev.map((c) => (c.id === target.id ? { ...c, is_read: true } : c))
      )
    }
    // Solo al abrir por deep-link / al terminar de cargar la lista
    // eslint-disable-next-line react-hooks/exhaustive-deps -- evitar loop al marcar leído
  }, [highlightComunicadoId, comLoading])

  const markComunicadoRead = async (n: Notification) => {
    if (n.is_read) return
    await apiService.markNotificationAsRead(n.id)
    setComunicados((prev) => prev.map((c) => (c.id === n.id ? { ...c, is_read: true } : c)))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!usuario?.id) return
    if (!ubicacion.trim()) {
      setError('Indicá dónde estás (ciudad / domicilio).')
      return
    }
    const motivoFinal = motivo === 'Otro' ? motivoOtro.trim() || 'Otro' : motivo
    if (motivo === 'Otro' && !motivoOtro.trim()) {
      setError('Completá el motivo.')
      return
    }

    setSaving(true)
    setError(null)
    setOkMsg(null)
    try {
      let adjuntoUrl: string | null = null
      if (archivo) {
        adjuntoUrl = await uploadCertificado(usuario.id, archivo)
      }

      const titulo = `Ausencia: ${motivoFinal}`
      const descripcion = [
        `Motivo: ${motivoFinal}`,
        `Ubicación: ${ubicacion.trim()}`,
        detalle.trim() ? `Detalle: ${detalle.trim()}` : '',
        'Aviso desde /avisar-ausencia (celular). Solo plataforma — no WhatsApp.'
      ]
        .filter(Boolean)
        .join('\n')

      const hoy = new Date().toISOString().slice(0, 10)
      const res = await apiService.crearSolicitudPermiso(
        usuario.id,
        'ausencia',
        titulo,
        descripcion,
        hoy,
        fechaInicio || hoy,
        fechaFin || fechaInicio || hoy,
        dias,
        ubicacion.trim(),
        adjuntoUrl
      )

      if (!res.success) {
        setError(res.error || 'No se pudo registrar el aviso.')
        return
      }

      setOkMsg(
        adjuntoUrl
          ? '✅ Ausencia avisada con certificado. RRHH ya fue notificado.'
          : '✅ Ausencia avisada. Si tenés certificado médico, subilo dentro de las 24 hs desde este mismo lugar (o adjuntálo en un nuevo aviso con el PDF).'
      )
      setDetalle('')
      setArchivo(null)
      setMotivoOtro('')
      void loadHistorial()
      if (res.data?.id) {
        setHighlightSolicitudId(res.data.id)
        setSearchParams(
          (prev) => {
            const next = new URLSearchParams(prev)
            next.set('solicitud', String(res.data!.id))
            next.delete('comunicado')
            return next
          },
          { replace: true }
        )
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al avisar la ausencia')
    } finally {
      setSaving(false)
    }
  }

  if (authLoading || !usuario) {
    return (
      <div className="avisar-ausencia-page">
        <div className="avisar-ausencia-loading">Cargando…</div>
      </div>
    )
  }

  const unreadComs = comunicados.filter((c) => !c.is_read).length

  return (
    <div className="avisar-ausencia-page">
      <header className="avisar-ausencia-header">
        <img src={LOGO_URL} alt="Plot Center" className="avisar-ausencia-logo" />
        <div>
          <p className="avisar-ausencia-kicker">Recursos Humanos · Plot Center</p>
          <h1>Avisar ausencia</h1>
          <p className="avisar-ausencia-lead">
            Hola {nombreVisible?.split(' ')[0] || 'equipo'}. Si no podés venir, hacelo acá desde el
            celular. Solo plataforma — no WhatsApp.
          </p>
        </div>
      </header>

      <section className="avisar-ausencia-comunicados" aria-label="Comunicados RRHH">
        <div className="avisar-ausencia-comunicados-head">
          <h2>Comunicados RRHH</h2>
          {unreadComs > 0 ? (
            <span className="avisar-ausencia-com-badge">{unreadComs} nuevo{unreadComs === 1 ? '' : 's'}</span>
          ) : null}
        </div>
        {comLoading ? (
          <p className="avisar-ausencia-hint">Cargando comunicados…</p>
        ) : comunicados.length === 0 ? (
          <p className="avisar-ausencia-hint">No hay comunicados por ahora.</p>
        ) : (
          <ul>
            {comunicados.map((n) => (
              <li
                key={n.id}
                ref={(el) => {
                  if (el) comRefs.current.set(n.id, el)
                  else comRefs.current.delete(n.id)
                }}
                className={`${n.is_read ? '' : 'avisar-ausencia-com--nuevo'}${
                  highlightComunicadoId === n.id ? ' avisar-ausencia-com--focus' : ''
                }`}
              >
                <button type="button" onClick={() => void markComunicadoRead(n)}>
                  <strong>{n.title}</strong>
                  {!n.is_read ? <span className="avisar-ausencia-com-dot">Nuevo</span> : null}
                  {n.description ? <p>{n.description}</p> : null}
                  <time dateTime={n.timestamp}>{formatNotifTime(n.timestamp)}</time>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="avisar-ausencia-msg-entry" aria-label="Mensajería interna">
        <button
          type="button"
          className="avisar-ausencia-msg-toggle"
          onClick={() => {
            setShowMensajeria((v) => {
              const next = !v
              if (next) {
                setSearchParams(
                  (prev) => {
                    const p = new URLSearchParams(prev)
                    p.set('mensajeria', '1')
                    return p
                  },
                  { replace: true }
                )
              } else {
                setSearchParams(
                  (prev) => {
                    const p = new URLSearchParams(prev)
                    p.delete('mensajeria')
                    p.delete('dm')
                    return p
                  },
                  { replace: true }
                )
              }
              return next
            })
          }}
        >
          <span className="avisar-ausencia-msg-toggle-icon" aria-hidden>
            ✉️
          </span>
          <span className="avisar-ausencia-msg-toggle-text">
            <strong>Mensajería interna</strong>
            <span>Escribile a RRHH o a un compañero · 1 a 1</span>
          </span>
          {dmUnread > 0 ? (
            <span className="avisar-ausencia-msg-unread">{dmUnread}</span>
          ) : null}
        </button>
      </section>

      {showMensajeria && (
        <section
          ref={mensajeriaRef}
          className="avisar-ausencia-mensajeria"
          id="mensajeria-interna"
        >
          {msgLoading && usuariosMsg.length === 0 ? (
            <p className="avisar-ausencia-hint">Cargando contactos…</p>
          ) : (
            <RrhhMessagingCenter
              usuarios={usuariosMsg}
              currentUserId={usuario.id}
              currentUserName={nombreVisible || usuario.nombre || 'Usuario'}
              title="Mensajería interna"
              subtitle={`${usuariosMsg.length > 0 ? usuariosMsg.length - 1 : 0} contactos · mensajes privados (no es el chat del tablero)`}
              compact
              initialPeerId={dmPeerId}
            />
          )}
          <button
            type="button"
            className="avisar-ausencia-ghost"
            onClick={() => navigate('/mensajeria')}
          >
            Abrir mensajería completa
          </button>
        </section>
      )}

      <section className="avisar-ausencia-steps" aria-label="Pasos">
        <ol>
          <li>
            <strong>1. Avisá apenas lo sepas</strong>
            <span>Dentro de las primeras 2 horas de tu jornada.</span>
          </li>
          <li>
            <strong>2. Pedile al médico el certificado digital</strong>
            <span>Diagnóstico, días de reposo, matrícula y firma.</span>
          </li>
          <li>
            <strong>3. Subilo acá dentro de las 24 hs</strong>
            <span>Foto clara o PDF del certificado.</span>
          </li>
          <li>
            <strong>4. El sistema hace el resto</strong>
            <span>RRHH revisa y te notifica el resultado.</span>
          </li>
        </ol>
      </section>

      <div className="avisar-ausencia-warn" role="note">
        Si no avisás o no justificás, la falta puede quedar <strong>injustificada</strong> (descuento,
        pérdida de presentismo y sanciones).
      </div>

      <form className="avisar-ausencia-form" onSubmit={(e) => void handleSubmit(e)}>
        <label>
          Motivo
          <select value={motivo} onChange={(e) => setMotivo(e.target.value)}>
            {MOTIVOS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>

        {motivo === 'Otro' && (
          <label>
            Especificá el motivo
            <input
              value={motivoOtro}
              onChange={(e) => setMotivoOtro(e.target.value)}
              placeholder="Ej: trámite judicial"
              required
            />
          </label>
        )}

        <label>
          ¿Dónde estás? *
          <input
            value={ubicacion}
            onChange={(e) => setUbicacion(e.target.value)}
            placeholder="Ciudad / domicilio / clínica"
            required
            autoComplete="street-address"
          />
        </label>

        <div className="avisar-ausencia-dates">
          <label>
            Desde
            <input
              type="date"
              value={fechaInicio}
              onChange={(e) => {
                setFechaInicio(e.target.value)
                if (fechaFin < e.target.value) setFechaFin(e.target.value)
              }}
              required
            />
          </label>
          <label>
            Hasta
            <input
              type="date"
              value={fechaFin}
              min={fechaInicio}
              onChange={(e) => setFechaFin(e.target.value)}
              required
            />
          </label>
        </div>
        <p className="avisar-ausencia-hint">{dias} día{dias === 1 ? '' : 's'} de ausencia</p>

        <label>
          Detalle (opcional)
          <textarea
            rows={3}
            value={detalle}
            onChange={(e) => setDetalle(e.target.value)}
            placeholder="Síntomas, turno médico, etc."
          />
        </label>

        <label className="avisar-ausencia-file">
          Certificado / constancia (opcional ahora)
          <input
            type="file"
            accept="image/*,application/pdf"
            onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
          />
          <span>
            {archivo
              ? archivo.name
              : 'Si es por enfermedad, subí foto o PDF dentro de las 24 hs.'}
          </span>
        </label>

        {error && (
          <p className="avisar-ausencia-error" role="alert">
            {error}
          </p>
        )}
        {okMsg && (
          <p className="avisar-ausencia-ok" role="status">
            {okMsg}
          </p>
        )}

        <button type="submit" className="avisar-ausencia-submit" disabled={saving}>
          {saving ? 'Enviando…' : 'Enviar aviso a RRHH'}
        </button>
      </form>

      <section className="avisar-ausencia-hist">
        <h2>Tus últimos avisos</h2>
        {histLoading ? (
          <p className="avisar-ausencia-hint">Cargando…</p>
        ) : historial.length === 0 ? (
          <p className="avisar-ausencia-hint">Todavía no tenés avisos registrados.</p>
        ) : (
          <ul>
            {historial.map((s) => (
              <li
                key={s.id}
                ref={(el) => {
                  if (el) histRefs.current.set(s.id, el)
                  else histRefs.current.delete(s.id)
                }}
                className={highlightSolicitudId === s.id ? 'avisar-ausencia-hist--focus' : undefined}
              >
                <div>
                  <strong>{s.titulo}</strong>
                  <span className={`avisar-ausencia-badge estado-${s.estado}`}>{s.estado}</span>
                </div>
                <p>
                  {s.fecha_inicio || s.fecha_solicitud}
                  {s.fecha_fin && s.fecha_fin !== s.fecha_inicio ? ` → ${s.fecha_fin}` : ''}
                </p>
                {s.archivo_adjunto_url ? (
                  <a href={s.archivo_adjunto_url} target="_blank" rel="noreferrer">
                    Ver adjunto
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <footer className="avisar-ausencia-footer">
        <p>
          Consultas: <a href="mailto:sol.oliver@plotcenter.com.ar">sol.oliver@plotcenter.com.ar</a>
        </p>
      </footer>
    </div>
  )
}

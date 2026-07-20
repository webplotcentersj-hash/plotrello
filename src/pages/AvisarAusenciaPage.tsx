import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useDmMensajeriaUnread } from '../hooks/useDmMensajeriaUnread'
import apiService from '../services/api'
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
  /** 1 = avisar · 2 = certificado · 3 = listo */
  const [formPaso, setFormPaso] = useState<1 | 2 | 3>(1)
  const [avisoCreadoId, setAvisoCreadoId] = useState<number | null>(null)
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
  const [uploadingAdjuntoId, setUploadingAdjuntoId] = useState<number | null>(null)

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
    const hasSol = Number.isFinite(solId) && solId > 0
    setHighlightSolicitudId(hasSol ? solId : null)
    if (hasSol) setAvisoCreadoId(solId)

    const pasoRaw = searchParams.get('paso')
    if (pasoRaw === '2' || pasoRaw === '3') {
      setFormPaso(Number(pasoRaw) as 2 | 3)
    } else if (hasSol) {
      setFormPaso(2)
    }

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
    if (!avisoCreadoId || histLoading || historial.length === 0) return
    const s = historial.find((x) => x.id === avisoCreadoId)
    if (!s) return
    if (s.archivo_adjunto_url && formPaso === 2) {
      setFormPaso(3)
    }
  }, [avisoCreadoId, historial, histLoading, formPaso])

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

  const handleSubmitAviso = async (e: React.FormEvent) => {
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
      const titulo = `Ausencia: ${motivoFinal}`
      const descripcion = [
        `Motivo: ${motivoFinal}`,
        `Ubicación: ${ubicacion.trim()}`,
        detalle.trim() ? `Detalle: ${detalle.trim()}` : '',
        'Paso 1: aviso desde /avisar-ausencia. Certificado en paso siguiente (24 hs).'
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
        null
      )

      if (!res.success || !res.data?.id) {
        setError(res.error || 'No se pudo registrar el aviso.')
        return
      }

      setAvisoCreadoId(res.data.id)
      setHighlightSolicitudId(res.data.id)
      setFormPaso(2)
      setOkMsg('✅ Paso 1 listo: RRHH ya recibió tu aviso. Ahora podés subir el certificado.')
      setArchivo(null)
      void loadHistorial()
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          next.set('solicitud', String(res.data!.id))
          next.set('paso', '2')
          next.delete('comunicado')
          return next
        },
        { replace: true }
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al avisar la ausencia')
    } finally {
      setSaving(false)
    }
  }

  const handleSubmitCertificado = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!usuario?.id || !avisoCreadoId) return
    if (!archivo) {
      setError('Elegí una foto o PDF del certificado.')
      return
    }

    setSaving(true)
    setError(null)
    try {
      const up = await apiService.subirAdjuntoSolicitudPermiso(archivo, usuario.id)
      if (!up.success || !up.data?.url) {
        setError(up.error || 'No se pudo subir el certificado.')
        return
      }
      const adj = await apiService.adjuntarArchivoSolicitudPermiso(
        avisoCreadoId,
        usuario.id,
        up.data.url
      )
      if (!adj.success) {
        setError(adj.error || 'No se pudo enviar el certificado a RRHH')
        return
      }
      setArchivo(null)
      setFormPaso(3)
      setOkMsg('✅ Certificado enviado. RRHH lo revisa y te avisa el resultado.')
      void loadHistorial()
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          next.set('paso', '3')
          return next
        },
        { replace: true }
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al subir el certificado')
    } finally {
      setSaving(false)
    }
  }

  const saltarCertificado = () => {
    setError(null)
    setFormPaso(3)
    setOkMsg(
      'Aviso registrado. Recordá subir el certificado dentro de las 24 hs (abajo en tus avisos o volviendo a esta pantalla).'
    )
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.set('paso', '3')
        return next
      },
      { replace: true }
    )
  }

  const reiniciarFlujo = () => {
    setFormPaso(1)
    setAvisoCreadoId(null)
    setArchivo(null)
    setDetalle('')
    setMotivoOtro('')
    setUbicacion('')
    setOkMsg(null)
    setError(null)
    setMotivo(MOTIVOS[0])
    const hoy = new Date().toISOString().slice(0, 10)
    setFechaInicio(hoy)
    setFechaFin(hoy)
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.delete('paso')
        next.delete('solicitud')
        return next
      },
      { replace: true }
    )
  }

  const handleAdjuntarAHistorial = async (solicitudId: number, file: File | null) => {
    if (!usuario?.id || !file) return
    setUploadingAdjuntoId(solicitudId)
    setError(null)
    try {
      const up = await apiService.subirAdjuntoSolicitudPermiso(file, usuario.id)
      if (!up.success || !up.data?.url) {
        setError(up.error || 'No se pudo subir el archivo')
        return
      }
      const adj = await apiService.adjuntarArchivoSolicitudPermiso(
        solicitudId,
        usuario.id,
        up.data.url
      )
      if (!adj.success) {
        setError(adj.error || 'No se pudo asociar el adjunto a la solicitud')
        return
      }
      setOkMsg('✅ Certificado enviado a RRHH.')
      setHighlightSolicitudId(solicitudId)
      setAvisoCreadoId(solicitudId)
      setFormPaso(3)
      void loadHistorial()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al adjuntar')
    } finally {
      setUploadingAdjuntoId(null)
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
          <li className={formPaso === 1 ? 'is-current' : formPaso > 1 ? 'is-done' : undefined}>
            <strong>1. Avisá apenas lo sepas</strong>
            <span>Motivo, dónde estás y fechas. Solo esto primero.</span>
          </li>
          <li className={formPaso === 2 ? 'is-current' : formPaso > 2 ? 'is-done' : 'is-locked'}>
            <strong>2. Certificado médico</strong>
            <span>Se habilita después del aviso. Pedilo digital al médico.</span>
          </li>
          <li className={formPaso === 3 ? 'is-current' : formPaso > 2 ? 'is-done' : 'is-locked'}>
            <strong>3. Subilo acá (24 hs)</strong>
            <span>Foto o PDF. RRHH lo recibe en la misma solicitud.</span>
          </li>
          <li className={formPaso === 3 ? 'is-done' : 'is-locked'}>
            <strong>4. El sistema hace el resto</strong>
            <span>RRHH revisa y te notifica el resultado.</span>
          </li>
        </ol>
      </section>

      <div className="avisar-ausencia-warn" role="note">
        Si no avisás o no justificás, la falta puede quedar <strong>injustificada</strong> (descuento,
        pérdida de presentismo y sanciones).
      </div>

      {formPaso === 1 && (
        <form className="avisar-ausencia-form" onSubmit={(e) => void handleSubmitAviso(e)}>
          <p className="avisar-ausencia-paso-label">Paso 1 de 3 · Solo el aviso</p>
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

          <p className="avisar-ausencia-hint">
            El certificado se habilita en el siguiente paso, después de enviar el aviso.
          </p>

          {error && (
            <p className="avisar-ausencia-error" role="alert">
              {error}
            </p>
          )}

          <button type="submit" className="avisar-ausencia-submit" disabled={saving}>
            {saving ? 'Enviando aviso…' : '1. Enviar aviso a RRHH'}
          </button>
        </form>
      )}

      {formPaso === 2 && (
        <form className="avisar-ausencia-form" onSubmit={(e) => void handleSubmitCertificado(e)}>
          <p className="avisar-ausencia-paso-label">Paso 2 de 3 · Certificado</p>
          {okMsg && (
            <p className="avisar-ausencia-ok" role="status">
              {okMsg}
            </p>
          )}
          <div className="avisar-ausencia-paso-box">
            <strong>Pedile al médico el certificado digital</strong>
            <span>
              Debe incluir diagnóstico, tratamiento, días de reposo, fecha, matrícula y firma. Sin eso
              no es válido.
            </span>
          </div>
          <label className="avisar-ausencia-file">
            Subí foto o PDF del certificado *
            <input
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
              required
            />
            <span>{archivo ? archivo.name : 'Dentro de las 24 horas del aviso.'}</span>
          </label>

          {error && (
            <p className="avisar-ausencia-error" role="alert">
              {error}
            </p>
          )}

          <button type="submit" className="avisar-ausencia-submit" disabled={saving || !archivo}>
            {saving ? 'Subiendo…' : '2. Enviar certificado a RRHH'}
          </button>
          <button
            type="button"
            className="avisar-ausencia-ghost avisar-ausencia-ghost--block"
            onClick={saltarCertificado}
            disabled={saving}
          >
            Todavía no lo tengo — seguir sin certificado
          </button>
        </form>
      )}

      {formPaso === 3 && (
        <div className="avisar-ausencia-form avisar-ausencia-form--done">
          <p className="avisar-ausencia-paso-label">Paso 3 · Listo</p>
          {okMsg && (
            <p className="avisar-ausencia-ok" role="status">
              {okMsg}
            </p>
          )}
          <div className="avisar-ausencia-paso-box">
            <strong>El sistema hace el resto</strong>
            <span>
              RRHH revisa tu aviso{avisoCreadoId ? ` (#${avisoCreadoId})` : ''} y te notifica el
              resultado. Si falta el certificado, subilo desde “Tus últimos avisos”.
            </span>
          </div>
          <button type="button" className="avisar-ausencia-submit" onClick={reiniciarFlujo}>
            Avisar otra ausencia
          </button>
        </div>
      )}

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
                    Ver adjunto enviado a RRHH
                  </a>
                ) : (
                  <label className="avisar-ausencia-adjuntar">
                    {uploadingAdjuntoId === s.id ? 'Subiendo…' : '📎 Subir certificado a RRHH'}
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      disabled={uploadingAdjuntoId === s.id}
                      onChange={(e) => {
                        const f = e.target.files?.[0] ?? null
                        e.target.value = ''
                        void handleAdjuntarAHistorial(s.id, f)
                      }}
                    />
                  </label>
                )}
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

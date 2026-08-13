import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import apiService from '../services/api'
import type { RrhhNovedadAdjunto, RrhhSolicitudHe, RrhhSolicitudHeTipo } from '../types/api'
import { fechaCortaEs } from '../utils/rrhhLiquidacion'
import './MisHorasExtraPage.css'

const LOGO_URL = '/plot-lab-logo.png'

function tipoLabel(tipo: RrhhSolicitudHeTipo) {
  return tipo === 'horas_extra_100' ? '100%' : '50%'
}

function estadoLabel(estado: RrhhSolicitudHe['estado']) {
  if (estado === 'aprobado') return 'Aprobada'
  if (estado === 'rechazado') return 'Rechazada'
  if (estado === 'cancelado') return 'Cancelada'
  return 'Pendiente'
}

export default function MisHorasExtraPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { usuario, loading: authLoading, nombreVisible } = useAuth()

  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10))
  const [tipo, setTipo] = useState<RrhhSolicitudHeTipo>('horas_extra_50')
  const [horas, setHoras] = useState('1')
  const [detalle, setDetalle] = useState('')
  const [archivos, setArchivos] = useState<File[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [okMsg, setOkMsg] = useState<string | null>(null)
  const [historial, setHistorial] = useState<RrhhSolicitudHe[]>([])
  const [histLoading, setHistLoading] = useState(false)
  const highlightId = Number(searchParams.get('solicitud') || 0) || null

  const previews = useMemo(
    () => archivos.map((f) => ({ name: f.name, url: URL.createObjectURL(f) })),
    [archivos]
  )

  useEffect(() => {
    return () => {
      previews.forEach((p) => URL.revokeObjectURL(p.url))
    }
  }, [previews])

  const loadHistorial = useCallback(async () => {
    if (!usuario?.id) return
    setHistLoading(true)
    try {
      const r = await apiService.rrhhSolicitudesHeListar({ idUsuario: usuario.id })
      setHistorial(r.success && r.data ? r.data : [])
    } catch {
      setHistorial([])
    } finally {
      setHistLoading(false)
    }
  }, [usuario?.id])

  useEffect(() => {
    if (authLoading) return
    if (!usuario) {
      navigate(`/login?next=${encodeURIComponent('/horas-extra')}`, { replace: true })
      return
    }
    void loadHistorial()
  }, [authLoading, usuario, navigate, loadHistorial])

  const enviar = async () => {
    if (!usuario?.id) return
    const hs = Number(String(horas).replace(',', '.'))
    if (!Number.isFinite(hs) || hs <= 0 || hs > 24) {
      setError('Indicá las horas (hasta 24).')
      return
    }
    if (!detalle.trim()) {
      setError('Escribí qué hiciste o por qué son extra (además del reloj).')
      return
    }
    setSaving(true)
    setError(null)
    setOkMsg(null)
    try {
      const adjuntos: RrhhNovedadAdjunto[] = []
      for (const file of archivos) {
        const up = await apiService.rrhhNovedadSubirAdjunto(file, usuario.id)
        if (!up.success || !up.data) throw new Error(up.error || `No se pudo subir ${file.name}`)
        adjuntos.push(up.data)
      }
      const res = await apiService.rrhhSolicitudHeCrear({
        id_usuario: usuario.id,
        fecha,
        tipo,
        horas: Math.round(hs * 100) / 100,
        observaciones: detalle.trim(),
        adjuntos
      })
      if (!res.success) throw new Error(res.error || 'No se pudo enviar')
      setOkMsg('Enviado. RRHH lo revisa 1 a 1; si lo aprueba, entra en la liquidación.')
      setDetalle('')
      setHoras('1')
      setArchivos([])
      void loadHistorial()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al enviar')
    } finally {
      setSaving(false)
    }
  }

  const cancelar = async (s: RrhhSolicitudHe) => {
    if (!usuario?.id || s.estado !== 'pendiente') return
    if (!confirm('¿Cancelar esta declaración de horas extra?')) return
    const r = await apiService.rrhhSolicitudHeCancelar(s.id, usuario.id)
    if (!r.success) {
      setError(r.error || 'No se pudo cancelar')
      return
    }
    void loadHistorial()
  }

  if (authLoading || !usuario) {
    return (
      <div className="mis-he-page mis-he-loading">
        <p>Cargando…</p>
      </div>
    )
  }

  return (
    <div className="mis-he-page">
      <header className="mis-he-header">
        <img src={LOGO_URL} alt="" className="mis-he-logo" />
        <div>
          <p className="mis-he-kicker">Plot Lab · RRHH</p>
          <h1>Mis horas extra</h1>
          <p className="mis-he-lead">
            Hola {nombreVisible?.split(' ')[0] || ''}. Cargá horas extra que no cubre el reloj (viaje,
            trabajo fuera, etc.), con foto y texto. RRHH o admin las aprueba una por una.
          </p>
        </div>
      </header>

      <section className="mis-he-card">
        <h2>Nueva declaración</h2>
        <label>
          Fecha
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </label>
        <fieldset className="mis-he-tipo">
          <legend>Tipo</legend>
          <label>
            <input
              type="radio"
              name="tipo-he"
              checked={tipo === 'horas_extra_50'}
              onChange={() => setTipo('horas_extra_50')}
            />
            50% (hábil / extra habitual)
          </label>
          <label>
            <input
              type="radio"
              name="tipo-he"
              checked={tipo === 'horas_extra_100'}
              onChange={() => setTipo('horas_extra_100')}
            />
            100% (domingo / feriado)
          </label>
        </fieldset>
        <label>
          Horas
          <input
            type="number"
            min={0.25}
            max={24}
            step={0.25}
            value={horas}
            onChange={(e) => setHoras(e.target.value)}
          />
        </label>
        <label>
          Qué hiciste / por qué son extra
          <textarea
            rows={4}
            value={detalle}
            onChange={(e) => setDetalle(e.target.value)}
            placeholder="Ej. Instalación en cliente hasta las 21, no pude marcar salida…"
          />
        </label>
        <label>
          Fotos o comprobantes
          <input
            type="file"
            accept="image/*,.pdf"
            multiple
            onChange={(e) => setArchivos(Array.from(e.target.files || []))}
          />
        </label>
        {previews.length > 0 ? (
          <div className="mis-he-previews">
            {previews.map((p) => (
              <a key={p.url} href={p.url} target="_blank" rel="noreferrer">
                {/\.(pdf)(\?|$)/i.test(p.name) ? p.name : <img src={p.url} alt={p.name} />}
              </a>
            ))}
          </div>
        ) : null}
        {error ? <p className="mis-he-error">{error}</p> : null}
        {okMsg ? <p className="mis-he-ok">{okMsg}</p> : null}
        <button type="button" className="mis-he-submit" disabled={saving} onClick={() => void enviar()}>
          {saving ? 'Enviando…' : 'Enviar a RRHH'}
        </button>
      </section>

      <section className="mis-he-card">
        <h2>Mis envíos</h2>
        {histLoading ? <p className="mis-he-muted">Cargando…</p> : null}
        {!histLoading && historial.length === 0 ? (
          <p className="mis-he-muted">Todavía no declaraste horas extra.</p>
        ) : null}
        <ul className="mis-he-list">
          {historial.map((s) => (
            <li
              key={s.id}
              className={`mis-he-item is-${s.estado}${highlightId === s.id ? ' is-hl' : ''}`}
            >
              <div>
                <strong>
                  {fechaCortaEs(s.fecha)} · {s.horas} h · {tipoLabel(s.tipo)}
                </strong>
                <span className={`mis-he-badge is-${s.estado}`}>{estadoLabel(s.estado)}</span>
              </div>
              <p>{s.observaciones}</p>
              {s.motivo_rechazo ? <p className="mis-he-error">Rechazo: {s.motivo_rechazo}</p> : null}
              {s.adjuntos.length > 0 ? (
                <div className="mis-he-previews">
                  {s.adjuntos.map((a) => (
                    <a key={a.url} href={a.url} target="_blank" rel="noreferrer">
                      {/image\//i.test(a.mime) || /\.(png|jpe?g|webp|gif|heic)(\?|$)/i.test(a.url) ? (
                        <img src={a.url} alt={a.nombre} />
                      ) : (
                        a.nombre
                      )}
                    </a>
                  ))}
                </div>
              ) : null}
              {s.estado === 'pendiente' ? (
                <button type="button" className="mis-he-cancel" onClick={() => void cancelar(s)}>
                  Cancelar
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

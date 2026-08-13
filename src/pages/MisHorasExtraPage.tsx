import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import apiService from '../services/api'
import type { Asistencia, RrhhNovedadAdjunto, RrhhSolicitudHe, RrhhSolicitudHeTipo } from '../types/api'
import {
  calcularHorasExtraDiaDetalle,
  type HorarioFijoAsistencia
} from '../utils/asistenciaStats'
import { asistenciaHoraCorta } from '../utils/dateUtils'
import { etiquetaPeriodoEs, fechaCortaEs, periodoRango } from '../utils/rrhhLiquidacion'
import './MisHorasExtraPage.css'

const LOGO_URL = '/plot-lab-logo.png'

function mesActualYm(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function tipoLabel(tipo: RrhhSolicitudHeTipo) {
  return tipo === 'horas_extra_100' ? '100%' : '50%'
}

function estadoLabel(estado: RrhhSolicitudHe['estado']) {
  if (estado === 'aprobado') return 'Aprobada'
  if (estado === 'rechazado') return 'Rechazada'
  if (estado === 'cancelado') return 'Cancelada'
  return 'Pendiente'
}

function fmtHs(n: number) {
  const v = Math.round(n * 100) / 100
  return Number.isInteger(v) ? String(v) : v.toFixed(2)
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
  const [periodo, setPeriodo] = useState(mesActualYm)
  const [asistenciaMes, setAsistenciaMes] = useState<Asistencia[]>([])
  const [horarioMes, setHorarioMes] = useState<HorarioFijoAsistencia | null>(null)
  const [relojLoading, setRelojLoading] = useState(false)
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

  const loadRelojMes = useCallback(async () => {
    if (!usuario?.id || !periodo) return
    setRelojLoading(true)
    try {
      const { desde, hasta } = periodoRango(periodo)
      const [asistRes, horRes] = await Promise.all([
        apiService.obtenerAsistencia(usuario.id, desde, hasta),
        apiService.obtenerHorariosFijos(periodo)
      ])
      setAsistenciaMes(asistRes.success && asistRes.data ? asistRes.data : [])
      const h = horRes.success && horRes.data ? horRes.data[usuario.id] : undefined
      setHorarioMes(
        h
          ? {
              entrada: h.entrada,
              salida: h.salida,
              horas: h.horas,
              trabajaSabado: h.trabajaSabado,
              sabadoEntrada: h.sabadoEntrada,
              sabadoSalida: h.sabadoSalida
            }
          : null
      )
    } catch {
      setAsistenciaMes([])
      setHorarioMes(null)
    } finally {
      setRelojLoading(false)
    }
  }, [usuario?.id, periodo])

  useEffect(() => {
    if (authLoading) return
    if (!usuario) {
      navigate(`/login?next=${encodeURIComponent('/horas-extra')}`, { replace: true })
      return
    }
    void loadHistorial()
  }, [authLoading, usuario, navigate, loadHistorial])

  useEffect(() => {
    if (!usuario?.id || authLoading) return
    void loadRelojMes()
  }, [usuario?.id, authLoading, loadRelojMes])

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
      const mesFecha = String(fecha || '').slice(0, 7)
      if (mesFecha && mesFecha !== periodo) setPeriodo(mesFecha)
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

  const historialMes = useMemo(
    () => historial.filter((s) => String(s.fecha || '').slice(0, 7) === periodo),
    [historial, periodo]
  )

  const cuentaAprobadas = useMemo(() => {
    let extra50 = 0
    let extra100 = 0
    let pendientesHs = 0
    for (const s of historialMes) {
      if (s.estado === 'pendiente') pendientesHs += s.horas
      if (s.estado !== 'aprobado') continue
      if (s.tipo === 'horas_extra_100') extra100 += s.horas
      else extra50 += s.horas
    }
    return {
      extra50: Math.round(extra50 * 100) / 100,
      extra100: Math.round(extra100 * 100) / 100,
      total: Math.round((extra50 + extra100) * 100) / 100,
      pendientesHs: Math.round(pendientesHs * 100) / 100,
      cantidad: historialMes.filter((s) => s.estado === 'aprobado').length
    }
  }, [historialMes])

  const diasReloj = useMemo(() => {
    const out: Array<{
      fecha: string
      extra50: number
      extra100: number
      total: number
      entrada: string
      salida: string
    }> = []
    for (const a of asistenciaMes) {
      const f = String(a.fecha || '').slice(0, 10)
      if (!f.startsWith(periodo)) continue
      const det = calcularHorasExtraDiaDetalle(a, f, horarioMes, [])
      if (det.total <= 0) continue
      out.push({
        fecha: f,
        extra50: det.extra50,
        extra100: det.extra100,
        total: det.total,
        entrada: asistenciaHoraCorta(a.hora_entrada) || '—',
        salida: asistenciaHoraCorta(a.hora_salida) || '—'
      })
    }
    out.sort((a, b) => a.fecha.localeCompare(b.fecha))
    return out
  }, [asistenciaMes, horarioMes, periodo])

  const cuentaReloj = useMemo(() => {
    let extra50 = 0
    let extra100 = 0
    for (const d of diasReloj) {
      extra50 += d.extra50
      extra100 += d.extra100
    }
    return {
      extra50: Math.round(extra50 * 100) / 100,
      extra100: Math.round(extra100 * 100) / 100,
      total: Math.round((extra50 + extra100) * 100) / 100
    }
  }, [diasReloj])

  const totalMes = Math.round((cuentaReloj.total + cuentaAprobadas.total) * 100) / 100
  const anilloPct = Math.max(0, Math.min(100, (cuentaAprobadas.total / Math.max(8, totalMes || 8)) * 100))

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

      <section className="mis-he-card mis-he-resumen">
        <div className="mis-he-resumen-top">
          <h2>Cuenta del mes</h2>
          <label>
            Mes
            <input type="month" value={periodo} onChange={(e) => setPeriodo(e.target.value)} />
          </label>
        </div>
        <p className="mis-he-muted mis-he-resumen-lead">
          {etiquetaPeriodoEs(periodo)} · reloj + declaraciones aprobadas (lo que entra en liquidación)
        </p>
        <div className="mis-he-meters">
          <div className="mis-he-ring" aria-label="Horas extra aprobadas del mes">
            <svg viewBox="0 0 120 120" className="mis-he-ring-svg">
              <circle cx="60" cy="60" r="48" className="mis-he-ring-track" />
              <circle
                cx="60"
                cy="60"
                r="48"
                className="mis-he-ring-value"
                strokeDasharray={`${(anilloPct / 100) * 301.6} 301.6`}
              />
            </svg>
            <div className="mis-he-ring-label">
              <strong>{fmtHs(cuentaAprobadas.total)}</strong>
              <span>h aprobadas</span>
            </div>
          </div>
          <div className="mis-he-kpis">
            <div>
              <span>Reloj</span>
              <strong>{relojLoading ? '…' : `${fmtHs(cuentaReloj.total)} h`}</strong>
              <small>
                50% {fmtHs(cuentaReloj.extra50)} · 100% {fmtHs(cuentaReloj.extra100)}
              </small>
            </div>
            <div>
              <span>Aprobadas</span>
              <strong>{fmtHs(cuentaAprobadas.total)} h</strong>
              <small>
                {cuentaAprobadas.cantidad} envío{cuentaAprobadas.cantidad === 1 ? '' : 's'} · 50%{' '}
                {fmtHs(cuentaAprobadas.extra50)} · 100% {fmtHs(cuentaAprobadas.extra100)}
              </small>
            </div>
            <div>
              <span>Total mes</span>
              <strong>{fmtHs(totalMes)} h</strong>
              <small>
                {cuentaAprobadas.pendientesHs > 0
                  ? `${fmtHs(cuentaAprobadas.pendientesHs)} h pendientes de RRHH`
                  : 'sin pendientes'}
              </small>
            </div>
          </div>
        </div>
        <div className="mis-he-reloj-dias">
          <h3>Horas extra del reloj</h3>
          {relojLoading ? <p className="mis-he-muted">Calculando marcas…</p> : null}
          {!relojLoading && diasReloj.length === 0 ? (
            <p className="mis-he-muted">Este mes el reloj no registró extra (entrada/salida vs horario).</p>
          ) : null}
          {diasReloj.length > 0 ? (
            <ul>
              {diasReloj.map((d) => (
                <li key={d.fecha}>
                  <strong>{fechaCortaEs(d.fecha)}</strong>
                  <span>
                    {d.entrada} → {d.salida}
                  </span>
                  <em>
                    {fmtHs(d.total)} h
                    {d.extra50 > 0 ? ` · 50% ${fmtHs(d.extra50)}` : ''}
                    {d.extra100 > 0 ? ` · 100% ${fmtHs(d.extra100)}` : ''}
                  </em>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </section>

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
        <h2>Mis envíos · {etiquetaPeriodoEs(periodo)}</h2>
        {histLoading ? <p className="mis-he-muted">Cargando…</p> : null}
        {!histLoading && historialMes.length === 0 ? (
          <p className="mis-he-muted">No hay declaraciones en este mes.</p>
        ) : null}
        <ul className="mis-he-list">
          {historialMes.map((s) => (
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

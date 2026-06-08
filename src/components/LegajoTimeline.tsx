import { useMemo, useState } from 'react'
import apiService from '../services/api'
import type { RrhhEventoLaboralTipo } from '../types/api'
import {
  HOJA_VIDA_CATEGORIA_LABEL,
  type HojaVidaCategoria,
  type HojaVidaEvento,
  resumenHojaVida
} from '../utils/hojaVidaLaboral'
import './LegajoTimeline.css'

const CATEGORIA_ICON: Record<HojaVidaCategoria, string> = {
  ingreso: '🚀',
  cambio_puesto: '🔄',
  capacitacion: '🎓',
  evaluacion: '⭐',
  reconocimiento: '🏆',
  sancion: '⚠️',
  vacaciones: '🏖️',
  licencia: '📋',
  baja: '📤'
}

const TIPOS_EVENTO: { value: RrhhEventoLaboralTipo; label: string }[] = [
  { value: 'cambio_puesto', label: 'Cambio de puesto' },
  { value: 'reconocimiento', label: 'Reconocimiento' },
  { value: 'sancion', label: 'Sanción' }
]

type LegajoTimelineProps = {
  eventos: HojaVidaEvento[]
  loading: boolean
  error: string | null
  idUsuario: number
  puedeGestionar: boolean
  registradoPorId?: number
  onRefresh: () => void
}

const LegajoTimeline = ({
  eventos,
  loading,
  error,
  idUsuario,
  puedeGestionar,
  registradoPorId,
  onRefresh
}: LegajoTimelineProps) => {
  const [filtro, setFiltro] = useState<HojaVidaCategoria | 'todos'>('todos')
  const [showForm, setShowForm] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [form, setForm] = useState({
    tipo: 'reconocimiento' as RrhhEventoLaboralTipo,
    fecha: new Date().toISOString().slice(0, 10),
    titulo: '',
    descripcion: '',
    sector_anterior: '',
    sector_nuevo: ''
  })

  const resumen = useMemo(() => resumenHojaVida(eventos), [eventos])

  const filtrados = useMemo(() => {
    if (filtro === 'todos') return eventos
    return eventos.filter((e) => e.categoria === filtro)
  }, [eventos, filtro])

  const categoriasPresentes = useMemo(() => {
    const set = new Set(eventos.map((e) => e.categoria))
    return (Object.keys(HOJA_VIDA_CATEGORIA_LABEL) as HojaVidaCategoria[]).filter((c) => set.has(c))
  }, [eventos])

  const handleGuardarEvento = async () => {
    if (!registradoPorId) return
    const titulo = form.titulo.trim()
    if (titulo.length < 3) {
      alert('El título es obligatorio (mínimo 3 caracteres).')
      return
    }
    setGuardando(true)
    try {
      const r = await apiService.rrhhEventoLaboralCrear({
        id_usuario: idUsuario,
        tipo: form.tipo,
        fecha: form.fecha,
        titulo,
        descripcion: form.descripcion.trim() || null,
        sector_anterior: form.tipo === 'cambio_puesto' ? form.sector_anterior.trim() || null : null,
        sector_nuevo: form.tipo === 'cambio_puesto' ? form.sector_nuevo.trim() || null : null,
        registrado_por: registradoPorId
      })
      if (r.success) {
        setShowForm(false)
        setForm({
          tipo: 'reconocimiento',
          fecha: new Date().toISOString().slice(0, 10),
          titulo: '',
          descripcion: '',
          sector_anterior: '',
          sector_nuevo: ''
        })
        onRefresh()
      } else {
        alert(r.error || 'No se pudo guardar el evento')
      }
    } finally {
      setGuardando(false)
    }
  }

  if (loading) {
    return <div className="legajo-timeline-loading">Construyendo hoja de vida laboral…</div>
  }

  return (
    <div className="legajo-timeline">
      {error ? <div className="ver-legajo-alert ver-legajo-alert--error">⚠️ {error}</div> : null}

      <p className="legajo-timeline-intro">
        Línea de tiempo cronológica del vínculo laboral: ingreso, trayectoria, formación, evaluaciones,
        ausencias y desvinculación.
      </p>

      <div className="legajo-timeline-summary">
        <span>
          <strong>{resumen.total}</strong> hito{resumen.total === 1 ? '' : 's'} registrado
          {resumen.total === 1 ? '' : 's'}
        </span>
        {categoriasPresentes.map((c) => (
          <span key={c} className={`legajo-timeline-chip legajo-timeline-chip--${c}`}>
            {CATEGORIA_ICON[c]} {resumen.porCategoria[c]} {HOJA_VIDA_CATEGORIA_LABEL[c]}
          </span>
        ))}
      </div>

      <div className="legajo-timeline-toolbar">
        <div className="legajo-timeline-filters" role="group" aria-label="Filtrar por tipo">
          <button
            type="button"
            className={`legajo-timeline-filter${filtro === 'todos' ? ' active' : ''}`}
            onClick={() => setFiltro('todos')}
          >
            Todos
          </button>
          {categoriasPresentes.map((c) => (
            <button
              key={c}
              type="button"
              className={`legajo-timeline-filter legajo-timeline-filter--${c}${filtro === c ? ' active' : ''}`}
              onClick={() => setFiltro(c)}
            >
              {CATEGORIA_ICON[c]} {HOJA_VIDA_CATEGORIA_LABEL[c]}
            </button>
          ))}
        </div>
        {puedeGestionar && registradoPorId ? (
          <button
            type="button"
            className="legajo-timeline-add-btn"
            onClick={() => setShowForm((v) => !v)}
          >
            {showForm ? 'Cancelar' : '+ Registrar evento'}
          </button>
        ) : null}
      </div>

      {showForm && puedeGestionar ? (
        <div className="legajo-timeline-form">
          <h4>Registrar evento en hoja de vida</h4>
          <div className="legajo-timeline-form-grid">
            <label>
              Tipo
              <select
                value={form.tipo}
                onChange={(e) =>
                  setForm((f) => ({ ...f, tipo: e.target.value as RrhhEventoLaboralTipo }))
                }
              >
                {TIPOS_EVENTO.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Fecha
              <input
                type="date"
                value={form.fecha}
                onChange={(e) => setForm((f) => ({ ...f, fecha: e.target.value }))}
              />
            </label>
            <label className="legajo-timeline-form-full">
              Título *
              <input
                type="text"
                value={form.titulo}
                onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
                placeholder="Ej.: Ascenso a supervisor, Mención por desempeño…"
              />
            </label>
            {form.tipo === 'cambio_puesto' ? (
              <>
                <label>
                  Sector anterior
                  <input
                    type="text"
                    value={form.sector_anterior}
                    onChange={(e) => setForm((f) => ({ ...f, sector_anterior: e.target.value }))}
                  />
                </label>
                <label>
                  Sector nuevo
                  <input
                    type="text"
                    value={form.sector_nuevo}
                    onChange={(e) => setForm((f) => ({ ...f, sector_nuevo: e.target.value }))}
                  />
                </label>
              </>
            ) : null}
            <label className="legajo-timeline-form-full">
              Descripción
              <textarea
                rows={2}
                value={form.descripcion}
                onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
              />
            </label>
          </div>
          <button
            type="button"
            className="legajo-timeline-save-btn"
            onClick={() => void handleGuardarEvento()}
            disabled={guardando}
          >
            {guardando ? 'Guardando…' : 'Guardar en hoja de vida'}
          </button>
        </div>
      ) : null}

      {filtrados.length === 0 ? (
        <div className="ver-legajo-empty-small">
          {eventos.length === 0
            ? 'Aún no hay hitos en la hoja de vida. Completá el legajo (fecha de ingreso) y registrá novedades, capacitaciones o evaluaciones.'
            : 'Ningún hito coincide con el filtro seleccionado.'}
        </div>
      ) : (
        <ol className="legajo-timeline-list">
          {filtrados.map((ev, idx) => (
            <li key={ev.id} className={`legajo-timeline-item legajo-timeline-item--${ev.categoria}`}>
              <div className="legajo-timeline-marker" aria-hidden>
                <span>{CATEGORIA_ICON[ev.categoria]}</span>
              </div>
              <div className="legajo-timeline-card">
                <div className="legajo-timeline-card-head">
                  <time dateTime={ev.fechaIso}>{ev.fechaLabel}</time>
                  <span className="legajo-timeline-badge">
                    {HOJA_VIDA_CATEGORIA_LABEL[ev.categoria]}
                  </span>
                </div>
                <h4 className="legajo-timeline-title">{ev.titulo}</h4>
                {ev.detalle ? <p className="legajo-timeline-detail">{ev.detalle}</p> : null}
                {ev.meta ? <p className="legajo-timeline-meta">{ev.meta}</p> : null}
              </div>
              {idx < filtrados.length - 1 ? <div className="legajo-timeline-connector" aria-hidden /> : null}
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

export default LegajoTimeline

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Briefcase,
  CheckSquare,
  ClipboardList,
  NotebookPen,
  Paperclip,
  Plus,
  Search,
  StickyNote,
  Trash2,
  X
} from 'lucide-react'
import type { WorkPoolAsociacionBusqueda, WorkPoolJob, WorkPoolOperarioNota, WorkPoolOperarioNotaTipo } from '../../types/workPool'
import { uploadAttachmentAndGetUrl } from '../../utils/storage'
import {
  buscarAsociacionesOperario,
  buildOpsDelDia,
  crearOperarioNota,
  eliminarOperarioNota,
  formatHorarioNota,
  listarOperarioNotas,
  toggleOperarioChecklist
} from './workPoolOperarioNotas'
import { getArgentinaDateString, isoToArgentinaDateKey } from '../../utils/dateUtils'
import './WorkPoolOperarioNotasFab.css'

type Tab = WorkPoolOperarioNotaTipo | 'ops-dia'

type Props = {
  idUsuario: number
  jobs?: WorkPoolJob[]
  /** Compact phi/externo look */
  variant?: 'phi' | 'admin'
  /** Modo captura documentación (sin API, datos estáticos) */
  docsCapture?: {
    forceOpen?: boolean
    forceTab?: Tab
    staticItems?: WorkPoolOperarioNota[]
    staticJobs?: WorkPoolJob[]
    panelOnly?: boolean
    fabOnly?: boolean
    prefill?: {
      tituloTarea?: string
      texto?: string
      horaInicio?: string
      horaFin?: string
      jobId?: number
    }
  }
}

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString('es-AR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch {
    return iso
  }
}

function jobTitulo(j: WorkPoolJob) {
  if (j.titulo?.trim()) return j.titulo.trim()
  if (j.numero_op) return `OP ${j.numero_op}`
  return `Trabajo #${j.id}`
}

function asociacionChips(n: WorkPoolOperarioNota, jobs: WorkPoolJob[]) {
  const chips: string[] = []
  if (n.titulo?.trim()) chips.push(n.titulo.trim())
  else if (n.id_job) {
    const j = jobs.find((x) => x.id === n.id_job)
    if (j) chips.push(jobTitulo(j))
  }
  if (n.numero_op) chips.push(`OP ${n.numero_op}`)
  if (n.numero_venta) chips.push(`Venta ${n.numero_venta}`)
  if (n.numero_oportunidad) chips.push(`Opp ${n.numero_oportunidad}`)
  return chips
}

export default function WorkPoolOperarioNotasFab({ idUsuario, jobs = [], variant = 'phi', docsCapture }: Props) {
  const capture = docsCapture
  const [open, setOpen] = useState(capture?.forceOpen ?? false)
  const [tab, setTab] = useState<Tab>(capture?.forceTab ?? 'bitacora')
  const [items, setItems] = useState<WorkPoolOperarioNota[]>([])
  const [itemsHoyAll, setItemsHoyAll] = useState<WorkPoolOperarioNota[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingOps, setLoadingOps] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [texto, setTexto] = useState('')
  const [tituloTarea, setTituloTarea] = useState('')
  const [jobId, setJobId] = useState<number | ''>('')
  const [assocQ, setAssocQ] = useState('')
  const [assocHits, setAssocHits] = useState<WorkPoolAsociacionBusqueda[]>([])
  const [assoc, setAssoc] = useState<WorkPoolAsociacionBusqueda | null>(null)
  const [horaInicio, setHoraInicio] = useState('')
  const [horaFin, setHoraFin] = useState('')
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    if (!capture?.prefill) return
    const p = capture.prefill
    if (p.tituloTarea != null) setTituloTarea(p.tituloTarea)
    if (p.texto != null) setTexto(p.texto)
    if (p.horaInicio != null) setHoraInicio(p.horaInicio)
    if (p.horaFin != null) setHoraFin(p.horaFin)
    if (p.jobId != null) setJobId(p.jobId)
  }, [capture?.prefill])

  const jobsActivos = useMemo(
    () =>
      (capture?.staticJobs ?? jobs).filter((j) =>
        ['asignado', 'en_curso', 'cambios', 'entregado', 'en_revision'].includes(j.estado)
      ),
    [jobs, capture?.staticJobs]
  )

  const jobSeleccionado = useMemo(
    () => (jobId === '' ? null : jobsActivos.find((j) => j.id === jobId) ?? jobs.find((j) => j.id === jobId) ?? null),
    [jobId, jobsActivos, jobs]
  )

  const hoy = getArgentinaDateString()

  const itemsDelDia = useMemo(
    () => items.filter((n) => isoToArgentinaDateKey(n.created_at) === hoy),
    [items, hoy]
  )

  const allJobs = useMemo(() => capture?.staticJobs ?? jobs, [capture?.staticJobs, jobs])

  const opsDelDia = useMemo(
    () =>
      buildOpsDelDia(itemsHoyAll, {
        fechaKey: hoy,
        jobLabelById: (idJob) => {
          const j = allJobs.find((x) => x.id === idJob)
          return j ? jobTitulo(j) : null
        }
      }),
    [itemsHoyAll, allJobs, hoy]
  )

  useEffect(() => {
    if (!jobSeleccionado) return
    setTituloTarea(jobTitulo(jobSeleccionado))
  }, [jobSeleccionado])

  const loadHoyAll = async () => {
    if (capture?.staticItems) {
      setItemsHoyAll(capture.staticItems.filter((n) => isoToArgentinaDateKey(n.created_at) === hoy))
      setLoadingOps(false)
      return
    }
    setLoadingOps(true)
    const res = await listarOperarioNotas({ id_usuario: idUsuario, tipo: null, limit: 120 })
    setLoadingOps(false)
    if (!res.success) {
      setItemsHoyAll([])
      return
    }
    setItemsHoyAll((res.data ?? []).filter((n) => isoToArgentinaDateKey(n.created_at) === hoy))
  }

  const load = async () => {
    if (capture?.staticItems) {
      setItems(capture.staticItems)
      setLoading(false)
      return
    }
    if (tab === 'ops-dia') {
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    const res = await listarOperarioNotas({ id_usuario: idUsuario, tipo: tab, limit: 60 })
    setLoading(false)
    if (!res.success) {
      setError(res.error || 'No se pudo cargar')
      setItems([])
      return
    }
    setItems(res.data ?? [])
  }

  const refreshAll = () => {
    void load()
    void loadHoyAll()
  }

  useEffect(() => {
    if (capture?.forceOpen) setOpen(true)
  }, [capture?.forceOpen])

  useEffect(() => {
    if (capture?.forceTab) setTab(capture.forceTab)
  }, [capture?.forceTab])

  useEffect(() => {
    if (!open && !capture?.staticItems) return
    if (capture?.staticItems) {
      setItems(capture.staticItems)
      setItemsHoyAll(capture.staticItems.filter((n) => isoToArgentinaDateKey(n.created_at) === hoy))
      setLoading(false)
      setLoadingOps(false)
      return
    }
    void load()
    void loadHoyAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tab, idUsuario, capture?.staticItems, hoy])

  useEffect(() => {
    if (!open) return
    const q = assocQ.trim()
    if (q.length < 2) {
      setAssocHits([])
      return
    }
    const t = window.setTimeout(() => {
      void buscarAsociacionesOperario(q).then((res) => {
        if (!res.success || !res.data) {
          setAssocHits([])
          return
        }
        setAssocHits([...res.data.ops, ...res.data.ventas, ...res.data.oportunidades].slice(0, 10))
      })
    }, 280)
    return () => window.clearTimeout(t)
  }, [assocQ, open])

  const handleAdd = async () => {
    if (tab === 'ops-dia') return
    const tipo: WorkPoolOperarioNotaTipo = tab
    const detalle = texto.trim()
    if (!detalle) {
      setError('Escribí algo para guardar')
      return
    }
    if (tab === 'bitacora' && !jobId && !assoc) {
      setError('Asociá un trabajo, OP o venta')
      return
    }
    if (horaFin && !horaInicio) {
      setError('Indicá hora de inicio')
      return
    }
    if (horaInicio && horaFin && horaFin <= horaInicio) {
      setError('La hora de fin debe ser posterior al inicio')
      return
    }
    setSaving(true)
    setUploading(tab === 'bitacora' && pendingFiles.length > 0)
    setError('')
    try {
      const adjuntos =
        tab === 'bitacora' && pendingFiles.length > 0
          ? await Promise.all(
              pendingFiles.map(async (file) => {
                const url = await uploadAttachmentAndGetUrl(file, 'work-pool-bitacora')
                return {
                  nombre: file.name,
                  url,
                  mime: file.type || null,
                  size: file.size
                }
              })
            )
          : []
      const tituloGuardar =
        tab === 'checklist'
          ? detalle.slice(0, 80)
          : tituloTarea.trim() || (jobSeleccionado ? jobTitulo(jobSeleccionado) : '')
      const res = await crearOperarioNota({
        id_usuario: idUsuario,
        tipo,
        detalle,
        titulo: tituloGuardar || undefined,
        id_job: jobId === '' ? null : Number(jobId),
        numero_op: assoc?.kind === 'op' ? assoc.numero_op ?? assoc.label : assoc?.numero_op ?? null,
        id_venta: assoc?.kind === 'venta' ? assoc.id_venta ?? assoc.id : null,
        numero_venta: assoc?.kind === 'venta' ? assoc.numero_venta ?? assoc.label : null,
        id_oportunidad: assoc?.kind === 'oportunidad' ? assoc.id_oportunidad ?? assoc.id : null,
        numero_oportunidad:
          assoc?.kind === 'oportunidad' ? assoc.numero_oportunidad ?? assoc.label : null,
        adjuntos,
        hora_inicio: horaInicio || null,
        hora_fin: horaFin || null
      })
      if (!res.success) {
        setError(res.error || 'No se pudo guardar')
        return
      }
      setTexto('')
      setHoraInicio('')
      setHoraFin('')
      setPendingFiles([])
      refreshAll()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al subir archivos')
    } finally {
      setSaving(false)
      setUploading(false)
    }
  }

  const panel = open ? (
    <div className={`wp-notas-fab__panel wp-notas-fab__panel--${variant}`} role="dialog" aria-label="Mis notas y tareas">
      <header className="wp-notas-fab__head">
        <div>
          <p className="wp-notas-fab__eyebrow">Operario</p>
          <h3>Tareas y anotador</h3>
        </div>
        <button type="button" className="wp-notas-fab__icon-btn" onClick={() => setOpen(false)} aria-label="Cerrar">
          <X size={18} aria-hidden />
        </button>
      </header>

      <div className="wp-notas-fab__tabs" role="tablist">
        {(
          [
            { id: 'bitacora' as const, label: 'Bitácora', icon: ClipboardList },
            { id: 'checklist' as const, label: 'Checklist', icon: CheckSquare },
            { id: 'anotador' as const, label: 'Anotador', icon: NotebookPen },
            { id: 'ops-dia' as const, label: 'OPs hoy', icon: Briefcase }
          ] as const
        ).map((t) => {
          const Icon = t.icon
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={tab === t.id ? 'is-active' : ''}
              onClick={() => setTab(t.id)}
            >
              <Icon size={14} aria-hidden />
              {t.label}
            </button>
          )
        })}
      </div>

      {tab !== 'ops-dia' ? (
      <div className="wp-notas-fab__composer">
        {tab === 'bitacora' && jobsActivos.length > 0 ? (
          <label className="wp-notas-fab__field">
            Trabajo en curso
            <select
              value={jobId === '' ? '' : String(jobId)}
              onChange={(e) => setJobId(e.target.value ? Number(e.target.value) : '')}
            >
              <option value="">Elegí un trabajo…</option>
              {jobsActivos.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.numero_op ? `OP ${j.numero_op} · ` : ''}
                  {jobTitulo(j)}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <label className="wp-notas-fab__field">
          Título de la tarea
          <input
            type="text"
            value={tituloTarea}
            onChange={(e) => setTituloTarea(e.target.value)}
            placeholder={
              jobSeleccionado
                ? jobTitulo(jobSeleccionado)
                : 'Ej. Ajuste de logo principal'
            }
            autoComplete="off"
          />
        </label>

        <label className="wp-notas-fab__field">
          Asociar OP / venta / oportunidad
          {jobSeleccionado ? (
            <span className="wp-notas-fab__field-hint">
              Trabajo: {jobTitulo(jobSeleccionado)}
              {jobSeleccionado.numero_op ? ` · OP ${jobSeleccionado.numero_op}` : ''}
            </span>
          ) : null}
          <div className="wp-notas-fab__assoc-row">
            <Search size={14} aria-hidden />
            <input
              value={assocQ}
              onChange={(e) => {
                setAssocQ(e.target.value)
                setAssoc(null)
              }}
              placeholder="Buscar OP, venta u oportunidad…"
              autoComplete="off"
            />
          </div>
        </label>
        {assoc ? (
          <button type="button" className="wp-notas-fab__assoc-chip" onClick={() => setAssoc(null)}>
            {assoc.kind.toUpperCase()} · {assoc.label} ×
          </button>
        ) : null}
        {!assoc && assocHits.length > 0 ? (
          <ul className="wp-notas-fab__assoc-hits">
            {assocHits.map((h) => (
              <li key={`${h.kind}-${h.id}`}>
                <button
                  type="button"
                  onClick={() => {
                    setAssoc(h)
                    setAssocQ(h.label)
                    setAssocHits([])
                  }}
                >
                  <strong>{h.label}</strong>
                  <span>
                    {h.kind}
                    {h.sublabel ? ` · ${h.sublabel}` : ''}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <label className="wp-notas-fab__field">
          {tab === 'checklist' ? 'Nueva tarea' : tab === 'bitacora' ? 'Qué hiciste' : 'Nota'}
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={3}
            placeholder={
              tab === 'checklist'
                ? 'Ej. Enviar mockup al cliente'
                : tab === 'bitacora'
                  ? 'Ej. Ajusté tipografía y tipografía secundaria'
                  : 'Anotá lo que necesites recordar…'
            }
          />
        </label>

        <div className="wp-notas-fab__horario-row">
          <label className="wp-notas-fab__field wp-notas-fab__field--inline">
            Hora inicio
            <input
              type="time"
              value={horaInicio}
              onChange={(e) => setHoraInicio(e.target.value)}
            />
          </label>
          <label className="wp-notas-fab__field wp-notas-fab__field--inline">
            Hora fin
            <input
              type="time"
              value={horaFin}
              onChange={(e) => setHoraFin(e.target.value)}
            />
          </label>
        </div>

        {tab === 'bitacora' ? (
          <label className="wp-notas-fab__field">
            Documentos adjuntos
            <div className="wp-notas-fab__file-row">
              <Paperclip size={14} aria-hidden />
              <input
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.webp,.zip"
                onChange={(e) => {
                  const files = e.target.files ? [...e.target.files] : []
                  if (files.length) setPendingFiles((prev) => [...prev, ...files])
                  e.target.value = ''
                }}
              />
            </div>
            {pendingFiles.length > 0 ? (
              <ul className="wp-notas-fab__pending-files">
                {pendingFiles.map((f, i) => (
                  <li key={`${f.name}-${i}`}>
                    <span>{f.name}</span>
                    <button
                      type="button"
                      aria-label="Quitar archivo"
                      onClick={() => setPendingFiles((prev) => prev.filter((_, j) => j !== i))}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </label>
        ) : null}

        {error ? <p className="wp-notas-fab__error">{error}</p> : null}

        <button
          type="button"
          className="wp-notas-fab__save"
          disabled={saving}
          onClick={() => void handleAdd()}
        >
          <Plus size={16} aria-hidden />
          {uploading ? 'Subiendo…' : saving ? 'Guardando…' : 'Agregar'}
        </button>
      </div>
      ) : null}

      <div className="wp-notas-fab__list">
        {tab === 'ops-dia' ? (
          <>
            <p className="wp-notas-fab__list-head">
              Hoy · {opsDelDia.length} {opsDelDia.length === 1 ? 'OP' : 'OPs'}
            </p>
            {loadingOps ? <p className="wp-notas-fab__muted">Cargando…</p> : null}
            {!loadingOps && opsDelDia.length === 0 ? (
              <p className="wp-notas-fab__muted">
                Todavía no registraste trabajo en ninguna OP hoy. Usá Bitácora para anotar lo que hiciste.
              </p>
            ) : null}
            <ul className="wp-notas-fab__ops-dia">
              {opsDelDia.map((op) => (
                <li key={op.key} className="wp-notas-fab__op-dia">
                  <Briefcase size={16} className="wp-notas-fab__op-dia-icon" aria-hidden />
                  <div className="wp-notas-fab__op-dia-body">
                    <p>{op.label}</p>
                    <div className="wp-notas-fab__item-meta">
                      <span>
                        {op.entradas} {op.entradas === 1 ? 'entrada' : 'entradas'}
                      </span>
                      {op.horario ? <span>{op.horario}</span> : null}
                      <span>{formatWhen(op.ultimaActividad)}</span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <>
        <p className="wp-notas-fab__list-head">
          Hoy · {itemsDelDia.length} {itemsDelDia.length === 1 ? 'entrada' : 'entradas'}
        </p>
        {loading ? <p className="wp-notas-fab__muted">Cargando…</p> : null}
        {!loading && itemsDelDia.length === 0 ? (
          <p className="wp-notas-fab__muted">No hay entradas de hoy en esta sección.</p>
        ) : null}
        <ul>
          {itemsDelDia.map((n) => (
            <li key={n.id} className={`wp-notas-fab__item${n.hecho ? ' is-done' : ''}`}>
              {tab === 'checklist' ? (
                <button
                  type="button"
                  className="wp-notas-fab__check"
                  aria-pressed={n.hecho}
                  onClick={() =>
                    void toggleOperarioChecklist(n.id, idUsuario, !n.hecho).then(() => refreshAll())
                  }
                >
                  <CheckSquare size={16} aria-hidden />
                </button>
              ) : (
                <StickyNote size={16} className="wp-notas-fab__item-icon" aria-hidden />
              )}
              <div className="wp-notas-fab__item-body">
                <p>{n.titulo || n.detalle}</p>
                {n.titulo && n.detalle && n.titulo !== n.detalle ? (
                  <small>{n.detalle}</small>
                ) : null}
                <div className="wp-notas-fab__item-meta">
                  <span>{formatWhen(n.created_at)}</span>
                  {formatHorarioNota(n.hora_inicio, n.hora_fin) ? (
                    <span>{formatHorarioNota(n.hora_inicio, n.hora_fin)}</span>
                  ) : null}
                  {asociacionChips(n, jobs).map((c) => (
                    <span key={c}>{c}</span>
                  ))}
                </div>
                {n.adjuntos.length > 0 ? (
                  <ul className="wp-notas-fab__adjuntos">
                    {n.adjuntos.map((a) => (
                      <li key={a.url}>
                        <a href={a.url} target="_blank" rel="noopener noreferrer">
                          {a.nombre}
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
              <button
                type="button"
                className="wp-notas-fab__icon-btn"
                aria-label="Eliminar"
                onClick={() => void eliminarOperarioNota(n.id, idUsuario).then(() => refreshAll())}
              >
                <Trash2 size={14} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
          </>
        )}
      </div>
    </div>
  ) : null

  return createPortal(
    <div className={`wp-notas-fab wp-notas-fab--${variant}${capture?.panelOnly ? ' wp-notas-fab--capture-panel' : ''}`}>
      {!capture?.fabOnly ? panel : null}
      {!capture?.panelOnly ? (
        <button
          type="button"
          className={`wp-notas-fab__btn${open ? ' is-open' : ''}`}
          aria-expanded={open}
          aria-label={open ? 'Cerrar anotador' : 'Abrir anotador de tareas'}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X size={22} aria-hidden /> : <NotebookPen size={22} aria-hidden />}
        </button>
      ) : null}
    </div>,
    capture?.panelOnly ? (document.getElementById('capture-fab-root') ?? document.body) : document.body
  )
}

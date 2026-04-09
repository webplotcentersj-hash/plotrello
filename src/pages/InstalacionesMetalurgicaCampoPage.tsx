import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Task } from '../types/board'
import type { TareaSubitem } from '../types/api'
import apiService from '../services/api'
import { parseTaskIdToOrdenId } from '../utils/dataMappers'
import {
  isImageAdjuntoUrl,
  opSectoresRequierenFotosLugar,
  taskEstaEnColumnaInstalacionOMetalurgica,
  taskPhotoUrlCountAsSitePhoto
} from '../utils/sectoresFotosLugar'
import { compressImageFileToJpegDataUrl } from '../utils/campoFotosDb'
import { useAuth } from '../hooks/useAuth'
import './InstalacionesMetalurgicaCampoPage.css'

/** Ítem de checklist que se crea automáticamente si no existe (Instalaciones / Metalúrgica). */
export const CHECKLIST_TRABAJO_INSTALADO = 'Trabajo instalado'

const MIN_FOTOS_EVIDENCIA = 3

function isCampoRelevantTask(t: Task): boolean {
  if (t.entregado) return false
  if (taskEstaEnColumnaInstalacionOMetalurgica(t)) return true
  return opSectoresRequierenFotosLugar(t.sectores)
}

function sectorLabel(task: Task): string {
  if (task.status === 'instalaciones' || task.assignedSector === 'Instalaciones') return 'Instalaciones'
  if (task.status === 'metalurgica' || task.assignedSector === 'Metalúrgica') return 'Metalúrgica'
  if (task.sectores?.includes('Instalaciones')) return 'Instalaciones (en OP)'
  if (task.sectores?.includes('Metalúrgica')) return 'Metalúrgica (en OP)'
  return 'Instalaciones / Metalúrgica'
}

function collectImageUrls(
  photoUrl: string | undefined,
  archivos: Array<{ titulo?: string | null; url?: string | null }>
): string[] {
  const urls: string[] = []
  if (photoUrl?.trim() && taskPhotoUrlCountAsSitePhoto(photoUrl)) {
    urls.push(photoUrl.trim())
  }
  for (const row of archivos) {
    const u = row.url?.trim()
    if (!u || urls.includes(u)) continue
    if (isImageAdjuntoUrl(u, row.titulo)) urls.push(u)
  }
  return urls
}

type Props = {
  tasks: Task[]
  onReloadData?: (options?: { silent?: boolean }) => Promise<void>
}

export default function InstalacionesMetalurgicaCampoPage({ tasks, onReloadData }: Props) {
  const navigate = useNavigate()
  const { isAdmin } = useAuth()
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const campoTasks = useMemo(() => {
    const list = tasks.filter(isCampoRelevantTask)
    list.sort((a, b) => {
      const da = a.dueDate ? new Date(a.dueDate).getTime() : 0
      const db = b.dueDate ? new Date(b.dueDate).getTime() : 0
      if (da !== db) return da - db
      return (b.updatedAt || '').localeCompare(a.updatedAt || '')
    })
    return list
  }, [tasks])

  const selected = selectedId ? campoTasks.find((t) => t.id === selectedId) : null

  if (selected) {
    return (
      <CampoDetail
        task={selected}
        onBack={() => setSelectedId(null)}
        onReloadData={onReloadData}
        canUpload={!selected.opBloqueada || isAdmin}
      />
    )
  }

  return (
    <div className="campo-app">
      <header className="campo-app-header">
        <button type="button" className="campo-back" onClick={() => navigate('/')}>
          ← Tablero
        </button>
        <h1 className="campo-app-title">Instalaciones · Metalúrgica</h1>
        <p className="campo-app-sub">
          OPs en campo — datos, fotos del lugar, checklist y evidencia. Las fotos nuevas se guardan en la base (sin Storage).
        </p>
      </header>

      <ul className="campo-list">
        {campoTasks.length === 0 && (
          <li className="campo-empty">No hay OPs con Instalaciones o Metalúrgica pendientes en este listado.</li>
        )}
        {campoTasks.map((t) => (
          <li key={t.id}>
            <button type="button" className="campo-list-item" onClick={() => setSelectedId(t.id)}>
              <span className="campo-op">{t.opNumber}</span>
              <span className="campo-cliente">{t.title}</span>
              <span className="campo-sector-pill">{sectorLabel(t)}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function CampoDetail({
  task,
  onBack,
  onReloadData,
  canUpload
}: {
  task: Task
  onBack: () => void
  onReloadData?: (options?: { silent?: boolean }) => Promise<void>
  canUpload: boolean
}) {
  const navigate = useNavigate()
  const ordenId = parseTaskIdToOrdenId(task.id)
  const [archivos, setArchivos] = useState<Array<{ id?: number; titulo?: string | null; url?: string | null }>>([])
  const [subitems, setSubitems] = useState<TareaSubitem[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refreshArchivosYSubitems = useCallback(async () => {
    if (!ordenId) {
      setLoading(false)
      return
    }
    setError(null)
    const [ar, sr] = await Promise.all([apiService.getArchivosOrden(ordenId), apiService.getSubitems(ordenId)])
    if (ar.success && ar.data) {
      setArchivos(ar.data as Array<{ id?: number; titulo?: string | null; url?: string | null }>)
    } else if (!ar.success) {
      setError(ar.error || 'No se pudieron cargar los archivos')
    }
    if (sr.success && sr.data) {
      let list = sr.data
      const hasTrabajoInstalado = list.some(
        (s) => s.titulo.trim().toLowerCase() === CHECKLIST_TRABAJO_INSTALADO.toLowerCase()
      )
      if (!hasTrabajoInstalado) {
        const cr = await apiService.createSubitem({
          idOrden: ordenId,
          titulo: CHECKLIST_TRABAJO_INSTALADO
        })
        if (cr.success) {
          const again = await apiService.getSubitems(ordenId)
          if (again.success && again.data) list = again.data
        } else {
          setError((prev) => prev || cr.error || 'No se pudo crear «Trabajo instalado» en el checklist')
        }
      }
      setSubitems(list)
    } else if (!sr.success) {
      setError((prev) => prev || sr.error || 'No se pudo cargar el checklist')
    }
    setLoading(false)
  }, [ordenId])

  useEffect(() => {
    void refreshArchivosYSubitems()
  }, [refreshArchivosYSubitems])

  const imageUrls = useMemo(
    () => collectImageUrls(task.photoUrl, archivos),
    [task.photoUrl, archivos]
  )

  const imageCount = imageUrls.length

  const phoneDisplay = task.clientPhone?.trim() || '—'
  const phoneHref = task.clientPhone?.replace(/\D/g, '')
  const address = task.clientAddress?.trim() || '—'

  const handleToggleSubitem = async (item: TareaSubitem) => {
    const next = !item.done
    const res = await apiService.toggleSubitemDone(item.id, next, item.iniciado_en ?? undefined)
    if (res.success) {
      setSubitems((prev) =>
        prev.map((s) =>
          s.id === item.id
            ? {
                ...s,
                done: next,
                iniciado_en: next ? null : s.iniciado_en,
                completado_en: next ? new Date().toISOString() : null
              }
            : s
        )
      )
    } else {
      setError(res.error || 'No se pudo actualizar el checklist')
    }
  }

  const handlePickPhotos = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files?.length || !ordenId || !canUpload) return
    setUploading(true)
    setError(null)
    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith('image/')) continue
        const dataUrl = await compressImageFileToJpegDataUrl(file)
        const guard = await apiService.guardarArchivoOrden(
          ordenId,
          file.name || 'foto-campo.jpg',
          dataUrl,
          { esEvidenciaCampo: true }
        )
        if (!guard.success) {
          setError(guard.error || 'Error al guardar en la base (¿aplicaste el parche es_evidencia_campo?)')
          break
        }
      }
      await refreshArchivosYSubitems()
      await onReloadData?.({ silent: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al subir')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  return (
    <div className="campo-app campo-detail">
      <header className="campo-app-header campo-detail-header">
        <button type="button" className="campo-back" onClick={onBack}>
          ← Lista
        </button>
        <div className="campo-detail-headline">
          <span className="campo-op-lg">{task.opNumber}</span>
          <h1 className="campo-detail-title">{task.title}</h1>
          <span className="campo-sector-pill lg">{sectorLabel(task)}</span>
        </div>
        <button type="button" className="campo-link-quiet" onClick={() => navigate(`/op/${encodeURIComponent(task.opNumber)}`)}>
          Ver ficha web
        </button>
      </header>

      {task.opBloqueada && !canUpload && (
        <div className="campo-banner-warn">Esta OP está trabada: solo podés ver datos. Las subidas las habilita administración o al destablar.</div>
      )}

      {error && <div className="campo-banner-err">{error}</div>}

      <section className="campo-card">
        <h2 className="campo-card-title">Contacto y ubicación</h2>
        <div className="campo-kv">
          <span className="campo-k">Teléfono</span>
          <span className="campo-v">
            {phoneHref ? (
              <a href={`tel:${phoneHref}`} className="campo-tel">
                {phoneDisplay}
              </a>
            ) : (
              phoneDisplay
            )}
          </span>
        </div>
        <div className="campo-kv">
          <span className="campo-k">Ubicación / dirección</span>
          <span className="campo-v">{address}</span>
        </div>
        {task.locationUrl?.trim() && (
          <a className="campo-maps-btn" href={task.locationUrl.trim()} target="_blank" rel="noreferrer">
            Abrir en mapas
          </a>
        )}
        {task.whatsappUrl?.trim() && (
          <a className="campo-wa-btn" href={task.whatsappUrl.trim()} target="_blank" rel="noreferrer">
            WhatsApp
          </a>
        )}
      </section>

      <section className="campo-card">
        <h2 className="campo-card-title">Observaciones</h2>
        <div className="campo-obs">{task.summary?.trim() ? task.summary : 'Sin observaciones cargadas.'}</div>
      </section>

      <section className="campo-card">
        <h2 className="campo-card-title">Fotos reales del lugar</h2>
        <p className="campo-hint">Imágenes ya cargadas en la OP (portada y adjuntos).</p>
        {loading ? (
          <p className="campo-muted">Cargando…</p>
        ) : imageUrls.length === 0 ? (
          <p className="campo-muted">Todavía no hay fotos del lugar en esta OP.</p>
        ) : (
          <div className="campo-photo-grid">
            {imageUrls.map((url) => (
              <a key={url} href={url} target="_blank" rel="noreferrer" className="campo-photo-cell">
                <img src={url} alt="" />
              </a>
            ))}
          </div>
        )}
      </section>

      <section className="campo-card campo-evidencia">
        <h2 className="campo-card-title">Evidencia en obra (fotos)</h2>
        <p className="campo-hint">
          Subí al menos <strong>{MIN_FOTOS_EVIDENCIA} fotos</strong> del trabajo terminado o en proceso. Se guardan como imagen
          en la base de datos (data URL); aparecen en el kanban de etapas en la sección «Trabajos (app campo)».
        </p>
        <div className={`campo-foto-count ${imageCount >= MIN_FOTOS_EVIDENCIA ? 'ok' : 'need'}`}>
          Fotos en la OP (imágenes): <strong>{imageCount}</strong> / mín. {MIN_FOTOS_EVIDENCIA}
        </div>
        {canUpload && (
          <label className="campo-upload-btn">
            {uploading ? 'Subiendo…' : 'Elegir fotos'}
            <input type="file" accept="image/*" multiple hidden disabled={uploading} onChange={(ev) => void handlePickPhotos(ev)} />
          </label>
        )}
      </section>

      <section className="campo-card">
        <h2 className="campo-card-title">Checklist</h2>
        <p className="campo-hint">Incluye el ítem precargado «{CHECKLIST_TRABAJO_INSTALADO}» y el resto de la OP.</p>
        {loading ? (
          <p className="campo-muted">Cargando checklist…</p>
        ) : (
          <ul className="campo-checklist">
            {subitems.map((s) => (
              <li key={s.id}>
                <label className="campo-check-row">
                  <input
                    type="checkbox"
                    checked={s.done}
                    onChange={() => void handleToggleSubitem(s)}
                  />
                  <span className={s.done ? 'done' : ''}>{s.titulo}</span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </section>

      <footer className="campo-footer-spacer" />
    </div>
  )
}

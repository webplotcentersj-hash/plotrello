import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Task } from '../types/board'
import type { RelevamientoSubitemRecord, TareaSubitem } from '../types/api'
import apiService from '../services/api'
import { parseTaskIdToOrdenId } from '../utils/dataMappers'
import {
  isImageAdjuntoUrl,
  opSectoresRequierenFotosLugar,
  taskEstaEnColumnaInstalacionOMetalurgica,
  taskPhotoUrlCountAsSitePhoto
} from '../utils/sectoresFotosLugar'
import { blobToDataUrl, compressImageFileToJpegDataUrl } from '../utils/campoFotosDb'
import { useAuth } from '../hooks/useAuth'
import './InstalacionesMetalurgicaCampoPage.css'

const ETAPA_KANBAN_FINALIZADO = 'Finalizado' as const

/** Sector cuyo kanban de etapas debe recibir «Finalizado» al pulsar el botón en app campo. */
function resolveCampoFinalizadoTarget(task: Task): 'instalaciones' | 'metalurgica' | null {
  const inst =
    task.status === 'instalaciones' ||
    task.assignedSector === 'Instalaciones' ||
    Boolean(task.sectores?.includes('Instalaciones'))
  const met =
    task.status === 'metalurgica' ||
    task.assignedSector === 'Metalúrgica' ||
    Boolean(task.sectores?.includes('Metalúrgica'))

  if (met && !inst) return 'metalurgica'
  if (inst && !met) return 'instalaciones'
  if (inst && met) {
    if (task.status === 'metalurgica' || task.assignedSector === 'Metalúrgica') return 'metalurgica'
    if (task.status === 'instalaciones' || task.assignedSector === 'Instalaciones') return 'instalaciones'
    return 'instalaciones'
  }
  return null
}

/** Ítem de checklist que se crea automáticamente si no existe (Instalaciones / Metalúrgica). */
export const CHECKLIST_TRABAJO_INSTALADO = 'Trabajo instalado'
/** Mismo texto que la etapa del kanban y el ítem de checklist precargado. */
export const CHECKLIST_FINALIZADO = ETAPA_KANBAN_FINALIZADO

const MIN_FOTOS_EVIDENCIA = 3

function isCampoRelevantTask(t: Task): boolean {
  if (t.ordenEliminada) return false
  if (t.entregado) return false
  if (taskEstaEnColumnaInstalacionOMetalurgica(t)) return true
  return opSectoresRequierenFotosLugar(t.sectores)
}

/** OP relacionada con Instalaciones (columna, sector asignado o sector requerido). */
function taskTouchesInstalaciones(t: Task): boolean {
  return (
    t.status === 'instalaciones' ||
    t.assignedSector === 'Instalaciones' ||
    Boolean(t.sectores?.includes('Instalaciones'))
  )
}

/** OP relacionada con Metalúrgica (columna, sector asignado o sector requerido). */
function taskTouchesMetalurgica(t: Task): boolean {
  return (
    t.status === 'metalurgica' ||
    t.assignedSector === 'Metalúrgica' ||
    Boolean(t.sectores?.includes('Metalúrgica'))
  )
}

type CampoListSectorMode = 'instalaciones' | 'metalurgica' | 'both'

/**
 * Una sola fila por número de OP visible: a veces hay dos `Task` (mismo opNumber) con `id` distinto
 * (ej. tarjeta en columna Metalúrgica vs otra que solo lista el sector en `sectores` → «en OP»).
 * Si primero usáramos id numérico, una quedaba `orden:95650` y otra `op:95650` y se duplicaba el listado.
 */
function dedupeKeyForCampoTask(t: Task): string {
  const op = (t.opNumber || '').trim().toLowerCase().replace(/\s+/g, '')
  if (op) return `op:${op}`
  const oid = parseTaskIdToOrdenId(t.id)
  if (oid != null && !Number.isNaN(oid)) return `orden:${oid}`
  return `id:${t.id}`
}

/** Una sola fila por OP: evita duplicados (misma orden en varias tarjetas). */
function dedupeCampoTasksByOrden(tasks: Task[], prefer: CampoListSectorMode): Task[] {
  const map = new Map<string, Task>()
  const score = (t: Task): number => {
    let s = new Date(t.updatedAt || t.createdAt || 0).getTime()
    if (prefer === 'instalaciones') {
      if (t.status === 'instalaciones') s += 1e15
      else if (t.assignedSector === 'Instalaciones') s += 1e14
    } else if (prefer === 'metalurgica') {
      if (t.status === 'metalurgica') s += 1e15
      else if (t.assignedSector === 'Metalúrgica') s += 1e14
    } else {
      if (taskEstaEnColumnaInstalacionOMetalurgica(t)) s += 1e13
    }
    return s
  }
  const better = (a: Task, b: Task): Task => (score(b) > score(a) ? b : a)
  for (const t of tasks) {
    const k = dedupeKeyForCampoTask(t)
    const prev = map.get(k)
    map.set(k, prev ? better(prev, t) : t)
  }
  return [...map.values()]
}

function sectorLabel(task: Task): string {
  if (task.status === 'instalaciones' || task.assignedSector === 'Instalaciones') return 'Instalaciones'
  if (task.status === 'metalurgica' || task.assignedSector === 'Metalúrgica') return 'Metalúrgica'
  if (task.sectores?.includes('Instalaciones')) return 'Instalaciones (en OP)'
  if (task.sectores?.includes('Metalúrgica')) return 'Metalúrgica (en OP)'
  return 'Instalaciones / Metalúrgica'
}

export type ArchivoCampoRow = {
  id?: number
  titulo?: string | null
  url?: string | null
  es_evidencia_campo?: boolean | null
  origen_relevamiento?: boolean | null
}

function collectImageUrls(
  photoUrl: string | undefined,
  archivos: ArchivoCampoRow[],
  opts?: { excludeRelevamiento?: boolean }
): string[] {
  const urls: string[] = []
  if (photoUrl?.trim() && taskPhotoUrlCountAsSitePhoto(photoUrl)) {
    urls.push(photoUrl.trim())
  }
  for (const row of archivos) {
    if (opts?.excludeRelevamiento && row.origen_relevamiento) continue
    const u = row.url?.trim()
    if (!u || urls.includes(u)) continue
    if (isImageAdjuntoUrl(u, row.titulo)) urls.push(u)
  }
  return urls
}

function isAudioAdjuntoUrl(url: string | null | undefined): boolean {
  const u = url?.trim()
  return Boolean(u?.startsWith('data:audio/'))
}

function pickAudioMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return 'audio/webm'
  if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) return 'audio/webm;codecs=opus'
  if (MediaRecorder.isTypeSupported('audio/webm')) return 'audio/webm'
  return ''
}

type Props = {
  tasks: Task[]
  onReloadData?: (options?: { silent?: boolean }) => Promise<void>
}

export default function InstalacionesMetalurgicaCampoPage({ tasks, onReloadData }: Props) {
  const { isAdmin, isInstalaciones, isMetalurgica } = useAuth()
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const listSectorMode: CampoListSectorMode = useMemo(() => {
    if (isAdmin) return 'both'
    if (isMetalurgica) return 'metalurgica'
    if (isInstalaciones) return 'instalaciones'
    return 'both'
  }, [isAdmin, isInstalaciones, isMetalurgica])

  const campoTasks = useMemo(() => {
    let list = tasks.filter(isCampoRelevantTask)
    if (listSectorMode === 'instalaciones') list = list.filter(taskTouchesInstalaciones)
    else if (listSectorMode === 'metalurgica') list = list.filter(taskTouchesMetalurgica)

    list = dedupeCampoTasksByOrden(list, listSectorMode)

    // Más nueva → más antigua: primero por última actualización, luego por creación
    list.sort((a, b) => {
      const ua = new Date(a.updatedAt || a.createdAt || 0).getTime()
      const ub = new Date(b.updatedAt || b.createdAt || 0).getTime()
      if (ub !== ua) return ub - ua
      const ca = new Date(a.createdAt || 0).getTime()
      const cb = new Date(b.createdAt || 0).getTime()
      return cb - ca
    })
    return list
  }, [tasks, listSectorMode])

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

  const titleMain =
    listSectorMode === 'instalaciones'
      ? 'Instalaciones'
      : listSectorMode === 'metalurgica'
        ? 'Metalúrgica'
        : 'Instalaciones · Metalúrgica'
  const subMain =
    listSectorMode === 'instalaciones'
      ? 'Solo OPs vinculadas a Instalaciones (una entrada por orden). Fotos, checklist y evidencia en campo.'
      : listSectorMode === 'metalurgica'
        ? 'Solo OPs vinculadas a Metalúrgica (una entrada por orden). Fotos, checklist y evidencia en campo.'
        : 'OPs en campo — datos, fotos del lugar, checklist y evidencia. Listado sin duplicar la misma orden. Las fotos nuevas se guardan en la base (sin Storage).'
  const emptyMsg =
    listSectorMode === 'instalaciones'
      ? 'No hay OPs de Instalaciones pendientes en este listado.'
      : listSectorMode === 'metalurgica'
        ? 'No hay OPs de Metalúrgica pendientes en este listado.'
        : 'No hay OPs con Instalaciones o Metalúrgica pendientes en este listado.'

  return (
    <div className="campo-app">
      <header className="campo-app-header">
        <h1 className="campo-app-title">{titleMain}</h1>
        <p className="campo-app-sub">{subMain}</p>
      </header>

      <ul className="campo-list">
        {campoTasks.length === 0 && <li className="campo-empty">{emptyMsg}</li>}
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
  const { usuario } = useAuth()
  const ordenId = parseTaskIdToOrdenId(task.id)
  const [archivos, setArchivos] = useState<ArchivoCampoRow[]>([])
  const [subitems, setSubitems] = useState<TareaSubitem[]>([])
  const [relevamientoNotas, setRelevamientoNotas] = useState('')
  const [relevamientoSubitems, setRelevamientoSubitems] = useState<RelevamientoSubitemRecord[]>([])
  const [nuevoItemRelevamiento, setNuevoItemRelevamiento] = useState('')
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadingRelFotos, setUploadingRelFotos] = useState(false)
  const [savingNotasRel, setSavingNotasRel] = useState(false)
  const [finalizando, setFinalizando] = useState(false)
  const [recordingAudio, setRecordingAudio] = useState(false)
  const [relAudioBusy, setRelAudioBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const notasRelevamientoDirtyRef = useRef(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioStreamRef = useRef<MediaStream | null>(null)
  const audioChunksRef = useRef<BlobPart[]>([])

  const finalTarget = useMemo(() => resolveCampoFinalizadoTarget(task), [task])
  const yaFinalizadoEtapa = useMemo(() => {
    if (finalTarget === 'metalurgica') return task.etapaMetalurgica?.trim() === ETAPA_KANBAN_FINALIZADO
    if (finalTarget === 'instalaciones') return task.etapaInstalaciones?.trim() === ETAPA_KANBAN_FINALIZADO
    return false
  }, [task, finalTarget])

  const refreshArchivosYSubitems = useCallback(async () => {
    if (!ordenId) {
      setLoading(false)
      return
    }
    setError(null)
    const [ar, sr, relRow, relSubs] = await Promise.all([
      apiService.getArchivosOrden(ordenId),
      apiService.getSubitems(ordenId),
      apiService.getOrdenRelevamiento(ordenId),
      apiService.getRelevamientoSubitems(ordenId)
    ])
    if (ar.success && ar.data) {
      setArchivos(ar.data as ArchivoCampoRow[])
    } else if (!ar.success) {
      setError(ar.error || 'No se pudieron cargar los archivos')
    }
    if (sr.success && sr.data) {
      let list = sr.data
      const precargados = [CHECKLIST_TRABAJO_INSTALADO, CHECKLIST_FINALIZADO]
      for (const titulo of precargados) {
        const has = list.some((s) => s.titulo.trim().toLowerCase() === titulo.toLowerCase())
        if (!has) {
          const cr = await apiService.createSubitem({ idOrden: ordenId, titulo })
          if (cr.success) {
            const again = await apiService.getSubitems(ordenId)
            if (again.success && again.data) list = again.data
          } else {
            setError((prev) => prev || cr.error || `No se pudo crear «${titulo}» en el checklist`)
          }
        }
      }
      setSubitems(list)
    } else if (!sr.success) {
      setError((prev) => prev || sr.error || 'No se pudo cargar el checklist')
    }
    if (relRow.success && relRow.data && !notasRelevamientoDirtyRef.current) {
      setRelevamientoNotas(relRow.data.notas ?? '')
    } else if (!relRow.success) {
      setError((prev) => prev || relRow.error || 'No se pudieron cargar las notas de relevamiento')
    }
    if (relSubs.success && relSubs.data) {
      setRelevamientoSubitems(relSubs.data)
    } else if (!relSubs.success) {
      setError((prev) => prev || relSubs.error || 'No se pudo cargar el checklist de relevamiento')
    }
    setLoading(false)
  }, [ordenId])

  useEffect(() => {
    notasRelevamientoDirtyRef.current = false
    setRelevamientoNotas('')
    setRelevamientoSubitems([])
  }, [ordenId])

  useEffect(() => {
    void refreshArchivosYSubitems()
  }, [refreshArchivosYSubitems])

  useEffect(() => {
    return () => {
      audioStreamRef.current?.getTracks().forEach((t) => t.stop())
      audioStreamRef.current = null
      if (mediaRecorderRef.current?.state === 'recording') {
        try {
          mediaRecorderRef.current.stop()
        } catch {
          /* ignore */
        }
      }
      mediaRecorderRef.current = null
    }
  }, [])

  const imageUrls = useMemo(
    () => collectImageUrls(task.photoUrl, archivos, { excludeRelevamiento: true }),
    [task.photoUrl, archivos]
  )

  const archivosRelevamiento = useMemo(
    () => archivos.filter((a) => a.origen_relevamiento === true),
    [archivos]
  )

  const relevamientoImageRows = useMemo(
    () => archivosRelevamiento.filter((a) => isImageAdjuntoUrl(a.url, a.titulo)),
    [archivosRelevamiento]
  )

  const relevamientoAudioRows = useMemo(
    () => archivosRelevamiento.filter((a) => isAudioAdjuntoUrl(a.url)),
    [archivosRelevamiento]
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

  const handleGuardarNotasRelevamiento = async () => {
    if (!ordenId || !canUpload) return
    setSavingNotasRel(true)
    setError(null)
    try {
      const nombre = usuario?.nombre?.trim() || 'App campo'
      const res = await apiService.upsertOrdenRelevamiento(ordenId, relevamientoNotas, nombre)
      if (!res.success) {
        setError(res.error || 'No se pudieron guardar las notas (¿parche SQL relevamiento?)')
        return
      }
      notasRelevamientoDirtyRef.current = false
      if (res.data?.notas !== undefined) setRelevamientoNotas(res.data.notas)
    } finally {
      setSavingNotasRel(false)
    }
  }

  const handleAddRelevamientoSubitem = async () => {
    const t = nuevoItemRelevamiento.trim()
    if (!ordenId || !canUpload || !t) return
    setError(null)
    const res = await apiService.createRelevamientoSubitem(ordenId, t)
    if (res.success && res.data) {
      setRelevamientoSubitems((prev) => [...prev, res.data!])
      setNuevoItemRelevamiento('')
    } else {
      setError(res.error || 'No se pudo agregar el ítem')
    }
  }

  const handleToggleRelevamientoSubitem = async (item: RelevamientoSubitemRecord) => {
    if (!canUpload) return
    const next = !item.done
    const res = await apiService.setRelevamientoSubitemDone(item.id, next)
    if (res.success) {
      setRelevamientoSubitems((prev) =>
        prev.map((s) => (s.id === item.id ? { ...s, done: next } : s))
      )
    } else {
      setError(res.error || 'No se pudo actualizar el checklist de relevamiento')
    }
  }

  const handlePickRelevamientoFotos = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files?.length || !ordenId || !canUpload) return
    setUploadingRelFotos(true)
    setError(null)
    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith('image/')) continue
        const dataUrl = await compressImageFileToJpegDataUrl(file)
        const guard = await apiService.guardarArchivoOrden(
          ordenId,
          file.name || 'relevamiento-foto.jpg',
          dataUrl,
          { origenRelevamiento: true }
        )
        if (!guard.success) {
          setError(guard.error || 'Error al guardar foto de relevamiento (¿columna origen_relevamiento?)')
          break
        }
      }
      await refreshArchivosYSubitems()
      await onReloadData?.({ silent: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al subir')
    } finally {
      setUploadingRelFotos(false)
      e.target.value = ''
    }
  }

  const startAudioRecording = async () => {
    if (!ordenId || !canUpload || recordingAudio || typeof navigator === 'undefined' || !navigator.mediaDevices) {
      setError('No se puede grabar audio en este dispositivo o la OP está bloqueada.')
      return
    }
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      audioStreamRef.current = stream
      audioChunksRef.current = []
      const mime = pickAudioMimeType()
      const mr = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream)
      mediaRecorderRef.current = mr
      mr.ondataavailable = (ev) => {
        if (ev.data.size > 0) audioChunksRef.current.push(ev.data)
      }
      mr.onstop = () => {
        void (async () => {
          setRelAudioBusy(true)
          try {
            const blob = new Blob(audioChunksRef.current, { type: mr.mimeType || 'audio/webm' })
            audioChunksRef.current = []
            stream.getTracks().forEach((t) => t.stop())
            audioStreamRef.current = null
            mediaRecorderRef.current = null
            const dataUrl = await blobToDataUrl(blob)
            const ext = blob.type.includes('webm') ? 'webm' : blob.type.includes('ogg') ? 'ogg' : 'webm'
            const guard = await apiService.guardarArchivoOrden(
              ordenId,
              `relevamiento-audio-${Date.now()}.${ext}`,
              dataUrl,
              { origenRelevamiento: true }
            )
            if (!guard.success) {
              setError(guard.error || 'No se pudo guardar el audio')
            } else {
              await refreshArchivosYSubitems()
              await onReloadData?.({ silent: true })
            }
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Error al procesar el audio')
          } finally {
            setRelAudioBusy(false)
            setRecordingAudio(false)
          }
        })()
      }
      mr.start(200)
      setRecordingAudio(true)
    } catch {
      setError('No se pudo acceder al micrófono. Revisá permisos del navegador.')
    }
  }

  const stopAudioRecording = () => {
    const mr = mediaRecorderRef.current
    if (mr && mr.state === 'recording') {
      mr.stop()
    } else {
      setRecordingAudio(false)
      audioStreamRef.current?.getTracks().forEach((t) => t.stop())
      audioStreamRef.current = null
    }
  }

  const handleMarcarEtapaFinalizado = async () => {
    if (!ordenId || !canUpload || !finalTarget || yaFinalizadoEtapa) return
    setFinalizando(true)
    setError(null)
    try {
      const nombre = usuario?.nombre?.trim() || 'App campo'
      const res =
        finalTarget === 'metalurgica'
          ? await apiService.actualizarEtapaMetalurgica(ordenId, ETAPA_KANBAN_FINALIZADO, nombre)
          : await apiService.actualizarEtapaInstalaciones(ordenId, ETAPA_KANBAN_FINALIZADO, nombre)
      if (!res.success) {
        setError(res.error || 'No se pudo marcar la etapa Finalizado')
        return
      }
      await onReloadData?.({ silent: true })
    } finally {
      setFinalizando(false)
    }
  }

  const sectorKanbanNombre = finalTarget === 'metalurgica' ? 'Metalúrgica' : 'Instalaciones'

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

      <section className="campo-card campo-relevamiento-card">
        <h2 className="campo-card-title">Relevamiento</h2>
        <p className="campo-hint">
          Primera etapa en campo: anotaciones, grabaciones y fotos propias del relevamiento. Checklist aparte del de la OP.
        </p>

        <div className="campo-rel-field">
          <span className="campo-k">Anotaciones</span>
          <textarea
            className="campo-relevamiento-textarea"
            rows={5}
            value={relevamientoNotas}
            onChange={(e) => {
              notasRelevamientoDirtyRef.current = true
              setRelevamientoNotas(e.target.value)
            }}
            placeholder="Medidas, estado del lugar, accesos, observaciones…"
            disabled={!canUpload}
          />
          {canUpload && (
            <button
              type="button"
              className="campo-btn-guardar-notas"
              disabled={savingNotasRel}
              onClick={() => void handleGuardarNotasRelevamiento()}
            >
              {savingNotasRel ? 'Guardando…' : 'Guardar notas'}
            </button>
          )}
        </div>

        <h3 className="campo-subsection-title">Audio</h3>
        {canUpload && (
          <div className="campo-audio-actions">
            {!recordingAudio ? (
              <button
                type="button"
                className="campo-btn-grabar"
                disabled={relAudioBusy}
                onClick={() => void startAudioRecording()}
              >
                {relAudioBusy ? 'Procesando…' : '🎤 Grabar audio'}
              </button>
            ) : (
              <button type="button" className="campo-btn-detener" onClick={stopAudioRecording}>
                ⏹ Detener y guardar
              </button>
            )}
          </div>
        )}
        {relevamientoAudioRows.length > 0 && (
          <ul className="campo-rel-audio-list">
            {relevamientoAudioRows.map((row, idx) => (
              <li key={row.id != null ? String(row.id) : `${row.url}-${idx}`}>
                <span className="campo-rel-audio-name">{row.titulo || 'Audio'}</span>
                {row.url ? (
                  <audio className="campo-rel-audio-player" src={row.url} controls preload="metadata" />
                ) : null}
              </li>
            ))}
          </ul>
        )}

        <h3 className="campo-subsection-title">Fotos del relevamiento</h3>
        {canUpload && (
          <label className="campo-upload-btn campo-upload-relev">
            {uploadingRelFotos ? 'Subiendo…' : 'Elegir fotos'}
            <input
              type="file"
              accept="image/*"
              multiple
              hidden
              disabled={uploadingRelFotos}
              onChange={(ev) => void handlePickRelevamientoFotos(ev)}
            />
          </label>
        )}
        {relevamientoImageRows.length > 0 && (
          <div className="campo-photo-grid campo-rel-photo-grid">
            {relevamientoImageRows.map((row) =>
              row.url ? (
                <a key={row.id ?? row.url} href={row.url} target="_blank" rel="noreferrer" className="campo-photo-cell">
                  <img src={row.url} alt="" />
                </a>
              ) : null
            )}
          </div>
        )}

        <h3 className="campo-subsection-title">Checklist de relevamiento</h3>
        <div className="campo-rel-check-add">
          <input
            type="text"
            className="campo-rel-check-input"
            placeholder="Nuevo ítem…"
            value={nuevoItemRelevamiento}
            onChange={(e) => setNuevoItemRelevamiento(e.target.value)}
            disabled={!canUpload}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void handleAddRelevamientoSubitem()
              }
            }}
          />
          <button
            type="button"
            className="campo-rel-check-add-btn"
            disabled={!canUpload || !nuevoItemRelevamiento.trim()}
            onClick={() => void handleAddRelevamientoSubitem()}
          >
            Agregar
          </button>
        </div>
        <ul className="campo-checklist">
          {relevamientoSubitems.map((s) => (
            <li key={s.id}>
              <label className="campo-check-row">
                <input
                  type="checkbox"
                  checked={s.done}
                  disabled={!canUpload}
                  onChange={() => void handleToggleRelevamientoSubitem(s)}
                />
                <span className={s.done ? 'done' : ''}>{s.titulo}</span>
              </label>
            </li>
          ))}
        </ul>
      </section>

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
        <p className="campo-hint">
          Portada y adjuntos de la OP (no incluye fotos guardadas solo en Relevamiento).
        </p>
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

      {finalTarget && (
        <section className="campo-card campo-finalizado-card">
          <h2 className="campo-card-title">Etapa en kanban</h2>
          <p className="campo-hint">
            Misma acción que llevar la ficha a la etapa <strong>{ETAPA_KANBAN_FINALIZADO}</strong> en el kanban de{' '}
            <strong>{sectorKanbanNombre}</strong>.
          </p>
          <button
            type="button"
            className="campo-btn-finalizado"
            disabled={!ordenId || !canUpload || finalizando || yaFinalizadoEtapa}
            onClick={() => void handleMarcarEtapaFinalizado()}
          >
            {finalizando
              ? 'Guardando…'
              : yaFinalizadoEtapa
                ? `Ya en etapa ${ETAPA_KANBAN_FINALIZADO}`
                : ETAPA_KANBAN_FINALIZADO}
          </button>
        </section>
      )}

      <section className="campo-card">
        <h2 className="campo-card-title">Checklist</h2>
        <p className="campo-hint">
          Ítems precargados: «{CHECKLIST_TRABAJO_INSTALADO}» y «{CHECKLIST_FINALIZADO}»; el resto es el checklist de la OP.
        </p>
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

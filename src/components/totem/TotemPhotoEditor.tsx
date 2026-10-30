import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { createPortal } from 'react-dom'
import {
  PHOTO_EDIT_MAX_SIDE,
  canvasToBlob,
  canvasToEditable,
  constrainCropToAspect,
  createEditState,
  croppedPixelSize,
  dragCrop,
  editStatesEqual,
  estimatePrintQuality,
  isCropFull,
  isEditStateNeutral,
  loadEditableImage,
  makePreviewWorkingCopy,
  mirrorState,
  orientedSize,
  renderEdit,
  rotateState,
  FULL_CROP,
  NEUTRAL_ADJUST,
  type CropHandle,
  type CropRect,
  type EditableImage,
  type PhotoAdjust,
  type PhotoEditState
} from '../../utils/totemPhotoEdit'
import type { PrintFormat } from '../../utils/totemPrintDocument'
import { PlotAiEnhanceError, mejorarFotoConPlotAI } from '../../services/totemPhotoEnhanceService'
import './TotemPhotoEditor.css'

export type TotemPhotoEditorTab = 'recorte' | 'ajustes' | 'ia'

export type TotemPhotoEditorResult = {
  blob: Blob
  width: number
  height: number
  usedAi: boolean
}

type Props = {
  src: string
  name: string
  formato: PrintFormat
  initialTab?: TotemPhotoEditorTab
  onClose: () => void
  /** Debe guardar el archivo; si lanza, el editor muestra el error y sigue abierto. */
  onApply: (result: TotemPhotoEditorResult) => Promise<void>
}

/* ───────────────────────── Íconos ───────────────────────── */

const ICONS: Record<string, string> = {
  crop: 'M6 2v14a2 2 0 0 0 2 2h14M2 6h14a2 2 0 0 1 2 2v14',
  sliders: 'M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6',
  sparkles:
    'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3zM19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15zM5 15l.7 1.6L7.3 17l-1.6.7L5 19.3l-.7-1.6L2.7 17l1.6-.7L5 15z',
  rotL: 'M2.5 2v6h6M2.66 15.57a10 10 0 1 0 .57-8.38',
  rotR: 'M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38',
  flipH: 'M12 3v18M8 7l-5 5 5 5V7zM16 7l5 5-5 5V7z',
  flipV: 'M3 12h18M7 8l5-5 5 5H7zM7 16l5 5 5-5H7z',
  undo: 'M3 7v6h6M3 13a9 9 0 1 0 3-7.7L3 8',
  redo: 'M21 7v6h-6M21 13a9 9 0 1 1-3-7.7L21 8',
  reset: 'M3 12a9 9 0 1 0 3-6.7M3 4v5h5',
  close: 'M18 6L6 18M6 6l12 12',
  check: 'M20 6L9 17l-5-5',
  sun: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4',
  contrast: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 3v18M12 3a9 9 0 0 1 0 18',
  drop: 'M12 2.7l5.7 5.7a8 8 0 1 1-11.3 0L12 2.7z',
  diamond: 'M12 2l9 10-9 10L3 12 12 2z',
  portrait: 'M7 3h10a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z',
  landscape: 'M3 7h18a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z',
  warn: 'M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
  swap: 'M7 4L3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7'
}

function Ico({ name, size = 22 }: { name: keyof typeof ICONS | string; size?: number }) {
  return (
    <svg
      className="tpe-ico"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={ICONS[name] ?? ''} />
    </svg>
  )
}

/* ───────────────────────── Proporciones de recorte ───────────────────────── */

type AspectOption = { id: string; label: string; sub?: string; ratio: number | 'original' | null }

/** Proporciones en vertical (ancho/alto < 1); la orientación se acomoda a la foto. */
const ASPECTS: AspectOption[] = [
  { id: 'libre', label: 'Libre', ratio: null },
  { id: 'original', label: 'Original', ratio: 'original' },
  { id: 'a4', label: 'A4 / A3', sub: '210×297', ratio: 210 / 297 },
  { id: 'a3e', label: 'A3 ext.', sub: '32×45', ratio: 32 / 45 },
  { id: '1x1', label: 'Cuadrado', sub: '1:1', ratio: 1 },
  { id: '4x5', label: '4:5', sub: 'Retrato', ratio: 4 / 5 },
  { id: '2x3', label: '2:3', sub: 'Foto 10×15', ratio: 2 / 3 },
  { id: '9x16', label: '9:16', sub: 'Pantalla', ratio: 9 / 16 }
]

function resolveRatio(opt: AspectOption, flip: boolean, ow: number, oh: number): number | null {
  if (opt.ratio === null) return null
  if (opt.ratio === 'original') {
    const r = ow / oh
    return flip ? 1 / r : r
  }
  const portrait = opt.ratio
  if (portrait === 1) return 1
  const landscapeImage = ow > oh
  const wantLandscape = landscapeImage !== flip
  return wantLandscape ? 1 / portrait : portrait
}

/* ───────────────────────── Historial ───────────────────────── */

type BaseBundle = { id: number; full: EditableImage; work: EditableImage; ai: boolean }
type Entry = { base: BaseBundle; state: PhotoEditState }
type Hist = { stack: Entry[]; idx: number }

const HISTORY_MAX = 40

type AiPhase =
  | { phase: 'idle' }
  | { phase: 'loading'; startedAt: number }
  | { phase: 'result'; before: HTMLCanvasElement; after: HTMLCanvasElement; beforeUrl: string; afterUrl: string }
  | { phase: 'error'; message: string; code: string }

const AI_HINTS = [
  'Analizando la luz y el color…',
  'Ajustando contraste y nitidez…',
  'Limpiando el ruido de la imagen…',
  'Puliendo los detalles…',
  'Ya casi está…'
]

function fitBox(ratio: number, maxW: number, maxH: number): { w: number; h: number } {
  if (!(ratio > 0) || maxW <= 0 || maxH <= 0) return { w: 0, h: 0 }
  let w = maxW
  let h = w / ratio
  if (h > maxH) {
    h = maxH
    w = h * ratio
  }
  return { w: Math.floor(w), h: Math.floor(h) }
}

const QUALITY_LABEL: Record<string, string> = {
  excelente: 'Calidad excelente',
  buena: 'Buena calidad',
  media: 'Calidad media',
  baja: 'Resolución baja'
}

export default function TotemPhotoEditor({ src, name, formato, initialTab = 'recorte', onClose, onApply }: Props) {
  const [loadError, setLoadError] = useState<string | null>(null)
  const [hist, setHist] = useState<Hist | null>(null)
  const [live, setLive] = useState<PhotoEditState | null>(null)
  const [tab, setTab] = useState<TotemPhotoEditorTab>(initialTab)
  const [aspectId, setAspectId] = useState('libre')
  const [aspectFlip, setAspectFlip] = useState(false)
  const [ai, setAi] = useState<AiPhase>({ phase: 'idle' })
  const [aiTick, setAiTick] = useState(0)
  const [aiJustApplied, setAiJustApplied] = useState(false)
  const [comparePos, setComparePos] = useState(50)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [confirmExit, setConfirmExit] = useState(false)

  const stageRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const compareRef = useRef<HTMLDivElement>(null)
  const aiAbortRef = useRef<AbortController | null>(null)
  const baseSeq = useRef(0)
  const liveRef = useRef<PhotoEditState | null>(null)
  liveRef.current = live
  const mounted = useRef(true)
  const dragRef = useRef<{
    handle: CropHandle
    startX: number
    startY: number
    start: CropRect
    w: number
    h: number
  } | null>(null)

  const [stageSize, setStageSize] = useState({ w: 0, h: 0 })

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      aiAbortRef.current?.abort()
    }
  }, [])

  /* Carga de la imagen */
  useEffect(() => {
    const ctrl = new AbortController()
    setLoadError(null)
    setHist(null)
    void (async () => {
      try {
        const full = await loadEditableImage(src, ctrl.signal)
        if (ctrl.signal.aborted) return
        const bundle: BaseBundle = { id: ++baseSeq.current, full, work: makePreviewWorkingCopy(full), ai: false }
        setHist({ stack: [{ base: bundle, state: createEditState() }], idx: 0 })
      } catch (e) {
        if (ctrl.signal.aborted) return
        setLoadError(
          e instanceof Error && e.message ? e.message : 'No se pudo abrir la imagen para editarla.'
        )
      }
    })()
    return () => ctrl.abort()
  }, [src])

  /* Tamaño disponible para la foto */
  useLayoutEffect(() => {
    const el = stageRef.current
    if (!el) return
    const measure = () => {
      const r = el.getBoundingClientRect()
      setStageSize({ w: Math.floor(r.width), h: Math.floor(r.height) })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  /* Bloqueo de scroll de fondo y tecla Escape */
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  const entry = hist ? hist.stack[hist.idx] : null
  const current: PhotoEditState = live ?? entry?.state ?? createEditState()
  const base = entry?.base ?? null

  const dirty = !!base && (base.ai || !isEditStateNeutral(current))
  const canUndo = !!hist && hist.idx > 0
  const canRedo = !!hist && hist.idx < hist.stack.length - 1

  const requestClose = useCallback(() => {
    if (saving) return
    if (dirty) setConfirmExit(true)
    else onClose()
  }, [dirty, onClose, saving])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') requestClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [requestClose])

  const commit = useCallback((next: PhotoEditState) => {
    setLive(null)
    setHist((h) => {
      if (!h) return h
      const cur = h.stack[h.idx]
      if (editStatesEqual(cur.state, next)) return h
      const stack = [...h.stack.slice(0, h.idx + 1), { base: cur.base, state: next }]
      const trimmed = stack.length > HISTORY_MAX ? stack.slice(stack.length - HISTORY_MAX) : stack
      return { stack: trimmed, idx: trimmed.length - 1 }
    })
  }, [])

  /* Los sliders actualizan `live`; se confirma al soltar (o tras una breve pausa). */
  useEffect(() => {
    if (!live) return
    const t = window.setTimeout(() => commit(live), 450)
    return () => window.clearTimeout(t)
  }, [live, commit])

  const dims = useMemo(() => {
    if (!base) return null
    const o = orientedSize(base.full.width, base.full.height, current.rotation)
    return { ow: o.w, oh: o.h }
  }, [base, current.rotation])

  const aspectOpt = ASPECTS.find((a) => a.id === aspectId) ?? ASPECTS[0]
  const lockedRatio = dims ? resolveRatio(aspectOpt, aspectFlip, dims.ow, dims.oh) : null

  const showFull = tab === 'recorte' && ai.phase === 'idle'

  const frameRatio = useMemo(() => {
    if (!dims) return 1
    if (showFull) return dims.ow / dims.oh
    return (dims.ow * current.crop.w) / (dims.oh * current.crop.h)
  }, [dims, showFull, current.crop.w, current.crop.h])

  const frame = useMemo(
    () => fitBox(frameRatio, Math.max(0, stageSize.w - 24), Math.max(0, stageSize.h - 24)),
    [frameRatio, stageSize.w, stageSize.h]
  )

  /* Vista previa en vivo */
  useEffect(() => {
    if (!base || frame.w <= 0) return
    const canvas = canvasRef.current
    if (!canvas) return
    const raf = requestAnimationFrame(() => {
      try {
        const side = Math.min(1500, Math.ceil(Math.max(frame.w, frame.h) * Math.min(2, window.devicePixelRatio || 1)))
        const out = renderEdit(base.work, current, { maxSide: side, cropped: !showFull })
        canvas.width = out.width
        canvas.height = out.height
        canvas.getContext('2d')?.drawImage(out, 0, 0)
      } catch {
        /* una pasada fallida no debe tumbar el editor */
      }
    })
    return () => cancelAnimationFrame(raf)
  }, [base, current, showFull, frame.w, frame.h])

  /* Texto rotativo mientras PlotAI trabaja */
  useEffect(() => {
    if (ai.phase !== 'loading') return
    setAiTick(0)
    const id = window.setInterval(() => setAiTick((n) => n + 1), 1000)
    return () => window.clearInterval(id)
  }, [ai.phase])

  /* ───── acciones ───── */

  const refit = (next: PhotoEditState): PhotoEditState => {
    if (!base) return next
    const o = orientedSize(base.full.width, base.full.height, next.rotation)
    const r = resolveRatio(aspectOpt, aspectFlip, o.w, o.h)
    if (!r) return next
    return { ...next, crop: constrainCropToAspect(next.crop, r, o.w, o.h) }
  }

  const doRotate = (dir: 1 | -1) => commit(refit(rotateState(current, dir)))
  const doMirror = (axis: 'h' | 'v') => commit(mirrorState(current, axis))

  const pickAspect = (id: string) => {
    if (!dims) return
    setAspectId(id)
    setAspectFlip(false)
    const opt = ASPECTS.find((a) => a.id === id) ?? ASPECTS[0]
    const r = resolveRatio(opt, false, dims.ow, dims.oh)
    commit({ ...current, crop: r ? constrainCropToAspect(current.crop, r, dims.ow, dims.oh) : current.crop })
  }

  const toggleOrientation = () => {
    if (!dims || !lockedRatio || aspectOpt.ratio === 1) return
    const flip = !aspectFlip
    setAspectFlip(flip)
    const r = resolveRatio(aspectOpt, flip, dims.ow, dims.oh)
    commit({ ...current, crop: r ? constrainCropToAspect(FULL_CROP, r, dims.ow, dims.oh) : current.crop })
  }

  const clearCrop = () => commit({ ...current, crop: { ...FULL_CROP } })

  const setAdjust = (key: keyof PhotoAdjust, value: number) => {
    setLive({ ...current, adjust: { ...current.adjust, [key]: value } })
  }
  const flushLive = () => {
    if (liveRef.current) commit(liveRef.current)
  }
  const resetAdjust = () => commit({ ...current, adjust: { ...NEUTRAL_ADJUST } })

  const undo = () => {
    setLive(null)
    setHist((h) => (h && h.idx > 0 ? { ...h, idx: h.idx - 1 } : h))
  }
  const redo = () => {
    setLive(null)
    setHist((h) => (h && h.idx < h.stack.length - 1 ? { ...h, idx: h.idx + 1 } : h))
  }
  const resetAll = () => {
    setLive(null)
    setAspectId('libre')
    setAspectFlip(false)
    setHist((h) => (h ? { ...h, idx: 0 } : h))
  }

  /* ───── recorte con el dedo ───── */

  const onCropDown = (handle: CropHandle) => (e: ReactPointerEvent<HTMLElement>) => {
    if (!dims || !frameRef.current) return
    e.preventDefault()
    e.stopPropagation()
    const rect = frameRef.current.getBoundingClientRect()
    dragRef.current = {
      handle,
      startX: e.clientX,
      startY: e.clientY,
      start: current.crop,
      w: rect.width,
      h: rect.height
    }
    try {
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    } catch {
      /* algunos navegadores no capturan punteros sintéticos o ya inactivos */
    }
  }

  const onCropMove = (e: ReactPointerEvent<HTMLElement>) => {
    const d = dragRef.current
    if (!d || !dims) return
    const dx = ((e.clientX - d.startX) / d.w) * dims.ow
    const dy = ((e.clientY - d.startY) / d.h) * dims.oh
    const crop = dragCrop(d.start, d.handle, dx, dy, { ratio: lockedRatio, imgW: dims.ow, imgH: dims.oh })
    setLive({ ...current, crop })
  }

  const onCropUp = (e: ReactPointerEvent<HTMLElement>) => {
    if (!dragRef.current) return
    dragRef.current = null
    try {
      ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
    } catch {
      /* ya liberado */
    }
    flushLive()
  }

  /* ───── PlotAI ───── */

  const startEnhance = async () => {
    if (!base || ai.phase === 'loading') return
    setAiJustApplied(false)
    const ctrl = new AbortController()
    aiAbortRef.current = ctrl
    setAi({ phase: 'loading', startedAt: Date.now() })
    try {
      const before = renderEdit(base.full, current, { maxSide: 1536, cropped: true })
      const after = await mejorarFotoConPlotAI(before, { signal: ctrl.signal })
      if (!mounted.current || ctrl.signal.aborted) return
      setComparePos(50)
      setAi({
        phase: 'result',
        before,
        after,
        beforeUrl: before.toDataURL('image/jpeg', 0.9),
        afterUrl: after.toDataURL('image/jpeg', 0.92)
      })
    } catch (e) {
      if (!mounted.current) return
      if (e instanceof PlotAiEnhanceError && e.code === 'cancelled') {
        setAi({ phase: 'idle' })
        return
      }
      setAi({
        phase: 'error',
        code: e instanceof PlotAiEnhanceError ? e.code : 'bad_response',
        message: e instanceof Error && e.message ? e.message : 'PlotAI no pudo mejorar la imagen.'
      })
    }
  }

  const cancelEnhance = () => {
    aiAbortRef.current?.abort()
    setAi({ phase: 'idle' })
  }

  const acceptEnhance = () => {
    if (ai.phase !== 'result') return
    const full = canvasToEditable(ai.after)
    const bundle: BaseBundle = { id: ++baseSeq.current, full, work: makePreviewWorkingCopy(full), ai: true }
    setLive(null)
    setHist((h) => {
      if (!h) return h
      const stack = [...h.stack.slice(0, h.idx + 1), { base: bundle, state: createEditState() }]
      const trimmed = stack.length > HISTORY_MAX ? stack.slice(stack.length - HISTORY_MAX) : stack
      return { stack: trimmed, idx: trimmed.length - 1 }
    })
    setAspectId('libre')
    setAspectFlip(false)
    setAi({ phase: 'idle' })
    setAiJustApplied(true)
  }

  const discardEnhance = () => setAi({ phase: 'idle' })

  /* Comparador antes/después */
  const moveCompare = (clientX: number) => {
    const el = compareRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setComparePos(Math.min(100, Math.max(0, ((clientX - r.left) / r.width) * 100)))
  }

  /* ───── guardar ───── */

  const handleApply = async () => {
    if (!base || saving || !dirty) return
    setSaving(true)
    setSaveError(null)
    try {
      const canvas = renderEdit(base.full, current, { maxSide: PHOTO_EDIT_MAX_SIDE, cropped: true })
      const blob = await canvasToBlob(canvas, 'image/jpeg', 0.92)
      await onApply({ blob, width: canvas.width, height: canvas.height, usedAi: base.ai })
    } catch (e) {
      if (mounted.current) {
        setSaveError(e instanceof Error && e.message ? e.message : 'No se pudo guardar la imagen. Probá de nuevo.')
      }
    } finally {
      if (mounted.current) setSaving(false)
    }
  }

  /* ───── datos para mostrar ───── */

  const outSize = base ? croppedPixelSize(base.full.width, base.full.height, current) : null
  const outCapped =
    outSize && Math.max(outSize.w, outSize.h) > PHOTO_EDIT_MAX_SIDE
      ? (() => {
          const k = PHOTO_EDIT_MAX_SIDE / Math.max(outSize.w, outSize.h)
          return { w: Math.round(outSize.w * k), h: Math.round(outSize.h * k) }
        })()
      : outSize
  const quality = outCapped ? estimatePrintQuality(outCapped.w, outCapped.h, formato) : null

  const aiSeconds = aiTick
  const aiHint =
    aiSeconds >= 30
      ? 'Está tardando un poco más de lo normal…'
      : AI_HINTS[Math.min(AI_HINTS.length - 1, Math.floor(aiSeconds / 6))]

  const adjustRows: Array<{ key: keyof PhotoAdjust; label: string; icon: string; min: number }> = [
    { key: 'brightness', label: 'Brillo', icon: 'sun', min: -100 },
    { key: 'contrast', label: 'Contraste', icon: 'contrast', min: -100 },
    { key: 'saturation', label: 'Saturación', icon: 'drop', min: -100 },
    { key: 'sharpness', label: 'Nitidez', icon: 'diamond', min: 0 }
  ]

  const busyAi = ai.phase === 'loading' || ai.phase === 'result'

  const cropBox = current.crop
  const handles: CropHandle[] = lockedRatio ? ['nw', 'ne', 'se', 'sw'] : ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']

  const ui = (
    <div className="tpe-root" role="dialog" aria-modal="true" aria-label="Editor de foto">
      <div className="tpe-sheet">
        <header className="tpe-head">
          <div className="tpe-head-title">
            <span className="tpe-kicker">Editor de foto</span>
            <h2 title={name}>{name || 'Tu imagen'}</h2>
          </div>
          <div className="tpe-head-tools">
            <button type="button" className="tpe-tool" onClick={undo} disabled={!canUndo || busyAi || saving} aria-label="Deshacer">
              <Ico name="undo" />
              <span>Deshacer</span>
            </button>
            <button type="button" className="tpe-tool" onClick={redo} disabled={!canRedo || busyAi || saving} aria-label="Rehacer">
              <Ico name="redo" />
              <span>Rehacer</span>
            </button>
            <button
              type="button"
              className="tpe-tool"
              onClick={resetAll}
              disabled={!hist || (hist.idx === 0 && isEditStateNeutral(current)) || busyAi || saving}
              aria-label="Restablecer todo"
            >
              <Ico name="reset" />
              <span>Restablecer</span>
            </button>
          </div>
          <button type="button" className="tpe-close" onClick={requestClose} aria-label="Cerrar editor" disabled={saving}>
            <Ico name="close" />
          </button>
        </header>

        <div className="tpe-body">
          <div className="tpe-stage">
            <div className="tpe-stage-main" ref={stageRef}>
            {loadError ? (
              <div className="tpe-state tpe-state--error" role="alert">
                <Ico name="warn" size={36} />
                <strong>No pudimos abrir esta imagen</strong>
                <p>{loadError}</p>
                <button type="button" className="tpe-btn tpe-btn--ghost" onClick={onClose}>
                  Volver
                </button>
              </div>
            ) : !base ? (
              <div className="tpe-state" role="status">
                <span className="tpe-spinner" aria-hidden />
                <strong>Abriendo tu foto…</strong>
              </div>
            ) : ai.phase === 'result' ? (
              <div
                className="tpe-compare"
                ref={compareRef}
                style={{ width: frame.w || undefined, height: frame.h || undefined }}
                onPointerDown={(e) => {
                  try {
                    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
                  } catch {
                    /* sin captura el arrastre igual funciona dentro del comparador */
                  }
                  moveCompare(e.clientX)
                }}
                onPointerMove={(e) => {
                  if (e.buttons || e.pointerType === 'touch') moveCompare(e.clientX)
                }}
              >
                <img src={ai.afterUrl} alt="Imagen mejorada con PlotAI" draggable={false} />
                <img
                  className="tpe-compare-before"
                  src={ai.beforeUrl}
                  alt="Imagen original"
                  draggable={false}
                  style={{ clipPath: `inset(0 ${100 - comparePos}% 0 0)` }}
                />
                <span className="tpe-compare-tag tpe-compare-tag--l">Antes</span>
                <span className="tpe-compare-tag tpe-compare-tag--r">Con PlotAI</span>
                <div className="tpe-compare-bar" style={{ left: `${comparePos}%` }}>
                  <span className="tpe-compare-knob" aria-hidden>
                    <Ico name="swap" size={18} />
                  </span>
                </div>
              </div>
            ) : (
              <div
                className={`tpe-frame${ai.phase === 'loading' ? ' is-busy' : ''}`}
                ref={frameRef}
                style={{ width: frame.w || undefined, height: frame.h || undefined }}
              >
                <canvas ref={canvasRef} className="tpe-canvas" />
                {showFull && (
                  <div className="tpe-crop-clip" aria-hidden>
                    <div
                      className="tpe-crop-hole"
                      style={{
                        left: `${cropBox.x * 100}%`,
                        top: `${cropBox.y * 100}%`,
                        width: `${cropBox.w * 100}%`,
                        height: `${cropBox.h * 100}%`
                      }}
                    />
                  </div>
                )}
                {showFull && (
                  <div
                    className="tpe-crop"
                    style={{
                      left: `${cropBox.x * 100}%`,
                      top: `${cropBox.y * 100}%`,
                      width: `${cropBox.w * 100}%`,
                      height: `${cropBox.h * 100}%`
                    }}
                    onPointerDown={onCropDown('move')}
                    onPointerMove={onCropMove}
                    onPointerUp={onCropUp}
                    onPointerCancel={onCropUp}
                    role="group"
                    aria-label="Zona a imprimir. Arrastrala para moverla"
                  >
                    <span className="tpe-crop-grid" aria-hidden />
                    {handles.map((h) => (
                      <span
                        key={h}
                        className={`tpe-handle tpe-handle--${h}`}
                        onPointerDown={onCropDown(h)}
                        onPointerMove={onCropMove}
                        onPointerUp={onCropUp}
                        onPointerCancel={onCropUp}
                        aria-hidden
                      />
                    ))}
                  </div>
                )}
                {ai.phase === 'loading' && (
                  <div className="tpe-busy" role="status" aria-live="polite">
                    <span className="tpe-busy-glow" aria-hidden />
                    <div className="tpe-busy-card">
                      <span className="tpe-spinner tpe-spinner--ai" aria-hidden />
                      <strong>PlotAI está mejorando tu foto</strong>
                      <span className="tpe-busy-hint">{aiHint}</span>
                      <span className="tpe-busy-time">{aiSeconds}s</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            </div>

            {base && quality && outCapped && (
              <div className={`tpe-quality tpe-quality--${quality.level}`} aria-live="polite">
                <span className="tpe-quality-dot" aria-hidden />
                <strong>{QUALITY_LABEL[quality.level]}</strong>
                <span>
                  ≈ {quality.ppp} ppp en {formato === 'A3E' ? 'A3 ext.' : formato} · {outCapped.w}×{outCapped.h} px
                </span>
              </div>
            )}
          </div>

          <aside className="tpe-panel">
            <div className="tpe-tabs" role="tablist" aria-label="Herramientas">
              {(
                [
                  ['recorte', 'Recortar', 'crop'],
                  ['ajustes', 'Ajustar', 'sliders'],
                  ['ia', 'PlotAI', 'sparkles']
                ] as const
              ).map(([id, label, icon]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={tab === id}
                  className={`tpe-tab${tab === id ? ' is-active' : ''}${id === 'ia' ? ' tpe-tab--ai' : ''}`}
                  onClick={() => setTab(id)}
                  disabled={busyAi && id !== 'ia'}
                >
                  <Ico name={icon} />
                  <span>{label}</span>
                </button>
              ))}
            </div>

            <div className="tpe-panel-body" key={tab}>
              {tab === 'recorte' && (
                <>
                  <section className="tpe-block">
                    <h3>Proporción</h3>
                    <div className="tpe-chips" role="radiogroup" aria-label="Proporción del recorte">
                      {ASPECTS.map((a) => (
                        <button
                          key={a.id}
                          type="button"
                          role="radio"
                          aria-checked={aspectId === a.id}
                          className={`tpe-chip${aspectId === a.id ? ' is-active' : ''}`}
                          onClick={() => pickAspect(a.id)}
                          disabled={!base}
                        >
                          <strong>{a.label}</strong>
                          {a.sub && <small>{a.sub}</small>}
                        </button>
                      ))}
                    </div>
                    {lockedRatio && aspectOpt.ratio !== 1 && (
                      <button type="button" className="tpe-btn tpe-btn--ghost tpe-btn--wide" onClick={toggleOrientation}>
                        <Ico name={lockedRatio < 1 ? 'landscape' : 'portrait'} />
                        Cambiar a {lockedRatio < 1 ? 'horizontal' : 'vertical'}
                      </button>
                    )}
                  </section>

                  <section className="tpe-block">
                    <h3>Girar y espejar</h3>
                    <div className="tpe-grid4">
                      <button type="button" className="tpe-tile" onClick={() => doRotate(-1)} disabled={!base}>
                        <Ico name="rotL" size={26} />
                        <span>Izquierda</span>
                      </button>
                      <button type="button" className="tpe-tile" onClick={() => doRotate(1)} disabled={!base}>
                        <Ico name="rotR" size={26} />
                        <span>Derecha</span>
                      </button>
                      <button type="button" className="tpe-tile" onClick={() => doMirror('h')} disabled={!base}>
                        <Ico name="flipH" size={26} />
                        <span>Espejo ↔</span>
                      </button>
                      <button type="button" className="tpe-tile" onClick={() => doMirror('v')} disabled={!base}>
                        <Ico name="flipV" size={26} />
                        <span>Espejo ↕</span>
                      </button>
                    </div>
                  </section>

                  <p className="tpe-help">Arrastrá el recuadro o sus puntas para elegir qué parte se imprime.</p>
                  {!isCropFull(current.crop) && (
                    <button type="button" className="tpe-btn tpe-btn--ghost tpe-btn--wide" onClick={clearCrop}>
                      Quitar recorte
                    </button>
                  )}
                </>
              )}

              {tab === 'ajustes' && (
                <>
                  <section className="tpe-block">
                    <h3>Luz y color</h3>
                    <div className="tpe-sliders">
                      {adjustRows.map((row) => {
                        const value = current.adjust[row.key]
                        return (
                          <div className="tpe-slider" key={row.key}>
                            <div className="tpe-slider-head">
                              <span className="tpe-slider-label">
                                <Ico name={row.icon} size={20} />
                                {row.label}
                              </span>
                              <button
                                type="button"
                                className="tpe-slider-value"
                                onClick={() => setAdjust(row.key, 0)}
                                disabled={value === 0}
                                title="Volver a 0"
                                aria-label={`${row.label}: ${value}. Tocá para volver a 0`}
                              >
                                {value > 0 && row.min < 0 ? `+${value}` : value}
                              </button>
                            </div>
                            <input
                              type="range"
                              min={row.min}
                              max={100}
                              step={1}
                              value={value}
                              disabled={!base}
                              aria-label={row.label}
                              onChange={(e) => setAdjust(row.key, Number(e.target.value))}
                              onPointerUp={flushLive}
                              onKeyUp={flushLive}
                              style={
                                {
                                  '--tpe-pct': `${((value - row.min) / (100 - row.min)) * 100}%`
                                } as CSSProperties
                              }
                            />
                          </div>
                        )
                      })}
                    </div>
                    <button
                      type="button"
                      className="tpe-btn tpe-btn--ghost tpe-btn--wide"
                      onClick={resetAdjust}
                      disabled={!base || (current.adjust.brightness === 0 && current.adjust.contrast === 0 && current.adjust.saturation === 0 && current.adjust.sharpness === 0)}
                    >
                      <Ico name="reset" />
                      Restablecer ajustes
                    </button>
                  </section>
                  <p className="tpe-help">Los cambios se ven al instante. Podés deshacerlos cuando quieras.</p>
                </>
              )}

              {tab === 'ia' && (
                <section className="tpe-block tpe-ai">
                  <div className="tpe-ai-hero" aria-hidden>
                    <Ico name="sparkles" size={34} />
                  </div>
                  {ai.phase === 'idle' && (
                    <>
                      <h3>Mejorá tu foto con PlotAI</h3>
                      <p className="tpe-help">
                        Corrige la luz, el color y la nitidez para que se imprima mejor. Vas a poder comparar el antes y el
                        después antes de aceptar.
                      </p>
                      {aiJustApplied && (
                        <div className="tpe-note tpe-note--ok" role="status">
                          <Ico name="check" size={18} /> Mejora aplicada. Podés seguir ajustando o deshacerla.
                        </div>
                      )}
                      <button type="button" className="tpe-btn tpe-btn--ai tpe-btn--wide" onClick={() => void startEnhance()} disabled={!base}>
                        <Ico name="sparkles" />
                        {aiJustApplied ? 'Mejorar otra vez' : 'Mejorar con PlotAI'}
                      </button>
                      <p className="tpe-fine">Tarda unos segundos. PlotAI trabaja sobre lo que ves ahora (con tu recorte y ajustes).</p>
                    </>
                  )}
                  {ai.phase === 'loading' && (
                    <>
                      <h3>Mejorando…</h3>
                      <p className="tpe-help">{aiHint}</p>
                      <div className="tpe-progress" aria-hidden>
                        <span />
                      </div>
                      <button type="button" className="tpe-btn tpe-btn--ghost tpe-btn--wide" onClick={cancelEnhance}>
                        Cancelar
                      </button>
                    </>
                  )}
                  {ai.phase === 'result' && (
                    <>
                      <h3>¡Listo! Compará el resultado</h3>
                      <p className="tpe-help">Deslizá la barra sobre la foto para ver el antes y el después.</p>
                      <div className="tpe-seg" role="group" aria-label="Ver">
                        <button type="button" className={comparePos >= 99 ? 'is-active' : ''} onClick={() => setComparePos(100)}>
                          Antes
                        </button>
                        <button type="button" className={comparePos > 1 && comparePos < 99 ? 'is-active' : ''} onClick={() => setComparePos(50)}>
                          Dividido
                        </button>
                        <button type="button" className={comparePos <= 1 ? 'is-active' : ''} onClick={() => setComparePos(0)}>
                          Con PlotAI
                        </button>
                      </div>
                      <button type="button" className="tpe-btn tpe-btn--primary tpe-btn--wide" onClick={acceptEnhance}>
                        <Ico name="check" />
                        Usar la mejora
                      </button>
                      <button type="button" className="tpe-btn tpe-btn--ghost tpe-btn--wide" onClick={discardEnhance}>
                        Descartar y seguir con la mía
                      </button>
                      <p className="tpe-fine">
                        PlotAI devuelve la imagen en ~{Math.round((ai.after.width * ai.after.height) / 100000) / 10} MP; mirá la calidad
                        estimada abajo antes de usarla.
                      </p>
                    </>
                  )}
                  {ai.phase === 'error' && (
                    <>
                      <h3>No se pudo mejorar</h3>
                      <div className="tpe-note tpe-note--err" role="alert">
                        <Ico name="warn" size={18} /> {ai.message}
                      </div>
                      {ai.code !== 'unavailable' && (
                        <button type="button" className="tpe-btn tpe-btn--ai tpe-btn--wide" onClick={() => void startEnhance()}>
                          <Ico name="sparkles" />
                          Reintentar
                        </button>
                      )}
                      <button type="button" className="tpe-btn tpe-btn--ghost tpe-btn--wide" onClick={() => setAi({ phase: 'idle' })}>
                        Seguir sin PlotAI
                      </button>
                    </>
                  )}
                </section>
              )}
            </div>
          </aside>
        </div>

        <footer className="tpe-foot">
          {saveError && (
            <div className="tpe-note tpe-note--err tpe-foot-err" role="alert">
              <Ico name="warn" size={18} /> {saveError}
            </div>
          )}
          <button type="button" className="tpe-btn tpe-btn--ghost tpe-btn--big" onClick={requestClose} disabled={saving}>
            Cancelar
          </button>
          <button
            type="button"
            className="tpe-btn tpe-btn--primary tpe-btn--big tpe-btn--grow"
            onClick={() => void handleApply()}
            disabled={!base || !dirty || saving || busyAi}
            title={busyAi ? 'Primero aceptá o descartá la mejora de PlotAI' : undefined}
          >
            {saving ? (
              <>
                <span className="tpe-spinner tpe-spinner--sm" aria-hidden /> Guardando…
              </>
            ) : busyAi ? (
              'Terminá con PlotAI primero'
            ) : dirty ? (
              <>
                <Ico name="check" /> Aplicar y volver
              </>
            ) : (
              'Sin cambios todavía'
            )}
          </button>
        </footer>

        {confirmExit && (
          <div className="tpe-confirm" role="alertdialog" aria-label="Descartar cambios">
            <div className="tpe-confirm-card">
              <h3>¿Salir sin aplicar?</h3>
              <p>Tus cambios en la foto se van a perder.</p>
              <div className="tpe-confirm-actions">
                <button type="button" className="tpe-btn tpe-btn--ghost tpe-btn--big" onClick={() => setConfirmExit(false)}>
                  Seguir editando
                </button>
                <button type="button" className="tpe-btn tpe-btn--danger tpe-btn--big" onClick={onClose}>
                  Descartar y salir
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )

  return createPortal(ui, document.body)
}

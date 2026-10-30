/**
 * Motor del editor de fotos del tótem (recorte, giros y ajustes).
 * Las funciones de geometría y de píxeles son puras (testeables en Node);
 * las de canvas solo se usan en el navegador.
 */
import type { PrintFormat } from './totemPrintDocument'

export type PhotoRotation = 0 | 90 | 180 | 270

/** Rectángulo normalizado (0–1) sobre la imagen ya girada/espejada tal como se ve. */
export type CropRect = { x: number; y: number; w: number; h: number }

export type PhotoAdjust = {
  /** -100…100 (0 = sin cambio) */
  brightness: number
  /** -100…100 */
  contrast: number
  /** -100…100 */
  saturation: number
  /** 0…100 */
  sharpness: number
}

/**
 * Orden de transformación sobre el original: primero espejo horizontal (si flipH)
 * y después giro horario `rotation`. Todo espejo/giro "visible" se traduce a este par.
 */
export type PhotoEditState = {
  rotation: PhotoRotation
  flipH: boolean
  crop: CropRect
  adjust: PhotoAdjust
}

export const FULL_CROP: CropRect = { x: 0, y: 0, w: 1, h: 1 }
export const NEUTRAL_ADJUST: PhotoAdjust = { brightness: 0, contrast: 0, saturation: 0, sharpness: 0 }

/** Tope de lado largo al cargar/exportar (tablets con poca RAM). */
export const PHOTO_EDIT_MAX_SIDE = 5000
/** Lado largo de la copia de trabajo para la vista previa en vivo. */
export const PHOTO_PREVIEW_WORK_SIDE = 1500

export function createEditState(): PhotoEditState {
  return { rotation: 0, flipH: false, crop: { ...FULL_CROP }, adjust: { ...NEUTRAL_ADJUST } }
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const round4 = (v: number) => Math.round(v * 10000) / 10000

function normRotation(deg: number): PhotoRotation {
  return ((((Math.round(deg / 90) * 90) % 360) + 360) % 360) as PhotoRotation
}

export function isCropFull(crop: CropRect): boolean {
  return crop.x <= 0.0005 && crop.y <= 0.0005 && crop.w >= 0.999 && crop.h >= 0.999
}

export function isAdjustNeutral(adj: PhotoAdjust): boolean {
  return adj.brightness === 0 && adj.contrast === 0 && adj.saturation === 0 && adj.sharpness === 0
}

export function isEditStateNeutral(state: PhotoEditState): boolean {
  return state.rotation === 0 && !state.flipH && isCropFull(state.crop) && isAdjustNeutral(state.adjust)
}

export function editStatesEqual(a: PhotoEditState, b: PhotoEditState): boolean {
  return (
    a.rotation === b.rotation &&
    a.flipH === b.flipH &&
    a.crop.x === b.crop.x &&
    a.crop.y === b.crop.y &&
    a.crop.w === b.crop.w &&
    a.crop.h === b.crop.h &&
    a.adjust.brightness === b.adjust.brightness &&
    a.adjust.contrast === b.adjust.contrast &&
    a.adjust.saturation === b.adjust.saturation &&
    a.adjust.sharpness === b.adjust.sharpness
  )
}

export function orientedSize(w: number, h: number, rotation: PhotoRotation): { w: number; h: number } {
  return rotation === 90 || rotation === 270 ? { w: h, h: w } : { w, h }
}

function rotateCropCw(c: CropRect): CropRect {
  return { x: round4(1 - c.y - c.h), y: c.x, w: c.h, h: c.w }
}

function rotateCropCcw(c: CropRect): CropRect {
  return { x: c.y, y: round4(1 - c.x - c.w), w: c.h, h: c.w }
}

/** Giro de 90° tal como lo ve el usuario (1 = horario, -1 = antihorario). */
export function rotateState(state: PhotoEditState, dir: 1 | -1): PhotoEditState {
  return {
    ...state,
    rotation: normRotation(state.rotation + dir * 90),
    crop: dir === 1 ? rotateCropCw(state.crop) : rotateCropCcw(state.crop)
  }
}

/** Espejo visible: 'h' invierte izquierda/derecha, 'v' invierte arriba/abajo. */
export function mirrorState(state: PhotoEditState, axis: 'h' | 'v'): PhotoEditState {
  const c = state.crop
  if (axis === 'h') {
    return {
      ...state,
      flipH: !state.flipH,
      rotation: normRotation(360 - state.rotation),
      crop: { ...c, x: round4(1 - c.x - c.w) }
    }
  }
  return {
    ...state,
    flipH: !state.flipH,
    rotation: normRotation(540 - state.rotation),
    crop: { ...c, y: round4(1 - c.y - c.h) }
  }
}

/* ───────────────────────── Recorte (geometría en px) ───────────────────────── */

export type CropHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'move'

const MIN_CROP_PX = 48

function minCropPx(imgW: number, imgH: number): number {
  return Math.min(MIN_CROP_PX, Math.max(8, Math.min(imgW, imgH) * 0.2))
}

/** Mayor rectángulo con proporción `ratio` (ancho/alto) contenido en `crop`, centrado en él. */
export function constrainCropToAspect(
  crop: CropRect,
  ratio: number | null,
  imgW: number,
  imgH: number
): CropRect {
  if (!ratio || ratio <= 0) return crop
  const cw = crop.w * imgW
  const ch = crop.h * imgH
  let w = cw
  let h = w / ratio
  if (h > ch) {
    h = ch
    w = h * ratio
  }
  const cx = (crop.x + crop.w / 2) * imgW
  const cy = (crop.y + crop.h / 2) * imgH
  let x = cx - w / 2
  let y = cy - h / 2
  x = clamp(x, 0, imgW - w)
  y = clamp(y, 0, imgH - h)
  return { x: round4(x / imgW), y: round4(y / imgH), w: round4(w / imgW), h: round4(h / imgH) }
}

/**
 * Aplica un arrastre (en px de la imagen girada) a un recorte inicial.
 * Con `ratio` fijo solo las esquinas redimensionan; los bordes quedan para el modo libre.
 */
export function dragCrop(
  start: CropRect,
  handle: CropHandle,
  dxPx: number,
  dyPx: number,
  opts: { ratio: number | null; imgW: number; imgH: number }
): CropRect {
  const { ratio, imgW, imgH } = opts
  const minPx = minCropPx(imgW, imgH)
  let x0 = start.x * imgW
  let y0 = start.y * imgH
  let x1 = (start.x + start.w) * imgW
  let y1 = (start.y + start.h) * imgH
  const w0 = x1 - x0
  const h0 = y1 - y0

  const out = (l: number, t: number, r: number, b: number): CropRect => ({
    x: round4(l / imgW),
    y: round4(t / imgH),
    w: round4((r - l) / imgW),
    h: round4((b - t) / imgH)
  })

  if (handle === 'move') {
    const nx = clamp(x0 + dxPx, 0, imgW - w0)
    const ny = clamp(y0 + dyPx, 0, imgH - h0)
    return out(nx, ny, nx + w0, ny + h0)
  }

  const isCorner = handle.length === 2
  if (ratio && ratio > 0 && isCorner) {
    const east = handle.includes('e')
    const south = handle.includes('s')
    const ax = east ? x0 : x1
    const ay = south ? y0 : y1
    const px = (east ? x1 : x0) + dxPx
    const py = (south ? y1 : y0) + dyPx
    const sx = east ? 1 : -1
    const sy = south ? 1 : -1
    let w = Math.max(0, (px - ax) * sx)
    let h = Math.max(0, (py - ay) * sy)
    if (w / ratio > h) h = w / ratio
    else w = h * ratio
    const maxW = sx > 0 ? imgW - ax : ax
    const maxH = sy > 0 ? imgH - ay : ay
    const k = Math.min(1, w > 0 ? maxW / w : 1, h > 0 ? maxH / h : 1)
    w *= k
    h *= k
    let minW = minPx
    let minH = minW / ratio
    if (minH < minPx) {
      minH = minPx
      minW = minH * ratio
    }
    if (w < minW || h < minH) {
      w = minW
      h = minH
      const kk = Math.min(1, maxW / w, maxH / h)
      w *= kk
      h *= kk
    }
    const l = sx > 0 ? ax : ax - w
    const t = sy > 0 ? ay : ay - h
    return out(l, t, l + w, t + h)
  }

  if (handle.includes('w')) x0 = clamp(x0 + dxPx, 0, x1 - minPx)
  if (handle.includes('e')) x1 = clamp(x1 + dxPx, x0 + minPx, imgW)
  if (handle.includes('n')) y0 = clamp(y0 + dyPx, 0, y1 - minPx)
  if (handle.includes('s')) y1 = clamp(y1 + dyPx, y0 + minPx, imgH)
  return out(x0, y0, x1, y1)
}

/** Tamaño en px del resultado final (recorte sobre la imagen girada), sin tope de exportación. */
export function croppedPixelSize(
  imgW: number,
  imgH: number,
  state: Pick<PhotoEditState, 'rotation' | 'crop'>
): { w: number; h: number } {
  const o = orientedSize(imgW, imgH, state.rotation)
  return {
    w: Math.max(1, Math.round(o.w * state.crop.w)),
    h: Math.max(1, Math.round(o.h * state.crop.h))
  }
}

/* ───────────────────────── Calidad de impresión ───────────────────────── */

const PAGE_MM: Record<PrintFormat, { w: number; h: number }> = {
  A4: { w: 210, h: 297 },
  A3: { w: 297, h: 420 },
  A3E: { w: 320, h: 450 }
}

export type PrintQualityLevel = 'excelente' | 'buena' | 'media' | 'baja'

/** Resolución efectiva (ppp) si la imagen entra completa en la hoja, con la orientación que mejor le calza. */
export function estimatePrintQuality(
  pxW: number,
  pxH: number,
  format: PrintFormat
): { ppp: number; level: PrintQualityLevel } {
  const page = PAGE_MM[format] ?? PAGE_MM.A4
  const landscape = pxW > pxH
  const pw = (landscape ? page.h : page.w) / 25.4
  const ph = (landscape ? page.w : page.h) / 25.4
  const ppp = Math.round(Math.min(pxW / pw, pxH / ph))
  const level: PrintQualityLevel = ppp >= 200 ? 'excelente' : ppp >= 130 ? 'buena' : ppp >= 90 ? 'media' : 'baja'
  return { ppp, level }
}

/* ───────────────────────── Píxeles ───────────────────────── */

function boxBlurRgb(src: Uint8ClampedArray, w: number, h: number, r: number): Uint8ClampedArray {
  const tmp = new Uint8ClampedArray(src.length)
  const out = new Uint8ClampedArray(src.length)
  const win = 2 * r + 1

  for (let y = 0; y < h; y++) {
    const row = y * w * 4
    for (let c = 0; c < 3; c++) {
      let sum = 0
      for (let k = -r; k <= r; k++) sum += src[row + clamp(k, 0, w - 1) * 4 + c]
      for (let x = 0; x < w; x++) {
        tmp[row + x * 4 + c] = sum / win
        const add = Math.min(w - 1, x + r + 1)
        const sub = Math.max(0, x - r)
        sum += src[row + add * 4 + c] - src[row + sub * 4 + c]
      }
    }
  }

  for (let x = 0; x < w; x++) {
    for (let c = 0; c < 3; c++) {
      let sum = 0
      for (let k = -r; k <= r; k++) sum += tmp[clamp(k, 0, h - 1) * w * 4 + x * 4 + c]
      for (let y = 0; y < h; y++) {
        out[y * w * 4 + x * 4 + c] = sum / win
        const add = Math.min(h - 1, y + r + 1)
        const sub = Math.max(0, y - r)
        sum += tmp[add * w * 4 + x * 4 + c] - tmp[sub * w * 4 + x * 4 + c]
      }
    }
  }
  return out
}

/** Máscara de enfoque; el radio escala con el tamaño para que la vista previa y el archivo final se vean parecidos. */
function unsharp(data: Uint8ClampedArray, w: number, h: number, sharpness: number): void {
  const amount = (clamp(sharpness, 0, 100) / 100) * 1.6
  if (amount <= 0 || w < 3 || h < 3) return
  const radius = Math.max(1, Math.round(Math.max(w, h) / 900))
  const blur = boxBlurRgb(data, w, h, radius)
  for (let i = 0; i < data.length; i += 4) {
    data[i] = data[i] + amount * (data[i] - blur[i])
    data[i + 1] = data[i + 1] + amount * (data[i + 1] - blur[i + 1])
    data[i + 2] = data[i + 2] + amount * (data[i + 2] - blur[i + 2])
  }
}

/** Brillo, contraste, saturación y nitidez sobre datos RGBA (in-place). */
export function applyAdjustments(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  adj: PhotoAdjust
): void {
  if (isAdjustNeutral(adj)) return
  const brightness = clamp(adj.brightness, -100, 100)
  const contrast = clamp(adj.contrast, -100, 100)
  const saturation = clamp(adj.saturation, -100, 100)

  if (brightness !== 0 || contrast !== 0 || saturation !== 0) {
    const lut = new Uint8ClampedArray(256)
    const cFac = 1 + (contrast / 100) * 0.8
    const bOff = brightness * 0.8
    for (let i = 0; i < 256; i++) lut[i] = (i - 128) * cFac + 128 + bOff
    const sFac = 1 + saturation / 100
    for (let i = 0; i < data.length; i += 4) {
      const r = lut[data[i]]
      const g = lut[data[i + 1]]
      const b = lut[data[i + 2]]
      if (saturation !== 0) {
        const gray = 0.299 * r + 0.587 * g + 0.114 * b
        data[i] = gray + (r - gray) * sFac
        data[i + 1] = gray + (g - gray) * sFac
        data[i + 2] = gray + (b - gray) * sFac
      } else {
        data[i] = r
        data[i + 1] = g
        data[i + 2] = b
      }
    }
  }

  if (adj.sharpness > 0) unsharp(data, width, height, adj.sharpness)
}

/* ───────────────────────── Canvas (navegador) ───────────────────────── */

export type EditableImage = {
  source: CanvasImageSource
  width: number
  height: number
}

function createCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(w))
  c.height = Math.max(1, Math.round(h))
  return c
}

/** Imagen completa girada/espejada, sobre fondo blanco (el papel). */
export function drawOriented(img: EditableImage, state: PhotoEditState, scale: number): HTMLCanvasElement {
  const o = orientedSize(img.width, img.height, state.rotation)
  const canvas = createCanvas(o.w * scale, o.h * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas no disponible')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.translate(canvas.width / 2, canvas.height / 2)
  ctx.rotate((state.rotation * Math.PI) / 180)
  if (state.flipH) ctx.scale(-1, 1)
  const dw = img.width * scale
  const dh = img.height * scale
  ctx.drawImage(img.source, -dw / 2, -dh / 2, dw, dh)
  return canvas
}

/**
 * Resultado de la edición. `cropped: false` devuelve la imagen entera (para el modo recorte),
 * con los ajustes de color ya aplicados.
 */
export function renderEdit(
  img: EditableImage,
  state: PhotoEditState,
  opts: { maxSide: number; cropped: boolean }
): HTMLCanvasElement {
  const o = orientedSize(img.width, img.height, state.rotation)
  const region = opts.cropped ? state.crop : FULL_CROP
  const rw = o.w * region.w
  const rh = o.h * region.h
  const scale = Math.min(1, opts.maxSide / Math.max(rw, rh))
  const full = drawOriented(img, state, scale)

  let out = full
  if (opts.cropped && !isCropFull(state.crop)) {
    out = createCanvas(rw * scale, rh * scale)
    const octx = out.getContext('2d')
    if (!octx) throw new Error('Canvas no disponible')
    octx.imageSmoothingEnabled = true
    octx.imageSmoothingQuality = 'high'
    octx.drawImage(
      full,
      state.crop.x * full.width,
      state.crop.y * full.height,
      state.crop.w * full.width,
      state.crop.h * full.height,
      0,
      0,
      out.width,
      out.height
    )
  }

  if (!isAdjustNeutral(state.adjust)) {
    const ctx = out.getContext('2d')
    if (!ctx) throw new Error('Canvas no disponible')
    const frame = ctx.getImageData(0, 0, out.width, out.height)
    applyAdjustments(frame.data, frame.width, frame.height, state.adjust)
    ctx.putImageData(frame, 0, 0)
  }
  return out
}

export function canvasToBlob(canvas: HTMLCanvasElement, type = 'image/jpeg', quality = 0.92): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('No se pudo generar la imagen editada.'))),
      type,
      quality
    )
  })
}

/** Reduce a `maxSide` (nunca amplía). Devuelve el mismo canvas si ya entra. */
export function downscaleCanvas(src: HTMLCanvasElement, maxSide: number): HTMLCanvasElement {
  const longest = Math.max(src.width, src.height)
  if (longest <= maxSide) return src
  const k = maxSide / longest
  const out = createCanvas(src.width * k, src.height * k)
  const ctx = out.getContext('2d')
  if (!ctx) throw new Error('Canvas no disponible')
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(src, 0, 0, out.width, out.height)
  return out
}

/** Carga una imagen (URL http/data) como base editable, reduciendo si es gigante. */
export async function loadEditableImage(src: string, signal?: AbortSignal): Promise<EditableImage> {
  const resp = await fetch(src, { signal })
  if (!resp.ok) throw new Error(`No se pudo descargar la imagen (${resp.status}).`)
  const blob = await resp.blob()
  let bitmap: ImageBitmap | HTMLImageElement
  try {
    bitmap = await createImageBitmap(blob)
  } catch {
    const url = URL.createObjectURL(blob)
    try {
      bitmap = await new Promise<HTMLImageElement>((resolve, reject) => {
        const im = new Image()
        im.onload = () => resolve(im)
        im.onerror = () => reject(new Error('Este formato de imagen no se puede editar en el tótem.'))
        im.src = url
      })
    } finally {
      URL.revokeObjectURL(url)
    }
  }
  const w = 'naturalWidth' in bitmap ? bitmap.naturalWidth : bitmap.width
  const h = 'naturalHeight' in bitmap ? bitmap.naturalHeight : bitmap.height
  if (!w || !h) throw new Error('La imagen está vacía o dañada.')
  const longest = Math.max(w, h)
  if (longest > PHOTO_EDIT_MAX_SIDE) {
    const k = PHOTO_EDIT_MAX_SIDE / longest
    const c = createCanvas(w * k, h * k)
    const ctx = c.getContext('2d')
    if (!ctx) throw new Error('Canvas no disponible')
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(bitmap, 0, 0, c.width, c.height)
    if ('close' in bitmap) bitmap.close()
    return { source: c, width: c.width, height: c.height }
  }
  return { source: bitmap, width: w, height: h }
}

/** Copia de trabajo liviana para la vista previa en vivo. */
export function makePreviewWorkingCopy(img: EditableImage, maxSide = PHOTO_PREVIEW_WORK_SIDE): EditableImage {
  const longest = Math.max(img.width, img.height)
  if (longest <= maxSide) return img
  const k = maxSide / longest
  const c = createCanvas(img.width * k, img.height * k)
  const ctx = c.getContext('2d')
  if (!ctx) throw new Error('Canvas no disponible')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img.source, 0, 0, c.width, c.height)
  return { source: c, width: c.width, height: c.height }
}

export function canvasToEditable(canvas: HTMLCanvasElement): EditableImage {
  return { source: canvas, width: canvas.width, height: canvas.height }
}

export function dataUrlToCanvas(dataUrl: string): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const im = new Image()
    im.onload = () => {
      const c = createCanvas(im.naturalWidth, im.naturalHeight)
      const ctx = c.getContext('2d')
      if (!ctx) {
        reject(new Error('Canvas no disponible'))
        return
      }
      ctx.drawImage(im, 0, 0)
      resolve(c)
    }
    im.onerror = () => reject(new Error('No se pudo leer la imagen devuelta.'))
    im.src = dataUrl
  })
}

import assert from 'node:assert/strict'
import test from 'node:test'
import {
  applyAdjustments,
  constrainCropToAspect,
  createEditState,
  dragCrop,
  estimatePrintQuality,
  isEditStateNeutral,
  mirrorState,
  rotateState,
  type CropRect,
  type PhotoEditState
} from './totemPhotoEdit'

const close = (a: number, b: number, eps = 1e-3) => assert.ok(Math.abs(a - b) <= eps, `${a} ≠ ${b}`)

/** Dónde cae un punto normalizado del original según el estado: primero espejo H, después giro horario. */
function mapPoint(state: PhotoEditState, px: number, py: number): { x: number; y: number } {
  let x = state.flipH ? 1 - px : px
  let y = py
  for (let i = 0; i < state.rotation / 90; i++) {
    const nx = 1 - y
    y = x
    x = nx
  }
  return { x, y }
}

const sample = (): PhotoEditState => ({
  ...createEditState(),
  crop: { x: 0.1, y: 0.2, w: 0.5, h: 0.3 }
})

test('cuatro giros horarios devuelven el estado original', () => {
  let s = sample()
  for (let i = 0; i < 4; i++) s = rotateState(s, 1)
  assert.equal(s.rotation, 0)
  assert.equal(s.flipH, false)
  close(s.crop.x, 0.1)
  close(s.crop.y, 0.2)
  close(s.crop.w, 0.5)
  close(s.crop.h, 0.3)
})

test('girar a la derecha y volver a la izquierda no cambia nada', () => {
  const s = rotateState(rotateState(sample(), 1), -1)
  assert.equal(s.rotation, 0)
  close(s.crop.x, 0.1)
  close(s.crop.y, 0.2)
})

test('espejar dos veces es la identidad (H y V)', () => {
  for (const axis of ['h', 'v'] as const) {
    const s = mirrorState(mirrorState(sample(), axis), axis)
    assert.equal(s.flipH, false)
    assert.equal(s.rotation, 0)
    close(s.crop.x, 0.1)
    close(s.crop.y, 0.2)
  }
})

test('el álgebra de estado coincide con el movimiento real de los puntos', () => {
  let s: PhotoEditState = sample()
  const probe = { x: 0.3, y: 0.7 }
  const ops: Array<(st: PhotoEditState) => PhotoEditState> = [
    (st) => rotateState(st, 1),
    (st) => mirrorState(st, 'h'),
    (st) => rotateState(st, 1),
    (st) => mirrorState(st, 'v'),
    (st) => rotateState(st, -1),
    (st) => mirrorState(st, 'h')
  ]
  const visible = [
    (p: { x: number; y: number }) => ({ x: 1 - p.y, y: p.x }),
    (p: { x: number; y: number }) => ({ x: 1 - p.x, y: p.y }),
    (p: { x: number; y: number }) => ({ x: 1 - p.y, y: p.x }),
    (p: { x: number; y: number }) => ({ x: p.x, y: 1 - p.y }),
    (p: { x: number; y: number }) => ({ x: p.y, y: 1 - p.x }),
    (p: { x: number; y: number }) => ({ x: 1 - p.x, y: p.y })
  ]
  let expected = mapPoint(s, probe.x, probe.y)
  ops.forEach((op, i) => {
    s = op(s)
    expected = visible[i](expected)
    const got = mapPoint(s, probe.x, probe.y)
    close(got.x, expected.x)
    close(got.y, expected.y)
  })
})

test('el recorte acompaña al giro de 90° y conserva su área', () => {
  const s = rotateState(sample(), 1)
  close(s.crop.w, 0.3)
  close(s.crop.h, 0.5)
  close(s.crop.w * s.crop.h, 0.15)
})

test('constrainCropToAspect respeta la proporción y queda dentro de la imagen', () => {
  const full: CropRect = { x: 0, y: 0, w: 1, h: 1 }
  const r = constrainCropToAspect(full, 210 / 297, 4000, 3000)
  close((r.w * 4000) / (r.h * 3000), 210 / 297, 5e-3)
  assert.ok(r.x >= 0 && r.y >= 0 && r.x + r.w <= 1.0001 && r.y + r.h <= 1.0001)
  assert.deepEqual(constrainCropToAspect(full, null, 4000, 3000), full)
})

test('dragCrop: mover queda dentro de la imagen', () => {
  const start: CropRect = { x: 0.2, y: 0.2, w: 0.4, h: 0.4 }
  const r = dragCrop(start, 'move', 9999, -9999, { ratio: null, imgW: 1000, imgH: 1000 })
  close(r.x, 0.6)
  close(r.y, 0)
  close(r.w, 0.4)
})

test('dragCrop: esquina con proporción fija mantiene la proporción', () => {
  const start: CropRect = { x: 0.1, y: 0.1, w: 0.4, h: 0.4 }
  const ratio = 0.5
  const r = dragCrop(start, 'se', 120, 30, { ratio, imgW: 1000, imgH: 1000 })
  close((r.w * 1000) / (r.h * 1000), ratio, 5e-3)
  assert.ok(r.x + r.w <= 1.0001 && r.y + r.h <= 1.0001)
  close(r.x, 0.1)
  close(r.y, 0.1)
})

test('dragCrop: no permite recortes menores al mínimo', () => {
  const start: CropRect = { x: 0.1, y: 0.1, w: 0.4, h: 0.4 }
  const r = dragCrop(start, 'se', -5000, -5000, { ratio: null, imgW: 1000, imgH: 1000 })
  assert.ok(r.w * 1000 >= 47.9 && r.h * 1000 >= 47.9)
})

test('estimatePrintQuality distingue una foto grande de una chica', () => {
  const buena = estimatePrintQuality(2480, 3508, 'A4')
  assert.equal(buena.level, 'excelente')
  assert.ok(buena.ppp >= 295 && buena.ppp <= 305)
  const chica = estimatePrintQuality(1024, 768, 'A4')
  assert.equal(chica.level, 'baja')
})

function px(r: number, g: number, b: number, n = 1): Uint8ClampedArray {
  const d = new Uint8ClampedArray(n * 4)
  for (let i = 0; i < n; i++) d.set([r, g, b, 255], i * 4)
  return d
}

test('ajustes neutros no tocan los píxeles', () => {
  const d = px(120, 40, 200, 4)
  const before = Array.from(d)
  applyAdjustments(d, 2, 2, { brightness: 0, contrast: 0, saturation: 0, sharpness: 0 })
  assert.deepEqual(Array.from(d), before)
})

test('brillo positivo aclara y negativo oscurece', () => {
  const up = px(100, 100, 100)
  applyAdjustments(up, 1, 1, { brightness: 50, contrast: 0, saturation: 0, sharpness: 0 })
  assert.ok(up[0] > 100)
  const down = px(100, 100, 100)
  applyAdjustments(down, 1, 1, { brightness: -50, contrast: 0, saturation: 0, sharpness: 0 })
  assert.ok(down[0] < 100)
})

test('saturación -100 deja la imagen en grises', () => {
  const d = px(220, 40, 90)
  applyAdjustments(d, 1, 1, { brightness: 0, contrast: 0, saturation: -100, sharpness: 0 })
  assert.equal(d[0], d[1])
  assert.equal(d[1], d[2])
})

test('contraste aleja los valores del gris medio', () => {
  const light = px(180, 180, 180)
  const dark = px(70, 70, 70)
  const adj = { brightness: 0, contrast: 60, saturation: 0, sharpness: 0 }
  applyAdjustments(light, 1, 1, adj)
  applyAdjustments(dark, 1, 1, adj)
  assert.ok(light[0] > 180)
  assert.ok(dark[0] < 70)
})

test('nitidez no altera zonas planas y marca los bordes', () => {
  const w = 8
  const h = 4
  const flat = px(90, 90, 90, w * h)
  applyAdjustments(flat, w, h, { brightness: 0, contrast: 0, saturation: 0, sharpness: 100 })
  assert.equal(flat[0], 90)
  assert.equal(flat[(w * h - 1) * 4], 90)

  const edge = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) edge.set(x < w / 2 ? [100, 100, 100, 255] : [160, 160, 160, 255], (y * w + x) * 4)
  }
  applyAdjustments(edge, w, h, { brightness: 0, contrast: 0, saturation: 0, sharpness: 100 })
  const darkSide = edge[(1 * w + 3) * 4]
  const lightSide = edge[(1 * w + 4) * 4]
  assert.ok(darkSide < 100, 'el lado oscuro del borde se oscurece')
  assert.ok(lightSide > 160, 'el lado claro del borde se aclara')
})

test('un estado nuevo es neutro', () => {
  assert.ok(isEditStateNeutral(createEditState()))
  assert.ok(!isEditStateNeutral(rotateState(createEditState(), 1)))
})

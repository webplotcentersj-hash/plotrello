import * as THREE from 'three'

const SIZE = 1.7
const FINAL_POS = new THREE.Vector3(1.6, 0.55, 0.25)
const FINAL_ROT_Y = -0.24

function roundedRect(w: number, h: number, r: number): THREE.Shape {
  const s = new THREE.Shape()
  const x = -w / 2
  const y = -h / 2
  s.moveTo(x + r, y)
  s.lineTo(x + w - r, y)
  s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false)
  s.lineTo(x + w, y + h - r)
  s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false)
  s.lineTo(x + r, y + h)
  s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false)
  s.lineTo(x, y + r)
  s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false)
  return s
}

const easeOutCubic = (x: number) => 1 - Math.pow(1 - x, 3)
const easeOutBack = (x: number) => {
  const c1 = 1.5
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2)
}

const IMAGE_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`

const IMAGE_FRAG = /* glsl */ `
uniform sampler2D uMap;
uniform float uTime;
uniform float uReveal;
uniform float uHas;
uniform float uAspect;
varying vec2 vUv;

float rr(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

void main() {
  vec2 p = vUv - 0.5;
  if (rr(p, vec2(0.5), 0.045) > 0.0) discard;

  float t = uTime;
  float bands = 0.5 + 0.5 * sin(vUv.y * 18.0 + vUv.x * 6.0 - t * 3.0);
  float grid = step(0.96, fract(vUv.x * 24.0)) + step(0.96, fract(vUv.y * 24.0));
  vec3 shimmer = mix(vec3(0.004, 0.008, 0.03), vec3(0.01, 0.09, 0.2), bands * 0.6);
  shimmer += vec3(0.5, 0.16, 0.02) * grid * 0.1;
  shimmer += vec3(0.05, 0.3, 0.55) * pow(bands, 6.0) * 0.5;

  vec2 uv = vUv;
  if (uAspect > 1.0) uv.y = (uv.y - 0.5) * uAspect + 0.5;
  else uv.x = (uv.x - 0.5) / uAspect + 0.5;
  vec4 tex = texture2D(uMap, uv);
  float inside = step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);
  vec3 img = mix(vec3(0.004, 0.006, 0.014), tex.rgb, inside);

  float y = 1.0 - vUv.y;
  float revealed = uHas * step(y, uReveal);
  float edge = uHas * smoothstep(0.04, 0.0, abs(y - uReveal)) * step(uReveal, 0.999) * step(0.001, uReveal);
  vec3 col = mix(shimmer, img, revealed);
  col += vec3(0.25, 0.75, 1.0) * edge * 1.6;
  col *= 0.965 + 0.035 * sin(vUv.y * 800.0 + t * 4.0);

  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`

const BEAM_FRAG = /* glsl */ `
uniform float uTime;
uniform float uOpacity;
varying vec2 vUv;
void main() {
  float along = vUv.y;
  float a = (0.25 + 0.75 * along) * 0.42 * uOpacity;
  a *= 0.65 + 0.35 * sin(along * 28.0 - uTime * 5.0);
  vec3 c = mix(vec3(1.0, 0.45, 0.12), vec3(0.22, 0.74, 0.97), along);
  gl_FragColor = vec4(c, a);
  #include <colorspace_fragment>
}`

function glowTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')!
  const grd = g.createRadialGradient(64, 64, 4, 64, 64, 64)
  grd.addColorStop(0, 'rgba(255,255,255,0.9)')
  grd.addColorStop(0.35, 'rgba(255,255,255,0.28)')
  grd.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grd
  g.fillRect(0, 0, 128, 128)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/** Pantalla holográfica que el robot proyecta a su costado. */
export class HoloScreen {
  readonly group = new THREE.Group()
  readonly beam: THREE.Mesh
  private readonly imageMat: THREE.ShaderMaterial
  private readonly beamMat: THREE.ShaderMaterial
  private readonly glowMat: THREE.MeshBasicMaterial
  private readonly rimMat: THREE.MeshBasicMaterial
  private readonly disposables: { dispose(): void }[] = []
  private readonly dummy = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1)
  private texture: THREE.Texture | null = null
  private url: string | null = null
  private generating = false
  private appear = 0
  private reveal = 0
  private loadToken = 0

  private readonly scene: THREE.Scene

  constructor(scene: THREE.Scene) {
    this.scene = scene
    this.dummy.needsUpdate = true
    this.disposables.push(this.dummy)

    const slabGeo = new THREE.ExtrudeGeometry(roundedRect(SIZE + 0.2, SIZE + 0.2, 0.12), {
      depth: 0.05,
      bevelEnabled: false
    })
    slabGeo.translate(0, 0, -0.05)
    const slab = new THREE.Mesh(
      slabGeo,
      new THREE.MeshStandardMaterial({ color: 0x090c18, metalness: 0.7, roughness: 0.28 })
    )

    const rimShape = roundedRect(SIZE + 0.13, SIZE + 0.13, 0.095)
    rimShape.holes.push(roundedRect(SIZE + 0.05, SIZE + 0.05, 0.06))
    const rimGeo = new THREE.ShapeGeometry(rimShape, 24)
    this.rimMat = new THREE.MeshBasicMaterial({ color: 0xff7a2e, toneMapped: false })
    const rim = new THREE.Mesh(rimGeo, this.rimMat)
    rim.position.z = 0.004

    this.imageMat = new THREE.ShaderMaterial({
      uniforms: {
        uMap: { value: this.dummy },
        uTime: { value: 0 },
        uReveal: { value: 0 },
        uHas: { value: 0 },
        uAspect: { value: 1 }
      },
      vertexShader: IMAGE_VERT,
      fragmentShader: IMAGE_FRAG,
      transparent: false
    })
    const image = new THREE.Mesh(new THREE.PlaneGeometry(SIZE, SIZE), this.imageMat)
    image.position.z = 0.012

    const glowTex = glowTexture()
    this.disposables.push(glowTex)
    this.glowMat = new THREE.MeshBasicMaterial({
      map: glowTex,
      color: 0xff7a2e,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false
    })
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(SIZE * 2.4, SIZE * 2.4), this.glowMat)
    glow.position.z = -0.12

    this.group.add(glow, slab, rim, image)
    this.group.visible = false
    scene.add(this.group)

    const beamGeo = new THREE.CylinderGeometry(0.85, 0.02, 1, 48, 1, true)
    beamGeo.translate(0, 0.5, 0)
    this.beamMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uOpacity: { value: 0 } },
      vertexShader: IMAGE_VERT,
      fragmentShader: BEAM_FRAG,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    })
    this.beam = new THREE.Mesh(beamGeo, this.beamMat)
    this.beam.visible = false
    this.beam.frustumCulled = false
    scene.add(this.beam)

    this.disposables.push(slabGeo, slab.material as THREE.Material, rimGeo, this.rimMat, this.imageMat, image.geometry, this.glowMat, glow.geometry, beamGeo, this.beamMat)
  }

  get active(): boolean {
    return this.generating || this.url !== null
  }

  set(url: string | null, generating: boolean) {
    this.generating = generating
    if (url === this.url) return
    this.url = url
    const token = ++this.loadToken
    this.imageMat.uniforms.uHas.value = 0
    this.reveal = 0
    if (!url) {
      this.texture?.dispose()
      this.texture = null
      return
    }
    new THREE.TextureLoader().load(url, (tex) => {
      if (token !== this.loadToken) {
        tex.dispose()
        return
      }
      tex.colorSpace = THREE.SRGBColorSpace
      tex.anisotropy = 4
      this.texture?.dispose()
      this.texture = tex
      const img = tex.image as { width: number; height: number }
      this.imageMat.uniforms.uMap.value = tex
      this.imageMat.uniforms.uAspect.value = img.width / Math.max(1, img.height)
      this.imageMat.uniforms.uHas.value = 1
      this.reveal = 0
    })
  }

  update(dt: number, t: number, hand: THREE.Vector3, tint: THREE.Color) {
    const on = this.active
    this.appear = THREE.MathUtils.clamp(this.appear + (on ? 1 : -1.4) * (dt / 0.9), 0, 1)
    const a = this.appear
    this.group.visible = a > 0.002
    this.beam.visible = a > 0.05

    if (this.imageMat.uniforms.uHas.value > 0) this.reveal = Math.min(1, this.reveal + dt / 1.6)
    this.imageMat.uniforms.uReveal.value = this.reveal
    this.imageMat.uniforms.uTime.value = t
    this.beamMat.uniforms.uTime.value = t
    this.glowMat.color.copy(tint)
    this.rimMat.color.copy(tint)

    if (!this.group.visible) return
    const e = easeOutBack(a)
    const p = easeOutCubic(a)
    this.group.position.lerpVectors(hand, FINAL_POS, p)
    this.group.position.y += Math.sin(t * 1.3) * 0.035 * p
    this.group.rotation.y = FINAL_ROT_Y * p + Math.sin(t * 0.8) * 0.03
    this.group.scale.setScalar(Math.max(0.001, e))

    const dir = new THREE.Vector3().subVectors(this.group.position, hand)
    const len = dir.length()
    this.beam.position.copy(hand)
    this.beam.scale.set(0.5 + 0.5 * a, Math.max(0.001, len), 0.5 + 0.5 * a)
    this.beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize())
    this.beamMat.uniforms.uOpacity.value = a * (this.reveal >= 1 ? 0.3 : 1)
  }

  dispose() {
    this.scene.remove(this.group, this.beam)
    this.texture?.dispose()
    this.disposables.forEach((d) => d.dispose())
  }
}

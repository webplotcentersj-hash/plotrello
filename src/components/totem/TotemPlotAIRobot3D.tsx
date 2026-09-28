import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import type { TotemRobotState } from './TotemPlotAIRobot'
import { HoloScreen } from './totemHoloScreen'

type Props = {
  state: TotemRobotState
  screenUrl: string | null
  screenGenerating: boolean
  onReady: () => void
  onFail: () => void
}

const MODEL_URL = `${import.meta.env.BASE_URL}models/plotai-robot.glb`

const CLIP_FOR_STATE: Record<TotemRobotState, string> = {
  idle: 'idle',
  greeting: 'greeting',
  listening: 'listening',
  thinking: 'thinking',
  speaking: 'speaking'
}

const EYE_COLOR: Record<TotemRobotState, THREE.Color> = {
  idle: new THREE.Color('#38bdf8'),
  greeting: new THREE.Color('#38bdf8'),
  listening: new THREE.Color('#5fd0ff'),
  thinking: new THREE.Color('#f0a050'),
  speaking: new THREE.Color('#38bdf8')
}

const EYE_GLOW: Record<TotemRobotState, number> = {
  idle: 1.8,
  greeting: 4,
  listening: 3.4,
  thinking: 3,
  speaking: 3.6
}

const ACCENT_GLOW: Record<TotemRobotState, number> = {
  idle: 1.6,
  greeting: 3.2,
  listening: 2.6,
  thinking: 3,
  speaking: 3
}

/** Robot PlotAI modelado y animado en Blender (public/models/plotai-robot.glb). */
export default function TotemPlotAIRobot3D({ state, screenUrl, screenGenerating, onReady, onFail }: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const stateRef = useRef<TotemRobotState>(state)
  const playRef = useRef<((s: TotemRobotState) => void) | null>(null)
  const screenRef = useRef({ url: screenUrl, generating: screenGenerating })
  const holoRef = useRef<HoloScreen | null>(null)
  const cbRef = useRef({ onReady, onFail })
  cbRef.current = { onReady, onFail }
  stateRef.current = state

  useEffect(() => {
    playRef.current?.(state)
  }, [state])

  useEffect(() => {
    screenRef.current = { url: screenUrl, generating: screenGenerating }
    holoRef.current?.set(screenUrl, screenGenerating)
    playRef.current?.(stateRef.current)
  }, [screenUrl, screenGenerating])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let disposed = false
    let raf = 0

    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' })
    } catch {
      cbRef.current.onFail()
      return
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.05
    renderer.setClearColor(0x000000, 0)
    renderer.domElement.className = 'totem-robot3d__canvas'
    host.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const pmrem = new THREE.PMREMGenerator(renderer)
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    scene.environment = envTex
    scene.environmentIntensity = 0.55

    const key = new THREE.DirectionalLight(0xfff1e0, 2.2)
    key.position.set(3, 4, 5)
    const rim = new THREE.DirectionalLight(0x38bdf8, 2.4)
    rim.position.set(-4, 2.5, -3)
    const warm = new THREE.PointLight(0xeb671b, 14, 9)
    warm.position.set(2.6, -0.4, 2.4)
    scene.add(key, rim, warm)

    const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 50)
    camera.position.set(0, 0.55, 6.3)
    camera.lookAt(0, 0.42, 0)

    const pivot = new THREE.Group()
    scene.add(pivot)

    const mixer = new THREE.AnimationMixer(pivot)
    const actions = new Map<string, THREE.AnimationAction>()
    let current: THREE.AnimationAction | null = null
    let mouth: { node: THREE.Object3D; baseY: number; posY: number }[] = []
    const face = new Map<string, { node: THREE.Object3D; pos: THREE.Vector3; scale: THREE.Vector3 }>()
    const blushMats: THREE.MeshStandardMaterial[] = []
    const ex = { raiseL: 0, raiseR: 0, innerL: 0.1, innerR: 0.1, lidL: 0, lidR: 0, cheek: 0.35, smile: 1 }
    let handNode: THREE.Object3D | null = null
    const holo = new HoloScreen(scene)
    holoRef.current = holo
    holo.set(screenRef.current.url, screenRef.current.generating)
    const handPos = new THREE.Vector3()
    const tint = new THREE.Color()
    const ORANGE = new THREE.Color('#ff7a2e')
    let layout = 0
    const eyeMats: THREE.MeshStandardMaterial[] = []
    const accentMats: THREE.MeshStandardMaterial[] = []
    const eyeColor = new THREE.Color(EYE_COLOR[stateRef.current])
    let eyeGlow = EYE_GLOW[stateRef.current]
    let accentGlow = ACCENT_GLOW[stateRef.current]
    let ready = false

    const wantsScreen = () => screenRef.current.url !== null || screenRef.current.generating
    const clipFor = (s: TotemRobotState) => (s !== 'greeting' && wantsScreen() ? 'presenting' : CLIP_FOR_STATE[s])

    const play = (s: TotemRobotState) => {
      const next = actions.get(clipFor(s))
      if (!next || next === current) return
      next.reset()
      next.enabled = true
      if (s === 'greeting') {
        next.setLoop(THREE.LoopOnce, 1)
        next.clampWhenFinished = false
      } else {
        next.setLoop(THREE.LoopRepeat, Infinity)
      }
      next.fadeIn(0.45).play()
      current?.fadeOut(0.45)
      current = next
    }
    playRef.current = play

    mixer.addEventListener('finished', () => {
      if (stateRef.current === 'greeting') {
        const idle = actions.get(wantsScreen() ? 'presenting' : 'idle')
        if (!idle) return
        idle.reset().fadeIn(0.5).play()
        current?.fadeOut(0.5)
        current = idle
      }
    })

    new GLTFLoader().load(
      MODEL_URL,
      (gltf) => {
        if (disposed) return
        pivot.add(gltf.scene)
        gltf.scene.traverse((o) => {
          const mesh = o as THREE.Mesh
          if (mesh.isMesh) {
            const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
            mats.forEach((m) => {
              const sm = m as THREE.MeshStandardMaterial
              if (sm.name === 'Emit_Eye' && !eyeMats.includes(sm)) eyeMats.push(sm)
              if (sm.name === 'Emit_Accent' && !accentMats.includes(sm)) accentMats.push(sm)
              if (sm.name === 'Emit_Blush' && !blushMats.includes(sm)) blushMats.push(sm)
            })
          }
          if (/^Mouth\d$/.test(o.name)) mouth.push({ node: o, baseY: o.scale.y, posY: o.position.y })
          if (/^(Brow|Cheek|Lid)[LR]$/.test(o.name)) {
            face.set(o.name, { node: o, pos: o.position.clone(), scale: o.scale.clone() })
          }
          if (o.name === 'HandL') handNode = o
        })
        mouth = mouth.sort((a, b) => a.node.name.localeCompare(b.node.name))
        gltf.animations.forEach((clip) => actions.set(clip.name, mixer.clipAction(clip)))
        play(stateRef.current)
        ready = true
        cbRef.current.onReady()
      },
      undefined,
      () => {
        if (!disposed) cbRef.current.onFail()
      }
    )

    const resize = () => {
      const w = host.clientWidth || 1
      const h = host.clientHeight || 1
      renderer.setSize(w, h, false)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(host)

    const pointer = { x: 0, y: 0 }
    const onMove = (e: PointerEvent) => {
      pointer.x = (e.clientX / window.innerWidth) * 2 - 1
      pointer.y = (e.clientY / window.innerHeight) * 2 - 1
    }
    window.addEventListener('pointermove', onMove, { passive: true })

    const clock = new THREE.Clock()
    const tick = () => {
      raf = requestAnimationFrame(tick)
      const dt = Math.min(clock.getDelta(), 0.05)
      const t = clock.elapsedTime
      const s = stateRef.current

      mixer.update(dt)

      // con pantalla activa el robot se corre a la izquierda y la cámara se abre para que entren los dos
      layout += ((holo.active ? 1 : 0) - layout) * Math.min(1, dt * 2.6)
      const lay = layout * layout * (3 - 2 * layout)
      pivot.position.x = -1.2 * lay
      const halfTan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))
      const fitZ = Math.max(6.3, 2.75 / (halfTan * camera.aspect))
      camera.position.z = THREE.MathUtils.lerp(6.3, fitZ, lay)
      camera.position.x = 0.2 * lay
      camera.lookAt(0.2 * lay, 0.42, 0)

      // el cuerpo gira levemente hacia donde toca o mira la persona
      pivot.rotation.y += (pointer.x * 0.32 - pivot.rotation.y) * Math.min(1, dt * 3)
      pivot.rotation.x += (pointer.y * 0.06 - pivot.rotation.x) * Math.min(1, dt * 3)

      if (ready) {
        const k = Math.min(1, dt * 5)
        eyeColor.lerp(EYE_COLOR[s], k)
        eyeGlow += (EYE_GLOW[s] - eyeGlow) * k
        accentGlow += (ACCENT_GLOW[s] - accentGlow) * k
        const speechEnv = s === 'speaking' ? 0.55 + 0.45 * Math.sin(t * 9.1) * Math.sin(t * 5.3 + 1) : 0
        const think = s === 'thinking' ? 0.5 + 0.5 * Math.sin(t * 5) : 0
        eyeMats.forEach((m) => {
          m.emissive.copy(eyeColor)
          m.color.copy(eyeColor)
          m.emissiveIntensity = eyeGlow * (1 + think * 0.25)
        })
        accentMats.forEach((m) => {
          m.emissiveIntensity = accentGlow * (1 + Math.abs(speechEnv) * 0.6)
        })

        // —— expresiones: cejas, párpados de alegría, mejillas y sonrisa ——
        const screenOn = holo.active
        const T = { raiseL: 0.01, raiseR: 0.01, innerL: 0.1, innerR: 0.1, lidL: 0, lidR: 0, cheek: 0.35, smile: 1 }
        if (s === 'greeting') Object.assign(T, { raiseL: 0.03, raiseR: 0.03, innerL: 0.18, innerR: 0.18, lidL: 0.85, lidR: 0.85, cheek: 1, smile: 1.5 })
        else if (s === 'listening') Object.assign(T, { raiseL: 0.05, raiseR: 0.05, innerL: 0.16, innerR: 0.16, cheek: 0.45, smile: 0.8 })
        else if (s === 'thinking') Object.assign(T, { raiseL: 0.06, raiseR: -0.005, innerL: 0.22, innerR: -0.1, cheek: 0.1, smile: 0.05 })
        else if (s === 'speaking') {
          const bounce = Math.abs(speechEnv)
          Object.assign(T, { raiseL: 0.02 + 0.02 * bounce, raiseR: 0.02 + 0.02 * bounce, lidL: 0.12 + 0.22 * bounce, lidR: 0.12 + 0.22 * bounce, cheek: 0.65, smile: 1.1 })
        }
        if (screenOn && s !== 'thinking') {
          T.lidL = Math.max(T.lidL, 0.5)
          T.lidR = Math.max(T.lidR, 0.5)
          T.cheek = Math.max(T.cheek, 0.85)
          T.smile = Math.max(T.smile, 1.3)
        }
        if (s !== 'thinking' && s !== 'greeting') {
          const squint = (t + 3) % 10
          if (squint < 0.9) {
            const kq = Math.sin((squint / 0.9) * Math.PI)
            T.lidL = Math.max(T.lidL, 0.7 * kq)
            T.lidR = Math.max(T.lidR, 0.7 * kq)
          }
          const wink = (t + 7) % 13
          if (wink < 0.55) {
            const kw = Math.sin((wink / 0.55) * Math.PI)
            T.lidR = Math.max(T.lidR, kw)
            T.raiseR += 0.02 * kw
            T.cheek = Math.max(T.cheek, 0.9)
          }
        }
        const ke = Math.min(1, dt * 8)
        ex.raiseL += (T.raiseL - ex.raiseL) * ke
        ex.raiseR += (T.raiseR - ex.raiseR) * ke
        ex.innerL += (T.innerL - ex.innerL) * ke
        ex.innerR += (T.innerR - ex.innerR) * ke
        ex.lidL += (T.lidL - ex.lidL) * ke
        ex.lidR += (T.lidR - ex.lidR) * ke
        ex.cheek += (T.cheek - ex.cheek) * ke
        ex.smile += (T.smile - ex.smile) * ke

        const setBrow = (name: 'BrowL' | 'BrowR', raise: number, inner: number, sgn: number) => {
          const f = face.get(name)
          if (!f) return
          f.node.position.y = f.pos.y + raise
          f.node.rotation.z = -sgn * inner
        }
        setBrow('BrowL', ex.raiseL, ex.innerL, 1)
        setBrow('BrowR', ex.raiseR, ex.innerR, -1)
        const setLid = (name: 'LidL' | 'LidR', lid: number) => {
          const f = face.get(name)
          if (!f) return
          f.node.position.y = f.pos.y + lid * 0.13
          f.node.position.z = f.pos.z - (1 - Math.min(1, lid * 3)) * 0.07
        }
        setLid('LidL', ex.lidL)
        setLid('LidR', ex.lidR)
        ;(['CheekL', 'CheekR'] as const).forEach((n) => {
          const f = face.get(n)
          if (f) f.node.scale.copy(f.scale).multiplyScalar(0.85 + 0.3 * ex.cheek)
        })
        blushMats.forEach((m) => {
          m.emissiveIntensity = 0.25 + 2.2 * ex.cheek + Math.sin(t * 2) * 0.12
        })
        const mid = mouth.length ? mouth[Math.floor(mouth.length / 2)].posY : 0

        mouth.forEach((m, i) => {
          m.node.position.y = mid + (m.posY - mid) * ex.smile + (s === 'thinking' ? Math.sin(t * 3 + i * 1.3) * 0.008 : 0)
          let h = 1.45
          if (s === 'speaking') {
            h = 1.2 + Math.abs(Math.sin(t * (8 + i * 1.7) + i * 1.3)) * 5.2 * (0.55 + 0.45 * Math.abs(speechEnv))
          } else if (s === 'listening') {
            h = 1.3 + Math.abs(Math.sin(t * 2.6 + i * 0.9)) * 1.3
          } else if (s === 'thinking') {
            h = i % 2 === 0 ? 1 + Math.max(0, Math.sin(t * 5 - i * 0.9)) * 2.2 : 0.8
          } else if (s === 'greeting') {
            h = 1.6 + Math.sin(t * 6 + i) * 0.5
          }
          m.node.scale.y += (m.baseY * h - m.node.scale.y) * Math.min(1, dt * 14)
        })
      }
      if (handNode) {
        handNode.updateWorldMatrix(true, false)
        handNode.getWorldPosition(handPos)
      }
      tint.copy(ORANGE).lerp(eyeColor, s === 'thinking' ? 0.85 : 0.3)
      holo.update(dt, t, handPos, tint)
      renderer.render(scene, camera)
    }
    tick()

    return () => {
      disposed = true
      playRef.current = null
      holoRef.current = null
      holo.dispose()
      cancelAnimationFrame(raf)
      ro.disconnect()
      window.removeEventListener('pointermove', onMove)
      mixer.stopAllAction()
      scene.traverse((o) => {
        const mesh = o as THREE.Mesh
        if (mesh.isMesh) {
          mesh.geometry.dispose()
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
          mats.forEach((m) => m.dispose())
        }
      })
      envTex.dispose()
      pmrem.dispose()
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [])

  return <div ref={hostRef} className="totem-robot3d__host" aria-hidden />
}

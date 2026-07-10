const UNLOCK_KEY = 'reloj_tablet_unlocked'
const DISPOSITIVO_KEY = 'reloj_tablet_dispositivo_id'
const DEFAULT_PIN = '7531'
const DEFAULT_DISPOSITIVO = 'tablet-reloj-1'

export function isKioskUnlocked(): boolean {
  if (typeof sessionStorage === 'undefined') return false
  return sessionStorage.getItem(UNLOCK_KEY) === '1'
}

export function unlockKiosk(pin: string): boolean {
  if (pin.trim() !== DEFAULT_PIN) return false
  try {
    sessionStorage.setItem(UNLOCK_KEY, '1')
  } catch {
    /* modo privado / storage bloqueado — igual desbloqueamos la sesión en memoria */
  }
  return true
}

export function lockKiosk(): void {
  try {
    sessionStorage.removeItem(UNLOCK_KEY)
  } catch {
    /* ignore */
  }
}

export function getDispositivoId(): string {
  if (typeof localStorage === 'undefined') return DEFAULT_DISPOSITIVO
  return localStorage.getItem(DISPOSITIVO_KEY)?.trim() || DEFAULT_DISPOSITIVO
}

export function setDispositivoId(id: string): void {
  const v = id.trim() || DEFAULT_DISPOSITIVO
  localStorage.setItem(DISPOSITIVO_KEY, v)
}

export async function requestScreenWakeLock(): Promise<WakeLockSentinel | null> {
  try {
    if (!('wakeLock' in navigator)) return null
    return await navigator.wakeLock.request('screen')
  } catch {
    return null
  }
}

export async function toggleFullscreen(el: HTMLElement | null): Promise<void> {
  if (!el) return
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen()
    } else {
      await el.requestFullscreen()
    }
  } catch {
    /* ignore */
  }
}

function beep(freq: number, durationMs: number, volume = 0.15) {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    gain.gain.value = volume
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    window.setTimeout(() => {
      osc.stop()
      void ctx.close()
    }, durationMs)
  } catch {
    /* ignore */
  }
}

export function playMarcacionSound(kind: 'ok' | 'error') {
  if (kind === 'ok') {
    beep(880, 120)
    window.setTimeout(() => beep(1175, 160), 130)
  } else {
    beep(220, 280, 0.2)
  }
}

export function estadoMarcacionHoy(emp: {
  entrada_hoy?: string | null
  salida_hoy?: string | null
}): { label: string; tone: 'none' | 'entrada' | 'completo' } {
  if (emp.salida_hoy) return { label: `Salida ${emp.salida_hoy}`, tone: 'completo' }
  if (emp.entrada_hoy) return { label: `Entrada ${emp.entrada_hoy}`, tone: 'entrada' }
  return { label: 'Sin marcar hoy', tone: 'none' }
}

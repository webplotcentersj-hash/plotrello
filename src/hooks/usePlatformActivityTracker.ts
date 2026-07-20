import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import apiService from '../services/api'
import { plotLabFetch } from '../utils/plotLabApiOrigin'

const STORAGE_KEY = 'plotlab_activity_client_session'
const HEARTBEAT_MS = 60_000

function getOrCreateClientSessionId(): string {
  try {
    const existing = sessionStorage.getItem(STORAGE_KEY)
    if (existing) return existing
    const id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `s-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
    sessionStorage.setItem(STORAGE_KEY, id)
    return id
  } catch {
    return `s-${Date.now()}`
  }
}

function collectDeviceInfo(): Record<string, unknown> {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return {}
  const nav = navigator as Navigator & {
    connection?: { effectiveType?: string; downlink?: number; rtt?: number; saveData?: boolean }
    deviceMemory?: number
  }
  const conn = nav.connection
  return {
    userAgent: nav.userAgent,
    platform: nav.platform,
    language: nav.language,
    languages: Array.from(nav.languages || []),
    cookieEnabled: nav.cookieEnabled,
    hardwareConcurrency: nav.hardwareConcurrency ?? null,
    maxTouchPoints: nav.maxTouchPoints ?? 0,
    deviceMemory: nav.deviceMemory ?? null,
    vendor: nav.vendor || null,
    online: nav.onLine,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    timezoneOffsetMin: new Date().getTimezoneOffset(),
    screenWidth: window.screen?.width ?? null,
    screenHeight: window.screen?.height ?? null,
    availWidth: window.screen?.availWidth ?? null,
    availHeight: window.screen?.availHeight ?? null,
    colorDepth: window.screen?.colorDepth ?? null,
    pixelRatio: window.devicePixelRatio ?? 1,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    outerWidth: window.outerWidth,
    outerHeight: window.outerHeight,
    touch: 'ontouchstart' in window || (nav.maxTouchPoints ?? 0) > 0,
    connection: conn
      ? {
          effectiveType: conn.effectiveType ?? null,
          downlink: conn.downlink ?? null,
          rtt: conn.rtt ?? null,
          saveData: conn.saveData ?? null
        }
      : null,
    localTime: new Date().toISOString()
  }
}

async function enrichSessionWithServerIp(
  clientSessionId: string,
  entryPath: string,
  deviceInfo: Record<string, unknown>
) {
  try {
    const token = localStorage.getItem('auth_token')
    if (!token) return
    await plotLabFetch('/api/auth/platform-activity', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        action: 'start',
        clientSessionId,
        entryPath,
        deviceInfo
      })
    })
  } catch {
    /* IP opcional; el RPC del cliente ya abrió la sesión */
  }
}

/**
 * Registra apertura de Plot Lab, heartbeat y cada ruta visitada.
 * Una pestaña del navegador = una sesión (sessionStorage).
 */
export function usePlatformActivityTracker(usuarioId: number | null | undefined) {
  const location = useLocation()
  const clientSessionRef = useRef<string>(getOrCreateClientSessionId())
  const lastPathRef = useRef<string | null>(null)
  const sessionReadyRef = useRef(false)

  useEffect(() => {
    if (usuarioId == null || usuarioId <= 0) return

    const clientSessionId = getOrCreateClientSessionId()
    clientSessionRef.current = clientSessionId
    sessionReadyRef.current = false
    const path = `${location.pathname}${location.search}`
    const device = collectDeviceInfo()
    let cancelled = false

    const boot = async () => {
      await apiService.abrirSesionPlataforma({
        usuarioId,
        clientSessionId,
        entryPath: path,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
        deviceInfo: device
      })
      if (cancelled) return
      void enrichSessionWithServerIp(clientSessionId, path, device)
      sessionReadyRef.current = true
      lastPathRef.current = path
      await apiService.registrarVistaPlataforma({
        usuarioId,
        clientSessionId,
        path,
        title: typeof document !== 'undefined' ? document.title : null,
        referrerPath: null,
        visibility: typeof document !== 'undefined' ? document.visibilityState : null,
        viewportW: typeof window !== 'undefined' ? window.innerWidth : null,
        viewportH: typeof window !== 'undefined' ? window.innerHeight : null,
        meta: { event: 'session_open' }
      })
    }

    void boot()

    const heartbeat = window.setInterval(() => {
      if (document.visibilityState === 'hidden') return
      void apiService.pingSesionPlataforma(usuarioId, clientSessionId)
    }, HEARTBEAT_MS)

    const onVis = () => {
      if (document.visibilityState === 'visible') {
        void apiService.pingSesionPlataforma(usuarioId, clientSessionId)
      }
    }
    document.addEventListener('visibilitychange', onVis)

    const onUnload = () => {
      void apiService.cerrarSesionPlataforma(usuarioId, clientSessionId)
    }
    window.addEventListener('pagehide', onUnload)

    return () => {
      cancelled = true
      window.clearInterval(heartbeat)
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('pagehide', onUnload)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- boot solo por usuario
  }, [usuarioId])

  useEffect(() => {
    if (usuarioId == null || usuarioId <= 0) return
    if (!sessionReadyRef.current) return

    const path = `${location.pathname}${location.search}`
    if (lastPathRef.current === path) return

    const referrer = lastPathRef.current
    lastPathRef.current = path
    const clientSessionId = clientSessionRef.current

    void apiService.registrarVistaPlataforma({
      usuarioId,
      clientSessionId,
      path,
      title: typeof document !== 'undefined' ? document.title : null,
      referrerPath: referrer,
      visibility: typeof document !== 'undefined' ? document.visibilityState : null,
      viewportW: typeof window !== 'undefined' ? window.innerWidth : null,
      viewportH: typeof window !== 'undefined' ? window.innerHeight : null,
      meta: { event: 'navigation' }
    })
  }, [usuarioId, location.pathname, location.search])
}

import { supabase } from '../services/supabaseClient'
import type { UsuarioRecord } from '../types/api'
import { fallbackNombreSinEmail, nombreCompletoLegajo } from './usuarioDisplayName'

type RegistryMaps = {
  byId: Map<number, string>
  byLogin: Map<string, string>
}

const maps: RegistryMaps = {
  byId: new Map(),
  byLogin: new Map()
}

let loadPromise: Promise<void> | null = null
let loaded = false

export function isLegajoDisplayRegistryLoaded(): boolean {
  return loaded
}

export function registerUsuarioLegajoDisplay(
  id: number,
  loginNombre: string,
  legajoNombre: string
): void {
  const display = legajoNombre.trim()
  if (!display) return
  if (Number.isFinite(id) && id > 0) maps.byId.set(id, display)
  const login = loginNombre.trim().toLowerCase()
  if (login) maps.byLogin.set(login, display)
  if (login.includes('@')) {
    const prefix = login.split('@')[0]!
    if (prefix) maps.byLogin.set(prefix, display)
  }
}

export function registerUsuariosLegajoDisplay(usuarios: UsuarioRecord[]): void {
  for (const u of usuarios) {
    const visible = (u as UsuarioRecord & { nombre_visible?: string }).nombre_visible?.trim()
    if (visible) registerUsuarioLegajoDisplay(u.id, u.nombre, visible)
  }
}

/** Nombre visible para cualquier texto guardado (email, login, nombre legajo) o id de usuario. */
export function resolveDisplayNombre(
  raw?: string | null,
  id?: number | null
): string {
  if (id != null && Number.isFinite(id) && id > 0) {
    const byId = maps.byId.get(id)
    if (byId) return byId
  }
  const s = String(raw ?? '').trim()
  if (!s) return 'Usuario'
  const lower = s.toLowerCase()
  const exact = maps.byLogin.get(lower)
  if (exact) return exact
  if (s.includes('@')) {
    const prefix = lower.split('@')[0]!
    const byPrefix = maps.byLogin.get(prefix)
    if (byPrefix) return byPrefix
  }
  if (/^\d+$/.test(s)) {
    const byId = maps.byId.get(Number(s))
    if (byId) return byId
  }
  return fallbackNombreSinEmail(s)
}

/** Etiqueta para operario_asignado (id, email o nombre). */
export function resolveOperarioAsignadoLabel(
  value?: string | null,
  teamMembers?: Array<{ id: string; name: string }>
): string {
  const raw = (value ?? '').trim()
  if (!raw || raw === 'sin-asignar') return 'Sin asignar'
  if (/^\d+$/.test(raw)) {
    const id = Number(raw)
    const fromRegistry = maps.byId.get(id)
    if (fromRegistry) return fromRegistry
    const member = teamMembers?.find((m) => m.id === raw || m.id === `user-${raw}`)
    if (member?.name?.trim()) return member.name.trim()
  }
  return resolveDisplayNombre(raw)
}

export async function loadLegajoDisplayRegistry(): Promise<void> {
  if (loaded) return
  if (loadPromise) return loadPromise
  loadPromise = (async () => {
    if (!supabase) {
      loaded = true
      return
    }
    try {
      const [legajosRes, usuariosRes] = await Promise.all([
        supabase.from('legajos_empleados').select('id_usuario, nombre, apellido'),
        supabase.rpc('listar_usuarios')
      ])
      const legajoPorId = new Map<number, string>()
      for (const row of legajosRes.data ?? []) {
        const uid = Number(row.id_usuario)
        const full = nombreCompletoLegajo(row)
        if (uid > 0 && full) legajoPorId.set(uid, full)
      }
      const usuarios = (usuariosRes.data ?? []) as UsuarioRecord[]
      for (const u of usuarios) {
        const legajo = legajoPorId.get(u.id)
        if (legajo) registerUsuarioLegajoDisplay(u.id, u.nombre, legajo)
      }
      // Solo personal activo: no registrar legajos de bajas.
    } catch {
      /* registry opcional; fallback en resolveDisplayNombre */
    } finally {
      loaded = true
    }
  })()
  return loadPromise
}

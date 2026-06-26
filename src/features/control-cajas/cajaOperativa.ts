import { esUsuarioCajaOperativa } from '../../utils/ventasCajaScope'
import { cajaSlugForUsuario, esCajaSlugUsuario } from './cajaPorUsuario'
import { ensureCajaOperativaUsuario, listCajas, listArqueos } from './cajaRepository'
import { fetchNombreDisplayUsuario, usuarioCajaActivo } from './cajaUsuarioDb'
import type { CajaRegistro } from './types'
export type CajaOperativa = {
  slug: string
  nombre: string
  registro: CajaRegistro
}

export { cajaSlugForUsuario as slugCajaOperativa, esCajaSlugUsuario }

/** Slug determinístico; no requiere red. */
export function resolveCajaOperativaSlug(usuarioId: number): string {
  return cajaSlugForUsuario(usuarioId)
}

export { fetchNombreDisplayUsuario, usuarioCajaActivo } from './cajaUsuarioDb'

/**
 * Crea/actualiza la caja del usuario y devuelve slug + registro.
 * Fuente única para mostrador/caja.
 */
export async function obtenerCajaOperativa(
  usuarioId: number,
  usuarioNombreFallback: string
): Promise<CajaOperativa> {
  const activo = await usuarioCajaActivo(usuarioId)
  if (!activo) {
    throw new Error('Tu usuario está inactivo. Contactá a administración.')
  }

  const nombreDb = await fetchNombreDisplayUsuario(usuarioId)
  const nombreDisplay = nombreDb ?? usuarioNombreFallback
  const registro = await ensureCajaOperativaUsuario(usuarioId, nombreDisplay)
  return {
    slug: registro.slug,
    nombre: registro.nombre,
    registro
  }
}

/** Llamar al iniciar sesión (mostrador/caja). No lanza si falla la red. */
export async function prepararCajaOperativaEnLogin(
  usuarioId: number,
  usuarioNombre: string,
  rol: string
): Promise<void> {
  if (!esUsuarioCajaOperativa(rol)) return
  try {
    await obtenerCajaOperativa(usuarioId, usuarioNombre)
  } catch (e) {
    console.warn('No se pudo preparar caja operativa al login:', e)
  }
}

/** Admin: cajas auto de mostradores (slug u-* o id_usuario). */
export async function listCajasOperativasUsuarios(): Promise<CajaRegistro[]> {
  const todas = await listCajas()
  return todas.filter((c) => esCajaSlugUsuario(c.slug) || c.id_usuario != null)
}

export async function ultimoArqueoCajaOperativa(
  cajaSlug: string
): Promise<{ fecha: string; total: number } | null> {
  const arqueos = await listArqueos()
  const hit = arqueos.find((a) => a.caja_slug === cajaSlug)
  if (!hit) return null
  return { fecha: hit.fecha, total: hit.total }
}

/** Resolver caja para import PDF: operativa usa siempre su u-{id}. */
export async function resolverCajaSlugImport(
  opts: {
    usuarioId?: number
    usuarioNombre: string
    cajaNombrePdf?: string | null
    cajas: CajaRegistro[]
    esAdmin?: boolean
  }
): Promise<string | null> {
  const { usuarioId, usuarioNombre, cajaNombrePdf, cajas, esAdmin } = opts

  if (usuarioId != null && !esAdmin) {
    const op = await obtenerCajaOperativa(usuarioId, usuarioNombre)
    return op.slug
  }

  if (cajaNombrePdf?.trim()) {
    const n = cajaNombrePdf.trim().toLowerCase()
    const byNombre = cajas.find(
      (c) =>
        c.nombre.toLowerCase() === n ||
        c.slug === n ||
        c.nombre.toLowerCase().includes(n)
    )
    if (byNombre) return byNombre.slug
  }

  if (usuarioId != null) {
    const op = await obtenerCajaOperativa(usuarioId, usuarioNombre)
    return op.slug
  }

  const operativas = cajas.filter((c) => c.slug !== 'admin' && c.slug !== 'vuelto')
  return operativas[0]?.slug ?? null
}

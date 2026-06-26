import { nombreVisibleUsuario } from '../../utils/usuarioDisplayName'

/** Nombre legible del operador (legajo, no email). */
export function resolveUsuarioCajaEtiqueta(
  usuarioNombre: string,
  nombreVisible?: string | null
): string {
  return nombreVisibleUsuario({ nombre: usuarioNombre, nombreVisible: nombreVisible ?? undefined })
}

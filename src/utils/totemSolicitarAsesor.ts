import apiService from '../services/api'
import { TOTEM_SOLICITUD_ASESOR_MARKER } from '../constants/totemSolicitudAsesor'

export type SolicitarAsesorTotemOpts = {
  clienteNombre?: string
  productoNombre?: string
  contexto?: string
}

/** Avisa a mostrador + broadcast a tablet /asesor (misma lógica que consulta tótem). */
export async function solicitarAsesorTotem(
  opts: SolicitarAsesorTotemOpts = {}
): Promise<{ ok: boolean; mensaje: string }> {
  const nombre = opts.clienteNombre?.trim() || 'Cliente tótem catálogo'
  const detalle = opts.productoNombre
    ? `Producto: ${opts.productoNombre}. ${opts.contexto || ''}`.trim()
    : opts.contexto || ''
  const notas = [detalle, `Sector sugerido: Asesor.`, TOTEM_SOLICITUD_ASESOR_MARKER]
    .filter(Boolean)
    .join(' ')

  try {
    const res = await apiService.crearAtencionMostrador({
      cliente_nombre: nombre,
      tipo: 'consulta',
      usuario_id: 1,
      usuario_nombre: 'Totem autoservicio',
      notas,
      sector_destino: 'Asesor'
    })
    if (!res.success) {
      return { ok: false, mensaje: res.error || 'No se pudo avisar a un asesor.' }
    }

    const broadcastRes = await apiService.broadcastTotemSolicitudAsesor({
      atencionId: res.data,
      clienteNombre: nombre,
      sectorDestino: 'Catálogo tótem',
      notas
    })

    if (!broadcastRes.success) {
      return {
        ok: true,
        mensaje: '📞 Registramos tu solicitud. Un asesor te va a atender en breve.'
      }
    }
    return {
      ok: true,
      mensaje: '📞 Avisamos a un asesor. En breve te atienden en mostrador.'
    }
  } catch {
    return { ok: false, mensaje: 'No se pudo avisar a un asesor. Acercate a mostrador.' }
  }
}

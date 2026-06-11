import { getArgentinaDateString } from '../../utils/dateUtils'
import { planillaEnFecha } from './cajaDashboardData'
import {
  getParams,
  listArqueos,
  listCajas,
  listEgresoSolicitudes,
  listPlanillas,
  listTransferenciaLotes,
  listTraspasos,
  resolveCajaSlugForUsuario,
  resolveCajaSlugFromHistorial
} from './cajaRepository'
import { DEFAULT_CAJERAS } from './constants'
import type { CajaSectionId } from './types'

export type EstadoPasoCaja = 'hecho' | 'pendiente' | 'opcional' | 'alerta'

export type CajaEstadoOperativaHoy = {
  fecha: string
  cajaSlug: string | null
  cajaNombre: string | null
  planillaImportada: boolean
  arqueoHecho: boolean
  cierreTurnoHecho: boolean
  egresosPendientes: number
  traspasosPendientes: number
}

export async function loadEstadoOperativaHoy(
  usuarioId: number,
  usuarioNombre: string,
  fecha = getArgentinaDateString()
): Promise<CajaEstadoOperativaHoy> {
  const [cajas, params, planillas, arqueos, lotes, egresos, traspasos] = await Promise.all([
    listCajas(),
    getParams(),
    listPlanillas(80),
    listArqueos({ usuarioId }),
    listTransferenciaLotes(50),
    listEgresoSolicitudes(),
    listTraspasos({ estado: 'pendiente' })
  ])

  const operativas = cajas.filter((c) => c.slug !== 'admin' && c.slug !== 'vuelto')
  const cajeras = params.cajeras?.length ? params.cajeras : DEFAULT_CAJERAS
  let cajaSlug =
    resolveCajaSlugForUsuario(usuarioNombre, operativas, cajeras, { usuarioId }) ?? null
  if (!cajaSlug) {
    cajaSlug = (await resolveCajaSlugFromHistorial(usuarioId, operativas)) ?? null
  }
  const cajaNombre = cajaSlug ? (cajas.find((c) => c.slug === cajaSlug)?.nombre ?? cajaSlug) : null

  const planillaImportada = planillas.some(
    (p) =>
      planillaEnFecha(p, fecha) &&
      (p.caja_slug === cajaSlug || p.id_usuario === usuarioId)
  )

  const arqueoHecho =
    cajaSlug != null && arqueos.some((a) => a.fecha === fecha && a.caja_slug === cajaSlug)

  const cierreTurnoHecho = lotes.some(
    (l) =>
      l.fecha === fecha && (l.id_usuario === usuarioId || l.origen_slug === cajaSlug)
  )

  const egresosPendientes = egresos.filter(
    (e) =>
      e.fecha === fecha &&
      e.estado === 'pendiente' &&
      (e.caja_slug === cajaSlug || e.solicitante_id === usuarioId)
  ).length

  const traspasosPendientes = traspasos.filter(
    (t) =>
      t.fecha === fecha &&
      (t.caja_origen_slug === cajaSlug ||
        t.caja_destino_slug === cajaSlug ||
        t.id_usuario === usuarioId)
  ).length

  return {
    fecha,
    cajaSlug,
    cajaNombre,
    planillaImportada,
    arqueoHecho,
    cierreTurnoHecho,
    egresosPendientes,
    traspasosPendientes
  }
}

export function estadoPasoMenu(
  section: CajaSectionId,
  estado: CajaEstadoOperativaHoy
): { tipo: EstadoPasoCaja; detalle?: string } {
  switch (section) {
    case 'arqueo':
      if (estado.arqueoHecho) return { tipo: 'hecho', detalle: 'Arqueo guardado hoy' }
      if (estado.planillaImportada) return { tipo: 'pendiente', detalle: 'Planilla lista — contá billetes' }
      return { tipo: 'pendiente', detalle: 'Subí planilla PDF y contá' }
    case 'cierre_turno':
      if (estado.cierreTurnoHecho) return { tipo: 'hecho', detalle: 'Cierre de turno registrado' }
      if (estado.arqueoHecho) return { tipo: 'pendiente', detalle: 'Podés cerrar el turno' }
      return { tipo: 'pendiente', detalle: 'Completá el arqueo primero' }
    case 'egresos':
      if (estado.egresosPendientes > 0) {
        return { tipo: 'alerta', detalle: `${estado.egresosPendientes} egreso(s) pendiente(s)` }
      }
      return { tipo: 'opcional', detalle: 'Sin egresos pendientes hoy' }
    case 'traspasos':
      if (estado.traspasosPendientes > 0) {
        return { tipo: 'alerta', detalle: `${estado.traspasosPendientes} traspaso(s) por confirmar` }
      }
      return { tipo: 'opcional' }
    default:
      return { tipo: 'opcional' }
  }
}

import { getArgentinaDateString } from '../../utils/dateUtils'
import { calcularTotalesCoherentesDia, contarPlanillasDelDia, type TotalesCajaDia } from './cajaCoherencia'
import {
  getParams,
  listArqueos,
  listCajas,
  listEgresoSolicitudes,
  listMovimientos,
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
  planillasDelDia: number
  arqueoHecho: boolean
  cierreTurnoHecho: boolean
  egresosPendientes: number
  traspasosPendientes: number
  totalesDia: TotalesCajaDia | null
}

export async function loadEstadoOperativaHoy(
  usuarioId: number,
  usuarioNombre: string,
  fecha = getArgentinaDateString()
): Promise<CajaEstadoOperativaHoy> {
  const [cajas, params, planillas, arqueos, lotes, egresos, traspasos, movimientos] = await Promise.all([
    listCajas(),
    getParams(),
    listPlanillas(80),
    listArqueos({ usuarioId }),
    listTransferenciaLotes(50),
    listEgresoSolicitudes(),
    listTraspasos({ estado: 'pendiente' }),
    listMovimientos({ usuarioId })
  ])

  const operativas = cajas.filter((c) => c.slug !== 'admin' && c.slug !== 'vuelto')
  const cajeras = params.cajeras?.length ? params.cajeras : DEFAULT_CAJERAS
  let cajaSlug =
    resolveCajaSlugForUsuario(usuarioNombre, operativas, cajeras, { usuarioId }) ?? null
  if (!cajaSlug) {
    cajaSlug = (await resolveCajaSlugFromHistorial(usuarioId, operativas)) ?? null
  }
  const cajaNombre = cajaSlug ? (cajas.find((c) => c.slug === cajaSlug)?.nombre ?? cajaSlug) : null

  const planillasDelDia = contarPlanillasDelDia(planillas, fecha, cajaSlug, usuarioId)
  const planillaImportada = planillasDelDia > 0

  const totalesDia =
    cajaSlug != null
      ? {
          ...calcularTotalesCoherentesDia(movimientos, fecha, cajaSlug),
          planillas_del_dia: planillasDelDia
        }
      : null

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
    planillasDelDia,
    arqueoHecho,
    cierreTurnoHecho,
    egresosPendientes,
    traspasosPendientes,
    totalesDia
  }
}

export function estadoPasoMenu(
  section: CajaSectionId,
  estado: CajaEstadoOperativaHoy
): { tipo: EstadoPasoCaja; detalle?: string } {
  switch (section) {
    case 'arqueo':
      if (estado.arqueoHecho) return { tipo: 'hecho', detalle: 'Arqueo guardado hoy' }
      if (estado.planillasDelDia > 0) {
        return {
          tipo: 'pendiente',
          detalle:
            estado.planillasDelDia === 1
              ? '1 planilla importada — contá billetes'
              : `${estado.planillasDelDia} planillas — contá billetes`
        }
      }
      return { tipo: 'pendiente', detalle: 'Subí PDF de cierre o usá lectura inteligente arriba' }
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

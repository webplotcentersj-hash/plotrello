import { getArgentinaDateString } from '../../utils/dateUtils'
import { calcularTotalesCoherentesDia, contarPlanillasDelDia, type TotalesCajaDia } from './cajaCoherencia'
import { obtenerCajaOperativa } from './cajaOperativa'
import {
  efectivoTeoricoDia,
  inferirTurnoActivo,
  ultimosMovimientosDia
} from './cajaMenuOperativaData'
import {
  listArqueos,
  listCajas,
  listEgresoSolicitudes,
  listMovimientos,
  listPlanillas,
  listTransferenciaLotes,
  listTraspasos,
  resolveCajaSlugForUsuario
} from './cajaRepository'
import type { CajaMovimiento, CajaSectionId } from './types'
import type { ResumenPlotlabVentasCaja } from './plotlabVentasCajaData'
import { resumenPlotlabVentasCaja } from './plotlabVentasCajaData'
import {
  combinarResumenPlotlab,
  resumenPlotlabVentasDesdeApi
} from './plotlabVentaCajaSync'

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
  resumenPlotlab: ResumenPlotlabVentasCaja | null
  ultimosMovimientos: CajaMovimiento[]
  efectivoTeorico: number | null
  turnoActivo: string
}

export async function loadEstadoOperativaHoy(
  usuarioId: number,
  usuarioNombre: string,
  fecha = getArgentinaDateString()
): Promise<CajaEstadoOperativaHoy> {
  const [cajas, planillas, arqueos, lotes, egresos, traspasos, movimientos] = await Promise.all([
    (async () => {
      await obtenerCajaOperativa(usuarioId, usuarioNombre)
      return listCajas()
    })(),
    listPlanillas(80),
    listArqueos({ usuarioId }),
    listTransferenciaLotes(50),
    listEgresoSolicitudes(),
    listTraspasos({ estado: 'pendiente' }),
    listMovimientos({ usuarioId })
  ])

  const operativas = cajas.filter((c) => c.slug !== 'admin' && c.slug !== 'vuelto')
  const cajaSlug = resolveCajaSlugForUsuario(usuarioNombre, operativas, { usuarioId }) ?? null
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

  let resumenPlotlab =
    cajaSlug != null ? resumenPlotlabVentasCaja(movimientos, fecha, cajaSlug) : null
  if (cajaSlug != null) {
    try {
      const desdeApi = await resumenPlotlabVentasDesdeApi(fecha, cajaSlug, usuarioId)
      resumenPlotlab = combinarResumenPlotlab(
        desdeApi,
        resumenPlotlab ?? { count: 0, efectivo: 0, tarjetas: 0, transferencia: 0, ctaCte: 0, otros: 0, total: 0 }
      )
    } catch {
      /* mantener resumen desde movimientos */
    }
  }

  const cajaRegistro = cajaSlug ? cajas.find((c) => c.slug === cajaSlug) ?? null : null
  const ultimosMovimientos =
    cajaSlug != null ? ultimosMovimientosDia(movimientos, fecha, cajaSlug, 8) : []
  const efectivoTeorico =
    cajaRegistro != null
      ? efectivoTeoricoDia(movimientos, fecha, cajaRegistro, resumenPlotlab)
      : null
  const turnoActivo = inferirTurnoActivo(fecha, cajaSlug, arqueos)

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
    totalesDia,
    resumenPlotlab,
    ultimosMovimientos,
    efectivoTeorico,
    turnoActivo
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
      return { tipo: 'pendiente', detalle: 'Contá billetes en Mi arqueo' }
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

import type { CajaSectionId } from './types'
import type { PlanillaCajaParsed } from './parsePlanillaCajaPdf'
import {
  clasificarPlanillaPorContenido,
  TIPO_PLANILLA_LABEL,
  type TipoPlanillaDetectado
} from './cajaCoherencia'

export type DestinoPlanillaResuelto = {
  section: CajaSectionId
  tipo: TipoPlanillaDetectado
  titulo: string
  explicacion: string
}

export function resolverDestinoPlanilla(
  planilla: PlanillaCajaParsed,
  estado?: { arqueoHecho?: boolean; cierreTurnoHecho?: boolean }
): DestinoPlanillaResuelto {
  const tipo = clasificarPlanillaPorContenido(planilla)
  const label = TIPO_PLANILLA_LABEL[tipo]

  if (tipo === 'pase') {
    return {
      section: 'cierre_turno',
      tipo,
      titulo: label,
      explicacion:
        'El pase de efectivo se hace en Cierre de turno (fondo a la otra caja + resto a administración).'
    }
  }

  if (tipo === 'traspaso') {
    return {
      section: 'traspasos',
      tipo,
      titulo: label,
      explicacion: 'Solo movimientos MEC entre cajas. Confirmá los traspasos pendientes.'
    }
  }

  if (tipo === 'egresos') {
    return {
      section: 'egresos',
      tipo,
      titulo: label,
      explicacion: 'Planilla con egresos del día. Revisá solicitudes y aprobaciones en Egresos.'
    }
  }

  const arqueoHecho = estado?.arqueoHecho ?? false
  const cierreHecho = estado?.cierreTurnoHecho ?? false

  if (!arqueoHecho) {
    return {
      section: 'arqueo',
      tipo,
      titulo: label,
      explicacion:
        tipo === 'cierre' || tipo === 'mixto'
          ? 'Cierre con ventas/egresos: importado. Contá billetes contra el efectivo de la planilla.'
          : 'Movimientos importados. Completá el arqueo con el efectivo que indica el PDF.'
    }
  }

  if (!cierreHecho) {
    return {
      section: 'cierre_turno',
      tipo,
      titulo: label,
      explicacion: 'Arqueo listo. Usá esta planilla para el cierre de turno (fondo + pase a administración).'
    }
  }

  if (tipo === 'mixto' || tipo === 'cierre') {
    return {
      section: 'arqueo',
      tipo,
      titulo: `${label} (adicional)`,
      explicacion: 'Planilla extra del día registrada sin duplicar comprobantes. Podés revisar totales en arqueo.'
    }
  }

  return {
    section: 'historial',
    tipo,
    titulo: label,
    explicacion: 'Datos volcados al sistema. Consultá movimientos en Historial.'
  }
}

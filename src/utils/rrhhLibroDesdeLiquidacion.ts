import {
  CCT_LIQUIDACION_DEFAULT,
  CONFIG_LIQUIDACION_VERSION,
  normalizarCargas,
  normalizarMontos
} from './liquidacionMensual'
import {
  normalizarParametrosLegales,
  normalizarSnapshotLibro,
  type EmpleadoLegal,
  type LegalLibro,
  type SnapshotLibroEmpleado
} from './rrhhCargasLegales'

export type DatosLibroDesdeLiquidacion = {
  legal: LegalLibro
  /** Por id de usuario: lo que liquidó la Liquidación mensual (mes completo). */
  snapshots: Record<string, SnapshotLibroEmpleado>
  /** Última vez que la liquidación actualizó los datos del libro. */
  generado: string | null
}

/**
 * Lee el config_json de la liquidación del período y arma lo que necesita el Libro de sueldos:
 * las mismas cargas, parámetros legales (tope, FAL, ART, detracción, RIFL) y, por empleado,
 * la remuneración declarada y sus datos legales. Null si el período no tiene liquidación.
 */
export function datosLibroDesdeLiquidacion(
  cfg: Record<string, unknown> | null | undefined,
  periodo: string
): DatosLibroDesdeLiquidacion | null {
  if (!cfg || typeof cfg !== 'object') return null
  if (!Array.isArray(cfg.cargas) && !(cfg.montos && typeof cfg.montos === 'object')) return null
  const cct =
    typeof cfg.cctCodigo === 'string' && cfg.cctCodigo.trim() ? cfg.cctCodigo.trim() : CCT_LIQUIDACION_DEFAULT
  const v2 = Number(cfg.version) >= CONFIG_LIQUIDACION_VERSION
  const cargas = normalizarCargas(cfg.cargas, cct, v2 && Array.isArray(cfg.cargas))

  const empleados: Record<string, EmpleadoLegal> = {}
  const montos = cfg.montos && typeof cfg.montos === 'object' ? (cfg.montos as Record<string, unknown>) : {}
  for (const [id, raw] of Object.entries(montos)) {
    const m = normalizarMontos(raw)
    empleados[id] = {
      enConvenio: m.fueraConvenio !== true,
      jornadaParcial: m.jornadaParcial === true,
      sueldoJornadaCompleta: m.sueldoJornadaCompleta ?? 0,
      rifl: m.rifl === true
    }
  }

  const snapshots: Record<string, SnapshotLibroEmpleado> = {}
  let generado: string | null = null
  const libro = cfg.libro && typeof cfg.libro === 'object' ? (cfg.libro as Record<string, unknown>) : {}
  for (const [id, raw] of Object.entries(libro)) {
    const s = normalizarSnapshotLibro(raw)
    if (!s) continue
    snapshots[id] = s
    // El snapshot trae el dato legal ya resuelto (jornada parcial del legajo, jornada completa
    // estimada); la liquidación lo regraba cada vez que cambia.
    empleados[id] = s.legal
    if (s.generado && (!generado || s.generado > generado)) generado = s.generado
  }

  return {
    legal: {
      version: 1,
      origen: 'liquidacion',
      parametros: normalizarParametrosLegales(cfg.legal, periodo),
      cargas,
      empleados
    },
    snapshots,
    generado
  }
}

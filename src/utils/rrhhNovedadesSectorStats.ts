import type { RrhhNovedad, UsuarioRecord } from '../types/api'
import {
  calcularEvolucionHistoricaNovedades,
  indiceAusentismoPct,
  type PuntoEvolucionNovedad
} from './rrhhNovedadesLegajoStats'
import {
  clasificarNovedadLegajo,
  diasNovedadEnMes,
  esDisciplinaria,
  novedadEnMes
} from './rrhhNovedadClasificacionLegajo'

const ROL_A_SECTOR: Record<string, string> = {
  administracion: 'Administración',
  gerencia: 'Gerencia',
  'recursos-humanos': 'Recursos Humanos',
  diseno: 'Diseño',
  imprenta: 'Imprenta',
  'taller-grafico': 'Taller Gráfico',
  instalaciones: 'Instalaciones',
  metalurgica: 'Metalúrgica',
  caja: 'Caja',
  mostrador: 'Mostrador',
  compras: 'Compras',
  'asesor-tecnico': 'Asesor técnico',
  presupuestos: 'Presupuestos'
}

export type LegajoSectorBasico = {
  sector: string
}

export type SectorAusentismoRow = {
  sector: string
  headcount: number
  diasAusenciaMes: number
  indiceAusentismo: number
  tardanzasMes: number
  disciplinariasMes: number
}

export type BenchmarkSectorColaborador = {
  sector: string
  indiceSectorMes: number
  indiceEmpresaMes: number
  diasAusenciaColaboradorMes: number
  promedioDiasSectorMes: number
}

export type IndicadoresNovedadesOrganizacion = {
  evolucionMensual: PuntoEvolucionNovedad[]
  porSector: SectorAusentismoRow[]
  indiceEmpresaMes: number
  sectorMasAusentismo: string | null
  totalNovedadesMes: number
  tardanzasMes: number
  disciplinariasMes: number
}

export function sectorDeColaborador(
  idUsuario: number,
  legajos: Record<number, LegajoSectorBasico>,
  rol?: string | null
): string {
  const leg = legajos[idUsuario]
  if (leg?.sector?.trim()) return leg.sector.trim()
  if (rol && ROL_A_SECTOR[rol]) return ROL_A_SECTOR[rol]
  return 'Sin sector'
}

function headcountPorSector(
  usuarios: UsuarioRecord[],
  legajos: Record<number, LegajoSectorBasico>
): Map<string, number> {
  const map = new Map<string, number>()
  for (const u of usuarios) {
    const s = sectorDeColaborador(u.id, legajos, u.rol)
    map.set(s, (map.get(s) ?? 0) + 1)
  }
  return map
}

function diasAusenciaMes(n: RrhhNovedad, ref: Date): number {
  const clas = clasificarNovedadLegajo(n)
  if (clas !== 'ausencia_injustificada' && clas !== 'licencia_medica') return 0
  return diasNovedadEnMes(n, ref)
}

export function calcularAusentismoPorSector(
  novedades: RrhhNovedad[],
  legajos: Record<number, LegajoSectorBasico>,
  usuarios: UsuarioRecord[],
  ref: Date = new Date()
): SectorAusentismoRow[] {
  const headcounts = headcountPorSector(usuarios, legajos)
  const diasPorSector = new Map<string, number>()
  const tardanzasPorSector = new Map<string, number>()
  const disciplinariasPorSector = new Map<string, number>()

  for (const n of novedades) {
    if (!novedadEnMes(n, ref)) continue
    const sector = sectorDeColaborador(n.id_usuario, legajos)
    const dias = diasAusenciaMes(n, ref)
    if (dias > 0) {
      diasPorSector.set(sector, (diasPorSector.get(sector) ?? 0) + dias)
    }
    if (clasificarNovedadLegajo(n) === 'llegada_tarde') {
      tardanzasPorSector.set(sector, (tardanzasPorSector.get(sector) ?? 0) + 1)
    }
    if (esDisciplinaria(n)) {
      disciplinariasPorSector.set(sector, (disciplinariasPorSector.get(sector) ?? 0) + 1)
    }
  }

  const sectores = new Set([...headcounts.keys(), ...diasPorSector.keys()])
  const rows: SectorAusentismoRow[] = []

  for (const sector of sectores) {
    const headcount = headcounts.get(sector) ?? 0
    const diasAusenciaMes = diasPorSector.get(sector) ?? 0
    rows.push({
      sector,
      headcount,
      diasAusenciaMes,
      indiceAusentismo: indiceAusentismoPct(diasAusenciaMes, headcount),
      tardanzasMes: tardanzasPorSector.get(sector) ?? 0,
      disciplinariasMes: disciplinariasPorSector.get(sector) ?? 0
    })
  }

  return rows.sort((a, b) => b.indiceAusentismo - a.indiceAusentismo)
}

export function calcularBenchmarkSectorColaborador(
  novedades: RrhhNovedad[],
  idUsuario: number,
  legajos: Record<number, LegajoSectorBasico>,
  usuarios: UsuarioRecord[],
  ref: Date = new Date()
): BenchmarkSectorColaborador | null {
  const sector = sectorDeColaborador(
    idUsuario,
    legajos,
    usuarios.find((u) => u.id === idUsuario)?.rol
  )
  if (!sector || sector === 'Sin sector') return null

  const porSector = calcularAusentismoPorSector(novedades, legajos, usuarios, ref)
  const rowSector = porSector.find((r) => r.sector === sector)
  if (!rowSector) return null

  const diasColaborador = novedades
    .filter((n) => n.id_usuario === idUsuario && novedadEnMes(n, ref))
    .reduce((acc, n) => acc + diasAusenciaMes(n, ref), 0)

  const totalDias = porSector.reduce((s, r) => s + r.diasAusenciaMes, 0)
  const totalHead = porSector.reduce((s, r) => s + r.headcount, 0)
  const indiceEmpresa = indiceAusentismoPct(totalDias, totalHead)

  return {
    sector,
    indiceSectorMes: rowSector.indiceAusentismo,
    indiceEmpresaMes: indiceEmpresa,
    diasAusenciaColaboradorMes: diasColaborador,
    promedioDiasSectorMes:
      rowSector.headcount > 0
        ? Math.round((rowSector.diasAusenciaMes / rowSector.headcount) * 10) / 10
        : 0
  }
}

export function calcularIndicadoresNovedadesOrganizacion(
  novedades: RrhhNovedad[],
  legajos: Record<number, LegajoSectorBasico>,
  usuarios: UsuarioRecord[],
  ref: Date = new Date()
): IndicadoresNovedadesOrganizacion {
  const porSector = calcularAusentismoPorSector(novedades, legajos, usuarios, ref)
  const evolucionMensual = calcularEvolucionHistoricaNovedades(novedades, 12, ref)

  const totalDias = porSector.reduce((s, r) => s + r.diasAusenciaMes, 0)
  const totalHead = porSector.reduce((s, r) => s + r.headcount, 0)
  const indiceEmpresaMes = indiceAusentismoPct(totalDias, totalHead)

  const sectorMasAusentismo =
    porSector.length > 0 && porSector[0].indiceAusentismo > 0 ? porSector[0].sector : null

  let totalNovedadesMes = 0
  let tardanzasMes = 0
  let disciplinariasMes = 0
  for (const n of novedades) {
    if (!novedadEnMes(n, ref)) continue
    totalNovedadesMes++
    if (clasificarNovedadLegajo(n) === 'llegada_tarde') tardanzasMes++
    if (esDisciplinaria(n)) disciplinariasMes++
  }

  return {
    evolucionMensual,
    porSector,
    indiceEmpresaMes,
    sectorMasAusentismo,
    totalNovedadesMes,
    tardanzasMes,
    disciplinariasMes
  }
}

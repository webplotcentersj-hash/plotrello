/**
 * Revisión antes de liquidar: busca en asistencia, novedades, permisos, horarios y legajos
 * lo que haría que la liquidación salga mal (faltas que en realidad no lo son, días mal
 * contados, datos que el Libro de sueldos necesita). No modifica nada.
 */
import type { Asistencia, RrhhNovedad, SolicitudPermiso } from '../types/api'
import { horarioEsperadoDesdeCtx, type HorarioEsperadoCtx, type HorarioFijoAsistencia } from './asistenciaStats'
import { pesoDiaLaborable } from './diasLaborables'
import { nombreFeriado } from './feriadosArgentina'
import { novedadEnDia } from './rrhhNovedadDates'
import { novedadEmpleadoIncorrecto } from './rrhhNovedadEmpleadoObs'

export type NivelHallazgo = 'error' | 'aviso'

export type CategoriaHallazgo =
  | 'sin_marca'
  | 'sin_salida'
  | 'sin_entrada'
  | 'jornada_larga'
  | 'permiso_pendiente'
  | 'sin_horario'
  | 'sin_cuil'
  | 'sin_ingreso'
  | 'novedad_cruzada'
  | 'marca_no_laborable'

export const CATEGORIA_INFO: Record<CategoriaHallazgo, { titulo: string; porQue: string; ir: string; textoIr: string }> = {
  sin_marca: {
    titulo: 'Días sin marca ni justificación',
    porQue: 'Se liquidan como faltas injustificadas y se descuentan. Si vino, faltó la marca; si avisó, falta cargar la novedad o el permiso.',
    ir: '/rrhh/horarios',
    textoIr: 'Ir a asistencia'
  },
  permiso_pendiente: {
    titulo: 'Permisos sin aprobar o rechazar',
    porQue: 'Un permiso aprobado justifica el día; mientras esté pendiente, esos días cuentan como falta.',
    ir: '/rrhh/permisos',
    textoIr: 'Ir a permisos'
  },
  sin_horario: {
    titulo: 'Empleados sin horario cargado',
    porQue: 'Sin horario no se sabe si trabaja sábados ni su jornada: los días a trabajar y las horas extra salen mal.',
    ir: '/rrhh/horarios',
    textoIr: 'Cargar horario'
  },
  sin_cuil: {
    titulo: 'Legajos sin CUIL válido',
    porQue: 'El Libro de sueldos digital (LSD) rechaza empleados sin CUIL de 11 dígitos.',
    ir: '/rrhh/usuarios',
    textoIr: 'Ir a legajos'
  },
  novedad_cruzada: {
    titulo: 'Novedades que parecen de otro empleado',
    porQue: 'Las observaciones nombran a otra persona: la falta, licencia o tardanza puede estar cargada al empleado equivocado.',
    ir: '/rrhh/novedades',
    textoIr: 'Ir a novedades'
  },
  sin_salida: {
    titulo: 'Marcas con entrada y sin salida',
    porQue: 'Las horas de ese día no se pueden calcular (ni las horas extra).',
    ir: '/rrhh/horarios',
    textoIr: 'Ir a asistencia'
  },
  sin_entrada: {
    titulo: 'Marcas con salida y sin entrada',
    porQue: 'Puede ser una marca de entrada perdida: el día podría figurar como tardanza o sin horas.',
    ir: '/rrhh/horarios',
    textoIr: 'Ir a asistencia'
  },
  jornada_larga: {
    titulo: 'Jornadas de más de 14 horas',
    porQue: 'Casi siempre es una salida olvidada que se marcó al día siguiente: infla las horas extra.',
    ir: '/rrhh/horarios',
    textoIr: 'Ir a asistencia'
  },
  sin_ingreso: {
    titulo: 'Legajos sin fecha de ingreso',
    porQue: 'Sin fecha de ingreso no se calcula la antigüedad ni el proporcional de quien entró en el mes.',
    ir: '/rrhh/usuarios',
    textoIr: 'Ir a legajos'
  },
  marca_no_laborable: {
    titulo: 'Trabajó en domingo, feriado o sábado que no le toca',
    porQue: 'Se pagan como horas al 100%. Confirmá que estaba autorizado.',
    ir: '/rrhh/horarios',
    textoIr: 'Ir a asistencia'
  }
}

/** Orden de aparición: primero lo que cambia la plata. */
export const ORDEN_CATEGORIAS: CategoriaHallazgo[] = [
  'sin_marca',
  'permiso_pendiente',
  'sin_horario',
  'novedad_cruzada',
  'sin_cuil',
  'sin_salida',
  'sin_entrada',
  'jornada_larga',
  'sin_ingreso',
  'marca_no_laborable'
]

export type Hallazgo = {
  categoria: CategoriaHallazgo
  nivel: NivelHallazgo
  idUsuario: number
  nombre: string
  detalle: string
  fechas: string[]
}

export type EmpleadoRevision = {
  id: number
  nombre: string
  cuil: string | null
  fechaIngreso: string | null
}

const NIVEL: Record<CategoriaHallazgo, NivelHallazgo> = {
  sin_marca: 'error',
  permiso_pendiente: 'error',
  sin_horario: 'error',
  novedad_cruzada: 'error',
  sin_cuil: 'error',
  sin_salida: 'aviso',
  sin_entrada: 'aviso',
  jornada_larga: 'aviso',
  sin_ingreso: 'aviso',
  marca_no_laborable: 'aviso'
}

const ddmm = (f: string) => `${f.slice(8, 10)}/${f.slice(5, 7)}`
export const listaFechas = (fechas: string[], max = 8) =>
  fechas.slice(0, max).map(ddmm).join(', ') + (fechas.length > max ? ` y ${fechas.length - max} más` : '')

function permisoCubre(p: SolicitudPermiso, fecha: string): boolean {
  const ini = (p.fecha_inicio || p.fecha_solicitud || '').slice(0, 10)
  const fin = (p.fecha_fin || p.fecha_inicio || p.fecha_solicitud || '').slice(0, 10) || ini
  return !!ini && fecha >= ini && fecha <= fin
}

function horasDe(a: Asistencia): number | null {
  if (a.horas_trabajadas != null && a.horas_trabajadas > 0) return a.horas_trabajadas
  if (!a.hora_entrada || !a.hora_salida) return null
  const ms = new Date(a.hora_salida).getTime() - new Date(a.hora_entrada).getTime()
  return Number.isFinite(ms) && ms > 0 ? ms / 3_600_000 : null
}

const dow = (f: string) => {
  const [y, m, d] = f.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

export function revisarLiquidacion(params: {
  dias: string[]
  hoy: string
  empleados: EmpleadoRevision[]
  asistencia: Asistencia[]
  novedades: RrhhNovedad[]
  permisos: SolicitudPermiso[]
  horarios: Record<number, HorarioFijoAsistencia>
  horarioEsperadoCtx?: HorarioEsperadoCtx | null
}): Hallazgo[] {
  const { dias, hoy, empleados, asistencia, novedades, permisos, horarios, horarioEsperadoCtx } = params
  const out: Hallazgo[] = []
  const nombres = new Map(empleados.map((e) => [e.id, e.nombre]))
  const agregar = (categoria: CategoriaHallazgo, e: EmpleadoRevision, detalle: string, fechas: string[] = []) =>
    out.push({ categoria, nivel: NIVEL[categoria], idUsuario: e.id, nombre: e.nombre, detalle, fechas })

  const marcas = new Map<string, Asistencia>()
  for (const a of asistencia) marcas.set(`${a.id_usuario}|${a.fecha.slice(0, 10)}`, a)
  const ids = new Set(empleados.map((e) => e.id))

  for (const e of empleados) {
    const horario = horarios[e.id] ?? null
    const ingreso = e.fechaIngreso?.slice(0, 10) || null
    const novsEmp = novedades.filter((n) => n.id_usuario === e.id)
    const permEmp = permisos.filter((p) => p.id_usuario === e.id)
    const aprobados = permEmp.filter((p) => p.estado === 'aprobado' && p.tipo_solicitud !== 'turno' && p.tipo_solicitud !== 'ropa')

    // Legajo
    const cuil = String(e.cuil || '').replace(/\D/g, '')
    if (cuil.length !== 11) agregar('sin_cuil', e, e.cuil ? `CUIL cargado: ${e.cuil}` : 'No tiene CUIL cargado.')
    if (!ingreso) agregar('sin_ingreso', e, 'No tiene fecha de ingreso.')
    if (!horario) agregar('sin_horario', e, 'No tiene horario del reloj para este mes.')

    // Permisos pendientes que tocan el período
    for (const p of permEmp) {
      if (p.estado !== 'pendiente') continue
      const enPeriodo = dias.filter((f) => permisoCubre(p, f))
      if (!enPeriodo.length) continue
      agregar('permiso_pendiente', e, `"${p.titulo}" (${p.tipo_solicitud}) del ${listaFechas([enPeriodo[0]])}${enPeriodo.length > 1 ? ` al ${ddmm(enPeriodo[enPeriodo.length - 1])}` : ''}.`, enPeriodo)
    }

    // Novedades que nombran a otro empleado
    for (const n of novsEmp) {
      const otros = novedadEmpleadoIncorrecto(n, nombres)
      if (otros.length) {
        agregar('novedad_cruzada', e, `Novedad del ${ddmm(n.fecha_desde.slice(0, 10))} menciona a ${otros.map((o) => o.nombre).join(', ')}.`, [n.fecha_desde.slice(0, 10)])
      }
    }

    const sinMarca: string[] = []
    const sinSalida: string[] = []
    const sinEntrada: string[] = []
    const largas: string[] = []
    const noLaborable: string[] = []
    for (const f of dias) {
      if (ingreso && f < ingreso) continue
      const a = marcas.get(`${e.id}|${f}`)
      const esperado = horarioEsperadoDesdeCtx(e.id, f, horario, horarioEsperadoCtx)
      const laborable = pesoDiaLaborable(f, horario?.trabajaSabado ?? false) > 0 && esperado?.esFranco !== true
      const tieneNovedad = novsEmp.some((n) => novedadEnDia(n, f))
      const cubiertoPermiso = aprobados.some((p) => permisoCubre(p, f))

      if (a) {
        if (a.hora_entrada && !a.hora_salida && f < hoy) sinSalida.push(f)
        if (!a.hora_entrada && a.hora_salida) sinEntrada.push(f)
        const h = horasDe(a)
        if (h != null && h > 14) largas.push(f)
        const vino = !!a.hora_entrada && a.tipo_registro !== 'ausente' && a.tipo_registro !== 'justificado'
        if (vino && !laborable && (dow(f) === 0 || nombreFeriado(f) || dow(f) === 6) && !tieneNovedad) noLaborable.push(f)
        continue
      }
      // Los días de un permiso pendiente ya se avisan en "permisos sin aprobar".
      const cubiertoPendiente = permEmp.some((p) => p.estado === 'pendiente' && permisoCubre(p, f))
      if (!laborable || f >= hoy || tieneNovedad || cubiertoPermiso || cubiertoPendiente) continue
      sinMarca.push(f)
    }
    if (sinMarca.length) agregar('sin_marca', e, `${sinMarca.length} día${sinMarca.length > 1 ? 's' : ''}: ${listaFechas(sinMarca)}.`, sinMarca)
    if (sinSalida.length) agregar('sin_salida', e, listaFechas(sinSalida), sinSalida)
    if (sinEntrada.length) agregar('sin_entrada', e, listaFechas(sinEntrada), sinEntrada)
    if (largas.length) agregar('jornada_larga', e, listaFechas(largas), largas)
    if (noLaborable.length) agregar('marca_no_laborable', e, listaFechas(noLaborable), noLaborable)
  }

  // Permisos pendientes de gente fuera del listado (por si el legajo está inactivo) se ignoran.
  return out.filter((h) => ids.has(h.idUsuario))
}

export function resumenHallazgos(h: Hallazgo[]) {
  return {
    errores: h.filter((x) => x.nivel === 'error').length,
    avisos: h.filter((x) => x.nivel === 'aviso').length,
    empleadosConErrores: new Set(h.filter((x) => x.nivel === 'error').map((x) => x.idUsuario)).size
  }
}

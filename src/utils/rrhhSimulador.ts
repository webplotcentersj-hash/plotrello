/**
 * Simulador de aumentos e ingresos sobre la nómina declarada del Libro de sueldos.
 * Usa el mismo motor de cargas que el recibo (topes, convenio, jornada parcial).
 *
 * Base comparable: básico + antigüedad + conceptos fijos cargados a mano. Se dejan afuera los
 * conceptos variables del mes (horas extra, inasistencias de la Liquidación) y los calculados
 * (aguinaldo, plus vacacional), para comparar el "sueldo normal".
 */
import { numerosLiquidacion, round2, type ReciboExtra, type RrhhLibroSueldos, type RrhhLibroSueldosItem } from './rrhhLibroSueldos'

export type Escenario = {
  /** % de aumento sobre básico + antigüedad. */
  aumentoPct: number
  /** Sólo a esta categoría ('' = todos). */
  categoria: string
  /** Suma fija remunerativa por empleado (p. ej. acuerdo paritario). */
  sumaRemunerativa: number
  /** Suma fija no remunerativa por empleado. */
  sumaNoRemunerativa: number
  altas: Alta[]
}

export type Alta = { id: string; categoria: string; sueldo: number; cantidad: number; enConvenio: boolean }

export type Numeros = { bruto: number; noRem: number; aportes: number; neto: number; contribuciones: number; costo: number }

export type FilaSimulada = {
  clave: string
  nombre: string
  categoria: string
  esAlta: boolean
  actual: Numeros | null
  simulado: Numeros
}

const CERO: Numeros = { bruto: 0, noRem: 0, aportes: 0, neto: 0, contribuciones: 0, costo: 0 }

function numeros(item: RrhhLibroSueldosItem, libro: RrhhLibroSueldos): Numeros {
  const n = numerosLiquidacion(item, libro)
  return { bruto: n.bruto, noRem: n.extraNoRem, aportes: n.descuentos, neto: n.neto, contribuciones: n.contribuciones, costo: n.costoEmpleador }
}

/** Saca los conceptos variables del mes y los calculados (aguinaldo, plus vacacional). */
function soloFijos(item: RrhhLibroSueldosItem): RrhhLibroSueldosItem {
  return { ...item, extras: (item.extras || []).filter((x) => !x.origen) }
}

function sumas(e: Escenario): ReciboExtra[] {
  const out: ReciboExtra[] = []
  if (e.sumaRemunerativa > 0)
    out.push({ id: 'sim-rem', concepto: 'Suma fija remunerativa (simulada)', tipo: 'remunerativo', unidad: '', base: null, monto: e.sumaRemunerativa, codigo_lsd: 'SIMREM' })
  if (e.sumaNoRemunerativa > 0)
    out.push({ id: 'sim-norem', concepto: 'Suma fija no remunerativa (simulada)', tipo: 'no_remunerativo', unidad: '', base: null, monto: e.sumaNoRemunerativa, codigo_lsd: 'SIMNOREM' })
  return out
}

export function simular(params: { libro: RrhhLibroSueldos; items: RrhhLibroSueldosItem[]; escenario: Escenario }): FilaSimulada[] {
  const { libro, items, escenario } = params
  const factor = 1 + (Number(escenario.aumentoPct) || 0) / 100
  const filas: FilaSimulada[] = []
  const base = items.filter((i) => i.incluido).map(soloFijos)

  for (const it of base) {
    const aplica = !escenario.categoria || (it.categoria || '') === escenario.categoria
    const sim: RrhhLibroSueldosItem = aplica
      ? {
          ...it,
          sueldo_basico: round2(it.sueldo_basico * factor),
          adicional_antiguedad: round2(it.adicional_antiguedad * factor),
          extras: [...(it.extras || []), ...sumas(escenario)]
        }
      : it
    filas.push({ clave: `e${it.id_usuario}`, nombre: it.apellido_nombre, categoria: it.categoria || '', esAlta: false, actual: numeros(it, libro), simulado: numeros(sim, libro) })
  }

  const plantilla = base[0]
  for (const a of escenario.altas) {
    const cant = Math.max(0, Math.floor(a.cantidad || 0))
    if (!cant || !(a.sueldo > 0)) continue
    const nueva: RrhhLibroSueldosItem = {
      ...(plantilla ?? ({} as RrhhLibroSueldosItem)),
      id: 0,
      id_libro: libro.id,
      id_usuario: 0,
      incluido: true,
      apellido_nombre: `Nuevo ingreso${a.categoria ? ` · ${a.categoria}` : ''}`,
      categoria: a.categoria,
      fecha_ingreso: null,
      anios_antiguedad: 0,
      antiguedad_reconocida: 0,
      dias: 30,
      sueldo_basico: a.sueldo,
      adicional_antiguedad: 0,
      cct: a.enConvenio,
      cct_codigo: a.enConvenio ? '0409/05' : '9999/99',
      modalidad: '001',
      conyuge: false,
      hijos: 0,
      scvo: plantilla?.scvo ?? 0,
      extras: sumas(escenario)
    }
    const n = numeros(nueva, libro)
    for (let i = 0; i < cant; i++) {
      filas.push({ clave: `${a.id}-${i}`, nombre: nueva.apellido_nombre, categoria: a.categoria, esAlta: true, actual: null, simulado: n })
    }
  }
  return filas
}

export function totales(filas: FilaSimulada[]) {
  const suma = (sel: (f: FilaSimulada) => Numeros | null) =>
    filas.reduce<Numeros>((acc, f) => {
      const n = sel(f) ?? CERO
      return {
        bruto: acc.bruto + n.bruto,
        noRem: acc.noRem + n.noRem,
        aportes: acc.aportes + n.aportes,
        neto: acc.neto + n.neto,
        contribuciones: acc.contribuciones + n.contribuciones,
        costo: acc.costo + n.costo
      }
    }, CERO)
  const actual = suma((f) => f.actual)
  const simulado = suma((f) => f.simulado)
  // Año: 12 sueldos + aguinaldo (≈ medio sueldo dos veces, con sus contribuciones; lo no remunerativo no genera SAC).
  const anual = (n: Numeros) => round2(n.costo * 12 + (n.costo - n.noRem))
  return { actual, simulado, anualActual: anual(actual), anualSimulado: anual(simulado) }
}

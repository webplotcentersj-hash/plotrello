import { useState } from 'react'
import apiService from '../services/api'
import { rrhhLibroSueldosItemsListar, rrhhLibroSueldosObtener } from '../services/rrhhExtendidoService'
import type { RrhhNovedad, SolicitudPermiso } from '../types/api'
import { formatArs2, numerosLiquidacion, type ReciboExtra, type RrhhLibroSueldos, type RrhhLibroSueldosItem } from '../utils/rrhhLibroSueldos'
import {
  CODIGO_PLUS_VAC,
  CODIGO_SAC,
  calcularSac,
  conExtraCalculado,
  diasVacacionesEnMes,
  esMesDeSac,
  plusVacacional,
  semestreDe,
  type ResultadoSac
} from '../utils/rrhhSacVacaciones'
import './RrhhSacVacacionesPanel.css'

type ItemLibro = Omit<RrhhLibroSueldosItem, 'id' | 'id_libro'> & { id?: number; id_libro?: number }

type Fila = {
  id_usuario: number
  nombre: string
  sac: ResultadoSac | null
  diasVac: number
  plus: number
  sueldoVac: number
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const mesCorto = (p: string | null) => (p ? `${MESES[Number(p.slice(5, 7)) - 1]} ${p.slice(2, 4)}` : '—')

/** Bruto remunerativo del recibo sin el propio SAC (base del aguinaldo). */
function remuneracionSinSac(item: ItemLibro, libro: RrhhLibroSueldos): number {
  const sinSac = { ...item, id: item.id || 0, id_libro: item.id_libro || libro.id, extras: (item.extras || []).filter((x) => x.codigo_lsd !== CODIGO_SAC) }
  return numerosLiquidacion(sinSac, libro).bruto
}

export default function RrhhSacVacacionesPanel({
  periodo,
  libro,
  items,
  cerrado,
  onAplicar
}: {
  periodo: string
  libro: RrhhLibroSueldos
  items: ItemLibro[]
  cerrado: boolean
  onAplicar: (extrasPorUsuario: Map<number, ReciboExtra[]>) => void
}) {
  const mesSac = esMesDeSac(periodo)
  const semestre = semestreDe(periodo)
  const [filas, setFilas] = useState<Fila[] | null>(null)
  const [faltanMeses, setFaltanMeses] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [incluirSac, setIncluirSac] = useState(mesSac)
  const [abierto, setAbierto] = useState(false)

  const calcular = async () => {
    setBusy(true)
    setError(null)
    try {
      const [y, m] = periodo.split('-').map(Number)
      const desde = `${periodo}-01`
      const hasta = `${periodo}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`
      const [solRes, novRes] = await Promise.all([
        apiService.obtenerSolicitudesPermisos(null, 'aprobado', 'vacaciones'),
        apiService.rrhhNovedadesListar({ fechaDesde: desde, fechaHasta: hasta })
      ])
      const vac = diasVacacionesEnMes({
        periodo,
        solicitudes: (solRes.success ? solRes.data : []) as SolicitudPermiso[],
        novedades: (novRes.success ? novRes.data : []) as RrhhNovedad[]
      })

      // Remuneraciones del semestre por empleado (meses ya guardados + el actual en pantalla).
      const rem = new Map<number, Record<string, number>>()
      const faltan: string[] = []
      if (incluirSac) {
        for (const p of semestre.meses) {
          if (p > periodo) continue
          if (p === periodo) {
            for (const it of items) if (it.incluido) rem.set(it.id_usuario, { ...(rem.get(it.id_usuario) ?? {}), [p]: remuneracionSinSac(it, libro) })
            continue
          }
          const lib = await rrhhLibroSueldosObtener(p)
          if (!lib.success || !lib.data) {
            faltan.push(p)
            continue
          }
          const its = await rrhhLibroSueldosItemsListar(lib.data.id)
          if (!its.success || !its.data?.length) {
            faltan.push(p)
            continue
          }
          for (const it of its.data) {
            if (!it.incluido) continue
            rem.set(it.id_usuario, { ...(rem.get(it.id_usuario) ?? {}), [p]: remuneracionSinSac(it, lib.data) })
          }
        }
      }
      setFaltanMeses(faltan)

      setFilas(
        items
          .filter((it) => it.incluido)
          .map((it) => {
            const diasVac = vac.get(it.id_usuario) ?? 0
            const sueldoVac = Math.round((Number(it.sueldo_basico) + Number(it.adicional_antiguedad)) * 100) / 100
            return {
              id_usuario: it.id_usuario,
              nombre: it.apellido_nombre,
              sac: incluirSac ? calcularSac({ semestre, remuneraciones: rem.get(it.id_usuario) ?? {}, fechaIngreso: it.fecha_ingreso }) : null,
              diasVac,
              plus: plusVacacional(sueldoVac, diasVac),
              sueldoVac
            }
          })
          .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
      )
      setAbierto(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo calcular')
    } finally {
      setBusy(false)
    }
  }

  const aplicar = () => {
    if (!filas) return
    const cambios = new Map<number, ReciboExtra[]>()
    for (const f of filas) {
      const it = items.find((x) => x.id_usuario === f.id_usuario)
      if (!it) continue
      let extras = it.extras || []
      if (f.sac) {
        extras = conExtraCalculado(extras, {
          id: 'calc-sac',
          concepto: `SAC ${semestre.numero}° semestre ${semestre.anio}`,
          tipo: 'remunerativo',
          unidad: 'días',
          cantidad: f.sac.diasTrabajados,
          base: f.sac.mejorRemuneracion,
          monto: f.sac.sac,
          codigo_lsd: CODIGO_SAC
        })
      }
      extras = conExtraCalculado(extras, {
        id: 'calc-plusvac',
        concepto: `Plus vacacional (${f.diasVac} días a sueldo ÷ 25)`,
        tipo: 'remunerativo',
        unidad: 'días',
        cantidad: f.diasVac,
        base: f.sueldoVac,
        monto: f.plus,
        codigo_lsd: CODIGO_PLUS_VAC
      })
      cambios.set(f.id_usuario, extras)
    }
    onAplicar(cambios)
  }

  const totalSac = filas?.reduce((s, f) => s + (f.sac?.sac ?? 0), 0) ?? 0
  const totalPlus = filas?.reduce((s, f) => s + f.plus, 0) ?? 0
  const conVac = filas?.filter((f) => f.diasVac > 0).length ?? 0

  return (
    <section className="rrhh-sac" aria-label="Aguinaldo y plus vacacional">
      <div className="rrhh-sac__cab">
        <div>
          <strong>Aguinaldo y plus vacacional</strong>
          <p>
            {mesSac
              ? `En ${periodo.endsWith('06') ? 'junio' : 'diciembre'} se liquida el SAC del ${semestre.numero}° semestre: 50% de la mejor remuneración del semestre (proporcional si ingresó en el semestre).`
              : 'El SAC se liquida en junio y diciembre. Acá se calcula el plus vacacional del mes (días de vacaciones a sueldo ÷ 25 en vez de ÷ 30).'}
          </p>
        </div>
        <div className="rrhh-sac__acciones">
          {!mesSac && (
            <label title="Para una baja o un pago fuera de término">
              <input type="checkbox" checked={incluirSac} onChange={(e) => setIncluirSac(e.target.checked)} /> Calcular SAC igual
            </label>
          )}
          <button type="button" className="rrhh-ext-btn" onClick={() => void calcular()} disabled={busy || cerrado}>
            {busy ? 'Calculando…' : filas ? '↻ Recalcular' : 'Calcular'}
          </button>
          {filas && (
            <button type="button" className="rrhh-ext-btn ghost" onClick={() => setAbierto((v) => !v)}>
              {abierto ? 'Ocultar' : 'Ver detalle'}
            </button>
          )}
        </div>
      </div>

      {error && <p className="rrhh-ext-error">{error}</p>}

      {filas && (
        <div className="rrhh-sac__resumen">
          {incluirSac && (
            <span>
              SAC total <strong>{formatArs2(totalSac)}</strong>
            </span>
          )}
          <span>
            Plus vacacional <strong>{formatArs2(totalPlus)}</strong> ({conVac} con vacaciones en el mes)
          </span>
          {!cerrado && (
            <button type="button" className="rrhh-ext-btn primary" onClick={aplicar} disabled={!totalSac && !totalPlus && !filas.length}>
              Aplicar al libro
            </button>
          )}
        </div>
      )}

      {filas && faltanMeses.length > 0 && incluirSac && (
        <p className="rrhh-sac__aviso">
          ⚠️ No hay libro guardado para {faltanMeses.map(mesCorto).join(', ')}: esos meses no entran en la “mejor remuneración”. Si en alguno cobró más, el
          SAC queda corto.
        </p>
      )}

      {filas && abierto && (
        <div className="rrhh-sac__tabla-wrap">
          <table className="rrhh-sac__tabla">
            <thead>
              <tr>
                <th>Empleado</th>
                {incluirSac && (
                  <>
                    <th className="num">Mejor remuneración</th>
                    <th>Mes</th>
                    <th className="num">Proporción</th>
                    <th className="num">SAC</th>
                  </>
                )}
                <th className="num">Días vac.</th>
                <th className="num">Plus vacacional</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.id_usuario}>
                  <td>{f.nombre}</td>
                  {incluirSac && (
                    <>
                      <td className="num">{f.sac ? formatArs2(f.sac.mejorRemuneracion) : '—'}</td>
                      <td>{mesCorto(f.sac?.mejorPeriodo ?? null)}</td>
                      <td className="num" title={f.sac ? `${f.sac.diasTrabajados} de ${f.sac.diasSemestre} días` : ''}>
                        {f.sac ? (f.sac.proporcion >= 1 ? 'Completo' : `${Math.round(f.sac.proporcion * 100)}%`) : '—'}
                      </td>
                      <td className="num">
                        <strong>{f.sac ? formatArs2(f.sac.sac) : '—'}</strong>
                      </td>
                    </>
                  )}
                  <td className="num">{f.diasVac || '—'}</td>
                  <td className="num">{f.plus ? formatArs2(f.plus) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="rrhh-sac__nota">
            Base del SAC: remuneración bruta declarada de cada libro del semestre (básico, antigüedad, horas extra y conceptos remunerativos, menos inasistencias).
            Plus vacacional sobre básico + antigüedad del mes. Al aplicar se agregan como conceptos remunerativos (códigos {CODIGO_SAC} y {CODIGO_PLUS_VAC}) y
            entran en aportes, contribuciones, recibo y TXT de ARCA. Revisalos y guardá el libro.
          </p>
        </div>
      )}
    </section>
  )
}

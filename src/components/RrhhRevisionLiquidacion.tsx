import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import apiService from '../services/api'
import type { Asistencia, SolicitudPermiso } from '../types/api'
import { diasEntre, type HorarioEsperadoCtx, type HorarioFijoAsistencia } from '../utils/asistenciaStats'
import { isoToArgentinaDateKey } from '../utils/dateUtils'
import {
  CATEGORIA_INFO,
  ORDEN_CATEGORIAS,
  resumenHallazgos,
  revisarLiquidacion,
  type EmpleadoRevision,
  type Hallazgo
} from '../utils/rrhhRevisionLiquidacion'
import { esUsuarioRrhhExcluido } from '../utils/rrhhUsuariosExcluidos'
import { nombreSinDominioCorreo } from '../utils/userDisplayName'
import './RrhhRevisionLiquidacion.css'

export type ResumenRevision = { errores: number; avisos: number; empleadosConErrores: number; cargando: boolean }

function rangoMes(periodo: string) {
  const [y, m] = periodo.split('-').map(Number)
  return { desde: `${periodo}-01`, hasta: `${periodo}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}` }
}

/**
 * Revisión antes de liquidar: muestra lo que haría que la liquidación del período salga mal.
 * Carga sus propios datos a partir del período (YYYY-MM).
 */
export default function RrhhRevisionLiquidacion({
  periodo,
  onResumen,
  compacto = false
}: {
  periodo: string
  onResumen?: (r: ResumenRevision) => void
  /** Arranca cerrado si no hay errores. */
  compacto?: boolean
}) {
  const navigate = useNavigate()
  const [hallazgos, setHallazgos] = useState<Hallazgo[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [abierto, setAbierto] = useState(!compacto)
  const [verAvisos, setVerAvisos] = useState(false)
  const [version, setVersion] = useState(0)

  const cargar = useCallback(async () => {
    setHallazgos(null)
    setError(null)
    const { desde, hasta } = rangoMes(periodo)
    try {
      const [legRes, asisRes, novRes, perRangoRes, perPendRes, horRes, rotRes, turnosRes] = await Promise.all([
        apiService.obtenerLegajosBasico(),
        apiService.obtenerAsistencia(null, desde, hasta),
        apiService.rrhhNovedadesListar({ fechaDesde: desde, fechaHasta: hasta }),
        apiService.obtenerSolicitudesPermisos(null, null, null, desde, hasta),
        apiService.obtenerSolicitudesPermisos(null, 'pendiente'),
        apiService.obtenerHorariosFijos(periodo),
        import('../services/rrhhTurnosRotativosService').then((m) => m.listarRotacionesCompletas()).catch(() => null),
        apiService.obtenerTurnos(null, desde, hasta)
      ])
      if (!legRes.success || !legRes.data) throw new Error(legRes.error || 'No se pudieron leer los legajos')
      if (!asisRes.success) throw new Error(asisRes.error || 'No se pudo leer la asistencia')

      const empleados: EmpleadoRevision[] = []
      for (const [id, row] of Object.entries(legRes.data)) {
        const completo = `${row.nombre || ''} ${row.apellido || ''}`.trim()
        if (esUsuarioRrhhExcluido({ nombre: completo || row.nombre || '', email: row.email })) continue
        empleados.push({
          id: Number(id),
          nombre: nombreSinDominioCorreo(completo) || completo || `Usuario ${id}`,
          cuil: row.cuil ?? null,
          fechaIngreso: row.fecha_ingreso ?? null
        })
      }
      empleados.sort((a, b) => a.nombre.localeCompare(b.nombre))

      const horarios: Record<number, HorarioFijoAsistencia> = {}
      if (horRes.success && horRes.data) {
        for (const [id, h] of Object.entries(horRes.data)) {
          horarios[Number(id)] = { entrada: h.entrada, salida: h.salida, horas: h.horas, trabajaSabado: h.trabajaSabado }
        }
      }

      const permisos = new Map<number, SolicitudPermiso>()
      for (const r of [perRangoRes, perPendRes]) if (r.success && r.data) for (const p of r.data) permisos.set(p.id, p)

      let ctx: HorarioEsperadoCtx | null = null
      if (rotRes || (turnosRes.success && turnosRes.data)) {
        const overridesPorUsuarioDia: Record<string, { entrada: string; salida: string }> = {}
        if (turnosRes.success && turnosRes.data) {
          for (const t of turnosRes.data) {
            const f = String(t.fecha || '').slice(0, 10)
            if (f) overridesPorUsuarioDia[`${t.id_usuario}|${f}`] = { entrada: String(t.hora_entrada || '').slice(0, 5), salida: String(t.hora_salida || '').slice(0, 5) }
          }
        }
        ctx = { plantillas: rotRes?.plantillas, asignaciones: rotRes?.asignaciones, overridesPorUsuarioDia }
      }

      setHallazgos(
        revisarLiquidacion({
          dias: diasEntre(desde, hasta),
          hoy: isoToArgentinaDateKey(new Date().toISOString()),
          empleados,
          asistencia: (asisRes.data || []) as Asistencia[],
          novedades: novRes.success ? novRes.data || [] : [],
          permisos: [...permisos.values()],
          horarios,
          horarioEsperadoCtx: ctx
        })
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo revisar el período')
      setHallazgos([])
    }
  }, [periodo])

  useEffect(() => {
    void cargar()
  }, [cargar, version])

  const resumen = useMemo(() => (hallazgos ? resumenHallazgos(hallazgos) : null), [hallazgos])

  useEffect(() => {
    onResumen?.(resumen ? { ...resumen, cargando: false } : { errores: 0, avisos: 0, empleadosConErrores: 0, cargando: true })
    if (resumen && resumen.errores > 0) setAbierto(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumen])

  const grupos = useMemo(() => {
    if (!hallazgos) return []
    return ORDEN_CATEGORIAS.map((c) => ({ c, items: hallazgos.filter((h) => h.categoria === c) })).filter(
      (g) => g.items.length && (verAvisos || g.items[0].nivel === 'error')
    )
  }, [hallazgos, verAvisos])

  const estado = !resumen ? 'cargando' : error ? 'error' : resumen.errores ? 'mal' : resumen.avisos ? 'avisos' : 'ok'

  return (
    <section className={`rrhh-rev rrhh-rev--${estado}`} aria-label="Revisión antes de liquidar">
      <button type="button" className="rrhh-rev__cab" onClick={() => setAbierto((v) => !v)} aria-expanded={abierto}>
        <span className="rrhh-rev__icono" aria-hidden>
          {estado === 'cargando' ? '⏳' : estado === 'ok' ? '✅' : estado === 'mal' ? '⛔' : '⚠️'}
        </span>
        <span className="rrhh-rev__titulos">
          <strong>Revisión antes de liquidar</strong>
          <span>
            {estado === 'cargando'
              ? 'Revisando marcas, permisos, horarios y legajos…'
              : error
                ? error
                : resumen!.errores
                  ? `${resumen!.errores} problema${resumen!.errores > 1 ? 's' : ''} que cambian la plata en ${resumen!.empleadosConErrores} empleado${resumen!.empleadosConErrores > 1 ? 's' : ''}${resumen!.avisos ? ` · ${resumen!.avisos} para revisar` : ''}`
                  : resumen!.avisos
                    ? `Nada bloqueante · ${resumen!.avisos} detalle${resumen!.avisos > 1 ? 's' : ''} para revisar`
                    : 'Todo en orden para liquidar'}
          </span>
        </span>
        <span className="rrhh-rev__flecha" aria-hidden>
          {abierto ? '▴' : '▾'}
        </span>
      </button>

      {abierto && hallazgos && (
        <div className="rrhh-rev__cuerpo">
          <div className="rrhh-rev__barra">
            <label>
              <input type="checkbox" checked={verAvisos} onChange={(e) => setVerAvisos(e.target.checked)} />
              Mostrar también los avisos ({resumen?.avisos ?? 0})
            </label>
            <button type="button" className="rrhh-rev__btn" onClick={() => setVersion((v) => v + 1)}>
              ↻ Volver a revisar
            </button>
          </div>

          {grupos.length === 0 ? (
            <p className="rrhh-rev__vacio">
              {resumen?.avisos && !verAvisos ? 'No hay problemas que cambien la plata. Hay avisos menores ocultos.' : 'No se encontró nada para corregir en este período.'}
            </p>
          ) : (
            grupos.map(({ c, items }) => {
              const info = CATEGORIA_INFO[c]
              return (
                <div key={c} className={`rrhh-rev__grupo rrhh-rev__grupo--${items[0].nivel}`}>
                  <div className="rrhh-rev__grupo-cab">
                    <div>
                      <strong>
                        {info.titulo} <span className="rrhh-rev__n">{items.length}</span>
                      </strong>
                      <p>{info.porQue}</p>
                    </div>
                    <button type="button" className="rrhh-rev__btn" onClick={() => navigate(info.ir)}>
                      {info.textoIr} →
                    </button>
                  </div>
                  <ul>
                    {items.slice(0, 40).map((h, i) => (
                      <li key={i}>
                        <strong>{h.nombre}</strong> <span>{h.detalle}</span>
                      </li>
                    ))}
                    {items.length > 40 && <li className="rrhh-rev__mas">y {items.length - 40} más…</li>}
                  </ul>
                </div>
              )
            })
          )}
        </div>
      )}
    </section>
  )
}

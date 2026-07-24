import { useCallback, useEffect, useMemo, useState } from 'react'
import { addDays, format, getISOWeek, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { apiService } from '../services/api'
import { HORARIO_SABADO } from '../services/relojBiometricoService'
import type { SolicitudPermiso, UsuarioRecord } from '../types/api'
import { getArgentinaDateString } from '../utils/dateUtils'
import { permisoEnDia } from '../utils/rrhhNovedadDates'
import PermisosAutorizadosCalendario from './PermisosAutorizadosCalendario'

type HorarioFijo = {
  entrada: string
  salida: string
  horas: number | null
  trabajaSabado: boolean
}

type SabadoModo = 'todos' | 'par' | 'impar'

type TurnoDiaRow = {
  idUsuario: number
  nombre: string
  sector: string
  entrada: string
  salida: string
  origen: 'fijo' | 'override' | 'intercambio'
  permiso?: SolicitudPermiso
  sabadoModo: SabadoModo
  trabajaHoy: boolean
  motivoNoTrabaja?: string
}

function nombreDisplay(
  id: number,
  usuarios: UsuarioRecord[],
  legajos: Record<number, { nombre: string; apellido: string; sector: string }>
): { nombre: string; sector: string } {
  const leg = legajos[id]
  if (leg && (leg.apellido || leg.nombre)) {
    return {
      nombre: `${leg.apellido || ''} ${leg.nombre || ''}`.trim(),
      sector: leg.sector || ''
    }
  }
  const u = usuarios.find((x) => x.id === id)
  return { nombre: u?.nombre || `Usuario ${id}`, sector: '' }
}

function semanaPar(fechaIso: string): boolean {
  const d = parseISO(fechaIso)
  return getISOWeek(d) % 2 === 0
}

function correspondeSabado(modo: SabadoModo, fechaIso: string): boolean {
  if (modo === 'todos') return true
  const par = semanaPar(fechaIso)
  return modo === 'par' ? par : !par
}

type Props = {
  usuarios: UsuarioRecord[]
  permisos: SolicitudPermiso[]
}

export default function TurnosDiaPanel({ usuarios, permisos }: Props) {
  const [fecha, setFecha] = useState(getArgentinaDateString)
  const [fijos, setFijos] = useState<Record<number, HorarioFijo>>({})
  const [legajos, setLegajos] = useState<
    Record<number, { nombre: string; apellido: string; sector: string }>
  >({})
  const [overrides, setOverrides] = useState<
    Record<number, { entrada: string; salida: string; obs?: string | null; id?: number }>
  >({})
  const [sabadoMedio, setSabadoMedio] = useState<Record<number, SabadoModo>>({})
  const [cargando, setCargando] = useState(true)
  const [msg, setMsg] = useState<string | null>(null)
  const [swapA, setSwapA] = useState('')
  const [swapB, setSwapB] = useState('')
  const [swapping, setSwapping] = useState(false)
  const [showCalPermisos, setShowCalPermisos] = useState(false)
  const [guardandoSabado, setGuardandoSabado] = useState<number | null>(null)

  const mes = fecha.slice(0, 7)
  const dow = useMemo(() => {
    const [y, m, d] = fecha.split('-').map(Number)
    return new Date(y, m - 1, d).getDay()
  }, [fecha])

  const reload = useCallback(async () => {
    setCargando(true)
    setMsg(null)
    try {
      const [rf, rl, rt, rs] = await Promise.all([
        apiService.obtenerHorariosFijos(mes),
        apiService.obtenerLegajosBasico(),
        apiService.obtenerTurnos(null, fecha, fecha),
        apiService.obtenerSabadosMedio()
      ])
      if (rf.success && rf.data) setFijos(rf.data)
      else setFijos({})
      if (rl.success && rl.data) setLegajos(rl.data)
      if (rs.success && rs.data) setSabadoMedio(rs.data)
      else if (!rs.success) {
        setMsg(
          rs.error?.includes('rrhh_sabado_medio') || /does not exist|schema cache/i.test(rs.error || '')
            ? 'Falta aplicar en Supabase el patch 2026-07-24_rrhh_sabado_medio.sql'
            : rs.error || 'No se pudieron cargar sábados por medio'
        )
      }
      const map: typeof overrides = {}
      if (rt.success && rt.data) {
        for (const t of rt.data) {
          map[t.id_usuario] = {
            id: t.id,
            entrada: String(t.hora_entrada || '').slice(0, 5),
            salida: String(t.hora_salida || '').slice(0, 5),
            obs: t.observaciones
          }
        }
      }
      setOverrides(map)
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'No se pudieron cargar los turnos')
    } finally {
      setCargando(false)
    }
  }, [fecha, mes])

  useEffect(() => {
    void reload()
  }, [reload])

  const permisosDia = useMemo(
    () => permisos.filter((p) => p.estado === 'aprobado' && permisoEnDia(p, fecha)),
    [permisos, fecha]
  )

  const permisosPorUsuario = useMemo(() => {
    const m = new Map<number, SolicitudPermiso>()
    for (const p of permisosDia) m.set(p.id_usuario, p)
    return m
  }, [permisosDia])

  const idsActivos = useMemo(() => {
    const s = new Set<number>()
    for (const u of usuarios) s.add(u.id)
    for (const id of Object.keys(legajos)) s.add(Number(id))
    return s
  }, [usuarios, legajos])

  const filas = useMemo((): TurnoDiaRow[] => {
    const ids = new Set<number>([
      ...Object.keys(fijos).map(Number),
      ...Object.keys(overrides).map(Number)
    ])
    const rows: TurnoDiaRow[] = []

    for (const id of ids) {
      // Horarios fijos viejos de bajas no deben aparecer (ni como "Usuario N").
      if (!idsActivos.has(id)) continue

      const fijo = fijos[id]
      const ov = overrides[id]
      const { nombre, sector } = nombreDisplay(id, usuarios, legajos)
      if (/^Usuario\s+\d+$/i.test(nombre)) continue

      const modo = sabadoMedio[id] || 'todos'
      const permiso = permisosPorUsuario.get(id)

      let trabajaHoy = false
      let motivoNoTrabaja: string | undefined
      let entrada = ''
      let salida = ''
      let origen: TurnoDiaRow['origen'] = 'fijo'

      if (dow === 0) {
        trabajaHoy = false
        motivoNoTrabaja = 'Domingo'
      } else if (dow === 6) {
        if (!fijo?.trabajaSabado && !ov) {
          trabajaHoy = false
          motivoNoTrabaja = 'No trabaja sábados'
        } else if (fijo?.trabajaSabado && !correspondeSabado(modo, fecha) && !ov) {
          trabajaHoy = false
          motivoNoTrabaja =
            modo === 'par' ? 'Sábado por medio (semana impar)' : 'Sábado por medio (semana par)'
        } else {
          trabajaHoy = true
          if (ov?.entrada && ov?.salida) {
            entrada = ov.entrada
            salida = ov.salida
            origen = /intercambio/i.test(ov.obs || '') ? 'intercambio' : 'override'
          } else {
            entrada = HORARIO_SABADO.entrada
            salida = HORARIO_SABADO.salida
            origen = 'fijo'
          }
        }
      } else {
        if (!fijo && !ov) continue
        trabajaHoy = true
        if (ov?.entrada && ov?.salida) {
          entrada = ov.entrada
          salida = ov.salida
          origen = /intercambio/i.test(ov.obs || '') ? 'intercambio' : 'override'
        } else if (fijo) {
          entrada = fijo.entrada
          salida = fijo.salida
          origen = 'fijo'
        }
      }

      if (!trabajaHoy && !permiso && !fijo && !ov) continue

      rows.push({
        idUsuario: id,
        nombre,
        sector,
        entrada,
        salida,
        origen,
        permiso,
        sabadoModo: modo,
        trabajaHoy,
        motivoNoTrabaja
      })
    }

    return rows.sort((a, b) => {
      if (a.trabajaHoy !== b.trabajaHoy) return a.trabajaHoy ? -1 : 1
      if (a.entrada !== b.entrada) return a.entrada.localeCompare(b.entrada)
      return a.nombre.localeCompare(b.nombre, 'es')
    })
  }, [fijos, overrides, usuarios, legajos, sabadoMedio, permisosPorUsuario, dow, fecha, idsActivos])

  const trabajando = filas.filter((f) => f.trabajaHoy && !f.permiso)
  const conPermiso = filas.filter((f) => f.permiso)
  const libres = filas.filter((f) => !f.trabajaHoy && !f.permiso)

  const fechaLabel = useMemo(() => {
    try {
      return format(parseISO(fecha), "EEEE d/MM/yyyy", { locale: es })
    } catch {
      return fecha
    }
  }, [fecha])

  const intercambiar = async () => {
    const idA = Number(swapA)
    const idB = Number(swapB)
    if (!idA || !idB || idA === idB) {
      setMsg('Elegí dos empleados distintos para intercambiar.')
      return
    }
    const a = filas.find((f) => f.idUsuario === idA && f.trabajaHoy)
    const b = filas.find((f) => f.idUsuario === idB && f.trabajaHoy)
    if (!a?.entrada || !b?.entrada) {
      setMsg('Ambos tienen que tener turno ese día para intercambiar.')
      return
    }
    setSwapping(true)
    setMsg(null)
    try {
      const r1 = await apiService.crearTurno(
        idA,
        fecha,
        b.entrada,
        b.salida,
        'normal',
        `intercambio con ${b.nombre}`
      )
      const r2 = await apiService.crearTurno(
        idB,
        fecha,
        a.entrada,
        a.salida,
        'normal',
        `intercambio con ${a.nombre}`
      )
      if (!r1.success || !r2.success) {
        setMsg(r1.error || r2.error || 'No se pudo guardar el intercambio')
      } else {
        setMsg(`Intercambio listo: ${a.nombre} ↔ ${b.nombre}`)
        setSwapA('')
        setSwapB('')
        await reload()
      }
    } finally {
      setSwapping(false)
    }
  }

  const setModoSabado = async (id: number, modo: SabadoModo) => {
    const prev = sabadoMedio[id] || 'todos'
    setSabadoMedio((m) => ({ ...m, [id]: modo }))
    setGuardandoSabado(id)
    setMsg(null)
    try {
      const r = await apiService.upsertSabadoMedio(id, modo)
      if (!r.success) {
        setSabadoMedio((m) => ({ ...m, [id]: prev }))
        setMsg(
          r.error?.includes('rrhh_sabado_medio') || /does not exist|schema cache/i.test(r.error || '')
            ? 'Falta aplicar en Supabase el patch 2026-07-24_rrhh_sabado_medio.sql'
            : r.error || 'No se pudo guardar el sábado por medio'
        )
      }
    } finally {
      setGuardandoSabado(null)
    }
  }

  return (
    <div className="rrhh-turnos-dia">
      <div className="rrhh-turnos-dia-nav">
        <button
          type="button"
          className="btn-secondary"
          onClick={() => setFecha(format(addDays(parseISO(fecha), -1), 'yyyy-MM-dd'))}
        >
          ← Ayer
        </button>
        <div className="rrhh-turnos-dia-fecha">
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} aria-label="Fecha" />
          <strong>{fechaLabel}</strong>
        </div>
        <div className="rrhh-turnos-dia-nav-right">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setFecha(format(addDays(parseISO(fecha), 1), 'yyyy-MM-dd'))}
          >
            Mañana →
          </button>
          <button type="button" className="btn-secondary" onClick={() => setFecha(getArgentinaDateString())}>
            Hoy
          </button>
        </div>
      </div>

      <div className="rrhh-turnos-swap">
        <h3>Intercambiar turnos</h3>
        <div className="rrhh-turnos-swap-row">
          <select value={swapA} onChange={(e) => setSwapA(e.target.value)}>
            <option value="">Empleado A…</option>
            {trabajando.map((f) => (
              <option key={f.idUsuario} value={f.idUsuario}>
                {f.nombre} ({f.entrada}–{f.salida})
              </option>
            ))}
          </select>
          <span className="rrhh-turnos-swap-arrow">↔</span>
          <select value={swapB} onChange={(e) => setSwapB(e.target.value)}>
            <option value="">Empleado B…</option>
            {trabajando.map((f) => (
              <option key={f.idUsuario} value={f.idUsuario}>
                {f.nombre} ({f.entrada}–{f.salida})
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn-primary"
            disabled={swapping || !swapA || !swapB}
            onClick={() => void intercambiar()}
          >
            {swapping ? 'Guardando…' : 'Intercambiar'}
          </button>
        </div>
        <p className="rrhh-turnos-help">
          El intercambio aplica solo a este día (queda guardado en la base). Los horarios fijos (Lun–Vie / Sáb 9–14) no
          cambian. Los sábados por medio también se guardan en la base.
        </p>
      </div>

      {msg ? <p className="rrhh-turnos-msg">{msg}</p> : null}
      {cargando ? <p className="rrhh-turnos-help">Cargando turnos…</p> : null}

      <div className="rrhh-turnos-kpi">
        <span>
          En turno: <strong>{trabajando.length}</strong>
        </span>
        <span>
          Con permiso: <strong>{conPermiso.length}</strong>
        </span>
        {dow === 6 ? (
          <span className="rrhh-turnos-kpi-sab">Sábado · jornada 9–14 · semana {semanaPar(fecha) ? 'par' : 'impar'}</span>
        ) : null}
      </div>

      <ul className="rrhh-turnos-dia-list">
        {filas.length === 0 && !cargando ? (
          <li className="rrhh-turnos-dia-empty">Nadie con horario cargado para este día.</li>
        ) : null}
        {filas.map((f) => (
          <li
            key={f.idUsuario}
            className={`rrhh-turnos-dia-row${f.permiso ? ' is-permiso' : ''}${!f.trabajaHoy ? ' is-off' : ''}`}
          >
            <div className="rrhh-turnos-dia-persona">
              <strong>{f.nombre}</strong>
              {f.sector ? <small>{f.sector}</small> : null}
            </div>
            <div className="rrhh-turnos-dia-horario">
              {f.permiso ? (
                <span className="rrhh-turnos-chip rrhh-turnos-chip--permiso">
                  {f.permiso.tipo_solicitud || 'Permiso'}
                </span>
              ) : f.trabajaHoy ? (
                <>
                  <span className="rrhh-turnos-hora">
                    {f.entrada} – {f.salida}
                  </span>
                  {f.origen === 'intercambio' ? (
                    <span className="rrhh-turnos-chip">Intercambio</span>
                  ) : f.origen === 'override' ? (
                    <span className="rrhh-turnos-chip">Ajuste día</span>
                  ) : null}
                </>
              ) : (
                <span className="rrhh-turnos-off">{f.motivoNoTrabaja || 'No trabaja'}</span>
              )}
            </div>
            {(fijos[f.idUsuario]?.trabajaSabado !== false || f.sabadoModo !== 'todos' || dow === 6) ? (
              <label className="rrhh-turnos-sab-medio">
                Sáb
                <select
                  value={f.sabadoModo}
                  disabled={guardandoSabado === f.idUsuario}
                  onChange={(e) => void setModoSabado(f.idUsuario, e.target.value as SabadoModo)}
                >
                  <option value="todos">Todos</option>
                  <option value="par">Por medio (par)</option>
                  <option value="impar">Por medio (impar)</option>
                </select>
              </label>
            ) : null}
          </li>
        ))}
      </ul>

      {libres.length > 0 && dow === 6 ? (
        <p className="rrhh-turnos-help">
          {libres.length} empleado(s) sin turno hoy por regla de sábado / sábados por medio.
        </p>
      ) : null}

      <div className="rrhh-turnos-permisos-block">
        <button
          type="button"
          className="btn-secondary"
          onClick={() => setShowCalPermisos((v) => !v)}
        >
          {showCalPermisos ? 'Ocultar' : 'Ver'} calendario de permisos
        </button>
        {permisosDia.length > 0 ? (
          <ul className="rrhh-turnos-permisos-hoy">
            {permisosDia.map((p) => {
              const { nombre } = nombreDisplay(p.id_usuario, usuarios, legajos)
              return (
                <li key={p.id}>
                  <strong>{nombre}</strong> — {p.tipo_solicitud || 'permiso'}
                  {p.descripcion ? `: ${p.descripcion}` : p.titulo ? `: ${p.titulo}` : ''}
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="rrhh-turnos-help">Sin permisos aprobados para este día.</p>
        )}
        {showCalPermisos ? (
          <div className="rrhh-turnos-cal-wrap">
            <PermisosAutorizadosCalendario usuarios={usuarios} permisos={permisos} />
          </div>
        ) : null}
      </div>
    </div>
  )
}

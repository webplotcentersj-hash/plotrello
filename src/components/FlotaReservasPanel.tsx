import { useCallback, useEffect, useMemo, useState } from 'react'
import apiService from '../services/api'
import { useAuth } from '../hooks/useAuth'
import type { ReservaVehiculoFlota } from '../types/api'
import {
  type ItemParqueFlota,
  vehiculoPuedeSolicitarSalida
} from '../utils/flotaVehiculosCatalogo'
import { getArgentinaDateString } from '../utils/dateUtils'
import { etiquetaUsuarioNombre } from '../utils/etiquetaUsuarioNombre'
import './FlotaReservasPanel.css'

type Props = {
  itemsParque: ItemParqueFlota[]
  onReservasChanged?: () => void
}

const DOW_SHORT = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

function addMonths(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  const yy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${yy}-${mm}`
}

function monthMeta(ym: string) {
  const [y, m] = ym.split('-').map(Number)
  const daysInMonth = new Date(y, m, 0).getDate()
  const desde = `${y}-${String(m).padStart(2, '0')}-01`
  const hasta = `${y}-${String(m).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`
  return { y, m, daysInMonth, desde, hasta }
}

/** Lunes = 0 … domingo = 6 */
function mondayOffsetFirstDay(year: number, month: number): number {
  const dow = new Date(year, month - 1, 1).getDay()
  return (dow + 6) % 7
}

function iniciales(nombre: string): string {
  const p = nombre.trim().split(/\s+/).filter(Boolean)
  if (p.length === 0) return '?'
  if (p.length === 1) return p[0].slice(0, 2).toUpperCase()
  return (p[0][0] + p[p.length - 1][0]).toUpperCase()
}

const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre'
]

export default function FlotaReservasPanel({ itemsParque, onReservasChanged }: Props) {
  const { usuario } = useAuth()
  const [yearMonth, setYearMonth] = useState(() => getArgentinaDateString().slice(0, 7))
  const [reservas, setReservas] = useState<ReservaVehiculoFlota[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [okMsg, setOkMsg] = useState<string | null>(null)
  const [vehiculoId, setVehiculoId] = useState('')
  const [fechaSel, setFechaSel] = useState('')
  const [motivo, setMotivo] = useState('')
  const [enviando, setEnviando] = useState(false)

  const filaVehiculos = useMemo(
    () => itemsParque.filter((i) => i.enBase && i.id != null && vehiculoPuedeSolicitarSalida(i)),
    [itemsParque]
  )

  const { y, m, daysInMonth, desde, hasta } = useMemo(() => monthMeta(yearMonth), [yearMonth])
  const offset = useMemo(() => mondayOffsetFirstDay(y, m), [y, m])

  const reservaPorCelda = useMemo(() => {
    const map = new Map<string, ReservaVehiculoFlota>()
    for (const r of reservas) {
      if (r.estado !== 'pendiente_aprobacion' && r.estado !== 'aprobada') continue
      const key = `${r.id_vehiculo}_${r.fecha}`
      map.set(key, r)
    }
    return map
  }, [reservas])

  const loadReservas = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const meta = monthMeta(yearMonth)
      const r = await apiService.getReservasVehiculosFlota({
        fechaDesde: meta.desde,
        fechaHasta: meta.hasta
      })
      if (r.success && r.data) setReservas(r.data)
      else setError(r.error ?? 'No se pudieron cargar las reservas')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar reservas')
    } finally {
      setLoading(false)
    }
  }, [yearMonth])

  useEffect(() => {
    void loadReservas()
  }, [loadReservas])

  const hoyYm = getArgentinaDateString().slice(0, 7)
  const minYmNav = addMonths(hoyYm, -36)
  const puedeMesAnterior = yearMonth > minYmNav
  const esMesPasado = yearMonth < hoyYm
  const fechaMinInput = yearMonth === hoyYm ? getArgentinaDateString() : desde

  const misReservasMes = useMemo(() => {
    if (!usuario?.id) return []
    return reservas.filter((r) => r.id_usuario === usuario.id)
  }, [reservas, usuario?.id])

  const handlePedirReserva = async (e: React.FormEvent) => {
    e.preventDefault()
    setOkMsg(null)
    setError(null)
    if (!usuario) {
      setError('Tenés que estar logueado para reservar.')
      return
    }
    const vid = parseInt(vehiculoId, 10)
    if (!vid || Number.isNaN(vid)) {
      setError('Elegí un vehículo.')
      return
    }
    if (!fechaSel) {
      setError('Elegí una fecha.')
      return
    }
    setEnviando(true)
    try {
      const res = await apiService.crearReservaVehiculoFlota({
        id_vehiculo: vid,
        id_usuario: usuario.id,
        nombre_usuario: usuario.nombre || `Usuario ${usuario.id}`,
        fecha: fechaSel,
        motivo: motivo.trim() || null
      })
      if (res.success) {
        setOkMsg('Solicitud enviada. Caja o Administración debe aprobarla.')
        setMotivo('')
        await loadReservas()
        onReservasChanged?.()
      } else {
        setError(res.error ?? 'No se pudo guardar')
      }
    } finally {
      setEnviando(false)
    }
  }

  const cancelarMia = async (id: number) => {
    if (!usuario || !confirm('¿Cancelar esta reserva pendiente?')) return
    setError(null)
    const r = await apiService.cancelarReservaVehiculoFlotaPropia(id, usuario.id)
    if (r.success) {
      await loadReservas()
      onReservasChanged?.()
    } else alert(r.error || 'No se pudo cancelar')
  }

  const labelMes = `${MESES[m - 1]} ${y}`

  return (
    <section className="flota-reservas-panel" aria-labelledby="flota-reservas-title">
      <div className="flota-reservas-head">
        <div>
          <h2 id="flota-reservas-title">Reservas por día</h2>
          <p>
            Pedí con anticipación qué vehículo necesitás y en qué fecha. <strong>Caja o Administración</strong> aprueba
            la reserva. Si un día está <span className="flota-reservas-dot aprobada" style={{ display: 'inline-block' }} />{' '}
            aprobado para otra persona, ese vehículo no podrá pedirse para salir ese día por otro usuario.
          </p>
        </div>
        <div className="flota-reservas-nav">
          <button
            type="button"
            disabled={!puedeMesAnterior}
            onClick={() => setYearMonth((v) => addMonths(v, -1))}
            aria-label="Mes anterior"
          >
            ←
          </button>
          <span className="flota-reservas-month-label">{labelMes}</span>
          <button type="button" onClick={() => setYearMonth((v) => addMonths(v, 1))} aria-label="Mes siguiente">
            →
          </button>
        </div>
      </div>

      <div className="flota-reservas-leyenda">
        <span>
          <span className="flota-reservas-dot pendiente" /> Pendiente de aprobación
        </span>
        <span>
          <span className="flota-reservas-dot aprobada" /> Aprobada (solo ese usuario sale ese día)
        </span>
      </div>

      {error && (
        <p className="flota-reservas-msg error" role="alert">
          {error}
          {error.includes('relation') || error.includes('does not exist') ? (
            <span>
              {' '}
              Ejecutá en Supabase: <code>supabase/patches/2026-04-04_flota_reservas_dia.sql</code>
            </span>
          ) : null}
        </p>
      )}
      {okMsg && <p className="flota-reservas-msg ok">{okMsg}</p>}
      {esMesPasado && (
        <p className="flota-reservas-msg" role="status">
          Mes pasado: el calendario es solo consulta. Volvé al mes actual o siguiente para pedir una reserva.
        </p>
      )}

      <div className="flota-reservas-scroll">
        <table className="flota-reservas-grid">
          <thead>
            <tr>
              <th>Vehículo</th>
              {Array.from({ length: offset }, (_, i) => (
                <th key={`pad-${i}`} className="flota-reservas-celda-vacia" />
              ))}
              {Array.from({ length: daysInMonth }, (_, idx) => {
                const day = idx + 1
                const ds = `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                const dow = new Date(y, m - 1, day).getDay()
                const monIdx = (dow + 6) % 7
                return (
                  <th key={ds} className="dow" title={ds}>
                    <div>{DOW_SHORT[monIdx]}</div>
                    <div>{day}</div>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {filaVehiculos.map((item) => (
              <tr key={item.id}>
                <td>{item.nombre}</td>
                {Array.from({ length: offset }, (_, i) => (
                  <td key={`e-${item.id}-${i}`} className="flota-reservas-celda-vacia" />
                ))}
                {Array.from({ length: daysInMonth }, (_, idx) => {
                  const day = idx + 1
                  const fechaStr = `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                  const r = item.id != null ? reservaPorCelda.get(`${item.id}_${fechaStr}`) : undefined
                  if (!r) {
                    return (
                      <td key={fechaStr} className="flota-reservas-celda-dia">
                        ·
                      </td>
                    )
                  }
                  return (
                    <td
                      key={fechaStr}
                      className={`flota-reservas-celda-slot ${r.estado === 'aprobada' ? 'aprobada' : 'pendiente'}`}
                      title={`${etiquetaUsuarioNombre(r.nombre_usuario)} · ${r.estado === 'aprobada' ? 'Aprobada' : 'Pendiente'}`}
                    >
                      <span className="iniciales">{iniciales(r.nombre_usuario)}</span>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {loading && <p style={{ color: '#94a3b8', fontSize: '0.82rem', marginTop: 8 }}>Actualizando calendario…</p>}
        {filaVehiculos.length === 0 && (
          <p style={{ color: '#94a3b8', fontSize: '0.86rem' }}>
            No hay vehículos disponibles en el parque para reservar (revisá estado en admin o carga en Supabase).
          </p>
        )}
      </div>

      <form className="flota-reservas-form" onSubmit={(ev) => void handlePedirReserva(ev)}>
        <label>
          Vehículo
          <select
            value={vehiculoId}
            onChange={(e) => setVehiculoId(e.target.value)}
            required
            disabled={esMesPasado}
          >
            <option value="">Elegir…</option>
            {filaVehiculos.map((v) => (
              <option key={v.id} value={String(v.id)}>
                {v.nombre}
              </option>
            ))}
          </select>
        </label>
        <label>
          Día
          <input
            type="date"
            value={fechaSel}
            min={fechaMinInput}
            max={hasta}
            onChange={(e) => setFechaSel(e.target.value)}
            required
            disabled={esMesPasado}
          />
        </label>
        <label style={{ flex: '1 1 200px' }}>
          Motivo (opcional)
          <input
            type="text"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ej. entrega OP 1234"
            maxLength={500}
            disabled={esMesPasado}
          />
        </label>
        <button type="submit" disabled={enviando || !usuario || esMesPasado}>
          {enviando ? 'Enviando…' : 'Pedir reserva'}
        </button>
      </form>

      {usuario && misReservasMes.length > 0 && (
        <div className="flota-reservas-mis">
          <h3>Tus reservas este mes</h3>
          <ul>
            {misReservasMes.map((r) => (
              <li key={r.id}>
                <span className={`tag ${r.estado}`}>
                  {r.estado === 'pendiente_aprobacion'
                    ? 'Pendiente'
                    : r.estado === 'aprobada'
                      ? 'Aprobada'
                      : r.estado === 'rechazada'
                        ? 'Rechazada'
                        : r.estado === 'cancelada'
                          ? 'Cancelada'
                          : r.estado}
                </span>
                <strong>{r.vehiculo?.nombre ?? 'Vehículo'}</strong>
                <span>· {r.fecha}</span>
                {r.estado === 'pendiente_aprobacion' && (
                  <button type="button" className="link-cancel" onClick={() => void cancelarMia(r.id)}>
                    Cancelar solicitud
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

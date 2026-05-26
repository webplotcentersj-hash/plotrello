import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import apiService from '../services/api'
import type { OrdenTrabajo } from '../types/api'
import './MostradorCalendarioPage.css'

const DIAS_SEMANA = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

function ymdLocal(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function parseFechaYmd(s: string): Date {
  const part = s.slice(0, 10)
  const [y, m, d] = part.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function esEntregada(orden: OrdenTrabajo): boolean {
  return orden.estado === 'Entregado o Instalado' || !!orden.entregado
}

function esAtrasada(orden: OrdenTrabajo, hoy: Date): boolean {
  if (!orden.fecha_entrega || esEntregada(orden)) return false
  return parseFechaYmd(orden.fecha_entrega) < hoy
}

const MostradorCalendarioPage = () => {
  const navigate = useNavigate()
  const { loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [ordenes, setOrdenes] = useState<OrdenTrabajo[]>([])
  const [mesVisible, setMesVisible] = useState(() => new Date())
  const [diaSeleccionado, setDiaSeleccionado] = useState<Date>(() => new Date())

  const hoy = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])

  useEffect(() => {
    if (authLoading) return
    void loadOrdenes()
  }, [authLoading])

  const loadOrdenes = async () => {
    setLoading(true)
    try {
      const res = await apiService.getOrdenes()
      if (res.success && res.data) {
        setOrdenes(res.data.filter((o) => o.fecha_entrega))
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const ordenesPorDia = useMemo(() => {
    const map = new Map<string, OrdenTrabajo[]>()
    for (const o of ordenes) {
      if (!o.fecha_entrega) continue
      const key = o.fecha_entrega.slice(0, 10)
      const list = map.get(key) ?? []
      list.push(o)
      map.set(key, list)
    }
    for (const [, list] of map) {
      list.sort((a, b) => {
        const aa = esAtrasada(a, hoy) ? 0 : 1
        const bb = esAtrasada(b, hoy) ? 0 : 1
        if (aa !== bb) return aa - bb
        return String(a.numero_op).localeCompare(String(b.numero_op))
      })
    }
    return map
  }, [ordenes, hoy])

  const celdasMes = useMemo(() => {
    const año = mesVisible.getFullYear()
    const mes = mesVisible.getMonth()
    const primerDia = new Date(año, mes, 1)
    const ultimoDia = new Date(año, mes + 1, 0)
    const inicioGrid = primerDia.getDay()
    const diasMes = ultimoDia.getDate()

    const celdas: { fecha: Date; esMesActual: boolean }[] = []

    const prev = new Date(año, mes, 0).getDate()
    for (let i = inicioGrid - 1; i >= 0; i--) {
      celdas.push({ fecha: new Date(año, mes - 1, prev - i), esMesActual: false })
    }
    for (let d = 1; d <= diasMes; d++) {
      celdas.push({ fecha: new Date(año, mes, d), esMesActual: true })
    }
    while (celdas.length < 42) {
      const n = celdas.length - (inicioGrid + diasMes) + 1
      celdas.push({ fecha: new Date(año, mes + 1, n), esMesActual: false })
    }
    return celdas
  }, [mesVisible])

  const entregasDiaSel = useMemo(() => {
    return ordenesPorDia.get(ymdLocal(diaSeleccionado)) ?? []
  }, [ordenesPorDia, diaSeleccionado])

  const tituloMes = mesVisible.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })

  const cambiarMes = (delta: number) => {
    const d = new Date(mesVisible)
    d.setMonth(d.getMonth() + delta)
    setMesVisible(d)
  }

  const irHoy = () => {
    const now = new Date()
    setMesVisible(new Date(now.getFullYear(), now.getMonth(), 1))
    setDiaSeleccionado(now)
  }

  if (authLoading || loading) {
    return (
      <div className="mc-page">
        <div className="mc-loading">
          <div className="mc-spinner" />
          <p>Cargando calendario…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="mc-page">
      <header className="mc-toolbar">
        <button type="button" className="mc-btn mc-btn--ghost" onClick={() => navigate('/mostrador/dashboard')}>
          ← Panel
        </button>
        <div className="mc-toolbar__center">
          <h1>Calendario de entregas</h1>
          <p className="mc-toolbar__mes">{tituloMes}</p>
        </div>
        <div className="mc-toolbar__nav">
          <button type="button" className="mc-btn mc-btn--ghost" onClick={() => cambiarMes(-1)} aria-label="Mes anterior">
            ‹
          </button>
          <button type="button" className="mc-btn mc-btn--primary" onClick={irHoy}>
            Hoy
          </button>
          <button type="button" className="mc-btn mc-btn--ghost" onClick={() => cambiarMes(1)} aria-label="Mes siguiente">
            ›
          </button>
        </div>
      </header>

      <ul className="mc-leyenda" aria-label="Leyenda">
        <li>
          <span className="mc-leyenda__dot mc-leyenda__dot--hoy" /> Hoy
        </li>
        <li>
          <span className="mc-leyenda__dot mc-leyenda__dot--entrega" /> Con entregas
        </li>
        <li>
          <span className="mc-leyenda__dot mc-leyenda__dot--atraso" /> Atrasadas
        </li>
        <li>
          <span className="mc-leyenda__dot mc-leyenda__dot--ok" /> Entregadas
        </li>
      </ul>

      <div className="mc-calendario-wrap">
        <div className="mc-calendario">
          <div className="mc-calendario__head">
            {DIAS_SEMANA.map((d) => (
              <div key={d} className="mc-calendario__dow">
                {d}
              </div>
            ))}
          </div>
          <div className="mc-calendario__grid">
            {celdasMes.map((celda, idx) => {
              const key = ymdLocal(celda.fecha)
              const lista = ordenesPorDia.get(key) ?? []
              const esHoy = ymdLocal(celda.fecha) === ymdLocal(hoy)
              const seleccionado = ymdLocal(celda.fecha) === ymdLocal(diaSeleccionado)
              const tieneAtraso = lista.some((o) => esAtrasada(o, hoy))
              const pendientes = lista.filter((o) => !esEntregada(o))
              const maxChips = 2
              const visibles = pendientes.slice(0, maxChips)
              const resto = pendientes.length - visibles.length

              return (
                <button
                  key={idx}
                  type="button"
                  className={[
                    'mc-dia',
                    !celda.esMesActual && 'mc-dia--fuera',
                    esHoy && 'mc-dia--hoy',
                    seleccionado && 'mc-dia--sel',
                    tieneAtraso && 'mc-dia--atraso',
                    lista.length > 0 && 'mc-dia--con-entregas'
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => setDiaSeleccionado(celda.fecha)}
                >
                  <span className="mc-dia__num">{celda.fecha.getDate()}</span>
                  {lista.length > 0 && (
                    <span className="mc-dia__badge">{pendientes.length || lista.length}</span>
                  )}
                  <div className="mc-dia__chips">
                    {visibles.map((o) => (
                      <span
                        key={o.id}
                        className={`mc-chip${esAtrasada(o, hoy) ? ' mc-chip--atraso' : ''}${esEntregada(o) ? ' mc-chip--ok' : ''}`}
                        title={`${o.cliente} — ${o.estado}`}
                      >
                        OP {o.numero_op}
                      </span>
                    ))}
                    {resto > 0 && <span className="mc-chip mc-chip--mas">+{resto}</span>}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <section className="mc-detalle-dia" aria-live="polite">
        <header className="mc-detalle-dia__head">
          <h2>
            {diaSeleccionado.toLocaleDateString('es-AR', {
              weekday: 'long',
              day: 'numeric',
              month: 'long'
            })}
          </h2>
          <span className="mc-detalle-dia__count">
            {entregasDiaSel.length === 0
              ? 'Sin entregas'
              : `${entregasDiaSel.length} ${entregasDiaSel.length === 1 ? 'entrega' : 'entregas'}`}
          </span>
        </header>

        {entregasDiaSel.length === 0 ? (
          <p className="mc-detalle-dia__empty">No hay órdenes con fecha de entrega este día.</p>
        ) : (
          <ul className="mc-detalle-lista">
            {entregasDiaSel.map((o) => {
              const atrasada = esAtrasada(o, hoy)
              const entregada = esEntregada(o)
              return (
                <li key={o.id}>
                  <button
                    type="button"
                    className={`mc-entrega-row${atrasada ? ' mc-entrega-row--atraso' : ''}${entregada ? ' mc-entrega-row--ok' : ''}`}
                    onClick={() => navigate(`/op/${o.numero_op}`)}
                  >
                    <span className="mc-entrega-row__op">OP {o.numero_op}</span>
                    <span className="mc-entrega-row__cliente">{o.cliente}</span>
                    <span className="mc-entrega-row__estado">{o.estado}</span>
                    {atrasada && <span className="mc-entrega-row__tag">Atrasada</span>}
                    {entregada && <span className="mc-entrega-row__tag mc-entrega-row__tag--ok">Entregada</span>}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}

export default MostradorCalendarioPage

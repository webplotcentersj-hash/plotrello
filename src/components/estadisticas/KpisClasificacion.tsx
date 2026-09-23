import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  clasificarPendientes,
  getKpisClasificacion,
  type KpisClasificacion as KpisData,
  type TipoClasificacion
} from '../../services/clasificacionIaApi'
import './KpisClasificacion.css'

/** Tope de lotes por clic: evita un loop largo si algo falla o hay muchísimo histórico. */
const MAX_LOTES = 15

const CATEGORIAS_SIN_DATO = ['Pendiente de clasificar', 'Sin clasificar (revisar)']

const pesos = (n: number) => `$${Math.round(n).toLocaleString('es-AR')}`
const pct = (parte: number, total: number) => (total > 0 ? `${Math.round((parte / total) * 100)}%` : '—')

function BarraLista({ filas }: { filas: Array<{ clave: string; etiqueta: string; valor: number; detalle: string }> }) {
  const max = Math.max(...filas.map((f) => f.valor), 0)
  return (
    <ul className="kpi-ia-barras">
      {filas.map((f) => (
        <li key={f.clave} className={CATEGORIAS_SIN_DATO.includes(f.clave) ? 'kpi-ia-barras__fila--apagada' : undefined}>
          <div className="kpi-ia-barras__texto">
            <span title={f.etiqueta}>{f.etiqueta}</span>
            <strong>{f.detalle}</strong>
          </div>
          <div className="kpi-ia-barras__pista">
            <div className="kpi-ia-barras__relleno" style={{ width: max > 0 ? `${(f.valor / max) * 100}%` : '0%' }} />
          </div>
        </li>
      ))}
    </ul>
  )
}

export default function KpisClasificacion({ desde, hasta }: { desde: string; hasta: string }) {
  const [data, setData] = useState<KpisData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)
  const [clasificando, setClasificando] = useState(false)
  const [mensaje, setMensaje] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    if (!desde || !hasta) return
    setCargando(true)
    const r = await getKpisClasificacion(desde, hasta)
    if (r.success && r.data) {
      setData(r.data)
      setError(null)
    } else {
      setError(r.error || 'No se pudieron cargar los KPIs')
    }
    setCargando(false)
  }, [desde, hasta])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const totalPendientes = data ? data.pendientes.rubro_venta_item + data.pendientes.motivo_falla_entrega : 0

  /** Clasifica en lotes hasta terminar, o hasta que un lote no avance (sin clave / errores). */
  const handleClasificar = async () => {
    setClasificando(true)
    setMensaje(null)
    const totales = { catalogo: 0, regla: 0, ia: 0, revisar: 0 }
    let aviso: string | null = null
    for (const tipo of ['rubro_venta_item', 'motivo_falla_entrega'] as TipoClasificacion[]) {
      for (let i = 0; i < MAX_LOTES; i++) {
        const r = await clasificarPendientes(tipo)
        if (!r.success || !r.data) {
          aviso = r.error || 'Error clasificando'
          break
        }
        const c = r.data.clasificados
        totales.catalogo += c.catalogo
        totales.regla += c.regla
        totales.ia += c.ia
        totales.revisar += c.revisar
        if (r.data.error) aviso = r.data.error
        if (r.data.sinClave) aviso = 'Hay textos que necesitan IA: falta configurar TYPESAFE_API_KEY en Vercel.'
        const avanzados = c.catalogo + c.regla + c.ia
        if (avanzados === 0 || r.data.pendientes[tipo] === 0) break
      }
    }
    const resumen = `Clasificados: ${totales.catalogo} por catálogo, ${totales.regla} por regla, ${totales.ia} con IA (${totales.revisar} para revisar).`
    setMensaje(aviso ? `${resumen} ${aviso}` : resumen)
    setClasificando(false)
    await cargar()
  }

  const filasRubro = useMemo(() => {
    const v = data?.ventasPorRubro
    if (!v) return []
    return v.por_rubro.map((r) => ({
      clave: r.rubro,
      etiqueta: r.rubro,
      valor: Number(r.monto) || 0,
      detalle: `${pesos(Number(r.monto) || 0)} · ${pct(Number(r.monto) || 0, Number(v.monto_total) || 0)}`
    }))
  }, [data])

  const filasMotivo = useMemo(() => {
    const f = data?.fallasEntrega
    if (!f) return []
    return f.por_motivo.map((m) => ({
      clave: m.motivo,
      etiqueta: m.motivo,
      valor: Number(m.cantidad) || 0,
      detalle: `${m.cantidad} · ${pct(Number(m.cantidad) || 0, f.insatisfechas)}`
    }))
  }, [data])

  /** Sector con más insatisfacciones y su motivo principal. */
  const sectoresCriticos = useMemo(() => {
    const porSector = new Map<string, { total: number; motivo: string; max: number }>()
    for (const r of data?.fallasEntrega.por_sector || []) {
      if (CATEGORIAS_SIN_DATO.includes(r.motivo)) continue
      const prev = porSector.get(r.sector) || { total: 0, motivo: '', max: 0 }
      prev.total += Number(r.cantidad) || 0
      if ((Number(r.cantidad) || 0) > prev.max) {
        prev.max = Number(r.cantidad) || 0
        prev.motivo = r.motivo
      }
      porSector.set(r.sector, prev)
    }
    return [...porSector.entries()].sort((a, b) => b[1].total - a[1].total).slice(0, 3)
  }, [data])

  return (
    <div className="stats-row">
      <div className="stat-card">
        <h3>🏷️ Ventas por rubro</h3>
        <p className="stat-subtitle">
          Período {desde} → {hasta} · rubros del catálogo; los ítems cargados a mano se clasifican con IA
        </p>
        {error ? (
          <div className="stats-chart-empty">{error}</div>
        ) : !data || cargando ? (
          <div className="stats-chart-empty">Cargando…</div>
        ) : filasRubro.length === 0 ? (
          <div className="stats-chart-empty">No hay ventas en el período</div>
        ) : (
          <>
            <div className="kpi-ia-total">
              {pesos(Number(data.ventasPorRubro.monto_total) || 0)} en {data.ventasPorRubro.items} ítems
            </div>
            <BarraLista filas={filasRubro} />
          </>
        )}
      </div>

      <div className="stat-card">
        <h3>😕 Por qué fallamos en las entregas</h3>
        <p className="stat-subtitle">Encuestas post-entrega con 1 a 3 sobre 5 · motivo según el comentario del cliente</p>
        {error ? (
          <div className="stats-chart-empty">{error}</div>
        ) : !data || cargando ? (
          <div className="stats-chart-empty">Cargando…</div>
        ) : (
          <>
            <div className="stat-grid-2">
              <div>
                <div className="stat-value">{data.fallasEntrega.encuestas}</div>
                <div className="stat-label">Encuestas</div>
              </div>
              <div>
                <div className="stat-value">
                  {data.fallasEntrega.insatisfechas} ({pct(data.fallasEntrega.insatisfechas, data.fallasEntrega.encuestas)})
                </div>
                <div className="stat-label">Insatisfechas</div>
              </div>
            </div>
            {filasMotivo.length === 0 ? (
              <div className="stats-chart-empty">Sin entregas insatisfechas en el período</div>
            ) : (
              <BarraLista filas={filasMotivo} />
            )}
            {sectoresCriticos.length > 0 && (
              <p className="kpi-ia-nota">
                Más fallas en:{' '}
                {sectoresCriticos.map(([sector, s]) => `${sector} (${s.total}, sobre todo ${s.motivo.toLowerCase()})`).join(' · ')}
              </p>
            )}
          </>
        )}
      </div>

      {data && (
        <div className="stat-card full-width kpi-ia-pie">
          <span>
            {totalPendientes > 0
              ? `${totalPendientes} registros sin clasificar (${data.pendientes.rubro_venta_item} ítems de venta, ${data.pendientes.motivo_falla_entrega} encuestas).`
              : 'Todo clasificado.'}
            {!data.iaConfigurada && ' Sin TYPESAFE_API_KEY solo se clasifica por catálogo y reglas.'}
          </span>
          {totalPendientes > 0 && (
            <button type="button" className="stats-export-pill" onClick={handleClasificar} disabled={clasificando}>
              {clasificando ? 'Clasificando…' : 'Clasificar pendientes'}
            </button>
          )}
          {mensaje && <span className="kpi-ia-nota">{mensaje}</span>}
        </div>
      )}
    </div>
  )
}

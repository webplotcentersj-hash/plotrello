import { useCallback, useEffect, useState } from 'react'
import { plotLabFetch } from '../utils/plotLabApiOrigin'
import { getStaffAuthToken } from '../services/staffSession'
import './RelojTabletMarcacionesTab.css'

type MarcacionRow = {
  id: number
  id_usuario: number
  empleado: string
  sector: string
  tipo: string
  marcado_at: string
  hora_argentina: string
  verificacion_confianza: number | null
  verificacion_detalle: string | null
  dispositivo_id: string | null
  foto_url: string | null
}

export default function RelojTabletMarcacionesTab() {
  const hoy = new Date().toISOString().slice(0, 10)
  const [desde, setDesde] = useState(hoy)
  const [hasta, setHasta] = useState(hoy)
  const [rows, setRows] = useState<MarcacionRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const cargar = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const token = getStaffAuthToken()
      const resp = await plotLabFetch(
        `/api/rrhh/reloj-tablet-marcaciones?desde=${encodeURIComponent(desde)}&hasta=${encodeURIComponent(hasta)}`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        }
      )
      const json = (await resp.json()) as { success?: boolean; data?: MarcacionRow[]; error?: string }
      if (!resp.ok || !json.success) {
        throw new Error(json.error || 'No se pudo cargar el historial')
      }
      setRows(json.data ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error de conexión')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [desde, hasta])

  useEffect(() => {
    void cargar()
  }, [cargar])

  return (
    <div className="reloj-tablet-audit">
      <div className="reloj-tablet-audit-head">
        <div>
          <h3>Marcaciones tablet (auditoría)</h3>
          <p>Registro facial del reloj en <code>/tablet-reloj</code>. También alimenta la pestaña Asistencia.</p>
        </div>
        <a className="reloj-tablet-audit-link" href="/tablet-reloj" target="_blank" rel="noreferrer">
          Abrir tablet →
        </a>
      </div>

      <div className="reloj-tablet-audit-filters">
        <label>
          Desde
          <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
        </label>
        <label>
          Hasta
          <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
        </label>
        <button type="button" className="reloj-tablet-audit-btn" onClick={() => void cargar()} disabled={loading}>
          {loading ? 'Cargando…' : 'Actualizar'}
        </button>
      </div>

      {error ? <div className="reloj-tablet-audit-error">{error}</div> : null}

      <div className="reloj-tablet-audit-table-wrap">
        <table className="reloj-tablet-audit-table">
          <thead>
            <tr>
              <th>Fecha/hora</th>
              <th>Empleado</th>
              <th>Sector</th>
              <th>Tipo</th>
              <th>Confianza</th>
              <th>Dispositivo</th>
              <th>Detalle</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="reloj-tablet-audit-empty">
                  {loading ? 'Cargando…' : 'Sin marcaciones en el rango'}
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id}>
                  <td>{new Date(r.marcado_at).toLocaleString('es-AR')} ({r.hora_argentina})</td>
                  <td>{r.empleado}</td>
                  <td>{r.sector || '—'}</td>
                  <td>
                    <span className={`reloj-tablet-audit-tipo reloj-tablet-audit-tipo--${r.tipo}`}>{r.tipo}</span>
                  </td>
                  <td>{r.verificacion_confianza != null ? `${r.verificacion_confianza}%` : '—'}</td>
                  <td>{r.dispositivo_id || '—'}</td>
                  <td className="reloj-tablet-audit-detalle">{r.verificacion_detalle || '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

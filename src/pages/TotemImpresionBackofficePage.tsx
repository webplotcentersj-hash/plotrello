import { useCallback, useEffect, useMemo, useState } from 'react'
import apiService from '../services/api'
import { useAuth } from '../hooks/useAuth'
import { TotemAutogestionKioskShell } from './TotemAutogestionKioskShell'
import './TotemImpresionBackofficePage.css'

type Row = {
  id: number
  cliente_nombre: string
  cliente_dni: string
  cliente_telefono: string
  cantidad_hojas: number
  tipo_impresion: string
  origen_archivo: string
  archivo_url: string
  archivo_nombre: string
  numero_op: string | null
  estado_pago: string
  created_at: string
  pagado_at: string | null
  id_venta?: number | null
  numero_venta_crm?: string | null
  valor_venta?: number | null
  estado_pago_venta?: string | null
}

export default function TotemImpresionBackofficePage() {
  const { usuario, isAdmin } = useAuth()
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [markingId, setMarkingId] = useState<number | null>(null)

  const usuarioId = useMemo(() => {
    const raw = (usuario as any)?.id
    if (typeof raw === 'number') return raw
    if (typeof raw === 'string') {
      const n = parseInt(raw, 10)
      return Number.isFinite(n) ? n : null
    }
    return null
  }, [usuario])

  const load = useCallback(async () => {
    if (!usuarioId) return
    setLoading(true)
    setError(null)
    const r = await apiService.listarSolicitudesImpresionTotem(usuarioId, 120)
    if (r.success && r.data) setRows(r.data as Row[])
    else setError(r.error || 'No se pudo cargar la cola.')
    setLoading(false)
  }, [usuarioId])

  useEffect(() => {
    void load()
  }, [load])

  const handleMarkPaid = async (id: number) => {
    if (!usuarioId) return
    setMarkingId(id)
    setError(null)
    const r = await apiService.marcarPagoSolicitudImpresionTotem(id, usuarioId)
    if (!r.success) {
      setError(r.error || 'No se pudo marcar pago.')
      setMarkingId(null)
      return
    }
    await load()
    setMarkingId(null)
  }

  if (!isAdmin) {
    return (
      <TotemAutogestionKioskShell>
      <div className="totem-bo-page">
        <div className="totem-bo-card">
          <h1>Cola impresión (tótem)</h1>
          <p>Acceso restringido.</p>
        </div>
      </div>
      </TotemAutogestionKioskShell>
    )
  }

  return (
    <TotemAutogestionKioskShell>
    <div className="totem-bo-page">
      <header className="totem-bo-header">
        <div>
          <h1>Cola impresión (tótem)</h1>
          <p>Solicitudes creadas desde el kiosco. Pago en caja.</p>
        </div>
        <div className="totem-bo-actions">
          <button type="button" className="totem-bo-btn" onClick={() => void load()} disabled={loading || !usuarioId}>
            {loading ? 'Actualizando…' : 'Actualizar'}
          </button>
        </div>
      </header>

      <main className="totem-bo-main">
        {error && <div className="totem-bo-error">{error}</div>}
        {!usuarioId && (
          <div className="totem-bo-error">No se pudo obtener el id de usuario para operar la cola.</div>
        )}

        <div className="totem-bo-table-wrap">
          <table className="totem-bo-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Cliente</th>
                <th>Hojas</th>
                <th>Tipo</th>
                <th>Archivo</th>
                <th>Pago</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>#{r.id}</td>
                  <td>
                    <div className="totem-bo-client">
                      <strong>{r.cliente_nombre}</strong>
                      <span>DNI: {r.cliente_dni}</span>
                      <span>Tel: {r.cliente_telefono}</span>
                    </div>
                  </td>
                  <td>{r.cantidad_hojas}</td>
                  <td>
                    <div className="totem-bo-muted">{r.tipo_impresion}</div>
                    <div className="totem-bo-muted">Origen: {r.origen_archivo}</div>
                  </td>
                  <td>
                    <div className="totem-bo-file">
                      <div title={r.archivo_nombre}>{r.archivo_nombre}</div>
                      <a href={r.archivo_url} target="_blank" rel="noreferrer">
                        Abrir link
                      </a>
                    </div>
                  </td>
                  <td>
                    <span className={`totem-bo-badge ${r.estado_pago === 'pagado' ? 'ok' : 'pending'}`}>
                      {r.estado_pago}
                    </span>
                    {r.pagado_at ? <div className="totem-bo-muted">Pagado: {new Date(r.pagado_at).toLocaleString()}</div> : null}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="totem-bo-btn totem-bo-btn--pay"
                      disabled={!usuarioId || markingId === r.id || r.estado_pago === 'pagado'}
                      onClick={() => void handleMarkPaid(r.id)}
                    >
                      {r.estado_pago === 'pagado' ? 'Pagado' : markingId === r.id ? 'Marcando…' : 'Marcar pagado'}
                    </button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && !loading && (
                <tr>
                  <td colSpan={7} className="totem-bo-empty">
                    No hay solicitudes.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
    </TotemAutogestionKioskShell>
  )
}


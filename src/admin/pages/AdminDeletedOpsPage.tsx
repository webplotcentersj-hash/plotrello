import { useEffect, useState } from 'react'
import apiService from '../../services/api'
import { useAuth } from '../../hooks/useAuth'
import './AdminDashboard.css'

type DeletedOpRow = {
  id: number
  id_orden: number | null
  numero_op: string | null
  cliente: string | null
  id_usuario: number | null
  nombre_usuario: string | null
  rol_usuario: string | null
  estado_anterior: string | null
  estado_nuevo: string | null
  comentario: string | null
  accion_tipo: string | null
  timestamp: string
}

export default function AdminDeletedOpsPage() {
  const { usuario } = useAuth()
  const [rows, setRows] = useState<DeletedOpRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)
      const resp = await apiService.getOpEliminadas()
      if (resp.success && resp.data) {
        setRows(resp.data)
      } else {
        setError(resp.error || 'No se pudo cargar la auditoría de OP eliminadas.')
      }
      setLoading(false)
    }
    void load()
  }, [])

  return (
    <div className="admin-dashboard">
      <header className="admin-header">
        <div className="admin-header-content">
          <div className="admin-header-left">
            <h1 className="admin-title">OP eliminadas</h1>
            <p className="admin-subtitle">Auditoría de quién eliminó y por qué</p>
          </div>
          <div className="admin-header-right">
            {usuario && (
              <div className="admin-user-info">
                <span>👤 {usuario.nombre}</span>
                <span className="admin-user-role">{usuario.rol}</span>
              </div>
            )}
          </div>
        </div>
      </header>

      <section className="admin-section">
        {loading && <p style={{ color: '#e5e7eb' }}>Cargando OP eliminadas...</p>}
        {error && (
          <p style={{ color: '#fecaca', marginBottom: '12px' }}>
            {error}
          </p>
        )}

        {!loading && !error && (
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Nº OP</th>
                  <th>Cliente</th>
                  <th>Usuario</th>
                  <th>Rol</th>
                  <th>Estado anterior</th>
                  <th>Motivo</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '16px' }}>
                      No hay OP eliminadas registradas aún.
                    </td>
                  </tr>
                )}
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>{new Date(row.timestamp).toLocaleString('es-AR')}</td>
                    <td>{row.numero_op || `#${row.id_orden ?? ''}`}</td>
                    <td>{row.cliente || '-'}</td>
                    <td>{row.nombre_usuario || '-'}</td>
                    <td>{row.rol_usuario || '-'}</td>
                    <td>{row.estado_anterior || '-'}</td>
                    <td style={{ maxWidth: '360px', whiteSpace: 'pre-wrap' }}>
                      {row.comentario || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}


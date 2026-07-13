import { useCallback, useEffect, useMemo, useState } from 'react'
import { plotLabFetch } from '../utils/plotLabApiOrigin'
import { getStaffAuthToken } from '../services/staffSession'
import './RelojFacialTab.css'

type EmpleadoFotoRow = {
  id_usuario: number
  nombre_completo: string
  sector: string
  foto_url: string | null
  tiene_foto_legajo: boolean
}

type RelojFacialTabProps = {
  onVerAuditoria?: () => void
}

export default function RelojFacialTab({ onVerAuditoria }: RelojFacialTabProps) {
  const [empleados, setEmpleados] = useState<EmpleadoFotoRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const cargar = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const token = getStaffAuthToken()
      const resp = await plotLabFetch('/api/rrhh/reloj-tablet-empleados', {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      })
      const json = (await resp.json()) as {
        success?: boolean
        empleados?: EmpleadoFotoRow[]
        error?: string
      }
      if (!resp.ok || !json.success) {
        throw new Error(json.error || 'No se pudo cargar empleados')
      }
      setEmpleados(json.empleados ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error de conexión')
      setEmpleados([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const { conFoto, sinFoto, pct } = useMemo(() => {
    const con = empleados.filter((e) => e.tiene_foto_legajo || Boolean(e.foto_url?.trim()))
    const sin = empleados.filter((e) => !(e.tiene_foto_legajo || Boolean(e.foto_url?.trim())))
    const total = empleados.length
    return {
      conFoto: con,
      sinFoto: sin,
      pct: total ? Math.round((con.length / total) * 100) : 0
    }
  }, [empleados])

  return (
    <div className="reloj-facial-tab">
      <div className="reloj-facial-hero">
        <div>
          <h3>Reloj con reconocimiento facial</h3>
          <p>
            El kiosco identifica al empleado con la selfie frente a la foto de legajo (umbral alto +
            verificación 1:1). Sin foto de legajo no puede marcar por rostro.
          </p>
        </div>
        <div className="reloj-facial-hero-actions">
          <a
            className="reloj-facial-btn-primary"
            href="/tablet-reloj?modo=facial"
            target="_blank"
            rel="noreferrer"
          >
            Abrir kiosco facial →
          </a>
          {onVerAuditoria ? (
            <button type="button" className="reloj-facial-btn-ghost" onClick={onVerAuditoria}>
              Ver auditoría
            </button>
          ) : (
            <a className="reloj-facial-btn-ghost" href="/tablet-reloj" target="_blank" rel="noreferrer">
              Abrir tablet QR
            </a>
          )}
        </div>
      </div>

      <div className="reloj-facial-stats">
        <div className="reloj-facial-stat">
          <span className="reloj-facial-stat-value">{loading ? '…' : empleados.length}</span>
          <span className="reloj-facial-stat-label">Empleados reloj</span>
        </div>
        <div className="reloj-facial-stat reloj-facial-stat--ok">
          <span className="reloj-facial-stat-value">{loading ? '…' : conFoto.length}</span>
          <span className="reloj-facial-stat-label">Con foto de legajo</span>
        </div>
        <div className="reloj-facial-stat reloj-facial-stat--warn">
          <span className="reloj-facial-stat-value">{loading ? '…' : sinFoto.length}</span>
          <span className="reloj-facial-stat-label">Sin foto (no facial)</span>
        </div>
        <div className="reloj-facial-stat">
          <span className="reloj-facial-stat-value">{loading ? '…' : `${pct}%`}</span>
          <span className="reloj-facial-stat-label">Cobertura</span>
        </div>
      </div>

      <div className="reloj-facial-toolbar">
        <button type="button" className="reloj-facial-btn-ghost" onClick={() => void cargar()} disabled={loading}>
          {loading ? 'Actualizando…' : 'Actualizar cobertura'}
        </button>
      </div>

      {error ? <div className="reloj-facial-error">{error}</div> : null}

      {!loading && sinFoto.length > 0 ? (
        <div className="reloj-facial-sin-foto">
          <h4>Empleados sin foto de legajo</h4>
          <p>Cargá la foto en el legajo del colaborador para habilitar el reconocimiento facial.</p>
          <ul>
            {sinFoto.slice(0, 40).map((e) => (
              <li key={e.id_usuario}>
                <strong>{e.nombre_completo}</strong>
                {e.sector ? <span> · {e.sector}</span> : null}
              </li>
            ))}
          </ul>
          {sinFoto.length > 40 ? (
            <p className="reloj-facial-more">…y {sinFoto.length - 40} más</p>
          ) : null}
        </div>
      ) : null}

      {!loading && sinFoto.length === 0 && empleados.length > 0 ? (
        <div className="reloj-facial-ok">
          Todos los empleados del reloj tienen foto de legajo. El kiosco facial puede usarse.
        </div>
      ) : null}

      <div className="reloj-facial-howto">
        <h4>Cómo usarlo</h4>
        <ol>
          <li>Abrí el kiosco en una tablet fija (pantalla completa).</li>
          <li>El modo Facial detecta el rostro y marca automáticamente si la confianza es alta.</li>
          <li>Si no reconoce, el empleado puede usar QR como respaldo.</li>
        </ol>
      </div>
    </div>
  )
}

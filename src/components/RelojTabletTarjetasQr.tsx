import { useCallback, useEffect, useState } from 'react'
import { toDataURL } from 'qrcode'
import { plotLabFetch } from '../utils/plotLabApiOrigin'
import { getStaffAuthToken } from '../services/staffSession'
import { buildRelojTabletQrPayload } from '../utils/relojTabletQr'
import { VerificationCard } from './ui/verification-card'
import './RelojTabletTarjetasQr.css'

type EmpleadoTarjeta = {
  id_usuario: number
  nombre: string
  apellido: string
  sector: string
  login: string
  nombre_completo: string
}

type TarjetaConQr = EmpleadoTarjeta & { qrSrc: string }

const CARD_BG =
  'https://images.unsplash.com/photo-1557683316-973673baf926?auto=format&fit=crop&w=800&q=80'

function formatIdEmpleado(id: number): string {
  return `PLT ${String(id).padStart(4, '0')}`
}

export default function RelojTabletTarjetasQr() {
  const [empleados, setEmpleados] = useState<TarjetaConQr[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [busqueda, setBusqueda] = useState('')

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
        empleados?: EmpleadoTarjeta[]
        error?: string
      }
      if (!resp.ok || !json.success) {
        throw new Error(json.error || 'No se pudo cargar empleados')
      }
      const rows = json.empleados ?? []
      const conQr = await Promise.all(
        rows.map(async (emp) => {
          const payload = buildRelojTabletQrPayload(emp.id_usuario)
          const qrSrc = await toDataURL(payload, {
            width: 320,
            margin: 1,
            errorCorrectionLevel: 'M',
            color: { dark: '#0f172a', light: '#ffffff' }
          })
          return { ...emp, qrSrc }
        })
      )
      conQr.sort((a, b) => a.nombre_completo.localeCompare(b.nombre_completo, 'es'))
      setEmpleados(conQr)
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

  const filtrados = empleados.filter((e) => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return true
    return [e.nombre_completo, e.nombre, e.apellido, e.sector, e.login].join(' ').toLowerCase().includes(q)
  })

  return (
    <div className="reloj-tablet-tarjetas">
      <div className="reloj-tablet-tarjetas-head">
        <div>
          <h3>Tarjetas QR para marcación</h3>
          <p>
            Imprimí una tarjeta por empleado. En la tablet (<code>/tablet-reloj</code>) escanean el código para
            marcar entrada o salida en segundos.
          </p>
        </div>
        <div className="reloj-tablet-tarjetas-actions">
          <button type="button" className="reloj-tablet-tarjetas-btn" onClick={() => void cargar()} disabled={loading}>
            {loading ? 'Generando…' : 'Actualizar'}
          </button>
          <button
            type="button"
            className="reloj-tablet-tarjetas-btn reloj-tablet-tarjetas-btn--primary"
            onClick={() => window.print()}
            disabled={loading || filtrados.length === 0}
          >
            Imprimir tarjetas
          </button>
        </div>
      </div>

      <input
        type="search"
        className="reloj-tablet-tarjetas-search"
        placeholder="Buscar empleado…"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
      />

      {error ? <p className="reloj-tablet-tarjetas-error">{error}</p> : null}

      <div className="reloj-tablet-tarjetas-grid" id="reloj-tablet-tarjetas-print">
        {filtrados.map((emp) => (
          <VerificationCard
            key={emp.id_usuario}
            animate={false}
            backgroundImage={CARD_BG}
            label="TARJETA EMPLEADO"
            idNumber={formatIdEmpleado(emp.id_usuario)}
            name={(emp.nombre_completo || emp.login).toUpperCase()}
            validThru={(emp.sector || 'PLOT LAB').toUpperCase()}
            qrSrc={emp.qrSrc}
            hint="Escaneá en la tablet para marcar"
          />
        ))}
      </div>

      {!loading && filtrados.length === 0 ? (
        <p className="reloj-tablet-tarjetas-empty">No hay empleados para mostrar.</p>
      ) : null}
    </div>
  )
}

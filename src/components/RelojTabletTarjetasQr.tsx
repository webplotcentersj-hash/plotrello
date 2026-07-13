import { useCallback, useEffect, useState } from 'react'
import { toDataURL } from 'qrcode'
import { plotLabFetch } from '../utils/plotLabApiOrigin'
import { getStaffAuthToken } from '../services/staffSession'
import { buildRelojTabletQrPayload } from '../utils/relojTabletQr'
import { generarTarjetaRelojPdfConLogo } from '../utils/relojTabletTarjetaPdf'
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

function slugNombre(emp: EmpleadoTarjeta): string {
  return (emp.nombre_completo || emp.login || 'empleado').replace(/[^\w\s-]/g, '').replace(/\s+/g, '_')
}

function TarjetaEmpleadoItem({ emp }: { emp: TarjetaConQr }) {
  const [descargando, setDescargando] = useState(false)

  const descargarPdf = async () => {
    setDescargando(true)
    try {
      await generarTarjetaRelojPdfConLogo({
        idUsuario: emp.id_usuario,
        nombreCompleto: emp.nombre_completo || emp.login,
        sector: emp.sector,
        qrSrc: emp.qrSrc,
        filename: `tarjeta-reloj_${slugNombre(emp)}.pdf`
      })
    } finally {
      setDescargando(false)
    }
  }

  return (
    <div className="reloj-tablet-tarjeta-item">
      <div id={`reloj-tarjeta-${emp.id_usuario}`} className="reloj-tablet-tarjeta-print-node">
        <VerificationCard
          animate={false}
          backgroundImage={CARD_BG}
          label="TARJETA EMPLEADO"
          idNumber={formatIdEmpleado(emp.id_usuario)}
          name={(emp.nombre_completo || emp.login).toUpperCase()}
          validThru={(emp.sector || 'PLOT LAB').toUpperCase()}
          qrSrc={emp.qrSrc}
          hint="Escaneá en la tablet para marcar"
        />
      </div>
      <button
        type="button"
        className="reloj-tablet-tarjeta-pdf-btn"
        onClick={() => void descargarPdf()}
        disabled={descargando}
      >
        {descargando ? 'Generando PDF…' : 'Descargar PDF'}
      </button>
    </div>
  )
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
            Imprimí o descargá en PDF una tarjeta por empleado. En la tablet (<code>/tablet-reloj</code>) escanean el
            código para marcar entrada o salida.
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
            Imprimir todas
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
          <TarjetaEmpleadoItem key={emp.id_usuario} emp={emp} />
        ))}
      </div>

      {!loading && filtrados.length === 0 ? (
        <p className="reloj-tablet-tarjetas-empty">No hay empleados para mostrar.</p>
      ) : null}
    </div>
  )
}

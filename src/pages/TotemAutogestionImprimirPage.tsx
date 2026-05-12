import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import apiService from '../services/api'
import { TotemAutogestionKioskShell } from './TotemAutogestionKioskShell'
import './TotemAutogestionImprimirPage.css'

const digitsOnly = (s: string) => String(s ?? '').replace(/\D/g, '')

type Step = 'form' | 'sending' | 'done'

export default function TotemAutogestionImprimirPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('form')
  const [error, setError] = useState<string | null>(null)

  const [clienteNombre, setClienteNombre] = useState('')
  const [clienteDni, setClienteDni] = useState('')
  const [clienteTelefono, setClienteTelefono] = useState('')
  const [cantidadHojas, setCantidadHojas] = useState(1)
  const [tipoImpresion, setTipoImpresion] = useState('A4 - Color')
  const [origenArchivo, setOrigenArchivo] = useState('WhatsApp')
  const [archivoUrl, setArchivoUrl] = useState('')
  const [archivoNombre, setArchivoNombre] = useState('')
  const [valorTotal, setValorTotal] = useState<string>('0')

  const [result, setResult] = useState<{ id: number; numeroVenta?: string | null } | null>(null)

  const dniDigits = useMemo(() => digitsOnly(clienteDni), [clienteDni])

  useEffect(() => {
    if (step !== 'done') return
    const t = window.setTimeout(() => navigate('/totem/autogestion', { replace: true }), 60_000)
    return () => window.clearTimeout(t)
  }, [step, navigate])

  const canSend = () => {
    if (!clienteNombre.trim()) return 'Ingresá tu nombre.'
    if (!dniDigits || dniDigits.length < 7) return 'Ingresá un DNI/CUIT válido.'
    if (!clienteTelefono.trim()) return 'Ingresá un teléfono.'
    if (!Number.isFinite(cantidadHojas) || cantidadHojas < 1) return 'Cantidad de hojas inválida.'
    if (!tipoImpresion.trim()) return 'Elegí tipo de impresión.'
    if (!origenArchivo.trim()) return 'Elegí origen del archivo.'
    if (!archivoNombre.trim()) return 'Ingresá el nombre del archivo.'
    if (!archivoUrl.trim()) return 'Pegá el link del archivo (Drive/WhatsApp/etc.).'
    return null
  }

  const handleSend = async () => {
    setError(null)
    const v = canSend()
    if (v) {
      setError(v)
      return
    }
    setStep('sending')
    try {
      const r = await apiService.crearSolicitudImpresionTotem({
        cliente_nombre: clienteNombre.trim(),
        cliente_dni: dniDigits,
        cliente_telefono: clienteTelefono.trim(),
        cantidad_hojas: Math.floor(cantidadHojas),
        tipo_impresion: tipoImpresion.trim(),
        origen_archivo: origenArchivo.trim(),
        archivo_url: archivoUrl.trim(),
        archivo_nombre: archivoNombre.trim(),
        valor_total: Number.isFinite(Number(valorTotal)) ? Number(valorTotal) : null
      })
      if (!r.success || !r.data) {
        setStep('form')
        setError(r.error || 'No se pudo crear la solicitud.')
        return
      }
      setResult({ id: r.data.id, numeroVenta: r.data.numero_venta ?? null })
      setStep('done')
    } catch (e) {
      setStep('form')
      setError(e instanceof Error ? e.message : 'Error inesperado')
    }
  }

  return (
    <TotemAutogestionKioskShell>
    <div className="totem-print-page">
      <header className="totem-print-header">
        <button type="button" className="totem-print-back" onClick={() => navigate('/totem/autogestion')}>
          ← Inicio
        </button>
        <div>
          <h1>Impresión (cola)</h1>
          <p>Dejá la solicitud. Se paga en caja/mostrador.</p>
        </div>
      </header>

      <main className="totem-print-main">
        {step === 'form' && (
          <section className="totem-print-card">
            <div className="totem-print-grid">
              <label>
                Nombre
                <input value={clienteNombre} onChange={(e) => setClienteNombre(e.target.value)} placeholder="Nombre y apellido" />
              </label>
              <label>
                DNI/CUIT
                <input inputMode="numeric" value={clienteDni} onChange={(e) => setClienteDni(e.target.value)} placeholder="Solo números" />
              </label>
              <label>
                Teléfono
                <input inputMode="tel" value={clienteTelefono} onChange={(e) => setClienteTelefono(e.target.value)} placeholder="Ej: 264..." />
              </label>
              <label>
                Cantidad de hojas
                <input
                  inputMode="numeric"
                  value={String(cantidadHojas)}
                  onChange={(e) => setCantidadHojas(Math.max(1, Math.min(999, Number(e.target.value || '1'))))}
                />
              </label>
              <label>
                Tipo de impresión
                <select value={tipoImpresion} onChange={(e) => setTipoImpresion(e.target.value)}>
                  <option>A4 - Color</option>
                  <option>A4 - Blanco y negro</option>
                  <option>A3 - Color</option>
                  <option>A3 - Blanco y negro</option>
                </select>
              </label>
              <label>
                Origen del archivo
                <select value={origenArchivo} onChange={(e) => setOrigenArchivo(e.target.value)}>
                  <option>WhatsApp</option>
                  <option>Drive</option>
                  <option>Email</option>
                  <option>Pendrive</option>
                  <option>Otro</option>
                </select>
              </label>
              <label className="totem-print-span2">
                Link del archivo
                <input value={archivoUrl} onChange={(e) => setArchivoUrl(e.target.value)} placeholder="Pegá un link (Drive/WhatsApp/etc.)" />
              </label>
              <label className="totem-print-span2">
                Nombre del archivo
                <input value={archivoNombre} onChange={(e) => setArchivoNombre(e.target.value)} placeholder="Ej: cartel_frente.pdf" />
              </label>
              <label>
                Valor estimado (opcional)
                <input inputMode="decimal" value={valorTotal} onChange={(e) => setValorTotal(e.target.value)} placeholder="0" />
              </label>
            </div>

            {error && <div className="totem-print-error">{error}</div>}

            <div className="totem-print-actions">
              <button type="button" className="totem-print-primary" onClick={handleSend}>
                Enviar solicitud
              </button>
            </div>
          </section>
        )}

        {step === 'sending' && (
          <section className="totem-print-card">
            <h2>Enviando…</h2>
            <p>Registrando solicitud de impresión.</p>
          </section>
        )}

        {step === 'done' && result && (
          <section className="totem-print-card totem-print-card--done">
            <h2>Listo</h2>
            <p className="totem-print-success">
              Solicitud creada: <strong>#{result.id}</strong>
            </p>
            <p className="totem-print-hint">Acercate a caja/mostrador para pagar y continuar.</p>
            <div className="totem-print-actions">
              <button type="button" className="totem-print-primary" onClick={() => navigate('/totem/autogestion')}>
                Volver al inicio
              </button>
            </div>
          </section>
        )}
      </main>
    </div>
    </TotemAutogestionKioskShell>
  )
}


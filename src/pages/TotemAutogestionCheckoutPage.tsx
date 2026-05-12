import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import apiService from '../services/api'
import { cartItemCount, cartTotal, clearTotemCart, readTotemCart } from './totemAutogestionCart'
import { TotemAutogestionKioskShell } from './TotemAutogestionKioskShell'
import './TotemAutogestionCheckoutPage.css'

const digitsOnly = (s: string) => String(s ?? '').replace(/\D/g, '')

type Step = 'review' | 'identify' | 'creating' | 'done'

export default function TotemAutogestionCheckoutPage() {
  const navigate = useNavigate()
  const [cart] = useState(() => readTotemCart())
  const [step, setStep] = useState<Step>('review')

  const itemsCount = cartItemCount(cart.items)
  const total = cartTotal(cart.items)

  const [dniCuit, setDniCuit] = useState('')
  const [telefono, setTelefono] = useState('')
  const [nombre, setNombre] = useState('')
  const [needsDetails, setNeedsDetails] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [result, setResult] = useState<{ pedidoId: number } | null>(null)

  useEffect(() => {
    if (itemsCount === 0) {
      navigate('/totem/autogestion/catalogo', { replace: true })
    }
  }, [itemsCount, navigate])

  const dniDigits = useMemo(() => digitsOnly(dniCuit), [dniCuit])

  const validateIdentify = () => {
    if (!dniDigits) return 'Ingresá un DNI/CUIT.'
    if (dniDigits.length < 7) return 'DNI/CUIT inválido.'
    if (!needsDetails) return null
    if (!nombre.trim()) return 'Ingresá tu nombre.'
    return null
  }

  const handleConfirm = async () => {
    setError(null)
    const v = validateIdentify()
    if (v) {
      setError(v)
      return
    }

    setStep('creating')

    try {
      // 1) Intentar resolver cliente existente por DNI/CUIT exacto
      const search = await apiService.buscarClientes(dniDigits)
      let clienteId: number | null = null

      if (search.success && search.data) {
        const match = search.data.find((c) => digitsOnly((c as any).dni_cuit) === dniDigits)
        if (match && typeof (match as any).id === 'number') {
          clienteId = (match as any).id as number
        }
      }

      // 2) Si no existe, crear mínimo (pedimos nombre y teléfono)
      if (!clienteId) {
        if (!nombre.trim()) {
          setNeedsDetails(true)
          setStep('identify')
          setError('Ingresá tu nombre para continuar.')
          return
        }
        const r = await apiService.buscarOCrearCliente({
          nombre: nombre.trim(),
          dni_cuit: dniDigits,
          telefono: telefono.trim() || undefined
        })
        if (!r.success || !r.data) {
          setStep('identify')
          setError(r.error || 'No se pudo registrar el cliente.')
          return
        }
        clienteId = (r.data as any).id as number
      }

      if (!clienteId) {
        setStep('identify')
        setError('No se pudo resolver el cliente. Intentá nuevamente.')
        return
      }

      // 3) Crear pedido cliente (cola)
      const resp = await apiService.crearPedidoCliente({
        id_cliente: clienteId,
        observaciones_cliente: 'Creado desde tótem de autogestión.',
        items: cart.items.map((it) => ({
          id_articulo: it.id_articulo,
          cantidad: it.cantidad,
          precio_unitario: it.precio_unitario,
          precio_total: it.precio_total,
          descripcion_personalizada: undefined
        }))
      })

      if (!resp.success || !resp.data) {
        setStep('identify')
        setError(resp.error || 'No se pudo crear el pedido.')
        return
      }

      setResult({ pedidoId: (resp.data as any).id as number })
      clearTotemCart()
      setStep('done')
    } catch (e) {
      setStep('identify')
      setError(e instanceof Error ? e.message : 'Error inesperado')
    }
  }

  return (
    <TotemAutogestionKioskShell>
    <div className="totem-checkout-page">
      <header className="totem-checkout-header">
        <button type="button" className="totem-checkout-back" onClick={() => navigate('/totem/autogestion/catalogo')}>
          ← Volver
        </button>
        <div>
          <h1>Confirmar</h1>
          <p>Tu solicitud queda en cola. Se paga en caja/mostrador.</p>
        </div>
      </header>

      <main className="totem-checkout-main">
        {step === 'review' && (
          <section className="totem-checkout-card">
            <h2>Resumen</h2>
            <div className="totem-checkout-kv">
              <div>
                <span>Ítems</span>
                <strong>{itemsCount}</strong>
              </div>
              <div>
                <span>Total</span>
                <strong>${total.toFixed(2)}</strong>
              </div>
            </div>
            <button type="button" className="totem-checkout-primary" onClick={() => setStep('identify')}>
              Continuar
            </button>
          </section>
        )}

        {step === 'identify' && (
          <section className="totem-checkout-card">
            <h2>Identificación</h2>
            <label className="totem-checkout-label">
              DNI/CUIT
              <input
                inputMode="numeric"
                className="totem-checkout-input"
                value={dniCuit}
                onChange={(e) => setDniCuit(e.target.value)}
                placeholder="Ingresá tu DNI/CUIT"
              />
            </label>

            <div className="totem-checkout-hint">Si el DNI no existe, te pedimos nombre para registrarte.</div>

            {needsDetails && (
              <div className="totem-checkout-details">
                <label className="totem-checkout-label">
                  Nombre
                  <input
                    className="totem-checkout-input"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    placeholder="Nombre y apellido"
                    autoComplete="off"
                  />
                </label>
                <label className="totem-checkout-label">
                  Teléfono (opcional)
                  <input
                    inputMode="tel"
                    className="totem-checkout-input"
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                    placeholder="Ej: 264..."
                    autoComplete="off"
                  />
                </label>
              </div>
            )}

            {error && <div className="totem-checkout-error">{error}</div>}

            <div className="totem-checkout-actions">
              <button type="button" className="totem-checkout-secondary" onClick={() => setNeedsDetails((v) => !v)}>
                {needsDetails ? 'No crear cliente nuevo' : 'No encuentro mi DNI: cargar datos'}
              </button>
              <button type="button" className="totem-checkout-primary" onClick={handleConfirm}>
                Confirmar
              </button>
            </div>
          </section>
        )}

        {step === 'creating' && (
          <section className="totem-checkout-card">
            <h2>Creando…</h2>
            <p>Estamos registrando tu solicitud.</p>
          </section>
        )}

        {step === 'done' && result && (
          <section className="totem-checkout-card totem-checkout-card--done">
            <h2>Listo</h2>
            <p className="totem-checkout-success">
              Pedido creado. Número interno: <strong>#{result.pedidoId}</strong>
            </p>
            <p className="totem-checkout-hint">Acercate a caja/mostrador para pagar y coordinar.</p>
            <div className="totem-checkout-actions">
              <button type="button" className="totem-checkout-primary" onClick={() => navigate('/totem/autogestion')}>
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


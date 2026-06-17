import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import apiService from '../services/api'
import {
  CLIENTES_BUSCAR,
  CLIENTES_DASHBOARD,
  clientesCcPerfil
} from '../utils/clientesRoutes'
import './AgregarClientePage.css'

export default function AgregarClientePage() {
  const navigate = useNavigate()
  const { canAccessMostradorViews } = useAuth()
  const [nombre, setNombre] = useState('')
  const [apellido, setApellido] = useState('')
  const [empresa, setEmpresa] = useState('')
  const [dniCuit, setDniCuit] = useState('')
  const [telefono, setTelefono] = useState('')
  const [email, setEmail] = useState('')
  const [direccion, setDireccion] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [creadoId, setCreadoId] = useState<number | null>(null)

  if (!canAccessMostradorViews) {
    return (
      <div className="cl-agregar-page">
        <p className="cl-agregar-denied">No tenés permiso para agregar clientes.</p>
      </div>
    )
  }

  const resetForm = () => {
    setNombre('')
    setApellido('')
    setEmpresa('')
    setDniCuit('')
    setTelefono('')
    setEmail('')
    setDireccion('')
    setCreadoId(null)
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const nombreTrim = nombre.trim()
    if (!nombreTrim && !empresa.trim()) {
      setError('Ingresá al menos nombre o razón social / empresa.')
      return
    }

    setLoading(true)
    setError(null)
    try {
      const res = await apiService.crearClienteSinAcceso({
        nombre: nombreTrim || empresa.trim(),
        apellido: apellido.trim() || undefined,
        empresa: empresa.trim() || undefined,
        dni_cuit: dniCuit.trim() || undefined,
        telefono: telefono.trim() || undefined,
        email: email.trim() || undefined,
        direccion: direccion.trim() || undefined
      })
      if (!res.success || !res.data) {
        setError(res.error || 'No se pudo crear el cliente')
        return
      }
      setCreadoId(res.data.id)
    } catch {
      setError('Error de conexión al guardar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="cl-agregar-page">
      <header className="cl-agregar-header">
        <button
          type="button"
          className="cl-agregar-back"
          onClick={() => navigate(CLIENTES_DASHBOARD)}
        >
          ← Clientes
        </button>
        <div>
          <h1>Agregar cliente</h1>
          <p>Alta en la base sin acceso al portal web. Podés completar cuenta corriente después.</p>
        </div>
      </header>

      {creadoId ? (
        <div className="cl-agregar-ok" role="status">
          <p>
            <strong>Cliente creado correctamente.</strong> Ya podés buscarlo o abrir su ficha.
          </p>
          <div className="cl-agregar-ok__actions">
            <button
              type="button"
              className="cl-agregar-btn cl-agregar-btn--primary"
              onClick={() => navigate(CLIENTES_BUSCAR)}
            >
              Buscar cliente
            </button>
            <button
              type="button"
              className="cl-agregar-btn"
              onClick={() => navigate(clientesCcPerfil(creadoId))}
            >
              Cuenta corriente
            </button>
            <button type="button" className="cl-agregar-btn cl-agregar-btn--ghost" onClick={resetForm}>
              Agregar otro
            </button>
          </div>
        </div>
      ) : (
        <form className="cl-agregar-form" onSubmit={(e) => void handleSubmit(e)}>
          <div className="cl-agregar-grid">
            <label>
              Nombre <span className="cl-agregar-req">*</span>
              <input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Juan"
                autoComplete="given-name"
              />
            </label>
            <label>
              Apellido
              <input
                value={apellido}
                onChange={(e) => setApellido(e.target.value)}
                placeholder="Pérez"
                autoComplete="family-name"
              />
            </label>
            <label className="cl-agregar-span2">
              Empresa / razón social
              <input
                value={empresa}
                onChange={(e) => setEmpresa(e.target.value)}
                placeholder="Plot Center S.A."
              />
            </label>
            <label>
              DNI / CUIT
              <input
                value={dniCuit}
                onChange={(e) => setDniCuit(e.target.value)}
                placeholder="20-12345678-9"
              />
            </label>
            <label>
              Teléfono / WhatsApp
              <input
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                placeholder="+54 9 …"
                type="tel"
              />
            </label>
            <label>
              Email
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="cliente@empresa.com"
                type="email"
              />
            </label>
            <label className="cl-agregar-span2">
              Dirección
              <input
                value={direccion}
                onChange={(e) => setDireccion(e.target.value)}
                placeholder="Calle, número, localidad"
              />
            </label>
          </div>

          <p className="cl-agregar-hint">
            <span className="cl-agregar-req">*</span> Nombre o empresa obligatorio. Para cuenta corriente
            fiscal usá el módulo CC después del alta.
          </p>

          {error && (
            <p className="cl-agregar-error" role="alert">
              {error}
            </p>
          )}

          <div className="cl-agregar-actions">
            <button type="submit" className="cl-agregar-btn cl-agregar-btn--primary" disabled={loading}>
              {loading ? 'Guardando…' : 'Guardar cliente'}
            </button>
            <button
              type="button"
              className="cl-agregar-btn cl-agregar-btn--ghost"
              onClick={() => navigate(CLIENTES_DASHBOARD)}
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

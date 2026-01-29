import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import apiService from '../services/api'
import type { ClienteRecord } from '../types/api'
import './CuentaCorrientePage.css'

const CuentaCorrientePage = () => {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [clientes, setClientes] = useState<ClienteRecord[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [resultadosBusqueda, setResultadosBusqueda] = useState<ClienteRecord[]>([])
  const [buscando, setBuscando] = useState(false)
  const [showAgregar, setShowAgregar] = useState(false)
  const [agregandoId, setAgregandoId] = useState<number | null>(null)
  const [quitandoId, setQuitandoId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadClientes = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiService.listClientesCuentaCorriente()
      if (res.success && res.data) setClientes(res.data)
      else setError(res.error || 'Error al cargar')
    } catch (e) {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadClientes()
  }, [])

  useEffect(() => {
    if (busqueda.trim().length < 2) {
      setResultadosBusqueda([])
      return
    }
    const t = setTimeout(async () => {
      setBuscando(true)
      try {
        const res = await apiService.buscarClientes(busqueda.trim())
        if (res.success && res.data) {
          const idsEnLista = new Set(clientes.map((c) => c.id))
          setResultadosBusqueda(res.data.filter((c) => !idsEnLista.has(c.id)))
        } else setResultadosBusqueda([])
      } catch {
        setResultadosBusqueda([])
      } finally {
        setBuscando(false)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [busqueda, clientes.length])

  const agregar = async (cliente: ClienteRecord) => {
    setAgregandoId(cliente.id)
    setError(null)
    try {
      const res = await apiService.agregarClienteCuentaCorriente(cliente.id)
      if (res.success) {
        setClientes((prev) => [cliente, ...prev])
        setBusqueda('')
        setResultadosBusqueda([])
        setShowAgregar(false)
      } else setError(res.error || 'Error al agregar')
    } catch {
      setError('Error al agregar')
    } finally {
      setAgregandoId(null)
    }
  }

  const quitar = async (idCliente: number) => {
    if (!confirm('¿Quitar a este cliente de Cuenta Corriente?')) return
    setQuitandoId(idCliente)
    setError(null)
    try {
      const res = await apiService.quitarClienteCuentaCorriente(idCliente)
      if (res.success) setClientes((prev) => prev.filter((c) => c.id !== idCliente))
      else setError(res.error || 'Error al quitar')
    } catch {
      setError('Error al quitar')
    } finally {
      setQuitandoId(null)
    }
  }

  if (loading) {
    return (
      <div className="cuenta-corriente-page">
        <div className="cuenta-corriente-loading">
          <div className="cuenta-corriente-spinner" />
          <p>Cargando clientes con cuenta corriente...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="cuenta-corriente-page">
      <header className="cuenta-corriente-header">
        <div className="cuenta-corriente-header-content">
          <div>
            <h1>📒 Cuenta Corriente</h1>
            <p className="cuenta-corriente-subtitle">
              Clientes habilitados para comprar a cuenta corriente en Mostrador. {clientes.length}{' '}
              {clientes.length === 1 ? 'cliente' : 'clientes'}.
            </p>
          </div>
          <div className="cuenta-corriente-header-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => navigate('/mostrador/dashboard')}
            >
              ← Volver al Dashboard
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                setShowAgregar((prev) => !prev)
                setBusqueda('')
                setResultadosBusqueda([])
              }}
            >
              ➕ Agregar cliente
            </button>
          </div>
        </div>
      </header>

      {error && (
        <div className="cuenta-corriente-error">
          {error}
          <button type="button" onClick={() => setError(null)} aria-label="Cerrar">
            ✕
          </button>
        </div>
      )}

      {showAgregar && (
        <section className="cuenta-corriente-agregar">
          <label className="cuenta-corriente-agregar-label">Buscar cliente para agregar</label>
          <div className="cuenta-corriente-busqueda">
            <input
              type="text"
              placeholder="Nombre, DNI, teléfono o email..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="cuenta-corriente-input"
              autoFocus
            />
            {buscando && <span className="cuenta-corriente-buscando">Buscando...</span>}
          </div>
          {resultadosBusqueda.length > 0 && (
            <ul className="cuenta-corriente-resultados">
              {resultadosBusqueda.map((c) => (
                <li key={c.id} className="cuenta-corriente-resultado-item">
                  <div className="cuenta-corriente-resultado-info">
                    <strong>{c.nombre}</strong>
                    {c.telefono && <span>📞 {c.telefono}</span>}
                    {c.email && <span>✉️ {c.email}</span>}
                    {c.dni_cuit && <span>DNI/CUIT: {c.dni_cuit}</span>}
                  </div>
                  <button
                    type="button"
                    className="btn-small btn-primary"
                    onClick={() => agregar(c)}
                    disabled={agregandoId === c.id}
                  >
                    {agregandoId === c.id ? 'Agregando...' : 'Agregar'}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {busqueda.trim().length >= 2 && !buscando && resultadosBusqueda.length === 0 && (
            <p className="cuenta-corriente-sin-resultados">
              No se encontraron clientes o ya están en la lista.
            </p>
          )}
        </section>
      )}

      <section className="cuenta-corriente-lista">
        <h2>Clientes con acceso a Cuenta Corriente</h2>
        {clientes.length === 0 ? (
          <div className="cuenta-corriente-empty">
            <p>No hay clientes con cuenta corriente. Agregá clientes con el botón de arriba.</p>
          </div>
        ) : (
          <ul className="cuenta-corriente-cards">
            {clientes.map((c) => (
              <li key={c.id} className="cuenta-corriente-card">
                <div className="cuenta-corriente-card-content">
                  <strong className="cuenta-corriente-card-nombre">{c.nombre}</strong>
                  {c.empresa && <span className="cuenta-corriente-card-empresa">{c.empresa}</span>}
                  {c.telefono && <span>📞 {c.telefono}</span>}
                  {c.email && <span>✉️ {c.email}</span>}
                  {c.dni_cuit && <span>DNI/CUIT: {c.dni_cuit}</span>}
                </div>
                <button
                  type="button"
                  className="btn-small btn-danger"
                  onClick={() => quitar(c.id)}
                  disabled={quitandoId === c.id}
                  title="Quitar de cuenta corriente"
                >
                  {quitandoId === c.id ? '...' : 'Quitar'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

export default CuentaCorrientePage

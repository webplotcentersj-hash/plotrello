import { useState, useEffect } from 'react'
import type { ClienteWebRecord } from '../types/api'

export function useClienteAuth() {
  const [cliente, setCliente] = useState<ClienteWebRecord | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Cargar cliente desde localStorage
    const clienteStr = localStorage.getItem('cliente_web')
    if (clienteStr) {
      try {
        const clienteData = JSON.parse(clienteStr)
        setCliente(clienteData)
      } catch (error) {
        console.error('Error al parsear cliente:', error)
        localStorage.removeItem('cliente_web')
      }
    }
    setLoading(false)
  }, [])

  const login = (clienteData: ClienteWebRecord) => {
    console.log('useClienteAuth.login llamado con:', clienteData)
    setCliente(clienteData)
    localStorage.setItem('cliente_web', JSON.stringify(clienteData))
    console.log('Cliente guardado en localStorage')
  }

  const logout = () => {
    setCliente(null)
    localStorage.removeItem('cliente_web')
  }

  return {
    cliente,
    loading,
    login,
    logout,
    isAuthenticated: !!cliente
  }
}


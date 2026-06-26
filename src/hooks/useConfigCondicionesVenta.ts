import { useCallback, useEffect, useState } from 'react'
import apiService from '../services/api'
import {
  DEFAULT_CONFIG_CONDICIONES_VENTA,
  normalizarConfigCondicionesVenta,
  type ConfigCondicionesVenta
} from '../constants/ventasCondicionesPago'

export function useConfigCondicionesVenta() {
  const [config, setConfig] = useState<ConfigCondicionesVenta>(DEFAULT_CONFIG_CONDICIONES_VENTA)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiService.getConfiguracionCondicionesVenta()
      if (res.success && res.data) {
        setConfig(normalizarConfigCondicionesVenta(res.data))
      } else if (res.error) {
        setError(res.error)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar condiciones de venta')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const guardar = useCallback(async (next: ConfigCondicionesVenta) => {
    setSaving(true)
    setError(null)
    try {
      const res = await apiService.guardarConfiguracionCondicionesVenta(next)
      if (res.success && res.data) {
        const normalizado = normalizarConfigCondicionesVenta(res.data)
        setConfig(normalizado)
        return true
      }
      setError(res.error || 'No se pudo guardar')
      return false
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar')
      return false
    } finally {
      setSaving(false)
    }
  }, [])

  return { config, loading, saving, error, cargar, guardar }
}

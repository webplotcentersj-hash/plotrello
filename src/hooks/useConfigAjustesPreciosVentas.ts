import { useCallback, useEffect, useState } from 'react'
import apiService from '../services/api'
import {
  DEFAULT_AJUSTES_PRECIOS_VENTAS,
  normalizarConfigAjustesPrecios,
  type ConfigAjustesPreciosVentas
} from '../constants/ventasListasPrecio'

export function useConfigAjustesPreciosVentas() {
  const [ajustes, setAjustes] = useState<ConfigAjustesPreciosVentas>(DEFAULT_AJUSTES_PRECIOS_VENTAS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiService.getConfiguracionPreciosVentas()
      if (res.success && res.data) {
        setAjustes(normalizarConfigAjustesPrecios(res.data))
      } else if (res.error) {
        setError(res.error)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar ajustes')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const guardar = useCallback(async (next: ConfigAjustesPreciosVentas) => {
    setSaving(true)
    setError(null)
    try {
      const payload = normalizarConfigAjustesPrecios(next)
      const res = await apiService.guardarConfiguracionPreciosVentas(payload)
      if (!res.success || !res.data) throw new Error(res.error || 'No se guardó la configuración')
      setAjustes(normalizarConfigAjustesPrecios(res.data))
      return true
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar')
      return false
    } finally {
      setSaving(false)
    }
  }, [])

  return { ajustes, setAjustes, loading, saving, error, cargar, guardar }
}

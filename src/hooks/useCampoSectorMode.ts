import { useEffect, useMemo, useState } from 'react'
import apiService from '../services/api'
import {
  campoFlagsFromRol,
  mergeCampoSectorFlags,
  resolveCampoListSectorMode,
  type CampoListSectorMode,
  type CampoSectorFlags
} from '../utils/campoSectorAccess'
import { useAuth } from './useAuth'

export function useCampoSectorMode(): {
  mode: CampoListSectorMode
  loading: boolean
  flags: CampoSectorFlags
} {
  const { usuario, isAdmin, loading: authLoading } = useAuth()
  const [dbFlags, setDbFlags] = useState<CampoSectorFlags | null>(null)
  const [dbLoading, setDbLoading] = useState(true)

  useEffect(() => {
    if (!usuario?.id) {
      setDbFlags(null)
      setDbLoading(false)
      return
    }
    let cancelled = false
    setDbLoading(true)
    void apiService.getUsuarioCampoSectores(usuario.id).then((res) => {
      if (cancelled) return
      setDbFlags(res.success && res.data ? res.data : null)
      setDbLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [usuario?.id])

  const flags = useMemo(() => {
    if (isAdmin) return { instalaciones: true, metalurgica: true }
    const fromRol = campoFlagsFromRol(usuario?.rol)
    if (dbFlags) return mergeCampoSectorFlags(fromRol, dbFlags)
    return fromRol
  }, [isAdmin, usuario?.rol, dbFlags])

  const mode = useMemo(() => resolveCampoListSectorMode(flags), [flags])

  return {
    mode,
    loading: authLoading || dbLoading,
    flags
  }
}

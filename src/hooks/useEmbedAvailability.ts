import { useEffect, useState } from 'react'
import { plotLabApiUrl } from '../utils/plotLabApiOrigin'

export type EmbedAvailabilityStatus = 'staff' | 'hours' | 'away'

export type EmbedAvailability = {
  staff_online: boolean
  staff_count: number
  within_business_hours: boolean
  plotai_available: boolean
  status: EmbedAvailabilityStatus
  label: string
  hint: string
  business_hours_label: string
}

const POLL_MS = 45_000

export function useEmbedAvailability(enabled = true) {
  const [availability, setAvailability] = useState<EmbedAvailability | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!enabled) {
      setLoading(false)
      return
    }

    let cancelled = false
    const url = plotLabApiUrl('/api/plotai/embed-availability')

    const load = async () => {
      try {
        const res = await fetch(url)
        const data = await res.json().catch(() => ({}))
        if (cancelled || !res.ok) return
        setAvailability(data as EmbedAvailability)
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    const interval = setInterval(() => void load(), POLL_MS)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [enabled])

  return { availability, loading }
}

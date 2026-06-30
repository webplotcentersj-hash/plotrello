import { useEffect, useRef, useState } from 'react'
import { plotLabApiUrl } from '../utils/plotLabApiOrigin'
import { EMBED_STAFF_POLL_INTERVAL_MS } from '../constants/embedChatSnippet'

export type EmbedStaffReply = {
  autor: string
  texto: string
  created_at?: string
}

type UseEmbedStaffRepliesOptions = {
  enabled?: boolean
  pollIntervalMs?: number
  notifyOnNew?: boolean
  notifyIcon?: string
}

export function useEmbedStaffReplies(
  conversationId: number | null,
  options: UseEmbedStaffRepliesOptions = {}
) {
  const {
    enabled = true,
    pollIntervalMs = EMBED_STAFF_POLL_INTERVAL_MS,
    notifyOnNew = true,
    notifyIcon
  } = options

  const [staffReplies, setStaffReplies] = useState<EmbedStaffReply[]>([])
  const [hasNewStaffReply, setHasNewStaffReply] = useState(false)
  const prevStaffCountRef = useRef(0)
  const respuestasApi = plotLabApiUrl('/api/plotai/conversation-respuestas')

  useEffect(() => {
    if (!enabled || conversationId == null) {
      setStaffReplies([])
      prevStaffCountRef.current = 0
      return
    }

    const fetchRespuestas = async () => {
      try {
        const res = await fetch(`${respuestasApi}?conversation_id=${conversationId}`)
        const data = await res.json().catch(() => ({}))
        if (!Array.isArray(data.respuestas_staff)) return

        const prev = prevStaffCountRef.current
        const next = data.respuestas_staff.length
        setStaffReplies(data.respuestas_staff)

        if (next > prev && prev > 0) {
          setHasNewStaffReply(true)
          if (notifyOnNew) {
            try {
              if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
                new Notification('Plot Center', {
                  body: 'Te respondieron en el chat.',
                  ...(notifyIcon ? { icon: notifyIcon } : {})
                })
              }
            } catch {
              /* ignore */
            }
          }
        }
        prevStaffCountRef.current = next
      } catch {
        /* ignore */
      }
    }

    void fetchRespuestas()
    const interval = setInterval(fetchRespuestas, pollIntervalMs)
    return () => clearInterval(interval)
  }, [enabled, conversationId, pollIntervalMs, notifyOnNew, notifyIcon, respuestasApi])

  const clearNewStaffReply = () => setHasNewStaffReply(false)

  return { staffReplies, hasNewStaffReply, clearNewStaffReply }
}

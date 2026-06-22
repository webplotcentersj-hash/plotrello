import { useCallback, useEffect, useState } from 'react'
import apiService from '../services/api'
import { supabase } from '../services/supabaseClient'
import type { Notification } from '../types/api'
import { useAuth } from './useAuth'

function notificationIsTotemAtencionMostrador(n: Pick<Notification, 'title'>): boolean {
  return (n.title ?? '').trim() === 'Cliente en tótem esperando atención'
}

function countBadgesFromNotifications(notifications: Notification[]): Record<string, number> {
  const unread = notifications.filter((n) => !n.is_read)

  const permisosNotifs = unread.filter((n) => n.solicitud_id != null).length
  const atencionNotifs = unread.filter(
    (n) =>
      n.reclamo_id != null ||
      n.solicitud_chat_id != null ||
      notificationIsTotemAtencionMostrador(n)
  ).length
  const pedidosNotifs = unread.filter((n) => n.pedido_id != null).length

  return {
    permisos: permisosNotifs,
    'atencion-publico': atencionNotifs,
    'solicitar-productos': pedidosNotifs
  }
}

export function useHeaderQuickNavBadges(): Record<string, number> {
  const { usuario, canManageRecursosHumanos, canAccessAtencionPublico } = useAuth()
  const [badges, setBadges] = useState<Record<string, number>>({})

  const refresh = useCallback(async () => {
    if (!usuario?.id) {
      setBadges({})
      return
    }

    const notifRes = await apiService.getUserNotifications(usuario.id, 80)
    const notifications = notifRes.success && notifRes.data ? notifRes.data : []
    const fromNotifs = countBadgesFromNotifications(notifications)

    let permisosPending = 0
    try {
      const permRes = await apiService.obtenerSolicitudesPermisos(
        canManageRecursosHumanos ? null : usuario.id,
        'pendiente',
        null,
        null,
        null
      )
      if (permRes.success && permRes.data) {
        permisosPending = permRes.data.length
      }
    } catch {
      /* ignore */
    }

    let atencionPendientes = 0
    if (canAccessAtencionPublico) {
      try {
        const atRes = await apiService.getAtencionPublicoPendientesCount()
        if (atRes.success && atRes.data) {
          atencionPendientes = atRes.data.total
        }
      } catch {
        /* ignore */
      }
    }

    setBadges({
      ...fromNotifs,
      permisos: Math.max(fromNotifs.permisos ?? 0, permisosPending),
      'atencion-publico': Math.max(fromNotifs['atencion-publico'] ?? 0, atencionPendientes)
    })
  }, [usuario?.id, canManageRecursosHumanos, canAccessAtencionPublico])

  useEffect(() => {
    void refresh()
    const interval = window.setInterval(() => void refresh(), 30_000)
    return () => window.clearInterval(interval)
  }, [refresh])

  useEffect(() => {
    if (!usuario?.id || !supabase) return

    const channel = supabase
      .channel(`quick-nav-badges:${usuario.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'user_notifications',
          filter: `user_id=eq.${usuario.id}`
        },
        (payload) => {
          const n = payload.new as Notification
          void refresh()

          if ('Notification' in window && Notification.permission === 'granted' && !n.is_read) {
            if (n.solicitud_id != null) {
              new Notification(n.title || 'Permisos', {
                body: n.description || 'Novedad en solicitud de permisos',
                tag: `permisos-${n.id}`
              })
            } else if (n.pedido_id != null) {
              new Notification(n.title || 'Pedido de productos', {
                body: n.description || 'Actualización de tu solicitud',
                tag: `pedido-${n.id}`
              })
            } else if (
              n.reclamo_id != null ||
              n.solicitud_chat_id != null ||
              notificationIsTotemAtencionMostrador(n)
            ) {
              new Notification(n.title || 'Atención al público', {
                body: n.description || 'Nueva novedad en atención',
                tag: `atencion-${n.id}`
              })
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_notifications',
          filter: `user_id=eq.${usuario.id}`
        },
        () => void refresh()
      )
      .subscribe()

    return () => {
      if (supabase) void supabase.removeChannel(channel)
    }
  }, [usuario?.id, refresh])

  useEffect(() => {
    if (!canAccessAtencionPublico || !supabase) return

    const channel = supabase
      .channel(`quick-nav-atencion:${Date.now()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'atencion_conversaciones' },
        (payload) => {
          void refresh()
          if (
            payload.eventType === 'INSERT' &&
            'Notification' in window &&
            Notification.permission === 'granted'
          ) {
            const row = payload.new as { cliente_nombre?: string | null; ultimo_mensaje_preview?: string | null }
            new Notification('Nuevo mensaje — Atención al público', {
              body:
                (row.cliente_nombre ? `${row.cliente_nombre}: ` : '') +
                (row.ultimo_mensaje_preview || 'Conversación nueva en el chat web'),
              tag: `atencion-conv-${(payload.new as { id?: number }).id ?? Date.now()}`
            })
          }
        }
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'atencion_reclamos' }, () => {
        void refresh()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'solicitudes_atencion_chat' }, (payload) => {
        void refresh()
        if (
          payload.eventType === 'INSERT' &&
          'Notification' in window &&
          Notification.permission === 'granted'
        ) {
          const row = payload.new as {
            cliente_nombre?: string | null
            sector_solicitado?: string | null
          }
          new Notification('Solicitud de atención en chat', {
            body: `${row.cliente_nombre || 'Cliente'} quiere hablar con ${row.sector_solicitado || 'un sector'}`,
            tag: `atencion-sol-${(payload.new as { id?: number }).id ?? Date.now()}`
          })
        }
      })
      .subscribe()

    return () => {
      if (supabase) void supabase.removeChannel(channel)
    }
  }, [canAccessAtencionPublico, refresh])

  return badges
}

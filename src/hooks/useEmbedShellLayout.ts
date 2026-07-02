import { useEffect } from 'react'

type EmbedShellMode = 'page' | 'widget'

type EmbedShellOptions = {
  /** Widget: solo fijar altura cuando el panel está abierto. */
  active?: boolean
}

/**
 * Fija altura html/body/#app para que el chat embebido ocupe todo el iframe (móvil).
 * Antes se usaba #root por error y el área de mensajes quedaba colapsada.
 */
export function useEmbedShellLayout(mode: EmbedShellMode, options?: EmbedShellOptions) {
  const active = options?.active !== false

  useEffect(() => {
    if (!active) return undefined

    const html = document.documentElement
    const body = document.body
    const app = document.getElementById('app')
    const framed = window.self !== window.top

    const prev = {
      htmlHeight: html.style.height,
      htmlMinHeight: html.style.minHeight,
      htmlOverflow: html.style.overflow,
      bodyHeight: body.style.height,
      bodyMinHeight: body.style.minHeight,
      bodyMargin: body.style.margin,
      bodyPadding: body.style.padding,
      bodyOverflow: body.style.overflow,
      appHeight: app?.style.height ?? '',
      appMinHeight: app?.style.minHeight ?? '',
      appDisplay: app?.style.display ?? '',
      appFlexDirection: app?.style.flexDirection ?? '',
      appOverflow: app?.style.overflow ?? ''
    }

    html.classList.add(mode === 'page' ? 'embed-shell-page' : 'embed-shell-widget')
    if (framed) html.classList.add('embed-shell--framed')

    html.style.height = '100%'
    html.style.minHeight = mode === 'page' ? '100dvh' : '100%'
    html.style.overflow = 'hidden'
    body.style.height = '100%'
    body.style.minHeight = mode === 'page' ? '100dvh' : '100%'
    body.style.margin = '0'
    body.style.padding = '0'
    body.style.overflow = 'hidden'

    if (app) {
      app.style.height = '100%'
      app.style.minHeight = mode === 'page' ? '100dvh' : '100%'
      app.style.display = 'flex'
      app.style.flexDirection = 'column'
      app.style.overflow = 'hidden'
    }

    return () => {
      html.classList.remove('embed-shell-page', 'embed-shell-widget', 'embed-shell--framed')
      html.style.height = prev.htmlHeight
      html.style.minHeight = prev.htmlMinHeight
      html.style.overflow = prev.htmlOverflow
      body.style.height = prev.bodyHeight
      body.style.minHeight = prev.bodyMinHeight
      body.style.margin = prev.bodyMargin
      body.style.padding = prev.bodyPadding
      body.style.overflow = prev.bodyOverflow
      if (app) {
        app.style.height = prev.appHeight
        app.style.minHeight = prev.appMinHeight
        app.style.display = prev.appDisplay
        app.style.flexDirection = prev.appFlexDirection
        app.style.overflow = prev.appOverflow
      }
    }
  }, [mode, active])
}

export function isEmbedFramed(): boolean {
  return typeof window !== 'undefined' && window.self !== window.top
}

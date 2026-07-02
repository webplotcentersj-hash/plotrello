import { useEffect } from 'react'

type EmbedShellMode = 'page' | 'widget'

type EmbedShellOptions = {
  /** Widget: solo fijar altura cuando el panel está abierto. */
  active?: boolean
}

function syncEmbedViewportHeight() {
  const h = window.visualViewport?.height ?? window.innerHeight
  document.documentElement.style.setProperty('--embed-vh', `${Math.round(h)}px`)
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
    const isPage = mode === 'page'

    const prev = {
      htmlHeight: html.style.height,
      htmlMinHeight: html.style.minHeight,
      htmlOverflow: html.style.overflow,
      htmlPosition: html.style.position,
      htmlWidth: html.style.width,
      htmlTop: html.style.top,
      htmlLeft: html.style.left,
      bodyHeight: body.style.height,
      bodyMinHeight: body.style.minHeight,
      bodyMargin: body.style.margin,
      bodyPadding: body.style.padding,
      bodyOverflow: body.style.overflow,
      bodyPosition: body.style.position,
      bodyWidth: body.style.width,
      bodyTop: body.style.top,
      bodyLeft: body.style.left,
      appHeight: app?.style.height ?? '',
      appMinHeight: app?.style.minHeight ?? '',
      appDisplay: app?.style.display ?? '',
      appFlexDirection: app?.style.flexDirection ?? '',
      appOverflow: app?.style.overflow ?? ''
    }

    html.classList.add(isPage ? 'embed-shell-page' : 'embed-shell-widget')
    if (framed) html.classList.add('embed-shell--framed')

    if (isPage) {
      syncEmbedViewportHeight()
      window.visualViewport?.addEventListener('resize', syncEmbedViewportHeight)
      window.visualViewport?.addEventListener('scroll', syncEmbedViewportHeight)
      window.addEventListener('resize', syncEmbedViewportHeight)
      html.style.position = 'fixed'
      html.style.width = '100%'
      html.style.top = '0'
      html.style.left = '0'
      body.style.position = 'fixed'
      body.style.width = '100%'
      body.style.top = '0'
      body.style.left = '0'
    }

    html.style.height = isPage ? 'var(--embed-vh, 100svh)' : '100%'
    html.style.minHeight = isPage ? 'var(--embed-vh, 100svh)' : '100%'
    html.style.overflow = 'hidden'
    body.style.height = isPage ? 'var(--embed-vh, 100svh)' : '100%'
    body.style.minHeight = isPage ? 'var(--embed-vh, 100svh)' : '100%'
    body.style.margin = '0'
    body.style.padding = '0'
    body.style.overflow = 'hidden'

    if (app) {
      app.style.height = isPage ? 'var(--embed-vh, 100svh)' : '100%'
      app.style.minHeight = isPage ? 'var(--embed-vh, 100svh)' : '100%'
      app.style.display = 'flex'
      app.style.flexDirection = 'column'
      app.style.overflow = 'hidden'
    }

    return () => {
      if (isPage) {
        window.visualViewport?.removeEventListener('resize', syncEmbedViewportHeight)
        window.visualViewport?.removeEventListener('scroll', syncEmbedViewportHeight)
        window.removeEventListener('resize', syncEmbedViewportHeight)
        html.style.removeProperty('--embed-vh')
      }
      html.classList.remove('embed-shell-page', 'embed-shell-widget', 'embed-shell--framed')
      html.style.height = prev.htmlHeight
      html.style.minHeight = prev.htmlMinHeight
      html.style.overflow = prev.htmlOverflow
      html.style.position = prev.htmlPosition
      html.style.width = prev.htmlWidth
      html.style.top = prev.htmlTop
      html.style.left = prev.htmlLeft
      body.style.height = prev.bodyHeight
      body.style.minHeight = prev.bodyMinHeight
      body.style.margin = prev.bodyMargin
      body.style.padding = prev.bodyPadding
      body.style.overflow = prev.bodyOverflow
      body.style.position = prev.bodyPosition
      body.style.width = prev.bodyWidth
      body.style.top = prev.bodyTop
      body.style.left = prev.bodyLeft
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

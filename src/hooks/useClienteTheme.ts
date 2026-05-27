import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

export type ClienteTheme = 'light' | 'dark'

const STORAGE_KEY = 'plotrello-cliente-theme'

function readInitialTheme(): ClienteTheme {
  if (typeof window === 'undefined') return 'light'
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'dark' || stored === 'light') return stored
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyThemeToDom(theme: ClienteTheme) {
  document.querySelectorAll('[data-cliente-theme-scope]').forEach((el) => {
    el.setAttribute('data-cliente-theme', theme)
  })
}

type ClienteThemeContextValue = {
  theme: ClienteTheme
  isDark: boolean
  toggle: () => void
  setTheme: (t: ClienteTheme) => void
}

export const ClienteThemeContext = createContext<ClienteThemeContextValue | null>(null)

export function useClienteThemeProviderValue(): ClienteThemeContextValue {
  const [theme, setThemeState] = useState<ClienteTheme>(readInitialTheme)

  const setTheme = useCallback((t: ClienteTheme) => {
    setThemeState(t)
    localStorage.setItem(STORAGE_KEY, t)
  }, [])

  const toggle = useCallback(() => {
    setThemeState((prev) => {
      const next = prev === 'light' ? 'dark' : 'light'
      localStorage.setItem(STORAGE_KEY, next)
      return next
    })
  }, [])

  useEffect(() => {
    applyThemeToDom(theme)
  }, [theme])

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && (e.newValue === 'dark' || e.newValue === 'light')) {
        setThemeState(e.newValue)
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  return useMemo(
    () => ({
      theme,
      isDark: theme === 'dark',
      toggle,
      setTheme
    }),
    [theme, toggle, setTheme]
  )
}

export function useClienteTheme(): ClienteThemeContextValue {
  const ctx = useContext(ClienteThemeContext)
  if (!ctx) {
    const theme = readInitialTheme()
    return {
      theme,
      isDark: theme === 'dark',
      toggle: () => {},
      setTheme: () => {}
    }
  }
  return ctx
}

/** Para login (fuera del provider): aplica tema guardado al montar */
export function useClienteThemeScope() {
  const [theme] = useState<ClienteTheme>(readInitialTheme)
  useEffect(() => {
    applyThemeToDom(theme)
  }, [theme])
  return theme
}

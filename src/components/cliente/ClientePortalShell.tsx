import type { ReactNode } from 'react'
import { ClienteThemeContext, useClienteThemeProviderValue } from '../../hooks/useClienteTheme'
import ClientePillNav from './ClientePillNav'
import ClientePortalFooter from './ClientePortalFooter'
import '../../styles/clientePortalTheme.css'
import '../../styles/clientePortalPages.css'
import './ClientePortalShell.css'

type Props = {
  children: ReactNode
}

export default function ClientePortalShell({ children }: Props) {
  const themeValue = useClienteThemeProviderValue()

  return (
    <ClienteThemeContext.Provider value={themeValue}>
      <div
        className="cliente-portal-root"
        data-cliente-theme-scope
        data-cliente-theme={themeValue.theme}
      >
        <ClientePillNav />
        <main className="cliente-portal-main">{children}</main>
        <ClientePortalFooter />
      </div>
    </ClienteThemeContext.Provider>
  )
}

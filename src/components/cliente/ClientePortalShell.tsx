import type { ReactNode } from 'react'
import ClientePillNav from './ClientePillNav'
import ClientePortalFooter from './ClientePortalFooter'
import '../../styles/clientePortalTheme.css'
import '../../styles/clientePortalPages.css'
import './ClientePortalShell.css'

type Props = {
  children: ReactNode
}

export default function ClientePortalShell({ children }: Props) {
  return (
    <div className="cliente-portal-root">
      <ClientePillNav />
      <main className="cliente-portal-main">{children}</main>
      <ClientePortalFooter />
    </div>
  )
}

import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'
import { useClienteTheme } from '../../hooks/useClienteTheme'
import '../../styles/clientePortalTheme.css'
import '../../styles/clientePortalModals.css'

type Props = {
  children: ReactNode
}

/** Portal a body con variables de tema cliente (modales fuera de .cliente-portal-root). */
export default function ClienteModalPortal({ children }: Props) {
  const { theme } = useClienteTheme()

  return createPortal(
    <div
      className="cliente-modal-portal"
      data-cliente-theme-scope
      data-cliente-theme={theme}
    >
      {children}
    </div>,
    document.body
  )
}

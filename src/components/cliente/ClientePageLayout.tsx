import type { ReactNode } from 'react'

type Props = {
  children: ReactNode
  className?: string
}

/** Contenedor estándar de cada pestaña del portal (dentro del shell con pill nav). */
export default function ClientePageLayout({ children, className = '' }: Props) {
  return (
    <div className={`cliente-page ${className}`.trim()}>
      <div className="cliente-container cliente-page-inner">{children}</div>
    </div>
  )
}

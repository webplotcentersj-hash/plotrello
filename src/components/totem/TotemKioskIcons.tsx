import type { ReactNode } from 'react'

export type TotemKioskIconName =
  | 'search'
  | 'print'
  | 'catalog'
  | 'presupuestos'
  | 'recepcion'
  | 'diseno'
  | 'caja'
  | 'base_operaciones'
  | 'marketing'

const ICONS: Record<TotemKioskIconName, ReactNode> = {
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M20 20l-4.2-4.2" />
    </>
  ),
  print: (
    <>
      <path d="M7 8V4h10v4" />
      <rect x="5" y="8" width="14" height="9" rx="2" />
      <path d="M7 14h10v6H7z" />
      <path d="M9 11h1.5M14.5 11H16" />
    </>
  ),
  catalog: (
    <>
      <path d="M7 10V7a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v3" />
      <path d="M5 10h14l-1.2 9H6.2L5 10z" />
      <path d="M10 14h4" />
    </>
  ),
  presupuestos: (
    <>
      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
      <rect x="9" y="3" width="6" height="4" rx="1" />
      <path d="M9 12h6M9 16h4" />
    </>
  ),
  recepcion: (
    <>
      <path d="M12 3l8 5v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V8l8-5z" />
      <path d="M9 14h6M12 11v6" />
    </>
  ),
  diseno: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M12 12v2" />
      <path d="M6 20c1.5-3 4-4.5 6-4.5s4.5 1.5 6 4.5" />
      <path d="M4 8h2M18 8h2M12 4V2" />
    </>
  ),
  caja: (
    <>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M3 10h18" />
      <path d="M7 15h4" />
    </>
  ),
  base_operaciones: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  marketing: (
    <>
      <path d="M4 10v4l12 4V6L4 10z" />
      <path d="M18 8v8" />
      <path d="M20 10v4" />
    </>
  )
}

type TotemKioskIconProps = {
  name: TotemKioskIconName
  size?: 'tile' | 'strip'
  className?: string
}

export function TotemKioskIcon({ name, size = 'tile', className }: TotemKioskIconProps) {
  const dim = size === 'tile' ? 30 : 22
  return (
    <svg
      className={`totem-kiosk-svg totem-kiosk-svg--${size}${className ? ` ${className}` : ''}`}
      width={dim}
      height={dim}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.85"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {ICONS[name]}
    </svg>
  )
}

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
  | 'cart'
  | 'box'
  | 'clock'
  | 'trash'
  | 'check'
  | 'phone'
  | 'chat'
  | 'cloud'
  | 'email'
  | 'usb'

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
  ),
  cart: (
    <>
      <path d="M3 4h2l2.4 12.2a2 2 0 0 0 2 1.6h7.6a2 2 0 0 0 2-1.6L21 8H6" />
      <circle cx="9.5" cy="20" r="1.4" />
      <circle cx="17.5" cy="20" r="1.4" />
    </>
  ),
  box: (
    <>
      <path d="M3 8l9-5 9 5-9 5-9-5z" />
      <path d="M3 8v9l9 5 9-5V8" />
      <path d="M12 13v9" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  trash: (
    <>
      <path d="M4 7h16" />
      <path d="M9 7V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V7" />
      <path d="M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" />
      <path d="M10 11v6M14 11v6" />
    </>
  ),
  check: <path d="M5 12.5l4.5 4.5L19 7" />,
  phone: (
    <>
      <rect x="7" y="2.2" width="10" height="19.6" rx="2.2" />
      <path d="M11 18.2h2" />
    </>
  ),
  chat: <path d="M4 12a8 8 0 1 1 3.1 6.3L4 20l1.4-4A7.96 7.96 0 0 1 4 12z" />,
  cloud: <path d="M7 18a4.5 4.5 0 0 1-1-8.9 5.5 5.5 0 0 1 10.6-2A4 4 0 0 1 17 18H7z" />,
  email: (
    <>
      <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
      <path d="M4 7l8 6 8-6" />
    </>
  ),
  usb: (
    <>
      <rect x="9" y="2.5" width="6" height="6" rx="1.4" />
      <path d="M12 8.5v3" />
      <path d="M8.4 15h7.2l-1 4.5h-5.2z" />
      <path d="M9.2 11.5h5.6l-1 4.5h-3.6z" />
    </>
  )
}

type TotemKioskIconProps = {
  name: TotemKioskIconName
  size?: 'tile' | 'strip' | 'lg'
  className?: string
}

export function TotemKioskIcon({ name, size = 'tile', className }: TotemKioskIconProps) {
  const dim = size === 'lg' ? 38 : size === 'tile' ? 30 : 22
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

import type { LucideIcon } from 'lucide-react'
import {
  Bell,
  HelpCircle,
  Home,
  Search,
  ShoppingBag,
  ShoppingCart
} from 'lucide-react'

export type ClienteNavBadge = 'carrito' | 'notificaciones'

export type ClienteNavItem = {
  label: string
  href: string
  Icon: LucideIcon
  badge?: ClienteNavBadge
}

export const CLIENTE_NAV_ITEMS: ClienteNavItem[] = [
  { label: 'Inicio', href: '/cliente/dashboard', Icon: Home },
  { label: 'Catálogo', href: '/cliente/catalogo', Icon: ShoppingBag },
  { label: 'Carrito', href: '/cliente/carrito', Icon: ShoppingCart, badge: 'carrito' },
  { label: 'Buscar OP', href: '/cliente/buscar-op', Icon: Search },
  { label: 'Avisos', href: '/cliente/notificaciones', Icon: Bell, badge: 'notificaciones' },
  { label: 'Ayuda', href: '/cliente/ayuda', Icon: HelpCircle }
]

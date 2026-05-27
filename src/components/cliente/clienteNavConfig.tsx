import type { LucideIcon } from 'lucide-react'
import {
  HelpCircle,
  Home,
  PackagePlus,
  Search,
  ShoppingBag
} from 'lucide-react'

export type ClienteNavItem = {
  label: string
  href: string
  Icon: LucideIcon
}

export const CLIENTE_NAV_ITEMS: ClienteNavItem[] = [
  { label: 'Inicio', href: '/cliente/dashboard', Icon: Home },
  { label: 'Catálogo', href: '/cliente/catalogo', Icon: ShoppingBag },
  { label: 'Pedidos', href: '/cliente/nuevo-pedido', Icon: PackagePlus },
  { label: 'Buscar OP', href: '/cliente/buscar-op', Icon: Search },
  { label: 'Ayuda', href: '/cliente/ayuda', Icon: HelpCircle }
]

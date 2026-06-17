export const PHI_BRAND = {
  name: 'phi',
  symbol: 'φ',
  fullName: 'phi · Plot Design',
  tagline: 'Red de diseñadores externos de Plot Center',
  accent: '#a855f7',
  accentAlt: '#eb671b'
} as const

export function phiAsset(path: string): string {
  const clean = path.replace(/^\//, '')
  return `/phi/${clean}`
}

export const PHI_NAV_LINKS = [
  { id: 'inicio', label: 'Inicio' },
  { id: 'servicios', label: 'Servicios' },
  { id: 'nosotros', label: 'Nosotros' },
  { id: 'portfolio', label: 'Trabajos' }
] as const

export const PHI_SERVICES = [
  {
    title: 'Diseño gráfico',
    description:
      'Piezas para cartelería, packaging, folletos y piezas comerciales con estándares Plot Center.',
    image: 'images/web-design.svg'
  },
  {
    title: 'Branding & identidad',
    description: 'Logos, manuales de marca y sistemas visuales para clientes de la red Plot.',
    image: 'images/ui-ux-design.svg'
  },
  {
    title: 'Preprensa & archivos',
    description: 'Armado técnico, perfiles de color y archivos listos para producción en taller.',
    image: 'images/product-design.svg'
  },
  {
    title: 'Vectorización',
    description: 'Retoque, trazado y adaptación de artes para gran formato e impresión.',
    image: 'images/user-research.svg'
  },
  {
    title: 'Motion & piezas digitales',
    description: 'Animaciones cortas, redes y piezas para pantallas y campañas digitales.',
    image: 'images/motion-graphics.svg'
  }
] as const

export const PHI_PORTFOLIO = [
  {
    title: 'Cartelería comercial — retail',
    description:
      'Desarrollo de línea gráfica, adaptación a múltiples formatos y entrega en bolsa Plot Design.',
    tag: 'Cartelería',
    logo: 'images/studio-logo.svg',
    bgClass: 'phi-portfolio-card--violet',
    illustration: 'images/studio-workspace.svg'
  },
  {
    title: 'Identidad visual — emprendimiento',
    description:
      'Logo, paleta y piezas base entregadas con brief desde el portal y revisión del equipo interno.',
    tag: 'Branding',
    logo: 'images/venture-logo.svg',
    bgClass: 'phi-portfolio-card--blue',
    illustration: 'images/venture-workspace.svg'
  }
] as const

export const PHI_ABOUT_BULLETS = [
  {
    color: '#6366f1',
    title: 'Bolsa creativa en vivo',
    text: 'Tomá trabajos desde la bolsa, seguí estados y cobrá con trazabilidad en Plot Lab.'
  },
  {
    color: '#ff6b7a',
    title: 'Briefs claros desde Plot',
    text: 'Cada pedido llega con contexto, plazos y archivos de referencia del cliente o mostrador.'
  }
] as const

export type PlotCenterDesignTool = {
  id: string
  title: string
  description: string
  icon: string
  url: string
  host: string
}

export const PLOT_CENTER_DESIGN_TOOLS: PlotCenterDesignTool[] = [
  {
    id: 'qr-whatsapp',
    title: 'Generador QR / Link WhatsApp',
    description: 'Crear enlace de WhatsApp y código QR para escanear.',
    icon: '📱',
    url: 'https://qr.plotcenter.com.ar/',
    host: 'qr.plotcenter.com.ar'
  },
  {
    id: 'generador-qr',
    title: 'Generador de Códigos QR',
    description: 'QR con URL o texto, color personalizable y descarga de imagen.',
    icon: '📷',
    url: 'https://generadorqr.plotcenter.com.ar/',
    host: 'generadorqr.plotcenter.com.ar'
  },
  {
    id: 'wcag',
    title: 'Verificador de Contraste WCAG',
    description: 'Ratio de contraste y cumplimiento de accesibilidad (WCAG 2.1).',
    icon: '♿',
    url: 'https://wcag.plotcenter.com.ar/',
    host: 'wcag.plotcenter.com.ar'
  },
  {
    id: 'resizer',
    title: 'Studio Resizer Pro',
    description: 'Redimensionar y exportar diseños a múltiples formatos.',
    icon: '🖼️',
    url: 'https://resizer.plotcenter.com.ar/',
    host: 'resizer.plotcenter.com.ar'
  },
  {
    id: 'extractor',
    title: 'Color Intelligence Studio',
    description: 'Extraer paletas, HEX/RGB/CMYK y armonías cromáticas.',
    icon: '🎨',
    url: 'https://extractor.plotcenter.com.ar/',
    host: 'extractor.plotcenter.com.ar'
  }
]

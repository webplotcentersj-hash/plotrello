import { StudioView, type StudioNavItem } from './types'

export const STUDIO_PRIMARY = '#eb671b'

export const STUDIO_NAV: StudioNavItem[] = [
  {
    id: StudioView.DASHBOARD,
    label: 'Panel principal',
    icon: '🏠',
    description: 'Accesos a todas las herramientas creativas con Gemini.'
  },
  {
    id: StudioView.CHATBOT,
    label: 'Asistente de chat',
    icon: '💬',
    description: 'Brainstorming, textos y consultas creativas.'
  },
  {
    id: StudioView.IMAGE_GEN,
    label: 'Generador de imágenes',
    icon: '🖼️',
    description: 'Crear piezas visuales desde una descripción.'
  },
  {
    id: StudioView.IMAGE_EDIT,
    label: 'Editor de imágenes',
    icon: '✨',
    description: 'Modificar imágenes con instrucciones en texto.'
  },
  {
    id: StudioView.VIDEO_GEN,
    label: 'Generador de videos',
    icon: '🎬',
    description: 'Videos cortos para redes (Veo, si está habilitado).'
  },
  {
    id: StudioView.COMPLEX_TASK,
    label: 'Análisis profundo',
    icon: '🧠',
    description: 'Estrategias, guiones y briefs detallados con Gemini Pro.'
  },
  {
    id: StudioView.SEARCH,
    label: 'Búsqueda en tiempo real',
    icon: '🔍',
    description: 'Información actualizada de la web para tu contenido.'
  },
  {
    id: StudioView.TTS,
    label: 'Texto a voz',
    icon: '🔊',
    description: 'Locuciones para videos o presentaciones.'
  }
]

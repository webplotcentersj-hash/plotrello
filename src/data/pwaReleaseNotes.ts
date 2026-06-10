/**
 * Notas de la versión actual — actualizar este archivo en cada deploy importante.
 * El texto está pensado para empleados sin conocimientos técnicos.
 */
export type PwaReleaseImprovement = {
  icon: string
  title: string
  description: string
}

export type PwaReleaseGuideStep = {
  title: string
  description: string
}

export type PwaReleaseNotes = {
  /** Identificador único de esta versión (cambiar en cada release). */
  id: string
  /** Etiqueta visible, ej. "Junio 2026". */
  label: string
  /** Título corto del modal. */
  title: string
  /** Resumen en una oración. */
  summary: string
  improvements: PwaReleaseImprovement[]
  guideSteps: PwaReleaseGuideStep[]
}

export const CURRENT_PWA_RELEASE: PwaReleaseNotes = {
  id: '2026-06-10',
  label: 'Junio 2026',
  title: '¡PLOT se actualizó!',
  summary:
    'Instalamos mejoras para que trabajes más cómodo: mensajes entre compañeros, actualizaciones más claras y archivos adjuntos.',
  improvements: [
    {
      icon: '💬',
      title: 'Mensajería entre compañeros',
      description:
        'Ahora cualquier empleado puede escribirse con otro desde el menú Mensajería. Podés adjuntar archivos y bajar una prueba del mensaje si la necesitás.'
    },
    {
      icon: '⟳',
      title: 'Actualizaciones más claras',
      description:
        'El botón del encabezado te avisa cuando hay una versión nueva. Esta ventana te explica qué cambió y cómo usarlo.'
    },
    {
      icon: '📎',
      title: 'Archivos en los mensajes',
      description:
        'Podés enviar fotos o documentos en un chat privado. Los archivos no se descargan solos: vos elegís cuándo bajarlos.'
    },
    {
      icon: '📖',
      title: 'Guía descargable',
      description:
        'Podés guardar esta guía en tu computadora o celular para consultarla cuando quieras, sin necesidad de internet.'
    }
  ],
  guideSteps: [
    {
      title: 'Abrir Mensajería',
      description:
        'En la barra superior del tablero, entrá al menú ☰ y elegí «Mensajería». También podés buscarla en el menú de navegación.'
    },
    {
      title: 'Escribir a un compañero',
      description:
        'Tocá «Nuevo mensaje», buscá por nombre o sector y elegí a la persona. Se abre el chat privado.'
    },
    {
      title: 'Enviar texto o archivos',
      description:
        'Escribí en el cuadro de abajo y tocá Enviar. Para adjuntar, usá el botón 📎. Enter envía; Shift+Enter hace un salto de línea.'
    },
    {
      title: 'Ver mensajes anteriores',
      description:
        'Si la conversación es larga, arriba del chat aparece «Ver 5 mensajes anteriores». Tocalo para cargar más.'
    },
    {
      title: 'Actualizar la app',
      description:
        'Si el botón del encabezado dice «Nueva versión», tocá Actualizar en esta ventana o en el botón verde ⟳. La página se recarga sola con la versión nueva.'
    },
    {
      title: 'Descargar esta guía',
      description:
        'Usá el botón «Descargar guía» de abajo. Se guarda un archivo de texto que podés abrir en el Bloc de notas o compartir con tu equipo.'
    }
  ]
}

export const PWA_RELEASE_STORAGE_KEY = 'pwa-release-dismissed-id'
export const PWA_RELEASE_PENDING_KEY = 'pwa-release-show-after-update'

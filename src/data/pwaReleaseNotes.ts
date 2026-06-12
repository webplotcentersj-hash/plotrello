/**
 * Historial de releases PWA — agregar una entrada nueva en cada deploy (solo lo de ESA versión).
 * El modal de actualización muestra únicamente las versiones que el usuario aún no vio.
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
  /** Título corto del modal (post-instalación). */
  title: string
  /** Resumen en una oración — solo esta versión. */
  summary: string
  improvements: PwaReleaseImprovement[]
  /** Opcional: guía paso a paso (solo si hace falta explicar algo nuevo). */
  guideSteps?: PwaReleaseGuideStep[]
}

/** Orden cronológico: la última entrada es la versión desplegada ahora. */
export const PWA_RELEASE_HISTORY: PwaReleaseNotes[] = [
  {
    id: '2026-06-10',
    label: '10 jun 2026',
    title: '¡PLOT se actualizó!',
    summary: 'Mensajería entre compañeros, archivos adjuntos y avisos de actualización más claros.',
    improvements: [
      {
        icon: '💬',
        title: 'Mensajería entre compañeros',
        description:
          'Cualquier empleado puede escribirse con otro desde el menú Mensajería, con archivos adjuntos y prueba del mensaje.'
      },
      {
        icon: '⟳',
        title: 'Actualizaciones más claras',
        description: 'El encabezado avisa cuando hay versión nueva y esta ventana explica qué cambió.'
      },
      {
        icon: '📎',
        title: 'Archivos en los mensajes',
        description: 'Podés enviar fotos o documentos en un chat privado y bajarlos cuando quieras.'
      }
    ],
    guideSteps: [
      {
        title: 'Abrir Mensajería',
        description: 'Menú ☰ → «Mensajería» o desde la navegación rápida del encabezado.'
      },
      {
        title: 'Nuevo mensaje',
        description: 'Buscá por nombre o sector, elegí al compañero y escribí o adjuntá con 📎.'
      }
    ]
  },
  {
    id: '2026-06-11',
    label: '11 jun 2026',
    title: 'Mejoras de caja y mensajería',
    summary:
      'Caja con fondo editable y arqueo según el PDF, mensajería más rápida y menos botones que estorban en pantalla.',
    improvements: [
      {
        icon: '💵',
        title: 'Caja — fondo y arqueo',
        description:
          'El fondo de $100.000 es recomendado y lo ajusta la cajera. Al importar la planilla PDF, el efectivo que queda se ve en el arqueo para contar billetes.'
      },
      {
        icon: '💬',
        title: 'Mensajería más rápida',
        description: 'Entrás directo a tus conversaciones; ya no hace falta esperar la carga completa del equipo.'
      },
      {
        icon: '🧹',
        title: 'Pantallas más limpias',
        description:
          'En Mensajería, Estadísticas y Caja ya no aparecen los botones flotantes de impresoras y solicitudes.'
      },
      {
        icon: '⟳',
        title: 'Actualización estable',
        description: 'Corregimos un problema que dejaba la app en «Cargando aplicación…» después de actualizar.'
      }
    ]
  },
  {
    id: '2026-06-12',
    label: '12 jun 2026',
    title: 'Biblioteca de OPs y PlotBolsa',
    summary:
      'La biblioteca busca en toda la base sin descargar todo, el catálogo completo ya no tiene tope de 2.200 OP y PlotBolsa tiene buscadores al publicar.',
    improvements: [
      {
        icon: '🔍',
        title: 'Biblioteca — búsqueda en servidor',
        description:
          'Con 2+ caracteres o ID de OP buscás en toda la base (hasta 50 resultados). Ya no hace falta bajar el catálogo entero para encontrar una ficha.'
      },
      {
        icon: '📚',
        title: 'Catálogo completo sin tope',
        description:
          '«Actualizar catálogo completo» descarga todas las OP en páginas livianas, con progreso X / total.'
      },
      {
        icon: '📋',
        title: 'PlotBolsa — publicar con buscadores',
        description:
          'Al publicar en Plot Design / Bolsa Plot: buscador de OP, panel de disponibles, tarifario y empleados.'
      }
    ],
    guideSteps: [
      {
        title: 'Buscar una OP antigua',
        description: 'Tablero → Bibliotecas de OPs → escribí nº OP o cliente (mín. 2 letras) o el ID BD.'
      },
      {
        title: 'Ver todas las fichas',
        description:
          'Si necesitás exportar o filtrar masivamente, usá «Actualizar catálogo completo» y esperá el progreso.'
      }
    ]
  }
]

export const CURRENT_PWA_RELEASE: PwaReleaseNotes =
  PWA_RELEASE_HISTORY[PWA_RELEASE_HISTORY.length - 1]!

export const PWA_RELEASE_STORAGE_KEY = 'pwa-release-dismissed-id'
export const PWA_RELEASE_PENDING_KEY = 'pwa-release-show-after-update'

export function readLastSeenReleaseId(): string | null {
  try {
    return localStorage.getItem(PWA_RELEASE_STORAGE_KEY)
  } catch {
    return null
  }
}

/** Versiones que el usuario aún no marcó como vistas (solo esas se muestran en el modal). */
export function getUnseenReleases(lastSeenId: string | null): PwaReleaseNotes[] {
  if (PWA_RELEASE_HISTORY.length === 0) return []
  if (!lastSeenId) return [CURRENT_PWA_RELEASE]
  const seenIdx = PWA_RELEASE_HISTORY.findIndex((r) => r.id === lastSeenId)
  if (seenIdx < 0) return [CURRENT_PWA_RELEASE]
  const unseen = PWA_RELEASE_HISTORY.slice(seenIdx + 1)
  return unseen.length > 0 ? unseen : [CURRENT_PWA_RELEASE]
}

export type PwaReleaseModalContent = {
  ids: string[]
  label: string
  title: string
  summary: string
  improvements: PwaReleaseImprovement[]
  guideSteps: PwaReleaseGuideStep[]
}

/**
 * Contenido del modal: siempre la última versión desplegada (CURRENT_PWA_RELEASE).
 * El botón ⟳ y el aviso de actualización deben mostrar lo que se instala ahora, no releases viejas acumuladas.
 */
export function getReleaseModalContent(
  _lastSeenId: string | null,
  _mode: 'available' | 'installed'
): PwaReleaseModalContent {
  const latest = CURRENT_PWA_RELEASE

  return {
    ids: [latest.id],
    label: latest.label,
    title: latest.title,
    summary: latest.summary,
    improvements: latest.improvements,
    guideSteps: latest.guideSteps ?? []
  }
}

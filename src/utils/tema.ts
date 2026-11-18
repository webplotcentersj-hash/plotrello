import { activarTemaDiaInline, desactivarTemaDiaInline } from './temaDiaRuntime'

export type Tema = 'dia' | 'noche'

const STORAGE_KEY = 'plotlab:tema'
const TEMA_POR_DEFECTO: Tema = 'noche'
const EVENTO = 'plotlab-tema'

/**
 * Pantallas públicas o de kiosco: tienen su propio diseño (o su propio tema, como
 * el portal de clientes) y siempre se muestran como fueron diseñadas.
 */
const PREFIJOS_SIN_TEMA = [
  '/embed',
  '/totem',
  '/asesor',
  '/disenador',
  '/consulta-cliente',
  '/dashboard-pantallas',
  '/op-public',
  '/firma-cliente',
  '/brief',
  '/reclamos',
  '/presupuesto',
  '/trabaja-con-nosotros',
  '/convocatoria',
  '/encuesta-clima',
  '/phi',
  '/satisfaccion-cliente',
  '/operario-bolsa',
  '/postulacion-operarios',
  '/operario-externo',
  '/cliente',
  '/__docs'
]

export function rutaAdmiteTema(pathname: string): boolean {
  return !PREFIJOS_SIN_TEMA.some((p) => pathname === p || pathname.startsWith(p + '/'))
}

export function leerTemaGuardado(): Tema {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'dia' ? 'dia' : TEMA_POR_DEFECTO
  } catch {
    return TEMA_POR_DEFECTO
  }
}

/** Marca el tema en <html>; el CSS de día cuelga de [data-tema='dia']. */
export function aplicarTema(tema: Tema) {
  document.documentElement.dataset.tema = tema
  // Solo en día: controles nativos (fecha, select, scroll) en claro. En noche, sin cambios.
  document.documentElement.style.colorScheme = tema === 'dia' ? 'light' : ''
  if (tema === 'dia') activarTemaDiaInline()
  else desactivarTemaDiaInline()
}

/** Aplica el tema guardado si la ruta lo admite; si no, deja el diseño original. */
export function aplicarTemaParaRuta(pathname: string) {
  aplicarTema(rutaAdmiteTema(pathname) ? leerTemaGuardado() : TEMA_POR_DEFECTO)
}

export function guardarTema(tema: Tema) {
  aplicarTema(tema)
  try {
    window.localStorage.setItem(STORAGE_KEY, tema)
  } catch {
    // Sin localStorage el tema vale solo para esta pestaña.
  }
  window.dispatchEvent(new CustomEvent<Tema>(EVENTO, { detail: tema }))
}

/** Avisa cuando cambia el tema (en esta pestaña o en otra). */
export function escucharTema(fn: (tema: Tema) => void): () => void {
  const local = (e: Event) => fn((e as CustomEvent<Tema>).detail)
  const otraPestana = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) fn(e.newValue === 'dia' ? 'dia' : 'noche')
  }
  window.addEventListener(EVENTO, local)
  window.addEventListener('storage', otraPestana)
  return () => {
    window.removeEventListener(EVENTO, local)
    window.removeEventListener('storage', otraPestana)
  }
}

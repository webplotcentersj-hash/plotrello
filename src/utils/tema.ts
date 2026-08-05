export type Tema = 'dia' | 'noche'

const STORAGE_KEY = 'plotlab:tema'
const TEMA_POR_DEFECTO: Tema = 'noche'

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
}

export function guardarTema(tema: Tema) {
  aplicarTema(tema)
  try {
    window.localStorage.setItem(STORAGE_KEY, tema)
  } catch {
    // Sin localStorage el tema vale solo para esta pestaña.
  }
}

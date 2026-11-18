import { useLayoutEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { aplicarTemaParaRuta, rutaAdmiteTema } from '../utils/tema'
import TemaToggle from './TemaToggle'
import './TemaRuta.css'

/** El tablero ya trae el botón en su header. */
const RUTAS_CON_BOTON_PROPIO = ['/tablero']

/**
 * Aplica el tema guardado según la ruta (las pantallas públicas siempre quedan
 * en su diseño original) y ofrece el botón día/noche en el resto de la app.
 */
export default function TemaRuta({ mostrarBoton }: { mostrarBoton: boolean }) {
  const { pathname } = useLocation()

  useLayoutEffect(() => {
    aplicarTemaParaRuta(pathname)
  }, [pathname])

  const conBoton =
    mostrarBoton &&
    rutaAdmiteTema(pathname) &&
    pathname !== '/login' &&
    !RUTAS_CON_BOTON_PROPIO.some((r) => pathname === r || pathname.startsWith(r + '/'))

  if (!conBoton) return null
  return <TemaToggle className="tema-toggle-flotante" />
}

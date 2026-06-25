import { Outlet } from 'react-router-dom'
import { useTotemKioskMode } from '../hooks/useTotemKioskMode'
import { TotemAutogestionKioskShell } from './TotemAutogestionKioskShell'
import './totemKioskGlobal.css'

/** Layout compartido: fondo kiosko + tipografía Plot Center para todas las rutas del tótem. */
export default function TotemKioskLayout() {
  useTotemKioskMode()
  return (
    <TotemAutogestionKioskShell>
      <Outlet />
    </TotemAutogestionKioskShell>
  )
}

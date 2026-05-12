import type { ReactNode } from 'react'
import { FloatingPathsBackground } from '@/components/ui/floating-paths'
import './totemAutogestionKiosk.css'

export function TotemAutogestionKioskShell({ children }: { children: ReactNode }) {
  return (
    <FloatingPathsBackground position={-1} className="totem-kiosk-shell">
      <div className="totem-kiosk-inner">{children}</div>
    </FloatingPathsBackground>
  )
}

import { useEffect, useState } from 'react'
import { loadCajaSnapshot } from '../cajaInteligencia'
import type { CajaSectionId } from '../types'

type Props = {
  isAdmin: boolean
  usuarioNombre: string
  usuarioId?: number
  onNavigate: (section: CajaSectionId) => void
}

export default function CajaInteligenciaBar({
  isAdmin,
  usuarioNombre,
  usuarioId,
  onNavigate
}: Props) {
  const [puntaje, setPuntaje] = useState<number | null>(null)
  const [topAlert, setTopAlert] = useState<string | null>(null)

  useEffect(() => {
    if (!isAdmin) return
    void loadCajaSnapshot({ isAdmin, usuario: usuarioNombre, usuarioId }).then((s) => {
      setPuntaje(s.salud.puntaje)
      const first = s.salud.alertas.find((a) => a.severidad !== 'ok')
      setTopAlert(first?.titulo ?? null)
    })
  }, [isAdmin, usuarioNombre, usuarioId])

  if (!isAdmin || puntaje === null) return null

  const cls = puntaje >= 90 ? 'ok' : puntaje >= 70 ? 'warn' : 'bad'

  return (
    <div className={`caja-cc-intel-bar ${cls}`} role="status">
      <span className="caja-cc-intel-bar-score">Salud {puntaje}</span>
      {topAlert ? <span className="caja-cc-intel-bar-msg">{topAlert}</span> : <span>Sin alertas críticas</span>}
      <button type="button" className="btn-link" onClick={() => onNavigate('centro_ia')}>
        Centro IA →
      </button>
    </div>
  )
}

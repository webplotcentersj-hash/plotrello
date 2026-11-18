import { useEffect, useState } from 'react'
import { escucharTema, guardarTema, leerTemaGuardado, type Tema } from '../utils/tema'

type Props = {
  className?: string
}

export default function TemaToggle({ className }: Props) {
  const [tema, setTema] = useState<Tema>(() => leerTemaGuardado())

  useEffect(
    () =>
      escucharTema((t) => {
        setTema(t)
        if (t !== document.documentElement.dataset.tema) guardarTema(t)
      }),
    []
  )

  const alternar = () => {
    const siguiente: Tema = tema === 'dia' ? 'noche' : 'dia'
    setTema(siguiente)
    guardarTema(siguiente)
  }

  const esDia = tema === 'dia'

  return (
    <button
      type="button"
      className={className}
      onClick={alternar}
      aria-pressed={esDia}
      title={esDia ? 'Cambiar a modo noche' : 'Cambiar a modo día'}
      aria-label={esDia ? 'Cambiar a modo noche' : 'Cambiar a modo día'}
    >
      <span aria-hidden>{esDia ? '🌙' : '☀️'}</span>
    </button>
  )
}

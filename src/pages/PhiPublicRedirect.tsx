import { useEffect } from 'react'
import { PHI_PUBLIC_URL } from '../utils/phiPublicUrl'

export default function PhiPublicRedirect() {
  useEffect(() => {
    window.location.replace(PHI_PUBLIC_URL)
  }, [])

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: 24,
        background: '#fff',
        color: '#0b0b0b',
        fontFamily: 'system-ui, sans-serif',
        textAlign: 'center'
      }}
    >
      <p>
        Redirigiendo a{' '}
        <a href={PHI_PUBLIC_URL} style={{ color: '#a855f7' }}>
          phi · Plot Design
        </a>
        …
      </p>
    </div>
  )
}

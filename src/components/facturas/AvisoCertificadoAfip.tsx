import { useEffect, useState } from 'react'
import { consultarCertificadoAFIP } from '../../services/afipApi'
import { avisoCertificado, type CertificadoAfipInfo } from '../../utils/certificadoAfip'
import './AvisoCertificadoAfip.css'

type Props = {
  /** En la configuración se muestra siempre, con el estado y cómo renovarlo; en el resto solo si hay que actuar. */
  detalle?: boolean
}

/** Avisa cuando el certificado de ARCA está por vencer o venció: sin él no se puede emitir. */
export default function AvisoCertificadoAfip({ detalle = false }: Props) {
  const [info, setInfo] = useState<CertificadoAfipInfo | null>(null)

  useEffect(() => {
    let cancelado = false
    void consultarCertificadoAFIP().then((r) => {
      if (!cancelado && r.success && r.data) setInfo(r.data)
    })
    return () => {
      cancelado = true
    }
  }, [])

  if (!info) return null
  const aviso = avisoCertificado(info)
  if (!detalle && (aviso.nivel === 'ok' || aviso.nivel === 'info')) return null

  return (
    <div className={`aviso-cert aviso-cert--${aviso.nivel}`} role={aviso.nivel === 'error' ? 'alert' : 'status'}>
      <strong>Certificado de ARCA</strong>
      <span>{aviso.texto}</span>
      {detalle && (aviso.nivel === 'aviso' || aviso.nivel === 'error') && (
        <small>
          Para renovarlo: <code>npm run afip:cert-prod</code> y actualizá <code>AFIP_CERT</code> y <code>AFIP_KEY</code> en Vercel.
        </small>
      )}
    </div>
  )
}

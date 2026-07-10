import { motion, useReducedMotion } from 'motion/react'
import { cn } from '@/lib/utils'
import styles from './verification-card.module.css'

const DEFAULT_BG =
  'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80'

export interface VerificationCardProps {
  backgroundImage?: string
  idNumber?: string
  name?: string
  validThru?: string
  label?: string
  qrSrc?: string
  hint?: string
  className?: string
  /** Desactivar en listas para imprimir */
  animate?: boolean
}

export function VerificationCard({
  backgroundImage = DEFAULT_BG,
  idNumber = 'ID **** 4590',
  name = 'JANE DOE',
  validThru = '11/29',
  label = 'IDENTITY CARD',
  qrSrc,
  hint,
  className,
  animate = true
}: VerificationCardProps) {
  const reduceMotion = useReducedMotion()
  const shouldAnimate = animate && !reduceMotion

  const body = (
    <>
      <div className={styles.overlay} aria-hidden />

      <div className={styles.topRow}>
        <span className={styles.brand}>
          <img src="/plot-lab-logo.png" alt="" />
          <span>{label}</span>
        </span>
        <span>VÁLIDO</span>
      </div>

      {qrSrc ? (
        <div className={styles.qrWrap}>
          <img src={qrSrc} alt="" className={styles.qr} />
        </div>
      ) : null}

      <div className={styles.bottom}>
        <p className={styles.idNumber}>{idNumber}</p>
        <div className={styles.metaRow}>
          <span className={styles.name}>{name}</span>
          <span className={styles.validThru}>{validThru}</span>
        </div>
      </div>

      {hint ? <p className={styles.hint}>{hint}</p> : null}
    </>
  )

  const classNames = cn(styles.card, qrSrc && styles.cardWithQr, className)

  if (!shouldAnimate) {
    return (
      <div className={classNames} style={{ backgroundImage: `url(${backgroundImage})` }}>
        {body}
      </div>
    )
  }

  return (
    <motion.div
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className={classNames}
      style={{ backgroundImage: `url(${backgroundImage})` }}
    >
      {body}
    </motion.div>
  )
}

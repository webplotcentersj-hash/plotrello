import type { ReactNode } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { cn } from '@/lib/utils'
import styles from './floating-paths.module.css'

export function FloatingPathsBackground({
  position,
  children,
  className,
  /** Kiosk / tótem: sin animación infinita (evita tilde en tablets). */
  staticPaths = false
}: {
  position: number
  className?: string
  children: ReactNode
  staticPaths?: boolean
}) {
  const reduceMotion = useReducedMotion()
  const freeze = Boolean(staticPaths || reduceMotion)
  const pathCount = freeze ? 10 : 18

  const paths = Array.from({ length: pathCount }, (_, i) => ({
    id: i,
    d: `M-${380 - i * 5 * position} -${189 + i * 6}C-${380 - i * 5 * position} -${189 + i * 6} -${312 - i * 5 * position} ${
      216 - i * 6
    } ${152 - i * 5 * position} ${343 - i * 6}C${616 - i * 5 * position} ${470 - i * 6} ${684 - i * 5 * position} ${
      875 - i * 6
    } ${684 - i * 5 * position} ${875 - i * 6}`,
    width: 0.5 + i * 0.03
  }))

  return (
    <div className={cn(styles.root, className)}>
      <div className={styles.svgLayer} aria-hidden>
        <svg className={styles.svg} viewBox="0 0 696 316" preserveAspectRatio="none" fill="none">
          {paths.map((path) =>
            freeze ? (
              <path
                key={path.id}
                d={path.d}
                stroke="currentColor"
                strokeWidth={path.width}
                strokeOpacity={0.07 + path.id * 0.02}
              />
            ) : (
              <motion.path
                key={path.id}
                d={path.d}
                stroke="currentColor"
                strokeWidth={path.width}
                strokeOpacity={0.1 + path.id * 0.03}
                initial={{ pathLength: 0.3, opacity: 0.55 }}
                animate={{
                  pathLength: 1,
                  opacity: [0.28, 0.5, 0.28]
                }}
                transition={{
                  duration: 28 + path.id * 0.4,
                  repeat: Number.POSITIVE_INFINITY,
                  ease: 'linear'
                }}
              />
            )
          )}
        </svg>
      </div>
      <div className={styles.content}>{children}</div>
    </div>
  )
}

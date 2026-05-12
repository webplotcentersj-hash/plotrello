import type { ReactNode } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { cn } from '@/lib/utils'
import styles from './floating-paths.module.css'

export function FloatingPathsBackground({
  position,
  children,
  className
}: {
  position: number
  className?: string
  children: ReactNode
}) {
  const reduceMotion = useReducedMotion()

  const paths = Array.from({ length: 36 }, (_, i) => ({
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
            reduceMotion ? (
              <path
                key={path.id}
                d={path.d}
                stroke="currentColor"
                strokeWidth={path.width}
                strokeOpacity={0.08 + path.id * 0.025}
              />
            ) : (
              <motion.path
                key={path.id}
                d={path.d}
                stroke="currentColor"
                strokeWidth={path.width}
                strokeOpacity={0.1 + path.id * 0.03}
                initial={{ pathLength: 0.3, opacity: 0.6 }}
                animate={{
                  pathLength: 1,
                  opacity: [0.3, 0.6, 0.3],
                  pathOffset: [0, 1, 0]
                }}
                transition={{
                  duration: 22 + path.id * 0.35,
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

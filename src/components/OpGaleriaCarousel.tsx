import { useCallback, useEffect, useRef, useState } from 'react'
import type { OpGaleriaSlide } from '../types/api'
import './OpGaleriaCarousel.css'

type Props = {
  slides: OpGaleriaSlide[]
  className?: string
}

export default function OpGaleriaCarousel({ slides, className = '' }: Props) {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  const n = slides.length
  const safeIdx = n === 0 ? 0 : ((index % n) + n) % n
  const current = slides[safeIdx]

  const go = useCallback(
    (delta: number) => {
      if (n === 0) return
      setIndex((i) => (i + delta + n) % n)
    },
    [n]
  )

  useEffect(() => {
    if (n <= 1 || paused) return
    const t = window.setInterval(() => {
      setIndex((i) => (i + 1) % n)
    }, 7500)
    return () => window.clearInterval(t)
  }, [n, paused])

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        go(-1)
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        go(1)
      }
    }
    el.addEventListener('keydown', onKey)
    return () => el.removeEventListener('keydown', onKey)
  }, [go])

  if (n === 0) return null

  return (
    <div
      ref={wrapRef}
      className={`op-galeria-carousel ${className}`.trim()}
      tabIndex={0}
      role="region"
      aria-roledescription="carrusel"
      aria-label="Galería de imágenes de la OP"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="op-galeria-carousel__viewport">
        <img
          key={current.url}
          src={current.url}
          alt={current.nombre || `Imagen ${safeIdx + 1} de ${n}`}
          className="op-galeria-carousel__img"
          loading={safeIdx === 0 ? 'eager' : 'lazy'}
        />
        <div className="op-galeria-carousel__scrim" aria-hidden />
        <div className="op-galeria-carousel__caption">
          {current.nombre ? (
            <p className="op-galeria-carousel__title">{current.nombre}</p>
          ) : (
            <p className="op-galeria-carousel__title op-galeria-carousel__title--muted">Sin nombre</p>
          )}
          <span className="op-galeria-carousel__counter">
            {safeIdx + 1} / {n}
          </span>
        </div>

        {n > 1 && (
          <>
            <button
              type="button"
              className="op-galeria-carousel__nav op-galeria-carousel__nav--prev"
              aria-label="Imagen anterior"
              onClick={() => go(-1)}
            >
              ‹
            </button>
            <button
              type="button"
              className="op-galeria-carousel__nav op-galeria-carousel__nav--next"
              aria-label="Imagen siguiente"
              onClick={() => go(1)}
            >
              ›
            </button>
          </>
        )}
      </div>

      {n > 1 && (
        <div className="op-galeria-carousel__dots" role="tablist" aria-label="Seleccionar imagen">
          {slides.map((s, i) => (
            <button
              key={`${s.url}-${i}`}
              type="button"
              role="tab"
              aria-selected={i === safeIdx}
              className={`op-galeria-carousel__dot${i === safeIdx ? ' is-active' : ''}`}
              onClick={() => setIndex(i)}
              aria-label={`Ir a imagen ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}

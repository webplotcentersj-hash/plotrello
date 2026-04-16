import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { OpGaleriaSlide } from '../types/api'
import './OpGaleriaCarousel.css'

type Props = {
  slides: OpGaleriaSlide[]
  className?: string
}

/**
 * Vista "de un vistazo": grid de miniaturas (galería).
 * Al click, abre visor tipo carrusel/lightbox para navegar.
 */
export default function OpGaleriaCarousel({ slides, className = '' }: Props) {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const modalRef = useRef<HTMLDivElement>(null)

  const n = slides.length
  const safeIdx = n === 0 ? 0 : ((index % n) + n) % n
  const current = slides[safeIdx]

  const thumbSlides = useMemo(() => {
    const seen = new Set<string>()
    const out: OpGaleriaSlide[] = []
    for (const s of slides) {
      const u = (s?.url ?? '').trim()
      if (!u) continue
      if (seen.has(u)) continue
      seen.add(u)
      out.push(s)
    }
    return out
  }, [slides])

  const go = useCallback(
    (delta: number) => {
      if (n === 0) return
      setIndex((i) => (i + delta + n) % n)
    },
    [n]
  )

  useEffect(() => {
    if (!open) return
    if (n <= 1 || paused) return
    const t = window.setInterval(() => {
      setIndex((i) => (i + 1) % n)
    }, 7500)
    return () => window.clearInterval(t)
  }, [n, open, paused])

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        setOpen(true)
      } else if (e.key === 'ArrowLeft') {
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

  useEffect(() => {
    if (!open) return
    const t = window.setTimeout(() => modalRef.current?.focus(), 0)
    return () => window.clearTimeout(t)
  }, [open])

  if (n === 0) return null

  return (
    <>
      <div
        ref={wrapRef}
        className={`op-galeria-gallery ${className}`.trim()}
        tabIndex={0}
        role="region"
        aria-label="Galería de imágenes de la OP"
      >
        <div className="op-galeria-gallery__grid" role="list" aria-label="Miniaturas">
          {thumbSlides.map((s, i) => (
            <button
              key={`${s.url}-${i}`}
              type="button"
              role="listitem"
              className="op-galeria-gallery__thumb"
              onClick={() => {
                setIndex(i)
                setOpen(true)
              }}
              aria-label={s.nombre?.trim() ? `Abrir imagen: ${s.nombre}` : `Abrir imagen ${i + 1}`}
            >
              <img
                src={s.url}
                alt={s.nombre || `Imagen ${i + 1}`}
                loading={i < 10 ? 'eager' : 'lazy'}
                className="op-galeria-gallery__thumbImg"
              />
              {s.nombre?.trim() ? (
                <span className="op-galeria-gallery__thumbLabel">{s.nombre.trim()}</span>
              ) : null}
            </button>
          ))}
        </div>

        <div className="op-galeria-gallery__hint">
          Click en una miniatura para verla grande. Teclado: Enter abre, ←/→ navega.
        </div>
      </div>

      {open && (
        <div className="op-galeria-modal__backdrop" role="presentation" onClick={() => setOpen(false)}>
          <div
            ref={modalRef}
            className="op-galeria-carousel op-galeria-modal__panel"
            tabIndex={0}
            role="dialog"
            aria-modal="true"
            aria-label="Visor de galería"
            onClick={(e) => e.stopPropagation()}
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            onFocus={() => setPaused(true)}
            onBlur={() => setPaused(false)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault()
                setOpen(false)
              } else if (e.key === 'ArrowLeft') {
                e.preventDefault()
                go(-1)
              } else if (e.key === 'ArrowRight') {
                e.preventDefault()
                go(1)
              }
            }}
          >
            <div className="op-galeria-modal__topbar">
              <button
                type="button"
                className="op-galeria-modal__close"
                onClick={() => setOpen(false)}
                aria-label="Cerrar"
              >
                Cerrar
              </button>
            </div>

            <div className="op-galeria-carousel__viewport">
              <img
                key={current.url}
                src={current.url}
                alt={current.nombre || `Imagen ${safeIdx + 1} de ${n}`}
                className="op-galeria-carousel__img"
                loading="eager"
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
        </div>
      )}
    </>
  )
}

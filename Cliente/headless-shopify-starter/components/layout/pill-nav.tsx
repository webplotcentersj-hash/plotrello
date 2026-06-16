'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { gsap } from 'gsap'
import { ShoppingBag } from 'lucide-react'
import { useCart } from '@/components/cart/cart-provider'

interface NavItem {
  label: string
  href: string
  ariaLabel?: string
}

interface PillNavProps {
  logo?: string
  logoAlt?: string
  items: NavItem[]
  className?: string
  ease?: string
  baseColor?: string
  pillColor?: string
  hoveredPillTextColor?: string
  pillTextColor?: string
  initialLoadAnimation?: boolean
}

export function PillNav({
  logo = '/logo.png',
  logoAlt = 'Logo',
  items,
  className = '',
  ease = 'power3.out',
  baseColor = '#1A1A1A',
  pillColor = '#C8FF00',
  hoveredPillTextColor = '#0A0A0A',
  pillTextColor = '#0A0A0A',
  initialLoadAnimation = true,
}: PillNavProps) {
  const pathname = usePathname()
  const resolvedPillTextColor = pillTextColor ?? baseColor
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const circleRefs = useRef<(HTMLSpanElement | null)[]>([])
  const tlRefs = useRef<gsap.core.Timeline[]>([])
  const activeTweenRefs = useRef<gsap.core.Tween[]>([])
  const logoImgRef = useRef<HTMLImageElement>(null)
  const logoTweenRef = useRef<gsap.core.Tween | null>(null)
  const hamburgerRef = useRef<HTMLButtonElement>(null)
  const mobileMenuRef = useRef<HTMLDivElement>(null)
  const navItemsRef = useRef<HTMLDivElement>(null)
  const logoRef = useRef<HTMLAnchorElement>(null)
  const { cart, toggleCart } = useCart()

  const cartQuantity = cart?.totalQuantity || 0

  useEffect(() => {
    const layout = () => {
      circleRefs.current.forEach((circle, index) => {
        if (!circle?.parentElement) return

        const pill = circle.parentElement
        const rect = pill.getBoundingClientRect()
        const { width: w, height: h } = rect
        const R = ((w * w) / 4 + h * h) / (2 * h)
        const D = Math.ceil(2 * R) + 2
        const delta = Math.ceil(R - Math.sqrt(Math.max(0, R * R - (w * w) / 4))) + 1
        const originY = D - delta

        circle.style.width = `${D}px`
        circle.style.height = `${D}px`
        circle.style.bottom = `-${delta}px`

        gsap.set(circle, {
          xPercent: -50,
          scale: 0,
          transformOrigin: `50% ${originY}px`,
        })

        const label = pill.querySelector('.pill-label') as HTMLElement
        const hoverLabel = pill.querySelector('.pill-label-hover') as HTMLElement

        if (label) gsap.set(label, { y: 0 })
        if (hoverLabel) gsap.set(hoverLabel, { y: h + 12, opacity: 0 })

        tlRefs.current[index]?.kill()
        const tl = gsap.timeline({ paused: true })

        tl.to(circle, { scale: 1.2, xPercent: -50, duration: 2, ease, overwrite: 'auto' }, 0)

        if (label) {
          tl.to(label, { y: -(h + 8), duration: 2, ease, overwrite: 'auto' }, 0)
        }

        if (hoverLabel) {
          gsap.set(hoverLabel, { y: Math.ceil(h + 100), opacity: 0 })
          tl.to(hoverLabel, { y: 0, opacity: 1, duration: 2, ease, overwrite: 'auto' }, 0)
        }

        tlRefs.current[index] = tl
      })
    }

    layout()

    const onResize = () => layout()
    window.addEventListener('resize', onResize)

    if (document.fonts?.ready) {
      document.fonts.ready.then(layout).catch(() => {})
    }

    const menu = mobileMenuRef.current
    if (menu) {
      gsap.set(menu, { visibility: 'hidden', opacity: 0, scaleY: 1 })
    }

    if (initialLoadAnimation) {
      const logoEl = logoRef.current
      const navItems = navItemsRef.current

      if (logoEl) {
        gsap.set(logoEl, { scale: 0 })
        gsap.to(logoEl, { scale: 1, duration: 0.6, ease })
      }

      if (navItems) {
        gsap.set(navItems, { width: 0, overflow: 'hidden' })
        gsap.to(navItems, { width: 'auto', duration: 0.6, ease })
      }
    }

    return () => window.removeEventListener('resize', onResize)
  }, [items, ease, initialLoadAnimation])

  const handleEnter = (i: number) => {
    const tl = tlRefs.current[i]
    if (!tl) return
    activeTweenRefs.current[i]?.kill()
    activeTweenRefs.current[i] = tl.tweenTo(tl.duration(), {
      duration: 0.3,
      ease,
      overwrite: 'auto',
    })
  }

  const handleLeave = (i: number) => {
    const tl = tlRefs.current[i]
    if (!tl) return
    activeTweenRefs.current[i]?.kill()
    activeTweenRefs.current[i] = tl.tweenTo(0, {
      duration: 0.2,
      ease,
      overwrite: 'auto',
    })
  }

  const handleLogoEnter = () => {
    const img = logoImgRef.current
    if (!img) return
    logoTweenRef.current?.kill()
    gsap.set(img, { rotate: 0 })
    logoTweenRef.current = gsap.to(img, {
      rotate: 360,
      duration: 0.2,
      ease,
      overwrite: 'auto',
    })
  }

  const toggleMobileMenu = () => {
    const newState = !isMobileMenuOpen
    setIsMobileMenuOpen(newState)

    const hamburger = hamburgerRef.current
    const menu = mobileMenuRef.current

    if (hamburger) {
      const lines = hamburger.querySelectorAll('.hamburger-line')
      if (newState) {
        gsap.to(lines[0], { rotation: 45, y: 3, duration: 0.3, ease })
        gsap.to(lines[1], { rotation: -45, y: -3, duration: 0.3, ease })
      } else {
        gsap.to(lines[0], { rotation: 0, y: 0, duration: 0.3, ease })
        gsap.to(lines[1], { rotation: 0, y: 0, duration: 0.3, ease })
      }
    }

    if (menu) {
      if (newState) {
        gsap.set(menu, { visibility: 'visible' })
        gsap.fromTo(
          menu,
          { opacity: 0, y: 10 },
          { opacity: 1, y: 0, duration: 0.3, ease, transformOrigin: 'top center' }
        )
      } else {
        gsap.to(menu, {
          opacity: 0,
          y: 10,
          duration: 0.2,
          ease,
          onComplete: () => gsap.set(menu, { visibility: 'hidden' }),
        })
      }
    }
  }

  const closeMobileMenu = () => {
    if (isMobileMenuOpen) {
      setIsMobileMenuOpen(false)
      const hamburger = hamburgerRef.current
      const menu = mobileMenuRef.current

      if (hamburger) {
        const lines = hamburger.querySelectorAll('.hamburger-line')
        gsap.to(lines[0], { rotation: 0, y: 0, duration: 0.3, ease })
        gsap.to(lines[1], { rotation: 0, y: 0, duration: 0.3, ease })
      }

      if (menu) {
        gsap.to(menu, {
          opacity: 0,
          y: 10,
          duration: 0.2,
          ease,
          onComplete: () => gsap.set(menu, { visibility: 'hidden' }),
        })
      }
    }
  }

  const cssVars = {
    '--base': baseColor,
    '--pill-bg': pillColor,
    '--hover-text': hoveredPillTextColor,
    '--pill-text': resolvedPillTextColor,
    '--nav-h': '42px',
    '--logo': '36px',
    '--pill-pad-x': '18px',
    '--pill-gap': '3px',
  } as React.CSSProperties

  return (
    <div className="fixed top-4 z-[1000] w-full left-0 md:w-auto md:left-1/2 md:-translate-x-1/2 px-4 md:px-0">
      <nav
        className={`w-full md:w-max flex items-center justify-between md:justify-start box-border ${className}`}
        aria-label="Primary"
        style={cssVars}
      >
        {/* Logo */}
        <Link
          className="rounded-full p-2 inline-flex items-center justify-center overflow-hidden w-[var(--nav-h)] h-[var(--nav-h)] bg-white"
          href="/"
          aria-label="Home"
          onMouseEnter={handleLogoEnter}
          ref={logoRef}
        >
          <Image
            src={logo}
            alt={logoAlt}
            width={36}
            height={36}
            ref={logoImgRef}
            className="w-full h-full object-cover block opacity-100"
            priority
          />
        </Link>

        {/* Desktop Nav Items */}
        <div
          ref={navItemsRef}
          className="relative items-center rounded-full hidden md:flex ml-2 h-[var(--nav-h)] bg-white"
        >
          <ul
            role="menubar"
            className="list-none flex items-stretch m-0 p-[3px] h-full"
            style={{ gap: 'var(--pill-gap)' }}
          >
            {items.map((item, i) => {
              const isActive = pathname === item.href

              return (
                <li key={item.href} role="none" className="flex h-full">
                  <Link
                    role="menuitem"
                    href={item.href}
                    className="relative overflow-hidden inline-flex items-center justify-center h-full no-underline rounded-full box-border font-semibold text-[14px] leading-[0] uppercase tracking-[0.5px] whitespace-nowrap cursor-pointer"
                    style={{
                      background: 'var(--pill-bg)',
                      color: 'var(--pill-text)',
                      paddingLeft: 'var(--pill-pad-x)',
                      paddingRight: 'var(--pill-pad-x)',
                    }}
                    aria-label={item.ariaLabel || item.label}
                    onMouseEnter={() => handleEnter(i)}
                    onMouseLeave={() => handleLeave(i)}
                  >
                    <span
                      className="hover-circle absolute left-1/2 bottom-0 rounded-full z-[1] block pointer-events-none bg-white"
                      style={{ willChange: 'transform' }}
                      aria-hidden="true"
                      ref={(el) => {
                        circleRefs.current[i] = el
                      }}
                    />
                    <span className="label-stack relative inline-block leading-[1] z-[2]">
                      <span
                        className="pill-label relative z-[2] inline-block leading-[1]"
                        style={{ willChange: 'transform' }}
                      >
                        {item.label}
                      </span>
                      <span
                        className="pill-label-hover absolute left-0 top-0 z-[3] inline-block text-primary"
                        style={{ willChange: 'transform, opacity' }}
                        aria-hidden="true"
                      >
                        {item.label}
                      </span>
                    </span>
                    {isActive && (
                      <span
                        className="absolute left-1/2 -bottom-[6px] -translate-x-1/2 w-2 h-2 rounded-full z-[4] bg-foreground"
                        aria-hidden="true"
                      />
                    )}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>

        {/* Right side actions */}
        <div className="flex items-center gap-2">
          {/* Cart button */}
          <button
            onClick={toggleCart}
            className="w-[var(--nav-h)] h-[var(--nav-h)] rounded-full border-none inline-flex items-center justify-center cursor-pointer relative transition-transform duration-200 hover:scale-105 ml-2"
            style={{ background: 'var(--pill-bg)', color: 'var(--hover-text)' }}
            aria-label="Toggle cart"
          >
            <ShoppingBag className="w-5 h-5" />
            {cartQuantity > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-foreground text-background text-[10px] font-bold rounded-full flex items-center justify-center">
                {cartQuantity}
              </span>
            )}
          </button>

          {/* Mobile hamburger */}
          <button
            className="md:hidden rounded-full border-0 flex flex-col items-center justify-center gap-1 cursor-pointer p-0 relative w-[var(--nav-h)] h-[var(--nav-h)]"
            style={{ background: 'var(--pill-bg)' }}
            onClick={toggleMobileMenu}
            aria-label="Toggle menu"
            aria-expanded={isMobileMenuOpen}
            ref={hamburgerRef}
          >
            <span
              className="hamburger-line w-4 h-0.5 rounded origin-center"
              style={{ background: 'var(--hover-text)' }}
            />
            <span
              className="hamburger-line w-4 h-0.5 rounded origin-center"
              style={{ background: 'var(--hover-text)' }}
            />
          </button>
        </div>
      </nav>

      {/* Mobile menu popover */}
      <div
        ref={mobileMenuRef}
        className="md:hidden absolute top-14 left-4 right-4 rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] z-[998] origin-top bg-white"
        style={cssVars}
      >
        <ul className="list-none m-0 p-[4px] flex flex-col gap-[4px]">
          {items.map((item) => {
            const isActive = pathname === item.href
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`block py-3.5 px-5 text-[15px] font-semibold uppercase tracking-wide rounded-full transition-all duration-200 ${
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-primary text-primary-foreground hover:opacity-80'
                  }`}
                  onClick={closeMobileMenu}
                >
                  {item.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}

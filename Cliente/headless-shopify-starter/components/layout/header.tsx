'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Menu, X, ShoppingBag, Search } from 'lucide-react'
import { useCart } from '@/components/cart/cart-provider'
import { SearchModal } from './search-modal'

const navLinks = [
  { href: '/', label: 'Home' },
  { href: '/products', label: 'Shop' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
]

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)
  const { totalQuantity, toggleCart } = useCart()

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    if (isMenuOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isMenuOpen])

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-30 transition-all duration-300 ${
          isScrolled
            ? 'bg-background/95 backdrop-blur-md border-b border-border'
            : 'bg-transparent'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 lg:h-20">
            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMenuOpen(true)}
              className="lg:hidden p-2 -ml-2 hover:bg-secondary rounded-full transition-colors"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Desktop Nav - Left */}
            <nav className="hidden lg:flex items-center gap-8">
              {navLinks.slice(0, 2).map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors tracking-wide"
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            {/* Logo */}
            <Link href="/" className="flex items-center gap-2">
              <Image
                src="/logo.png"
                alt="Store Logo"
                width={40}
                height={40}
                className="w-10 h-10 invert"
                priority
              />
              <span className="font-heading text-2xl tracking-wider text-foreground hidden sm:block">
                DRIPNEX
              </span>
            </Link>

            {/* Desktop Nav - Right */}
            <nav className="hidden lg:flex items-center gap-8">
              {navLinks.slice(2).map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors tracking-wide"
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            {/* Right Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsSearchOpen(true)}
                className="p-2 hover:bg-secondary rounded-full transition-colors"
                aria-label="Search"
              >
                <Search className="w-5 h-5" />
              </button>
              <button
                onClick={toggleCart}
                className="p-2 hover:bg-secondary rounded-full transition-colors relative"
                aria-label="Open cart"
              >
                <ShoppingBag className="w-5 h-5" />
                {totalQuantity > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-primary text-primary-foreground text-xs font-medium w-5 h-5 flex items-center justify-center rounded-full">
                    {totalQuantity}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Menu */}
      <div
        className={`fixed inset-0 bg-background z-40 lg:hidden transform transition-transform duration-300 ${
          isMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between p-4 border-b border-border">
          <Link href="/" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-2">
            <Image
              src="/logo.png"
              alt="Store Logo"
              width={40}
              height={40}
              className="w-10 h-10 invert"
            />
            <span className="font-heading text-2xl tracking-wider text-foreground">
              DRIPNEX
            </span>
          </Link>
          <button
            onClick={() => setIsMenuOpen(false)}
            className="p-2 hover:bg-secondary rounded-full transition-colors"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <nav className="p-6">
          <ul className="space-y-4">
            {navLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={() => setIsMenuOpen(false)}
                  className="block font-heading text-4xl tracking-wider text-foreground hover:text-primary transition-colors"
                >
                  {link.label.toUpperCase()}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      {/* Search Modal */}
      <SearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />

      {/* Header Spacer */}
      <div className="h-16 lg:h-20" />
    </>
  )
}

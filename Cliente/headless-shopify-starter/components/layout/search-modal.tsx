'use client'

import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { X, Search, Loader2 } from 'lucide-react'
import type { ShopifyProduct } from '@/lib/shopify/types'
import { formatPrice } from '@/lib/shopify/utils'

interface SearchModalProps {
  isOpen: boolean
  onClose: () => void
}

export function SearchModal({ isOpen, onClose }: SearchModalProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ShopifyProduct[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const search = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([])
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`)
      const data = await response.json()
      setResults(data.products || [])
    } catch (error) {
      console.error('Search error:', error)
      setResults([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      search(query)
    }, 300)

    return () => clearTimeout(debounceTimer)
  }, [query, search])

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
      setQuery('')
      setResults([])
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-background/95 backdrop-blur-md z-50">
      <div className="max-w-3xl mx-auto p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h2 className="font-heading text-2xl tracking-wide">SEARCH</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-secondary rounded-full transition-colors"
            aria-label="Close search"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Input */}
        <div className="relative mb-8">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search products..."
            autoFocus
            className="w-full bg-secondary border border-border rounded-lg py-4 pl-12 pr-4 text-lg placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          />
          {isLoading && (
            <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 animate-spin text-muted-foreground" />
          )}
        </div>

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto">
          {query && !isLoading && results.length === 0 && (
            <p className="text-center text-muted-foreground py-8">
              No products found for &ldquo;{query}&rdquo;
            </p>
          )}

          {results.length > 0 && (
            <ul className="space-y-4">
              {results.map((product) => (
                <li key={product.id}>
                  <Link
                    href={`/products/${product.handle}`}
                    onClick={onClose}
                    className="flex items-center gap-4 p-4 bg-secondary rounded-lg hover:bg-secondary/80 transition-colors"
                  >
                    <div className="relative w-16 h-16 bg-muted rounded overflow-hidden flex-shrink-0">
                      {product.featuredImage ? (
                        <Image
                          src={product.featuredImage.url}
                          alt={product.featuredImage.altText || product.title}
                          fill
                          className="object-cover"
                          sizes="64px"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                          <Search className="w-6 h-6" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-foreground truncate">
                        {product.title}
                      </h3>
                      {product.productType && (
                        <p className="text-sm text-muted-foreground">
                          {product.productType}
                        </p>
                      )}
                    </div>
                    <p className="text-primary font-medium">
                      {formatPrice(product.priceRange.minVariantPrice)}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

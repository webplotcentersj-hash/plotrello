'use client'

import { useState } from 'react'
import Image from 'next/image'
import { ChevronLeft, ChevronRight, ShoppingBag } from 'lucide-react'
import type { ShopifyProduct } from '@/lib/shopify/types'
import { getProductImages } from '@/lib/shopify/utils'

interface ProductGalleryProps {
  product: ShopifyProduct
}

export function ProductGallery({ product }: ProductGalleryProps) {
  const images = getProductImages(product)
  const [selectedIndex, setSelectedIndex] = useState(0)

  const selectedImage = images[selectedIndex]

  const goToPrevious = () => {
    setSelectedIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1))
  }

  const goToNext = () => {
    setSelectedIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1))
  }

  return (
    <div className="space-y-4">
      {/* Main Image */}
      <div className="relative aspect-[3/4] bg-secondary rounded-lg overflow-hidden">
        {selectedImage ? (
          <Image
            src={selectedImage.url}
            alt={selectedImage.altText || product.title}
            fill
            className="object-cover"
            sizes="(max-width: 1024px) 100vw, 50vw"
            priority
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            <ShoppingBag className="w-24 h-24" />
          </div>
        )}

        {/* Navigation Arrows */}
        {images.length > 1 && (
          <>
            <button
              onClick={goToPrevious}
              className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-background/80 backdrop-blur-sm hover:bg-background rounded-full transition-colors"
              aria-label="Previous image"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={goToNext}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-background/80 backdrop-blur-sm hover:bg-background rounded-full transition-colors"
              aria-label="Next image"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
        )}

        {/* Image Counter */}
        {images.length > 1 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1 bg-background/80 backdrop-blur-sm rounded-full text-sm">
            {selectedIndex + 1} / {images.length}
          </div>
        )}
      </div>

      {/* Thumbnails */}
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {images.map((image, index) => (
            <button
              key={index}
              onClick={() => setSelectedIndex(index)}
              className={`relative w-20 h-20 flex-shrink-0 rounded overflow-hidden transition-all ${
                index === selectedIndex
                  ? 'ring-2 ring-primary'
                  : 'opacity-60 hover:opacity-100'
              }`}
            >
              <Image
                src={image.url}
                alt={image.altText || `${product.title} - Image ${index + 1}`}
                fill
                className="object-cover"
                sizes="80px"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

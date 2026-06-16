'use client'

import Image from 'next/image'
import Link from 'next/link'
import { ShoppingBag } from 'lucide-react'
import type { ShopifyProduct } from '@/lib/shopify/types'
import { formatPrice, hasDiscount, getDiscountPercentage, getDefaultVariant } from '@/lib/shopify/utils'
import { useCart } from '@/components/cart/cart-provider'
import { Button } from '@/components/ui/button'

interface ProductCardProps {
  product: ShopifyProduct
  priority?: boolean
}

export function ProductCard({ product, priority = false }: ProductCardProps) {
  const { addToCart, isLoading } = useCart()
  const defaultVariant = getDefaultVariant(product)
  const showDiscount = hasDiscount(product)
  const discountPercentage = getDiscountPercentage(product)

  const handleQuickAdd = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (defaultVariant) {
      await addToCart(defaultVariant.id)
    }
  }

  return (
    <div className="group relative">
      <Link href={`/products/${product.handle}`} className="block">
        {/* Image Container */}
        <div className="relative aspect-[3/4] bg-secondary rounded-lg overflow-hidden mb-4">
          {product.featuredImage ? (
            <Image
              src={product.featuredImage.url}
              alt={product.featuredImage.altText || product.title}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-105"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
              priority={priority}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
              <ShoppingBag className="w-12 h-12" />
            </div>
          )}

          {/* Discount Badge */}
          {showDiscount && (
            <div className="absolute top-3 left-3 bg-primary text-primary-foreground text-xs font-medium px-2 py-1 rounded">
              -{discountPercentage}%
            </div>
          )}

          {/* Out of Stock Badge */}
          {!product.availableForSale && (
            <div className="absolute top-3 right-3 bg-destructive text-destructive-foreground text-xs font-medium px-2 py-1 rounded">
              Sold Out
            </div>
          )}

          {/* Quick Add Button */}
          {product.availableForSale && defaultVariant && (
            <div className="absolute inset-x-3 bottom-3 opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300">
              <Button
                onClick={handleQuickAdd}
                disabled={isLoading}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-heading tracking-wider"
              >
                ADD TO BAG
              </Button>
            </div>
          )}
        </div>

        {/* Product Info */}
        <div className="space-y-1">
          {product.productType && (
            <p className="text-xs text-muted-foreground uppercase tracking-wider">
              {product.productType}
            </p>
          )}
          <h3 className="font-medium text-foreground group-hover:text-primary transition-colors line-clamp-2">
            {product.title}
          </h3>
          <div className="flex items-center gap-2">
            <p className="text-primary font-medium">
              {formatPrice(product.priceRange.minVariantPrice)}
            </p>
            {showDiscount && (
              <p className="text-sm text-muted-foreground line-through">
                {formatPrice(product.compareAtPriceRange.minVariantPrice)}
              </p>
            )}
          </div>
        </div>
      </Link>
    </div>
  )
}

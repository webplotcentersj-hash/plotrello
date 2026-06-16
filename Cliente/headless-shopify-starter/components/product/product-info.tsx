'use client'

import { useState } from 'react'
import { Check, Minus, Plus, ShoppingBag, Truck, Shield } from 'lucide-react'
import type { ShopifyProduct, ShopifyProductVariant } from '@/lib/shopify/types'
import {
  formatPrice,
  getProductVariants,
  getDefaultVariant,
  variantHasDiscount,
  getVariantDiscountPercentage,
} from '@/lib/shopify/utils'
import { useCart } from '@/components/cart/cart-provider'
import { Button } from '@/components/ui/button'

interface ProductInfoProps {
  product: ShopifyProduct
}

export function ProductInfo({ product }: ProductInfoProps) {
  const { addToCart, isLoading } = useCart()
  const variants = getProductVariants(product)
  const defaultVariant = getDefaultVariant(product)

  const [selectedVariant, setSelectedVariant] = useState<ShopifyProductVariant | null>(
    defaultVariant
  )
  const [quantity, setQuantity] = useState(1)
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {}
    defaultVariant?.selectedOptions.forEach((opt) => {
      initial[opt.name] = opt.value
    })
    return initial
  })

  const handleOptionChange = (optionName: string, value: string) => {
    const newOptions = { ...selectedOptions, [optionName]: value }
    setSelectedOptions(newOptions)

    // Find the variant that matches all selected options
    const matchingVariant = variants.find((variant) =>
      variant.selectedOptions.every(
        (opt) => newOptions[opt.name] === opt.value
      )
    )
    setSelectedVariant(matchingVariant || null)
  }

  const handleAddToCart = async () => {
    if (!selectedVariant) return
    await addToCart(selectedVariant.id, quantity)
    setQuantity(1)
  }

  const showDiscount = selectedVariant && variantHasDiscount(selectedVariant)
  const discountPercentage = selectedVariant ? getVariantDiscountPercentage(selectedVariant) : 0

  const hasMultipleVariants = variants.length > 1 || (variants[0]?.title !== 'Default Title')

  return (
    <div className="lg:sticky lg:top-24 space-y-6">
      {/* Product Type */}
      {product.productType && (
        <p className="text-primary font-medium tracking-widest uppercase">
          {product.productType}
        </p>
      )}

      {/* Title */}
      <h1 className="font-heading text-4xl lg:text-5xl tracking-wider text-foreground">
        {product.title.toUpperCase()}
      </h1>

      {/* Price */}
      <div className="flex items-center gap-3">
        {selectedVariant && (
          <>
            <p className="text-2xl font-medium text-primary">
              {formatPrice(selectedVariant.price)}
            </p>
            {showDiscount && selectedVariant.compareAtPrice && (
              <>
                <p className="text-lg text-muted-foreground line-through">
                  {formatPrice(selectedVariant.compareAtPrice)}
                </p>
                <span className="bg-primary text-primary-foreground text-sm font-medium px-2 py-0.5 rounded">
                  -{discountPercentage}%
                </span>
              </>
            )}
          </>
        )}
      </div>

      {/* Short Description */}
      {product.description && (
        <p className="text-muted-foreground leading-relaxed line-clamp-3">
          {product.description}
        </p>
      )}

      {/* Options */}
      {hasMultipleVariants && (
        <div className="space-y-4">
          {product.options.map((option) => (
            <div key={option.id}>
              <label className="block text-sm font-medium text-foreground mb-2">
                {option.name}
              </label>
              <div className="flex flex-wrap gap-2">
                {option.values.map((value) => {
                  const isSelected = selectedOptions[option.name] === value
                  return (
                    <button
                      key={value}
                      onClick={() => handleOptionChange(option.name, value)}
                      className={`px-4 py-2 border rounded-lg text-sm font-medium transition-colors ${
                        isSelected
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border hover:border-foreground'
                      }`}
                    >
                      {value}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Quantity */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-2">
          Quantity
        </label>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            className="p-2 bg-secondary hover:bg-secondary/80 rounded-lg transition-colors"
            aria-label="Decrease quantity"
          >
            <Minus className="w-4 h-4" />
          </button>
          <span className="w-12 text-center font-medium">{quantity}</span>
          <button
            onClick={() => setQuantity((q) => q + 1)}
            className="p-2 bg-secondary hover:bg-secondary/80 rounded-lg transition-colors"
            aria-label="Increase quantity"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Add to Cart */}
      <div className="space-y-3 pt-4">
        {selectedVariant?.availableForSale ? (
          <Button
            onClick={handleAddToCart}
            disabled={isLoading || !selectedVariant}
            size="lg"
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-heading text-lg tracking-wider"
          >
            <ShoppingBag className="w-5 h-5 mr-2" />
            ADD TO BAG
          </Button>
        ) : (
          <Button
            disabled
            size="lg"
            className="w-full font-heading text-lg tracking-wider"
          >
            SOLD OUT
          </Button>
        )}
      </div>

      {/* Trust Badges */}
      <div className="pt-6 space-y-3 border-t border-border">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Truck className="w-5 h-5" />
          <span>Free shipping on orders over $100</span>
        </div>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Shield className="w-5 h-5" />
          <span>Secure checkout & buyer protection</span>
        </div>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Check className="w-5 h-5" />
          <span>30-day hassle-free returns</span>
        </div>
      </div>

      {/* Tags */}
      {product.tags.length > 0 && (
        <div className="pt-6 border-t border-border">
          <p className="text-sm text-muted-foreground mb-2">Tags</p>
          <div className="flex flex-wrap gap-2">
            {product.tags.map((tag) => (
              <span
                key={tag}
                className="px-3 py-1 bg-secondary text-sm rounded-full"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

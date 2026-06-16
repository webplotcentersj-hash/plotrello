import type { ShopifyMoney, ShopifyProduct, ShopifyProductVariant } from './types'

export function formatPrice(money: ShopifyMoney): string {
  const amount = parseFloat(money.amount)
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: money.currencyCode,
  }).format(amount)
}

export function getProductImages(product: ShopifyProduct) {
  return product.images.edges.map((edge) => edge.node)
}

export function getProductVariants(product: ShopifyProduct): ShopifyProductVariant[] {
  return product.variants.edges.map((edge) => edge.node)
}

export function getDefaultVariant(product: ShopifyProduct): ShopifyProductVariant | null {
  const variants = getProductVariants(product)
  return variants.find((v) => v.availableForSale) || variants[0] || null
}

export function hasDiscount(product: ShopifyProduct): boolean {
  const compareAt = parseFloat(product.compareAtPriceRange.minVariantPrice.amount)
  const price = parseFloat(product.priceRange.minVariantPrice.amount)
  return compareAt > price
}

export function getDiscountPercentage(product: ShopifyProduct): number {
  const compareAt = parseFloat(product.compareAtPriceRange.minVariantPrice.amount)
  const price = parseFloat(product.priceRange.minVariantPrice.amount)
  if (compareAt <= price) return 0
  return Math.round(((compareAt - price) / compareAt) * 100)
}

export function variantHasDiscount(variant: ShopifyProductVariant): boolean {
  if (!variant.compareAtPrice) return false
  const compareAt = parseFloat(variant.compareAtPrice.amount)
  const price = parseFloat(variant.price.amount)
  return compareAt > price
}

export function getVariantDiscountPercentage(variant: ShopifyProductVariant): number {
  if (!variant.compareAtPrice) return 0
  const compareAt = parseFloat(variant.compareAtPrice.amount)
  const price = parseFloat(variant.price.amount)
  if (compareAt <= price) return 0
  return Math.round(((compareAt - price) / compareAt) * 100)
}

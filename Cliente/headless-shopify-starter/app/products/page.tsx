import { Suspense } from 'react'
import { getProducts } from '@/lib/shopify/client'
import { ProductCard } from '@/components/product/product-card'
import { ProductFilters } from '@/components/product/product-filters'
import { Spinner } from '@/components/ui/spinner'

interface ProductsPageProps {
  searchParams: Promise<{
    sort?: string
    type?: string
  }>
}

export const metadata = {
  title: 'All Products | Shop',
  description: 'Browse our complete collection of premium products.',
}

async function ProductGrid({ sort, type }: { sort?: string; type?: string }) {
  let sortKey = 'BEST_SELLING'
  let reverse = false

  switch (sort) {
    case 'newest':
      sortKey = 'CREATED_AT'
      reverse = true
      break
    case 'price-asc':
      sortKey = 'PRICE'
      reverse = false
      break
    case 'price-desc':
      sortKey = 'PRICE'
      reverse = true
      break
    case 'title-asc':
      sortKey = 'TITLE'
      reverse = false
      break
    case 'title-desc':
      sortKey = 'TITLE'
      reverse = true
      break
    default:
      sortKey = 'BEST_SELLING'
  }

  const products = await getProducts({
    first: 24,
    sortKey,
    reverse,
    query: type ? `product_type:${type}` : undefined,
  })

  if (products.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground mb-4">No products found</p>
        <p className="text-sm text-muted-foreground">
          Connect your Shopify store to display products here.
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 lg:gap-6">
      {products.map((product, index) => (
        <ProductCard key={product.id} product={product} priority={index < 8} />
      ))}
    </div>
  )
}

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const { sort, type } = await searchParams

  return (
    <div className="min-h-screen">
      {/* Header */}
      <section className="py-12 lg:py-16 border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-primary font-medium tracking-widest uppercase mb-2">
            Shop
          </p>
          <h1 className="font-heading text-4xl lg:text-6xl tracking-wider text-foreground">
            ALL PRODUCTS
          </h1>
        </div>
      </section>

      {/* Filters & Products */}
      <section className="py-8 lg:py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <ProductFilters currentSort={sort} currentType={type} />

          <Suspense
            fallback={
              <div className="flex items-center justify-center py-16">
                <Spinner className="w-8 h-8 text-primary" />
              </div>
            }
          >
            <ProductGrid sort={sort} type={type} />
          </Suspense>
        </div>
      </section>
    </div>
  )
}

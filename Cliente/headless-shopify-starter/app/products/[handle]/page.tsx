import { notFound } from 'next/navigation'
import { getProductByHandle, getProducts } from '@/lib/shopify/client'
import { ProductGallery } from '@/components/product/product-gallery'
import { ProductInfo } from '@/components/product/product-info'
import { ProductCard } from '@/components/product/product-card'

interface ProductPageProps {
  params: Promise<{ handle: string }>
}

export async function generateMetadata({ params }: ProductPageProps) {
  const { handle } = await params
  const product = await getProductByHandle(handle)

  if (!product) {
    return { title: 'Product Not Found' }
  }

  return {
    title: `${product.title} | Shop`,
    description: product.description || `Shop ${product.title}`,
    openGraph: {
      title: product.title,
      description: product.description,
      images: product.featuredImage ? [{ url: product.featuredImage.url }] : [],
    },
  }
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { handle } = await params
  const product = await getProductByHandle(handle)

  if (!product) {
    notFound()
  }

  // Get related products (same product type or just featured)
  const allProducts = await getProducts({ first: 8 })
  const relatedProducts = allProducts
    .filter((p) => p.id !== product.id)
    .slice(0, 4)

  return (
    <div className="min-h-screen">
      {/* Product Section */}
      <section className="py-8 lg:py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-16">
            <ProductGallery product={product} />
            <ProductInfo product={product} />
          </div>
        </div>
      </section>

      {/* Product Description */}
      {product.descriptionHtml && (
        <section className="py-12 lg:py-16 border-t border-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="font-heading text-2xl tracking-wider text-foreground mb-6">
              DETAILS
            </h2>
            <div
              className="prose prose-invert max-w-3xl text-muted-foreground"
              dangerouslySetInnerHTML={{ __html: product.descriptionHtml }}
            />
          </div>
        </section>
      )}

      {/* Related Products */}
      {relatedProducts.length > 0 && (
        <section className="py-12 lg:py-16 border-t border-border bg-secondary">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="font-heading text-3xl tracking-wider text-foreground mb-8">
              YOU MAY ALSO LIKE
            </h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
              {relatedProducts.map((relatedProduct) => (
                <ProductCard key={relatedProduct.id} product={relatedProduct} />
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  )
}

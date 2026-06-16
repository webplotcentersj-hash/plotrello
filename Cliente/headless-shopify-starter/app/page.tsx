import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight, Truck, Shield, RefreshCw } from 'lucide-react'
import { getFeaturedProducts, getCollections } from '@/lib/shopify/client'
import { ProductCard } from '@/components/product/product-card'
import { Button } from '@/components/ui/button'
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion'
import { HeroSection } from '@/components/home/hero-section'

const features = [
  {
    icon: Truck,
    title: 'Free Shipping',
    description: 'On orders over $100',
  },
  {
    icon: Shield,
    title: 'Secure Payment',
    description: '100% secure checkout',
  },
  {
    icon: RefreshCw,
    title: 'Easy Returns',
    description: '30-day return policy',
  },
]

export default async function HomePage() {
  const [products, collections] = await Promise.all([
    getFeaturedProducts(8),
    getCollections(),
  ])

  const featuredCollection = collections[0]

  return (
    <div className="min-h-screen">
      {/* Hero Section with Scroll Velocity Marquee */}
      <HeroSection />

      {/* Features */}
      <section className="py-8 lg:py-12 border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-3 gap-2 sm:gap-4 lg:gap-8">
            {features.map((feature) => (
              <div 
                key={feature.title} 
                className="flex flex-col items-center text-center p-3 sm:p-6 bg-secondary/50 rounded-xl border border-border/50 hover:border-primary/30 transition-colors"
              >
                <div className="p-2 sm:p-3 bg-primary/10 rounded-full mb-2 sm:mb-4">
                  <feature.icon className="w-4 h-4 sm:w-6 sm:h-6 text-primary" />
                </div>
                <h3 className="font-heading text-xs sm:text-sm lg:text-base tracking-wider text-foreground mb-0.5 sm:mb-1">
                  {feature.title.toUpperCase()}
                </h3>
                <p className="text-[10px] sm:text-xs lg:text-sm text-muted-foreground hidden sm:block">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Products */}
      <section className="py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between mb-12">
            <div>
              <p className="text-primary font-medium tracking-widest uppercase mb-2">
                Curated Selection
              </p>
              <h2 className="font-heading text-4xl lg:text-5xl tracking-wider text-foreground">
                FEATURED PRODUCTS
              </h2>
            </div>
            <Link
              href="/products"
              className="hidden sm:flex items-center gap-2 text-foreground hover:text-primary transition-colors"
            >
              View All
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {products.length > 0 ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
              {products.map((product, index) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  priority={index < 4}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <p className="text-muted-foreground mb-4">No products found</p>
              <p className="text-sm text-muted-foreground">
                Connect your Shopify store to display products here.
              </p>
            </div>
          )}

          <div className="mt-8 text-center sm:hidden">
            <Button asChild variant="outline">
              <Link href="/products">View All Products</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Featured Collection Banner */}
      {featuredCollection && (
        <section className="py-16 lg:py-24 bg-secondary">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-8 lg:gap-16 items-center">
              <div className="order-2 lg:order-1">
                <p className="text-primary font-medium tracking-widest uppercase mb-4">
                  Featured Collection
                </p>
                <h2 className="font-heading text-4xl lg:text-6xl tracking-wider text-foreground mb-6">
                  {featuredCollection.title.toUpperCase()}
                </h2>
                <p className="text-lg text-muted-foreground mb-8 max-w-lg">
                  {featuredCollection.description || 'Explore our carefully curated collection of premium products designed to elevate your everyday experience.'}
                </p>
                <Button
                  asChild
                  size="lg"
                  className="bg-primary text-primary-foreground hover:bg-primary/90 font-heading text-lg tracking-wider"
                >
                  <Link href={`/products`}>
                    EXPLORE COLLECTION
                    <ArrowRight className="ml-2 w-5 h-5" />
                  </Link>
                </Button>
              </div>
              <div className="order-1 lg:order-2 relative aspect-square lg:aspect-[4/5] bg-muted rounded-lg overflow-hidden">
                {featuredCollection.image ? (
                  <Image
                    src={featuredCollection.image.url}
                    alt={featuredCollection.image.altText || featuredCollection.title}
                    fill
                    className="object-cover"
                    sizes="(max-width: 1024px) 100vw, 50vw"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Image
                      src="/logo.png"
                      alt="Collection"
                      width={200}
                      height={200}
                      className="opacity-20 invert"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* FAQ Section */}
      <section className="py-16 lg:py-24">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <p className="text-primary font-medium tracking-widest uppercase mb-4">
              Help Center
            </p>
            <h2 className="font-heading text-4xl lg:text-5xl tracking-wider text-foreground">
              FREQUENTLY ASKED QUESTIONS
            </h2>
          </div>

          <Accordion type="single" collapsible className="space-y-4">
            <AccordionItem value="item-1" className="border-0">
              <div className="bg-secondary/50 border border-border/50 rounded-xl overflow-hidden hover:border-primary/30 transition-colors">
                <AccordionTrigger className="px-6 py-4 hover:no-underline">
                  <span className="font-heading tracking-wider text-foreground">What is your shipping policy?</span>
                </AccordionTrigger>
                <AccordionContent className="px-6 pb-4 pt-0">
                  <p className="text-muted-foreground">
                    We offer free standard shipping on all orders over $100. Standard shipping takes 5-7 business days. Express shipping is available for an additional fee. International shipping is available to select countries with calculated rates at checkout.
                  </p>
                </AccordionContent>
              </div>
            </AccordionItem>

            <AccordionItem value="item-2" className="border-0">
              <div className="bg-secondary/50 border border-border/50 rounded-xl overflow-hidden hover:border-primary/30 transition-colors">
                <AccordionTrigger className="px-6 py-4 hover:no-underline">
                  <span className="font-heading tracking-wider text-foreground">What is your return policy?</span>
                </AccordionTrigger>
                <AccordionContent className="px-6 pb-4 pt-0">
                  <p className="text-muted-foreground">
                    We accept returns within 30 days of purchase. Items must be unworn, unwashed, and in original packaging. Contact our customer service team to initiate a return. Refunds are processed within 5-10 business days after we receive your item.
                  </p>
                </AccordionContent>
              </div>
            </AccordionItem>

            <AccordionItem value="item-3" className="border-0">
              <div className="bg-secondary/50 border border-border/50 rounded-xl overflow-hidden hover:border-primary/30 transition-colors">
                <AccordionTrigger className="px-6 py-4 hover:no-underline">
                  <span className="font-heading tracking-wider text-foreground">Do you ship internationally?</span>
                </AccordionTrigger>
                <AccordionContent className="px-6 pb-4 pt-0">
                  <p className="text-muted-foreground">
                    Yes! We ship to over 30 countries worldwide. International shipping rates and delivery times vary by location. All international orders may be subject to customs duties and taxes. You can calculate shipping costs at checkout.
                  </p>
                </AccordionContent>
              </div>
            </AccordionItem>

            <AccordionItem value="item-4" className="border-0">
              <div className="bg-secondary/50 border border-border/50 rounded-xl overflow-hidden hover:border-primary/30 transition-colors">
                <AccordionTrigger className="px-6 py-4 hover:no-underline">
                  <span className="font-heading tracking-wider text-foreground">How can I track my order?</span>
                </AccordionTrigger>
                <AccordionContent className="px-6 pb-4 pt-0">
                  <p className="text-muted-foreground">
                    Once your order ships, you will receive an email with tracking information. You can also check your order status in your account dashboard. Tracking links provide real-time updates on your package's location and estimated delivery date.
                  </p>
                </AccordionContent>
              </div>
            </AccordionItem>

            <AccordionItem value="item-5" className="border-0">
              <div className="bg-secondary/50 border border-border/50 rounded-xl overflow-hidden hover:border-primary/30 transition-colors">
                <AccordionTrigger className="px-6 py-4 hover:no-underline">
                  <span className="font-heading tracking-wider text-foreground">What payment methods do you accept?</span>
                </AccordionTrigger>
                <AccordionContent className="px-6 pb-4 pt-0">
                  <p className="text-muted-foreground">
                    We accept all major credit cards (Visa, Mastercard, American Express), PayPal, Apple Pay, and Google Pay. All payments are processed securely with 256-bit encryption. Your payment information is never stored on our servers.
                  </p>
                </AccordionContent>
              </div>
            </AccordionItem>
          </Accordion>
        </div>
      </section>

      {/* Newsletter / CTA */}
      <section className="py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-card border border-border rounded-2xl p-8 lg:p-16 text-center">
            <p className="text-primary font-medium tracking-widest uppercase mb-4">
              Stay Connected
            </p>
            <h2 className="font-heading text-4xl lg:text-5xl tracking-wider text-foreground mb-6">
              JOIN THE MOVEMENT
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
              Be the first to know about new arrivals, exclusive offers, and style inspiration.
            </p>
            <form className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto">
              <input
                type="email"
                placeholder="Enter your email"
                className="flex-1 bg-secondary border border-border rounded-lg px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
              <Button
                type="submit"
                className="bg-primary text-primary-foreground hover:bg-primary/90 font-heading tracking-wider px-8"
              >
                SUBSCRIBE
              </Button>
            </form>
          </div>
        </div>
      </section>
    </div>
  )
}

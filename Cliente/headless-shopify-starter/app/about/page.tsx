import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, Target, Heart, Sparkles, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'

export const metadata = {
  title: 'About Us | Our Story',
  description: 'Learn about our mission, values, and the team behind the brand.',
}

const values = [
  {
    icon: Target,
    title: 'Quality First',
    description:
      'We source only the finest materials and work with skilled artisans to create products that stand the test of time.',
  },
  {
    icon: Heart,
    title: 'Customer Focus',
    description:
      'Your satisfaction is our priority. We listen, adapt, and constantly improve based on your feedback.',
  },
  {
    icon: Sparkles,
    title: 'Innovation',
    description:
      'We push boundaries and embrace new ideas to bring you fresh, exciting products that inspire.',
  },
  {
    icon: Users,
    title: 'Community',
    description:
      'We believe in building connections and creating a community of like-minded individuals who share our passion.',
  },
]

const stats = [
  { number: '50K+', label: 'Happy Customers' },
  { number: '100+', label: 'Products' },
  { number: '30+', label: 'Countries' },
  { number: '99%', label: 'Satisfaction' },
]

export default function AboutPage() {
  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div>
              <p className="text-primary font-medium tracking-widest uppercase mb-4">
                Our Story
              </p>
              <h1 className="font-heading text-5xl lg:text-6xl tracking-wider text-foreground mb-6">
                CRAFTED WITH
                <br />
                <span className="text-primary">PASSION</span>
              </h1>
              <p className="text-lg text-muted-foreground mb-6 leading-relaxed">
                We started with a simple belief: everyone deserves access to premium quality products that elevate their everyday experience. What began as a small passion project has grown into a brand trusted by thousands worldwide.
              </p>
              <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
                Every product in our collection is carefully curated to meet our exacting standards for quality, design, and sustainability. We partner with skilled craftspeople and ethical manufacturers who share our vision.
              </p>
              <Button
                asChild
                size="lg"
                className="bg-primary text-primary-foreground hover:bg-primary/90 font-heading text-lg tracking-wider"
              >
                <Link href="/products">
                  EXPLORE PRODUCTS
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Link>
              </Button>
            </div>
            <div className="relative aspect-square lg:aspect-[4/5] bg-secondary rounded-lg overflow-hidden">
              <Image
                src="/logo.png"
                alt="Our Brand"
                fill
                className="object-contain p-16 opacity-20 invert"
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <p className="font-heading text-6xl lg:text-8xl text-foreground tracking-wider">
                    EST.
                  </p>
                  <p className="font-heading text-8xl lg:text-9xl text-primary tracking-wider">
                    2024
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 lg:py-20 bg-secondary">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="font-heading text-5xl lg:text-6xl text-primary tracking-wider mb-2">
                  {stat.number}
                </p>
                <p className="text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 lg:mb-16">
            <p className="text-primary font-medium tracking-widest uppercase mb-4">
              What Drives Us
            </p>
            <h2 className="font-heading text-4xl lg:text-5xl tracking-wider text-foreground">
              OUR VALUES
            </h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {values.map((value) => (
              <div
                key={value.title}
                className="bg-card border border-border rounded-lg p-6 hover:border-primary/50 transition-colors"
              >
                <div className="w-12 h-12 bg-secondary rounded-lg flex items-center justify-center mb-4">
                  <value.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-heading text-xl tracking-wider text-foreground mb-2">
                  {value.title.toUpperCase()}
                </h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {value.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Mission */}
      <section className="py-16 lg:py-24 bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            <p className="text-primary font-medium tracking-widest uppercase mb-4">
              Our Mission
            </p>
            <h2 className="font-heading text-4xl lg:text-5xl tracking-wider text-foreground mb-8">
              ELEVATING EVERYDAY EXPERIENCES
            </h2>
            <p className="text-xl text-muted-foreground leading-relaxed mb-8">
              We believe that exceptional products have the power to transform ordinary moments into extraordinary ones. Our mission is to curate and deliver premium quality goods that inspire confidence, spark joy, and stand the test of time.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button
                asChild
                size="lg"
                className="bg-primary text-primary-foreground hover:bg-primary/90 font-heading text-lg tracking-wider"
              >
                <Link href="/products">SHOP NOW</Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="border-foreground text-foreground hover:bg-foreground hover:text-background font-heading text-lg tracking-wider"
              >
                <Link href="/contact">CONTACT US</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

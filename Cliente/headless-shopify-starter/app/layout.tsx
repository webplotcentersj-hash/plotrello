import type { Metadata } from 'next'
import { Bebas_Neue, Jost } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { CartProvider } from '@/components/cart/cart-provider'
import { PillNav } from '@/components/layout/pill-nav'
import { Footer } from '@/components/layout/footer'
import { CartDrawer } from '@/components/cart/cart-drawer'
import './globals.css'

const bebasNeue = Bebas_Neue({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-heading',
})

const jost = Jost({
  subsets: ['latin'],
  variable: '--font-sans',
})

export const metadata: Metadata = {
  title: 'Premium Storefront',
  description: 'Shop the latest collection',
  icons: {
    icon: '/logo.png',
  },
}

const navItems = [
  { label: 'Home', href: '/' },
  { label: 'Shop', href: '/products' },
  { label: 'About', href: '/about' },
  { label: 'Contact', href: '/contact' },
]

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${bebasNeue.variable} ${jost.variable} bg-background`}>
      <body className="font-sans antialiased">
        <CartProvider>
          <PillNav items={navItems} />
          <main className="min-h-screen pt-10 bg-background">{children}</main>
          <Footer />
          <CartDrawer />
        </CartProvider>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}

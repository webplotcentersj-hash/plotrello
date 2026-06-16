'use client'

import { motion } from 'framer-motion'

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <section className="py-16 lg:py-24 border-b border-border">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.span 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-primary text-sm tracking-[0.2em] uppercase"
          >
            Legal
          </motion.span>
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="font-heading text-4xl sm:text-5xl lg:text-6xl text-foreground mt-4"
          >
            TERMS OF SERVICE
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-muted-foreground mt-4"
          >
            Last updated: January 2025
          </motion.p>
        </div>
      </section>

      {/* Content */}
      <section className="py-12 lg:py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="prose prose-invert prose-lg max-w-none"
          >
            <div className="space-y-12">
              <div className="space-y-4">
                <h2 className="font-heading text-2xl text-foreground tracking-wide">
                  ACCEPTANCE OF TERMS
                </h2>
                <p className="text-muted-foreground leading-relaxed">
                  By accessing and using this website, you accept and agree to be bound by the terms and 
                  provision of this agreement. If you do not agree to abide by these terms, please do not 
                  use this site. We reserve the right to update these terms at any time without prior notice.
                </p>
              </div>

              <div className="space-y-4">
                <h2 className="font-heading text-2xl text-foreground tracking-wide">
                  USE OF SITE
                </h2>
                <p className="text-muted-foreground leading-relaxed">
                  You agree to use this site only for lawful purposes. You are prohibited from posting or 
                  transmitting any unlawful, threatening, defamatory, or obscene material. We reserve the 
                  right to terminate your access to the site without notice if you violate these terms.
                </p>
              </div>

              <div className="space-y-4">
                <h2 className="font-heading text-2xl text-foreground tracking-wide">
                  PRODUCTS & SERVICES
                </h2>
                <p className="text-muted-foreground leading-relaxed">
                  All products and services are subject to availability. We reserve the right to discontinue 
                  any product at any time. Prices for products are subject to change without notice. We shall 
                  not be liable to you or any third party for any modification, price change, suspension, or 
                  discontinuance of any product.
                </p>
              </div>

              <div className="space-y-4">
                <h2 className="font-heading text-2xl text-foreground tracking-wide">
                  ORDERS & PAYMENT
                </h2>
                <p className="text-muted-foreground leading-relaxed">
                  When you place an order, you are offering to purchase a product subject to these terms. 
                  All orders are subject to acceptance and availability. We reserve the right to refuse or 
                  cancel any order for any reason. Payment must be received prior to the dispatch of goods.
                </p>
              </div>

              <div className="space-y-4">
                <h2 className="font-heading text-2xl text-foreground tracking-wide">
                  SHIPPING & DELIVERY
                </h2>
                <p className="text-muted-foreground leading-relaxed">
                  Shipping times are estimates and are not guaranteed. We are not responsible for delays 
                  caused by shipping carriers, customs, or other factors outside our control. Risk of loss 
                  and title for items purchased pass to you upon delivery to the carrier.
                </p>
              </div>

              <div className="space-y-4">
                <h2 className="font-heading text-2xl text-foreground tracking-wide">
                  RETURNS & REFUNDS
                </h2>
                <p className="text-muted-foreground leading-relaxed">
                  We accept returns within 30 days of purchase for items in their original condition. 
                  Refunds will be processed to the original payment method within 5-10 business days after 
                  we receive the returned item. Shipping costs are non-refundable unless the return is due 
                  to our error.
                </p>
              </div>

              <div className="space-y-4">
                <h2 className="font-heading text-2xl text-foreground tracking-wide">
                  INTELLECTUAL PROPERTY
                </h2>
                <p className="text-muted-foreground leading-relaxed">
                  All content on this site, including text, graphics, logos, images, and software, is the 
                  property of our company and is protected by copyright and trademark laws. You may not 
                  reproduce, distribute, or create derivative works from any content without our express 
                  written permission.
                </p>
              </div>

              <div className="space-y-4">
                <h2 className="font-heading text-2xl text-foreground tracking-wide">
                  LIMITATION OF LIABILITY
                </h2>
                <p className="text-muted-foreground leading-relaxed">
                  We shall not be liable for any indirect, incidental, special, consequential, or punitive 
                  damages arising out of your use of or inability to use the site. Our total liability to 
                  you for any claim arising from your use of the site shall not exceed the amount you paid 
                  for the products in question.
                </p>
              </div>

              <div className="space-y-4">
                <h2 className="font-heading text-2xl text-foreground tracking-wide">
                  CONTACT
                </h2>
                <p className="text-muted-foreground leading-relaxed">
                  If you have any questions about these Terms of Service, please contact us through our 
                  contact page. We will do our best to respond to your inquiry in a timely manner.
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  )
}

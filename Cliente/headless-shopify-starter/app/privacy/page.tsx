'use client'

import { motion } from 'framer-motion'

export default function PrivacyPage() {
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
            PRIVACY POLICY
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
                  INFORMATION WE COLLECT
                </h2>
                <p className="text-muted-foreground leading-relaxed">
                  We collect information you provide directly to us, such as when you create an account, 
                  make a purchase, subscribe to our newsletter, or contact us for support. This may include 
                  your name, email address, shipping address, payment information, and any other information 
                  you choose to provide.
                </p>
              </div>

              <div className="space-y-4">
                <h2 className="font-heading text-2xl text-foreground tracking-wide">
                  HOW WE USE YOUR INFORMATION
                </h2>
                <p className="text-muted-foreground leading-relaxed">
                  We use the information we collect to process transactions, send you order confirmations, 
                  respond to your comments and questions, send you marketing communications (with your consent), 
                  and improve our services. We may also use the information to personalize your shopping experience.
                </p>
              </div>

              <div className="space-y-4">
                <h2 className="font-heading text-2xl text-foreground tracking-wide">
                  INFORMATION SHARING
                </h2>
                <p className="text-muted-foreground leading-relaxed">
                  We do not sell, trade, or rent your personal information to third parties. We may share 
                  your information with trusted service providers who assist us in operating our website, 
                  conducting our business, or servicing you, so long as those parties agree to keep this 
                  information confidential.
                </p>
              </div>

              <div className="space-y-4">
                <h2 className="font-heading text-2xl text-foreground tracking-wide">
                  DATA SECURITY
                </h2>
                <p className="text-muted-foreground leading-relaxed">
                  We implement a variety of security measures to maintain the safety of your personal 
                  information. Your personal information is contained behind secured networks and is only 
                  accessible by a limited number of persons who have special access rights to such systems.
                </p>
              </div>

              <div className="space-y-4">
                <h2 className="font-heading text-2xl text-foreground tracking-wide">
                  COOKIES
                </h2>
                <p className="text-muted-foreground leading-relaxed">
                  We use cookies to help us remember and process the items in your shopping cart, understand 
                  and save your preferences for future visits, and compile aggregate data about site traffic 
                  and site interaction so that we can offer better site experiences and tools in the future.
                </p>
              </div>

              <div className="space-y-4">
                <h2 className="font-heading text-2xl text-foreground tracking-wide">
                  YOUR RIGHTS
                </h2>
                <p className="text-muted-foreground leading-relaxed">
                  You have the right to access, correct, or delete your personal information at any time. 
                  You may also opt out of receiving marketing communications from us. To exercise these rights, 
                  please contact us using the information provided on our contact page.
                </p>
              </div>

              <div className="space-y-4">
                <h2 className="font-heading text-2xl text-foreground tracking-wide">
                  CONTACT US
                </h2>
                <p className="text-muted-foreground leading-relaxed">
                  If you have any questions about this Privacy Policy, please contact us through our 
                  contact page or email us directly. We are committed to resolving any concerns you may have.
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  )
}

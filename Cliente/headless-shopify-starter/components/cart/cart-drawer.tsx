'use client'

import { useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Minus, Plus, ShoppingCart, CreditCard, Trash2 } from 'lucide-react'
import { useCart } from './cart-provider'
import { formatPrice } from '@/lib/shopify/utils'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import NumberFlow from '@number-flow/react'

export function CartDrawer() {
  const {
    cart,
    isOpen,
    isLoading,
    cartLines,
    totalQuantity,
    closeCart,
    updateQuantity,
    removeFromCart,
  } = useCart()

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeCart()
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [closeCart])

  const subtotal = cart?.cost.subtotalAmount
    ? parseFloat(cart.cost.subtotalAmount.amount)
    : 0

  return (
    <>
      {/* Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40"
            onClick={closeCart}
            aria-hidden="true"
          />
        )}
      </AnimatePresence>

      {/* Drawer */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className={cn(
              'fixed top-0 right-0 h-full w-full max-w-md z-50',
              'flex flex-col',
              'bg-card border-l border-border'
            )}
            role="dialog"
            aria-modal="true"
            aria-label="Shopping cart"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-border">
              <div className="flex items-center gap-3">
                <ShoppingCart className="w-5 h-5 text-primary" />
                <h2 className="font-heading text-2xl tracking-wide text-foreground">
                  YOUR BAG
                </h2>
                <AnimatePresence mode="wait">
                  {totalQuantity > 0 && (
                    <motion.span
                      key={totalQuantity}
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.5, opacity: 0 }}
                      className="bg-primary text-primary-foreground text-xs font-medium px-2.5 py-1 rounded-full"
                    >
                      {totalQuantity}
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                onClick={closeCart}
                className="p-2 hover:bg-secondary rounded-full transition-colors"
                aria-label="Close cart"
              >
                <X className="w-5 h-5" />
              </motion.button>
            </div>

            {/* Cart Items */}
            <div className="flex-1 overflow-y-auto p-6">
              {cartLines.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col items-center justify-center h-full text-center"
                >
                  <motion.div
                    initial={{ scale: 0.8 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.1 }}
                  >
                    <ShoppingCart className="w-20 h-20 text-muted-foreground/30 mb-6" />
                  </motion.div>
                  <p className="text-muted-foreground text-lg mb-6">Your bag is empty</p>
                  <Button onClick={closeCart} asChild className="gap-2">
                    <Link href="/products">
                      Continue Shopping
                    </Link>
                  </Button>
                </motion.div>
              ) : (
                <motion.ul layout className="space-y-4">
                  <AnimatePresence initial={false} mode="popLayout">
                    {cartLines.map((line) => (
                      <motion.li
                        key={line.id}
                        layout
                        initial={{ opacity: 0, scale: 0.96, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.96, x: 20 }}
                        transition={{
                          opacity: { duration: 0.2 },
                          layout: { duration: 0.25 },
                        }}
                        className={cn(
                          'flex gap-4 p-4 rounded-xl',
                          'bg-secondary/50',
                          'border border-border/50',
                          'hover:border-border transition-colors duration-200'
                        )}
                      >
                        {/* Product Image */}
                        <Link
                          href={`/products/${line.merchandise.product.handle}`}
                          onClick={closeCart}
                          className={cn(
                            'relative w-20 h-20 rounded-lg overflow-hidden flex-shrink-0',
                            'bg-secondary',
                            'transition-transform duration-200 hover:scale-105'
                          )}
                        >
                          {line.merchandise.product.featuredImage ? (
                            <Image
                              src={line.merchandise.product.featuredImage.url}
                              alt={
                                line.merchandise.product.featuredImage.altText ||
                                line.merchandise.product.title
                              }
                              fill
                              className="object-cover"
                              sizes="80px"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <ShoppingCart className="w-6 h-6 text-muted-foreground" />
                            </div>
                          )}
                        </Link>

                        {/* Product Details */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <Link
                              href={`/products/${line.merchandise.product.handle}`}
                              onClick={closeCart}
                              className="block"
                            >
                              <h3 className="font-medium text-foreground text-sm leading-tight hover:text-primary transition-colors line-clamp-2">
                                {line.merchandise.product.title}
                              </h3>
                            </Link>
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => removeFromCart(line.id)}
                              disabled={isLoading}
                              className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                              aria-label="Remove item"
                            >
                              <Trash2 className="w-4 h-4" />
                            </motion.button>
                          </div>

                          {line.merchandise.title !== 'Default Title' && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {line.merchandise.selectedOptions
                                .map((opt) => opt.value)
                                .join(' / ')}
                            </p>
                          )}

                          <div className="flex items-center justify-between mt-3">
                            {/* Quantity Controls */}
                            <div className="flex items-center gap-1">
                              <motion.button
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() =>
                                  updateQuantity(line.id, Math.max(0, line.quantity - 1))
                                }
                                disabled={isLoading}
                                className={cn(
                                  'p-1.5 rounded-md transition-colors',
                                  'bg-background hover:bg-primary hover:text-primary-foreground',
                                  'disabled:opacity-50'
                                )}
                                aria-label="Decrease quantity"
                              >
                                <Minus className="w-3 h-3" />
                              </motion.button>
                              <motion.span
                                layout
                                className="w-8 text-center text-sm font-medium"
                              >
                                {line.quantity}
                              </motion.span>
                              <motion.button
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => updateQuantity(line.id, line.quantity + 1)}
                                disabled={isLoading}
                                className={cn(
                                  'p-1.5 rounded-md transition-colors',
                                  'bg-background hover:bg-primary hover:text-primary-foreground',
                                  'disabled:opacity-50'
                                )}
                                aria-label="Increase quantity"
                              >
                                <Plus className="w-3 h-3" />
                              </motion.button>
                            </div>

                            {/* Price */}
                            <motion.span
                              layout
                              className="text-sm font-medium text-primary"
                            >
                              {formatPrice({
                                amount: String(
                                  parseFloat(line.merchandise.price.amount) * line.quantity
                                ),
                                currencyCode: line.merchandise.price.currencyCode,
                              })}
                            </motion.span>
                          </div>
                        </div>
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </motion.ul>
              )}
            </div>

            {/* Footer */}
            <AnimatePresence>
              {cartLines.length > 0 && cart && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  className="p-6 border-t border-border space-y-4 bg-card"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="text-xl font-semibold text-foreground">
                      <NumberFlow
                        value={subtotal}
                        format={{
                          style: 'currency',
                          currency: cart.cost.subtotalAmount.currencyCode,
                        }}
                      />
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Shipping and taxes calculated at checkout.
                  </p>
                  <motion.div
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                  >
                    <Button
                      asChild
                      className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-heading text-lg tracking-wider gap-2"
                      size="lg"
                    >
                      <a href={cart.checkoutUrl}>
                        <CreditCard className="w-5 h-5" />
                        CHECKOUT
                      </a>
                    </Button>
                  </motion.div>
                  <button
                    onClick={closeCart}
                    className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
                  >
                    Continue Shopping
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

const slides = [
  {
    image: '/images/hero-model-1.jpeg',
    alt: 'Acid wash hoodie',
  },
  {
    image: '/images/hero-model-2.jpeg',
    alt: 'Black hoodie',
  },
]

export function HeroSection() {
  const [currentSlide, setCurrentSlide] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length)
    }, 5000)
    return () => clearInterval(timer)
  }, [])

  return (
    <section className="relative h-screen w-full overflow-hidden">
      {/* Background Images */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentSlide}
          initial={{ opacity: 0, scale: 1.1 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8 }}
          className="absolute inset-0"
        >
          <Image
            src={slides[currentSlide].image}
            alt={slides[currentSlide].alt}
            fill
            className="object-cover object-center"
            priority
            sizes="100vw"
          />
          {/* Dark overlay for text readability */}
          <div className="absolute inset-0 bg-black/40" />
        </motion.div>
      </AnimatePresence>

      {/* Content */}
      <div className="relative z-10 h-full flex flex-col items-center justify-center text-center px-4">
        <motion.span
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-primary text-sm tracking-[0.3em] uppercase mb-6"
        >
          New Collection
        </motion.span>

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="font-heading text-6xl sm:text-7xl md:text-8xl lg:text-9xl text-white tracking-wider mb-6"
        >
          DRIPNEX
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="text-white/80 text-lg md:text-xl max-w-md mb-10"
        >
          Premium streetwear for the bold
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Button
            asChild
            size="lg"
            className="bg-primary text-primary-foreground hover:bg-primary/90 font-heading tracking-wider text-lg px-10 h-14"
          >
            <Link href="/products">
              SHOP NOW
              <ArrowRight className="ml-2 w-5 h-5" />
            </Link>
          </Button>
        </motion.div>

        {/* Slide Indicators */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="absolute bottom-10 left-1/2 -translate-x-1/2 flex gap-3"
        >
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentSlide(i)}
              className={`h-1 transition-all duration-300 ${
                i === currentSlide
                  ? 'w-10 bg-primary'
                  : 'w-6 bg-white/40 hover:bg-white/60'
              }`}
            />
          ))}
        </motion.div>
      </div>
    </section>
  )
}

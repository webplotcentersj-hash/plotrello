import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center">
      <div className="text-center px-4">
        <p className="text-primary font-medium tracking-widest uppercase mb-4">
          404 Error
        </p>
        <h1 className="font-heading text-6xl lg:text-8xl tracking-wider text-foreground mb-6">
          PAGE NOT
          <br />
          <span className="text-primary">FOUND</span>
        </h1>
        <p className="text-lg text-muted-foreground max-w-md mx-auto mb-8">
          The page you are looking for does not exist or has been moved.
        </p>
        <Button
          asChild
          size="lg"
          className="bg-primary text-primary-foreground hover:bg-primary/90 font-heading text-lg tracking-wider"
        >
          <Link href="/">
            <ArrowLeft className="mr-2 w-5 h-5" />
            BACK TO HOME
          </Link>
        </Button>
      </div>
    </div>
  )
}

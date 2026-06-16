import { Spinner } from '@/components/ui/spinner'

export default function Loading() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center">
      <div className="text-center">
        <Spinner className="w-12 h-12 text-primary mx-auto mb-4" />
        <p className="text-muted-foreground">Loading...</p>
      </div>
    </div>
  )
}

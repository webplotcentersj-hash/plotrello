'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { SlidersHorizontal, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const sortOptions = [
  { value: 'best-selling', label: 'Best Selling' },
  { value: 'newest', label: 'Newest' },
  { value: 'price-asc', label: 'Price: Low to High' },
  { value: 'price-desc', label: 'Price: High to Low' },
  { value: 'title-asc', label: 'A-Z' },
  { value: 'title-desc', label: 'Z-A' },
]

interface ProductFiltersProps {
  currentSort?: string
  currentType?: string
}

export function ProductFilters({ currentSort, currentType }: ProductFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const updateFilters = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value) {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    router.push(`/products?${params.toString()}`)
  }

  const currentSortLabel =
    sortOptions.find((opt) => opt.value === currentSort)?.label || 'Best Selling'

  return (
    <div className="flex items-center justify-between mb-8 pb-4 border-b border-border">
      <div className="flex items-center gap-2">
        <SlidersHorizontal className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Filters</span>
        {currentType && (
          <button
            onClick={() => updateFilters('type', null)}
            className="ml-2 px-2 py-1 bg-secondary text-sm rounded hover:bg-secondary/80 transition-colors"
          >
            {currentType} &times;
          </button>
        )}
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="gap-2">
            Sort: {currentSortLabel}
            <ChevronDown className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {sortOptions.map((option) => (
            <DropdownMenuItem
              key={option.value}
              onClick={() => updateFilters('sort', option.value)}
              className={currentSort === option.value ? 'bg-secondary' : ''}
            >
              {option.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

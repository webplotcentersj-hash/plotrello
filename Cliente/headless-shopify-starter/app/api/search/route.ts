import { NextRequest, NextResponse } from 'next/server'
import { searchProducts } from '@/lib/shopify/client'

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q')
  const first = request.nextUrl.searchParams.get('first')

  if (!query) {
    return NextResponse.json({ error: 'Search query is required' }, { status: 400 })
  }

  try {
    const products = await searchProducts(query, first ? parseInt(first) : 20)
    return NextResponse.json({ products })
  } catch (error) {
    console.error('Error searching products:', error)
    return NextResponse.json(
      { error: 'Failed to search products' },
      { status: 500 }
    )
  }
}

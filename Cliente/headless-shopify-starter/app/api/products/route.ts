import { NextRequest, NextResponse } from 'next/server'
import { getProducts, getProductByHandle } from '@/lib/shopify/client'

export async function GET(request: NextRequest) {
  const handle = request.nextUrl.searchParams.get('handle')
  const first = request.nextUrl.searchParams.get('first')
  const sortKey = request.nextUrl.searchParams.get('sortKey')
  const reverse = request.nextUrl.searchParams.get('reverse')
  const query = request.nextUrl.searchParams.get('query')

  try {
    if (handle) {
      const product = await getProductByHandle(handle)
      if (!product) {
        return NextResponse.json({ error: 'Product not found' }, { status: 404 })
      }
      return NextResponse.json({ product })
    }

    const products = await getProducts({
      first: first ? parseInt(first) : undefined,
      sortKey: sortKey || undefined,
      reverse: reverse === 'true',
      query: query || undefined,
    })

    return NextResponse.json({ products })
  } catch (error) {
    console.error('Error fetching products:', error)
    return NextResponse.json(
      { error: 'Failed to fetch products' },
      { status: 500 }
    )
  }
}

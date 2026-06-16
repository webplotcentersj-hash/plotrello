import { NextRequest, NextResponse } from 'next/server'
import { getCollections, getCollectionByHandle } from '@/lib/shopify/client'

export async function GET(request: NextRequest) {
  const handle = request.nextUrl.searchParams.get('handle')

  try {
    if (handle) {
      const collection = await getCollectionByHandle(handle)
      if (!collection) {
        return NextResponse.json({ error: 'Collection not found' }, { status: 404 })
      }
      return NextResponse.json({ collection })
    }

    const collections = await getCollections()
    return NextResponse.json({ collections })
  } catch (error) {
    console.error('Error fetching collections:', error)
    return NextResponse.json(
      { error: 'Failed to fetch collections' },
      { status: 500 }
    )
  }
}

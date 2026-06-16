import { NextRequest, NextResponse } from 'next/server'
import {
  createCart,
  getCart,
  addToCart,
  updateCart,
  removeFromCart,
} from '@/lib/shopify/client'

export async function GET(request: NextRequest) {
  const cartId = request.nextUrl.searchParams.get('cartId')

  if (!cartId) {
    return NextResponse.json({ error: 'Cart ID is required' }, { status: 400 })
  }

  try {
    const cart = await getCart(cartId)
    return NextResponse.json({ cart })
  } catch (error) {
    console.error('Error fetching cart:', error)
    return NextResponse.json({ error: 'Failed to fetch cart' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { action, cartId, lines, lineIds } = body

  try {
    let cart

    switch (action) {
      case 'create':
        cart = await createCart()
        break

      case 'add':
        if (!cartId || !lines) {
          return NextResponse.json(
            { error: 'Cart ID and lines are required' },
            { status: 400 }
          )
        }
        cart = await addToCart(cartId, lines)
        break

      case 'update':
        if (!cartId || !lines) {
          return NextResponse.json(
            { error: 'Cart ID and lines are required' },
            { status: 400 }
          )
        }
        cart = await updateCart(cartId, lines)
        break

      case 'remove':
        if (!cartId || !lineIds) {
          return NextResponse.json(
            { error: 'Cart ID and line IDs are required' },
            { status: 400 }
          )
        }
        cart = await removeFromCart(cartId, lineIds)
        break

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    return NextResponse.json({ cart })
  } catch (error) {
    console.error('Error processing cart action:', error)
    return NextResponse.json(
      { error: 'Failed to process cart action' },
      { status: 500 }
    )
  }
}

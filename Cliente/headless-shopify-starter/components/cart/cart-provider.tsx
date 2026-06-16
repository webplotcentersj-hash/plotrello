'use client'

import {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react'
import type { ShopifyCart, ShopifyCartLine } from '@/lib/shopify/types'

const CART_ID_KEY = 'shopify_cart_id'

type CartState = {
  cart: ShopifyCart | null
  isLoading: boolean
  isOpen: boolean
}

type CartAction =
  | { type: 'SET_CART'; cart: ShopifyCart | null }
  | { type: 'SET_LOADING'; isLoading: boolean }
  | { type: 'OPEN_CART' }
  | { type: 'CLOSE_CART' }
  | { type: 'TOGGLE_CART' }

const initialState: CartState = {
  cart: null,
  isLoading: false,
  isOpen: false,
}

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'SET_CART':
      return { ...state, cart: action.cart }
    case 'SET_LOADING':
      return { ...state, isLoading: action.isLoading }
    case 'OPEN_CART':
      return { ...state, isOpen: true }
    case 'CLOSE_CART':
      return { ...state, isOpen: false }
    case 'TOGGLE_CART':
      return { ...state, isOpen: !state.isOpen }
    default:
      return state
  }
}

type CartContextType = {
  cart: ShopifyCart | null
  isLoading: boolean
  isOpen: boolean
  cartLines: ShopifyCartLine[]
  totalQuantity: number
  openCart: () => void
  closeCart: () => void
  toggleCart: () => void
  addToCart: (merchandiseId: string, quantity?: number) => Promise<void>
  updateQuantity: (lineId: string, quantity: number) => Promise<void>
  removeFromCart: (lineId: string) => Promise<void>
}

const CartContext = createContext<CartContextType | null>(null)

export function useCart() {
  const context = useContext(CartContext)
  if (!context) {
    throw new Error('useCart must be used within a CartProvider')
  }
  return context
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, initialState)

  const cartLines = state.cart?.lines.edges.map((edge) => edge.node) ?? []
  const totalQuantity = state.cart?.totalQuantity ?? 0

  const fetchCart = useCallback(async (cartId: string) => {
    try {
      const response = await fetch(`/api/cart?cartId=${encodeURIComponent(cartId)}`)
      const data = await response.json()
      if (data.cart) {
        dispatch({ type: 'SET_CART', cart: data.cart })
      } else {
        localStorage.removeItem(CART_ID_KEY)
        dispatch({ type: 'SET_CART', cart: null })
      }
    } catch (error) {
      console.error('Error fetching cart:', error)
      localStorage.removeItem(CART_ID_KEY)
    }
  }, [])

  const createNewCart = useCallback(async () => {
    try {
      const response = await fetch('/api/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create' }),
      })
      const data = await response.json()
      if (data.cart) {
        localStorage.setItem(CART_ID_KEY, data.cart.id)
        dispatch({ type: 'SET_CART', cart: data.cart })
        return data.cart.id
      }
    } catch (error) {
      console.error('Error creating cart:', error)
    }
    return null
  }, [])

  useEffect(() => {
    const cartId = localStorage.getItem(CART_ID_KEY)
    if (cartId) {
      fetchCart(cartId)
    }
  }, [fetchCart])

  const openCart = useCallback(() => dispatch({ type: 'OPEN_CART' }), [])
  const closeCart = useCallback(() => dispatch({ type: 'CLOSE_CART' }), [])
  const toggleCart = useCallback(() => dispatch({ type: 'TOGGLE_CART' }), [])

  const addToCart = useCallback(
    async (merchandiseId: string, quantity = 1) => {
      dispatch({ type: 'SET_LOADING', isLoading: true })

      try {
        let cartId = localStorage.getItem(CART_ID_KEY)

        if (!cartId) {
          cartId = await createNewCart()
        }

        if (!cartId) {
          throw new Error('Failed to create cart')
        }

        const response = await fetch('/api/cart', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'add',
            cartId,
            lines: [{ merchandiseId, quantity }],
          }),
        })

        const data = await response.json()
        if (data.cart) {
          dispatch({ type: 'SET_CART', cart: data.cart })
          dispatch({ type: 'OPEN_CART' })
        }
      } catch (error) {
        console.error('Error adding to cart:', error)
      } finally {
        dispatch({ type: 'SET_LOADING', isLoading: false })
      }
    },
    [createNewCart]
  )

  const updateQuantity = useCallback(async (lineId: string, quantity: number) => {
    const cartId = localStorage.getItem(CART_ID_KEY)
    if (!cartId) return

    dispatch({ type: 'SET_LOADING', isLoading: true })

    try {
      const response = await fetch('/api/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update',
          cartId,
          lines: [{ id: lineId, quantity }],
        }),
      })

      const data = await response.json()
      if (data.cart) {
        dispatch({ type: 'SET_CART', cart: data.cart })
      }
    } catch (error) {
      console.error('Error updating cart:', error)
    } finally {
      dispatch({ type: 'SET_LOADING', isLoading: false })
    }
  }, [])

  const removeFromCart = useCallback(async (lineId: string) => {
    const cartId = localStorage.getItem(CART_ID_KEY)
    if (!cartId) return

    dispatch({ type: 'SET_LOADING', isLoading: true })

    try {
      const response = await fetch('/api/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'remove',
          cartId,
          lineIds: [lineId],
        }),
      })

      const data = await response.json()
      if (data.cart) {
        dispatch({ type: 'SET_CART', cart: data.cart })
      }
    } catch (error) {
      console.error('Error removing from cart:', error)
    } finally {
      dispatch({ type: 'SET_LOADING', isLoading: false })
    }
  }, [])

  return (
    <CartContext.Provider
      value={{
        cart: state.cart,
        isLoading: state.isLoading,
        isOpen: state.isOpen,
        cartLines,
        totalQuantity,
        openCart,
        closeCart,
        toggleCart,
        addToCart,
        updateQuantity,
        removeFromCart,
      }}
    >
      {children}
    </CartContext.Provider>
  )
}

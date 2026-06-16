import {
  getShopQuery,
  getProductsQuery,
  getProductByHandleQuery,
  getCollectionsQuery,
  getCollectionByHandleQuery,
  searchProductsQuery,
  createCartMutation,
  getCartQuery,
  addToCartMutation,
  updateCartMutation,
  removeFromCartMutation,
  getFeaturedProductsQuery,
  getPageQuery,
} from './queries'
import type {
  ShopifyProduct,
  ShopifyCollection,
  ShopifyCart,
  ShopifyShop,
  ShopifyPage,
} from './types'

const domain = process.env.NEXT_PUBLIC_SHOPIFY_DOMAIN
const storefrontToken = process.env.NEXT_PUBLIC_SHOPIFY_STOREFRONT_TOKEN
const apiVersion = '2025-01'

async function shopifyFetch<T>({
  query,
  variables = {},
  cache = 'force-cache',
  tags,
}: {
  query: string
  variables?: Record<string, unknown>
  cache?: RequestCache
  tags?: string[]
}): Promise<T> {
  if (!domain || !storefrontToken) {
    throw new Error(
      'Shopify domain and storefront token must be set in environment variables'
    )
  }

  const url = `https://${domain}/api/${apiVersion}/graphql.json`

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': storefrontToken,
    },
    body: JSON.stringify({ query, variables }),
    cache,
    ...(tags && { next: { tags } }),
  })

  if (!response.ok) {
    throw new Error(`Shopify API error: ${response.status}`)
  }

  const json = await response.json()

  if (json.errors) {
    throw new Error(json.errors[0]?.message || 'Unknown Shopify error')
  }

  return json.data
}

export async function getShop(): Promise<ShopifyShop> {
  const data = await shopifyFetch<{ shop: ShopifyShop }>({
    query: getShopQuery,
    tags: ['shop'],
  })
  return data.shop
}

export async function getProducts(options?: {
  first?: number
  sortKey?: string
  reverse?: boolean
  query?: string
}): Promise<ShopifyProduct[]> {
  const data = await shopifyFetch<{
    products: { edges: { node: ShopifyProduct }[] }
  }>({
    query: getProductsQuery,
    variables: {
      first: options?.first ?? 20,
      sortKey: options?.sortKey ?? 'BEST_SELLING',
      reverse: options?.reverse ?? false,
      query: options?.query,
    },
    tags: ['products'],
  })
  return data.products.edges.map((edge) => edge.node)
}

export async function getProductByHandle(
  handle: string
): Promise<ShopifyProduct | null> {
  const data = await shopifyFetch<{ product: ShopifyProduct | null }>({
    query: getProductByHandleQuery,
    variables: { handle },
    tags: ['products', `product-${handle}`],
  })
  return data.product
}

export async function getCollections(): Promise<ShopifyCollection[]> {
  const data = await shopifyFetch<{
    collections: { edges: { node: ShopifyCollection }[] }
  }>({
    query: getCollectionsQuery,
    tags: ['collections'],
  })
  return data.collections.edges.map((edge) => edge.node)
}

export async function getCollectionByHandle(
  handle: string,
  first = 20
): Promise<ShopifyCollection | null> {
  const data = await shopifyFetch<{ collection: ShopifyCollection | null }>({
    query: getCollectionByHandleQuery,
    variables: { handle, first },
    tags: ['collections', `collection-${handle}`],
  })
  return data.collection
}

export async function searchProducts(
  query: string,
  first = 20
): Promise<ShopifyProduct[]> {
  const data = await shopifyFetch<{
    search: { edges: { node: ShopifyProduct }[] }
  }>({
    query: searchProductsQuery,
    variables: { query, first },
    cache: 'no-store',
  })
  return data.search.edges.map((edge) => edge.node)
}

export async function createCart(): Promise<ShopifyCart> {
  const data = await shopifyFetch<{ cartCreate: { cart: ShopifyCart } }>({
    query: createCartMutation,
    cache: 'no-store',
  })
  return data.cartCreate.cart
}

export async function getCart(cartId: string): Promise<ShopifyCart | null> {
  const data = await shopifyFetch<{ cart: ShopifyCart | null }>({
    query: getCartQuery,
    variables: { cartId },
    cache: 'no-store',
  })
  return data.cart
}

export async function addToCart(
  cartId: string,
  lines: { merchandiseId: string; quantity: number }[]
): Promise<ShopifyCart> {
  const data = await shopifyFetch<{ cartLinesAdd: { cart: ShopifyCart } }>({
    query: addToCartMutation,
    variables: { cartId, lines },
    cache: 'no-store',
  })
  return data.cartLinesAdd.cart
}

export async function updateCart(
  cartId: string,
  lines: { id: string; quantity: number }[]
): Promise<ShopifyCart> {
  const data = await shopifyFetch<{ cartLinesUpdate: { cart: ShopifyCart } }>({
    query: updateCartMutation,
    variables: { cartId, lines },
    cache: 'no-store',
  })
  return data.cartLinesUpdate.cart
}

export async function removeFromCart(
  cartId: string,
  lineIds: string[]
): Promise<ShopifyCart> {
  const data = await shopifyFetch<{ cartLinesRemove: { cart: ShopifyCart } }>({
    query: removeFromCartMutation,
    variables: { cartId, lineIds },
    cache: 'no-store',
  })
  return data.cartLinesRemove.cart
}

export async function getFeaturedProducts(
  first = 8
): Promise<ShopifyProduct[]> {
  const data = await shopifyFetch<{
    products: { edges: { node: ShopifyProduct }[] }
  }>({
    query: getFeaturedProductsQuery,
    variables: { first },
    tags: ['products', 'featured'],
  })
  return data.products.edges.map((edge) => edge.node)
}

export async function getPage(handle: string): Promise<ShopifyPage | null> {
  try {
    const data = await shopifyFetch<{ page: ShopifyPage | null }>({
      query: getPageQuery,
      variables: { handle },
      tags: ['pages', `page-${handle}`],
    })
    return data.page
  } catch {
    return null
  }
}

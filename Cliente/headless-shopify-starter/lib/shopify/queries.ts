const productFragment = `
  fragment ProductFragment on Product {
    id
    handle
    title
    description
    descriptionHtml
    productType
    vendor
    tags
    availableForSale
    priceRange {
      minVariantPrice {
        amount
        currencyCode
      }
      maxVariantPrice {
        amount
        currencyCode
      }
    }
    compareAtPriceRange {
      minVariantPrice {
        amount
        currencyCode
      }
      maxVariantPrice {
        amount
        currencyCode
      }
    }
    featuredImage {
      url
      altText
      width
      height
    }
    images(first: 10) {
      edges {
        node {
          url
          altText
          width
          height
        }
      }
    }
    variants(first: 100) {
      edges {
        node {
          id
          title
          availableForSale
          selectedOptions {
            name
            value
          }
          price {
            amount
            currencyCode
          }
          compareAtPrice {
            amount
            currencyCode
          }
          image {
            url
            altText
            width
            height
          }
        }
      }
    }
    options {
      id
      name
      values
    }
    seo {
      title
      description
    }
  }
`

const cartFragment = `
  fragment CartFragment on Cart {
    id
    checkoutUrl
    totalQuantity
    cost {
      totalAmount {
        amount
        currencyCode
      }
      subtotalAmount {
        amount
        currencyCode
      }
      totalTaxAmount {
        amount
        currencyCode
      }
    }
    lines(first: 100) {
      edges {
        node {
          id
          quantity
          merchandise {
            ... on ProductVariant {
              id
              title
              selectedOptions {
                name
                value
              }
              product {
                id
                handle
                title
                featuredImage {
                  url
                  altText
                  width
                  height
                }
              }
              price {
                amount
                currencyCode
              }
              compareAtPrice {
                amount
                currencyCode
              }
            }
          }
        }
      }
    }
  }
`

export const getShopQuery = `
  query GetShop {
    shop {
      name
      description
      primaryDomain {
        url
      }
      brand {
        logo {
          image {
            url
            altText
            width
            height
          }
        }
        slogan
      }
    }
  }
`

export const getProductsQuery = `
  ${productFragment}
  query GetProducts($first: Int = 20, $sortKey: ProductSortKeys = BEST_SELLING, $reverse: Boolean = false, $query: String) {
    products(first: $first, sortKey: $sortKey, reverse: $reverse, query: $query) {
      edges {
        node {
          ...ProductFragment
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`

export const getProductByHandleQuery = `
  ${productFragment}
  query GetProductByHandle($handle: String!) {
    product(handle: $handle) {
      ...ProductFragment
    }
  }
`

export const getCollectionsQuery = `
  query GetCollections($first: Int = 10) {
    collections(first: $first) {
      edges {
        node {
          id
          handle
          title
          description
          image {
            url
            altText
            width
            height
          }
        }
      }
    }
  }
`

export const getCollectionByHandleQuery = `
  ${productFragment}
  query GetCollectionByHandle($handle: String!, $first: Int = 20) {
    collection(handle: $handle) {
      id
      handle
      title
      description
      image {
        url
        altText
        width
        height
      }
      products(first: $first) {
        edges {
          node {
            ...ProductFragment
          }
        }
      }
    }
  }
`

export const searchProductsQuery = `
  ${productFragment}
  query SearchProducts($query: String!, $first: Int = 20) {
    search(query: $query, first: $first, types: [PRODUCT]) {
      edges {
        node {
          ... on Product {
            ...ProductFragment
          }
        }
      }
    }
  }
`

export const createCartMutation = `
  ${cartFragment}
  mutation CreateCart {
    cartCreate {
      cart {
        ...CartFragment
      }
    }
  }
`

export const getCartQuery = `
  ${cartFragment}
  query GetCart($cartId: ID!) {
    cart(id: $cartId) {
      ...CartFragment
    }
  }
`

export const addToCartMutation = `
  ${cartFragment}
  mutation AddToCart($cartId: ID!, $lines: [CartLineInput!]!) {
    cartLinesAdd(cartId: $cartId, lines: $lines) {
      cart {
        ...CartFragment
      }
    }
  }
`

export const updateCartMutation = `
  ${cartFragment}
  mutation UpdateCart($cartId: ID!, $lines: [CartLineUpdateInput!]!) {
    cartLinesUpdate(cartId: $cartId, lines: $lines) {
      cart {
        ...CartFragment
      }
    }
  }
`

export const removeFromCartMutation = `
  ${cartFragment}
  mutation RemoveFromCart($cartId: ID!, $lineIds: [ID!]!) {
    cartLinesRemove(cartId: $cartId, lineIds: $lineIds) {
      cart {
        ...CartFragment
      }
    }
  }
`

export const getFeaturedProductsQuery = `
  ${productFragment}
  query GetFeaturedProducts($first: Int = 8) {
    products(first: $first, sortKey: BEST_SELLING) {
      edges {
        node {
          ...ProductFragment
        }
      }
    }
  }
`

export const getPageQuery = `
  query GetPage($handle: String!) {
    page(handle: $handle) {
      id
      handle
      title
      body
      bodySummary
    }
  }
`

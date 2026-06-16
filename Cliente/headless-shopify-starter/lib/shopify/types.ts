export interface ShopifyImage {
  url: string
  altText: string | null
  width: number
  height: number
}

export interface ShopifyMoney {
  amount: string
  currencyCode: string
}

export interface ShopifyPriceRange {
  minVariantPrice: ShopifyMoney
  maxVariantPrice: ShopifyMoney
}

export interface ShopifyProductVariant {
  id: string
  title: string
  availableForSale: boolean
  selectedOptions: {
    name: string
    value: string
  }[]
  price: ShopifyMoney
  compareAtPrice: ShopifyMoney | null
  image?: ShopifyImage
}

export interface ShopifyProduct {
  id: string
  handle: string
  title: string
  description: string
  descriptionHtml: string
  productType: string
  vendor: string
  tags: string[]
  availableForSale: boolean
  priceRange: ShopifyPriceRange
  compareAtPriceRange: ShopifyPriceRange
  featuredImage: ShopifyImage | null
  images: {
    edges: { node: ShopifyImage }[]
  }
  variants: {
    edges: { node: ShopifyProductVariant }[]
  }
  options: {
    id: string
    name: string
    values: string[]
  }[]
  seo: {
    title: string | null
    description: string | null
  }
}

export interface ShopifyCollection {
  id: string
  handle: string
  title: string
  description: string
  image: ShopifyImage | null
  products: {
    edges: { node: ShopifyProduct }[]
  }
}

export interface ShopifyCartLine {
  id: string
  quantity: number
  merchandise: {
    id: string
    title: string
    selectedOptions: {
      name: string
      value: string
    }[]
    product: {
      id: string
      handle: string
      title: string
      featuredImage: ShopifyImage | null
    }
    price: ShopifyMoney
    compareAtPrice: ShopifyMoney | null
  }
}

export interface ShopifyCart {
  id: string
  checkoutUrl: string
  totalQuantity: number
  cost: {
    totalAmount: ShopifyMoney
    subtotalAmount: ShopifyMoney
    totalTaxAmount: ShopifyMoney | null
  }
  lines: {
    edges: { node: ShopifyCartLine }[]
  }
}

export interface ShopifyShop {
  name: string
  description: string | null
  primaryDomain: {
    url: string
  }
  brand: {
    logo: {
      image: ShopifyImage | null
    } | null
    slogan: string | null
  } | null
}

export interface ShopifyPage {
  id: string
  handle: string
  title: string
  body: string
  bodySummary: string
}

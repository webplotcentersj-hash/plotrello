import type { MockupProductKind, MockupSceneKind } from '../../utils/clientePedidoMockup'
import { labelFormatoPedido } from '../../utils/clientePedidoMockup'
import './ClientePedidoMockupPreview.css'

type Props = {
  productKind: MockupProductKind
  sceneKind: MockupSceneKind
  productLabel: string
  especificacion?: string
  dondeColocados?: string
  digitalOImpresion?: string
  cantidades?: string
  userImageUrl?: string | null
  aiImageUrl?: string | null
  loadingAi?: boolean
  empty?: boolean
  emptyTitle?: string
  emptyMessage?: string
}

const SCENE_LABELS: Record<MockupSceneKind, string> = {
  storefront: 'Exterior del local',
  interior: 'Interior / mesa',
  vehicle: 'Automóvil',
  digital: 'PC / pantalla',
  window: 'Vidriera',
  event: 'Evento / feria'
}

const PRODUCT_LABELS: Record<MockupProductKind, string> = {
  banner: 'Banner',
  'banner-vertical': 'Banner vertical',
  flyer: 'Flyer',
  brochure: 'Folleto / brochure',
  card: 'Tarjetas',
  sticker: 'Stickers',
  logo: 'Logo',
  sign: 'Cartel',
  wayfinding: 'Señalética',
  vehicle: 'Plotado vehicular',
  'window-wrap': 'Vidriera',
  folder: 'Carpetas',
  notebook: 'Agenda / cuaderno',
  calendar: 'Calendario',
  packaging: 'Packaging',
  presentation: 'Presentación / web',
  generic: 'Producto gráfico'
}

function MockupDetalles({
  especificacion,
  dondeColocados,
  digitalOImpresion,
  cantidades
}: Pick<Props, 'especificacion' | 'dondeColocados' | 'digitalOImpresion' | 'cantidades'>) {
  const formato = labelFormatoPedido(digitalOImpresion || '')
  const tieneAlgo =
    especificacion?.trim() || dondeColocados?.trim() || formato || cantidades?.trim()

  if (!tieneAlgo) return null

  return (
    <div className="pedido-mockup__detalles">
      {especificacion?.trim() && (
        <p className="pedido-mockup__detalle pedido-mockup__detalle--spec">
          <span className="pedido-mockup__detalle-k">Tu idea</span>
          {especificacion.trim()}
        </p>
      )}
      {dondeColocados?.trim() && (
        <p className="pedido-mockup__detalle">
          <span className="pedido-mockup__detalle-k">Ubicación</span>
          {dondeColocados.trim()}
        </p>
      )}
      {formato && (
        <p className="pedido-mockup__detalle">
          <span className="pedido-mockup__detalle-k">Formato</span>
          {formato}
        </p>
      )}
      {cantidades?.trim() && (
        <p className="pedido-mockup__detalle">
          <span className="pedido-mockup__detalle-k">Cantidades</span>
          {cantidades.trim()}
        </p>
      )}
    </div>
  )
}

function MockupProductContent({
  userImageUrl,
  especificacion,
  productKind
}: {
  userImageUrl?: string | null
  especificacion?: string
  productKind: MockupProductKind
}) {
  if (userImageUrl) {
    return <img src={userImageUrl} alt="Referencia subida" className="mockup-product__user-img" />
  }

  if (especificacion?.trim()) {
    return (
      <p className="mockup-product__spec-text" title={especificacion.trim()}>
        {especificacion.trim()}
      </p>
    )
  }

  if (productKind === 'calendar') {
    return (
      <div className="mockup-product__art mockup-product__art--calendar">
        <span className="mockup-calendar__month">PLOT</span>
        <span className="mockup-calendar__grid" aria-hidden>
          {Array.from({ length: 28 }, (_, i) => (
            <span key={i} className="mockup-calendar__cell" />
          ))}
        </span>
      </div>
    )
  }

  if (productKind === 'logo') {
    return (
      <div className="mockup-product__art mockup-product__art--logo">
        <span className="mockup-logo-mark" aria-hidden />
        <span className="mockup-product__art-brand">PLOT</span>
      </div>
    )
  }

  if (productKind === 'brochure') {
    return (
      <div className="mockup-product__art mockup-product__art--brochure">
        <span className="mockup-brochure__panel">
          <span className="mockup-product__art-brand">PLOT</span>
        </span>
        <span className="mockup-brochure__panel mockup-brochure__panel--mid" />
        <span className="mockup-brochure__panel" />
      </div>
    )
  }

  if (productKind === 'flyer') {
    return (
      <div className="mockup-product__art mockup-product__art--flyer">
        <span className="mockup-flyer__hero" />
        <span className="mockup-product__art-brand">PLOT</span>
        <span className="mockup-product__art-line" />
        <span className="mockup-product__art-line mockup-product--accent" />
        <span className="mockup-product__art-line mockup-product--accent" />
      </div>
    )
  }

  if (productKind === 'wayfinding') {
    return (
      <div className="mockup-product__art mockup-product__art--wayfinding">
        <span className="mockup-wayfinding__arrow" aria-hidden>
          →
        </span>
        <span className="mockup-product__art-brand">PLOT</span>
        <span className="mockup-product__art-line" />
      </div>
    )
  }

  if (productKind === 'sign') {
    return (
      <div className="mockup-product__art mockup-product__art--sign">
        <span className="mockup-product__art-brand">PLOT</span>
        <span className="mockup-product__art-line" />
        <span className="mockup-product__art-line mockup-product--accent" />
      </div>
    )
  }

  if (productKind === 'notebook') {
    return (
      <div className="mockup-product__art mockup-product__art--notebook">
        <span className="mockup-notebook__spine" aria-hidden />
        <span className="mockup-product__art-brand">PLOT</span>
        <span className="mockup-product__art-line" />
      </div>
    )
  }

  return (
    <div className="mockup-product__art">
      <span className="mockup-product__art-line" />
      <span className="mockup-product__art-line mockup-product--accent" />
      <span className="mockup-product__art-brand">PLOT</span>
    </div>
  )
}

function ProductChrome({ productKind }: { productKind: MockupProductKind }) {
  if (productKind === 'banner-vertical') {
    return (
      <>
        <span className="mockup-rollup__base" aria-hidden />
        <span className="mockup-rollup__pole" aria-hidden />
      </>
    )
  }
  if (productKind === 'brochure') {
    return <span className="mockup-brochure__fold" aria-hidden />
  }
  return null
}

export default function ClientePedidoMockupPreview({
  productKind,
  sceneKind,
  productLabel,
  especificacion = '',
  dondeColocados = '',
  digitalOImpresion = '',
  cantidades = '',
  userImageUrl,
  aiImageUrl,
  loadingAi = false,
  empty = false,
  emptyTitle = 'Vista previa',
  emptyMessage = 'Agregá un artículo del catálogo para ver el mockup de cómo podría verse tu pedido.'
}: Props) {
  if (empty) {
    return (
      <div className="pedido-mockup pedido-mockup--empty">
        <p className="pedido-mockup__placeholder-title">{emptyTitle}</p>
        <p className="pedido-mockup__placeholder-text">{emptyMessage}</p>
      </div>
    )
  }

  if (aiImageUrl) {
    return (
      <div className="pedido-mockup pedido-mockup--ai">
        <div className="pedido-mockup__meta">
          <span className="pedido-mockup__badge">{PRODUCT_LABELS[productKind]}</span>
          <span className="pedido-mockup__scene">{SCENE_LABELS[sceneKind]}</span>
        </div>
        <div className="pedido-mockup__ai-frame">
          <img src={aiImageUrl} alt={`Vista previa ${productLabel}`} className="pedido-mockup__ai-img" />
        </div>
        <MockupDetalles
          especificacion={especificacion}
          dondeColocados={dondeColocados}
          digitalOImpresion={digitalOImpresion}
          cantidades={cantidades}
        />
      </div>
    )
  }

  return (
    <div className={`pedido-mockup pedido-mockup--scene-${sceneKind}`}>
      <div className="pedido-mockup__meta">
        <span className="pedido-mockup__badge">{productLabel || PRODUCT_LABELS[productKind]}</span>
        <span className="pedido-mockup__scene">{SCENE_LABELS[sceneKind]}</span>
      </div>

      <div className={`pedido-mockup__stage pedido-mockup__stage--${sceneKind}`} aria-hidden>
        {sceneKind === 'storefront' && (
          <>
            <div className="mockup-sky" />
            <div className="mockup-sidewalk" />
            <div className="mockup-building">
              <div className="mockup-awning" />
              <div className="mockup-door" />
            </div>
          </>
        )}
        {sceneKind === 'interior' && (
          <div className="mockup-interior-wall">
            <div className="mockup-shelf" />
            <div className="mockup-table" />
          </div>
        )}
        {sceneKind === 'event' && (
          <div className="mockup-event-booth">
            <div className="mockup-event-backwall" />
            <div className="mockup-event-counter" />
          </div>
        )}
        {sceneKind === 'vehicle' && (
          <div className="mockup-car">
            <div className="mockup-car__body" />
            <div className="mockup-car__cabin" />
            <div className="mockup-car__window" />
            <div className="mockup-car__wheel mockup-car__wheel--front" />
            <div className="mockup-car__wheel mockup-car__wheel--rear" />
          </div>
        )}
        {sceneKind === 'digital' && (
          <div className="mockup-pc">
            <div className="mockup-pc__screen">
              <div className="mockup-pc__bezel" />
            </div>
            <div className="mockup-pc__base" />
            <div className="mockup-pc__stand" />
          </div>
        )}
        {sceneKind === 'window' && (
          <div className="mockup-window-frame">
            <div className="mockup-window-reflection" />
          </div>
        )}

        <div className={`mockup-product mockup-product--${productKind}`}>
          <ProductChrome productKind={productKind} />
          <MockupProductContent
            userImageUrl={userImageUrl}
            especificacion={especificacion}
            productKind={productKind}
          />
        </div>
      </div>

      {loadingAi && <p className="pedido-mockup__loading">Generando vista previa IA…</p>}

      <MockupDetalles
        especificacion={userImageUrl ? especificacion : undefined}
        dondeColocados={dondeColocados}
        digitalOImpresion={digitalOImpresion}
        cantidades={cantidades}
      />
    </div>
  )
}

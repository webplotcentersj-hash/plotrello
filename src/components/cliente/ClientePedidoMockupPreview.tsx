import type { MockupProductKind, MockupSceneKind } from '../../utils/clientePedidoMockup'
import './ClientePedidoMockupPreview.css'

type Props = {
  productKind: MockupProductKind
  sceneKind: MockupSceneKind
  productLabel: string
  especificacion?: string
  userImageUrl?: string | null
  aiImageUrl?: string | null
  loadingAi?: boolean
  empty?: boolean
}

const SCENE_LABELS: Record<MockupSceneKind, string> = {
  storefront: 'Exterior del local',
  interior: 'Interior / pared',
  vehicle: 'Vehículo',
  digital: 'Pantalla digital',
  window: 'Vidriera'
}

const PRODUCT_LABELS: Record<MockupProductKind, string> = {
  banner: 'Banner',
  'banner-vertical': 'Banner vertical',
  flyer: 'Flyer / folleto',
  card: 'Tarjetas',
  sticker: 'Stickers',
  logo: 'Logo',
  sign: 'Cartelería',
  vehicle: 'Plotado vehicular',
  generic: 'Producto gráfico'
}

export default function ClientePedidoMockupPreview({
  productKind,
  sceneKind,
  productLabel,
  especificacion = '',
  userImageUrl,
  aiImageUrl,
  loadingAi = false,
  empty = false
}: Props) {
  if (empty) {
    return (
      <div className="pedido-mockup pedido-mockup--empty">
        <p className="pedido-mockup__placeholder-title">Vista previa</p>
        <p className="pedido-mockup__placeholder-text">
          Agregá un artículo del catálogo para ver el mockup de cómo podría verse tu pedido.
        </p>
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
        {especificacion.trim() && (
          <p className="pedido-mockup__spec-snippet">{especificacion.trim().slice(0, 120)}…</p>
        )}
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
          </div>
        )}
        {sceneKind === 'vehicle' && (
          <div className="mockup-van">
            <div className="mockup-van-cabin" />
            <div className="mockup-van-body" />
          </div>
        )}
        {sceneKind === 'digital' && (
          <div className="mockup-monitor">
            <div className="mockup-monitor-stand" />
          </div>
        )}
        {sceneKind === 'window' && (
          <div className="mockup-window-frame">
            <div className="mockup-window-reflection" />
          </div>
        )}

        <div className={`mockup-product mockup-product--${productKind}`}>
          {userImageUrl ? (
            <img src={userImageUrl} alt="" className="mockup-product__user-img" />
          ) : (
            <div className="mockup-product__art">
              <span className="mockup-product__art-line" />
              <span className="mockup-product__art-line mockup-product--accent" />
              <span className="mockup-product__art-brand">PLOT</span>
            </div>
          )}
        </div>
      </div>

      {loadingAi && <p className="pedido-mockup__loading">Generando vista previa IA…</p>}

      {especificacion.trim() && (
        <blockquote className="pedido-mockup__spec-snippet">{especificacion.trim()}</blockquote>
      )}
    </div>
  )
}

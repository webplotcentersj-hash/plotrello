import type { CSSProperties, RefObject } from 'react'
import { Sparkles, ImageIcon, Wand2, Layers } from 'lucide-react'
import ClientePedidoMockupPreview from './ClientePedidoMockupPreview'
import type { MockupProductKind, MockupSceneKind } from '../../utils/clientePedidoMockup'
import './ClienteBriefMockupStudio.css'

type Props = {
  productKind: MockupProductKind
  sceneKind: MockupSceneKind
  productLabel: string
  especificacion: string
  dondeColocados: string
  digitalOImpresion: string
  cantidades: string
  estiloDiseno: string
  selectedTipos: string[]
  progress: number
  empty: boolean
  aiImageUrl: string | null
  loadingAi: boolean
  userImageUrl: string | null
  iaLoading: boolean
  onGenerarMockupIa: () => void
  onGenerarTodoIa: () => void
  captureRef?: RefObject<HTMLDivElement | null>
}

export default function ClienteBriefMockupStudio({
  productKind,
  sceneKind,
  productLabel,
  especificacion,
  dondeColocados,
  digitalOImpresion,
  cantidades,
  estiloDiseno,
  selectedTipos,
  progress,
  empty,
  aiImageUrl,
  loadingAi,
  userImageUrl,
  iaLoading,
  onGenerarMockupIa,
  onGenerarTodoIa,
  captureRef
}: Props) {
  const specForMockup =
    especificacion.trim() ||
    (estiloDiseno.trim() ? `Estilo: ${estiloDiseno.trim()}` : '')

  return (
    <aside className="brief-mockup-studio" aria-label="Estudio de vista previa">
      <div className="brief-mockup-studio__glow" aria-hidden />
      <header className="brief-mockup-studio__head">
        <div className="brief-mockup-studio__title-row">
          <Layers size={20} strokeWidth={2} aria-hidden />
          <h2 className="brief-mockup-studio__title">Tu proyecto en vivo</h2>
        </div>
        <p className="brief-mockup-studio__sub">
          El mockup se actualiza mientras completás el brief. Usá IA para una vista realista o para redactar textos.
        </p>
      </header>

      <div className="brief-mockup-studio__progress" role="status" aria-live="polite">
        <div className="brief-mockup-studio__progress-ring" style={{ '--p': `${progress}%` } as CSSProperties}>
          <span className="brief-mockup-studio__progress-value">{progress}%</span>
        </div>
        <div className="brief-mockup-studio__progress-copy">
          <strong>Completitud del brief</strong>
          <span>{progress < 40 ? 'Elegí productos para empezar' : progress < 70 ? 'Sumá ubicación y objetivo' : '¡Casi listo para enviar!'}</span>
        </div>
      </div>

      {selectedTipos.length > 0 && (
        <div className="brief-mockup-studio__chips" aria-label="Productos seleccionados">
          {selectedTipos.slice(0, 4).map((t) => (
            <span key={t} className="brief-mockup-studio__chip">
              {t}
            </span>
          ))}
          {selectedTipos.length > 4 && (
            <span className="brief-mockup-studio__chip brief-mockup-studio__chip--more">
              +{selectedTipos.length - 4}
            </span>
          )}
        </div>
      )}

      <div
        ref={captureRef}
        className={`brief-mockup-studio__preview ${empty ? '' : 'brief-mockup-studio__preview--active'}`}
        key={`${productKind}-${sceneKind}-${productLabel}`}
      >
        <ClientePedidoMockupPreview
          empty={empty}
          emptyTitle="Vista previa de tu diseño"
          emptyMessage="Marcá al menos un tipo de producto o servicio y el mockup se irá armando acá en tiempo real."
          productKind={productKind}
          sceneKind={sceneKind}
          productLabel={productLabel}
          especificacion={specForMockup}
          dondeColocados={dondeColocados}
          digitalOImpresion={digitalOImpresion}
          cantidades={cantidades}
          userImageUrl={userImageUrl}
          aiImageUrl={aiImageUrl}
          loadingAi={loadingAi}
        />
      </div>

      <div className="brief-mockup-studio__actions">
        <button
          type="button"
          className="brief-mockup-studio__btn brief-mockup-studio__btn--primary"
          disabled={empty || iaLoading}
          onClick={onGenerarTodoIa}
        >
          <Wand2 size={17} aria-hidden />
          {iaLoading ? 'Generando textos…' : 'Completar textos con IA'}
        </button>
        <button
          type="button"
          className="brief-mockup-studio__btn brief-mockup-studio__btn--secondary"
          disabled={empty || loadingAi}
          onClick={onGenerarMockupIa}
        >
          <ImageIcon size={17} aria-hidden />
          {loadingAi ? 'Generando imagen…' : 'Mockup realista (IA)'}
        </button>
        <p className="brief-mockup-studio__hint">
          <Sparkles size={14} aria-hidden />
          La vista animada cambia al instante; la imagen IA tarda unos segundos.
        </p>
      </div>
    </aside>
  )
}

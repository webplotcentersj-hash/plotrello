import { useEffect, useMemo, useState } from 'react'
import {
  aspectRatioForFormat,
  buildPrintDocumentPreview,
  parseTipoImpresion,
  type PrintColorMode,
  type PrintDocumentKind
} from '../../utils/totemPrintDocument'
import './TotemPrintPreviewMonitor.css'

type Props = {
  source: string | null
  fileName?: string
  tipoImpresion: string
  onPageCount?: (count: number) => void
}

export default function TotemPrintPreviewMonitor({ source, fileName, tipoImpresion, onPageCount }: Props) {
  const { format, color } = useMemo(() => parseTipoImpresion(tipoImpresion), [tipoImpresion])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [kind, setKind] = useState<PrintDocumentKind>('unknown')
  const [pageCount, setPageCount] = useState(1)
  const [previews, setPreviews] = useState<string[]>([])
  const [activePage, setActivePage] = useState(1)

  useEffect(() => {
    const src = String(source || '').trim()
    if (!src) {
      setPreviews([])
      setPageCount(1)
      setKind('unknown')
      setError(null)
      setActivePage(1)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    void (async () => {
      try {
        const doc = await buildPrintDocumentPreview(src, 400, 5)
        if (cancelled) return
        setKind(doc.kind)
        setPageCount(doc.pageCount)
        setPreviews(doc.previews)
        setActivePage(1)
        onPageCount?.(doc.pageCount)
      } catch {
        if (!cancelled) {
          setError('No se pudo leer el archivo para la vista previa.')
          setPreviews([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [source, onPageCount])

  const activePreview = previews[activePage - 1] ?? previews[0] ?? null
  const ratio = aspectRatioForFormat(format)

  if (!source?.trim()) {
    return (
      <div className="totem-print-monitor totem-print-monitor--empty">
        <div className="totem-print-monitor-empty-icon" aria-hidden>
          🖨️
        </div>
        <p className="totem-print-monitor-empty-title">Vista previa</p>
        <p className="totem-print-monitor-empty-text">Subí un archivo para ver cómo quedará la impresión.</p>
      </div>
    )
  }

  return (
    <div className="totem-print-monitor">
      <div className="totem-print-monitor-head">
        <p className="totem-print-monitor-kicker">Monitor de impresión</p>
        <h2 className="totem-print-monitor-title">{fileName?.trim() || 'Documento'}</h2>
      </div>

      <div className="totem-print-monitor-bezel">
        <div className="totem-print-monitor-led" aria-hidden />
        <div
          className={`totem-print-monitor-screen totem-print-monitor-screen--${format.toLowerCase()} totem-print-monitor-screen--${color}`}
          style={{ aspectRatio: String(ratio) }}
        >
          {loading ? (
            <div className="totem-print-monitor-state">Analizando archivo…</div>
          ) : error ? (
            <div className="totem-print-monitor-state totem-print-monitor-state--error">{error}</div>
          ) : activePreview ? (
            <img
              src={activePreview}
              alt={`Vista previa página ${activePage}`}
              className={`totem-print-monitor-img totem-print-monitor-img--${color}`}
            />
          ) : (
            <div className="totem-print-monitor-state">Sin vista previa</div>
          )}
          <PrintModeOverlay format={format} color={color} />
        </div>
      </div>

      <div className="totem-print-monitor-meta">
        <span className={`totem-print-monitor-chip totem-print-monitor-chip--${color}`}>
          {color === 'color' ? '🎨 Color' : '⬛ Blanco y negro'}
        </span>
        <span className="totem-print-monitor-chip">{format}</span>
        <span className="totem-print-monitor-chip totem-print-monitor-chip--pages">
          {loading ? '…' : `${pageCount} hoja${pageCount === 1 ? '' : 's'}`}
          {!loading && pageCount > 0 ? ' · detectado' : ''}
        </span>
        {kind === 'pdf' && <span className="totem-print-monitor-chip">PDF</span>}
        {kind === 'image' && <span className="totem-print-monitor-chip">Imagen</span>}
      </div>

      {previews.length > 1 && (
        <div className="totem-print-monitor-thumbs" role="tablist" aria-label="Páginas del documento">
          {previews.map((src, i) => {
            const page = i + 1
            const selected = page === activePage
            return (
              <button
                key={page}
                type="button"
                role="tab"
                aria-selected={selected}
                className={`totem-print-monitor-thumb ${selected ? 'totem-print-monitor-thumb--active' : ''}`}
                onClick={() => setActivePage(page)}
              >
                <img
                  src={src}
                  alt={`Miniatura página ${page}`}
                  className={`totem-print-monitor-thumb-img totem-print-monitor-thumb-img--${color}`}
                />
                <span className="totem-print-monitor-thumb-num">{page}</span>
              </button>
            )
          })}
          {pageCount > previews.length && (
            <div className="totem-print-monitor-more">+{pageCount - previews.length} más</div>
          )}
        </div>
      )}
    </div>
  )
}

function PrintModeOverlay({ format, color }: { format: 'A4' | 'A3'; color: PrintColorMode }) {
  return (
    <div className="totem-print-monitor-overlay" aria-hidden>
      <span className="totem-print-monitor-overlay-tag">{format}</span>
      <span className={`totem-print-monitor-overlay-tag totem-print-monitor-overlay-tag--${color}`}>
        {color === 'color' ? 'COLOR' : 'B/N'}
      </span>
    </div>
  )
}

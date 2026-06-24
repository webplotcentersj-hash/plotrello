import { useEffect, useMemo, useState } from 'react'
import {
  aspectRatioForFormat,
  analyzePrintSources,
  type PrintColorDetection,
  type PrintColorMode,
  type PrintDocumentKind,
  type PrintPagePreview
} from '../../utils/totemPrintDocument'
import './TotemPrintPreviewMonitor.css'

export type TotemPreviewSource = {
  source: string
  name?: string
}

type Props = {
  sources: TotemPreviewSource[]
  formatoImpresion: 'A4' | 'A3'
  onAnalysis?: (data: {
    pageCount: number
    colorDetection: PrintColorDetection
    colorPages: number
    bwPages: number
  }) => void
}

export default function TotemPrintPreviewMonitor({ sources, formatoImpresion, onAnalysis }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [kind, setKind] = useState<PrintDocumentKind>('unknown')
  const [pageCount, setPageCount] = useState(0)
  const [previews, setPreviews] = useState<PrintPagePreview[]>([])
  const [colorDetection, setColorDetection] = useState<PrintColorDetection>('bw')
  const [colorPages, setColorPages] = useState(0)
  const [bwPages, setBwPages] = useState(0)
  const [activePage, setActivePage] = useState(0)

  const sourcesKey = useMemo(
    () => sources.map((s) => `${s.name || ''}|${s.source}`).join(';;'),
    [sources]
  )

  useEffect(() => {
    if (sources.length === 0) {
      setPreviews([])
      setPageCount(0)
      setKind('unknown')
      setError(null)
      setActivePage(0)
      setColorDetection('bw')
      setColorPages(0)
      setBwPages(0)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    void (async () => {
      try {
        const doc = await analyzePrintSources(sources, 400, 5)
        if (cancelled) return
        setKind(doc.kind)
        setPageCount(doc.pageCount)
        setPreviews(doc.previews)
        setColorDetection(doc.colorDetection)
        setColorPages(doc.colorPages)
        setBwPages(doc.bwPages)
        setActivePage(0)
        onAnalysis?.({
          pageCount: doc.pageCount,
          colorDetection: doc.colorDetection,
          colorPages: doc.colorPages,
          bwPages: doc.bwPages
        })
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
  }, [sourcesKey, onAnalysis, sources])

  const active = previews[activePage] ?? null
  const displayColor: PrintColorMode = active?.color ?? (colorDetection === 'color' ? 'color' : 'bw')
  const ratio = aspectRatioForFormat(formatoImpresion)
  const title =
    sources.length === 1
      ? sources[0].name?.trim() || 'Documento'
      : `${sources.length} archivos`

  if (sources.length === 0) {
    return (
      <div className="totem-print-monitor totem-print-monitor--empty">
        <div className="totem-print-monitor-empty-icon" aria-hidden>
          🖨️
        </div>
        <p className="totem-print-monitor-empty-title">Vista previa</p>
        <p className="totem-print-monitor-empty-text">Subí uno o más archivos para ver cómo quedará la impresión.</p>
      </div>
    )
  }

  return (
    <div className="totem-print-monitor">
      <div className="totem-print-monitor-head">
        <p className="totem-print-monitor-kicker">Monitor de impresión</p>
        <h2 className="totem-print-monitor-title">{title}</h2>
      </div>

      <div className="totem-print-monitor-bezel">
        <div className="totem-print-monitor-led" aria-hidden />
        <div
          className={`totem-print-monitor-screen totem-print-monitor-screen--${formatoImpresion.toLowerCase()} totem-print-monitor-screen--${displayColor}`}
          style={{ aspectRatio: String(ratio) }}
        >
          {loading ? (
            <div className="totem-print-monitor-state">Analizando archivos…</div>
          ) : error ? (
            <div className="totem-print-monitor-state totem-print-monitor-state--error">{error}</div>
          ) : active ? (
            <img
              src={active.previewUrl}
              alt={`Vista previa ${active.label}`}
              className={`totem-print-monitor-img totem-print-monitor-img--${displayColor}`}
            />
          ) : (
            <div className="totem-print-monitor-state">Sin vista previa</div>
          )}
          <PrintModeOverlay format={formatoImpresion} detection={colorDetection} activeColor={active?.color} />
        </div>
      </div>

      <div className="totem-print-monitor-meta">
        <ColorChip detection={colorDetection} colorPages={colorPages} bwPages={bwPages} />
        <span className="totem-print-monitor-chip">{formatoImpresion}</span>
        <span className="totem-print-monitor-chip totem-print-monitor-chip--pages">
          {loading ? '…' : `${pageCount} hoja${pageCount === 1 ? '' : 's'}`}
          {!loading && pageCount > 0 ? ' · detectado' : ''}
        </span>
        {sources.length > 1 && <span className="totem-print-monitor-chip">{sources.length} archivos</span>}
        {kind === 'pdf' && <span className="totem-print-monitor-chip">PDF</span>}
        {kind === 'image' && <span className="totem-print-monitor-chip">Imagen</span>}
      </div>

      {previews.length > 0 && (
        <div className="totem-print-monitor-thumbs" role="tablist" aria-label="Páginas del documento">
          {previews.map((page, i) => {
            const selected = i === activePage
            return (
              <button
                key={`${page.sourceIndex}-${page.pageInSource}-${i}`}
                type="button"
                role="tab"
                aria-selected={selected}
                className={`totem-print-monitor-thumb ${selected ? 'totem-print-monitor-thumb--active' : ''}`}
                onClick={() => setActivePage(i)}
                title={page.label}
              >
                <img
                  src={page.previewUrl}
                  alt={page.label}
                  className={`totem-print-monitor-thumb-img totem-print-monitor-thumb-img--${page.color}`}
                />
                <span className={`totem-print-monitor-thumb-badge totem-print-monitor-thumb-badge--${page.color}`}>
                  {page.color === 'color' ? 'C' : 'B/N'}
                </span>
                <span className="totem-print-monitor-thumb-num">{i + 1}</span>
              </button>
            )
          })}
          {pageCount > previews.length && (
            <div className="totem-print-monitor-more">+{pageCount - previews.length} hojas más</div>
          )}
        </div>
      )}
    </div>
  )
}

function ColorChip({
  detection,
  colorPages,
  bwPages
}: {
  detection: PrintColorDetection
  colorPages: number
  bwPages: number
}) {
  if (detection === 'mixed') {
    return (
      <span className="totem-print-monitor-chip totem-print-monitor-chip--mixed">
        🎨 Mixto · {colorPages} color / {bwPages} B/N
      </span>
    )
  }
  return (
    <span className={`totem-print-monitor-chip totem-print-monitor-chip--${detection}`}>
      {detection === 'color' ? '🎨 Color detectado' : '⬛ Blanco y negro detectado'}
    </span>
  )
}

function PrintModeOverlay({
  format,
  detection,
  activeColor
}: {
  format: 'A4' | 'A3'
  detection: PrintColorDetection
  activeColor?: PrintColorMode
}) {
  const tag =
    detection === 'mixed'
      ? activeColor === 'color'
        ? 'COLOR'
        : 'B/N'
      : detection === 'color'
        ? 'COLOR'
        : 'B/N'
  const tagClass = tag === 'COLOR' ? 'color' : 'bw'

  return (
    <div className="totem-print-monitor-overlay" aria-hidden>
      <span className="totem-print-monitor-overlay-tag">{format}</span>
      <span className={`totem-print-monitor-overlay-tag totem-print-monitor-overlay-tag--${tagClass}`}>{tag}</span>
    </div>
  )
}

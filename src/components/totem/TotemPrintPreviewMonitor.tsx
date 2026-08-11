import { useEffect, useMemo, useState } from 'react'
import {
  aspectRatioForFormat,
  analyzePrintSources,
  labelPrintFormat,
  type PrintColorDetection,
  type PrintColorMode,
  type PrintDocumentKind,
  type PrintPagePreview,
  type TotemPrintColorModo,
  type TotemPrintFaz
} from '../../utils/totemPrintDocument'
import {
  labelTotemPrintPapel,
  TOTEM_PRINT_PAPEL_DEFAULT,
  type TotemPrintPapelId
} from '../../utils/totemPrintPapel'
import { formatHojasResumen } from '../../utils/totemPrintJobs'
import './TotemPrintPreviewMonitor.css'

export type TotemPreviewSource = {
  source: string
  name?: string
}

type Props = {
  sources: TotemPreviewSource[]
  formatoImpresion: 'A4' | 'A3' | 'A3E'
  modoColor?: TotemPrintColorModo
  tipoPapel?: TotemPrintPapelId
  fazImpresion?: TotemPrintFaz
  /** Índice del archivo activo (para multiarchivo). */
  activeSourceIndex?: number
  onActiveSourceChange?: (sourceIndex: number) => void
  /** Hojas seleccionadas del archivo activo (1-based). */
  selectedPages?: number[]
  onTogglePage?: (sourceIndex: number, pageInSource: number) => void
  onSelectAllPages?: (sourceIndex: number) => void
  onClearPages?: (sourceIndex: number) => void
  pageCountForActive?: number
  copias?: number
  onAnalysis?: (data: {
    pageCount: number
    colorDetection: PrintColorDetection
    colorPages: number
    bwPages: number
    pageCountsBySource: number[]
    previews: PrintPagePreview[]
  }) => void
}

function papelToneClass(papel: TotemPrintPapelId): string {
  if (papel.startsWith('obra_')) return 'obra'
  if (papel.startsWith('ilust_')) return 'ilust'
  if (papel.startsWith('adh_')) return 'adh'
  if (papel === 'esp_texturado') return 'esp-texturado'
  if (papel === 'esp_metalizado') return 'esp-metalizado'
  if (papel === 'esp_perlado') return 'esp-perlado'
  return 'ilust'
}

const MAX_THUMBS_PER_FILE = 40

export default function TotemPrintPreviewMonitor({
  sources,
  formatoImpresion,
  modoColor = 'auto',
  tipoPapel = TOTEM_PRINT_PAPEL_DEFAULT,
  fazImpresion = 'simple',
  activeSourceIndex = 0,
  onActiveSourceChange,
  selectedPages,
  onTogglePage,
  onSelectAllPages,
  onClearPages,
  pageCountForActive,
  copias = 1,
  onAnalysis
}: Props) {
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

  const selectionEnabled = typeof onTogglePage === 'function'
  const selectedSet = useMemo(() => new Set(selectedPages || []), [selectedPages])

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
        const doc = await analyzePrintSources(sources, 360, MAX_THUMBS_PER_FILE)
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
          bwPages: doc.bwPages,
          pageCountsBySource: doc.pageCountsBySource,
          previews: doc.previews
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

  const activeSource = Math.min(Math.max(0, activeSourceIndex), Math.max(0, sources.length - 1))
  const thumbsForActive = useMemo(
    () => previews.filter((p) => p.sourceIndex === activeSource),
    [previews, activeSource]
  )

  useEffect(() => {
    setActivePage(0)
  }, [activeSource, sourcesKey])

  const active = thumbsForActive[activePage] ?? thumbsForActive[0] ?? null
  const forceBw = modoColor === 'bn'
  const forceColor = modoColor === 'color'
  const displayColor: PrintColorMode = forceBw
    ? 'bw'
    : forceColor || sources.length === 0
      ? 'color'
      : active?.color ?? (colorDetection === 'color' ? 'color' : 'bw')

  const ratio = aspectRatioForFormat(formatoImpresion)
  const papelTone = papelToneClass(tipoPapel)
  const papelLabel = labelTotemPrintPapel(tipoPapel)
  const fazLabel = fazImpresion === 'doble' ? 'Doble faz' : 'Simple faz'
  const colorLabel =
    modoColor === 'bn' ? 'Blanco y negro' : modoColor === 'color' ? 'Color' : 'Automático'

  const activeFilePages = pageCountForActive ?? thumbsForActive.length
  const selectedCount = selectedPages?.length ?? 0

  const title =
    sources.length === 0
      ? 'Sin archivo aún'
      : sources[activeSource]?.name?.trim() ||
        (sources.length === 1 ? 'Documento' : `Archivo ${activeSource + 1}`)

  const hojaActual = active?.pageInSource ?? 0

  const screenClass = [
    'totem-print-monitor-screen',
    `totem-print-monitor-screen--${formatoImpresion.toLowerCase()}`,
    `totem-print-monitor-screen--${displayColor}`,
    `totem-print-monitor-screen--papel-${papelTone}`,
    fazImpresion === 'doble' ? 'totem-print-monitor-screen--doble' : ''
  ]
    .filter(Boolean)
    .join(' ')

  const specs = (
    <div className="totem-print-monitor-meta" aria-live="polite">
      <span className="totem-print-monitor-chip">{labelPrintFormat(formatoImpresion)}</span>
      <span className="totem-print-monitor-chip totem-print-monitor-chip--papel">{papelLabel}</span>
      <span className="totem-print-monitor-chip">{fazLabel}</span>
      <ColorChip detection={colorDetection} colorPages={colorPages} bwPages={bwPages} modoColor={modoColor} />
      {sources.length > 0 && (
        <span className="totem-print-monitor-chip totem-print-monitor-chip--pages">
          {loading
            ? '…'
            : selectionEnabled
              ? formatHojasResumen(selectedPages || [], activeFilePages, copias)
              : activeFilePages <= 0
                ? 'Sin hojas'
                : activeFilePages === 1
                  ? '1 hoja'
                  : `Hojas 1–${activeFilePages}`}
        </span>
      )}
      {copias > 1 && (
        <span className="totem-print-monitor-chip totem-print-monitor-chip--copies">×{copias}</span>
      )}
      {sources.length > 1 && <span className="totem-print-monitor-chip">{sources.length} archivos</span>}
      {kind === 'pdf' && <span className="totem-print-monitor-chip">PDF</span>}
      {kind === 'image' && <span className="totem-print-monitor-chip">Imagen</span>}
    </div>
  )

  return (
    <div
      className={[
        'totem-print-monitor',
        sources.length === 0 ? 'totem-print-monitor--empty' : '',
        forceBw ? 'totem-print-monitor--force-bw' : '',
        selectionEnabled ? 'totem-print-monitor--select-pages' : ''
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="totem-print-monitor-head">
        <p className="totem-print-monitor-kicker">Monitor de impresión</p>
        <h2 className="totem-print-monitor-title">{title}</h2>
        <p className="totem-print-monitor-range">
          {labelPrintFormat(formatoImpresion)} · {papelLabel} · {fazLabel} · {colorLabel}
          {!loading && activeFilePages > 0
            ? ` · Hoja ${hojaActual || '—'} de ${activeFilePages}${
                selectionEnabled ? ` · Imprimir ${selectedCount}/${activeFilePages}` : ''
              }`
            : ''}
        </p>
      </div>

      {sources.length > 1 && (
        <div className="totem-print-monitor-files" role="tablist" aria-label="Archivos">
          {sources.map((s, i) => (
            <button
              key={`${s.source}-${i}`}
              type="button"
              role="tab"
              aria-selected={i === activeSource}
              className={`totem-print-monitor-file${i === activeSource ? ' totem-print-monitor-file--active' : ''}`}
              onClick={() => onActiveSourceChange?.(i)}
            >
              {s.name?.trim() || `Archivo ${i + 1}`}
            </button>
          ))}
        </div>
      )}

      <div className="totem-print-monitor-bezel">
        <div className="totem-print-monitor-led" aria-hidden />
        {fazImpresion === 'doble' && <div className="totem-print-monitor-doble-shadow" aria-hidden />}
        <div className={screenClass} style={{ aspectRatio: String(ratio) }}>
          {sources.length === 0 ? (
            <div className={`totem-print-monitor-mock totem-print-monitor-mock--${displayColor}`}>
              <span className="totem-print-monitor-mock-format">{labelPrintFormat(formatoImpresion)}</span>
              <span className="totem-print-monitor-mock-papel">{papelLabel}</span>
              <span className="totem-print-monitor-mock-hint">
                {forceBw ? 'Vista B/N' : forceColor ? 'Vista color' : 'Subí un archivo para previsualizar'}
              </span>
            </div>
          ) : loading ? (
            <div className="totem-print-monitor-state">Analizando archivos…</div>
          ) : error ? (
            <div className="totem-print-monitor-state totem-print-monitor-state--error">{error}</div>
          ) : active ? (
            <img
              src={active.previewUrl}
              alt={`Vista previa hoja ${hojaActual} de ${activeFilePages}`}
              className={`totem-print-monitor-img totem-print-monitor-img--${displayColor}`}
            />
          ) : (
            <div className="totem-print-monitor-state">Sin vista previa</div>
          )}
          <PrintModeOverlay
            format={formatoImpresion}
            detection={colorDetection}
            activeColor={active?.color}
            modoColor={modoColor}
            papelLabel={papelLabel}
            fazLabel={fazLabel}
            hojaActual={hojaActual}
            pageCount={activeFilePages}
          />
        </div>
      </div>

      {specs}

      {selectionEnabled && sources.length > 0 && (
        <div className="totem-print-monitor-page-actions">
          <button type="button" onClick={() => onSelectAllPages?.(activeSource)}>
            Todas las hojas
          </button>
          <button type="button" onClick={() => onClearPages?.(activeSource)}>
            Ninguna
          </button>
          <span className="totem-print-monitor-page-actions-hint">Tocá ✓ en cada miniatura para imprimir o no</span>
        </div>
      )}

      {thumbsForActive.length > 0 && (
        <div className="totem-print-monitor-thumbs" role="tablist" aria-label="Páginas del documento">
          {thumbsForActive.map((page, i) => {
            const selected = i === activePage
            const willPrint = !selectionEnabled || selectedSet.has(page.pageInSource)
            const thumbColor: PrintColorMode = forceBw ? 'bw' : forceColor ? 'color' : page.color
            return (
              <div
                key={`${page.sourceIndex}-${page.pageInSource}-${i}`}
                className={`totem-print-monitor-thumb-wrap${willPrint ? '' : ' totem-print-monitor-thumb-wrap--off'}`}
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  className={`totem-print-monitor-thumb totem-print-monitor-thumb--papel-${papelTone} ${
                    selected ? 'totem-print-monitor-thumb--active' : ''
                  }${!willPrint ? ' totem-print-monitor-thumb--excluded' : ''}`}
                  onClick={() => {
                    setActivePage(i)
                    onActiveSourceChange?.(page.sourceIndex)
                  }}
                  title={`Hoja ${page.pageInSource} de ${activeFilePages} — ${page.label}`}
                >
                  <img
                    src={page.previewUrl}
                    alt={`Hoja ${page.pageInSource}`}
                    className={`totem-print-monitor-thumb-img totem-print-monitor-thumb-img--${thumbColor}`}
                  />
                  <span className={`totem-print-monitor-thumb-badge totem-print-monitor-thumb-badge--${thumbColor}`}>
                    {thumbColor === 'color' ? 'C' : 'B/N'}
                  </span>
                  <span className="totem-print-monitor-thumb-num">
                    {page.pageInSource}/{activeFilePages || pageCount}
                  </span>
                </button>
                {selectionEnabled && (
                  <button
                    type="button"
                    className={`totem-print-monitor-page-toggle${willPrint ? ' is-on' : ''}`}
                    aria-pressed={willPrint}
                    title={willPrint ? 'Quitar de la impresión' : 'Incluir en la impresión'}
                    onClick={(e) => {
                      e.stopPropagation()
                      onTogglePage?.(page.sourceIndex, page.pageInSource)
                    }}
                  >
                    {willPrint ? '✓' : '–'}
                  </button>
                )}
              </div>
            )
          })}
          {activeFilePages > thumbsForActive.length && (
            <div className="totem-print-monitor-more">
              +{activeFilePages - thumbsForActive.length} hojas más
              <span className="totem-print-monitor-more-sub">
                Usá «Todas» / «Ninguna» para el resto
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ColorChip({
  detection,
  colorPages,
  bwPages,
  modoColor
}: {
  detection: PrintColorDetection
  colorPages: number
  bwPages: number
  modoColor: TotemPrintColorModo
}) {
  if (modoColor === 'bn') {
    return <span className="totem-print-monitor-chip totem-print-monitor-chip--bw">⬛ Blanco y negro</span>
  }
  if (modoColor === 'color') {
    return <span className="totem-print-monitor-chip totem-print-monitor-chip--color">🎨 Color</span>
  }
  if (detection === 'mixed') {
    return (
      <span className="totem-print-monitor-chip totem-print-monitor-chip--mixed">
        🎨 Mixto · {colorPages} color / {bwPages} B/N
      </span>
    )
  }
  return (
    <span className={`totem-print-monitor-chip totem-print-monitor-chip--${detection}`}>
      {detection === 'color' ? '🎨 Color (auto)' : '⬛ B/N (auto)'}
    </span>
  )
}

function PrintModeOverlay({
  format,
  detection,
  activeColor,
  modoColor,
  papelLabel,
  fazLabel,
  hojaActual,
  pageCount
}: {
  format: 'A4' | 'A3' | 'A3E'
  detection: PrintColorDetection
  activeColor?: PrintColorMode
  modoColor: TotemPrintColorModo
  papelLabel: string
  fazLabel: string
  hojaActual: number
  pageCount: number
}) {
  let tag: 'COLOR' | 'B/N'
  if (modoColor === 'bn') tag = 'B/N'
  else if (modoColor === 'color') tag = 'COLOR'
  else if (detection === 'mixed') tag = activeColor === 'color' ? 'COLOR' : 'B/N'
  else tag = detection === 'color' ? 'COLOR' : 'B/N'
  const tagClass = tag === 'COLOR' ? 'color' : 'bw'

  return (
    <div className="totem-print-monitor-overlay" aria-hidden>
      <span className="totem-print-monitor-overlay-tag">{format}</span>
      <span className={`totem-print-monitor-overlay-tag totem-print-monitor-overlay-tag--${tagClass}`}>{tag}</span>
      <span className="totem-print-monitor-overlay-tag totem-print-monitor-overlay-tag--papel">{papelLabel}</span>
      <span className="totem-print-monitor-overlay-tag">{fazLabel}</span>
      {hojaActual > 0 && pageCount > 0 && (
        <span className="totem-print-monitor-overlay-tag totem-print-monitor-overlay-tag--page">
          {hojaActual}/{pageCount}
        </span>
      )}
    </div>
  )
}

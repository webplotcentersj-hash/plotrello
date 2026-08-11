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
import './TotemPrintPreviewMonitor.css'

export type TotemPreviewSource = {
  source: string
  name?: string
}

type Props = {
  sources: TotemPreviewSource[]
  formatoImpresion: 'A4' | 'A3' | 'A3E'
  /** Si el usuario fuerza B/N o color, la vista previa lo refleja. */
  modoColor?: TotemPrintColorModo
  tipoPapel?: TotemPrintPapelId
  fazImpresion?: TotemPrintFaz
  onAnalysis?: (data: {
    pageCount: number
    colorDetection: PrintColorDetection
    colorPages: number
    bwPages: number
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

export default function TotemPrintPreviewMonitor({
  sources,
  formatoImpresion,
  modoColor = 'auto',
  tipoPapel = TOTEM_PRINT_PAPEL_DEFAULT,
  fazImpresion = 'simple',
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

  const title =
    sources.length === 0
      ? 'Sin archivo aún'
      : sources.length === 1
        ? sources[0].name?.trim() || 'Documento'
        : `${sources.length} archivos`

  const hojaActual = active ? activePage + 1 : 0
  const hojaFinVista = previews.length
  const rangoTexto =
    pageCount <= 0
      ? ''
      : pageCount === 1
        ? 'Hoja 1 de 1'
        : hojaActual > 0
          ? `Hoja ${hojaActual} de ${pageCount}`
          : `Hojas 1–${pageCount}`

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
            : pageCount <= 0
              ? 'Sin hojas'
              : pageCount === 1
                ? '1 hoja'
                : `Hojas 1–${pageCount}`}
        </span>
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
        forceBw ? 'totem-print-monitor--force-bw' : ''
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="totem-print-monitor-head">
        <p className="totem-print-monitor-kicker">Monitor de impresión</p>
        <h2 className="totem-print-monitor-title">{title}</h2>
        <p className="totem-print-monitor-range">
          {labelPrintFormat(formatoImpresion)} · {papelLabel} · {fazLabel} · {colorLabel}
          {!loading && pageCount > 0
            ? ` · ${rangoTexto}${pageCount > 1 ? ` · Rango 1–${pageCount}` : ''}${
                pageCount > hojaFinVista ? ` · Vista 1–${hojaFinVista}` : ''
              }`
            : ''}
        </p>
      </div>

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
              alt={`Vista previa hoja ${hojaActual} de ${pageCount}`}
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
            pageCount={pageCount}
          />
        </div>
      </div>

      {specs}

      {previews.length > 0 && (
        <div className="totem-print-monitor-thumbs" role="tablist" aria-label="Páginas del documento">
          {previews.map((page, i) => {
            const selected = i === activePage
            const thumbColor: PrintColorMode = forceBw ? 'bw' : forceColor ? 'color' : page.color
            return (
              <button
                key={`${page.sourceIndex}-${page.pageInSource}-${i}`}
                type="button"
                role="tab"
                aria-selected={selected}
                className={`totem-print-monitor-thumb totem-print-monitor-thumb--papel-${papelTone} ${
                  selected ? 'totem-print-monitor-thumb--active' : ''
                }`}
                onClick={() => setActivePage(i)}
                title={`Hoja ${i + 1} de ${pageCount} — ${page.label}`}
              >
                <img
                  src={page.previewUrl}
                  alt={`Hoja ${i + 1}`}
                  className={`totem-print-monitor-thumb-img totem-print-monitor-thumb-img--${thumbColor}`}
                />
                <span className={`totem-print-monitor-thumb-badge totem-print-monitor-thumb-badge--${thumbColor}`}>
                  {thumbColor === 'color' ? 'C' : 'B/N'}
                </span>
                <span className="totem-print-monitor-thumb-num">
                  {i + 1}/{pageCount}
                </span>
              </button>
            )
          })}
          {pageCount > previews.length && (
            <div className="totem-print-monitor-more">
              +{pageCount - previews.length} hojas más
              <span className="totem-print-monitor-more-sub">
                (vista {hojaFinVista + 1}–{pageCount})
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

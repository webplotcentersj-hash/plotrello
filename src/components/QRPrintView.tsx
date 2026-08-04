import { useEffect, useState, useRef } from 'react'
import { toDataURL } from 'qrcode'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import './QRPrintView.css'

type QRPrintViewProps = {
  opNumber: string
  cliente: string
  labelOverride?: 'OP' | 'Ficha'
  onClose: () => void
}

const QRPrintView = ({ opNumber, cliente, labelOverride, onClose }: QRPrintViewProps) => {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingTicket, setSavingTicket] = useState(false)
  const [ticketMode, setTicketMode] = useState(false)
  const printRef = useRef<HTMLDivElement>(null)
  const ticketRef = useRef<HTMLDivElement>(null)
  const etiqueta = labelOverride || (opNumber?.toUpperCase().startsWith('FICHA') ? 'Ficha' : 'OP')
  const displayNumero = (() => {
    if (etiqueta !== 'Ficha') return opNumber
    const raw = (opNumber || '').trim()
    const stripped = raw.replace(/^FICHA[\s-_#:]*/i, '')
    return stripped || raw
  })()

  const publicUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/op-public/${encodeURIComponent(opNumber)}`
      : ''

  const whatsappShareUrl = publicUrl
    ? `https://wa.me/?text=${encodeURIComponent(
        `Hola! Podés consultar el estado de tu ${etiqueta} ${displayNumero} (${cliente}) en este enlace:\n\n${publicUrl}`
      )}`
    : ''

  const fileBase = `QR_${etiqueta.toUpperCase()}_${displayNumero}_${cliente.replace(/\s+/g, '_')}`

  useEffect(() => {
    const generateQRCode = async () => {
      try {
        const dataUrl = await toDataURL(publicUrl || `${opNumber}`, {
          width: 280,
          margin: 1,
          errorCorrectionLevel: 'M'
        })
        setQrDataUrl(dataUrl)
      } catch (error) {
        console.error('Error generando QR:', error)
      } finally {
        setLoading(false)
      }
    }

    generateQRCode()
  }, [opNumber, publicUrl])

  useEffect(() => {
    return () => {
      document.documentElement.classList.remove('qr-printing-ticket')
      document.getElementById('qr-ticket-print-root')?.remove()
      document.getElementById('qr-ticket-page-style')?.remove()
    }
  }, [])

  const handleSavePDF = async () => {
    if (!printRef.current || !qrDataUrl) return

    setSaving(true)
    try {
      const canvas = await html2canvas(printRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        width: printRef.current.scrollWidth,
        height: printRef.current.scrollHeight,
        ignoreElements: (el) => el.classList?.contains('qr-no-pdf')
      })

      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      })

      const pdfWidth = pdf.internal.pageSize.getWidth()
      const pdfHeight = pdf.internal.pageSize.getHeight()
      const imgWidth = canvas.width
      const imgHeight = canvas.height
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight)
      const imgScaledWidth = imgWidth * ratio
      const imgScaledHeight = imgHeight * ratio
      const xOffset = (pdfWidth - imgScaledWidth) / 2
      const yOffset = (pdfHeight - imgScaledHeight) / 2

      pdf.addImage(imgData, 'PNG', xOffset, yOffset, imgScaledWidth, imgScaledHeight)
      pdf.save(`${fileBase}.pdf`)
    } catch (error) {
      console.error('Error generando PDF:', error)
      alert('Error al generar el PDF. Por favor, intenta nuevamente.')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveTicketImage = async () => {
    if (!ticketRef.current || !qrDataUrl) return
    setSavingTicket(true)
    try {
      const canvas = await html2canvas(ticketRef.current, {
        scale: 3,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      })
      const link = document.createElement('a')
      link.download = `${fileBase}_ticket.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
    } catch (error) {
      console.error('Error guardando ticket:', error)
      alert('Error al guardar la imagen del ticket. Intentá de nuevo.')
    } finally {
      setSavingTicket(false)
    }
  }

  const handlePrintTicket = () => {
    if (!ticketRef.current || !qrDataUrl) return

    document.getElementById('qr-ticket-print-root')?.remove()
    document.getElementById('qr-ticket-page-style')?.remove()

    const root = document.createElement('div')
    root.id = 'qr-ticket-print-root'
    root.setAttribute('aria-hidden', 'true')
    const clone = ticketRef.current.cloneNode(true) as HTMLElement
    clone.classList.add('qr-print-preview-ticket--print')
    root.appendChild(clone)
    document.body.appendChild(root)

    const style = document.createElement('style')
    style.id = 'qr-ticket-page-style'
    style.textContent = '@media print { @page { size: 80mm auto; margin: 2mm; } }'
    document.head.appendChild(style)

    document.documentElement.classList.add('qr-printing-ticket')

    const cleanup = () => {
      document.documentElement.classList.remove('qr-printing-ticket')
      document.getElementById('qr-ticket-print-root')?.remove()
      document.getElementById('qr-ticket-page-style')?.remove()
      window.removeEventListener('afterprint', cleanup)
    }
    window.addEventListener('afterprint', cleanup)
    // Fallback largo: no sacar el nodo mientras el diálogo de impresión sigue abierto
    window.setTimeout(cleanup, 120_000)

    // Dejar que el DOM pinte el nodo de print antes del diálogo
    window.requestAnimationFrame(() => {
      window.print()
    })
  }

  return (
    <>
      <div
        className={`qr-print-modal-overlay${ticketMode ? ' qr-print-modal-overlay--ticket' : ''}`}
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onClose()
        }}
        onTouchStart={(e) => {
          if (e.target === e.currentTarget) onClose()
        }}
      >
        <div className="qr-print-modal-content" onClick={(e) => e.stopPropagation()}>
          <header className="qr-print-modal-header">
            <h2>
              {ticketMode
                ? `Ticket - ${etiqueta} ${displayNumero}`
                : `QR para Cliente - ${etiqueta} ${displayNumero}`}
            </h2>
            <button type="button" className="modal-close" onClick={onClose}>
              ×
            </button>
          </header>
          <div className="qr-print-modal-body">
            {!ticketMode ? (
              <>
                <p className="qr-print-preview-lead">Vista previa de la tarjeta para el cliente</p>

                <div className="qr-print-preview-card" ref={printRef}>
                  <div className="qr-print-header">
                    <div className="qr-print-logo">
                      <img src="/plot-lab-logo.png" alt="Plot Center Logo" className="qr-print-logo-img" />
                    </div>
                    <div className="qr-print-title">
                      <h1 className="qr-print-op">
                        {etiqueta} {displayNumero}
                      </h1>
                      <h2 className="qr-print-cliente">{cliente}</h2>
                    </div>
                  </div>

                  <div className="qr-print-content">
                    <div className="qr-print-instructions">
                      <p className="instructions-title">Consulta el estado de tu orden</p>
                      <p className="instructions-text">
                        Escaneá el código QR con tu celular para ver en tiempo real el estado de tu orden de
                        trabajo.
                      </p>
                    </div>

                    <div className="qr-print-qr-container">
                      {loading ? (
                        <div className="qr-loading">Generando código QR...</div>
                      ) : qrDataUrl ? (
                        <img src={qrDataUrl} alt="Código QR" className="qr-print-qr" />
                      ) : (
                        <div className="qr-error">Error al generar QR</div>
                      )}
                    </div>

                    <div className="qr-print-footer">
                      <p className="footer-text">
                        <strong>Plot Center</strong> - Impresión y Diseño Gráfico
                      </p>
                      <div className="qr-print-footer-url-row">
                        <p className="footer-url">{publicUrl}</p>
                        {whatsappShareUrl ? (
                          <a
                            href={whatsappShareUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn-whatsapp-compact qr-no-pdf"
                            title="Enviar enlace por WhatsApp"
                            aria-label="Enviar enlace por WhatsApp"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                            </svg>
                            WhatsApp
                          </a>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="qr-print-actions">
                  <button type="button" className="btn-secondary" onClick={onClose}>
                    Cerrar
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setTicketMode(true)}
                    disabled={loading || !qrDataUrl}
                  >
                    Imprimir ticket
                  </button>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={handleSavePDF}
                    disabled={loading || !qrDataUrl || saving}
                  >
                    {saving ? 'Guardando…' : 'Guardar PDF'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="qr-print-preview-lead qr-print-ticket-label">
                  Formato ticket (~80 mm) · impresora térmica
                </p>
                <div className="qr-print-preview-ticket" ref={ticketRef}>
                  <img src="/plot-lab-logo.png" alt="" className="qr-ticket-logo" />
                  <p className="qr-ticket-brand">PLOT CENTER</p>
                  <p className="qr-ticket-op">
                    {etiqueta} {displayNumero}
                  </p>
                  <p className="qr-ticket-cliente">{cliente}</p>
                  <div className="qr-ticket-sep" aria-hidden />
                  <p className="qr-ticket-hint">Escaneá el QR para ver el estado de tu orden</p>
                  <div className="qr-ticket-qr-wrap">
                    {qrDataUrl ? (
                      <img src={qrDataUrl} alt="Código QR" className="qr-ticket-qr" />
                    ) : (
                      <div className="qr-ticket-loading">Error QR</div>
                    )}
                  </div>
                  <p className="qr-ticket-url">{publicUrl}</p>
                  <div className="qr-ticket-sep" aria-hidden />
                  <p className="qr-ticket-footer">Impresión · Diseño · Comunicación visual</p>
                </div>

                <div className="qr-print-actions">
                  <button type="button" className="btn-secondary" onClick={() => setTicketMode(false)}>
                    Volver
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={handlePrintTicket}
                    disabled={!qrDataUrl}
                  >
                    Imprimir
                  </button>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={handleSaveTicketImage}
                    disabled={!qrDataUrl || savingTicket}
                  >
                    {savingTicket ? 'Guardando…' : 'Guardar imagen'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

export default QRPrintView

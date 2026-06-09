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
  const printRef = useRef<HTMLDivElement>(null)
  const etiqueta = labelOverride || (opNumber?.toUpperCase().startsWith('FICHA') ? 'Ficha' : 'OP')
  const displayNumero = (() => {
    if (etiqueta !== 'Ficha') return opNumber
    const raw = (opNumber || '').trim()
    // Evitar "Ficha FICHA-123": mostramos solo el número si ya viene con prefijo FICHA
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

  useEffect(() => {
    const generateQRCode = async () => {
      try {
        const dataUrl = await toDataURL(publicUrl || `${opNumber}`, { width: 300, margin: 2 })
        setQrDataUrl(dataUrl)
      } catch (error) {
        console.error('Error generando QR:', error)
      } finally {
        setLoading(false)
      }
    }

    generateQRCode()
  }, [opNumber, publicUrl])

  const handleSavePDF = async () => {
    if (!printRef.current || !qrDataUrl) return

    setSaving(true)
    try {
      // Capturar el contenido como imagen
      const canvas = await html2canvas(printRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        width: printRef.current.scrollWidth,
        height: printRef.current.scrollHeight,
        ignoreElements: (el) => el.classList?.contains('qr-no-pdf'),
      })

      // Crear PDF
      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
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
      
      // Descargar el PDF
      pdf.save(`QR_${etiqueta.toUpperCase()}_${displayNumero}_${cliente.replace(/\s+/g, '_')}.pdf`)
    } catch (error) {
      console.error('Error generando PDF:', error)
      alert('Error al generar el PDF. Por favor, intenta nuevamente.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div
        className="qr-print-modal-overlay"
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
              QR para Cliente - {etiqueta} {displayNumero}
            </h2>
            <button type="button" className="modal-close" onClick={onClose}>
              ×
            </button>
          </header>
          <div className="qr-print-modal-body">
            <p style={{ marginBottom: '20px', color: '#6b7280', textAlign: 'center' }}>
              Vista previa de la tarjeta para el cliente
            </p>
            
            {/* Vista previa del contenido a imprimir */}
            <div className="qr-print-preview-card" ref={printRef}>
              <div className="qr-print-header">
                <div className="qr-print-logo">
                  <img 
                    src="https://trello.plotcenter.com.ar/Group%20187.png" 
                    alt="Plot Center Logo" 
                    className="qr-print-logo-img"
                  />
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
                    Escaneá el código QR con tu celular para ver en tiempo real el estado de tu orden de trabajo.
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
              <button type="button" className="btn-primary" onClick={handleSavePDF} disabled={loading || !qrDataUrl || saving}>
                {saving ? '⏳ Guardando...' : '💾 Guardar como PDF'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export default QRPrintView


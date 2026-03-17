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

  useEffect(() => {
    const generateQRCode = async () => {
      try {
        const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
        const qrUrl = `${baseUrl}/op-public/${opNumber}`
        const dataUrl = await toDataURL(qrUrl, { width: 300, margin: 2 })
        setQrDataUrl(dataUrl)
      } catch (error) {
        console.error('Error generando QR:', error)
      } finally {
        setLoading(false)
      }
    }

    generateQRCode()
  }, [opNumber])

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
                  <p className="footer-url">
                    {typeof window !== 'undefined' ? window.location.origin : ''}/op-public/{opNumber}
                  </p>
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


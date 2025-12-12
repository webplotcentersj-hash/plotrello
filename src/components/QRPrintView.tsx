import { useEffect, useState } from 'react'
import { toDataURL } from 'qrcode'
import './QRPrintView.css'

type QRPrintViewProps = {
  opNumber: string
  cliente: string
  onClose: () => void
}

const QRPrintView = ({ opNumber, cliente, onClose }: QRPrintViewProps) => {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const generateQRCode = async () => {
      try {
        const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
        const qrUrl = `${baseUrl}/op-public/${opNumber}`
        const dataUrl = await toDataURL(qrUrl, { width: 400, margin: 2 })
        setQrDataUrl(dataUrl)
      } catch (error) {
        console.error('Error generando QR:', error)
      } finally {
        setLoading(false)
      }
    }

    generateQRCode()
  }, [opNumber])

  const handlePrint = () => {
    window.print()
  }

  return (
    <>
      <div className="qr-print-modal-overlay" onClick={onClose}>
        <div className="qr-print-modal-content" onClick={(e) => e.stopPropagation()}>
          <header className="qr-print-modal-header">
            <h2>QR para Cliente - OP {opNumber}</h2>
            <button type="button" className="modal-close" onClick={onClose}>
              ×
            </button>
          </header>
          <div className="qr-print-modal-body">
            <p style={{ marginBottom: '20px', color: '#6b7280' }}>
              Esta es la vista de impresión. Haz clic en "Imprimir" para generar el documento para el cliente.
            </p>
            <div className="qr-print-actions">
              <button type="button" className="btn-secondary" onClick={onClose}>
                Cerrar
              </button>
              <button type="button" className="btn-primary" onClick={handlePrint} disabled={loading}>
                🖨️ Imprimir
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Vista de impresión */}
      <div className="qr-print-view">
        <div className="qr-print-container">
          <div className="qr-print-header">
            <div className="qr-print-logo">
              <div className="logo-box">
                <span className="logo-text">PLOT CENTER</span>
              </div>
            </div>
            <div className="qr-print-title">
              <h1 className="qr-print-op">OP {opNumber}</h1>
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
      </div>
    </>
  )
}

export default QRPrintView


import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import apiService from '../services/api'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import type { OrdenTrabajo } from '../types/api'
import './EntregaPage.css'

const EntregaPage = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { usuario } = useAuth()
  const [loading, setLoading] = useState(true)
  const [orden, setOrden] = useState<OrdenTrabajo | null>(null)
  const [firmaDataUrl, setFirmaDataUrl] = useState<string | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [observaciones, setObservaciones] = useState('')
  const [entregadoA, setEntregadoA] = useState('')
  const [dniRetira, setDniRetira] = useState('')
  const [saving, setSaving] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const comprobanteRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (id) {
      loadOrden()
    }
  }, [id])

  const loadOrden = async () => {
    setLoading(true)
    try {
      const response = await apiService.getOrdenes()
      if (response.success && response.data) {
        const ordenEncontrada = response.data.find(
          (o) => o.id?.toString() === id
        )
        if (ordenEncontrada) {
          setOrden(ordenEncontrada)
          setEntregadoA(ordenEncontrada.cliente || '')
        } else {
          alert('Orden no encontrada')
          navigate('/mostrador/ordenes-listas')
        }
      }
    } catch (error) {
      console.error('Error cargando orden:', error)
      alert('Error al cargar la orden')
    } finally {
      setLoading(false)
    }
  }

  const initCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = 400
    canvas.height = 150
    ctx.strokeStyle = '#000'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    let lastX = 0
    let lastY = 0

    const startDrawing = (e: MouseEvent | TouchEvent) => {
      setIsDrawing(true)
      const rect = canvas.getBoundingClientRect()
      const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left
      const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top
      lastX = x
      lastY = y
    }

    const draw = (e: MouseEvent | TouchEvent) => {
      if (!isDrawing) return
      e.preventDefault()
      const rect = canvas.getBoundingClientRect()
      const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left
      const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top

      ctx.beginPath()
      ctx.moveTo(lastX, lastY)
      ctx.lineTo(x, y)
      ctx.stroke()

      lastX = x
      lastY = y
    }

    const stopDrawing = () => {
      setIsDrawing(false)
      setFirmaDataUrl(canvas.toDataURL())
    }

    canvas.addEventListener('mousedown', startDrawing)
    canvas.addEventListener('mousemove', draw)
    canvas.addEventListener('mouseup', stopDrawing)
    canvas.addEventListener('mouseout', stopDrawing)
    canvas.addEventListener('touchstart', startDrawing)
    canvas.addEventListener('touchmove', draw)
    canvas.addEventListener('touchend', stopDrawing)

    return () => {
      canvas.removeEventListener('mousedown', startDrawing)
      canvas.removeEventListener('mousemove', draw)
      canvas.removeEventListener('mouseup', stopDrawing)
      canvas.removeEventListener('mouseout', stopDrawing)
      canvas.removeEventListener('touchstart', startDrawing)
      canvas.removeEventListener('touchmove', draw)
      canvas.removeEventListener('touchend', stopDrawing)
    }
  }

  useEffect(() => {
    if (!loading && orden) {
      const cleanup = initCanvas()
      return cleanup
    }
  }, [loading, orden, isDrawing])

  const limpiarFirma = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setFirmaDataUrl(null)
  }

  const handleMarcarEntregada = async () => {
    if (!orden || !usuario) return

    if (!firmaDataUrl) {
      alert('Por favor, firma el comprobante antes de continuar')
      return
    }

    if (!entregadoA.trim()) {
      alert('Por favor, ingresa el nombre de quien retira')
      return
    }

    setSaving(true)
    try {
      // Aquí actualizarías el estado de la orden en Supabase
      // Por ahora simulamos la actualización
      console.log('Marcando orden como entregada:', {
        ordenId: orden.id,
        entregadoA,
        dniRetira,
        observaciones,
        firma: firmaDataUrl.substring(0, 50) + '...',
        usuario: usuario.nombre
      })

      // TODO: Implementar actualización real en Supabase
      // await apiService.marcarOrdenEntregada(orden.id!, {
      //   entregado_a: entregadoA,
      //   dni_retira: dniRetira,
      //   observaciones,
      //   firma_data_url: firmaDataUrl,
      //   usuario_id: usuario.id
      // })

      alert('Orden marcada como entregada exitosamente')
      navigate('/mostrador/ordenes-listas')
    } catch (error) {
      console.error('Error marcando orden como entregada:', error)
      alert('Error al marcar la orden como entregada')
    } finally {
      setSaving(false)
    }
  }

  const generarComprobantePDF = async () => {
    if (!comprobanteRef.current || !orden) return

    try {
      const canvas = await html2canvas(comprobanteRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
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
      pdf.save(`Comprobante_Entrega_OP_${orden.numero_op}.pdf`)
    } catch (error) {
      console.error('Error generando PDF:', error)
      alert('Error al generar el comprobante PDF')
    }
  }

  if (loading) {
    return (
      <div className="entrega-page">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Cargando orden...</p>
        </div>
      </div>
    )
  }

  if (!orden) {
    return (
      <div className="entrega-page">
        <div className="error-container">
          <p>Orden no encontrada</p>
          <button onClick={() => navigate('/mostrador/ordenes-listas')}>
            Volver a Órdenes Listas
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="entrega-page">
      <header className="page-header">
        <div className="header-content">
          <div>
            <h1>📋 Procesar Entrega - OP #{orden.numero_op}</h1>
            <p className="subtitle">{orden.cliente}</p>
          </div>
          <button
            className="btn-secondary"
            onClick={() => navigate('/mostrador/ordenes-listas')}
          >
            ← Volver
          </button>
        </div>
      </header>

      <div className="entrega-content">
        {/* Información de la Orden */}
        <section className="orden-info-section">
          <h2>Información de la Orden</h2>
          <div className="info-grid">
            <div className="info-item">
              <label>N° OP:</label>
              <span>{orden.numero_op}</span>
            </div>
            <div className="info-item">
              <label>Cliente:</label>
              <span>{orden.cliente}</span>
            </div>
            {orden.dni_cuit && (
              <div className="info-item">
                <label>DNI/CUIT:</label>
                <span>{orden.dni_cuit}</span>
              </div>
            )}
            {orden.descripcion && (
              <div className="info-item full-width">
                <label>Descripción:</label>
                <span>{orden.descripcion}</span>
              </div>
            )}
            {orden.fecha_creacion && (
              <div className="info-item">
                <label>Fecha Creación:</label>
                <span>{new Date(orden.fecha_creacion).toLocaleDateString('es-AR')}</span>
              </div>
            )}
            {orden.fecha_entrega && (
              <div className="info-item">
                <label>Fecha Entrega Estimada:</label>
                <span>{new Date(orden.fecha_entrega).toLocaleDateString('es-AR')}</span>
              </div>
            )}
          </div>
        </section>

        {/* Datos de Entrega */}
        <section className="datos-entrega-section">
          <h2>Datos de Entrega</h2>
          <div className="form-group">
            <label>Entregado a: *</label>
            <input
              type="text"
              value={entregadoA}
              onChange={(e) => setEntregadoA(e.target.value)}
              placeholder="Nombre completo de quien retira"
            />
          </div>
          <div className="form-group">
            <label>DNI de quien retira (opcional):</label>
            <input
              type="text"
              value={dniRetira}
              onChange={(e) => setDniRetira(e.target.value)}
              placeholder="DNI"
            />
          </div>
          <div className="form-group">
            <label>Observaciones:</label>
            <textarea
              rows={3}
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Observaciones sobre la entrega..."
            />
          </div>
        </section>

        {/* Firma Digital */}
        <section className="firma-section">
          <h2>Firma del Cliente</h2>
          <div className="firma-container">
            <canvas
              ref={canvasRef}
              className="firma-canvas"
            />
            <div className="firma-actions">
              <button
                className="btn-secondary"
                onClick={limpiarFirma}
              >
                🗑️ Limpiar Firma
              </button>
            </div>
          </div>
          <p className="firma-hint">Firma en el área de arriba</p>
        </section>

        {/* Vista Previa del Comprobante */}
        <section className="comprobante-section">
          <h2>Comprobante de Entrega</h2>
          <div className="comprobante-preview" ref={comprobanteRef}>
            <div className="comprobante-header">
              <img
                src="https://trello.plotcenter.com.ar/Group%20187.png"
                alt="Plot Center Logo"
                className="comprobante-logo"
              />
              <div>
                <h3>COMPROBANTE DE ENTREGA</h3>
                <p>Plot Center - Impresión y Diseño Gráfico</p>
              </div>
            </div>
            <div className="comprobante-body">
              <div className="comprobante-row">
                <strong>N° OP:</strong>
                <span>{orden.numero_op}</span>
              </div>
              <div className="comprobante-row">
                <strong>Cliente:</strong>
                <span>{orden.cliente}</span>
              </div>
              {orden.dni_cuit && (
                <div className="comprobante-row">
                  <strong>DNI/CUIT:</strong>
                  <span>{orden.dni_cuit}</span>
                </div>
              )}
              <div className="comprobante-row">
                <strong>Entregado a:</strong>
                <span>{entregadoA || '________________'}</span>
              </div>
              {dniRetira && (
                <div className="comprobante-row">
                  <strong>DNI de quien retira:</strong>
                  <span>{dniRetira}</span>
                </div>
              )}
              <div className="comprobante-row">
                <strong>Fecha de Entrega:</strong>
                <span>{new Date().toLocaleDateString('es-AR')}</span>
              </div>
              {observaciones && (
                <div className="comprobante-row full-width">
                  <strong>Observaciones:</strong>
                  <span>{observaciones}</span>
                </div>
              )}
              {orden.descripcion && (
                <div className="comprobante-row full-width">
                  <strong>Descripción del Trabajo:</strong>
                  <span>{orden.descripcion}</span>
                </div>
              )}
              <div className="comprobante-firma">
                <div className="firma-label">Firma del Cliente:</div>
                {firmaDataUrl ? (
                  <img src={firmaDataUrl} alt="Firma" className="firma-preview" />
                ) : (
                  <div className="firma-placeholder">________________</div>
                )}
              </div>
            </div>
            <div className="comprobante-footer">
              <p>Este comprobante certifica que la orden de trabajo ha sido entregada correctamente.</p>
              <p className="footer-small">
                Generado el {new Date().toLocaleString('es-AR')} por {usuario?.nombre || 'Sistema'}
              </p>
            </div>
          </div>
        </section>

        {/* Acciones */}
        <section className="acciones-section">
          <button
            className="btn-secondary"
            onClick={generarComprobantePDF}
            disabled={!firmaDataUrl}
          >
            💾 Descargar Comprobante PDF
          </button>
          <button
            className="btn-primary"
            onClick={handleMarcarEntregada}
            disabled={saving || !firmaDataUrl || !entregadoA.trim()}
          >
            {saving ? 'Guardando...' : '✅ Marcar como Entregada'}
          </button>
        </section>
      </div>
    </div>
  )
}

export default EntregaPage

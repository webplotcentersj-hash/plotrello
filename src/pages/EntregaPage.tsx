import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { dispatchMensajeriaDmUnreadRefresh } from '../hooks/useDmMensajeriaUnread'
import apiService from '../services/api'
import { supabase } from '../services/supabaseClient'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import type { OrdenTrabajo } from '../types/api'
import './EntregaPage.css'

function buildWhatsAppLink(phone?: string | null): string {
  if (!phone || !phone.trim()) return '#'
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 8) return '#'
  let num = digits
  if (num.startsWith('54')) num = num.slice(2)
  if (num.startsWith('15') && num.length >= 10) num = '9' + num.slice(2)
  else if (num.length <= 10 && !num.startsWith('9')) num = '9' + num
  if (!num.startsWith('54')) num = '54' + num
  return `https://wa.me/${num}?text=${encodeURIComponent('Su orden fue entregada. Cualquier duda estamos a disposición.')}`
}

const EntregaPage = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { usuario } = useAuth()
  const [loading, setLoading] = useState(true)
  const [orden, setOrden] = useState<OrdenTrabajo | null>(null)
  const [firmaDataUrl, setFirmaDataUrl] = useState<string | null>(null)
  const [observaciones, setObservaciones] = useState('')
  const [entregadoA, setEntregadoA] = useState('')
  const [dniRetira, setDniRetira] = useState('')
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<{ entregadoA?: string; firma?: string }>({})
  const [success, setSuccess] = useState(false)
  const [firmaCargadaDesdeTablet, setFirmaCargadaDesdeTablet] = useState(false)
  const [pedidoTgLoading, setPedidoTgLoading] = useState(false)
  const [pedidoTgMsg, setPedidoTgMsg] = useState<string | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const comprobanteRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (id) {
      loadOrden()
    }
  }, [id])

  // Suscripción Realtime: cuando el cliente firma en otro dispositivo, la firma se ve al instante aquí
  useEffect(() => {
    const client = supabase
    if (!orden?.numero_op || !client) return
    const numeroOp = orden.numero_op.trim()
    const channel = client
      .channel(`firma-cliente-${numeroOp}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'firmas_entrega_cliente',
          filter: `numero_op=eq.${numeroOp}`
        },
        (payload) => {
          const row = payload.new as { firma_data_url?: string; entregado_a?: string; dni_retira?: string } | undefined
          if (row?.firma_data_url) {
            setFirmaDataUrl(row.firma_data_url)
            setFirmaCargadaDesdeTablet(true)
          }
          if (row?.entregado_a) setEntregadoA(row.entregado_a)
          if (row?.dni_retira) setDniRetira(row.dni_retira)
        }
      )
      .subscribe()
    return () => {
      client.removeChannel(channel)
    }
  }, [orden?.id, orden?.numero_op])

  const FIRMA_CLIENTE_STORAGE_PREFIX = 'firma_cliente_'

  const loadOrden = async () => {
    const ordenId = id ? Number(id) : NaN
    if (!id || Number.isNaN(ordenId)) {
      setLoading(false)
      navigate('/mostrador/ordenes-listas')
      return
    }
    setLoading(true)
    try {
      const response = await apiService.getOrden(ordenId)
      if (response.success && response.data) {
        const ordenEncontrada = response.data
        setOrden(ordenEncontrada)
        setEntregadoA(ordenEncontrada.cliente || '')
        // Precargar firma si el cliente ya firmó (backend) o en esta misma pestaña (sessionStorage)
        let data: { firmaDataUrl?: string; entregadoA?: string; dniRetira?: string } | null = null
        const firmaRes = await apiService.getFirmaCliente(ordenEncontrada.numero_op)
        if (firmaRes.success && firmaRes.data) data = firmaRes.data
        if (!data) {
          try {
            const key = FIRMA_CLIENTE_STORAGE_PREFIX + ordenEncontrada.numero_op
            const stored = sessionStorage.getItem(key)
            if (stored) data = JSON.parse(stored) as typeof data
          } catch {
            /* ignorar */
          }
        }
        if (data?.firmaDataUrl) {
          setFirmaDataUrl(data.firmaDataUrl)
          setFirmaCargadaDesdeTablet(true)
        }
        if (data?.entregadoA) setEntregadoA(data.entregadoA)
        if (data?.dniRetira) setDniRetira(data.dniRetira)
      } else {
        alert(response.error || 'Orden no encontrada')
        navigate('/mostrador/ordenes-listas')
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

    const ctx = canvas.getContext('2d', { willReadFrequently: false })
    if (!ctx) return

    // Configurar tamaño del canvas con alta resolución para mejor calidad
    const dpr = window.devicePixelRatio || 1
    const displayWidth = 600
    const displayHeight = 200
    
    canvas.width = displayWidth * dpr
    canvas.height = displayHeight * dpr
    canvas.style.width = displayWidth + 'px'
    canvas.style.height = displayHeight + 'px'
    
    // Escalar el contexto para la alta resolución
    ctx.scale(dpr, dpr)
    
    // Configurar estilo de dibujo mejorado
    ctx.strokeStyle = '#000000'
    ctx.fillStyle = '#000000'
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.globalCompositeOperation = 'source-over'
    
    // Suavizado para mejor calidad
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'

    let lastX = 0
    let lastY = 0
    let isDrawingLocal = false

    const getCoordinates = (e: MouseEvent | TouchEvent) => {
      const rect = canvas.getBoundingClientRect()
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
      return {
        x: ((clientX - rect.left) / rect.width) * displayWidth,
        y: ((clientY - rect.top) / rect.height) * displayHeight
      }
    }

    const startDrawing = (e: MouseEvent | TouchEvent) => {
      isDrawingLocal = true
      const coords = getCoordinates(e)
      lastX = coords.x
      lastY = coords.y
      
      // Dibujar un punto inicial para capturar clics rápidos
      ctx.beginPath()
      ctx.arc(lastX, lastY, ctx.lineWidth / 2, 0, Math.PI * 2)
      ctx.fill()
    }

    const draw = (e: MouseEvent | TouchEvent) => {
      if (!isDrawingLocal) return
      e.preventDefault()
      const coords = getCoordinates(e)
      const x = coords.x
      const y = coords.y

      ctx.beginPath()
      ctx.moveTo(lastX, lastY)
      ctx.lineTo(x, y)
      ctx.stroke()

      lastX = x
      lastY = y
    }

    const stopDrawing = () => {
      if (isDrawingLocal) {
        isDrawingLocal = false
        // Guardar con mejor calidad
        setFirmaDataUrl(canvas.toDataURL('image/png', 1.0))
      }
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
  }, [loading, orden])

  const handlePedirTallerGrafico = async () => {
    if (!orden || !usuario) return
    setPedidoTgLoading(true)
    setPedidoTgMsg(null)
    try {
      const res = await apiService.broadcastPedidoTallerGraficoDesdeEntrega({
        idOrden: orden.id!,
        numeroOp: String(orden.numero_op ?? '').trim(),
        cliente: String(orden.cliente ?? '').trim(),
        solicitanteId: usuario.id,
        solicitanteNombre: usuario.nombre,
        solicitanteRol: usuario.rol
      })
      if (!res.success) {
        setPedidoTgMsg(res.error || 'No se pudo enviar el aviso.')
      } else {
        setPedidoTgMsg('Aviso enviado: en Taller Gráfico se abre el aviso con sonido y luces.')
        window.setTimeout(() => setPedidoTgMsg(null), 6000)

        // Además del broadcast (instantáneo), dejar un mensaje persistente en /mensajeria para Taller Gráfico.
        try {
          const uRes = await apiService.getUsuarios()
          const usuariosTg =
            uRes.success && uRes.data ? uRes.data.filter((u) => u.rol === 'taller-grafico') : []

          const texto =
            `🖨️ Pedido a Taller Gráfico\n` +
            `OP #${String(orden.numero_op ?? '').trim()} · ${String(orden.cliente ?? '').trim()}\n` +
            `Solicitante: ${usuario.nombre} (${usuario.rol})\n` +
            `Acción: revisar pedido desde Entrega.`

          let enviados = 0
          for (const u of usuariosTg) {
            if (!u?.id || u.id === usuario.id) continue
            const roomRes = await apiService.obtenerOCrearRoomDm(usuario.id, u.id)
            if (!roomRes.success || !roomRes.data) continue
            const dmRes = await apiService.enviarMensajeDm({
              roomId: roomRes.data.roomId,
              contenido: texto,
              usuarioId: usuario.id
            })
            if (dmRes.success) enviados++
          }

          if (enviados > 0) dispatchMensajeriaDmUnreadRefresh()
        } catch (e) {
          console.warn('No se pudo enviar el mensaje a /mensajeria (TG):', e)
        }
      }
    } catch {
      setPedidoTgMsg('Error de red al enviar el aviso.')
    } finally {
      setPedidoTgLoading(false)
    }
  }

  const limpiarFirma = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setFirmaDataUrl(null)
  }

  const validateForm = (): boolean => {
    const newErrors: { entregadoA?: string; firma?: string } = {}
    
    if (!entregadoA.trim()) {
      newErrors.entregadoA = 'El nombre de quien retira es obligatorio'
    } else if (entregadoA.trim().length < 3) {
      newErrors.entregadoA = 'El nombre debe tener al menos 3 caracteres'
    }
    
    if (!firmaDataUrl) {
      newErrors.firma = 'La firma del cliente es obligatoria'
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleMarcarEntregada = async () => {
    if (!orden || !usuario) return

    // Validar formulario
    if (!validateForm()) {
      // Scroll al primer error después de que se actualice el estado
      setTimeout(() => {
        const firstErrorKey = Object.keys(errors)[0]
        if (firstErrorKey === 'entregadoA') {
          document.querySelector('.form-group input')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        } else if (firstErrorKey === 'firma') {
          document.querySelector('.firma-section')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      }, 100)
      return
    }

    setSaving(true)
    setSuccess(false)
    setErrors({})
    
    try {
      const response = await apiService.procesarEntrega(orden.id!, {
        firmaDataUrl: firmaDataUrl!,
        entregadoA: entregadoA.trim(),
        dniRetira: dniRetira.trim() || undefined,
        observaciones: observaciones.trim() || undefined,
        usuarioId: usuario.id,
        usuarioNombre: usuario.nombre
      })

      if (!response.success) {
        setErrors({ firma: response.error || 'Error al procesar la entrega' })
        return
      }

      setSuccess(true)
      // No descargar PDF aquí: solo el botón del banner de éxito (descarga manual).
      window.dispatchEvent(new Event('plotrello-orden-entregada'))
    } catch (error) {
      console.error('Error marcando orden como entregada:', error)
      setErrors({ firma: 'Error inesperado al procesar la entrega' })
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
          <div className="header-actions">
            <button
              type="button"
              className="btn-taller-grafico-request"
              onClick={() => void handlePedirTallerGrafico()}
              disabled={pedidoTgLoading || !orden.id}
              title="Aviso inmediato al sector Taller Gráfico (modal en pantalla y sonido)"
            >
              {pedidoTgLoading ? '⏳ Enviando…' : '🖨️ Pedir a Taller Gráfico'}
            </button>
            <a
              href={`/firma-cliente/${encodeURIComponent(orden.numero_op)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-firma-tablet"
              title="Abrir la página de firma para el cliente"
            >
              ✍️ Abrir página de firma
            </a>
            <button
              className="btn-secondary"
              onClick={() => navigate('/mostrador/ordenes-listas')}
            >
              ← Volver
            </button>
          </div>
        </div>
      </header>

      <div className="entrega-content">
        {pedidoTgMsg && (
          <div className={`entrega-tg-feedback${pedidoTgMsg.includes('Error') || pedidoTgMsg.includes('No se') ? ' entrega-tg-feedback--error' : ''}`}>
            {pedidoTgMsg}
          </div>
        )}
        {firmaCargadaDesdeTablet && (
          <div className="firma-tablet-banner">
            ✍️ La firma del cliente ya está cargada. Revisá los datos y confirmá la entrega.
          </div>
        )}
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
              onChange={(e) => {
                setEntregadoA(e.target.value)
                if (errors.entregadoA) {
                  setErrors({ ...errors, entregadoA: undefined })
                }
              }}
              placeholder="Nombre completo de quien retira"
              className={errors.entregadoA ? 'input-error' : ''}
              autoComplete="name"
            />
            {errors.entregadoA && (
              <span className="error-message">{errors.entregadoA}</span>
            )}
          </div>
          <div className="form-group">
            <label>DNI de quien retira (opcional):</label>
            <input
              type="text"
              value={dniRetira}
              onChange={(e) => setDniRetira(e.target.value)}
              placeholder="DNI"
              inputMode="numeric"
              pattern="[0-9]*"
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
          <h2>Firma del Cliente *</h2>
          {errors.firma && (
            <div className="error-banner">
              <span>⚠️ {errors.firma}</span>
            </div>
          )}
          <div className={`firma-container ${errors.firma ? 'firma-container-error' : ''}`}>
            <canvas
              ref={canvasRef}
              className="firma-canvas"
              onClick={() => {
                if (errors.firma) {
                  setErrors({ ...errors, firma: undefined })
                }
              }}
            />
            <div className="firma-actions">
              <button
                className="btn-secondary"
                onClick={limpiarFirma}
                type="button"
              >
                🗑️ Limpiar Firma
              </button>
              {firmaDataUrl && (
                <span className="firma-status">✅ Firma completada</span>
              )}
            </div>
          </div>
          <p className="firma-hint">
            {firmaDataUrl 
              ? '✅ Firma registrada. Podés limpiarla si necesitás corregirla.' 
              : '👆 Firma en el área de arriba con el dedo o el mouse'}
          </p>
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

        {/* Mensaje de éxito y acciones posteriores */}
        {success && (
          <div className="success-banner success-banner-full">
            <h3>✅ Orden entregada</h3>
            <p>
              El comprobante PDF <strong>no</strong> se descarga solo. Si lo necesitás, tocá «Descargar Comprobante PDF» abajo.
              Podés notificar al cliente por WhatsApp si tiene número cargado.
            </p>
            <div className="success-actions">
              <button
                className="btn-secondary"
                onClick={generarComprobantePDF}
                disabled={!firmaDataUrl}
                type="button"
              >
                💾 Descargar Comprobante PDF
              </button>
              {(orden.whatsapp_link || orden.telefono_cliente) && (
                <a
                  href={orden.whatsapp_link?.trim() || buildWhatsAppLink(orden.telefono_cliente)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-whatsapp"
                >
                  📱 Abrir WhatsApp para notificar al cliente
                </a>
              )}
              <button
                className="btn-primary"
                onClick={() => navigate('/mostrador/ordenes-listas')}
                type="button"
              >
                Volver a Órdenes Listas
              </button>
            </div>
          </div>
        )}

        {/* Acciones */}
        {!success && (
          <section className="acciones-section">
            <button
              className="btn-primary"
              onClick={handleMarcarEntregada}
              disabled={saving}
              type="button"
            >
              {saving ? '⏳ Guardando...' : '✅ Marcar como Entregada'}
            </button>
          </section>
        )}
      </div>
    </div>
  )
}

export default EntregaPage

import { useEffect, useState, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import apiService from '../services/api'
import type { OrdenSeguimientoPublico } from '../types/api'
import './OpPublicPage.css'

const OpPublicPage = () => {
  const { opNumber } = useParams<{ opNumber: string }>()
  const [orden, setOrden] = useState<OrdenSeguimientoPublico | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadOrden = async (isRefresh = false) => {
    if (!opNumber) {
      setError('Número de OP no proporcionado')
      setLoading(false)
      return
    }
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError(null)
    try {
      const response = await apiService.getOrdenSeguimientoPublico(opNumber)
      if (response.success && response.data) {
        setOrden(response.data)
      } else {
        setError('No se encontró la orden de trabajo')
      }
    } catch (err) {
      setError('Error al cargar la orden')
      console.error(err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    loadOrden()
  }, [opNumber])

  const estadoDisplay = useMemo(() => {
    if (!orden) return 'No disponible'

    const estadosMap: Record<string, string> = {
      Pendiente: 'Recibimos tu pedido',
      'Asesor Técnico': 'Revisando tu pedido',
      Presupuestos: 'Preparando tu presupuesto',
      'Finalizado Asesor Presupuestos': 'Tu presupuesto está listo',
      'Diseño Gráfico': 'Diseñando tu trabajo',
      'Diseño en Proceso': 'Diseñando tu trabajo',
      'En Espera': 'En cola de producción',
      'Imprenta (Área de Impresión)': 'Imprimiendo tu trabajo',
      'Taller de Imprenta': 'En taller de impresión',
      'Taller Gráfico': 'En taller gráfico',
      Instalaciones: 'Instalando tu trabajo',
      Metalúrgica: 'Fabricando estructuras',
      'Finalizado en Taller': 'Listo en taller',
      'Almacén de Entrega': 'Listo para retirar',
      'Entregado o Instalado': 'Entregado'
    }

    return estadosMap[orden.estado] || orden.estado
  }, [orden])

  const estadoColor = useMemo(() => {
    if (!orden) return '#0ea5e9'

    const colorMap: Record<string, string> = {
      Pendiente: '#64748b',
      'Asesor Técnico': '#8b5cf6',
      Presupuestos: '#8b5cf6',
      'Finalizado Asesor Presupuestos': '#10b981',
      'Diseño Gráfico': '#f97316',
      'Diseño en Proceso': '#f97316',
      'En Espera': '#64748b',
      'Imprenta (Área de Impresión)': '#0ea5e9',
      'Taller de Imprenta': '#0ea5e9',
      'Taller Gráfico': '#6366f1',
      Instalaciones: '#a855f7',
      Metalúrgica: '#ec4899',
      'Finalizado en Taller': '#10b981',
      'Almacén de Entrega': '#10b981',
      Mostrador: '#10b981',
      Caja: '#eab308',
      'Entregado o Instalado': '#16a34a'
    }

    return colorMap[orden.estado] || '#0ea5e9'
  }, [orden])

  const estadoDescripcion = useMemo(() => {
    if (!orden) return ''

    const descripcionesMap: Record<string, string> = {
      Pendiente: 'Tu pedido fue recibido. Pronto lo asignaremos a producción.',
      'Asesor Técnico': 'Estamos revisando las especificaciones de tu trabajo para planificar los siguientes pasos.',
      Presupuestos: 'Estamos preparando tu presupuesto. Te contactaremos cuando esté listo.',
      'Finalizado Asesor Presupuestos': 'Tu presupuesto está listo. Podés aprobarlo para que avancemos con la producción.',
      'Diseño Gráfico': 'Estamos diseñando tu pieza y preparando los archivos para imprimir.',
      'Diseño en Proceso': 'Seguimos trabajando en el diseño. Cualquier cambio lo coordinamos con vos.',
      'En Espera': 'Tu trabajo está en cola. En breve lo tomamos para producción.',
      'Imprenta (Área de Impresión)': 'Tu trabajo se está imprimiendo en nuestros equipos.',
      'Taller de Imprenta': 'Estamos en la etapa de impresión y acabados.',
      'Taller Gráfico': 'Estamos con corte, ploteo o acabados de tu trabajo.',
      Instalaciones: 'Estamos instalando o colocando tu trabajo en el lugar acordado.',
      Metalúrgica: 'Estamos fabricando las estructuras o soportes de tu trabajo.',
      'Finalizado en Taller': 'El trabajo en taller ya está terminado. Próximo paso: entrega o instalación.',
      'Almacén de Entrega': '¡Tu pedido está listo! Podés pasar a retirarlo o coordinamos la entrega.',
      Mostrador: 'Tu pedido está en mostrador. Podés acercarte a retirarlo.',
      Caja: 'Tu pedido está en caja. Podés pasar a retirarlo y abonar.',
      'Entregado o Instalado': 'Tu pedido fue entregado o instalado. ¡Gracias por confiar en nosotros!'
    }

    return descripcionesMap[orden.estado] || 'Te mantendremos informado sobre el avance de tu pedido.'
  }, [orden])

  if (loading) {
    return (
      <div className="op-public-page">
        <div className="op-public-bg" aria-hidden />
        <div className="op-public-container">
          <div className="loading-container">
            <div className="loading-spinner" />
            <p>Cargando tu orden…</p>
          </div>
        </div>
      </div>
    )
  }

  if (error || !orden) {
    return (
      <div className="op-public-page">
        <div className="op-public-bg" aria-hidden />
        <div className="op-public-container">
          <div className="error-message">
            <p className="op-public-kicker">Plot Center</p>
            <h2>OP {opNumber}</h2>
            <p>{error || 'No se encontró la orden de trabajo'}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="op-public-page">
      <div className="op-public-bg" aria-hidden />
      <div className="op-public-container">
        <header className="op-public-header">
          <div className="logo-section">
            <img src="/plot-lab-logo.png" alt="Plot Center" className="logo-img" />
          </div>
          <div className="op-info">
            <p className="op-public-kicker">Seguimiento de orden</p>
            <h1 className="op-number">OP {orden.numero_op}</h1>
            <h2 className="cliente-name">{orden.cliente}</h2>
          </div>
        </header>

        <div className="op-public-content">
          <section className="estado-section" style={{ ['--estado-color' as string]: estadoColor }}>
            <p className="estado-eyebrow">Estado actual</p>
            <div className="estado-badge">
              <span className="estado-value">{estadoDisplay}</span>
            </div>
            {estadoDescripcion ? <p className="estado-descripcion">{estadoDescripcion}</p> : null}
            <div className="op-public-actions">
              <button
                type="button"
                className="btn-actualizar-estado"
                onClick={() => loadOrden(true)}
                disabled={refreshing}
              >
                {refreshing ? 'Actualizando…' : 'Actualizar estado'}
              </button>
            </div>
          </section>

          {orden.descripcion ? (
            <div className="descripcion-section">
              <h3>Detalle</h3>
              <p>{orden.descripcion}</p>
            </div>
          ) : null}

          {orden.fecha_entrega ? (
            <div className="info-grid">
              <div className="info-item">
                <span className="info-label">Fecha de entrega</span>
                <span className="info-value">
                  {new Date(orden.fecha_entrega).toLocaleDateString('es-AR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric'
                  })}
                </span>
              </div>
            </div>
          ) : null}

          <div className="footer-link">
            <a
              href="https://plotcenter.com.ar/"
              target="_blank"
              rel="noopener noreferrer"
              className="plotcenter-link"
            >
              plotcenter.com.ar
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

export default OpPublicPage

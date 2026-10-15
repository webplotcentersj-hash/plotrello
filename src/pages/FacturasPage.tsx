import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import apiService from '../services/api'
import type { FacturaVentaRecord } from '../types/api'
import { formatFechaAr } from '../utils/afipFacturaUi'
import { getArgentinaDateString } from '../utils/dateUtils'
import { descargarPdfFacturaAfip } from '../services/afipApi'
import { descargarFacturaAfipPdf } from '../utils/facturaAfipPdf'
import './FacturasPage.css'

const FACTURAS_POR_PAGINA = 15

function diaEmision(factura: FacturaVentaRecord): string {
  return String(factura.fecha_emision || factura.created_at || '').slice(0, 10)
}

export default function FacturasPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [facturas, setFacturas] = useState<FacturaVentaRecord[]>([])
  const [errorCarga, setErrorCarga] = useState<string | null>(null)
  const [pdfId, setPdfId] = useState<number | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [pagina, setPagina] = useState(0)
  const [filtros, setFiltros] = useState({
    estado: searchParams.get('estado') || '',
    fechaDesde: '',
    fechaHasta: '',
    tipoComprobante: ''
  })
  const hoy = getArgentinaDateString()

  const facturasVisibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    const filtradas = !q
      ? facturas
      : facturas.filter((f) => {
          const hay = [
            f.numero_factura,
            f.cliente_nombre,
            f.cliente_dni_cuit,
            f.cae,
            f.numero_cae,
            f.numero_op,
            f.tipo_comprobante,
            f.estado,
            f.estado_afip,
            String(f.total ?? '')
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
          return hay.includes(q)
        })
    return [...filtradas].sort((a, b) => {
      const aHoy = diaEmision(a) === hoy ? 0 : 1
      const bHoy = diaEmision(b) === hoy ? 0 : 1
      if (aHoy !== bHoy) return aHoy - bHoy
      const fa = diaEmision(a)
      const fb = diaEmision(b)
      if (fa !== fb) return fb.localeCompare(fa)
      return String(b.created_at || '').localeCompare(String(a.created_at || ''))
    })
  }, [facturas, busqueda, hoy])

  const totalPaginas = Math.max(1, Math.ceil(facturasVisibles.length / FACTURAS_POR_PAGINA))
  const paginaActual = Math.min(pagina, totalPaginas - 1)
  const facturasPagina = facturasVisibles.slice(
    paginaActual * FACTURAS_POR_PAGINA,
    paginaActual * FACTURAS_POR_PAGINA + FACTURAS_POR_PAGINA
  )
  const desde = facturasVisibles.length === 0 ? 0 : paginaActual * FACTURAS_POR_PAGINA + 1
  const hasta = Math.min(facturasVisibles.length, (paginaActual + 1) * FACTURAS_POR_PAGINA)

  useEffect(() => {
    setPagina(0)
  }, [busqueda, filtros])

  useEffect(() => {
    loadFacturas()
  }, [filtros])

  const loadFacturas = async () => {
    setLoading(true)
    try {
      const response = await apiService.getFacturas({
        estado: filtros.estado ? (filtros.estado as 'Borrador' | 'Emitida' | 'Anulada' | 'Cancelada') : undefined,
        fechaDesde: filtros.fechaDesde || undefined,
        fechaHasta: filtros.fechaHasta || undefined,
        tipo_comprobante: filtros.tipoComprobante || undefined
      })

      if (response.success && response.data) {
        setErrorCarga(null)
        setFacturas(response.data)
      } else {
        setFacturas([])
        setErrorCarga(response.error || 'No se pudieron cargar las facturas.')
      }
    } catch (error) {
      console.error('Error cargando facturas:', error)
      setFacturas([])
      setErrorCarga('No se pudieron cargar las facturas.')
    } finally {
      setLoading(false)
    }
  }

  const handleDescargarPdf = async (id: number) => {
    if (pdfId != null) return
    setPdfId(id)
    try {
      const response = await apiService.getFactura(id)
      if (!response.success || !response.data) {
        alert('No se pudo cargar la factura para el PDF: ' + (response.error || 'desconocido'))
        return
      }
      if (response.data.estado_afip === 'Autorizada' && (response.data.cae || response.data.numero_cae)) {
        await descargarPdfFacturaAfip(id)
      } else {
        await descargarFacturaAfipPdf(response.data)
      }
    } catch (error) {
      console.error('Error generando PDF de factura:', error)
      alert(error instanceof Error ? error.message : 'No se pudo generar el PDF de la factura.')
    } finally {
      setPdfId(null)
    }
  }

  const handleEmitirFactura = async (id: number) => {
    if (
      !confirm(
        '¿Emitir este comprobante? Se autoriza en AFIP y, con el CAE, se genera la cuenta por cobrar y el asiento contable.'
      )
    ) {
      return
    }

    try {
      const response = await apiService.emitirFactura(id)
      if (response.success) {
        alert('Comprobante autorizado en AFIP y emitido.')
        if (response.warning) alert(`Atención:\n\n${response.warning}`)
        loadFacturas()
      } else {
        alert('No se pudo emitir: ' + response.error)
        loadFacturas()
      }
    } catch (error) {
      console.error('Error emitiendo factura:', error)
      alert('Error al emitir factura')
    }
  }

  if (loading) {
    return (
      <div className="facturas-page">
        <div className="loading">Cargando facturas...</div>
      </div>
    )
  }

  return (
    <div className="facturas-page">
      <div className="facturas-header">
        <h1>🧾 Facturas de Venta</h1>
        <div className="header-actions">
          <button className="btn-secondary" onClick={() => navigate('/erp')}>
            ← Volver
          </button>
          <button className="btn-primary" onClick={() => navigate('/erp/facturas/nueva')}>
            + Nueva Factura
          </button>
        </div>
      </div>

      <div className="facturas-filters">
        <input
          type="search"
          className="filter-input filter-input--search"
          placeholder="Buscar por número, cliente, CUIT, CAE u OP…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          autoComplete="off"
        />
        <select
          value={filtros.estado}
          onChange={(e) => setFiltros({ ...filtros, estado: e.target.value })}
          className="filter-select"
        >
          <option value="">Todos los estados</option>
          <option value="Borrador">Borrador</option>
          <option value="Emitida">Emitida</option>
          <option value="Anulada">Anulada</option>
          <option value="Cancelada">Cancelada</option>
        </select>

        <select
          value={filtros.tipoComprobante}
          onChange={(e) => setFiltros({ ...filtros, tipoComprobante: e.target.value })}
          className="filter-select"
        >
          <option value="">Todos los tipos</option>
          <option value="Factura A">Factura A</option>
          <option value="Factura B">Factura B</option>
          <option value="Factura C">Factura C</option>
        </select>

        <input
          type="date"
          value={filtros.fechaDesde}
          onChange={(e) => setFiltros({ ...filtros, fechaDesde: e.target.value })}
          className="filter-input"
          placeholder="Desde"
        />

        <input
          type="date"
          value={filtros.fechaHasta}
          onChange={(e) => setFiltros({ ...filtros, fechaHasta: e.target.value })}
          className="filter-input"
          placeholder="Hasta"
        />
      </div>

      <div className="facturas-table-container">
        <table className="facturas-table">
          <thead>
            <tr>
              <th>Número</th>
              <th>Cliente</th>
              <th>Fecha</th>
              <th>Tipo</th>
              <th>Total</th>
              <th>Estado</th>
              <th>AFIP</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {facturasPagina.length === 0 ? (
              <tr>
                <td colSpan={8} className="empty-state">
                  {errorCarga ||
                    (busqueda.trim()
                      ? 'No hay facturas que coincidan con la búsqueda'
                      : 'No hay facturas que coincidan con los filtros')}
                </td>
              </tr>
            ) : (
              facturasPagina.map(factura => (
                <tr key={factura.id} className={diaEmision(factura) === hoy ? 'is-hoy' : undefined}>
                  <td>{factura.numero_factura}</td>
                  <td>{factura.cliente_nombre}</td>
                  <td>
                    {formatFechaAr(factura.fecha_emision)}
                    {diaEmision(factura) === hoy ? <span className="facturas-hoy-tag">Hoy</span> : null}
                  </td>
                  <td>{factura.tipo_comprobante}</td>
                  <td>${factura.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                  <td>
                    <span className={`estado-badge estado-${factura.estado.toLowerCase()}`}>
                      {factura.estado}
                    </span>
                  </td>
                  <td>
                    {factura.estado_afip && (
                      <span className={`afip-badge afip-${factura.estado_afip.toLowerCase()}`}>
                        {factura.estado_afip}
                      </span>
                    )}
                  </td>
                  <td>
                    <div className="action-buttons">
                      <button
                        className="btn-small btn-view"
                        onClick={() => navigate(`/erp/facturas/${factura.id}`)}
                      >
                        Ver
                      </button>
                      <button
                        className="btn-small btn-pdf"
                        onClick={() => void handleDescargarPdf(factura.id)}
                        disabled={pdfId != null}
                      >
                        {pdfId === factura.id ? 'PDF…' : 'PDF'}
                      </button>
                      {factura.estado === 'Borrador' && (
                        <button
                          className="btn-small btn-emit"
                          onClick={() => handleEmitirFactura(factura.id)}
                        >
                          Emitir
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {facturasVisibles.length > 0 ? (
          <div className="facturas-pager">
            <button
              type="button"
              className="facturas-pager__arrow"
              disabled={paginaActual <= 0}
              onClick={() => setPagina((p) => Math.max(0, p - 1))}
              aria-label="Anterior"
            >
              ←
            </button>
            <span className="facturas-pager__info">
              {desde}–{hasta} de {facturasVisibles.length} · pág. {paginaActual + 1}/{totalPaginas}
            </span>
            <button
              type="button"
              className="facturas-pager__arrow"
              disabled={paginaActual >= totalPaginas - 1}
              onClick={() => setPagina((p) => Math.min(totalPaginas - 1, p + 1))}
              aria-label="Siguiente"
            >
              →
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}


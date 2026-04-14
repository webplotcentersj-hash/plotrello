import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import apiService from '../services/api'
import type {
  Pago,
  MovimientoBancario,
  ConciliacionBancaria,
  ConciliacionPlotAIReporte,
  PedidoCompra
} from '../types/pedidos'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import { fetchConciliacionPlotAIRecommendations } from '../utils/conciliacionPlotAIRecommendations'
import './ConciliacionBancariaPage.css'

type ExtractoRow = {
  fechaISO: string
  concepto: string
  referencia?: string
  monto: number // egreso negativo / ingreso positivo (normalizado)
}

type CuentaRow = {
  fechaISO: string
  concepto: string
  referencia?: string
  monto: number // egreso negativo / ingreso positivo (normalizado)
}

function safeParseDateToISO(value: unknown): string | null {
  if (value == null) return null
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString()
  const s = String(value).trim()
  if (!s) return null
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(`${s}T00:00:00`).toISOString()
  // DD/MM/YYYY or DD-MM-YYYY
  const m = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/.exec(s)
  if (m) {
    const dd = Number(m[1])
    const mm = Number(m[2])
    const yyyy = Number(m[3])
    const d = new Date(Date.UTC(yyyy, mm - 1, dd, 12, 0, 0))
    return Number.isNaN(d.getTime()) ? null : d.toISOString()
  }
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

function pickFirstKey(obj: Record<string, any>, keys: string[]): any {
  const lowerMap = new Map<string, string>()
  for (const k of Object.keys(obj)) lowerMap.set(k.toLowerCase().trim(), k)
  for (const key of keys) {
    const real = lowerMap.get(key.toLowerCase())
    if (real) return obj[real]
  }
  return undefined
}

function toNumber(value: unknown): number | null {
  if (value == null) return null
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const s = String(value).trim()
  if (!s) return null
  // soporta "1.234,56" y "1234.56"
  const normalized = s.replace(/\./g, '').replace(',', '.').replace(/[^0-9.\-]/g, '')
  const n = Number(normalized)
  return Number.isFinite(n) ? n : null
}

function absMoney(n: number): number {
  return Math.round(Math.abs(n) * 100) / 100
}

function moneyEq(a: number, b: number, tol = 0.01): boolean {
  return Math.abs(a - b) <= tol
}

async function parseExtractoFile(file: File): Promise<ExtractoRow[]> {
  const ab = await file.arrayBuffer()
  const wb = XLSX.read(ab, { type: 'array' })
  const sheetName = wb.SheetNames[0]
  const ws = wb.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: '' })

  const out: ExtractoRow[] = []
  for (const r of rows) {
    const fechaRaw =
      pickFirstKey(r, ['fecha', 'fecha_movimiento', 'date', 'día', 'dia', 'fecha operación', 'fecha operacion']) ??
      pickFirstKey(r, ['fecha_valor', 'valor'])
    const fechaISO = safeParseDateToISO(fechaRaw)
    if (!fechaISO) continue

    const concepto =
      String(
        pickFirstKey(r, ['concepto', 'descripcion', 'descripción', 'detalle', 'observacion', 'observación']) ?? ''
      ).trim() || 'Movimiento'

    const referencia = String(pickFirstKey(r, ['referencia', 'ref', 'comprobante', 'nro comprobante', 'numero_comprobante']) ?? '')
      .trim() || undefined

    const montoRaw =
      pickFirstKey(r, ['monto', 'importe', 'importe total', 'importe_total', 'amount', 'valor']) ??
      undefined

    const debe = toNumber(pickFirstKey(r, ['debe', 'débito', 'debito', 'egreso']))
    const haber = toNumber(pickFirstKey(r, ['haber', 'crédito', 'credito', 'ingreso']))
    let monto = toNumber(montoRaw)

    if (monto == null) {
      if (debe != null && haber == null) monto = -Math.abs(debe)
      else if (haber != null && debe == null) monto = Math.abs(haber)
      else if (debe != null && haber != null) monto = Math.abs(haber) - Math.abs(debe)
    }

    if (monto == null || !Number.isFinite(monto) || monto === 0) continue

    out.push({ fechaISO, concepto, referencia, monto })
  }
  return out.sort((a, b) => a.fechaISO.localeCompare(b.fechaISO))
}

async function parseCuentaFile(file: File): Promise<CuentaRow[]> {
  const ab = await file.arrayBuffer()
  const wb = XLSX.read(ab, { type: 'array' })
  const sheetName = wb.SheetNames[0]
  const ws = wb.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: '' })

  const out: CuentaRow[] = []
  for (const r of rows) {
    const fechaRaw =
      pickFirstKey(r, ['fecha', 'fecha_pago', 'date', 'día', 'dia']) ??
      pickFirstKey(r, ['fecha_movimiento', 'fecha_valor'])
    const fechaISO = safeParseDateToISO(fechaRaw)
    if (!fechaISO) continue

    const concepto =
      String(
        pickFirstKey(r, [
          'concepto',
          'descripcion',
          'descripción',
          'detalle',
          'proveedor',
          'observacion',
          'observación',
          'numero_pago',
          'pago'
        ]) ?? ''
      ).trim() || 'Pago'

    const referencia = String(
      pickFirstKey(r, ['referencia', 'ref', 'comprobante', 'nro comprobante', 'numero_comprobante', 'numero_pago']) ?? ''
    ).trim() || undefined

    const montoRaw = pickFirstKey(r, ['monto', 'importe', 'importe total', 'importe_total', 'amount', 'total']) ?? undefined

    const debe = toNumber(pickFirstKey(r, ['debe', 'débito', 'debito', 'egreso']))
    const haber = toNumber(pickFirstKey(r, ['haber', 'crédito', 'credito', 'ingreso']))
    let monto = toNumber(montoRaw)

    if (monto == null) {
      if (debe != null && haber == null) monto = -Math.abs(debe)
      else if (haber != null && debe == null) monto = Math.abs(haber)
      else if (debe != null && haber != null) monto = Math.abs(haber) - Math.abs(debe)
    }

    if (monto == null || !Number.isFinite(monto) || monto === 0) continue

    out.push({ fechaISO, concepto, referencia, monto })
  }
  return out.sort((a, b) => a.fechaISO.localeCompare(b.fechaISO))
}

const ConciliacionBancariaPage = () => {
  const navigate = useNavigate()
  const { canManageCompras, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [pagos, setPagos] = useState<Pago[]>([])
  const [movimientos, setMovimientos] = useState<MovimientoBancario[]>([])
  const [conciliaciones, setConciliaciones] = useState<ConciliacionBancaria[]>([])
  const [plotAiExtractoFile, setPlotAiExtractoFile] = useState<File | null>(null)
  const [plotAiCuentaFile, setPlotAiCuentaFile] = useState<File | null>(null)
  const [plotAiExtracto, setPlotAiExtracto] = useState<ExtractoRow[]>([])
  const [plotAiCuentaRows, setPlotAiCuentaRows] = useState<CuentaRow[]>([])
  const [plotAiParsing, setPlotAiParsing] = useState(false)
  const [plotAiCuentaParsing, setPlotAiCuentaParsing] = useState(false)
  const [plotAiFechaDesde, setPlotAiFechaDesde] = useState('')
  const [plotAiFechaHasta, setPlotAiFechaHasta] = useState('')
  const [plotAiBanco, setPlotAiBanco] = useState('')
  const [plotAiCuenta, setPlotAiCuenta] = useState('')
  const [plotAiReports, setPlotAiReports] = useState<ConciliacionPlotAIReporte[]>([])
  const [plotAiRecoLoading, setPlotAiRecoLoading] = useState(false)
  const [plotAiRecoText, setPlotAiRecoText] = useState<string>('')
  const [plotAiRecoError, setPlotAiRecoError] = useState<string | null>(null)
  const [mostrarModalPago, setMostrarModalPago] = useState(false)
  const [mostrarModalMovimiento, setMostrarModalMovimiento] = useState(false)
  const [mostrarModalConciliacion, setMostrarModalConciliacion] = useState(false)
  const [pedidos, setPedidos] = useState<PedidoCompra[]>([])
  const [filtros, setFiltros] = useState({
    banco: '',
    cuenta_bancaria: '',
    estado_pago: 'todos',
    conciliado: 'todos'
  })
  const [formPago, setFormPago] = useState({
    id_pedido_compra: '',
    id_proveedor: '',
    monto_total: '',
    moneda: 'ARS',
    fecha_vencimiento: '',
    metodo_pago: '',
    banco: '',
    cuenta_bancaria: '',
    observaciones: ''
  })
  const [formMovimiento, setFormMovimiento] = useState({
    fecha_movimiento: '',
    fecha_valor: '',
    tipo: 'Egreso' as 'Ingreso' | 'Egreso',
    concepto: '',
    monto: '',
    moneda: 'ARS',
    banco: '',
    cuenta_bancaria: '',
    numero_comprobante: '',
    referencia: '',
    id_pago_asociado: '',
    observaciones: ''
  })
  const [formConciliacion, setFormConciliacion] = useState({
    fecha_desde: '',
    fecha_hasta: '',
    banco: '',
    cuenta_bancaria: '',
    saldo_inicial: '',
    observaciones: ''
  })

  useEffect(() => {
    if (authLoading) return
    if (!canManageCompras) {
      navigate('/compras/dashboard')
      return
    }
    loadData()
    void loadPlotAiReports()
  }, [canManageCompras, navigate, authLoading])

  const loadPlotAiReports = async () => {
    const resp = await apiService.getConciliacionPlotAIReportes({ limit: 60 })
    if (resp.success && resp.data) setPlotAiReports(resp.data)
  }

  const loadData = async () => {
    setLoading(true)
    try {
      const [pagosResp, movimientosResp, conciliacionesResp, pedidosResp] = await Promise.all([
        apiService.getPagos(filtros.estado_pago !== 'todos' ? { estado: filtros.estado_pago as any } : {}),
        apiService.getMovimientosBancarios({
          banco: filtros.banco || undefined,
          cuenta_bancaria: filtros.cuenta_bancaria || undefined,
          conciliado: filtros.conciliado === 'si' ? true : filtros.conciliado === 'no' ? false : undefined
        }),
        apiService.getConciliaciones({
          banco: filtros.banco || undefined,
          cuenta_bancaria: filtros.cuenta_bancaria || undefined
        }),
        apiService.getPedidosCompra({ estado: 'Aprobado' })
      ])

      if (pagosResp.success && pagosResp.data) setPagos(pagosResp.data)
      if (movimientosResp.success && movimientosResp.data) setMovimientos(movimientosResp.data)
      if (conciliacionesResp.success && conciliacionesResp.data) setConciliaciones(conciliacionesResp.data)
      if (pedidosResp.success && pedidosResp.data) setPedidos(pedidosResp.data)
    } catch (error) {
      console.error('Error cargando datos:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!authLoading && canManageCompras) {
      loadData()
    }
  }, [filtros])

  const handleCrearPago = async () => {
    if (!formPago.monto_total || parseFloat(formPago.monto_total) <= 0) {
      alert('El monto debe ser mayor a 0')
      return
    }

    try {
      const response = await apiService.crearPago({
        id_pedido_compra: formPago.id_pedido_compra ? parseInt(formPago.id_pedido_compra) : undefined,
        id_proveedor: formPago.id_proveedor ? parseInt(formPago.id_proveedor) : undefined,
        monto_total: parseFloat(formPago.monto_total),
        moneda: formPago.moneda,
        fecha_vencimiento: formPago.fecha_vencimiento || undefined,
        metodo_pago: formPago.metodo_pago || undefined,
        banco: formPago.banco || undefined,
        cuenta_bancaria: formPago.cuenta_bancaria || undefined,
        observaciones: formPago.observaciones || undefined
      })

      if (response.success) {
        alert('Pago creado exitosamente')
        setMostrarModalPago(false)
        setFormPago({
          id_pedido_compra: '',
          id_proveedor: '',
          monto_total: '',
          moneda: 'ARS',
          fecha_vencimiento: '',
          metodo_pago: '',
          banco: '',
          cuenta_bancaria: '',
          observaciones: ''
        })
        loadData()
      } else {
        alert(`Error: ${response.error}`)
      }
    } catch (error) {
      console.error('Error creando pago:', error)
      alert('Error al crear el pago')
    }
  }

  const handleCrearMovimiento = async () => {
    if (!formMovimiento.monto || parseFloat(formMovimiento.monto) <= 0) {
      alert('El monto debe ser mayor a 0')
      return
    }

    try {
      const response = await apiService.crearMovimientoBancario({
        fecha_movimiento: formMovimiento.fecha_movimiento,
        fecha_valor: formMovimiento.fecha_valor || undefined,
        tipo: formMovimiento.tipo,
        concepto: formMovimiento.concepto,
        monto: parseFloat(formMovimiento.monto),
        moneda: formMovimiento.moneda,
        banco: formMovimiento.banco,
        cuenta_bancaria: formMovimiento.cuenta_bancaria,
        numero_comprobante: formMovimiento.numero_comprobante || undefined,
        referencia: formMovimiento.referencia || undefined,
        id_pago_asociado: formMovimiento.id_pago_asociado ? parseInt(formMovimiento.id_pago_asociado) : undefined,
        observaciones: formMovimiento.observaciones || undefined
      })

      if (response.success) {
        alert('Movimiento bancario creado exitosamente')
        setMostrarModalMovimiento(false)
        setFormMovimiento({
          fecha_movimiento: '',
          fecha_valor: '',
          tipo: 'Egreso',
          concepto: '',
          monto: '',
          moneda: 'ARS',
          banco: '',
          cuenta_bancaria: '',
          numero_comprobante: '',
          referencia: '',
          id_pago_asociado: '',
          observaciones: ''
        })
        loadData()
      } else {
        alert(`Error: ${response.error}`)
      }
    } catch (error) {
      console.error('Error creando movimiento:', error)
      alert('Error al crear el movimiento')
    }
  }

  const handleConciliarMovimiento = async (idMovimiento: number, idPago: number) => {
    if (!confirm('¿Estás seguro de que deseas conciliar este movimiento con el pago seleccionado?')) {
      return
    }

    try {
      const response = await apiService.conciliarMovimiento(idMovimiento, idPago)
      if (response.success) {
        alert('Movimiento conciliado exitosamente')
        loadData()
      } else {
        alert(`Error: ${response.error}`)
      }
    } catch (error) {
      console.error('Error conciliando movimiento:', error)
      alert('Error al conciliar el movimiento')
    }
  }

  const handleCrearConciliacion = async () => {
    if (!formConciliacion.fecha_desde || !formConciliacion.fecha_hasta || !formConciliacion.banco || !formConciliacion.cuenta_bancaria) {
      alert('Completa todos los campos requeridos')
      return
    }

    try {
      const response = await apiService.crearConciliacion({
        fecha_desde: formConciliacion.fecha_desde,
        fecha_hasta: formConciliacion.fecha_hasta,
        banco: formConciliacion.banco,
        cuenta_bancaria: formConciliacion.cuenta_bancaria,
        saldo_inicial: parseFloat(formConciliacion.saldo_inicial) || 0,
        observaciones: formConciliacion.observaciones || undefined
      })

      if (response.success) {
        alert('Conciliación creada exitosamente')
        setMostrarModalConciliacion(false)
        setFormConciliacion({
          fecha_desde: '',
          fecha_hasta: '',
          banco: '',
          cuenta_bancaria: '',
          saldo_inicial: '',
          observaciones: ''
        })
        loadData()
      } else {
        alert(`Error: ${response.error}`)
      }
    } catch (error) {
      console.error('Error creando conciliación:', error)
      alert('Error al crear la conciliación')
    }
  }

  const getEstadoPagoColor = (estado: string) => {
    const colores: Record<string, string> = {
      'Pendiente': '#f59e0b',
      'Parcial': '#3b82f6',
      'Completado': '#10b981',
      'Vencido': '#ef4444',
      'Cancelado': '#6b7280'
    }
    return colores[estado] || '#6b7280'
  }

  if (authLoading || loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Cargando...</p>
      </div>
    )
  }

  if (!canManageCompras) {
    return (
      <div className="conciliacion-page">
        <div className="error-container">
          <p>No tienes permiso para acceder a esta página.</p>
          <button className="btn-primary" onClick={() => navigate('/compras/dashboard')}>
            Volver al Dashboard
          </button>
        </div>
      </div>
    )
  }

  const pagosPendientes = pagos.filter(p => p.estado === 'Pendiente' || p.estado === 'Parcial')
  const movimientosPendientes = movimientos.filter(m => !m.conciliado)

  const plotAiAnalysis = (() => {
    const listo = plotAiExtracto.length > 0 && plotAiCuentaRows.length > 0
    const desdeISO = safeParseDateToISO(plotAiFechaDesde)
    const hastaISO = safeParseDateToISO(plotAiFechaHasta ? `${plotAiFechaHasta}T23:59:59` : plotAiFechaHasta)
    const hasRange = Boolean(desdeISO && hastaISO)

    const extractoRange = plotAiExtracto.filter((r) => {
      if (!hasRange) return true
      return r.fechaISO >= (desdeISO as string) && r.fechaISO <= (hastaISO as string)
    })
    const cuentaRange = plotAiCuentaRows.filter((r) => {
      if (!hasRange) return true
      return r.fechaISO >= (desdeISO as string) && r.fechaISO <= (hastaISO as string)
    })

    const incongruencias: string[] = []

    // matching simple 1:1 por monto (egresos extracto) vs planilla cuenta (egresos)
    const cuentaDisponibles = new Set<number>(cuentaRange.map((_, idx) => idx))
    const matchExtractoToCuenta = new Map<number, number>() // idxExtracto -> idxCuenta

    for (let i = 0; i < extractoRange.length; i++) {
      const r = extractoRange[i]
      if (r.monto >= 0) continue
      const target = absMoney(r.monto)

      let bestIdx: number | null = null
      for (let j = 0; j < cuentaRange.length; j++) {
        if (!cuentaDisponibles.has(j)) continue
        const c = cuentaRange[j]
        if (c.monto >= 0) continue
        if (!moneyEq(absMoney(c.monto), target)) continue
        // preferir match por referencia si existe
        if (r.referencia && (c.referencia || '').toLowerCase().includes(r.referencia.toLowerCase())) {
          bestIdx = j
          break
        }
        if (bestIdx == null) bestIdx = j
      }
      if (bestIdx != null) {
        matchExtractoToCuenta.set(i, bestIdx)
        cuentaDisponibles.delete(bestIdx)
      }
    }

    for (let i = 0; i < extractoRange.length; i++) {
      const r = extractoRange[i]
      if (r.monto >= 0) continue
      if (!matchExtractoToCuenta.has(i)) {
        incongruencias.push(
          `Extracto sin planilla: ${new Date(r.fechaISO).toLocaleDateString('es-AR')} · $${absMoney(r.monto).toLocaleString('es-AR', { minimumFractionDigits: 2 })} · ${r.concepto}${r.referencia ? ` · ref ${r.referencia}` : ''}`
        )
      }
    }

    for (const j of cuentaDisponibles) {
      const c = cuentaRange[j]
      if (c.monto >= 0) continue
      incongruencias.push(
        `Planilla sin extracto: ${new Date(c.fechaISO).toLocaleDateString('es-AR')} · $${absMoney(c.monto).toLocaleString('es-AR', { minimumFractionDigits: 2 })} · ${c.concepto}${c.referencia ? ` · ref ${c.referencia}` : ''}`
      )
    }

    const totalExtractoEgresos = extractoRange.filter((r) => r.monto < 0).reduce((s, r) => s + absMoney(r.monto), 0)
    const totalExtractoIngresos = extractoRange.filter((r) => r.monto > 0).reduce((s, r) => s + absMoney(r.monto), 0)
    const totalCuenta = cuentaRange.filter((r) => r.monto < 0).reduce((s, r) => s + absMoney(r.monto), 0)

    const saldado = listo && incongruencias.length === 0 && moneyEq(totalExtractoEgresos, totalCuenta, 0.02)

    return {
      listo,
      estado: saldado ? ('saldado' as const) : ('incongruencias' as const),
      resumen: {
        totalExtractoEgresos,
        totalExtractoIngresos,
        totalPagos: totalCuenta,
        movimientosExtracto: extractoRange.length,
        pagosConsiderados: cuentaRange.length
      },
      incongruencias
    }
  })()

  const handleParseExtracto = async (file?: File | null) => {
    const f = file ?? plotAiExtractoFile
    if (!f) return
    setPlotAiParsing(true)
    try {
      const parsed = await parseExtractoFile(f)
      setPlotAiExtracto(parsed)
    } catch (e) {
      console.error('Error parseando extracto:', e)
      alert('No se pudo leer el extracto. Probá con CSV/XLSX y columnas tipo: fecha, concepto, monto/importe.')
      setPlotAiExtracto([])
    } finally {
      setPlotAiParsing(false)
    }
  }

  const handleParseCuenta = async (file?: File | null) => {
    const f = file ?? plotAiCuentaFile
    if (!f) return
    setPlotAiCuentaParsing(true)
    try {
      const parsed = await parseCuentaFile(f)
      setPlotAiCuentaRows(parsed)
    } catch (e) {
      console.error('Error parseando planilla:', e)
      alert('No se pudo leer la planilla. Probá con CSV/XLSX y columnas tipo: fecha, concepto/proveedor, monto/importe.')
      setPlotAiCuentaRows([])
    } finally {
      setPlotAiCuentaParsing(false)
    }
  }

  const handleGuardarReporte = () => {
    if (!plotAiFechaDesde || !plotAiFechaHasta) {
      alert('Elegí fecha desde y hasta para guardar el reporte.')
      return
    }
    void (async () => {
      const resp = await apiService.crearConciliacionPlotAIReporte({
        fecha_desde: plotAiFechaDesde,
        fecha_hasta: plotAiFechaHasta,
        banco: plotAiBanco.trim() || undefined,
        cuenta_bancaria: plotAiCuenta.trim() || undefined,
        estado: plotAiAnalysis.estado,
        resumen: plotAiAnalysis.resumen,
        incongruencias: plotAiAnalysis.incongruencias,
        recomendaciones_md: plotAiRecoText || undefined
      })
      if (!resp.success || !resp.data) {
        alert(`Error guardando reporte: ${resp.error || 'desconocido'}`)
        return
      }
      alert('Reporte guardado en la BD.')
      await loadPlotAiReports()
    })()
  }

  const handleDownloadReporte = (rep: ConciliacionPlotAIReporte) => {
    const doc = new jsPDF()
    const w = doc.internal.pageSize.getWidth()
    const m = 16
    let y = m
    doc.setFontSize(14)
    doc.text('Reporte conciliación (extracto vs pagos)', w / 2, y, { align: 'center' })
    y += 10
    doc.setFontSize(10)
    doc.text(`Rango: ${rep.fecha_desde} a ${rep.fecha_hasta}`, m, y)
    y += 6
    doc.text(`Estado: ${rep.estado === 'saldado' ? 'SALDADO' : 'INCONGRUENCIAS'}`, m, y)
    y += 6
    if (rep.banco) {
      doc.text(`Banco: ${rep.banco}`, m, y)
      y += 6
    }
    if (rep.cuenta_bancaria) {
      doc.text(`Cuenta: ${rep.cuenta_bancaria}`, m, y)
      y += 6
    }
    y += 4
    doc.setFontSize(10)
    doc.text(
      `Total egresos extracto: $${Number(rep.resumen?.totalExtractoEgresos || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`,
      m,
      y
    )
    y += 6
    doc.text(
      `Total pagos considerados: $${Number(rep.resumen?.totalPagos || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`,
      m,
      y
    )
    y += 10

    if (rep.incongruencias.length > 0) {
      doc.setFontSize(12)
      doc.text('Incongruencias', m, y)
      y += 8
      doc.setFontSize(9)
      for (let i = 0; i < rep.incongruencias.length; i++) {
        const line = `${i + 1}. ${rep.incongruencias[i]}`
        const lines = doc.splitTextToSize(line, w - m * 2)
        for (const l of lines) {
          if (y > 280) {
            doc.addPage()
            y = m
          }
          doc.text(l, m, y)
          y += 5
        }
      }
    }

    if (rep.recomendaciones_md?.trim()) {
      if (y > 270) {
        doc.addPage()
        y = m
      }
      doc.setFontSize(12)
      doc.text('Recomendación PlotAI', m, y)
      y += 8
      doc.setFontSize(9)
      const text = rep.recomendaciones_md.trim()
      const lines = doc.splitTextToSize(text, w - m * 2)
      for (const l of lines) {
        if (y > 280) {
          doc.addPage()
          y = m
        }
        doc.text(l, m, y)
        y += 5
      }
    }

    doc.save(`conciliacion-${rep.fecha_desde}-${rep.fecha_hasta}.pdf`)
  }

  const handleGenerarRecomendacion = async () => {
    if (!plotAiFechaDesde || !plotAiFechaHasta) {
      alert('Elegí fecha desde y hasta.')
      return
    }
    setPlotAiRecoLoading(true)
    setPlotAiRecoError(null)
    try {
      const text = await fetchConciliacionPlotAIRecommendations({
        fechaDesde: plotAiFechaDesde,
        fechaHasta: plotAiFechaHasta,
        banco: plotAiBanco.trim() || undefined,
        cuentaBancaria: plotAiCuenta.trim() || undefined,
        estado: plotAiAnalysis.estado,
        resumen: plotAiAnalysis.resumen,
        incongruencias: plotAiAnalysis.incongruencias
      })
      setPlotAiRecoText(text.trim())
    } catch (e) {
      setPlotAiRecoError(e instanceof Error ? e.message : 'No se pudo generar la recomendación.')
    } finally {
      setPlotAiRecoLoading(false)
    }
  }

  return (
    <div className="conciliacion-page">
      <header className="page-header">
        <div className="header-content">
          <div>
            <h1>💰 Conciliación Bancaria</h1>
            <p className="subtitle">Gestiona pagos y movimientos bancarios</p>
          </div>
          <div className="header-actions">
            <button className="btn-action" onClick={() => setMostrarModalPago(true)}>
              ➕ Crear Pago
            </button>
            <button className="btn-action" onClick={() => setMostrarModalMovimiento(true)}>
              💳 Crear Movimiento
            </button>
            <button className="btn-action" onClick={() => setMostrarModalConciliacion(true)}>
              🔄 Nueva Conciliación
            </button>
            <button className="btn-secondary" onClick={() => navigate('/compras/dashboard')}>
              ← Volver
            </button>
          </div>
        </div>
      </header>

      {/* Resumen */}
      <section className="resumen-section">
        <div className="resumen-grid">
          <div className="resumen-card">
            <div className="resumen-label">Pagos Pendientes</div>
            <div className="resumen-value">{pagosPendientes.length}</div>
            <div className="resumen-subvalue">
              ${pagosPendientes.reduce((sum, p) => sum + (p.monto_total - (p.monto_pagado || 0)), 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div className="resumen-card">
            <div className="resumen-label">Movimientos Sin Conciliar</div>
            <div className="resumen-value">{movimientosPendientes.length}</div>
          </div>
          <div className="resumen-card">
            <div className="resumen-label">Total Conciliaciones</div>
            <div className="resumen-value">{conciliaciones.length}</div>
          </div>
        </div>
      </section>

      {/* PlotAI: comparar extracto vs planilla cuenta */}
      <section className="plotai-section">
        <div className="plotai-header">
          <div>
            <h2>✨ PlotAI — Conciliación: extracto vs planilla cuenta</h2>
            <p className="subtitle">
              Subí <strong>dos archivos</strong>: el extracto bancario y la planilla de cuenta bancaria. Al estar ambos listos se compara y se listan incongruencias.
            </p>
          </div>
          <div className="plotai-badges">
            {plotAiAnalysis.listo ? (
              <span className={`plotai-badge ${plotAiAnalysis.estado === 'saldado' ? 'ok' : 'bad'}`}>
                {plotAiAnalysis.estado === 'saldado' ? 'CUENTA SALDADA' : 'INCONGRUENCIAS'}
              </span>
            ) : (
              <span className="plotai-badge">PENDIENTE</span>
            )}
          </div>
        </div>

        <div className="plotai-grid">
          <div className="plotai-card">
            <h3>1) Extracto</h3>
            <input
              type="file"
              accept=".csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null
                setPlotAiExtractoFile(f)
                setPlotAiExtracto([])
                if (f) void handleParseExtracto(f)
              }}
            />
            <div className="plotai-actions">
              <span className="plotai-help">
                {plotAiParsing
                  ? 'Leyendo…'
                  : plotAiExtracto.length > 0
                    ? `${plotAiExtracto.length} movimientos leídos`
                    : 'Columnas típicas: fecha, concepto, monto/importe.'}
              </span>
            </div>
          </div>

          <div className="plotai-card">
            <h3>2) Planilla cuenta bancaria</h3>
            <input
              type="file"
              accept=".csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null
                setPlotAiCuentaFile(f)
                setPlotAiCuentaRows([])
                if (f) void handleParseCuenta(f)
              }}
            />
            <div className="plotai-actions">
              <span className="plotai-help">
                {plotAiCuentaParsing
                  ? 'Leyendo…'
                  : plotAiCuentaRows.length > 0
                    ? `${plotAiCuentaRows.length} filas leídas`
                    : 'Columnas típicas: fecha, concepto/proveedor, monto/importe.'}
              </span>
            </div>
          </div>

          <div className="plotai-card">
            <h3>3) Parámetros</h3>
            <div className="form-row">
              <div className="form-group">
                <label>Fecha desde *</label>
                <input type="date" value={plotAiFechaDesde} onChange={(e) => setPlotAiFechaDesde(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Fecha hasta *</label>
                <input type="date" value={plotAiFechaHasta} onChange={(e) => setPlotAiFechaHasta(e.target.value)} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Banco (opcional)</label>
                <input value={plotAiBanco} onChange={(e) => setPlotAiBanco(e.target.value)} placeholder="Ej: Galicia" />
              </div>
              <div className="form-group">
                <label>Cuenta bancaria (opcional)</label>
                <input value={plotAiCuenta} onChange={(e) => setPlotAiCuenta(e.target.value)} placeholder="Ej: 123-456..." />
              </div>
            </div>
          </div>

          <div className="plotai-card plotai-card--wide">
            <h3>4) Resultado</h3>
            <div className="plotai-result">
              <div className="plotai-totals">
                <div><strong>Egresos extracto:</strong> ${plotAiAnalysis.resumen.totalExtractoEgresos.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div>
                <div><strong>Ingresos extracto:</strong> ${plotAiAnalysis.resumen.totalExtractoIngresos.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div>
                <div><strong>Total planilla cuenta:</strong> ${plotAiAnalysis.resumen.totalPagos.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div>
                <div><strong>Movimientos leídos:</strong> {plotAiAnalysis.resumen.movimientosExtracto}</div>
                <div><strong>Filas planilla:</strong> {plotAiAnalysis.resumen.pagosConsiderados}</div>
              </div>

              {!plotAiAnalysis.listo ? (
                <div className="plotai-issues">
                  <h4>Pendiente</h4>
                  <div>Subí ambos archivos para ejecutar la comparación.</div>
                </div>
              ) : plotAiAnalysis.incongruencias.length > 0 ? (
                <div className="plotai-issues">
                  <h4>Incongruencias</h4>
                  <ol>
                    {plotAiAnalysis.incongruencias.map((x, i) => (
                      <li key={i}>{x}</li>
                    ))}
                  </ol>
                </div>
              ) : (
                <div className="plotai-ok">Cuenta saldada: los montos coinciden en el rango indicado.</div>
              )}
            </div>

            <div className="plotai-actions">
              <button className="btn-secondary" onClick={handleGenerarRecomendacion} disabled={plotAiRecoLoading}>
                {plotAiRecoLoading ? 'Generando…' : 'Recomendación PlotAI'}
              </button>
              <button className="btn-action" onClick={handleGuardarReporte} disabled={!plotAiFechaDesde || !plotAiFechaHasta}>
                Guardar reporte por fecha
              </button>
            </div>

            {plotAiRecoError && (
              <div className="plotai-issues" style={{ marginTop: 10 }}>
                <h4>Error PlotAI</h4>
                <div>{plotAiRecoError}</div>
              </div>
            )}
            {plotAiRecoText && (
              <div className="plotai-ok" style={{ marginTop: 10, whiteSpace: 'pre-wrap' }}>
                {plotAiRecoText}
              </div>
            )}
          </div>
        </div>

        {plotAiReports.length > 0 && (
          <div className="plotai-reports">
            <h3>Reportes guardados</h3>
            <div className="plotai-reports-list">
              {plotAiReports.map((rep) => (
                <div key={rep.id} className={`plotai-report ${rep.estado === 'saldado' ? 'ok' : 'bad'}`}>
                  <div className="plotai-report-main">
                    <div className="plotai-report-title">
                      {rep.fecha_desde} → {rep.fecha_hasta}
                    </div>
                    <div className="plotai-report-sub">
                      {rep.banco ? `${rep.banco}` : 'Banco: (sin filtro)'} · {rep.cuenta_bancaria ? `Cuenta: ${rep.cuenta_bancaria}` : 'Cuenta: (sin filtro)'}
                    </div>
                  </div>
                  <div className="plotai-report-right">
                    <span className={`plotai-badge ${rep.estado === 'saldado' ? 'ok' : 'bad'}`}>
                      {rep.estado === 'saldado' ? 'SALDADO' : 'INCONGRUENCIAS'}
                    </span>
                    <button className="btn-secondary" onClick={() => handleDownloadReporte(rep)}>
                      Descargar PDF
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Filtros */}
      <section className="filtros-section">
        <h2>Filtros</h2>
        <div className="filtros-grid">
          <div className="filtro-group">
            <label>Banco</label>
            <input
              type="text"
              value={filtros.banco}
              onChange={(e) => setFiltros({ ...filtros, banco: e.target.value })}
              placeholder="Filtrar por banco"
            />
          </div>
          <div className="filtro-group">
            <label>Cuenta Bancaria</label>
            <input
              type="text"
              value={filtros.cuenta_bancaria}
              onChange={(e) => setFiltros({ ...filtros, cuenta_bancaria: e.target.value })}
              placeholder="Filtrar por cuenta"
            />
          </div>
          <div className="filtro-group">
            <label>Estado de Pago</label>
            <select
              value={filtros.estado_pago}
              onChange={(e) => setFiltros({ ...filtros, estado_pago: e.target.value })}
            >
              <option value="todos">Todos</option>
              <option value="Pendiente">Pendiente</option>
              <option value="Parcial">Parcial</option>
              <option value="Completado">Completado</option>
              <option value="Vencido">Vencido</option>
            </select>
          </div>
          <div className="filtro-group">
            <label>Conciliado</label>
            <select
              value={filtros.conciliado}
              onChange={(e) => setFiltros({ ...filtros, conciliado: e.target.value })}
            >
              <option value="todos">Todos</option>
              <option value="si">Conciliados</option>
              <option value="no">Sin Conciliar</option>
            </select>
          </div>
        </div>
      </section>

      {/* Pagos Pendientes */}
      <section className="pagos-section">
        <h2>Pagos Pendientes ({pagosPendientes.length})</h2>
        {pagosPendientes.length === 0 ? (
          <div className="empty-state">
            <p>No hay pagos pendientes</p>
          </div>
        ) : (
          <div className="pagos-list">
            {pagosPendientes.map((pago) => (
              <div key={pago.id} className="pago-card">
                <div className="pago-header">
                  <div>
                    <h3>{pago.numero_pago}</h3>
                    {pago.pedido && (
                      <p className="pago-pedido">Pedido: {pago.pedido.numero_pedido}</p>
                    )}
                    {pago.proveedor && (
                      <p className="pago-proveedor">Proveedor: {pago.proveedor.nombre}</p>
                    )}
                  </div>
                  <div
                    className="pago-estado"
                    style={{ backgroundColor: getEstadoPagoColor(pago.estado) }}
                  >
                    {pago.estado}
                  </div>
                </div>
                <div className="pago-info">
                  <div className="info-row">
                    <span className="label">Monto Total:</span>
                    <span>${pago.monto_total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="info-row">
                    <span className="label">Monto Pagado:</span>
                    <span>${(pago.monto_pagado || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="info-row">
                    <span className="label">Pendiente:</span>
                    <span className="pendiente-value">
                      ${(pago.monto_total - (pago.monto_pagado || 0)).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  {pago.fecha_vencimiento && (
                    <div className="info-row">
                      <span className="label">Vence:</span>
                      <span>{new Date(pago.fecha_vencimiento).toLocaleDateString('es-AR')}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Movimientos Bancarios */}
      <section className="movimientos-section">
        <h2>Movimientos Bancarios ({movimientos.length})</h2>
        {movimientos.length === 0 ? (
          <div className="empty-state">
            <p>No hay movimientos bancarios</p>
          </div>
        ) : (
          <div className="movimientos-table">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Tipo</th>
                  <th>Concepto</th>
                  <th>Monto</th>
                  <th>Banco</th>
                  <th>Cuenta</th>
                  <th>Pago Asociado</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {movimientos.map((movimiento) => (
                  <tr key={movimiento.id} className={movimiento.conciliado ? 'conciliado' : ''}>
                    <td>{new Date(movimiento.fecha_movimiento).toLocaleDateString('es-AR')}</td>
                    <td>
                      <span className={`tipo-badge tipo-${movimiento.tipo.toLowerCase()}`}>
                        {movimiento.tipo}
                      </span>
                    </td>
                    <td>{movimiento.concepto}</td>
                    <td className={movimiento.tipo === 'Ingreso' ? 'ingreso' : 'egreso'}>
                      {movimiento.tipo === 'Ingreso' ? '+' : '-'}${movimiento.monto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </td>
                    <td>{movimiento.banco}</td>
                    <td>{movimiento.cuenta_bancaria}</td>
                    <td>
                      {movimiento.pago ? (
                        <span className="pago-link" onClick={() => navigate(`/compras/pagos/${movimiento.pago?.id}`)}>
                          {movimiento.pago.numero_pago}
                        </span>
                      ) : (
                        <span className="sin-pago">Sin asociar</span>
                      )}
                    </td>
                    <td>
                      {movimiento.conciliado ? (
                        <span className="badge-conciliado">✓ Conciliado</span>
                      ) : (
                        <span className="badge-pendiente">Pendiente</span>
                      )}
                    </td>
                    <td>
                      {!movimiento.conciliado && pagosPendientes.length > 0 && (
                        <select
                          className="select-conciliar"
                          onChange={(e) => {
                            if (e.target.value) {
                              handleConciliarMovimiento(movimiento.id, parseInt(e.target.value))
                              e.target.value = ''
                            }
                          }}
                        >
                          <option value="">Conciliar con...</option>
                          {pagosPendientes.map(pago => (
                            <option key={pago.id} value={pago.id}>
                              {pago.numero_pago} - ${(pago.monto_total - (pago.monto_pagado || 0)).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Historial de Conciliaciones */}
      <section className="conciliaciones-section">
        <h2>Historial de Conciliaciones ({conciliaciones.length})</h2>
        {conciliaciones.length === 0 ? (
          <div className="empty-state">
            <p>No hay conciliaciones registradas</p>
          </div>
        ) : (
          <div className="conciliaciones-list">
            {conciliaciones.map((conciliacion) => (
              <div key={conciliacion.id} className="conciliacion-card">
                <div className="conciliacion-header">
                  <div>
                    <h3>Conciliación del {new Date(conciliacion.fecha_conciliacion).toLocaleDateString('es-AR')}</h3>
                    <p className="conciliacion-periodo">
                      {new Date(conciliacion.fecha_desde).toLocaleDateString('es-AR')} - {new Date(conciliacion.fecha_hasta).toLocaleDateString('es-AR')}
                    </p>
                  </div>
                  <div className="conciliacion-banco">
                    {conciliacion.banco} - {conciliacion.cuenta_bancaria}
                  </div>
                </div>
                <div className="conciliacion-info">
                  <div className="info-grid">
                    <div className="info-item">
                      <span className="label">Saldo Inicial:</span>
                      <span>${conciliacion.saldo_inicial.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="info-item">
                      <span className="label">Total Ingresos:</span>
                      <span className="ingreso">+${conciliacion.total_ingresos.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="info-item">
                      <span className="label">Total Egresos:</span>
                      <span className="egreso">-${conciliacion.total_egresos.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="info-item">
                      <span className="label">Saldo Final:</span>
                      <span className="saldo-final">${conciliacion.saldo_final.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="info-item">
                      <span className="label">Movimientos Conciliados:</span>
                      <span>{conciliacion.movimientos_conciliados}</span>
                    </div>
                    <div className="info-item">
                      <span className="label">Movimientos Pendientes:</span>
                      <span>{conciliacion.movimientos_pendientes}</span>
                    </div>
                  </div>
                  {conciliacion.observaciones && (
                    <div className="conciliacion-observaciones">
                      <strong>Observaciones:</strong> {conciliacion.observaciones}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Modal Crear Pago */}
      {mostrarModalPago && (
        <div className="modal-overlay" onClick={() => setMostrarModalPago(false)}>
          <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Crear Nuevo Pago</h2>
              <button className="btn-close" onClick={() => setMostrarModalPago(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <div className="form-group">
                  <label>Pedido de Compra</label>
                  <select
                    value={formPago.id_pedido_compra}
                    onChange={(e) => setFormPago({ ...formPago, id_pedido_compra: e.target.value })}
                  >
                    <option value="">Selecciona un pedido (opcional)</option>
                    {pedidos.map(pedido => (
                      <option key={pedido.id} value={pedido.id}>
                        {pedido.numero_pedido} - {pedido.nombre_solicitante}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Monto Total *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formPago.monto_total}
                    onChange={(e) => setFormPago({ ...formPago, monto_total: e.target.value })}
                    placeholder="0.00"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Moneda</label>
                  <select
                    value={formPago.moneda}
                    onChange={(e) => setFormPago({ ...formPago, moneda: e.target.value })}
                  >
                    <option value="ARS">ARS</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Fecha de Vencimiento</label>
                  <input
                    type="date"
                    value={formPago.fecha_vencimiento}
                    onChange={(e) => setFormPago({ ...formPago, fecha_vencimiento: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Método de Pago</label>
                  <select
                    value={formPago.metodo_pago}
                    onChange={(e) => setFormPago({ ...formPago, metodo_pago: e.target.value })}
                  >
                    <option value="">Selecciona método</option>
                    <option value="Transferencia">Transferencia</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Efectivo">Efectivo</option>
                    <option value="Tarjeta">Tarjeta</option>
                    <option value="Otro">Otro</option>
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Banco</label>
                  <input
                    type="text"
                    value={formPago.banco}
                    onChange={(e) => setFormPago({ ...formPago, banco: e.target.value })}
                    placeholder="Nombre del banco"
                  />
                </div>
                <div className="form-group">
                  <label>Cuenta Bancaria</label>
                  <input
                    type="text"
                    value={formPago.cuenta_bancaria}
                    onChange={(e) => setFormPago({ ...formPago, cuenta_bancaria: e.target.value })}
                    placeholder="Número de cuenta"
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Observaciones</label>
                <textarea
                  value={formPago.observaciones}
                  onChange={(e) => setFormPago({ ...formPago, observaciones: e.target.value })}
                  placeholder="Observaciones adicionales..."
                  rows={3}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setMostrarModalPago(false)}>
                Cancelar
              </button>
              <button className="btn-primary" onClick={handleCrearPago}>
                Crear Pago
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Crear Movimiento */}
      {mostrarModalMovimiento && (
        <div className="modal-overlay" onClick={() => setMostrarModalMovimiento(false)}>
          <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Crear Movimiento Bancario</h2>
              <button className="btn-close" onClick={() => setMostrarModalMovimiento(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <div className="form-group">
                  <label>Fecha Movimiento *</label>
                  <input
                    type="date"
                    value={formMovimiento.fecha_movimiento}
                    onChange={(e) => setFormMovimiento({ ...formMovimiento, fecha_movimiento: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Fecha Valor</label>
                  <input
                    type="date"
                    value={formMovimiento.fecha_valor}
                    onChange={(e) => setFormMovimiento({ ...formMovimiento, fecha_valor: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Tipo *</label>
                  <select
                    value={formMovimiento.tipo}
                    onChange={(e) => setFormMovimiento({ ...formMovimiento, tipo: e.target.value as 'Ingreso' | 'Egreso' })}
                    required
                  >
                    <option value="Ingreso">Ingreso</option>
                    <option value="Egreso">Egreso</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>Concepto *</label>
                <input
                  type="text"
                  value={formMovimiento.concepto}
                  onChange={(e) => setFormMovimiento({ ...formMovimiento, concepto: e.target.value })}
                  placeholder="Descripción del movimiento"
                  required
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Monto *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formMovimiento.monto}
                    onChange={(e) => setFormMovimiento({ ...formMovimiento, monto: e.target.value })}
                    placeholder="0.00"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Moneda</label>
                  <select
                    value={formMovimiento.moneda}
                    onChange={(e) => setFormMovimiento({ ...formMovimiento, moneda: e.target.value })}
                  >
                    <option value="ARS">ARS</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Banco *</label>
                  <input
                    type="text"
                    value={formMovimiento.banco}
                    onChange={(e) => setFormMovimiento({ ...formMovimiento, banco: e.target.value })}
                    placeholder="Nombre del banco"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Cuenta Bancaria *</label>
                  <input
                    type="text"
                    value={formMovimiento.cuenta_bancaria}
                    onChange={(e) => setFormMovimiento({ ...formMovimiento, cuenta_bancaria: e.target.value })}
                    placeholder="Número de cuenta"
                    required
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Número de Comprobante</label>
                  <input
                    type="text"
                    value={formMovimiento.numero_comprobante}
                    onChange={(e) => setFormMovimiento({ ...formMovimiento, numero_comprobante: e.target.value })}
                    placeholder="Número de comprobante"
                  />
                </div>
                <div className="form-group">
                  <label>Referencia</label>
                  <input
                    type="text"
                    value={formMovimiento.referencia}
                    onChange={(e) => setFormMovimiento({ ...formMovimiento, referencia: e.target.value })}
                    placeholder="Referencia adicional"
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Pago Asociado</label>
                <select
                  value={formMovimiento.id_pago_asociado}
                  onChange={(e) => setFormMovimiento({ ...formMovimiento, id_pago_asociado: e.target.value })}
                >
                  <option value="">Sin asociar</option>
                  {pagosPendientes.map(pago => (
                    <option key={pago.id} value={pago.id}>
                      {pago.numero_pago} - ${pago.monto_total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Observaciones</label>
                <textarea
                  value={formMovimiento.observaciones}
                  onChange={(e) => setFormMovimiento({ ...formMovimiento, observaciones: e.target.value })}
                  placeholder="Observaciones adicionales..."
                  rows={3}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setMostrarModalMovimiento(false)}>
                Cancelar
              </button>
              <button className="btn-primary" onClick={handleCrearMovimiento}>
                Crear Movimiento
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Crear Conciliación */}
      {mostrarModalConciliacion && (
        <div className="modal-overlay" onClick={() => setMostrarModalConciliacion(false)}>
          <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Nueva Conciliación Bancaria</h2>
              <button className="btn-close" onClick={() => setMostrarModalConciliacion(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <div className="form-group">
                  <label>Fecha Desde *</label>
                  <input
                    type="date"
                    value={formConciliacion.fecha_desde}
                    onChange={(e) => setFormConciliacion({ ...formConciliacion, fecha_desde: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Fecha Hasta *</label>
                  <input
                    type="date"
                    value={formConciliacion.fecha_hasta}
                    onChange={(e) => setFormConciliacion({ ...formConciliacion, fecha_hasta: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Banco *</label>
                  <input
                    type="text"
                    value={formConciliacion.banco}
                    onChange={(e) => setFormConciliacion({ ...formConciliacion, banco: e.target.value })}
                    placeholder="Nombre del banco"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Cuenta Bancaria *</label>
                  <input
                    type="text"
                    value={formConciliacion.cuenta_bancaria}
                    onChange={(e) => setFormConciliacion({ ...formConciliacion, cuenta_bancaria: e.target.value })}
                    placeholder="Número de cuenta"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Saldo Inicial</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formConciliacion.saldo_inicial}
                    onChange={(e) => setFormConciliacion({ ...formConciliacion, saldo_inicial: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Observaciones</label>
                <textarea
                  value={formConciliacion.observaciones}
                  onChange={(e) => setFormConciliacion({ ...formConciliacion, observaciones: e.target.value })}
                  placeholder="Observaciones sobre la conciliación..."
                  rows={3}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setMostrarModalConciliacion(false)}>
                Cancelar
              </button>
              <button className="btn-primary" onClick={handleCrearConciliacion}>
                Crear Conciliación
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ConciliacionBancariaPage


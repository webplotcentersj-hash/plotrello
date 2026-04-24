import { useMemo, useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Task, TeamMember, ActivityEvent } from '../../types/board'
import PlotAIChat from '../../components/PlotAIChat'
import { useAuth } from '../../hooks/useAuth'
import apiService from '../../services/api'
import { ordenToTask } from '../../utils/dataMappers'
import { exportTableroFichasActivasPdf } from '../../utils/exportTableroFichasActivasPdf'
import type { FacturaVentaRecord, HistorialMovimiento, PedidoClienteRecord } from '../../types/api'
import type { StockMovimiento } from '../../types/pedidos'
import { BOARD_COLUMNS } from '../../data/mockData'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import './AdminDashboard.css'

interface AdminDashboardProps {
  tasks: Task[]
  activity: ActivityEvent[]
  teamMembers: TeamMember[]
  actividadReclamos: HistorialMovimiento[]
  pedidosPendientes: PedidoClienteRecord[]
  impresorasOcupacion: any[]
  movimientosStock: StockMovimiento[]
  facturasVenta: FacturaVentaRecord[]
  lastUpdatedAt: string | null
  loading: boolean
  onRefresh: () => void
}

export default function AdminDashboard({
  tasks,
  activity,
  teamMembers,
  actividadReclamos,
  pedidosPendientes,
  impresorasOcupacion,
  movimientosStock,
  facturasVenta,
  lastUpdatedAt,
  loading,
  onRefresh
}: AdminDashboardProps) {
  const { usuario } = useAuth()
  const navigate = useNavigate()
  const [isPlotAIOpen, setIsPlotAIOpen] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [isInstallable, setIsInstallable] = useState(false)
  const [backupLoading, setBackupLoading] = useState(false)
  const [pdfFichasLoading, setPdfFichasLoading] = useState(false)
  const [nowTick, setNowTick] = useState(Date.now())
  const [ttsLoading, setTtsLoading] = useState(false)
  const [ttsError, setTtsError] = useState<string | null>(null)
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null)
  const ttsObjectUrlRef = useRef<string | null>(null)

  // Manejar instalación PWA
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setIsInstallable(true)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    // Verificar si ya está instalada
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstallable(false)
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    }
  }, [])

  useEffect(() => {
    const t = window.setInterval(() => setNowTick(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [])

  const revokeTtsObjectUrl = useCallback(() => {
    if (ttsObjectUrlRef.current) {
      URL.revokeObjectURL(ttsObjectUrlRef.current)
      ttsObjectUrlRef.current = null
    }
  }, [])

  const stopTts = useCallback(() => {
    if (ttsAudioRef.current) {
      ttsAudioRef.current.pause()
      try {
        ttsAudioRef.current.currentTime = 0
      } catch {
        /* noop */
      }
      ttsAudioRef.current = null
    }
    revokeTtsObjectUrl()
    if ('speechSynthesis' in window) window.speechSynthesis.cancel()
  }, [revokeTtsObjectUrl])

  useEffect(() => {
    return () => {
      stopTts()
    }
  }, [stopTts])

  const handleDescargarBackup = async () => {
    setBackupLoading(true)
    try {
      const [ordRes, histRes, usrRes] = await Promise.all([
        apiService.getOrdenes(),
        apiService.getHistorialMovimientos({ limit: 50000 }),
        apiService.getUsuarios()
      ])

      const payload = {
        meta: {
          exportadoEn: new Date().toISOString(),
          aplicacion: 'Plot Lab Admin',
          versionExport: 1,
          aviso:
            'Snapshot JSON (órdenes, historial de movimientos, usuarios) obtenido por la API del cliente. No sustituye un backup completo de la base PostgreSQL ni archivos en Storage.'
        },
        ordenes_trabajo: ordRes.success ? ordRes.data ?? [] : [],
        historial_movimientos: histRes.success ? histRes.data ?? [] : [],
        usuarios: usrRes.success ? usrRes.data ?? [] : [],
        erroresCarga: {
          ordenes: ordRes.success ? null : ordRes.error ?? 'desconocido',
          historial: histRes.success ? null : histRes.error ?? 'desconocido',
          usuarios: usrRes.success ? null : usrRes.error ?? 'desconocido'
        }
      }

      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: 'application/json;charset=utf-8'
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const stamp = new Date().toISOString().replace(/:/g, '-').slice(0, 19)
      a.href = url
      a.download = `plotlab-backup-${stamp}.json`
      a.click()
      URL.revokeObjectURL(url)

      const errs = payload.erroresCarga
      if (errs.ordenes || errs.historial || errs.usuarios) {
        window.alert(
          'Backup generado con advertencias: revisá el campo erroresCarga dentro del JSON si alguna sección quedó vacía.'
        )
      }
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'No se pudo generar el backup.')
    } finally {
      setBackupLoading(false)
    }
  }

  const handleDescargarFichasPdf = async () => {
    setPdfFichasLoading(true)
    try {
      const ordRes = await apiService.getOrdenes()
      if (!ordRes.success || !ordRes.data) {
        window.alert(ordRes.error ?? 'No se pudieron cargar las órdenes.')
        return
      }
      exportTableroFichasActivasPdf(ordRes.data.map((o) => ordenToTask(o)))
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'No se pudo generar el PDF.')
    } finally {
      setPdfFichasLoading(false)
    }
  }

  const handleInstallPWA = async () => {
    if (!deferredPrompt) return

    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    
    if (outcome === 'accepted') {
      console.log('[PWA Admin] Usuario aceptó la instalación')
    } else {
      console.log('[PWA Admin] Usuario rechazó la instalación')
    }
    
    setDeferredPrompt(null)
    setIsInstallable(false)
  }

  // Calcular métricas rápidas
  const totalOps = tasks.length
  const opsEnProceso = tasks.filter(t => 
    t.status !== 'finalizado-taller' && t.status !== 'almacen-entrega'
  ).length
  const opsUrgentes = tasks.filter(t => t.priority === 'alta').length
  const opsAtrasadas = tasks.filter(t => {
    const dueDate = new Date(t.dueDate)
    const now = new Date()
    return dueDate < now && t.status !== 'finalizado-taller' && t.status !== 'almacen-entrega'
  }).length

  const fichasActivasTablero = tasks.filter((t) => !t.esSubTarea && !t.ordenEliminada && t.visibleEnTablero !== false && !t.entregado)

  const tasksByStatus = BOARD_COLUMNS.map((c) => ({
    estado: c.label,
    value: fichasActivasTablero.filter((t) => t.status === c.id).length
  })).filter((x) => x.value > 0)

  const priorityData = [
    { name: 'Alta', value: fichasActivasTablero.filter((t) => t.priority === 'alta').length, color: '#ef4444' },
    { name: 'Media', value: fichasActivasTablero.filter((t) => t.priority === 'media').length, color: '#f59e0b' },
    { name: 'Baja', value: fichasActivasTablero.filter((t) => t.priority === 'baja').length, color: '#3b82f6' }
  ].filter((x) => x.value > 0)

  const lastUpdatedLabel = (() => {
    if (!lastUpdatedAt) return '—'
    const d = new Date(lastUpdatedAt)
    if (Number.isNaN(d.getTime())) return '—'
    return d.toLocaleString('es-AR')
  })()

  const secondsSinceUpdate = (() => {
    if (!lastUpdatedAt) return null
    const d = new Date(lastUpdatedAt).getTime()
    if (!Number.isFinite(d)) return null
    return Math.max(0, Math.floor((nowTick - d) / 1000))
  })()

  const actividadGlobal = useMemo(() => {
    const items: Array<{
      ts: number
      label: string
      kind: 'kanban' | 'reclamo' | 'pedido' | 'impresora' | 'stock' | 'factura'
    }> = []

    for (const ev of activity) {
      const ts = new Date(ev.timestamp).getTime()
      if (!Number.isFinite(ts)) continue
      const label = `${ev.taskId} · ${ev.from} → ${ev.to}${ev.note ? ` · ${ev.note}` : ''}`
      items.push({ ts, label, kind: 'kanban' })
    }

    for (const r of actividadReclamos) {
      const ts = new Date(r.timestamp).getTime()
      if (!Number.isFinite(ts)) continue
      const op = (r.id_orden || '').toString()
      const who = r.nombre_usuario ? ` · ${r.nombre_usuario}` : ''
      const label = `${op ? `OP ${op} · ` : ''}${r.accion_tipo || 'reclamo'}${who}${r.comentario ? ` · ${r.comentario}` : ''}`
      items.push({ ts, label, kind: 'reclamo' })
    }

    for (const p of pedidosPendientes) {
      const ts = new Date((p as any).fecha_pedido ?? (p as any).created_at ?? '').getTime()
      if (!Number.isFinite(ts)) continue
      const nro = (p as any).numero_pedido ?? (p as any).id ?? 'Pedido'
      const est = (p as any).estado ?? 'pendiente'
      const label = `${nro} · ${est}`
      items.push({ ts, label, kind: 'pedido' })
    }

    for (const imp of impresorasOcupacion || []) {
      const rawTs = (imp?.updated_at || imp?.fecha_inicio || imp?.fecha || imp?.created_at) as string | undefined
      const ts = rawTs ? new Date(rawTs).getTime() : NaN
      if (!Number.isFinite(ts)) continue
      const label = `Impresora · ${imp?.nombre ?? '—'} · ${imp?.estado ?? imp?.modo ?? 'actividad'}`
      items.push({ ts, label, kind: 'impresora' })
    }

    for (const m of movimientosStock || []) {
      const ts = new Date((m as any).created_at ?? '').getTime()
      if (!Number.isFinite(ts)) continue
      const who = (m as any).nombre_usuario ? ` · ${(m as any).nombre_usuario}` : ''
      const op = (m as any).id_orden_trabajo ? ` · OP ${(m as any).id_orden_trabajo}` : ''
      const label = `Stock · ${(m as any).tipo_movimiento ?? 'mov'} · ${(m as any).descripcion ?? '—'} · ${(m as any).cantidad ?? ''}${who}${op}`
      items.push({ ts, label, kind: 'stock' })
    }

    for (const f of facturasVenta || []) {
      const ts = new Date((f as any).fecha_emision ?? '').getTime()
      if (!Number.isFinite(ts)) continue
      const nro = (f as any).numero_comprobante != null ? String((f as any).numero_comprobante) : '—'
      const tipo = (f as any).tipo_comprobante ?? 'Factura'
      const estado = (f as any).estado ?? '—'
      const cliente = (f as any)?.cliente?.nombre ?? (f as any)?.cliente_nombre ?? ''
      const label = `Factura · ${tipo} ${nro} · ${estado}${cliente ? ` · ${cliente}` : ''}`
      items.push({ ts, label, kind: 'factura' })
    }

    items.sort((a, b) => b.ts - a.ts)
    return items.slice(0, 120)
  }, [activity, actividadReclamos, pedidosPendientes, impresorasOcupacion, movimientosStock, facturasVenta])

  const resumenEjecutivoTexto = useMemo(() => {
    const last = lastUpdatedAt ? new Date(lastUpdatedAt) : null
    const lastOk = last && !Number.isNaN(last.getTime()) ? last : null
    const since24h = Date.now() - 24 * 60 * 60 * 1000

    const in24h = (iso?: string | null) => {
      if (!iso) return false
      const ts = new Date(iso).getTime()
      return Number.isFinite(ts) && ts >= since24h
    }

    const kanban24 = activity.filter((a) => in24h(a.timestamp)).length
    const reclamos24 = actividadReclamos.filter((r) => in24h(r.timestamp)).length
    const stock24 = movimientosStock.filter((m) => in24h((m as any).created_at ?? null)).length
    const fact24 = facturasVenta.filter((f) => in24h((f as any).fecha_emision ?? null)).length

    const urg = fichasActivasTablero.filter((t) => t.priority === 'alta').length
    const atr = opsAtrasadas
    const act = fichasActivasTablero.length

    const topEstados = BOARD_COLUMNS
      .map((c) => ({ label: c.label, n: fichasActivasTablero.filter((t) => t.status === c.id).length }))
      .filter((x) => x.n > 0)
      .sort((a, b) => b.n - a.n)
      .slice(0, 4)

    const estadosStr = topEstados.length
      ? `Estados principales: ${topEstados.map((e) => `${e.label} ${e.n}`).join(', ')}.`
      : 'Sin fichas activas en el tablero.'

    const upd = lastOk ? `Última actualización: ${lastOk.toLocaleString('es-AR')}.` : 'Sin timestamp de actualización.'

    return (
      `Resumen ejecutivo de Plot Lab. ` +
      `${upd} ` +
      `Fichas activas: ${act}. Urgentes: ${urg}. Atrasadas: ${atr}. ` +
      `En las últimas 24 horas: ${kanban24} movimientos de Kanban, ${reclamos24} eventos de reclamos, ${stock24} movimientos de stock, ${fact24} facturas emitidas. ` +
      `Pedidos pendientes: ${pedidosPendientes.length}. ` +
      `${estadosStr}`
    )
  }, [
    lastUpdatedAt,
    activity,
    actividadReclamos,
    movimientosStock,
    facturasVenta,
    fichasActivasTablero,
    opsAtrasadas,
    pedidosPendientes.length
  ])

  const stripEmojisForTTS = (text: string): string =>
    text
      .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F600}-\u{1F64F}\u{1F1E0}-\u{1F1FF}]/gu, '')
      .replace(/\s+/g, ' ')
      .trim()

  const formatVoiceText = (text: string): string => {
    let s = stripEmojisForTTS(text)
    s = s.replace(/\*/g, '')
    s = s.replace(/,/g, ' ')
    s = s.replace(/\.(?=\s|$)/g, ' ')
    return s.replace(/\s+/g, ' ').trim()
  }

  const handleSpeakResumen = useCallback(async () => {
    const clean = formatVoiceText(resumenEjecutivoTexto)
    if (!clean) return
    setTtsError(null)
    setTtsLoading(true)
    stopTts()
    try {
      // Gemini para redactar una versión más “hablable” del resumen.
      const prompt = [
        'Generá un resumen hablado, muy claro y ejecutivo, en español rioplatense.',
        'Debe durar 20 a 35 segundos.',
        'Sin bullets, sin markdown, sin números de lista.',
        'Mantené todos los números EXACTOS como aparecen (no inventes).',
        'Texto base:',
        clean
      ].join('\n')

      const res = await fetch('/api/plotai/chat-public', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: prompt, modo: 'admin' })
      })
      const j = (await res.json().catch(() => null)) as { reply?: string; error?: string } | null
      const spoken = String(j?.reply || clean).trim() || clean

      if (!('speechSynthesis' in window)) {
        setTtsError('Este navegador no soporta síntesis de voz.')
        return
      }
      window.speechSynthesis.cancel()
      const u = new SpeechSynthesisUtterance(spoken)
      u.lang = 'es-AR'
      u.rate = 0.92
      u.onend = () => setTtsLoading(false)
      u.onerror = () => setTtsLoading(false)
      window.speechSynthesis.speak(u)
    } catch (e) {
      setTtsError(e instanceof Error ? e.message : 'No se pudo generar el audio.')
    } finally {
      // En speechSynthesis cerramos loading en onend/onerror
      // Si falló antes de hablar, cerramos acá.
      setTimeout(() => setTtsLoading(false), 400)
    }
  }, [resumenEjecutivoTexto, stopTts])

  return (
    <div className="admin-dashboard">
      {/* Header Mobile-First */}
      <header className="admin-header">
        <div className="admin-header-content">
          <div className="admin-header-left">
            <h1 className="admin-title">Plot Lab · Resumen Ejecutivo</h1>
            <p className="admin-subtitle">
              {loading ? 'Actualizando…' : 'Actualización manual'}
              {secondsSinceUpdate != null ? ` · hace ${secondsSinceUpdate}s` : ''} · {lastUpdatedLabel}
            </p>
          </div>
          <div className="admin-header-right">
            {isInstallable && (
              <button
                className="admin-btn admin-btn-install"
                onClick={handleInstallPWA}
                title="Instalar aplicación"
              >
                <span className="admin-btn-icon">📱</span>
                <span className="admin-btn-text">Instalar</span>
              </button>
            )}
            <button
              className="admin-btn admin-btn-primary"
              onClick={() => setIsPlotAIOpen(true)}
            >
              <span className="admin-btn-icon">🤖</span>
              <span className="admin-btn-text">PlotAI</span>
            </button>
            <button
              type="button"
              className="admin-btn admin-btn-backup"
              onClick={() => void handleDescargarBackup()}
              disabled={backupLoading || pdfFichasLoading}
              title="Descargar JSON con órdenes, historial y usuarios"
            >
              <span className="admin-btn-icon">💾</span>
              <span className="admin-btn-text">{backupLoading ? 'Generando…' : 'Backup'}</span>
            </button>
            <button
              type="button"
              className="admin-btn admin-btn-fichas-pdf"
              onClick={() => void handleDescargarFichasPdf()}
              disabled={pdfFichasLoading || backupLoading}
              title="PDF de todas las fichas activas del tablero principal (Kanban)"
            >
              <span className="admin-btn-icon">📄</span>
              <span className="admin-btn-text">{pdfFichasLoading ? 'PDF…' : 'Fichas PDF'}</span>
            </button>
            <button
              className="admin-btn admin-btn-secondary"
              onClick={() => navigate('/reportes')}
            >
              <span className="admin-btn-icon">📊</span>
              <span className="admin-btn-text">Reportes</span>
            </button>
            <button
              type="button"
              className="admin-btn admin-btn-voice"
              onClick={() => void handleSpeakResumen()}
              disabled={ttsLoading}
              title="Escuchar resumen hablado (Gemini + voz del dispositivo)"
            >
              <span className="admin-btn-icon">🔊</span>
              <span className="admin-btn-text">{ttsLoading ? 'Audio…' : 'Audio resumen'}</span>
            </button>
            <button
              type="button"
              className="admin-btn admin-btn-secondary"
              onClick={stopTts}
              title="Detener audio"
            >
              <span className="admin-btn-icon">⏹️</span>
              <span className="admin-btn-text">Stop</span>
            </button>
          </div>
        </div>
        {usuario && (
          <div className="admin-user-info">
            <span>👤 {usuario.nombre}</span>
            <span className="admin-user-role">{usuario.rol}</span>
          </div>
        )}
      </header>

      {ttsError && (
        <section className="admin-banner">
          <div className="admin-banner-inner">
            <div className="admin-banner-title">Audio</div>
            <div className="admin-banner-text">{ttsError}</div>
          </div>
        </section>
      )}

      <section className="admin-hero">
        <div className="admin-hero-card">
          <div className="admin-hero-title">Resumen del momento</div>
          <div className="admin-hero-text">{resumenEjecutivoTexto}</div>
          <div className="admin-hero-actions">
            <button className="admin-hero-btn" onClick={onRefresh} disabled={loading}>
              {loading ? 'Actualizando…' : 'Actualizar ahora'}
            </button>
            <button
              className="admin-hero-btn admin-hero-btn-ghost"
              onClick={() => void handleSpeakResumen()}
              disabled={ttsLoading}
            >
              {ttsLoading ? 'Generando audio…' : 'Escuchar'}
            </button>
          </div>
        </div>
      </section>
      {/* Métricas Rápidas */}
      <section className="admin-metrics">
        <div className="admin-metric-card">
          <div className="admin-metric-icon">📋</div>
          <div className="admin-metric-content">
            <div className="admin-metric-value">{totalOps}</div>
            <div className="admin-metric-label">Total OPs</div>
          </div>
        </div>
        <div className="admin-metric-card">
          <div className="admin-metric-icon">⚙️</div>
          <div className="admin-metric-content">
            <div className="admin-metric-value">{opsEnProceso}</div>
            <div className="admin-metric-label">En Proceso</div>
          </div>
        </div>
        <div className="admin-metric-card admin-metric-card-urgent">
          <div className="admin-metric-icon">🔴</div>
          <div className="admin-metric-content">
            <div className="admin-metric-value">{opsUrgentes}</div>
            <div className="admin-metric-label">Urgentes</div>
          </div>
        </div>
        <div className="admin-metric-card admin-metric-card-warning">
          <div className="admin-metric-icon">⚠️</div>
          <div className="admin-metric-content">
            <div className="admin-metric-value">{opsAtrasadas}</div>
            <div className="admin-metric-label">Atrasadas</div>
          </div>
        </div>
      </section>

      {/* Resumen + gráficos */}
      <section className="admin-analytics">
        <h2 className="admin-section-title">Resumen & estadísticas</h2>
        <div className="admin-analytics-grid">
          <div className="admin-analytics-card">
            <div className="admin-analytics-card-header">
              <div className="admin-analytics-title">Fichas activas por estado</div>
              <div className="admin-analytics-subtitle">Tablero principal (visibles, no entregadas, no eliminadas)</div>
            </div>
            <div className="admin-chart">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={tasksByStatus} margin={{ top: 6, right: 10, left: 0, bottom: 6 }}>
                  <XAxis dataKey="estado" tick={{ fill: '#cbd5e1', fontSize: 10 }} interval={0} angle={-25} textAnchor="end" height={60} />
                  <YAxis tick={{ fill: '#cbd5e1', fontSize: 10 }} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#eb671b" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="admin-analytics-card">
            <div className="admin-analytics-card-header">
              <div className="admin-analytics-title">Prioridad (fichas activas)</div>
              <div className="admin-analytics-subtitle">Distribución real según el tablero</div>
            </div>
            <div className="admin-chart">
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={priorityData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={3}>
                    {priorityData.map((entry, idx) => (
                      <Cell key={`${entry.name}-${idx}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="admin-legend">
              {priorityData.map((p) => (
                <div key={p.name} className="admin-legend-item">
                  <span className="admin-legend-dot" style={{ background: p.color }} />
                  <span className="admin-legend-label">{p.name}</span>
                  <span className="admin-legend-value">{p.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* PlotAI Chat (Fullscreen en mobile, modal en desktop) */}
      {isPlotAIOpen && (
        <div className="admin-plotai-container">
          <PlotAIChat
            tasks={tasks}
            activity={activity}
            teamMembers={teamMembers}
            onClose={() => setIsPlotAIOpen(false)}
          />
        </div>
      )}

      {/* Accesos Rápidos */}
      <section className="admin-quick-actions">
        <h2 className="admin-section-title">Accesos Rápidos</h2>
        <div className="admin-quick-actions-grid">
          <button className="admin-quick-action-card" onClick={() => window.open('/statistics', '_blank')}>
            <div className="admin-quick-action-icon">📈</div>
            <div className="admin-quick-action-label">Estadísticas</div>
          </button>
          <button
            className="admin-quick-action-card"
            onClick={() => navigate('/reportes')}
          >
            <div className="admin-quick-action-icon">📊</div>
            <div className="admin-quick-action-label">Reportes</div>
          </button>
          <button className="admin-quick-action-card" onClick={() => window.open('/menu-diario', '_blank')}>
            <div className="admin-quick-action-icon">🍽️</div>
            <div className="admin-quick-action-label">Menú diario</div>
          </button>
          <button
            className="admin-quick-action-card"
            onClick={() => setIsPlotAIOpen(true)}
          >
            <div className="admin-quick-action-icon">🤖</div>
            <div className="admin-quick-action-label">PlotAI</div>
          </button>
          <button className="admin-quick-action-card" onClick={() => window.open('/crm-ventas', '_blank')}>
            <div className="admin-quick-action-icon">🧾</div>
            <div className="admin-quick-action-label">CRM ventas</div>
          </button>
          <button className="admin-quick-action-card" onClick={() => window.open('/caja/dashboard', '_blank')}>
            <div className="admin-quick-action-icon">💳</div>
            <div className="admin-quick-action-label">Caja</div>
          </button>
          <button className="admin-quick-action-card" onClick={() => window.open('/erp', '_blank')}>
            <div className="admin-quick-action-icon">🏭</div>
            <div className="admin-quick-action-label">ERP</div>
          </button>
          <button className="admin-quick-action-card" onClick={() => window.open('/rrhh/dashboard', '_blank')}>
            <div className="admin-quick-action-icon">🧑‍💼</div>
            <div className="admin-quick-action-label">RRHH</div>
          </button>
          <button className="admin-quick-action-card" onClick={() => window.open('/flota', '_blank')}>
            <div className="admin-quick-action-icon">🚚</div>
            <div className="admin-quick-action-label">Flota</div>
          </button>
          <button
            className="admin-quick-action-card"
            onClick={() => window.open('/metalurgica/inventario', '_blank')}
          >
            <div className="admin-quick-action-icon">🔧</div>
            <div className="admin-quick-action-label">Inventario metalúrgica</div>
          </button>
          <button
            className="admin-quick-action-card"
            onClick={onRefresh}
          >
            <div className="admin-quick-action-icon">🔄</div>
            <div className="admin-quick-action-label">Actualizar</div>
          </button>
          <button
            type="button"
            className="admin-quick-action-card"
            disabled={backupLoading || pdfFichasLoading}
            onClick={() => void handleDescargarBackup()}
          >
            <div className="admin-quick-action-icon">💾</div>
            <div className="admin-quick-action-label">
              {backupLoading ? 'Generando backup…' : 'Descargar backup'}
            </div>
          </button>
          <button
            type="button"
            className="admin-quick-action-card admin-quick-action-card-pdf"
            disabled={pdfFichasLoading || backupLoading}
            onClick={() => void handleDescargarFichasPdf()}
          >
            <div className="admin-quick-action-icon">📑</div>
            <div className="admin-quick-action-label">
              {pdfFichasLoading ? 'Generando PDF…' : 'Fichas activas (PDF)'}
            </div>
          </button>
        </div>
      </section>

      {/* Actividad Global */}
      <section className="admin-activity">
        <h2 className="admin-section-title">Actividad global</h2>
        <div className="admin-activity-cards">
          <div className="admin-activity-card">
            <div className="admin-activity-kpis">
              <div className="admin-activity-kpi">
                <div className="admin-activity-kpi-label">Mov. Kanban</div>
                <div className="admin-activity-kpi-value">{activity.length}</div>
              </div>
              <div className="admin-activity-kpi">
                <div className="admin-activity-kpi-label">Reclamos (auditoría)</div>
                <div className="admin-activity-kpi-value">{actividadReclamos.length}</div>
              </div>
              <div className="admin-activity-kpi">
                <div className="admin-activity-kpi-label">Pedidos pendientes</div>
                <div className="admin-activity-kpi-value">{pedidosPendientes.length}</div>
              </div>
              <div className="admin-activity-kpi">
                <div className="admin-activity-kpi-label">Impresoras (ocupación)</div>
                <div className="admin-activity-kpi-value">{(impresorasOcupacion || []).length}</div>
              </div>
              <div className="admin-activity-kpi">
                <div className="admin-activity-kpi-label">Stock (mov.)</div>
                <div className="admin-activity-kpi-value">{movimientosStock.length}</div>
              </div>
              <div className="admin-activity-kpi">
                <div className="admin-activity-kpi-label">Facturas (30d)</div>
                <div className="admin-activity-kpi-value">{facturasVenta.length}</div>
              </div>
            </div>

            <div className="admin-activity-feed" role="list" aria-label="Actividad global reciente">
              {actividadGlobal.length === 0 ? (
                <div className="admin-activity-empty">Sin actividad para mostrar.</div>
              ) : (
                actividadGlobal.map((it, idx) => (
                  <div key={`${it.kind}-${it.ts}-${idx}`} className={`admin-activity-item admin-activity-item-${it.kind}`} role="listitem">
                    <div className="admin-activity-badge">{it.kind}</div>
                    <div className="admin-activity-content">
                      <div className="admin-activity-text">{it.label}</div>
                      <div className="admin-activity-time">{new Date(it.ts).toLocaleString('es-AR')}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Información del Sistema */}
      <section className="admin-system-info">
        <h2 className="admin-section-title">Estado del Sistema</h2>
        <div className="admin-system-info-grid">
          <div className="admin-system-info-item">
            <span className="admin-system-info-label">Última actualización:</span>
            <span className="admin-system-info-value">
              {lastUpdatedLabel}
            </span>
          </div>
          <div className="admin-system-info-item">
            <span className="admin-system-info-label">Usuarios activos:</span>
            <span className="admin-system-info-value">{teamMembers.length}</span>
          </div>
          <div className="admin-system-info-item">
            <span className="admin-system-info-label">Movimientos recientes:</span>
            <span className="admin-system-info-value">{activity.length}</span>
          </div>
        </div>
      </section>
    </div>
  )
}


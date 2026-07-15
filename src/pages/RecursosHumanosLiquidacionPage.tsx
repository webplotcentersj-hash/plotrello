import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import apiService from '../services/api'
import type {
  Asistencia,
  MenuDescuentoBeneficioComida,
  RrhhLiquidacionLinea,
  RrhhLiquidacionPeriodo,
  RrhhNovedad
} from '../types/api'
import { formatArs, LS_VALOR_HORA_EXTRA, type HorarioFijoAsistencia } from '../utils/asistenciaStats'
import { armarLineasLiquidacion, periodoRango, totalesLineas } from '../utils/rrhhLiquidacion'
import { exportarLiquidacionXlsx } from '../utils/exportLiquidacionXlsx'
import { nombreSinDominioCorreo } from '../utils/userDisplayName'
import './RecursosHumanosLiquidacionPage.css'

function mesActualYm(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const RecursosHumanosLiquidacionPage = () => {
  const navigate = useNavigate()
  const { usuario, canManageRecursosHumanos, isAdmin, loading: authLoading } = useAuth()
  const canAccess =
    !!usuario && (canManageRecursosHumanos || usuario.rol === 'gerencia')
  const canReabrir = !!usuario && (isAdmin || usuario.rol === 'gerencia')

  const [periodo, setPeriodo] = useState(mesActualYm)
  const [valorHora, setValorHora] = useState(() => {
    try {
      const v = localStorage.getItem(LS_VALOR_HORA_EXTRA)
      return v ? Number(v) || 0 : 0
    } catch {
      return 0
    }
  })
  const [notas, setNotas] = useState('')
  const [periodoDb, setPeriodoDb] = useState<RrhhLiquidacionPeriodo | null>(null)
  const [lineas, setLineas] = useState<RrhhLiquidacionLinea[]>([])
  const [novedades, setNovedades] = useState<RrhhNovedad[]>([])
  const [nombres, setNombres] = useState<Map<number, string>>(new Map())
  const [avisosSolape, setAvisosSolape] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  const cerrado = periodoDb?.estado === 'cerrado'

  useEffect(() => {
    if (authLoading) return
    if (!canAccess) {
      navigate('/rrhh/dashboard')
    }
  }, [authLoading, canAccess, navigate])

  const generarBorrador = useCallback(
    async (opts?: { valorHora?: number; notas?: string }) => {
      const vh = opts?.valorHora ?? valorHora
      const nt = opts?.notas ?? notas
      setBusy(true)
      setError(null)
      setMsg(null)
      try {
        const { desde, hasta } = periodoRango(periodo)
        const [asistRes, novRes, descRes, legRes, horRes, upsRes] = await Promise.all([
          apiService.obtenerAsistencia(null, desde, hasta),
          apiService.rrhhNovedadesListar({ fechaDesde: desde, fechaHasta: hasta }),
          apiService.menuDescuentosBeneficioListar({ fechaDesde: desde, fechaHasta: hasta }),
          apiService.obtenerLegajosBasico(),
          apiService.obtenerHorariosFijos(periodo),
          apiService.rrhhLiquidacionPeriodoUpsert({
            periodo,
            valor_hora_default: vh,
            notas: nt || null,
            estado: 'borrador'
          })
        ])

        if (!asistRes.success) throw new Error(asistRes.error || 'Error asistencia')
        if (!novRes.success) throw new Error(novRes.error || 'Error novedades')
        if (upsRes.success && upsRes.data) setPeriodoDb(upsRes.data)

        const mapNombres = new Map<number, string>()
        if (legRes.success && legRes.data) {
          for (const [id, row] of Object.entries(legRes.data)) {
            const n = `${row.nombre || ''} ${row.apellido || ''}`.trim()
            mapNombres.set(Number(id), nombreSinDominioCorreo(n) || n || `Usuario ${id}`)
          }
        }
        setNombres(mapNombres)

        const asistencia = (asistRes.data || []) as Asistencia[]
        const novs = novRes.data || []
        setNovedades(novs)
        const descuentos = (descRes.success ? descRes.data : []) as MenuDescuentoBeneficioComida[]

        const horariosPorMes: Record<string, Record<number, HorarioFijoAsistencia>> = {}
        if (horRes.success && horRes.data) {
          const mapa: Record<number, HorarioFijoAsistencia> = {}
          for (const [id, h] of Object.entries(horRes.data)) {
            mapa[Number(id)] = {
              entrada: h.entrada,
              salida: h.salida,
              horas: h.horas,
              trabajaSabado: h.trabajaSabado
            }
          }
          horariosPorMes[periodo] = mapa
        }

        const { lineas: L, avisosSolapeHe } = armarLineasLiquidacion({
          periodo,
          asistencia,
          novedades: novs,
          nombres: mapNombres,
          horariosPorMes,
          valorHora: vh,
          descuentosComida: descuentos
        })
        setLineas(L)
        setAvisosSolape(avisosSolapeHe)
        setMsg(`Borrador generado: ${L.length} empleados`)
        try {
          localStorage.setItem(LS_VALOR_HORA_EXTRA, String(vh))
        } catch {
          /* ignore */
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error al generar borrador')
      } finally {
        setBusy(false)
        setLoading(false)
      }
    },
    [periodo, valorHora, notas]
  )

  useEffect(() => {
    if (!canAccess || authLoading) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      setMsg(null)
      const res = await apiService.rrhhLiquidacionPeriodoObtener(periodo)
      if (cancelled) return
      let vh = valorHora
      let nt = notas
      if (res.success && res.data) {
        setPeriodoDb(res.data)
        vh = Number(res.data.valor_hora_default) || 0
        nt = res.data.notas || ''
        setValorHora(vh)
        setNotas(nt)
        if (res.data.estado === 'cerrado') {
          const lin = await apiService.rrhhLiquidacionLineasListar(res.data.id)
          if (cancelled) return
          if (lin.success && lin.data) {
            setLineas(lin.data)
            setAvisosSolape([])
            setLoading(false)
            return
          }
        }
      } else {
        setPeriodoDb(null)
      }
      if (!cancelled) await generarBorrador({ valorHora: vh, notas: nt })
    })()
    return () => {
      cancelled = true
    }
    // Solo al cambiar período / acceso
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodo, canAccess, authLoading])

  const tot = useMemo(() => totalesLineas(lineas), [lineas])

  const handleCerrar = async () => {
    if (!usuario?.id) return
    if (lineas.length === 0) {
      setError('Generá el borrador antes de cerrar')
      return
    }
    if (!confirm(`¿Cerrar liquidación de ${periodo}? Se congelará el snapshot para el estudio.`)) {
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await apiService.rrhhLiquidacionPeriodoCerrar({
        periodo,
        valor_hora_default: valorHora,
        notas: notas || null,
        cerrado_por: usuario.id,
        lineas
      })
      if (!res.success || !res.data) throw new Error(res.error || 'No se pudo cerrar')
      setPeriodoDb(res.data)
      setMsg('Período cerrado')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cerrar')
    } finally {
      setBusy(false)
    }
  }

  const handleReabrir = async () => {
    if (!canReabrir) {
      setError('Solo gerencia/admin puede reabrir un período cerrado')
      return
    }
    if (!confirm(`¿Reabrir liquidación ${periodo}? Podrás regenerar el borrador.`)) return
    setBusy(true)
    try {
      const res = await apiService.rrhhLiquidacionPeriodoReabrir(periodo)
      if (!res.success || !res.data) throw new Error(res.error || 'No se pudo reabrir')
      setPeriodoDb(res.data)
      await generarBorrador()
      setMsg('Período reabierto')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al reabrir')
    } finally {
      setBusy(false)
    }
  }

  const handleExport = () => {
    if (lineas.length === 0) {
      setError('No hay líneas para exportar')
      return
    }
    exportarLiquidacionXlsx({
      periodo,
      lineas,
      novedades,
      nombres,
      valorHora,
      estado: cerrado ? 'cerrado' : 'borrador'
    })
  }

  const handleGuardarValor = async () => {
    setBusy(true)
    try {
      const res = await apiService.rrhhLiquidacionPeriodoUpsert({
        periodo,
        valor_hora_default: valorHora,
        notas: notas || null
      })
      if (res.success && res.data) setPeriodoDb(res.data)
      try {
        localStorage.setItem(LS_VALOR_HORA_EXTRA, String(valorHora))
      } catch {
        /* ignore */
      }
      setMsg('Valor hora / notas guardados')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setBusy(false)
    }
  }

  if (authLoading || (!canAccess && !loading)) {
    return (
      <div className="rrhh-liq-loading">
        <div className="spinner" />
        <p>Cargando…</p>
      </div>
    )
  }

  return (
    <div className="rrhh-liq-page">
      <header className="rrhh-liq-header">
        <div>
          <p className="rrhh-liq-breadcrumb">RRHH · Liquidación</p>
          <h1>Liquidación mensual</h1>
          <p className="rrhh-liq-subtitle">
            Cierre interno del mes para enviar al estudio contable (novedades, HE, faltas, anticipos y
            descuento comida).
          </p>
        </div>
        <div className="rrhh-liq-header-actions">
          <button type="button" className="rrhh-liq-btn ghost" onClick={() => navigate('/rrhh')}>
            Volver
          </button>
        </div>
      </header>

      <div className="rrhh-liq-toolbar">
        <label>
          Período
          <input
            type="month"
            value={periodo}
            onChange={(e) => setPeriodo(e.target.value)}
            disabled={busy}
          />
        </label>
        <label>
          Valor hora (HE)
          <input
            type="number"
            min={0}
            step={100}
            value={valorHora || ''}
            onChange={(e) => setValorHora(Number(e.target.value) || 0)}
            disabled={cerrado || busy}
          />
        </label>
        <span className={`rrhh-liq-badge ${cerrado ? 'cerrado' : 'borrador'}`}>
          {cerrado ? 'Cerrado' : 'Borrador'}
        </span>
        {!cerrado ? (
          <>
            <button type="button" className="rrhh-liq-btn" disabled={busy} onClick={() => void generarBorrador()}>
              Regenerar borrador
            </button>
            <button type="button" className="rrhh-liq-btn ghost" disabled={busy} onClick={() => void handleGuardarValor()}>
              Guardar valor/notas
            </button>
            <button type="button" className="rrhh-liq-btn primary" disabled={busy} onClick={() => void handleCerrar()}>
              Cerrar período
            </button>
          </>
        ) : (
          <button type="button" className="rrhh-liq-btn warn" disabled={busy || !canReabrir} onClick={() => void handleReabrir()}>
            Reabrir
          </button>
        )}
        <button type="button" className="rrhh-liq-btn" disabled={busy || lineas.length === 0} onClick={handleExport}>
          Exportar Excel
        </button>
      </div>

      <label className="rrhh-liq-notas">
        Notas
        <textarea
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          rows={2}
          disabled={cerrado || busy}
          placeholder="Observaciones para el estudio…"
        />
      </label>

      {error ? <p className="rrhh-liq-error">{error}</p> : null}
      {msg ? <p className="rrhh-liq-msg">{msg}</p> : null}
      {avisosSolape.length > 0 ? (
        <div className="rrhh-liq-avisos">
          <strong>Aviso: posible solape marca / novedad HE</strong>
          <ul>
            {avisosSolape.slice(0, 12).map((a) => (
              <li key={a}>{a}</li>
            ))}
            {avisosSolape.length > 12 ? <li>… y {avisosSolape.length - 12} más</li> : null}
          </ul>
        </div>
      ) : null}

      {loading ? (
        <p className="rrhh-liq-inline-loading">Calculando…</p>
      ) : (
        <>
          <div className="rrhh-liq-totales">
            <div>
              <span>HE 50%</span>
              <strong>{tot.he50.toFixed(2)}</strong>
            </div>
            <div>
              <span>HE 100%</span>
              <strong>{tot.he100.toFixed(2)}</strong>
            </div>
            <div>
              <span>Costo HE</span>
              <strong>{valorHora > 0 ? formatArs(tot.costo_he) : '—'}</strong>
            </div>
            <div>
              <span>Anticipaciones</span>
              <strong>{formatArs(tot.anticipacion_sueldo)}</strong>
            </div>
            <div>
              <span>Desc. comida</span>
              <strong>{formatArs(tot.descuento_comida)}</strong>
            </div>
            <div>
              <span>Faltas injust.</span>
              <strong>{tot.faltas_injustificadas}</strong>
            </div>
          </div>

          <div className="rrhh-liq-table-wrap">
            <table className="rrhh-liq-table">
              <thead>
                <tr>
                  <th>Empleado</th>
                  <th>Días</th>
                  <th>Tard.</th>
                  <th>Min tarde</th>
                  <th>Aus.</th>
                  <th>F.injust.</th>
                  <th>HE 50</th>
                  <th>HE 100</th>
                  <th>Costo HE</th>
                  <th>Anticip.</th>
                  <th>Comida</th>
                </tr>
              </thead>
              <tbody>
                {lineas.map((l) => (
                  <tr key={l.id_usuario}>
                    <td>{l.nombre}</td>
                    <td>{l.dias_trabajados}</td>
                    <td>{l.tardanzas}</td>
                    <td>{l.minutos_tarde}</td>
                    <td>{l.ausencias}</td>
                    <td>{l.faltas_injustificadas}</td>
                    <td>{l.he50.toFixed(2)}</td>
                    <td>{l.he100.toFixed(2)}</td>
                    <td>{valorHora > 0 ? formatArs(l.costo_he) : '—'}</td>
                    <td>{l.anticipacion_sueldo ? formatArs(l.anticipacion_sueldo) : '—'}</td>
                    <td>{l.descuento_comida ? formatArs(l.descuento_comida) : '—'}</td>
                  </tr>
                ))}
                {lineas.length === 0 ? (
                  <tr>
                    <td colSpan={11}>Sin datos para este período</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

export default RecursosHumanosLiquidacionPage

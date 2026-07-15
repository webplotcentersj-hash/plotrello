import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import apiService from '../services/api'
import type { RrhhNovedad, RrhhVacacionesAjuste, SolicitudPermiso } from '../types/api'
import {
  calcularSaldoVacaciones,
  type SaldoVacacionesEmpleado
} from '../utils/rrhhVacacionesSaldo'
import { nombreSinDominioCorreo } from '../utils/userDisplayName'
import './RecursosHumanosVacacionesPage.css'

const RecursosHumanosVacacionesPage = () => {
  const navigate = useNavigate()
  const { usuario, canManageRecursosHumanos, loading: authLoading } = useAuth()
  const canAccess =
    !!usuario && (canManageRecursosHumanos || usuario.rol === 'gerencia')

  const [anio, setAnio] = useState(() => new Date().getFullYear())
  const [busqueda, setBusqueda] = useState('')
  const [saldos, setSaldos] = useState<SaldoVacacionesEmpleado[]>([])
  const [ajustes, setAjustes] = useState<RrhhVacacionesAjuste[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [detalle, setDetalle] = useState<SaldoVacacionesEmpleado | null>(null)
  const [ajusteDias, setAjusteDias] = useState('')
  const [ajusteMotivo, setAjusteMotivo] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (authLoading) return
    if (!canAccess) navigate('/rrhh/dashboard')
  }, [authLoading, canAccess, navigate])

  const cargar = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const yearStart = `${anio}-01-01`
      const yearEnd = `${anio}-12-31`
      const [legRes, solRes, novRes, ajRes] = await Promise.all([
        apiService.obtenerLegajosBasico(),
        // Sin filtro de fechas: el cruce con el año se resuelve en el util de saldo
        apiService.obtenerSolicitudesPermisos(null, 'aprobado', 'vacaciones'),
        apiService.rrhhNovedadesListar({
          codigo: 'licencia_vacaciones',
          fechaDesde: yearStart,
          fechaHasta: yearEnd
        }),
        apiService.rrhhVacacionesAjustesListar({ anio })
      ])

      if (!legRes.success || !legRes.data) {
        throw new Error(legRes.error || 'No se pudieron cargar legajos')
      }

      const sols = (solRes.success ? solRes.data : []) as SolicitudPermiso[]
      const novedades = (novRes.success ? novRes.data : []) as RrhhNovedad[]
      const aj = (ajRes.success ? ajRes.data : []) as RrhhVacacionesAjuste[]
      setAjustes(aj)

      const list: SaldoVacacionesEmpleado[] = []
      for (const [idStr, row] of Object.entries(legRes.data)) {
        const id = Number(idStr)
        const nombreRaw = `${row.nombre || ''} ${row.apellido || ''}`.trim()
        const nombre = nombreSinDominioCorreo(nombreRaw) || nombreRaw || `Usuario ${id}`
        list.push(
          calcularSaldoVacaciones({
            idUsuario: id,
            nombre,
            fechaIngreso: row.fecha_ingreso,
            anio,
            solicitudes: sols,
            novedades,
            ajustes: aj
          })
        )
      }
      list.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
      setSaldos(list)
      setDetalle((prev) => {
        if (!prev) return prev
        return list.find((x) => x.id_usuario === prev.id_usuario) || null
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar vacaciones')
    } finally {
      setLoading(false)
    }
  }, [anio])

  useEffect(() => {
    if (!canAccess || authLoading) return
    void cargar()
  }, [anio, canAccess, authLoading, cargar])

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return saldos
    return saldos.filter((s) => s.nombre.toLowerCase().includes(q))
  }, [saldos, busqueda])

  const handleAjuste = async () => {
    if (!usuario?.id || !detalle) return
    const dias = Number(String(ajusteDias).replace(',', '.'))
    if (!Number.isFinite(dias) || dias === 0) {
      setError('Ingresá un ajuste distinto de 0')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await apiService.rrhhVacacionesAjusteCrear({
        id_usuario: detalle.id_usuario,
        anio,
        dias_ajuste: dias,
        motivo: ajusteMotivo.trim() || null,
        registrado_por: usuario.id
      })
      if (!res.success) throw new Error(res.error || 'No se pudo guardar el ajuste')
      setAjusteDias('')
      setAjusteMotivo('')
      await cargar()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar ajuste')
    } finally {
      setBusy(false)
    }
  }

  const handleEliminarAjuste = async (id: number) => {
    if (!confirm('¿Eliminar este ajuste?')) return
    setBusy(true)
    try {
      await apiService.rrhhVacacionesAjusteEliminar(id)
      await cargar()
    } finally {
      setBusy(false)
    }
  }

  const ajustesDetalle = detalle
    ? ajustes.filter((a) => a.id_usuario === detalle.id_usuario && a.anio === anio)
    : []

  if (authLoading) {
    return (
      <div className="rrhh-vac-loading">
        <div className="spinner" />
        <p>Cargando…</p>
      </div>
    )
  }

  return (
    <div className="rrhh-vac-page">
      <header className="rrhh-vac-header">
        <div>
          <p className="rrhh-vac-breadcrumb">RRHH · Vacaciones</p>
          <h1>Saldos de vacaciones</h1>
          <p className="rrhh-vac-subtitle">
            Cupo LCT (14 / 21 / 28 / 35 días corridos según antigüedad). Tomados = vacaciones aprobadas +
            novedades de licencia, sin doble conteo.
          </p>
        </div>
        <button type="button" className="rrhh-vac-btn ghost" onClick={() => navigate('/rrhh')}>
          Volver
        </button>
      </header>

      <div className="rrhh-vac-toolbar">
        <label>
          Año
          <input
            type="number"
            min={2000}
            max={2100}
            value={anio}
            onChange={(e) => setAnio(Number(e.target.value) || new Date().getFullYear())}
          />
        </label>
        <label className="rrhh-vac-search">
          Buscar
          <input
            type="search"
            placeholder="Nombre…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </label>
        <button type="button" className="rrhh-vac-btn" disabled={loading || busy} onClick={() => void cargar()}>
          Actualizar
        </button>
      </div>

      {error ? <p className="rrhh-vac-error">{error}</p> : null}

      {loading ? (
        <p className="rrhh-vac-inline">Cargando saldos…</p>
      ) : (
        <div className="rrhh-vac-layout">
          <div className="rrhh-vac-table-wrap">
            <table className="rrhh-vac-table">
              <thead>
                <tr>
                  <th>Empleado</th>
                  <th>Ingreso</th>
                  <th>Antigüedad</th>
                  <th>Corresponden</th>
                  <th>Tomados</th>
                  <th>Ajustes</th>
                  <th>Saldo</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((s) => (
                  <tr
                    key={s.id_usuario}
                    className={detalle?.id_usuario === s.id_usuario ? 'active' : ''}
                    onClick={() => setDetalle(s)}
                  >
                    <td>{s.nombre}</td>
                    <td>{s.fecha_ingreso || '—'}</td>
                    <td>{s.anios} a.</td>
                    <td>{s.corresponden}</td>
                    <td>{s.tomados}</td>
                    <td>{s.ajustes || '—'}</td>
                    <td className={s.saldo < 0 ? 'neg' : ''}>{s.saldo}</td>
                  </tr>
                ))}
                {filtrados.length === 0 ? (
                  <tr>
                    <td colSpan={7}>Sin empleados</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <aside className="rrhh-vac-detalle">
            {detalle ? (
              <>
                <h2>{detalle.nombre}</h2>
                <p className="rrhh-vac-saldo-chip">
                  Vacaciones {anio}: saldo <strong>{detalle.saldo}</strong>
                </p>
                <dl className="rrhh-vac-dl">
                  <div>
                    <dt>Ingreso</dt>
                    <dd>{detalle.fecha_ingreso || '—'}</dd>
                  </div>
                  <div>
                    <dt>Corresponden</dt>
                    <dd>{detalle.corresponden}</dd>
                  </div>
                  <div>
                    <dt>Tomados</dt>
                    <dd>{detalle.tomados}</dd>
                  </div>
                  <div>
                    <dt>Ajustes</dt>
                    <dd>{detalle.ajustes}</dd>
                  </div>
                </dl>

                <h3>Períodos tomados</h3>
                {detalle.tomadosDetalle.length === 0 ? (
                  <p className="rrhh-vac-muted">Ninguno en {anio}</p>
                ) : (
                  <ul className="rrhh-vac-tomados">
                    {detalle.tomadosDetalle.map((t) => (
                      <li key={`${t.fuente}-${t.id}`}>
                        <span>
                          {t.fecha_desde} → {t.fecha_hasta}
                        </span>
                        <span>
                          {t.dias} d · {t.fuente}
                          {t.titulo ? ` · ${t.titulo}` : ''}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}

                <h3>Ajustes</h3>
                {ajustesDetalle.length === 0 ? (
                  <p className="rrhh-vac-muted">Sin ajustes</p>
                ) : (
                  <ul className="rrhh-vac-tomados">
                    {ajustesDetalle.map((a) => (
                      <li key={a.id}>
                        <span>
                          {a.dias_ajuste > 0 ? '+' : ''}
                          {a.dias_ajuste} d{a.motivo ? ` · ${a.motivo}` : ''}
                        </span>
                        <button
                          type="button"
                          className="rrhh-vac-link"
                          disabled={busy}
                          onClick={() => void handleEliminarAjuste(a.id)}
                        >
                          Eliminar
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="rrhh-vac-ajuste-form">
                  <h3>Nuevo ajuste</h3>
                  <label>
                    Días (+/−)
                    <input
                      type="number"
                      step={0.5}
                      value={ajusteDias}
                      onChange={(e) => setAjusteDias(e.target.value)}
                      disabled={busy}
                    />
                  </label>
                  <label>
                    Motivo
                    <input
                      type="text"
                      value={ajusteMotivo}
                      onChange={(e) => setAjusteMotivo(e.target.value)}
                      disabled={busy}
                      placeholder="Opcional"
                    />
                  </label>
                  <button type="button" className="rrhh-vac-btn primary" disabled={busy} onClick={() => void handleAjuste()}>
                    Guardar ajuste
                  </button>
                </div>
              </>
            ) : (
              <p className="rrhh-vac-muted">Seleccioná un empleado para ver el detalle.</p>
            )}
          </aside>
        </div>
      )}
    </div>
  )
}

export default RecursosHumanosVacacionesPage

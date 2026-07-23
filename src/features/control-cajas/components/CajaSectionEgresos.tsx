import { useCallback, useEffect, useMemo, useState } from 'react'
import { useCajaOperativa } from '../../../hooks/useCajaOperativa'
import {
  adjuntarTicketEgresoSolicitud,
  createEgresoSolicitud,
  listCajas,
  listEgresoSolicitudes,
  resolverEgresoSolicitud
} from '../cajaRepository'
import { fmtArs, fmtDateAr } from '../format'
import { getArgentinaDateString } from '../../../utils/dateUtils'
import { uploadAttachmentAndGetUrl } from '../../../utils/storage'
import type { CajaEgresoSolicitud, CajaRegistro } from '../types'
import CajaCollapsibleCard, { CajaListSearch } from './CajaCollapsibleCard'
import CajaVolverPlotLab from './CajaVolverPlotLab'
import { LIST_PAGE_SIZE, matchSearchQuery } from '../listFilters'

type Props = {
  isAdmin: boolean
  usuarioNombre: string
  usuarioId?: number
  filtroCajaSlug?: string | null
}

export default function CajaSectionEgresos({
  isAdmin,
  usuarioNombre,
  usuarioId,
  filtroCajaSlug = null
}: Props) {
  const { slug: cajaSlugOp, nombre: cajaNombreOp, loading: cajaOpLoading } = useCajaOperativa({
    enabled: !isAdmin
  })
  const [cajas, setCajas] = useState<CajaRegistro[]>([])
  const [lista, setLista] = useState<CajaEgresoSolicitud[]>([])
  const [fecha, setFecha] = useState(getArgentinaDateString())
  const [cajaSlug, setCajaSlug] = useState('')
  const [concepto, setConcepto] = useState('')
  const [montoEf, setMontoEf] = useState('')
  const [obs, setObs] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [ticketParaId, setTicketParaId] = useState<string | null>(null)
  const [subiendoTicket, setSubiendoTicket] = useState(false)
  const [histSearch, setHistSearch] = useState('')
  const [histEstado, setHistEstado] = useState('')
  const [histDesde, setHistDesde] = useState('')
  const [histHasta, setHistHasta] = useState('')
  const [histLimit, setHistLimit] = useState(LIST_PAGE_SIZE)

  const reload = useCallback(async () => {
    const egresoOpts = isAdmin
      ? { soloPendientes: false as const }
      : usuarioId != null
        ? { solicitanteId: usuarioId }
        : undefined
    const [c, s] = await Promise.all([listCajas(), listEgresoSolicitudes(egresoOpts)])
    setCajas(c.filter((x) => x.slug !== 'admin' && x.slug !== 'vuelto'))
    setLista(s)
  }, [isAdmin, usuarioId])

  useEffect(() => {
    void reload()
  }, [reload])

  useEffect(() => {
    if (!isAdmin && cajaSlugOp) {
      setCajaSlug(cajaSlugOp)
      return
    }
    if (filtroCajaSlug) setCajaSlug(filtroCajaSlug)
  }, [isAdmin, cajaSlugOp, filtroCajaSlug])

  const solicitar = async (e: React.FormEvent) => {
    e.preventDefault()
    const slug = (!isAdmin && cajaSlugOp) || cajaSlug
    if (!slug || !concepto.trim()) return
    if (!isAdmin && usuarioId == null) {
      setMsg('Usuario sin ID; no se puede solicitar egreso.')
      return
    }
    const monto = parseFloat(montoEf)
    if (!(monto > 0)) {
      setMsg('Indicá el monto en efectivo.')
      return
    }
    setSaving(true)
    setMsg(null)
    try {
      await createEgresoSolicitud(
        {
          fecha,
          caja_slug: slug,
          concepto: concepto.trim(),
          monto_efectivo: monto,
          monto_otros: 0,
          solicitante_id: usuarioId ?? null,
          solicitante_nombre: usuarioNombre,
          observacion: obs || null,
          url_ticket: null
        },
        usuarioId != null ? { actor: { id: usuarioId, esAdmin: isAdmin } } : undefined
      )
      setConcepto('')
      setMontoEf('')
      setObs('')
      setMsg('Solicitud enviada. Cuando administración apruebe, subí el ticket acá.')
      await reload()
    } catch (ex) {
      setMsg(ex instanceof Error ? ex.message : 'No se pudo enviar la solicitud.')
    } finally {
      setSaving(false)
    }
  }

  const resolver = async (id: string, accion: 'aprobado' | 'rechazado') => {
    if (!usuarioId) {
      setMsg('Usuario sin ID; no se puede registrar el aprobador.')
      return
    }
    let motivo: string | undefined
    if (accion === 'rechazado') {
      motivo = window.prompt('Motivo del rechazo:') ?? undefined
      if (!motivo?.trim()) return
    }
    setSaving(true)
    setMsg(null)
    try {
      await resolverEgresoSolicitud(id, accion, { id: usuarioId, nombre: usuarioNombre }, {
        motivo_rechazo: motivo
      })
      setMsg(
        accion === 'aprobado'
          ? 'Egreso autorizado. El operador debe subir el ticket para ejecutarlo.'
          : 'Solicitud rechazada.'
      )
      await reload()
    } catch (ex) {
      setMsg(ex instanceof Error ? ex.message : 'No se pudo resolver.')
    } finally {
      setSaving(false)
    }
  }

  const subirTicketOperador = async (sol: CajaEgresoSolicitud, file: File | undefined) => {
    if (!file || !usuarioId) return
    if (file.size > 8 * 1024 * 1024) {
      setMsg('El ticket no puede superar 8 MB.')
      return
    }
    setTicketParaId(sol.id)
    setSubiendoTicket(true)
    setMsg(null)
    try {
      const url = await uploadAttachmentAndGetUrl(file, `caja/egresos/${sol.caja_slug}`)
      await adjuntarTicketEgresoSolicitud(sol.id, url, {
        actor: { id: usuarioId, esAdmin: isAdmin }
      })
      setMsg('Ticket cargado. Egreso ejecutado y descontado de caja.')
      await reload()
    } catch (ex) {
      setMsg(ex instanceof Error ? ex.message : 'No se pudo adjuntar el ticket.')
    } finally {
      setSubiendoTicket(false)
      setTicketParaId(null)
    }
  }

  const cajaNombre = (slug: string) => cajas.find((c) => c.slug === slug)?.nombre ?? slug
  const pendientes = lista.filter(
    (s) => s.estado === 'pendiente' && (!filtroCajaSlug || s.caja_slug === filtroCajaSlug)
  )
  const pendientesTicket = lista.filter(
    (s) =>
      s.estado === 'aprobado' &&
      !s.url_ticket &&
      (!filtroCajaSlug || s.caja_slug === filtroCajaSlug)
  )

  const historialFiltrado = useMemo(() => {
    return lista.filter((s) => {
      if (filtroCajaSlug && s.caja_slug !== filtroCajaSlug) return false
      if (histEstado && s.estado !== histEstado) return false
      if (histDesde && s.fecha < histDesde) return false
      if (histHasta && s.fecha > histHasta) return false
      return matchSearchQuery(histSearch, [
        s.concepto,
        s.fecha,
        cajaNombre(s.caja_slug),
        s.estado,
        s.solicitante_nombre,
        s.aprobador_nombre,
        s.observacion,
        fmtArs(s.monto_efectivo)
      ])
    })
  }, [lista, histSearch, histEstado, histDesde, histHasta, cajas, filtroCajaSlug])

  const historialVisible = historialFiltrado.slice(0, histLimit)

  const estadoLabel = (s: CajaEgresoSolicitud) => {
    if (s.estado === 'aprobado' && !s.url_ticket) return 'aprobado · falta ticket'
    return s.estado
  }

  const historialToolbar = (
    <div className="caja-cc-card-toolbar caja-cc-card-toolbar--stack">
      <CajaListSearch
        value={histSearch}
        onChange={(v) => {
          setHistSearch(v)
          setHistLimit(LIST_PAGE_SIZE)
        }}
        placeholder="Buscar concepto, caja, solicitante…"
      />
      <div className="caja-cc-filters-row">
        <label className="caja-cc-filter-chip">
          <span>Estado</span>
          <select
            value={histEstado}
            onChange={(e) => {
              setHistEstado(e.target.value)
              setHistLimit(LIST_PAGE_SIZE)
            }}
          >
            <option value="">Todos</option>
            <option value="pendiente">Pendiente</option>
            <option value="aprobado">Aprobado</option>
            <option value="rechazado">Rechazado</option>
          </select>
        </label>
        <label className="caja-cc-filter-chip">
          <span>Desde</span>
          <input
            type="date"
            value={histDesde}
            onChange={(e) => {
              setHistDesde(e.target.value)
              setHistLimit(LIST_PAGE_SIZE)
            }}
          />
        </label>
        <label className="caja-cc-filter-chip">
          <span>Hasta</span>
          <input
            type="date"
            value={histHasta}
            onChange={(e) => {
              setHistHasta(e.target.value)
              setHistLimit(LIST_PAGE_SIZE)
            }}
          />
        </label>
        {(histSearch || histEstado || histDesde || histHasta) && (
          <button
            type="button"
            className="btn-tiny"
            onClick={() => {
              setHistSearch('')
              setHistEstado('')
              setHistDesde('')
              setHistHasta('')
              setHistLimit(LIST_PAGE_SIZE)
            }}
          >
            Limpiar
          </button>
        )}
      </div>
    </div>
  )

  return (
    <div>
      <div className="caja-cc-page-head">
        <div>
          <h2>Egresos de caja</h2>
          <p>
            {isAdmin
              ? 'Autorizá o rechazá egresos. El operador sube el ticket después de la aprobación.'
              : 'Pedí egreso en efectivo. Si te aprueban, subí el ticket para que se descuente de caja.'}
          </p>
        </div>
        <CajaVolverPlotLab small />
      </div>

      {!isAdmin && (
        <form className="caja-cc-card" onSubmit={(e) => void solicitar(e)}>
          <h3>Solicitar egreso</h3>
          <div className="caja-cc-grid-2">
            <label className="caja-cc-field">
              Fecha
              <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
            </label>
            <label className="caja-cc-field">
              Caja
              {cajaSlugOp ? (
                <>
                  <input type="text" value={cajaNombreOp || cajaSlugOp} readOnly disabled />
                  <span className="caja-cc-field-hint">Tu caja personal; no podés egresar de otra.</span>
                </>
              ) : (
                <select
                  value={cajaSlug}
                  onChange={(e) => setCajaSlug(e.target.value)}
                  required
                  disabled={cajaOpLoading}
                >
                  {cajas.map((c) => (
                    <option key={c.slug} value={c.slug}>
                      {c.nombre}
                    </option>
                  ))}
                </select>
              )}
            </label>
          </div>
          <label className="caja-cc-field">
            Concepto
            <input
              value={concepto}
              onChange={(e) => setConcepto(e.target.value)}
              required
              placeholder="Ej: Pago proveedor"
            />
          </label>
          <label className="caja-cc-field">
            Monto ($) *
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={montoEf}
              onChange={(e) => setMontoEf(e.target.value)}
              required
              placeholder="0,00"
            />
            <span className="caja-cc-field-hint">Solo efectivo. Sale de la caja física.</span>
          </label>
          <label className="caja-cc-field">
            Observación
            <textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} />
          </label>
          <button type="submit" className="btn-primary" disabled={saving}>
            Pedir autorización
          </button>
        </form>
      )}

      {!isAdmin && pendientesTicket.length > 0 && (
        <div className="caja-cc-card caja-cc-egreso-ticket-pendiente">
          <h3>Aprobados — subir ticket ({pendientesTicket.length})</h3>
          <p className="caja-cc-help">
            Administración ya autorizó. Subí el ticket para ejecutar el egreso.
          </p>
          <table className="caja-cc-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Concepto</th>
                <th className="num">Monto</th>
                <th>Autorizó</th>
                <th>Ticket</th>
              </tr>
            </thead>
            <tbody>
              {pendientesTicket.map((s) => (
                <tr key={s.id}>
                  <td>{fmtDateAr(s.fecha)}</td>
                  <td>{s.concepto}</td>
                  <td className="num">$ {fmtArs(s.monto_efectivo)}</td>
                  <td>{s.aprobador_nombre ?? '—'}</td>
                  <td>
                    <label className="caja-cc-file-inline">
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/*"
                        disabled={subiendoTicket || saving}
                        onChange={(e) => {
                          const f = e.target.files?.[0]
                          void subirTicketOperador(s, f)
                          e.target.value = ''
                        }}
                      />
                      {ticketParaId === s.id && subiendoTicket
                        ? 'Subiendo…'
                        : 'Elegir ticket'}
                    </label>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isAdmin && pendientes.length > 0 && (
        <div className="caja-cc-card caja-cc-egreso-pendientes">
          <h3>Pendientes de autorización ({pendientes.length})</h3>
          <table className="caja-cc-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Caja</th>
                <th>Concepto</th>
                <th className="num">Monto</th>
                <th>Solicitó</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {pendientes.map((s) => (
                <tr key={s.id}>
                  <td>{fmtDateAr(s.fecha)}</td>
                  <td>{cajaNombre(s.caja_slug)}</td>
                  <td>{s.concepto}</td>
                  <td className="num">$ {fmtArs(s.monto_efectivo)}</td>
                  <td>{s.solicitante_nombre ?? '—'}</td>
                  <td className="caja-cc-actions-cell">
                    <button
                      type="button"
                      className="btn-small"
                      disabled={saving}
                      onClick={() => void resolver(s.id, 'aprobado')}
                    >
                      Aprobar
                    </button>
                    <button
                      type="button"
                      className="btn-small danger"
                      disabled={saving}
                      onClick={() => void resolver(s.id, 'rechazado')}
                    >
                      Rechazar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isAdmin && pendientesTicket.length > 0 && (
        <div className="caja-cc-card">
          <h3>Esperando ticket del operador ({pendientesTicket.length})</h3>
          <table className="caja-cc-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Caja</th>
                <th>Concepto</th>
                <th className="num">Monto</th>
                <th>Solicitó</th>
              </tr>
            </thead>
            <tbody>
              {pendientesTicket.map((s) => (
                <tr key={s.id}>
                  <td>{fmtDateAr(s.fecha)}</td>
                  <td>{cajaNombre(s.caja_slug)}</td>
                  <td>{s.concepto}</td>
                  <td className="num">$ {fmtArs(s.monto_efectivo)}</td>
                  <td>{s.solicitante_nombre ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CajaCollapsibleCard
        title="Historial"
        count={historialFiltrado.length}
        toolbar={historialToolbar}
        bodyClassName="caja-cc-card-body-scroll"
      >
        {historialVisible.length === 0 ? (
          <p className="caja-cc-empty">
            {histSearch || histEstado || histDesde || histHasta
              ? 'Sin coincidencias.'
              : 'Sin solicitudes.'}
          </p>
        ) : (
          <>
            <div className="caja-cc-table-scroll">
              <table className="caja-cc-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Caja</th>
                    <th>Concepto</th>
                    <th className="num">Monto</th>
                    <th>Ticket</th>
                    <th>Estado</th>
                    <th>Trazabilidad</th>
                  </tr>
                </thead>
                <tbody>
                  {historialVisible.map((s) => (
                    <tr key={s.id}>
                      <td>{fmtDateAr(s.fecha)}</td>
                      <td>{cajaNombre(s.caja_slug)}</td>
                      <td>{s.concepto}</td>
                      <td className="num">$ {fmtArs(s.monto_efectivo)}</td>
                      <td>
                        {s.url_ticket ? (
                          <a href={s.url_ticket} target="_blank" rel="noopener noreferrer">
                            Ver
                          </a>
                        ) : s.estado === 'aprobado' ? (
                          'Pendiente'
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>
                        <span
                          className={`caja-cc-badge ${
                            s.estado === 'aprobado' && s.url_ticket
                              ? 'ok'
                              : s.estado === 'rechazado'
                                ? 'bad'
                                : 'pen'
                          }`}
                        >
                          {estadoLabel(s)}
                        </span>
                      </td>
                      <td className="caja-cc-meta">
                        {s.solicitante_nombre}
                        {s.aprobador_nombre ? ` → ${s.aprobador_nombre}` : ''}
                        {s.id_movimiento ? ` · mov ${s.id_movimiento.slice(0, 8)}` : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {historialFiltrado.length > histLimit && (
              <button
                type="button"
                className="btn-link caja-cc-show-more"
                onClick={() => setHistLimit((n) => n + LIST_PAGE_SIZE)}
              >
                Ver más ({historialFiltrado.length - histLimit} restantes)
              </button>
            )}
          </>
        )}
      </CajaCollapsibleCard>

      {msg && <p className="caja-cc-help">{msg}</p>}
    </div>
  )
}

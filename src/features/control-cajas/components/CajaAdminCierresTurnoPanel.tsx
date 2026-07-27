import { fmtArs } from '../format'
import { mismoCajaSlug } from '../cajaRepository'
import type { CajaArqueo, CajaRegistro, CajaTransferenciaLote } from '../types'

type Props = {
  fecha: string
  onFechaChange: (fecha: string) => void
  cajas: CajaRegistro[]
  lotes: CajaTransferenciaLote[]
  arqueos: CajaArqueo[]
  onVerDetalle: (lote: CajaTransferenciaLote) => void
  onRegistrarCaja: (slug: string) => void
}

export default function CajaAdminCierresTurnoPanel({
  fecha,
  onFechaChange,
  cajas,
  lotes,
  arqueos,
  onVerDetalle,
  onRegistrarCaja
}: Props) {
  const cajaNombre = (s: string) => cajas.find((c) => c.slug === s)?.nombre ?? s
  const operativas = cajas.filter((c) => c.slug !== 'admin' && c.slug !== 'vuelto')

  const lotesDelDia = lotes
    .filter((l) => l.fecha === fecha)
    .sort((a, b) => `${b.hora ?? ''}`.localeCompare(`${a.hora ?? ''}`))

  let fondo = 0
  let resto = 0
  let egresosEf = 0
  for (const l of lotesDelDia) {
    fondo += l.fondo_monto || 0
    resto += (l.resto_efectivo || 0) + (l.resto_otros || 0)
    egresosEf += l.egresos_aprobados_ef || 0
  }

  const estadoPorCaja = operativas.map((c) => {
    const arqueo =
      arqueos
        .filter((a) => a.fecha === fecha && mismoCajaSlug(a.caja_slug, c.slug))
        .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))[0] ?? null
    const cierres = lotesDelDia.filter((l) => mismoCajaSlug(l.origen_slug, c.slug))
    return { slug: c.slug, nombre: c.nombre, arqueo, cierres }
  })

  const pendientes = estadoPorCaja.filter((e) => e.arqueo && e.cierres.length === 0)

  return (
    <div className="caja-cc-admin-cierres-panel">
      <div className="caja-cc-page-head">
        <div>
          <h2>Cierres de turno — todas las cajas</h2>
          <p className="caja-cc-sub">
            Trazá cada cierre: fondo dejado, resto a administración, quién cerró y qué cajas faltan.
          </p>
        </div>
        <label className="caja-cc-field caja-cc-cierre-fecha-admin">
          Día
          <input type="date" value={fecha} onChange={(e) => onFechaChange(e.target.value)} />
        </label>
      </div>

      <div className="caja-cc-hoy-hero caja-cc-cierre-hero">
        <div className="caja-cc-hoy-hero-card ingreso">
          <span className="caja-cc-hoy-hero-label">Resto → administración</span>
          <span className="caja-cc-hoy-hero-value">$ {fmtArs(resto)}</span>
          <span className="caja-cc-hoy-hero-hint">
            Suma de {lotesDelDia.length} cierre{lotesDelDia.length === 1 ? '' : 's'} del día
          </span>
        </div>
        <div className="caja-cc-hoy-hero-card caja-cc-fondo-otra-caja-hero">
          <span className="caja-cc-fondo-otra-caja-tag">Fondos dejados</span>
          <span className="caja-cc-hoy-hero-label">en cajas operativas</span>
          <span className="caja-cc-hoy-hero-value">$ {fmtArs(fondo)}</span>
          <span className="caja-cc-hoy-hero-hint">Según cada arqueo / cierre</span>
        </div>
        <div className="caja-cc-hoy-hero-card egreso">
          <span className="caja-cc-hoy-hero-label">Egresos en cierres</span>
          <span className="caja-cc-hoy-hero-value">$ {fmtArs(egresosEf)}</span>
          <span className="caja-cc-hoy-hero-hint">Efectivo descontado en los lotes</span>
        </div>
      </div>

      <div className="caja-cc-card">
        <h3>Cierres registrados — {fecha}</h3>
        {lotesDelDia.length === 0 ? (
          <p className="caja-cc-muted">Todavía no hay cierres de turno este día.</p>
        ) : (
          <div className="caja-cc-table-scroll">
            <table className="caja-cc-table caja-cc-table-clickable">
              <thead>
                <tr>
                  <th>Hora</th>
                  <th>Caja origen</th>
                  <th className="num">Contado</th>
                  <th className="num">Fondo</th>
                  <th>Fondo →</th>
                  <th className="num">Egresos</th>
                  <th className="num">A administración</th>
                  <th>Quién cerró</th>
                </tr>
              </thead>
              <tbody>
                {lotesDelDia.map((l) => (
                  <tr
                    key={l.id}
                    className="caja-cc-row-clickable"
                    onClick={() => onVerDetalle(l)}
                    title="Ver detalle del cierre"
                  >
                    <td>{l.hora ?? '—'}</td>
                    <td>{cajaNombre(l.origen_slug)}</td>
                    <td className="num">
                      $ {fmtArs((l.arqueo_efectivo || 0) + (l.arqueo_otros || 0))}
                    </td>
                    <td className="num">$ {fmtArs(l.fondo_monto || 0)}</td>
                    <td>{cajaNombre(l.caja_fondo_destino_slug)}</td>
                    <td className="num">$ {fmtArs(l.egresos_aprobados_ef || 0)}</td>
                    <td className="num">
                      $ {fmtArs((l.resto_efectivo || 0) + (l.resto_otros || 0))}
                    </td>
                    <td>{l.usuario_nombre ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3}>
                    <strong>Totales del día</strong>
                  </td>
                  <td className="num">
                    <strong>$ {fmtArs(fondo)}</strong>
                  </td>
                  <td />
                  <td className="num">
                    <strong>$ {fmtArs(egresosEf)}</strong>
                  </td>
                  <td className="num">
                    <strong>$ {fmtArs(resto)}</strong>
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      <div className="caja-cc-card">
        <h3>Estado por caja operativa</h3>
        <p className="caja-cc-help">
          Arqueo y cierre de turno. Si hay arqueo sin cierre, podés registrarlo más abajo.
        </p>
        <ul className="caja-cc-cierre-estado-list">
          {estadoPorCaja.map((e) => {
            const cerrado = e.cierres.length > 0
            const restoCaja = e.cierres.reduce(
              (s, l) => s + (l.resto_efectivo || 0) + (l.resto_otros || 0),
              0
            )
            return (
              <li
                key={e.slug}
                className={`caja-cc-cierre-estado-row${cerrado ? ' is-ok' : e.arqueo ? ' is-warn' : ''}`}
              >
                <div className="caja-cc-cierre-estado-main">
                  <strong>{e.nombre}</strong>
                  <span>
                    Arqueo: {e.arqueo ? `✓ $ ${fmtArs(e.arqueo.total)}` : '—'} · Cierre:{' '}
                    {cerrado
                      ? `✓ $ ${fmtArs(restoCaja)} a admin`
                      : e.arqueo
                        ? 'pendiente'
                        : '—'}
                  </span>
                </div>
                {!cerrado && e.arqueo ? (
                  <button
                    type="button"
                    className="btn-secondary btn-small"
                    onClick={() => onRegistrarCaja(e.slug)}
                  >
                    Registrar cierre
                  </button>
                ) : null}
              </li>
            )
          })}
        </ul>
        {pendientes.length > 0 ? (
          <p className="caja-cc-field-hint">
            {pendientes.length} caja(s) con arqueo sin cierre de turno.
          </p>
        ) : null}
      </div>
    </div>
  )
}

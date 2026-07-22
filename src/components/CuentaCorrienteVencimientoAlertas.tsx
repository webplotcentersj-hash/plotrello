import { Link } from 'react-router-dom'
import type { CcCobranzaVentaItem } from '../types/api'
import { clientesCcPerfil } from '../utils/clientesRoutes'
import {
  resumenAlertasVencimientoCc,
  type CcAlertaVencimientoResumen
} from '../utils/cuentaCorrienteCobranzas'
import { formatMontoArs } from '../utils/cuentaCorrienteLedger'
import './CuentaCorrienteVencimientoAlertas.css'

type Props = {
  items: Array<
    Pick<CcCobranzaVentaItem, 'dias_vencido' | 'monto_pendiente'> &
      Partial<CcCobranzaVentaItem> & { id_cliente?: number; numero_venta?: string; cliente_nombre?: string }
  >
  /** Si true, muestra links a perfil del cliente. */
  conLinks?: boolean
  className?: string
  titulo?: string
}

export default function CuentaCorrienteVencimientoAlertas({
  items,
  conLinks = true,
  className = '',
  titulo = 'Alertas de vencimiento'
}: Props) {
  const resumen: CcAlertaVencimientoResumen = resumenAlertasVencimientoCc(items)
  if (resumen.totalAlertas === 0) return null

  const topVencidas = resumen.vencidas.items.slice(0, 4)
  const topProximas = resumen.porVencer.items.slice(0, 4)

  return (
    <section
      className={`cc-venc-alertas ${className}`.trim()}
      aria-label={titulo}
      role="region"
    >
      <header className="cc-venc-alertas__head">
        <h3>{titulo}</h3>
        <p>
          {resumen.vencidas.count > 0 && (
            <span className="cc-venc-alertas__pill cc-venc-alertas__pill--vencido">
              {resumen.vencidas.count} vencida{resumen.vencidas.count === 1 ? '' : 's'} ·{' '}
              {formatMontoArs(resumen.vencidas.monto)}
            </span>
          )}
          {resumen.porVencer.count > 0 && (
            <span className="cc-venc-alertas__pill cc-venc-alertas__pill--proximo">
              {resumen.porVencer.count} por vencer · {formatMontoArs(resumen.porVencer.monto)}
            </span>
          )}
        </p>
      </header>

      <div className="cc-venc-alertas__cols">
        {topVencidas.length > 0 && (
          <div className="cc-venc-alertas__col">
            <h4>Vencidas</h4>
            <ul>
              {topVencidas.map((it) => (
                <li key={it.id_venta ?? `${it.numero_venta}-${it.id_cliente}`}>
                  {conLinks && it.id_cliente ? (
                    <Link to={clientesCcPerfil(it.id_cliente)}>
                      {it.cliente_nombre || `Cliente #${it.id_cliente}`}
                    </Link>
                  ) : (
                    <strong>{it.cliente_nombre || 'Cliente'}</strong>
                  )}
                  <span>
                    {it.numero_venta || 'Venta'} · {it.dias_vencido}d ·{' '}
                    {formatMontoArs(it.monto_pendiente)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {topProximas.length > 0 && (
          <div className="cc-venc-alertas__col">
            <h4>Por vencer (7 días)</h4>
            <ul>
              {topProximas.map((it) => (
                <li key={it.id_venta ?? `${it.numero_venta}-${it.id_cliente}-p`}>
                  {conLinks && it.id_cliente ? (
                    <Link to={clientesCcPerfil(it.id_cliente)}>
                      {it.cliente_nombre || `Cliente #${it.id_cliente}`}
                    </Link>
                  ) : (
                    <strong>{it.cliente_nombre || 'Cliente'}</strong>
                  )}
                  <span>
                    {it.numero_venta || 'Venta'} · en {Math.abs(it.dias_vencido)}d ·{' '}
                    {formatMontoArs(it.monto_pendiente)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  )
}

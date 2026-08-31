import { useCallback, useEffect, useState } from 'react'
import { Sparkles } from 'lucide-react'
import apiService from '../../services/api'
import type { OportunidadSugerida } from '../../types/api'
import './VentasOportunidadesSugeridas.css'

type Props = {
  onAceptar: (sugerida: OportunidadSugerida) => void
}

function money(n?: number | null): string {
  if (n == null || Number.isNaN(Number(n))) return '—'
  return Number(n).toLocaleString('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0
  })
}

export default function VentasOportunidadesSugeridas({ onAceptar }: Props) {
  const [items, setItems] = useState<OportunidadSugerida[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [collapsed, setCollapsed] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await apiService.sugerirOportunidadesVenta({ diasDormido: 90, limit: 20 })
      if (!res.success) {
        setError(res.error || 'No se pudieron cargar sugerencias')
        setItems([])
      } else {
        setItems(res.data ?? [])
      }
    } catch (e: any) {
      setError(e?.message || 'Error al cargar sugerencias')
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const recompra = items.filter((i) => i.tipo === 'recompra').length
  const chat = items.filter((i) => i.tipo === 'chat').length

  return (
    <section className={`crm-opp-sugeridas${collapsed ? ' is-collapsed' : ''}`}>
      <header className="crm-opp-sugeridas__head">
        <button
          type="button"
          className="crm-opp-sugeridas__toggle"
          onClick={() => setCollapsed((v) => !v)}
          aria-expanded={!collapsed}
        >
          <Sparkles size={18} aria-hidden />
          <div>
            <h3>Sugeridas por el sistema</h3>
            <p>
              {loading
                ? 'Buscando señales…'
                : `${items.length} propuestas · ${recompra} recompra · ${chat} chat`}
            </p>
          </div>
        </button>
        <button type="button" className="crm-opp-sugeridas__refresh" onClick={() => void load()} disabled={loading}>
          Actualizar
        </button>
      </header>

      {!collapsed ? (
        <div className="crm-opp-sugeridas__body">
          {error ? <p className="crm-opp-sugeridas__error">{error}</p> : null}
          {!loading && !error && items.length === 0 ? (
            <p className="crm-opp-sugeridas__empty">
              No hay sugerencias ahora. Aparecen clientes sin compra ~90 días o leads de chat sin oportunidad.
            </p>
          ) : null}
          <ul className="crm-opp-sugeridas__list">
            {items.map((s, idx) => (
              <li key={`${s.tipo}-${s.id_cliente ?? s.id_atencion_conversacion ?? idx}`} className="crm-opp-sugeridas__item">
                <div className="crm-opp-sugeridas__meta">
                  <span className={`crm-opp-sugeridas__tipo crm-opp-sugeridas__tipo--${s.tipo}`}>
                    {s.tipo === 'recompra' ? 'Recompra' : s.tipo === 'chat' ? 'Chat' : s.tipo}
                  </span>
                  {s.dias_sin_compra != null ? (
                    <span className="crm-opp-sugeridas__dias">{s.dias_sin_compra} días sin compra</span>
                  ) : null}
                  {s.ultima_op_numero ? <span className="crm-opp-sugeridas__op">OP {s.ultima_op_numero}</span> : null}
                  {s.ultima_venta_monto != null ? (
                    <span className="crm-opp-sugeridas__monto">{money(s.ultima_venta_monto)}</span>
                  ) : null}
                </div>
                <strong>{s.cliente_nombre}</strong>
                <p>{s.motivo}</p>
                <button type="button" className="crm-opp-sugeridas__aceptar" onClick={() => onAceptar(s)}>
                  Crear oportunidad
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  )
}

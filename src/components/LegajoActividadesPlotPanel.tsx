import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import {
  buildOpsDelDia,
  formatHorarioNota,
  listarNotasLegajoOperario
} from '../features/work-pool/workPoolOperarioNotas'
import type { WorkPoolNotaLegajo } from '../features/work-pool/workPoolOperarioNotas'
import { getArgentinaDateString, isoToArgentinaDateKey } from '../utils/dateUtils'
import './LegajoActividadesPlotPanel.css'

const TIPO_LABEL: Record<string, string> = {
  bitacora: 'Bitácora',
  checklist: 'Checklist',
  anotador: 'Anotador'
}

type Props = {
  idUsuario: number
}

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString('es-AR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch {
    return iso
  }
}

export default function LegajoActividadesPlotPanel({ idUsuario }: Props) {
  const { usuario } = useAuth()
  const [items, setItems] = useState<WorkPoolNotaLegajo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!usuario?.id) return
    let cancelled = false
    setLoading(true)
    void listarNotasLegajoOperario({ id_actor: usuario.id, id_usuario: idUsuario, limit: 60 }).then(
      (res) => {
        if (cancelled) return
        setLoading(false)
        if (!res.success) {
          setError(res.error || 'No se pudo cargar')
          setItems([])
          return
        }
        setError('')
        setItems(res.data ?? [])
      }
    )
    return () => {
      cancelled = true
    }
  }, [usuario?.id, idUsuario])

  const hoy = getArgentinaDateString()
  const opsHoy = useMemo(
    () =>
      buildOpsDelDia(
        items.filter((n) => isoToArgentinaDateKey(n.created_at) === hoy)
      ),
    [items, hoy]
  )

  if (loading) return <p className="legajo-act-plot--muted">Cargando actividades Plot…</p>
  if (error) return <p className="legajo-act-plot__error">{error}</p>
  if (items.length === 0) {
    return (
      <p className="legajo-act-plot--muted">
        Todavía no hay bitácora, checklist ni anotador registrados en Plot Lab.
      </p>
    )
  }

  return (
    <div className="legajo-act-plot">
      <div className="legajo-act-plot__head">
        <p>Registro automático desde el anotador de operarios (bitácora, checklist, anotador).</p>
        <Link to="/actividades-operarios" className="legajo-act-plot__link">
          Panel de supervisión →
        </Link>
      </div>
      {opsHoy.length > 0 ? (
        <div className="legajo-act-plot__ops-hoy">
          <p className="legajo-act-plot__ops-title">OPs de hoy</p>
          <ul>
            {opsHoy.map((op) => (
              <li key={op.key}>
                <strong>{op.label}</strong>
                <span>
                  {op.entradas} {op.entradas === 1 ? 'entrada' : 'entradas'}
                  {op.horario ? ` · ${op.horario}` : ''}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <ul className="legajo-act-plot__list">
        {items.map((n) => (
          <li key={n.id}>
            <div className="legajo-act-plot__meta">
              <span className={`legajo-act-plot__tipo legajo-act-plot__tipo--${n.tipo}`}>
                {TIPO_LABEL[n.tipo] || n.tipo}
              </span>
              <span>{formatWhen(n.created_at)}</span>
              {formatHorarioNota(n.hora_inicio, n.hora_fin) ? (
                <span>{formatHorarioNota(n.hora_inicio, n.hora_fin)}</span>
              ) : null}
              {n.hecho ? <span className="legajo-act-plot__hecho">Hecho</span> : null}
            </div>
            <p>{n.titulo || n.detalle}</p>
            {n.titulo && n.detalle && n.titulo !== n.detalle ? <small>{n.detalle}</small> : null}
            <div className="legajo-act-plot__refs">
              {n.numero_op ? <span>OP {n.numero_op}</span> : null}
              {n.numero_venta ? <span>Venta {n.numero_venta}</span> : null}
              {n.job_titulo ? <span>{n.job_titulo}</span> : null}
            </div>
            {n.adjuntos.length > 0 ? (
              <ul className="legajo-act-plot__adj">
                {n.adjuntos.map((a) => (
                  <li key={a.url}>
                    <a href={a.url} target="_blank" rel="noopener noreferrer">
                      {a.nombre}
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  )
}

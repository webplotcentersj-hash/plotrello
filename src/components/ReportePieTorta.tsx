import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'

export type ReportePieSlice = {
  name: string
  value: number
  color: string
}

const COLORS = {
  completadas: '#10b981',
  enProceso: '#f59e0b',
  pendientes: '#64748b',
} as const

/** Arma slices Completadas / En proceso / Pendientes para filas de estadísticas de órdenes. */
export function pieOrdenesPorEstado(row: {
  total_ordenes?: number | null
  ordenes_completadas?: number | null
  ordenes_en_proceso?: number | null
  ordenes_pendientes?: number | null
}): ReportePieSlice[] {
  const c = Number(row.ordenes_completadas) || 0
  const p = Number(row.ordenes_en_proceso) || 0
  const total = Number(row.total_ordenes) || 0
  const pend =
    row.ordenes_pendientes != null
      ? Number(row.ordenes_pendientes) || 0
      : Math.max(0, total - c - p)

  return [
    { name: 'Completadas', value: c, color: COLORS.completadas },
    { name: 'En proceso', value: p, color: COLORS.enProceso },
    { name: 'Pendientes', value: pend, color: COLORS.pendientes },
  ]
}

export function agregarPieOrdenesUsuarios(usuarios: Array<Record<string, unknown>>): ReportePieSlice[] {
  let c = 0
  let p = 0
  let pend = 0
  for (const u of usuarios) {
    const slices = pieOrdenesPorEstado({
      total_ordenes: u.total_ordenes as number | null | undefined,
      ordenes_completadas: u.ordenes_completadas as number | null | undefined,
      ordenes_en_proceso: u.ordenes_en_proceso as number | null | undefined,
      ordenes_pendientes: u.ordenes_pendientes as number | null | undefined,
    })
    c += slices[0].value
    p += slices[1].value
    pend += slices[2].value
  }
  return [
    { name: 'Completadas', value: c, color: COLORS.completadas },
    { name: 'En proceso', value: p, color: COLORS.enProceso },
    { name: 'Pendientes', value: pend, color: COLORS.pendientes },
  ]
}

type ReportePieTortaProps = {
  data: ReportePieSlice[]
  title?: string
  /** Altura del contenedor responsive (px) */
  height?: number
  outerRadius?: number
  className?: string
  compact?: boolean
}

export function ReportePieTorta({
  data,
  title,
  height = 240,
  outerRadius = 88,
  className = '',
  compact = false,
}: ReportePieTortaProps) {
  const filtered = data.filter((d) => d.value > 0)
  const total = filtered.reduce((s, d) => s + d.value, 0)

  if (total <= 0) {
    return (
      <div className={`rrhh-reporte-pie rrhh-reporte-pie--empty ${className}`.trim()}>
        {title && <p className="rrhh-reporte-pie-title">{title}</p>}
        <p className="rrhh-reporte-pie-empty-msg">Sin órdenes para graficar en este período.</p>
      </div>
    )
  }

  const r = compact ? Math.min(outerRadius, 62) : outerRadius
  const h = compact ? Math.min(height, 200) : height

  return (
    <div className={`rrhh-reporte-pie ${compact ? 'rrhh-reporte-pie--compact' : ''} ${className}`.trim()}>
      {title && <p className="rrhh-reporte-pie-title">{title}</p>}
      <ResponsiveContainer width="100%" height={h}>
        <PieChart margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
          <Pie
            data={filtered}
            cx="50%"
            cy="50%"
            dataKey="value"
            nameKey="name"
            outerRadius={r}
            innerRadius={compact ? 0 : 0}
            paddingAngle={1}
            stroke="rgba(255,255,255,0.14)"
            strokeWidth={1}
            labelLine={false}
            label={({ name, percent }) =>
              (percent ?? 0) >= 0.06 ? `${name} ${((percent ?? 0) * 100).toFixed(0)}%` : ''
            }
          >
            {filtered.map((entry, index) => (
              <Cell key={`cell-${entry.name}-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number | string) => [value, 'Órdenes']}
            contentStyle={{
              background: 'rgba(15, 23, 42, 0.96)',
              border: '1px solid rgba(255,255,255,0.14)',
              borderRadius: 8,
              color: '#f1f5f9',
            }}
            labelStyle={{ color: '#e2e8f0' }}
          />
          <Legend
            wrapperStyle={{ paddingTop: 8 }}
            formatter={(value) => <span style={{ color: 'var(--text-primary, #e2e8f0)' }}>{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}

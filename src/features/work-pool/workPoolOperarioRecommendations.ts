import type { UsuarioRecord } from '../../types/api'
import type { WorkPoolJob, WorkPoolSector } from '../../types/workPool'
import {
  classifyWorkPoolTask,
  WORK_POOL_TASK_CATEGORY_LABELS,
  type WorkPoolTaskCategory
} from './workPoolTaskClassifier'

export type WorkPoolOperarioRecommendation = {
  id_usuario: number
  nombre: string
  score: number
  rank: number
  matchPercent: number
  reasons: string[]
  badges: string[]
  stats: {
    categoria_detectada: string
    mes_similares: number
    mes_total: number
    mes_anterior_similares: number
    segundo_mes_similares: number
    entrega_promedio_dias: number | null
    entrega_rapida_pct: number
    aprobados_mes: number
    activos: number
    tendencia: 'subiendo' | 'estable' | 'bajando'
  }
}

export type OrdenDisenoHistorial = {
  descripcion: string | null
  operario_asignado: string | null
  fecha_creacion: string | null
  fecha_entrega: string | null
  etiquetas: unknown
}

type OperarioAccumulator = {
  id_usuario: number
  nombre: string
  mes_total: number
  mes_similares: number
  mes_anterior_similares: number
  aprobados_mes: number
  activos: number
  entrega_horas: number[]
  entregas_rapidas: number
  entregas_total: number
}

function isCurrentMonth(iso: string | null): boolean {
  if (!iso) return false
  const d = new Date(iso)
  const now = new Date()
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
}

function isPreviousMonth(iso: string | null): boolean {
  if (!iso) return false
  const d = new Date(iso)
  const now = new Date()
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  return d.getFullYear() === prev.getFullYear() && d.getMonth() === prev.getMonth()
}

function hoursBetween(from: string | null, to: string | null): number | null {
  if (!from || !to) return null
  const a = new Date(from).getTime()
  const b = new Date(to).getTime()
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return null
  return (b - a) / 3_600_000
}

function daysBetween(from: string | null, to: string | null): number | null {
  const h = hoursBetween(from, to)
  return h == null ? null : h / 24
}

function normalizeName(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function resolveUsuarioId(
  operarioRef: string | null | undefined,
  candidatos: UsuarioRecord[]
): number | null {
  const raw = (operarioRef ?? '').trim()
  if (!raw) return null
  if (/^\d+$/.test(raw)) {
    const id = Number(raw)
    return candidatos.some((u) => u.id === id) ? id : null
  }
  const norm = normalizeName(raw)
  const exact = candidatos.find((u) => normalizeName(u.nombre) === norm)
  if (exact) return exact.id
  const partial = candidatos.find(
    (u) => normalizeName(u.nombre).includes(norm) || norm.includes(normalizeName(u.nombre))
  )
  return partial?.id ?? null
}

function jobCategory(job: WorkPoolJob): WorkPoolTaskCategory {
  return classifyWorkPoolTask(job.descripcion, job.codigo_tarifa, job.titulo)
}

function ordenCategory(orden: OrdenDisenoHistorial): WorkPoolTaskCategory {
  const tags = Array.isArray(orden.etiquetas) ? orden.etiquetas.join(' ') : ''
  return classifyWorkPoolTask(`${orden.descripcion ?? ''} ${tags}`, null, null)
}

function ensureAcc(
  map: Map<number, OperarioAccumulator>,
  id: number,
  nombre: string
): OperarioAccumulator {
  let a = map.get(id)
  if (!a) {
    a = {
      id_usuario: id,
      nombre,
      mes_total: 0,
      mes_similares: 0,
      mes_anterior_similares: 0,
      aprobados_mes: 0,
      activos: 0,
      entrega_horas: [],
      entregas_rapidas: 0,
      entregas_total: 0
    }
    map.set(id, a)
  }
  return a
}

function ingestJobStats(
  acc: OperarioAccumulator,
  job: WorkPoolJob,
  targetCategory: WorkPoolTaskCategory
) {
  const cat = jobCategory(job)
  const ref = job.aprobado_at ?? job.entregado_at ?? job.tomado_at ?? job.created_at

  if (isCurrentMonth(ref)) {
    acc.mes_total += 1
    if (targetCategory === 'general' || cat === targetCategory) acc.mes_similares += 1
  }
  if (isPreviousMonth(ref) && (targetCategory === 'general' || cat === targetCategory)) {
    acc.mes_anterior_similares += 1
  }
  if (job.estado === 'aprobado' && isCurrentMonth(job.aprobado_at)) {
    acc.aprobados_mes += 1
  }
  if (['asignado', 'en_curso', 'cambios'].includes(job.estado)) {
    acc.activos += 1
  }

  const start = job.tomado_at ?? job.created_at
  const end = job.entregado_at ?? job.aprobado_at
  const hrs = hoursBetween(start, end)
  if (hrs != null && (targetCategory === 'general' || cat === targetCategory)) {
    acc.entrega_horas.push(hrs)
    acc.entregas_total += 1
    if (hrs <= 48) acc.entregas_rapidas += 1
  }
}

function ingestOrdenStats(
  acc: OperarioAccumulator,
  orden: OrdenDisenoHistorial,
  targetCategory: WorkPoolTaskCategory
) {
  const cat = ordenCategory(orden)
  const ref = orden.fecha_entrega ?? orden.fecha_creacion
  const similar = targetCategory === 'general' || cat === targetCategory

  if (isCurrentMonth(ref)) {
    acc.mes_total += 1
    if (similar) acc.mes_similares += 1
  }
  if (isPreviousMonth(ref) && similar) {
    acc.mes_anterior_similares += 1
  }

  const dias = daysBetween(orden.fecha_creacion, orden.fecha_entrega)
  if (dias != null && similar && isCurrentMonth(ref)) {
    acc.entrega_horas.push(dias * 24)
    acc.entregas_total += 1
    if (dias <= 3) acc.entregas_rapidas += 1
  }
}

export function buildWorkPoolOperarioRecommendations(input: {
  candidatos: UsuarioRecord[]
  jobs: WorkPoolJob[]
  ordenesDiseno?: OrdenDisenoHistorial[]
  descripcion?: string
  codigoTarifa?: string | null
  sector: WorkPoolSector
}): WorkPoolOperarioRecommendation[] {
  const targetCategory = classifyWorkPoolTask(
    input.descripcion,
    input.codigoTarifa ?? null,
    input.descripcion?.slice(0, 80)
  )
  const categoriaLabel = WORK_POOL_TASK_CATEGORY_LABELS[targetCategory]

  const map = new Map<number, OperarioAccumulator>()
  for (const u of input.candidatos) {
    ensureAcc(map, u.id, u.nombre)
  }

  for (const job of input.jobs) {
    if (job.sector !== input.sector || !job.id_usuario_asignado) continue
    const acc = map.get(job.id_usuario_asignado)
    if (!acc) continue
    ingestJobStats(acc, job, targetCategory)
  }

  for (const orden of input.ordenesDiseno ?? []) {
    const uid = resolveUsuarioId(orden.operario_asignado, input.candidatos)
    if (!uid) continue
    const acc = ensureAcc(map, uid, input.candidatos.find((u) => u.id === uid)?.nombre ?? '')
    ingestOrdenStats(acc, orden, targetCategory)
  }

  const accList = [...map.values()]
  const maxSimilares = Math.max(1, ...accList.map((a) => a.mes_similares))
  const sortedSimilares = [...accList].sort((a, b) => b.mes_similares - a.mes_similares)
  const segundoSimilares = sortedSimilares[1]?.mes_similares ?? 0

  const ranked = accList
    .map((acc) => {
      const avgH =
        acc.entrega_horas.length > 0
          ? acc.entrega_horas.reduce((s, h) => s + h, 0) / acc.entrega_horas.length
          : null
      const avgDias = avgH != null ? avgH / 24 : null
      const rapidaPct =
        acc.entregas_total > 0 ? Math.round((acc.entregas_rapidas / acc.entregas_total) * 100) : 0

      let score = 0
      score += (acc.mes_similares / maxSimilares) * 45
      score += Math.min(acc.mes_total, 20) * 1.2
      score += acc.aprobados_mes * 3
      if (avgH != null) score += Math.max(0, 22 - avgH / 5)
      score += rapidaPct * 0.15
      score -= acc.activos * 4
      if (acc.mes_anterior_similares > 0 && acc.mes_similares > acc.mes_anterior_similares) {
        score += 8
      }

      const tendencia: 'subiendo' | 'estable' | 'bajando' =
        acc.mes_similares > acc.mes_anterior_similares
          ? 'subiendo'
          : acc.mes_similares < acc.mes_anterior_similares
            ? 'bajando'
            : 'estable'

      const reasons: string[] = []
      if (acc.mes_similares > 0) {
        if (acc.mes_similares >= segundoSimilares && acc.mes_similares === maxSimilares) {
          reasons.push(
            `Líder en ${categoriaLabel}: ${acc.mes_similares} este mes` +
              (segundoSimilares > 0 ? ` (siguiente: ${segundoSimilares}).` : '.')
          )
        } else {
          reasons.push(`${acc.mes_similares} trabajos de ${categoriaLabel} en el mes.`)
        }
      } else if (acc.mes_total > 0) {
        reasons.push(`${acc.mes_total} trabajos en el mes; poca historia en ${categoriaLabel}.`)
      } else {
        reasons.push('Sin trabajos recientes en bolsa — buen candidato si está disponible.')
      }

      if (avgDias != null) {
        reasons.push(
          avgDias <= 2
            ? `Entrega rápida: ~${avgDias.toFixed(1)} días de promedio en trabajos similares.`
            : `Ritmo ~${avgDias.toFixed(1)} días en trabajos similares.`
        )
      }
      if (rapidaPct >= 60 && acc.entregas_total >= 2) {
        reasons.push(`${rapidaPct}% de entregas express en este tipo de trabajo.`)
      }
      if (tendencia === 'subiendo') {
        reasons.push('Ranking en alza respecto al mes anterior.')
      }
      if (acc.activos >= 3) {
        reasons.push(`Carga alta: ${acc.activos} trabajos activos ahora.`)
        score -= 5
      }

      const badges: string[] = []
      if (acc.mes_similares >= maxSimilares && acc.mes_similares > 0) badges.push('Top afinidad')
      if (rapidaPct >= 70) badges.push('Express')
      if (acc.aprobados_mes >= 5) badges.push('Alta producción')
      if (tendencia === 'subiendo') badges.push('En racha')

      const matchPercent = Math.min(
        99,
        Math.round(
          (acc.mes_similares / maxSimilares) * 55 +
            (avgH != null ? Math.max(0, 25 - avgH / 8) : 10) +
            rapidaPct * 0.2 +
            (tendencia === 'subiendo' ? 8 : 0)
        )
      )

      return {
        id_usuario: acc.id_usuario,
        nombre: acc.nombre,
        score,
        rank: 0,
        matchPercent,
        reasons: reasons.slice(0, 3),
        badges,
        stats: {
          categoria_detectada: categoriaLabel,
          mes_similares: acc.mes_similares,
          mes_total: acc.mes_total,
          mes_anterior_similares: acc.mes_anterior_similares,
          segundo_mes_similares: segundoSimilares,
          entrega_promedio_dias: avgDias,
          entrega_rapida_pct: rapidaPct,
          aprobados_mes: acc.aprobados_mes,
          activos: acc.activos,
          tendencia
        }
      }
    })
    .sort((a, b) => b.score - a.score)
    .map((r, i) => ({ ...r, rank: i + 1 }))

  return ranked
}

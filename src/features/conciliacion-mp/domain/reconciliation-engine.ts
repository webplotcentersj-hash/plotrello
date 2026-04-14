import type {
  HeuristicMatch,
  HeuristicMatchType,
  NormalizedMovement,
  ReconciliationMetrics,
  ReconciliationRules
} from './types'

function day(iso: string): string {
  return iso.slice(0, 10)
}

function absCents(n: number): number {
  return Math.round(Math.abs(n) * 100)
}

function sign(n: number): 1 | -1 | 0 {
  if (n > 1e-9) return 1
  if (n < -1e-9) return -1
  return 0
}

function withinTol(a: number, b: number, rules: ReconciliationRules): boolean {
  const diff = Math.abs(a - b)
  return diff <= rules.tolAmountAbs + rules.tolAmountPct * Math.max(Math.abs(a), Math.abs(b))
}

function daysBetween(aIso: string, bIso: string): number {
  const a = new Date(day(aIso)).getTime()
  const b = new Date(day(bIso)).getTime()
  return Math.round(Math.abs(a - b) / (86400 * 1000))
}

function tokenize(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .split(/[^a-z0-9]+/g)
      .filter((x) => x.length > 2)
  )
}

function jaccard(a: string, b: string): number {
  const A = tokenize(a)
  const B = tokenize(b)
  if (A.size === 0 && B.size === 0) return 0
  let inter = 0
  for (const t of A) if (B.has(t)) inter++
  const union = A.size + B.size - inter
  return union === 0 ? 0 : inter / union
}

function refOverlap(a?: string, b?: string): number {
  if (!a || !b) return 0
  const na = a.replace(/\W/g, '').toLowerCase()
  const nb = b.replace(/\W/g, '').toLowerCase()
  if (na.length < 4 || nb.length < 4) return 0
  if (na.includes(nb) || nb.includes(na)) return 1
  return 0
}

/** Subconjuntos (índices) con al menos 2 elementos cuya suma ≈ target. Limitado por maxSize y maxIterations. */
function findSubsetSums(
  values: number[],
  target: number,
  rules: ReconciliationRules,
  maxSize: number,
  maxIterations: number
): number[][] {
  const results: number[][] = []
  const n = values.length
  let iter = 0

  function dfs(start: number, depth: number, sum: number, path: number[]) {
    if (iter > maxIterations) return
    iter++
    if (path.length >= 2 && withinTol(sum, target, rules)) {
      results.push([...path])
      return
    }
    if (path.length >= maxSize || start >= n) return
    for (let i = start; i < n; i++) {
      path.push(i)
      dfs(i + 1, depth + 1, sum + values[i], path)
      path.pop()
    }
  }

  dfs(0, 0, 0, [])
  return results
}

export function runReconciliation(
  bank: NormalizedMovement[],
  mp: NormalizedMovement[],
  rules: ReconciliationRules
): { matches: HeuristicMatch[]; metrics: ReconciliationMetrics } {
  const matches: HeuristicMatch[] = []
  const usedBank = new Set<string>()
  const usedMp = new Set<string>()

  const tryPair = (
    b: NormalizedMovement,
    m: NormalizedMovement,
    phase: number,
    matchType: HeuristicMatchType,
    score: number,
    reason: string
  ): boolean => {
    if (usedBank.has(b.id) || usedMp.has(m.id)) return false
    usedBank.add(b.id)
    usedMp.add(m.id)
    matches.push({
      bankIds: [b.id],
      mpIds: [m.id],
      matchType,
      score,
      phase,
      reason,
      diffAmount: Math.abs(b.importeNeto - m.importeNeto)
    })
    return true
  }

  // Fase 1: misma fecha + importe (centavos) + signo
  const keyExact = (x: NormalizedMovement) => `${day(x.fecha)}|${sign(x.importeNeto)}|${absCents(x.importeNeto)}`
  const mpBuckets = new Map<string, NormalizedMovement[]>()
  for (const m of mp) {
    const k = keyExact(m)
    if (!mpBuckets.has(k)) mpBuckets.set(k, [])
    mpBuckets.get(k)!.push(m)
  }
  for (const b of bank) {
    if (usedBank.has(b.id)) continue
    const list = mpBuckets.get(keyExact(b))?.filter((m) => !usedMp.has(m.id)) ?? []
    const m = list[0]
    if (m) tryPair(b, m, 1, 'exact', 100, 'Fase 1: misma fecha, signo e importe idéntico (centavos)')
  }

  // Fase 2: ventana de fechas + importe exacto (centavos) + signo
  for (const b of bank) {
    if (usedBank.has(b.id)) continue
    let best: NormalizedMovement | null = null
    let bestD = 999
    for (const m of mp) {
      if (usedMp.has(m.id)) continue
      if (sign(b.importeNeto) !== sign(m.importeNeto)) continue
      if (absCents(b.importeNeto) !== absCents(m.importeNeto)) continue
      const d = daysBetween(b.fecha, m.fecha)
      if (d <= rules.dateWindowDays && d < bestD) {
        bestD = d
        best = m
      }
    }
    if (best) {
      const score = Math.max(92, 99 - bestD)
      tryPair(b, best, 2, 'approximate_date', score, `Fase 2: importe exacto, fecha ±${bestD} día(s)`)
    }
  }

  // Fase 3: texto + importe exacto + signo + misma fecha o ventana 1 día
  for (const b of bank) {
    if (usedBank.has(b.id)) continue
    let best: NormalizedMovement | null = null
    let bestJ = 0
    for (const m of mp) {
      if (usedMp.has(m.id)) continue
      if (sign(b.importeNeto) !== sign(m.importeNeto)) continue
      if (absCents(b.importeNeto) !== absCents(m.importeNeto)) continue
      if (daysBetween(b.fecha, m.fecha) > Math.min(1, rules.dateWindowDays)) continue
      const j = jaccard(b.descripcion, m.descripcion)
      if (j > bestJ) {
        bestJ = j
        best = m
      }
    }
    if (best && bestJ >= 0.15) {
      const score = Math.round(80 + Math.min(15, bestJ * 30))
      tryPair(b, best, 3, 'text_amount', score, `Fase 3: importe exacto y similitud de texto ${(bestJ * 100).toFixed(0)}%`)
    }
  }

  // Fase 4: tolerancia de monto + fecha en ventana
  for (const b of bank) {
    if (usedBank.has(b.id)) continue
    let best: NormalizedMovement | null = null
    let bestScore = 0
    for (const m of mp) {
      if (usedMp.has(m.id)) continue
      if (sign(b.importeNeto) !== sign(m.importeNeto)) continue
      if (daysBetween(b.fecha, m.fecha) > rules.dateWindowDays) continue
      if (!withinTol(b.importeNeto, m.importeNeto, rules)) continue
      const j = jaccard(b.descripcion, m.descripcion)
      const ds = Math.max(0, 25 - daysBetween(b.fecha, m.fecha) * 8)
      const score = Math.round(
        rules.weightAmount * 40 +
          rules.weightDate * ds +
          rules.weightText * j * 100 +
          rules.weightRef * refOverlap(b.referencia, m.referencia) * 100
      )
      if (score > bestScore) {
        bestScore = score
        best = m
      }
    }
    if (best && bestScore >= rules.minScoreAccept) {
      tryPair(b, best, 4, 'tolerance_amount', bestScore, `Fase 4: montos dentro de tolerancia, score ${bestScore}`)
    }
  }

  // Fase 5: referencia + monto tolerancia
  for (const b of bank) {
    if (usedBank.has(b.id)) continue
    if (!b.referencia) continue
    let best: NormalizedMovement | null = null
    let bestScore = 0
    for (const m of mp) {
      if (usedMp.has(m.id)) continue
      if (!m.referencia) continue
      if (refOverlap(b.referencia, m.referencia) < 1) continue
      if (daysBetween(b.fecha, m.fecha) > rules.dateWindowDays + 2) continue
      if (!withinTol(b.importeNeto, m.importeNeto, rules)) continue
      const score = 75
      if (score > bestScore) {
        bestScore = score
        best = m
      }
    }
    if (best) tryPair(b, best, 5, 'reference', bestScore, 'Fase 5: referencia compatible y monto en tolerancia')
  }

  // Fase 6: agrupación N MP -> 1 banco (misma ventana de fecha respecto al banco)
  for (const b of bank) {
    if (usedBank.has(b.id)) continue
    const candidates = mp
      .map((m, idx) => ({ m, idx }))
      .filter(({ m }) => !usedMp.has(m.id))
      .filter(({ m }) => daysBetween(b.fecha, m.fecha) <= rules.dateWindowDays)
      .filter(({ m }) => sign(m.importeNeto) === sign(b.importeNeto))
      .slice(0, 40)

    if (candidates.length < 2) continue

    const values = candidates.map((c) => c.m.importeNeto)
    const subsets = findSubsetSums(values, b.importeNeto, rules, rules.maxGroupSize, 4000)
    if (subsets.length === 0) continue

    const chosen = subsets.sort((a, b) => a.length - b.length)[0]
    const mpIds = chosen.map((i) => candidates[i].m.id)
    const sum = chosen.reduce((s, i) => s + candidates[i].m.importeNeto, 0)
    for (const id of mpIds) usedMp.add(id)
    usedBank.add(b.id)
    const diff = Math.abs(sum - b.importeNeto)
    matches.push({
      bankIds: [b.id],
      mpIds,
      matchType: 'grouped_bank_to_mp',
      phase: 6,
      score: Math.max(60, 85 - chosen.length * 5 - Math.min(20, diff * 100)),
      reason: `Fase 6: ${mpIds.length} movimientos MP suman el importe del banco (diff ${diff.toFixed(2)})`,
      diffAmount: diff
    })
  }

  const matchedBank = new Set<string>()
  const matchedMp = new Set<string>()
  for (const x of matches) {
    x.bankIds.forEach((id) => matchedBank.add(id))
    x.mpIds.forEach((id) => matchedMp.add(id))
  }

  const sumBankAbs = bank.reduce((s, x) => s + Math.abs(x.importeNeto), 0)
  const sumMpAbs = mp.reduce((s, x) => s + Math.abs(x.importeNeto), 0)
  const grouped = matches.filter((m) => m.matchType === 'grouped_bank_to_mp').length

  const metrics: ReconciliationMetrics = {
    totalBank: bank.length,
    totalMp: mp.length,
    matchedBankCount: matchedBank.size,
    matchedMpCount: matchedMp.size,
    pctBankReconciled: bank.length ? Math.round((matchedBank.size / bank.length) * 1000) / 10 : 0,
    pctMpReconciled: mp.length ? Math.round((matchedMp.size / mp.length) * 1000) / 10 : 0,
    sumBankAbs,
    sumMpAbs,
    groupedMatches: grouped
  }

  return { matches, metrics }
}

/** Métricas a partir de cualquier lista de matches (motor + manuales). */
export function computeMetrics(
  bank: NormalizedMovement[],
  mp: NormalizedMovement[],
  matches: HeuristicMatch[]
): ReconciliationMetrics {
  const matchedBank = new Set<string>()
  const matchedMp = new Set<string>()
  for (const x of matches) {
    x.bankIds.forEach((id) => matchedBank.add(id))
    x.mpIds.forEach((id) => matchedMp.add(id))
  }
  const sumBankAbs = bank.reduce((s, x) => s + Math.abs(x.importeNeto), 0)
  const sumMpAbs = mp.reduce((s, x) => s + Math.abs(x.importeNeto), 0)
  const grouped = matches.filter((m) => m.matchType === 'grouped_bank_to_mp').length

  return {
    totalBank: bank.length,
    totalMp: mp.length,
    matchedBankCount: matchedBank.size,
    matchedMpCount: matchedMp.size,
    pctBankReconciled: bank.length ? Math.round((matchedBank.size / bank.length) * 1000) / 10 : 0,
    pctMpReconciled: mp.length ? Math.round((matchedMp.size / mp.length) * 1000) / 10 : 0,
    sumBankAbs,
    sumMpAbs,
    groupedMatches: grouped
  }
}

export interface MpCandidateScore {
  mp: NormalizedMovement
  score: number
  reason: string
}

/** Candidatos MP para un movimiento banco (revisión manual); excluye MP ya emparejados. */
export function suggestMpCandidatesForBank(
  bank: NormalizedMovement,
  mpList: NormalizedMovement[],
  alreadyMatchedMp: Set<string>,
  rules: ReconciliationRules,
  limit = 35
): MpCandidateScore[] {
  const out: MpCandidateScore[] = []
  for (const m of mpList) {
    if (alreadyMatchedMp.has(m.id)) continue
    if (sign(bank.importeNeto) !== sign(m.importeNeto)) continue

    const d = daysBetween(bank.fecha, m.fecha)
    if (d > Math.max(rules.dateWindowDays + 7, 14)) continue

    const diffAmt = Math.abs(bank.importeNeto - m.importeNeto)
    const amtScore = withinTol(bank.importeNeto, m.importeNeto, rules)
      ? 42
      : Math.max(0, 40 - (diffAmt / Math.max(1, Math.abs(bank.importeNeto))) * 35)

    const dateScore = Math.max(0, 28 - d * 6)
    const j = jaccard(bank.descripcion, m.descripcion)
    const textScore = j * 22
    const refScore = refOverlap(bank.referencia, m.referencia) * 12

    const score = Math.round(amtScore + dateScore + textScore + refScore)
    if (score < 12) continue

    out.push({
      mp: m,
      score,
      reason: `Δ ${d} días · Δ$${diffAmt.toFixed(2)} · similitud texto ${(j * 100).toFixed(0)}%`
    })
  }
  return out.sort((a, b) => b.score - a.score).slice(0, limit)
}

export function summarizeUnmatched(
  bank: NormalizedMovement[],
  mp: NormalizedMovement[],
  matches: HeuristicMatch[]
): { unmatchedBank: NormalizedMovement[]; unmatchedMp: NormalizedMovement[] } {
  const mb = new Set<string>()
  const mm = new Set<string>()
  for (const m of matches) {
    m.bankIds.forEach((id) => mb.add(id))
    m.mpIds.forEach((id) => mm.add(id))
  }
  return {
    unmatchedBank: bank.filter((b) => !mb.has(b.id)),
    unmatchedMp: mp.filter((m) => !mm.has(m.id))
  }
}

/** Serialización estable para UI / Gemini */
export function movementToBrief(m: NormalizedMovement) {
  return {
    id: m.id,
    fecha: day(m.fecha),
    importeNeto: m.importeNeto,
    descripcion: m.descripcion.slice(0, 200),
    tipo: m.tipo,
    classification: m.classification,
    referencia: m.referencia ?? ''
  }
}

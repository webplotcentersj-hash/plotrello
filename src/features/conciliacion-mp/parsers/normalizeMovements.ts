import type { MovementSource, NormalizedMovement } from '../domain/types'
import { pickFirstKey, toNumber, safeParseDateToISO, stripAccents } from './spreadsheetCore'

function norm(s: string): string {
  return stripAccents(s.toLowerCase().trim())
}

function isSaldoLikeRow(detalle: string, tipo: string): boolean {
  const t = `${norm(detalle)} ${norm(tipo)}`
  return (
    /\bsaldo\s+inicial\b/.test(t) ||
    /\bsaldo\s+final\b/.test(t) ||
    /\btotal\b/.test(t) && /\bsaldo\b/.test(t) ||
    /^saldo$/i.test(detalle.trim())
  )
}

function classifyBank(detalle: string, tipo: string): string {
  const u = `${norm(detalle)} ${norm(tipo)}`
  if (/\bpav\b/.test(u)) return 'PAV'
  if (/\bpac\b/.test(u)) return 'PAC'
  if (/\bingreso|acredit|credito\b/.test(u)) return 'ingreso'
  if (/\begreso|debit|débito\b/.test(u)) return 'egreso'
  if (/\btransfer/.test(u)) return 'transferencia'
  return 'otro'
}

function classifyMp(detalle: string, tipo: string): string {
  const u = `${norm(detalle)} ${norm(tipo)}`
  if (/\bimpuesto\b/.test(u)) return 'impuesto'
  if (/\bretenc/.test(u)) return 'retencion'
  if (/\bcosto|comisi/.test(u)) return 'costo'
  if (/\bcobro\b/.test(u)) return 'cobro'
  if (/\bpago\b/.test(u)) return 'pago'
  if (/\bretiro\b/.test(u)) return 'retiro'
  if (/\bdevol/.test(u)) return 'devolucion'
  if (/\btransfer/.test(u)) return 'transferencia'
  if (/\binterno|ajuste\b/.test(u)) return 'movimiento_interno'
  return 'otro'
}

function makeId(source: MovementSource, sheet: string, fila: number): string {
  return `${source}:${sheet}:${fila}`
}

export function normalizeBankRows(
  rows: Record<string, any>[],
  sheetName: string,
  excludeSaldo: boolean
): NormalizedMovement[] {
  const out: NormalizedMovement[] = []
  let fila = 0
  for (const r of rows) {
    fila++
    const fechaRaw = pickFirstKey(r, [
      'fecha',
      'fec.',
      'fec',
      'día',
      'dia',
      'date',
      'fecha valor',
      'fecha_valor'
    ])
    const fechaISO = safeParseDateToISO(fechaRaw)
    if (!fechaISO) continue

    const detalle = String(
      pickFirstKey(r, ['detalle', 'descripción', 'descripcion', 'concepto', 'movimiento', 'glosa']) ?? ''
    ).trim()
    const tipoCol = String(pickFirstKey(r, ['tipo', 'tipo de movimiento', 'tipo_movimiento', 'operación', 'operacion']) ?? '').trim()

    if (excludeSaldo && isSaldoLikeRow(detalle, tipoCol)) continue

    const cred = toNumber(
      pickFirstKey(r, [
        'crédito',
        'credito',
        'haber',
        'ingreso',
        'ingresos',
        'acreditaciones',
        'acreditación',
        'cred'
      ])
    )
    const deb = toNumber(
      pickFirstKey(r, [
        'débito',
        'debito',
        'debe',
        'egreso',
        'egresos',
        'débitos',
        'deb'
      ])
    )
    const importeCol = toNumber(
      pickFirstKey(r, ['importe', 'monto', 'total', 'amount', 'importe ($)', 'valor'])
    )

    let importeNeto = 0
    if (importeCol != null && Number.isFinite(importeCol)) {
      importeNeto = importeCol
    } else if (cred != null && deb != null) {
      importeNeto = cred - deb
    } else if (cred != null) {
      importeNeto = cred
    } else if (deb != null) {
      importeNeto = -Math.abs(deb)
    }

    if (!Number.isFinite(importeNeto) || importeNeto === 0) continue

    const ref = String(pickFirstKey(r, ['referencia', 'número', 'numero', 'nro', 'id', 'operación', 'operacion']) ?? '').trim()
    const tercero = String(pickFirstKey(r, ['tercero', 'beneficiario', 'origen']) ?? '').trim()

    const cls = classifyBank(detalle, tipoCol)

    out.push({
      id: makeId('bank', sheetName, fila),
      source: 'bank',
      fecha: fechaISO,
      descripcion: [detalle, tipoCol].filter(Boolean).join(' · ') || '(sin detalle)',
      tipo: tipoCol || cls,
      subtipo: cls,
      tercero: tercero || undefined,
      referencia: ref || undefined,
      importeNeto,
      credito: cred ?? undefined,
      debito: deb ?? undefined,
      moneda: 'ARS',
      classification: cls,
      hojaOriginal: sheetName,
      filaOriginal: fila,
      raw: { ...r }
    })
  }
  return out
}

export function normalizeMercadoPagoRows(rows: Record<string, any>[], sheetName: string): NormalizedMovement[] {
  const out: NormalizedMovement[] = []
  let fila = 0
  for (const r of rows) {
    fila++
    const fechaRaw = pickFirstKey(r, [
      'fecha de pago',
      'fecha del pago',
      'fecha_de_pago',
      'fecha pago',
      'fecha_pago',
      'fecha',
      'date'
    ])
    const fechaISO = safeParseDateToISO(fechaRaw)
    if (!fechaISO) continue

    const detalle = String(pickFirstKey(r, ['detalle', 'descripción', 'descripcion', 'concepto']) ?? '').trim()
    const tipoCol = String(
      pickFirstKey(r, ['tipo de operación', 'tipo de operacion', 'tipo_operación', 'tipo_operacion', 'tipo']) ?? ''
    ).trim()

    const debe = toNumber(pickFirstKey(r, ['debe', 'débito', 'debito', 'egreso']))
    const haber = toNumber(pickFirstKey(r, ['haber', 'crédito', 'credito', 'ingreso']))
    const importeRaw = pickFirstKey(r, ['importe', 'monto', 'total', 'amount']) ?? undefined
    let importe = toNumber(importeRaw)
    if (importe == null) {
      if (debe != null && haber == null) importe = -Math.abs(debe)
      else if (haber != null && debe == null) importe = Math.abs(haber)
      else if (debe != null && haber != null) importe = Math.abs(haber) - Math.abs(debe)
    }
    if (importe == null || !Number.isFinite(importe) || importe === 0) continue

    const ref = String(
      pickFirstKey(r, [
        'numero de movimiento',
        'número de movimiento',
        'operación relacionada',
        'operacion relacionada',
        'referencia',
        'id'
      ]) ?? ''
    ).trim()

    const cls = classifyMp(detalle, tipoCol)

    out.push({
      id: makeId('mercado_pago', sheetName, fila),
      source: 'mercado_pago',
      fecha: fechaISO,
      descripcion: [detalle, tipoCol].filter(Boolean).join(' · ') || '(sin detalle)',
      tipo: tipoCol || cls,
      subtipo: cls,
      referencia: ref || undefined,
      importeNeto: importe,
      credito: haber ?? undefined,
      debito: debe ?? undefined,
      moneda: 'ARS',
      classification: cls,
      hojaOriginal: sheetName,
      filaOriginal: fila,
      raw: { ...r }
    })
  }
  return out
}

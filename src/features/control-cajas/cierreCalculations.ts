import type { CajaCierre, CajaCierreEstado } from './types'

export type CierreFormInput = {
  fondo_fijo: number
  ing_ef: number
  egr_ef: number
  ef_contado: number
  tarj_sist: number
  tarj_fis: number
  mp_qr: number
  trans: number
  cta_cte: number
}

export type CierreCalculado = CierreFormInput & {
  ef_teorico: number
  dif_ef: number
  dif_tarj: number
  total_ventas: number
  dif_total: number
  estado: CajaCierreEstado
}

export function calcularCierre(input: CierreFormInput, tolerancia = 0): CierreCalculado {
  const fondo = input.fondo_fijo || 0
  const ing = input.ing_ef || 0
  const egr = input.egr_ef || 0
  const cont = input.ef_contado || 0
  const ts = input.tarj_sist || 0
  const tf = input.tarj_fis || 0
  const mp = input.mp_qr || 0
  const tr = input.trans || 0
  const cc = input.cta_cte || 0

  const ef_teorico = fondo + ing - egr
  const dif_ef = cont - ef_teorico
  const dif_tarj = tf - ts
  const dif_total = dif_ef + dif_tarj
  const total_ventas = ing + ts + mp + tr + cc
  const estado: CajaCierreEstado = Math.abs(dif_total) <= tolerancia ? 'OK' : 'REVISAR'

  return {
    ...input,
    ef_teorico,
    dif_ef,
    dif_tarj,
    total_ventas,
    dif_total,
    estado
  }
}

type CierreMeta = Pick<
  CajaCierre,
  'fecha' | 'caja_slug' | 'turno' | 'cajera' | 'email_ok' | 'observacion' | 'id_planilla'
>

export function cierreFromCalculado(
  base: CierreMeta,
  calc: CierreCalculado
): Omit<CajaCierre, 'id' | 'created_at'> {
  return {
    ...base,
    ...calc,
    fondo_fijo: calc.fondo_fijo,
    ing_ef: calc.ing_ef,
    egr_ef: calc.egr_ef,
    ef_contado: calc.ef_contado,
    tarj_sist: calc.tarj_sist,
    tarj_fis: calc.tarj_fis,
    mp_qr: calc.mp_qr,
    trans: calc.trans,
    cta_cte: calc.cta_cte
  }
}

import {
  CONCEPTOS_LSD,
  codigoLsdDeCarga,
  cuitDigitos,
  montoExtraEfectivo,
  cuilDigitos,
  fechaCortaEs,
  liquidarRecibo,
  round2,
  type ReciboLiquidado,
  type RrhhLibroSueldos,
  type RrhhLibroSueldosItem
} from './rrhhLibroSueldos'

function padStr(s: string, len: number): string {
  const t = String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, ' ')
  return t.slice(0, len).padEnd(len, ' ')
}

function padNum(n: number | string, len: number): string {
  const d = String(n ?? '').replace(/\D/g, '')
  return d.slice(-len).padStart(len, '0')
}

function padDec(n: number, intLen: number, decLen: number): string {
  const v = round2(Number(n) || 0)
  const abs = Math.abs(v)
  const factor = 10 ** decLen
  const scaled = Math.round(abs * factor)
  return String(scaled).padStart(intLen + decLen, '0').slice(-(intLen + decLen))
}

function lastDayPeriodo(periodo: string): string {
  const [y, m] = periodo.split('-').map(Number)
  const d = new Date(y, m, 0).getDate()
  return `${y}${String(m).padStart(2, '0')}${String(d).padStart(2, '0')}`
}

function yyyymmdd(iso: string | null | undefined, fallbackPeriodo: string): string {
  const s = String(iso || '').slice(0, 10)
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s.replace(/-/g, '')
  return lastDayPeriodo(fallbackPeriodo)
}

function periodoAaaamm(periodo: string): string {
  return String(periodo || '').replace('-', '').slice(0, 6).padStart(6, '0')
}

function encodeWindows1252(text: string): Uint8Array {
  const out = new Uint8Array(text.length)
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i)
    out[i] = c <= 255 ? c : 0x3f
  }
  return out
}

function rec01(libro: RrhhLibroSueldos, nTrab: number): string {
  return (
    '01' +
    padNum(cuitDigitos(libro.empresa_cuit), 11) +
    'SJ' +
    periodoAaaamm(libro.periodo) +
    'M' +
    padNum(libro.nro_liquidacion || 1, 5) +
    padStr(String(libro.dias_base || 30), 2) +
    padNum(nTrab, 6)
  )
}

function rec02(liq: ReciboLiquidado, libro: RrhhLibroSueldos): string {
  const item = liq.item
  const forma = (item.forma_pago || '1').slice(0, 1)
  const cbu = forma === '3' ? padStr(item.cbu || '', 22) : padStr('', 22)
  return (
    '02' +
    padNum(cuilDigitos(item.cuil), 11) +
    padStr(String(item.n_legajo || ''), 10) +
    padStr(item.categoria || '', 50) +
    cbu +
    padNum(item.dias || libro.dias_base || 30, 3) +
    yyyymmdd(libro.fecha_pago, libro.periodo) +
    yyyymmdd(libro.fecha_pago, libro.periodo) +
    padStr(forma, 1)
  )
}

function rec03(cuil: string, codigo: string, cantidad: number, unidad: string, importe: number, dc: 'C' | 'D'): string {
  return (
    '03' +
    padNum(cuilDigitos(cuil), 11) +
    padStr(codigo, 10) +
    padDec(cantidad, 3, 2) +
    padStr(unidad, 1) +
    padDec(importe, 13, 2) +
    dc +
    padStr('', 6)
  )
}

function rec04(liq: ReciboLiquidado, libro: RrhhLibroSueldos): string {
  const item = liq.item
  const b = liq.bases
  const act = (item.actividad || libro.codigo_actividad || '049').replace(/\D/g, '').padStart(3, '0').slice(-3)
  const loc = (libro.codigo_localidad || '00').replace(/\D/g, '').padStart(2, '0').slice(-2)
  const os = (item.codigo_os || libro.codigo_os_default || '').replace(/\D/g, '').padStart(6, '0').slice(-6)
  const sit = (item.situacion_revista || '01').replace(/\D/g, '').padStart(2, '0').slice(-2)
  const zeros15 = padDec(0, 13, 2)
  const rem = padDec(b.remuneracion, 13, 2)
  // Bases imponibles 1–10 (criterio SICOSS): 1 aportes SIPA y 5 aportes INSSJP con tope;
  // 2/3 contribuciones sin tope; 4 aportes OS (jornada completa si es parcial, con tope);
  // 8 contribuciones OS (jornada completa si es parcial); 9 LRT.
  const bases = [
    b.aportes,
    b.remuneracion,
    b.remuneracion,
    b.aportesOs,
    b.aportes,
    b.remuneracion,
    b.remuneracion,
    b.os,
    b.remuneracion,
    b.remuneracion
  ].map((n) => padDec(n, 13, 2))
  const enConvenio = liq.empleado.enConvenio
  return (
    '04' +
    padNum(cuilDigitos(item.cuil), 11) +
    (item.conyuge ? '1' : '0') +
    padNum(item.hijos || 0, 2) +
    (enConvenio ? '1' : '0') +
    (item.cobertura_scvo ? '1' : '0') +
    '0' +
    padStr(libro.tipo_empleador || '1', 1) +
    '0' +
    sit +
    padStr((item.condicion || '01').replace(/\D/g, '').padStart(2, '0'), 2) +
    act +
    padStr((item.modalidad || '001').replace(/\D/g, '').padStart(3, '0'), 3) +
    '00' +
    loc +
    sit +
    '01' +
    '00' +
    '00' +
    '00' +
    '00' +
    padNum(item.dias || 30, 2) +
    padNum(item.horas_trabajadas || 0, 3) +
    padDec(0, 3, 2) +
    padDec(0, 3, 2) +
    padStr(os, 6) +
    padNum(0, 2) +
    zeros15 +
    zeros15 +
    zeros15 +
    zeros15 +
    zeros15 +
    zeros15 +
    bases.join('') +
    zeros15 +
    zeros15 +
    rem +
    padDec(libro.importe_detraer || 0, 13, 2)
  )
}

function conceptos03(liq: ReciboLiquidado): string[] {
  const item = liq.item
  const cuil = item.cuil
  const dias = item.dias || 30
  const anios = item.anios_antiguedad || 0
  const lines: string[] = []
  if (item.sueldo_basico > 0) {
    lines.push(rec03(cuil, CONCEPTOS_LSD.sueldo.codigo, dias, 'D', item.sueldo_basico, 'C'))
  }
  if (item.adicional_antiguedad > 0) {
    lines.push(rec03(cuil, CONCEPTOS_LSD.antig.codigo, anios, 'A', item.adicional_antiguedad, 'C'))
  }
  const baseHaberes = round2(item.sueldo_basico + item.adicional_antiguedad)
  for (const x of item.extras || []) {
    if (x.tipo === 'empleador') continue
    // Monto efectivo: incluye los conceptos cargados como % (antes se perdían en el TXT).
    const ef = montoExtraEfectivo(x, x.tipo === 'remunerativo' ? baseHaberes : liq.bruto)
    if (!ef.monto) continue
    const cod = (x.codigo_lsd || x.concepto || 'EXTRA').replace(/\s+/g, '').slice(0, 10)
    // Descuentos e importes negativos (inasistencias, suspensiones) van como débito.
    const dc = x.tipo === 'descuento' || ef.monto < 0 ? 'D' : 'C'
    const unidad = x.origen === 'liq' ? (x.unidad === 'hs' ? 'H' : 'D') : x.unidad.slice(0, 1)
    const cant = x.cantidad ?? (ef.pct != null ? ef.pct * 100 : 0)
    lines.push(rec03(cuil, cod, cant, ef.pct != null ? '%' : unidad, Math.abs(ef.monto), dc))
  }
  for (const l of liq.lineasTrabajador) {
    if (!l.id || !(l.descuento || 0)) continue
    lines.push(rec03(cuil, codigoLsdDeCarga(l.id), (l.pct || 0) * 100, '%', l.descuento || 0, 'D'))
  }
  return lines
}

export function validarItemLsd(item: RrhhLibroSueldosItem): string[] {
  const errs: string[] = []
  const nombre = item.apellido_nombre || 'Empleado'
  if (cuilDigitos(item.cuil).length !== 11) errs.push(`${nombre}: CUIL de 11 dígitos`)
  const baseHaberes = round2(item.sueldo_basico + item.adicional_antiguedad)
  const extraHab = (item.extras || [])
    .filter((x) => x.tipo === 'remunerativo' || x.tipo === 'no_remunerativo')
    .reduce((s, x) => s + Math.max(0, montoExtraEfectivo(x, baseHaberes).monto), 0)
  if (!(item.sueldo_basico > 0) && !(item.adicional_antiguedad > 0) && !(extraHab > 0)) {
    errs.push(`${nombre}: sin haberes`)
  }
  if (String(item.forma_pago || '').startsWith('3') && String(item.cbu || '').replace(/\D/g, '').length !== 22) {
    errs.push(`${nombre}: acreditación en cuenta sin CBU de 22 dígitos`)
  }
  return errs
}

/** Avisos que no frenan el TXT pero conviene revisar (art. 124 LCT, etc.). */
export function avisosItemLsd(item: RrhhLibroSueldosItem): string[] {
  const out: string[] = []
  const nombre = item.apellido_nombre || 'Empleado'
  if (!String(item.forma_pago || '').startsWith('3')) {
    out.push(`${nombre}: el sueldo debe pagarse por acreditación en cuenta (art. 124 LCT)`)
  }
  return out
}

export function armarTxtLsd(libro: RrhhLibroSueldos, items: RrhhLibroSueldosItem[]): {
  text: string
  errores: string[]
  nTrab: number
} {
  const incluidos = items.filter((i) => i.incluido)
  const errores: string[] = []
  if (cuitDigitos(libro.empresa_cuit).length !== 11) errores.push('CUIT del empleador inválido')
  const ok: ReciboLiquidado[] = []
  for (const item of incluidos) {
    const e = validarItemLsd(item)
    errores.push(...e)
    if (e.length) continue
    ok.push(liquidarRecibo({ item, libro }))
  }
  const lines: string[] = [rec01(libro, ok.length)]
  for (const liq of ok) {
    lines.push(rec02(liq, libro))
    lines.push(...conceptos03(liq))
    lines.push(rec04(liq, libro))
  }
  return { text: lines.join('\r\n') + (lines.length ? '\r\n' : ''), errores, nTrab: ok.length }
}

export function descargarTxtLsd(libro: RrhhLibroSueldos, items: RrhhLibroSueldosItem[]): {
  errores: string[]
  nTrab: number
} {
  const { text, errores, nTrab } = armarTxtLsd(libro, items)
  if (nTrab === 0) return { errores: errores.length ? errores : ['Nadie para exportar'], nTrab: 0 }
  const bytes = encodeWindows1252(text)
  const blob = new Blob([Uint8Array.from(bytes)], { type: 'text/plain' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `LSD_${periodoAaaamm(libro.periodo)}_${padNum(libro.nro_liquidacion || 1, 5)}.txt`
  a.click()
  URL.revokeObjectURL(a.href)
  return { errores, nTrab }
}

export function longitudesRegistrosLsd(libro: RrhhLibroSueldos, item: RrhhLibroSueldosItem) {
  const liq = liquidarRecibo({ item, libro })
  return {
    r01: rec01(libro, 1).length,
    r02: rec02(liq, libro).length,
    r03: conceptos03(liq)[0]?.length ?? 0,
    r04: rec04(liq, libro).length
  }
}

export { rec01, rec02, rec04, fechaCortaEs }

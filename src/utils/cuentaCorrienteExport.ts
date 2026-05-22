import { jsPDF } from 'jspdf'
import type {
  CcCuentaMovimiento,
  CcInteresesDevengados,
  CcPerfilCliente,
  CcPerfilResumen,
  CcVentaResumen,
  ClienteCuentaCorrienteRecord
} from '../types/api'
import {
  ESTADO_CC_LABELS,
  TIPO_CLIENTE_CC_LABELS,
  labelCondicionIva,
  normalizeEstadoCc
} from '../constants/cuentaCorriente'
import { formatMontoArs, movimientosConSaldoCorrido } from './cuentaCorrienteLedger'
import type { CcCarteraStats } from './cuentaCorrienteStats'

function esc(s: string): string {
  const t = String(s ?? '')
  if (/[",\r\n]/.test(t)) return `"${t.replace(/"/g, '""')}"`
  return t
}

export function downloadCsv(filename: string, rows: string[][]): void {
  if (rows.length === 0) return
  const lines = rows.map((row) => row.map((c) => esc(String(c))).join(','))
  const blob = new Blob([`\uFEFF${lines.join('\r\n')}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function slug(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48)
    .toLowerCase() || 'cliente'
}

function fechaIso(d: string | null | undefined): string {
  if (!d) return ''
  return d.slice(0, 10)
}

export type CarteraExportRow = ClienteCuentaCorrienteRecord & {
  cliente?: { nombre?: string | null }
}

export function buildCarteraCsvRows(
  registros: CarteraExportRow[],
  stats?: CcCarteraStats
): string[][] {
  const rows: string[][] = [
    [
      'id_cliente',
      'cliente',
      'estado',
      'tipo',
      'cuit',
      'condicion_iva',
      'saldo_actual',
      'total_cargos',
      'total_pagos',
      'limite_credito',
      'score',
      'score_nivel',
      'ultimo_pago',
      'email',
      'whatsapp',
      'url_constancia_afip',
      'url_estatuto',
      'url_comprobante_domicilio',
      'url_documento_dni',
      'url_pagare'
    ]
  ]
  for (const r of registros) {
    const nombre = r.razon_social || r.cliente?.nombre || ''
    rows.push([
      String(r.id_cliente),
      nombre,
      ESTADO_CC_LABELS[normalizeEstadoCc(r)],
      TIPO_CLIENTE_CC_LABELS[r.tipo_cliente === 'persona_fisica' ? 'persona_fisica' : 'empresa'],
      r.cuit ?? '',
      labelCondicionIva(r.condicion_iva),
      String(r.saldo_actual ?? 0),
      String(r.total_cargos ?? 0),
      String(r.total_pagos ?? 0),
      r.limite_credito != null ? String(r.limite_credito) : '',
      r.score != null ? String(r.score) : '',
      r.score_nivel ?? '',
      fechaIso(r.ultimo_pago_at ?? undefined),
      r.email ?? '',
      r.whatsapp ?? '',
      r.url_constancia_afip ?? '',
      r.url_estatuto ?? '',
      r.url_comprobante_domicilio ?? '',
      r.url_documento_dni ?? '',
      r.url_pagare ?? ''
    ])
  }
  if (stats) {
    rows.push([])
    rows.push(['RESUMEN CARTERA'])
    rows.push(['total_cuentas', String(stats.total)])
    rows.push(['aprobadas', String(stats.aprobada)])
    rows.push(['pendientes', String(stats.pendiente)])
    rows.push(['rechazadas', String(stats.rechazada)])
    rows.push(['deuda_total', String(stats.deudaTotal)])
    rows.push(['saldo_neto_cartera', String(stats.saldoCartera)])
    rows.push(['clientes_con_deuda', String(stats.clientesConDeuda)])
  }
  return rows
}

export function buildMovimientosCsvRows(movs: CcCuentaMovimiento[]): string[][] {
  const rows: string[][] = [
    [
      'id',
      'fecha',
      'tipo',
      'concepto',
      'debe',
      'haber',
      'saldo_acumulado',
      'fecha_vencimiento',
      'id_venta',
      'referencia',
      'metodo_pago',
      'notas',
      'url_comprobante'
    ]
  ]
  const conSaldo = movimientosConSaldoCorrido(movs)
  for (const m of conSaldo) {
    rows.push([
      String(m.id),
      fechaIso(m.fecha),
      m.tipo,
      m.concepto,
      String(m.debe),
      String(m.haber),
      m.saldo_acumulado != null ? String(m.saldo_acumulado) : '',
      fechaIso(m.fecha_vencimiento ?? undefined),
      m.id_venta != null ? String(m.id_venta) : '',
      m.referencia ?? '',
      m.metodo_pago ?? '',
      m.notas ?? '',
      m.url_comprobante ?? ''
    ])
  }
  return rows
}

export function buildVentasCcCsvRows(ventas: CcVentaResumen[]): string[][] {
  const rows: string[][] = [
    [
      'id',
      'numero_venta',
      'fecha_venta',
      'valor_total',
      'estado_pago',
      'metodo_pago',
      'observaciones',
      'url_comprobante'
    ]
  ]
  for (const v of ventas) {
    rows.push([
      String(v.id),
      v.numero_venta,
      fechaIso(v.fecha_venta),
      String(v.valor_total),
      v.estado_pago,
      v.metodo_pago ?? '',
      v.observaciones ?? '',
      v.comprobante_pago_url ?? ''
    ])
  }
  return rows
}

export function buildInteresesCsvRows(intereses: CcInteresesDevengados | null | undefined): string[][] {
  const rows: string[][] = [
    [
      'periodo',
      'tasa_mora_mensual',
      'dias_gracia',
      'total_devengado',
      'numero_venta',
      'concepto',
      'debe',
      'dias_mora',
      'interes_calculado',
      'ya_registrado'
    ]
  ]
  if (!intereses) return rows
  if (intereses.items.length === 0) {
    rows.push([
      intereses.periodo,
      String(intereses.tasa_mora_mensual),
      String(intereses.dias_gracia),
      String(intereses.total_devengado),
      '',
      '',
      '',
      '',
      '',
      ''
    ])
    return rows
  }
  for (const it of intereses.items) {
    rows.push([
      intereses.periodo,
      String(intereses.tasa_mora_mensual),
      String(intereses.dias_gracia),
      String(intereses.total_devengado),
      it.numero_venta ?? '',
      it.concepto ?? '',
      it.debe != null ? String(it.debe) : '',
      it.dias_mora != null ? String(it.dias_mora) : '',
      it.interes_calculado != null ? String(it.interes_calculado) : '',
      it.ya_registrado ? 'si' : 'no'
    ])
  }
  return rows
}

export function buildFichaResumenCsvRows(
  ficha: ClienteCuentaCorrienteRecord,
  resumen: CcPerfilResumen,
  nombre: string
): string[][] {
  return [
    ['campo', 'valor'],
    ['id_cliente', String(ficha.id_cliente)],
    ['nombre', nombre],
    ['cuit', ficha.cuit ?? ''],
    ['tipo_cliente', TIPO_CLIENTE_CC_LABELS[ficha.tipo_cliente === 'persona_fisica' ? 'persona_fisica' : 'empresa']],
    ['condicion_iva', labelCondicionIva(ficha.condicion_iva)],
    ['estado', ESTADO_CC_LABELS[normalizeEstadoCc(ficha)]],
    ['email', ficha.email ?? ''],
    ['whatsapp', ficha.whatsapp ?? ''],
    ['domicilio', ficha.domicilio ?? ''],
    ['localidad', ficha.localidad ?? ''],
    ['provincia', ficha.provincia ?? ''],
    ['saldo_actual', String(resumen.saldo_actual)],
    ['total_cargos', String(resumen.total_cargos)],
    ['total_pagos', String(resumen.total_pagos)],
    ['ventas_pendientes', String(resumen.ventas_pendientes)],
    ['monto_pendiente_ventas', String(resumen.monto_pendiente_ventas)],
    ['limite_credito', resumen.limite_credito != null ? String(resumen.limite_credito) : ''],
    ['score', resumen.score != null ? String(resumen.score) : ''],
    ['score_nivel', resumen.score_nivel ?? ''],
    ['ultimo_pago', fechaIso(resumen.ultimo_pago_at ?? undefined)],
    ['tasa_mora', resumen.tasa_mora_vigente != null ? String(resumen.tasa_mora_vigente) : ''],
    ['intereses_devengados', String(resumen.intereses_devengados?.total_devengado ?? 0)],
    ['url_constancia_afip', ficha.url_constancia_afip ?? ''],
    ['url_estatuto', ficha.url_estatuto ?? ''],
    ['url_comprobante_domicilio', ficha.url_comprobante_domicilio ?? ''],
    ['url_documento_dni', ficha.url_documento_dni ?? ''],
    ['url_pagare', ficha.url_pagare ?? '']
  ]
}

export function buildPerfilCompletoCsv(perfil: CcPerfilCliente, nombre: string): string[][] {
  const sep = (titulo: string): string[][] => [[], [titulo], []]
  return [
    ...buildFichaResumenCsvRows(perfil.ficha, perfil.resumen, nombre),
    ...sep('LIBRO DE CUENTA'),
    ...buildMovimientosCsvRows(perfil.movimientos).slice(1),
    ...sep('VENTAS CUENTA CORRIENTE'),
    ...buildVentasCcCsvRows(perfil.ventas_cc).slice(1),
    ...sep('INTERESES DEVENGADOS (VISTA PREVIA)'),
    ...buildInteresesCsvRows(perfil.resumen.intereses_devengados).slice(1)
  ]
}

export function downloadCarteraCsv(
  registros: CarteraExportRow[],
  stats?: CcCarteraStats,
  filename?: string
): void {
  const stamp = new Date().toISOString().slice(0, 10)
  downloadCsv(filename ?? `cuenta-corriente-cartera-${stamp}.csv`, buildCarteraCsvRows(registros, stats))
}

export function downloadPerfilCsvPack(perfil: CcPerfilCliente, nombre: string): void {
  const base = slug(nombre)
  const stamp = new Date().toISOString().slice(0, 10)
  downloadCsv(`${base}-cc-completo-${stamp}.csv`, buildPerfilCompletoCsv(perfil, nombre))
  setTimeout(() => {
    downloadCsv(`${base}-libro-${stamp}.csv`, buildMovimientosCsvRows(perfil.movimientos))
  }, 200)
  setTimeout(() => {
    downloadCsv(`${base}-ventas-${stamp}.csv`, buildVentasCcCsvRows(perfil.ventas_cc))
  }, 400)
  setTimeout(() => {
    downloadCsv(
      `${base}-ficha-${stamp}.csv`,
      buildFichaResumenCsvRows(perfil.ficha, perfil.resumen, nombre)
    )
  }, 600)
}

export function downloadEstadoCuentaPdf(perfil: CcPerfilCliente, nombre: string): void {
  const doc = new jsPDF('p', 'mm', 'a4')
  const margin = 14
  let y = margin
  const pageW = doc.internal.pageSize.getWidth()
  const maxW = pageW - margin * 2

  const line = (text: string, size = 10, bold = false) => {
    doc.setFontSize(size)
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    const lines = doc.splitTextToSize(text, maxW)
    for (const ln of lines) {
      if (y > 280) {
        doc.addPage()
        y = margin
      }
      doc.text(ln, margin, y)
      y += size * 0.45
    }
  }

  const stamp = new Date().toLocaleString('es-AR')
  line('Estado de cuenta corriente', 14, true)
  line(nombre, 12, true)
  line(`Generado: ${stamp}`, 9)
  y += 4

  const r = perfil.resumen
  line(`Saldo actual: ${formatMontoArs(r.saldo_actual)}`, 10, true)
  line(`Cargos: ${formatMontoArs(r.total_cargos)} · Pagos: ${formatMontoArs(r.total_pagos)}`)
  line(
    `Pendiente ventas: ${r.ventas_pendientes} (${formatMontoArs(r.monto_pendiente_ventas)}) · Score: ${r.score ?? '—'} (${r.score_nivel ?? '—'})`
  )
  y += 6

  line('Libro de movimientos', 11, true)
  const movs = movimientosConSaldoCorrido(perfil.movimientos)
  if (movs.length === 0) {
    line('Sin movimientos registrados.', 9)
  } else {
    for (const m of movs) {
      const debe = m.debe > 0 ? formatMontoArs(m.debe) : '—'
      const haber = m.haber > 0 ? formatMontoArs(m.haber) : '—'
      line(
        `${fechaIso(m.fecha)} · ${m.tipo} · ${m.concepto} · Debe ${debe} · Haber ${haber} · Saldo ${formatMontoArs(m.saldo_acumulado)}`,
        8
      )
      if (m.url_comprobante) line(`  Comprobante: ${m.url_comprobante}`, 7)
    }
  }

  y += 4
  line('Ventas en cuenta corriente', 11, true)
  if (perfil.ventas_cc.length === 0) {
    line('Sin ventas CC.', 9)
  } else {
    for (const v of perfil.ventas_cc) {
      line(
        `${fechaIso(v.fecha_venta)} · ${v.numero_venta} · ${formatMontoArs(v.valor_total)} · ${v.estado_pago}`,
        8
      )
    }
  }

  doc.save(`${slug(nombre)}-estado-cuenta-${new Date().toISOString().slice(0, 10)}.pdf`)
}

/** Abre URL en nueva pestaña o fuerza descarga si el navegador lo permite. */
export function descargarArchivoUrl(url: string, nombre?: string): void {
  if (!url) return
  const a = document.createElement('a')
  a.href = url
  a.target = '_blank'
  a.rel = 'noopener noreferrer'
  if (nombre) a.download = nombre
  document.body.appendChild(a)
  a.click()
  a.remove()
}

/**
 * ¿La venta ya tiene una factura vigente? Una Factura autorizada deja de estar vigente solo
 * cuando sus notas de crédito AUTORIZADAS la cubren por completo (una NC parcial no la anula,
 * y una NC en borrador todavía no existe para ARCA).
 */
export type ComprobanteVenta = {
  id: number
  numero_factura?: string | null
  tipo_comprobante?: string | null
  estado?: string | null
  estado_afip?: string | null
  cae?: string | null
  total?: number | string | null
  id_factura_referencia?: number | null
}

export type EstadoFacturacionVenta = {
  /** Factura autorizada que sigue vigente (no anulada del todo por notas de crédito). */
  vigente: ComprobanteVenta | null
  /** Nota de crédito sobre la factura vigente que quedó sin autorizar en ARCA. */
  notaCreditoPendiente: ComprobanteVenta | null
  /** Lo que falta acreditar para anular la factura vigente. */
  saldoSinAcreditar: number
}

const tipo = (c: ComprobanteVenta) => String(c.tipo_comprobante || '')
const autorizada = (c: ComprobanteVenta) =>
  String(c.estado_afip || '').trim() === 'Autorizada' ||
  (String(c.estado || '').trim() === 'Emitida' && String(c.cae || '').trim().length > 0)
const anulada = (c: ComprobanteVenta) =>
  String(c.estado || '').trim() === 'Anulada' || String(c.estado_afip || '').trim() === 'Anulada'
const monto = (c: ComprobanteVenta) => Math.abs(Number(c.total) || 0)

export function estadoFacturacionVenta(comprobantes: ComprobanteVenta[]): EstadoFacturacionVenta {
  const vivos = comprobantes.filter((c) => !anulada(c))
  const facturas = vivos
    .filter((c) => tipo(c).startsWith('Factura') && autorizada(c))
    .sort((a, b) => b.id - a.id)

  for (const f of facturas) {
    const notas = vivos.filter((c) => Number(c.id_factura_referencia) === f.id)
    let saldo = monto(f)
    for (const n of notas) {
      if (!autorizada(n)) continue
      if (tipo(n).startsWith('Nota de Crédito')) saldo -= monto(n)
      else if (tipo(n).startsWith('Nota de Débito')) saldo += monto(n)
    }
    saldo = Math.round(saldo * 100) / 100
    if (saldo > 0.01) {
      const notaCreditoPendiente =
        notas.find((n) => tipo(n).startsWith('Nota de Crédito') && !autorizada(n)) ?? null
      return { vigente: f, notaCreditoPendiente, saldoSinAcreditar: saldo }
    }
  }
  return { vigente: null, notaCreditoPendiente: null, saldoSinAcreditar: 0 }
}

/** Mensaje para cuando se intenta facturar de nuevo una venta que todavía tiene factura vigente. */
export function mensajeFacturaVigente(estado: EstadoFacturacionVenta): string {
  const f = estado.vigente
  if (!f) return ''
  const nombre = `${f.tipo_comprobante || 'Factura'} ${f.numero_factura || ''}`.trim()
  if (estado.notaCreditoPendiente) {
    return (
      `Esta venta todavía tiene la ${nombre} vigente: la nota de crédito ` +
      `${estado.notaCreditoPendiente.numero_factura || ''} está en borrador y ARCA no la tiene. ` +
      'Abrila en Facturas y tocá "Emitir" para autorizarla; después podés volver a facturar la venta.'
    )
  }
  const parcial = estado.saldoSinAcreditar < monto(f) - 0.01
  return parcial
    ? `Esta venta todavía tiene la ${nombre} vigente: las notas de crédito no la cubren entera ` +
        `(faltan $${estado.saldoSinAcreditar.toFixed(2)}). Para rehacerla, anulá el resto con otra nota de crédito.`
    : `Esta venta ya tiene la ${nombre} autorizada. Para rehacerla, primero anulala con una nota de crédito.`
}

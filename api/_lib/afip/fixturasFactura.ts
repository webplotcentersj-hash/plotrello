// Comprobantes de ejemplo compartidos por los tests del PDF (plantilla del SDK y diseño en HTML).
// Tienen la forma en que la app los guarda: precio unitario neto y notas de crédito en negativo.
import type { AfipPdfFactura } from './pdf'

export const emisorPlot = {
  cuit: '30715518801',
  razon_social: 'PLOT CENTER SRL',
  domicilio_comercial: 'Avenida Libertador Este 580, San Juan',
  condicion_iva: 'Responsable Inscripto',
  ingresos_brutos: '30-71551880-1',
  fecha_inicio_actividades: '2017-01-27'
}

export type ItemFactura = NonNullable<AfipPdfFactura['items']>[number]
export type CasoFactura = AfipPdfFactura & { id: number }

const base = {
  id: 1,
  punto_venta: 14,
  numero_comprobante: 10,
  numero_factura: '0014-00000010',
  fecha_emision: '2026-11-02',
  cliente_nombre: 'CLIENTE DE PRUEBA',
  concepto: 1,
  cae: '86440688442835',
  fecha_vencimiento_cae: '2026-11-12'
}

export function item(n: number, descripcion: string, cantidad: number, neto: number, pct: number): ItemFactura {
  const iva = Math.round(neto * pct) / 100
  return {
    item_numero: n,
    descripcion,
    cantidad,
    precio_unitario: Math.round((neto / cantidad) * 100) / 100,
    subtotal: neto,
    iva_porcentaje: pct,
    iva_monto: iva,
    total: Math.round((neto + iva) * 100) / 100
  }
}

export const facturaA: CasoFactura = {
  ...base,
  tipo_comprobante: 'Factura A',
  cliente_dni_cuit: '30715518801',
  cliente_condicion_iva: 'Responsable Inscripto',
  subtotal: 1550,
  iva: 252,
  total: 1802,
  items: [item(1, 'LONA FRONT (m2)', 10, 1000, 21), item(2, 'PAPEL OBRA (kg)', 2.5, 400, 10.5), item(3, 'FLETE', 1, 150, 0)]
}

// La factura B 0014-00000692 que emitió el SDK: 0,48 m² a $ 29.260 el m² con IVA incluido.
export const factura692: CasoFactura = {
  ...base,
  id: 692,
  numero_comprobante: 692,
  numero_factura: '0014-00000692',
  tipo_comprobante: 'Factura B',
  cliente_nombre: 'RODRIGUEZ ALBERTO RUBEN',
  cliente_dni_cuit: '20942051',
  cliente_condicion_iva: 'Consumidor Final',
  subtotal: 11607.27,
  iva: 2437.53,
  total: 14044.8,
  items: [
    {
      item_numero: 1,
      descripcion: 'VINILO IMPRESO + PRE CORTE X M2 (m²)',
      cantidad: 0.48,
      precio_unitario: 24181.82,
      subtotal: 11607.27,
      iva_porcentaje: 21,
      iva_monto: 2437.53,
      total: 14044.8
    }
  ]
}

export const facturaBVarias: CasoFactura = {
  ...base,
  tipo_comprobante: 'Factura B',
  cliente_dni_cuit: '',
  cliente_condicion_iva: 'Consumidor Final',
  subtotal: 4500,
  iva: 945,
  total: 5445,
  items: [item(1, 'IMPRESION GRAN FORMATO', 3, 3000, 21), item(2, 'CORTE PLOTTER', 1.5, 1500, 21)]
}

export const facturaC: CasoFactura = {
  ...base,
  tipo_comprobante: 'Factura C',
  cliente_dni_cuit: '',
  cliente_condicion_iva: 'Consumidor Final',
  subtotal: 2000,
  iva: 0,
  total: 2000,
  items: [{ ...item(1, 'SERVICIO', 2, 2000, 0), total: 2000 }]
}

// Las notas de crédito se guardan con subtotal, IVA y total en negativo.
export const notaCreditoB: CasoFactura = {
  ...factura692,
  id: 693,
  tipo_comprobante: 'Nota de Crédito B',
  numero_comprobante: 23,
  numero_factura: '0014-00000023',
  subtotal: -11607.27,
  iva: -2437.53,
  total: -14044.8,
  items: [{ ...factura692.items![0], subtotal: -11607.27, iva_monto: -2437.53, total: -14044.8 }]
}

export const referenciaFactura692 = {
  tipo_comprobante: 'Factura B',
  punto_venta: 14,
  numero_comprobante: 692,
  fecha_emision: '2026-11-02'
}

export const casosFactura: Array<[string, CasoFactura]> = [
  ['Factura A con tres alícuotas', facturaA],
  ['Factura B 692 con cantidad decimal', factura692],
  ['Factura B con varias líneas decimales', facturaBVarias],
  ['Factura C', facturaC],
  ['Nota de Crédito B guardada en negativo', notaCreditoB]
]

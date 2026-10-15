import * as XLSX from 'xlsx'
import {
  etiquetaPeriodoLibro,
  formatArs2,
  liquidarRecibo,
  type ReciboLiquidado,
  type RrhhLibroSueldos,
  type RrhhLibroSueldosItem
} from './rrhhLibroSueldos'

export function exportarLibroSueldosXlsx(libro: RrhhLibroSueldos, items: RrhhLibroSueldosItem[]): void {
  const incluidos = items.filter((i) => i.incluido)
  const liqs = incluidos.map((item) => liquidarRecibo({ item, libro }))
  const wb = XLSX.utils.book_new()

  const resumen = liqs.map((l) => ({
    Legajo: l.item.n_legajo,
    Empleado: l.item.apellido_nombre,
    CUIL: l.item.cuil,
    Categoria: l.item.categoria || '',
    'Fecha ingreso': l.item.fecha_ingreso || '',
    Días: l.item.dias,
    'Sueldo básico': l.item.sueldo_basico,
    Antigüedad: l.item.adicional_antiguedad,
    Bruto: l.bruto,
    Descuentos: l.descuentos,
    Neto: l.neto,
    'Contrib. empleador': l.contribuciones,
    'Costo empleador': l.costoEmpleador
  }))
  const tot = liqs.reduce(
    (a, l) => ({
      bruto: a.bruto + l.bruto,
      desc: a.desc + l.descuentos,
      neto: a.neto + l.neto,
      contrib: a.contrib + l.contribuciones,
      costo: a.costo + l.costoEmpleador
    }),
    { bruto: 0, desc: 0, neto: 0, contrib: 0, costo: 0 }
  )
  resumen.push({
    Legajo: '' as unknown as number,
    Empleado: 'TOTAL',
    CUIL: '',
    Categoria: '',
    'Fecha ingreso': '',
    Días: '' as unknown as number,
    'Sueldo básico': '' as unknown as number,
    Antigüedad: '' as unknown as number,
    Bruto: tot.bruto,
    Descuentos: tot.desc,
    Neto: tot.neto,
    'Contrib. empleador': tot.contrib,
    'Costo empleador': tot.costo
  })
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumen), 'Libro')

  for (const l of liqs) {
    const name = sheetName(l)
    const rows: Array<Array<string | number>> = [
      [libro.empresa_nombre],
      [libro.empresa_domicilio],
      ['CUIT', libro.empresa_cuit],
      ['RECIBO DE SUELDO – LCT – MENSUAL'],
      ['Periodo', etiquetaPeriodoLibro(libro.periodo), 'Empleado', l.item.apellido_nombre],
      ['Legajo', l.item.n_legajo, 'CUIL', l.item.cuil, 'Bruto', l.bruto],
      [],
      ['COSTO TOTAL EMPLEADOR', l.costoEmpleador],
      ['Concepto', 'Unidad', 'Base', 'Monto'],
      ...l.lineasEmpleador.map((ln) => [
        ln.concepto,
        ln.unidad,
        ln.base ?? '',
        ln.montoEmpleador ?? ''
      ]),
      ['SUBTOTAL CONTRIBUCIONES', '', '', l.contribuciones],
      [],
      ['SUELDO BRUTO', l.bruto],
      ['Concepto', 'Unidad', 'Base', 'Remunerativo', 'No remunerativo', 'Descuentos'],
      ...l.lineasTrabajador.map((ln) => [
        ln.concepto,
        ln.unidad,
        ln.base ?? '',
        ln.remunerativo ?? '',
        ln.noRemunerativo ?? '',
        ln.descuento ?? ''
      ]),
      ['SUELDO NETO', l.netoEnLetras, l.neto],
      ['Descuentos', l.descuentos]
    ]
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), name)
  }

  XLSX.writeFile(wb, `libro_sueldos_${libro.periodo}.xlsx`)
}

function sheetName(l: ReciboLiquidado): string {
  const raw = `${l.item.n_legajo || ''} ${l.item.apellido_nombre}`.trim() || 'empleado'
  return raw.replace(/[\\/?*[\]]/g, ' ').slice(0, 31)
}

export { formatArs2 }

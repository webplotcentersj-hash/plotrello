import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  SIN_CATEGORIA,
  acumuladoDiario,
  agrupar,
  alertasGastos,
  cuadroCategorias,
  evolucionPorCategoria,
  resumenMes,
  type GastoStat
} from './estadisticasGastos.ts'

let id = 0
const g = (fecha: string, total: number, categoria: string | null, extra: Partial<GastoStat> = {}): GastoStat => ({
  id: ++id,
  fecha_gasto: fecha,
  total,
  categoria,
  ...extra
})

// Alquiler fijo, energía estable, insumos que se disparan en noviembre
const filas: GastoStat[] = []
for (let m = 5; m <= 10; m++) {
  const mm = String(m).padStart(2, '0')
  filas.push(g(`2026-${mm}-05`, 100000, 'Alquiler', { proveedor: 'Inmobiliaria', origen: 'gasto_fijo' }))
  filas.push(g(`2026-${mm}-12`, 20000, 'Energía', { proveedor: 'EPSE' }))
  filas.push(g(`2026-${mm}-20`, 30000, 'Insumos', { proveedor: 'Vinilos SA', iva: 5206, id_factura_compra: 1 }))
}
filas.push(g('2026-11-05', 100000, 'Alquiler', { proveedor: 'Inmobiliaria', origen: 'gasto_fijo' }))
filas.push(g('2026-11-08', 90000, 'Insumos', { proveedor: 'Vinilos SA', iva: 15620, descripcion: 'Rollos de vinilo' }))
filas.push(g('2026-11-09', 4000, null))

describe('resumen del mes', () => {
  it('total, comparación al mismo día, proyección e IVA sin libro', () => {
    const r = resumenMes(filas, '2026-11', '2026-11-10')
    assert.equal(r.total, 194000)
    assert.equal(r.cantidad, 3)
    assert.equal(r.totalMesAnterior, 150000)
    assert.equal(r.totalMesAnteriorMismoDia, 100000, 'octubre hasta el día 10: solo el alquiler')
    assert.equal(Math.round(r.variacion!), 94)
    assert.equal(r.promedioDiario, 19400)
    assert.equal(r.proyeccion, 100000 + (94000 / 10) * 30, 'el alquiler fijo no se extrapola')
    assert.equal(r.ivaPendienteLibro, 15620)
    assert.equal(r.gastosConIvaSinLibro, 1)
    assert.deepEqual(r.sinCategoria, { cantidad: 1, total: 4000 })
    assert.equal(r.fijos, 100000)
    assert.equal(r.mayor?.total, 100000)
  })

  it('mes cerrado: sin proyección y compara contra el mes anterior completo', () => {
    const r = resumenMes(filas, '2026-10', '2026-11-10')
    assert.equal(r.proyeccion, null)
    assert.equal(r.totalMesAnteriorMismoDia, r.totalMesAnterior)
    assert.equal(r.promedioDiario, Math.round((150000 / 31) * 100) / 100)
  })
})

describe('cuadro de categorías', () => {
  it('total, participación, mes anterior, promedio de 6 meses y serie', () => {
    const c = cuadroCategorias(filas, '2026-11')
    assert.deepEqual(c.map((f) => f.categoria), ['Alquiler', 'Insumos', SIN_CATEGORIA, 'Energía'])
    const insumos = c.find((f) => f.categoria === 'Insumos')!
    assert.equal(insumos.total, 90000)
    assert.equal(insumos.mesAnterior, 30000)
    assert.equal(insumos.variacion, 200)
    assert.equal(insumos.promedio6, 30000)
    assert.equal(insumos.proveedorPrincipal, 'Vinilos SA')
    assert.equal(insumos.ultimo, '2026-11-08')
    assert.deepEqual(insumos.serie, [30000, 30000, 30000, 30000, 30000, 90000])
    const energia = c.find((f) => f.categoria === 'Energía')!
    assert.equal(energia.total, 0, 'categorías con historia aparecen aunque este mes estén en 0')
    assert.equal(energia.promedio6, 20000)
    const suma = c.reduce((s, f) => s + f.participacion, 0)
    assert.equal(Math.round(suma), 100)
  })
})

describe('series', () => {
  it('evolución de 12 meses apilada por categorías principales', () => {
    const e = evolucionPorCategoria(filas, '2026-11', 2)
    assert.deepEqual(e.claves, ['Alquiler', 'Insumos', 'Otras'])
    assert.equal(e.datos.length, 12)
    const nov = e.datos.at(-1)!
    assert.equal(nov.mes, '2026-11')
    assert.equal(nov.Insumos, 90000)
    assert.equal(nov.Otras, 4000)
    assert.equal(nov.total, 194000)
  })

  it('acumulado diario contra el mes anterior, cortado en hoy', () => {
    const a = acumuladoDiario(filas, '2026-11', '2026-11-10')
    assert.equal(a.length, 31)
    assert.equal(a[4].actual, 100000)
    assert.equal(a[9].actual, 194000)
    assert.equal(a[10].actual, null, 'después de hoy no se dibuja')
    assert.equal(a[29].anterior, 150000)
    assert.equal(a[30].anterior, 150000, 'octubre tiene 31 días')
  })

  it('agrupar por proveedor', () => {
    const p = agrupar(filas, '2026-11', (x) => x.proveedor || '')
    assert.deepEqual(p[0], { nombre: 'Inmobiliaria', total: 100000, cantidad: 1 })
  })
})

describe('alertas', () => {
  it('categoría disparada, IVA sin libro y sin categoría', () => {
    const a = alertasGastos(filas, '2026-11', '2026-11-30')
    assert.ok(a.find((x) => x.categoria === 'Insumos' && /más que su promedio/.test(x.texto)))
    assert.ok(a.find((x) => /no están en el libro de compras/.test(x.texto)))
    assert.ok(a.find((x) => x.categoria === SIN_CATEGORIA))
    assert.ok(!a.find((x) => x.categoria === 'Alquiler'), 'el alquiler está en su promedio')
  })

  it('a mitad de mes no alerta un gasto mensual que ya se pagó', () => {
    const a = alertasGastos(filas, '2026-11', '2026-11-06')
    assert.ok(!a.find((x) => x.categoria === 'Alquiler'))
  })
})

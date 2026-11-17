import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  cobranzaMes,
  estimarComisionMes,
  insightsComisiones,
  porcentajeEfectivo,
  porcionesTorta,
  proyeccionMes,
  rankingVendedores,
  variacionPct,
  ventaNecesaria,
  type DatosInsights,
  type ResumenVendedorMes,
  type VentaAnalisis
} from './analisisComisiones.ts'

const vend = (id: number, nombre: string, base: number, ventas: number, devengado = base * 0.03): ResumenVendedorMes => ({
  id_vendedor: id,
  nombre_vendedor: nombre,
  ventas,
  base_monto: base,
  devengado,
  liquidado: 0,
  pendiente: devengado
})

const venta = (id_vendedor: number, base: number, pagado: number, fecha = '2026-11-10', extra: Partial<VentaAnalisis> = {}): VentaAnalisis => ({
  id_vendedor,
  fecha_venta: fecha,
  base_monto: base,
  monto_pagado: pagado,
  estado_pago: pagado >= base ? 'Pagado' : pagado > 0 ? 'Parcial' : 'Pendiente',
  monto_devengado: base * 0.03,
  ...extra
})

describe('proyección y variación', () => {
  it('proyecta el mes en curso de forma lineal', () => {
    const p = proyeccionMes(1_000_000, '2026-11', '2026-11-10')
    assert.ok(p)
    assert.equal(Math.round(p.proyectado), 3_000_000)
    assert.equal(Math.round(p.avance * 100), 33)
  })

  it('un mes que no es el actual no se proyecta', () => {
    assert.equal(proyeccionMes(1_000_000, '2026-10', '2026-11-10'), null)
  })

  it('variación: sin mes anterior no hay porcentaje', () => {
    assert.equal(variacionPct(150, 100), 50)
    assert.equal(variacionPct(50, 100), -50)
    assert.equal(variacionPct(50, 0), null)
  })
})

describe('tortas', () => {
  it('agrupa en "Otros" lo que pasa del máximo y descarta ceros', () => {
    const items = [10, 9, 8, 7, 6, 5, 4, 0].map((v, i) => ({ nombre: `V${i}`, valor: v }))
    const t = porcionesTorta(items, 4)
    assert.deepEqual(t.map((x) => x.nombre), ['V0', 'V1', 'V2', 'Otros'])
    assert.equal(t[3].valor, 7 + 6 + 5 + 4)
  })

  it('cobranza: lo pagado no supera el precio y las canceladas no cuentan', () => {
    const c = cobranzaMes([venta(1, 100, 100), venta(1, 100, 150), venta(1, 200, 50), venta(1, 999, 0, '2026-11-10', { estado_pago: 'Cancelado' })])
    assert.equal(c.total, 400)
    assert.equal(c.cobrado, 250)
    assert.equal(c.pendiente, 150)
    assert.equal(c.pct, 62.5)
  })
})

describe('ranking', () => {
  it('ordena por precio de venta con participación, ticket, variación y cobrado', () => {
    const r = rankingVendedores(
      [vend(1, 'Ana', 300, 3), vend(2, 'Beto', 700, 2)],
      [vend(1, 'Ana', 600, 5)],
      [venta(1, 300, 100), venta(2, 700, 700)]
    )
    assert.deepEqual(r.map((x) => x.nombre_vendedor), ['Beto', 'Ana'])
    assert.equal(r[0].participacion, 70)
    assert.equal(r[0].ticket, 350)
    assert.equal(r[0].variacion, null, 'Beto no vendió el mes anterior')
    assert.equal(r[1].variacion, -50)
    assert.equal(r[1].cobrado, 100)
  })
})

describe('lecturas del mes', () => {
  const base = (cambios: Partial<DatosInsights> = {}): DatosInsights => {
    const ranking = rankingVendedores([vend(1, 'Ana', 800_000, 8), vend(2, 'Beto', 200_000, 2)], [vend(1, 'Ana', 500_000, 5), vend(2, 'Beto', 400_000, 4)], [])
    return {
      mes: '2026-10',
      hoy: '2026-11-17',
      momento: 'cobro',
      porcentajeGeneral: 3,
      ranking,
      baseMes: 1_000_000,
      baseMesAnterior: 900_000,
      ventasMes: [venta(1, 1_000_000, 1_000_000, '2026-10-05')],
      ventasPeriodo: [],
      vendedores: [],
      pendienteTotal: 0,
      liquidacionesSinPagar: [],
      ...cambios
    }
  }

  it('avisa vendedores en 0% cuando el general también es 0', () => {
    const i = insightsComisiones(
      base({ porcentajeGeneral: 0, vendedores: [{ id_usuario: 1, nombre: 'Ana', porcentaje: 0, activo: true, ventas: 3 }] })
    )
    assert.equal(i[0].id, 'sin-porcentaje')
    assert.equal(i[0].tono, 'danger')
  })

  it('con "al cobrar", la baja cobranza es una advertencia con la comisión en espera', () => {
    const i = insightsComisiones(base({ ventasMes: [venta(1, 1000, 300, '2026-10-05')] }))
    const c = i.find((x) => x.id === 'cobranza')
    assert.ok(c)
    assert.equal(c.tono, 'warn')
    assert.match(c.detalle, /recién se gana/)
  })

  it('detecta ventas con más de 30 días sin cobrar', () => {
    const i = insightsComisiones(base({ ventasPeriodo: [venta(1, 5000, 1000, '2026-09-01'), venta(1, 5000, 0, '2026-11-10')] }))
    const v = i.find((x) => x.id === 'viejas')
    assert.ok(v)
    assert.match(v.titulo, /^1 venta con más de 30 días/)
  })

  it('concentración, subas y bajas por vendedor', () => {
    const i = insightsComisiones(base())
    assert.ok(i.find((x) => x.id === 'concentracion'), 'Ana tiene el 80%')
    assert.ok(i.find((x) => x.id === 'subio-1'), 'Ana subió 60%')
    assert.ok(i.find((x) => x.id === 'bajo-2'), 'Beto bajó 50%')
  })

  it('en el mes en curso proyecta el cierre', () => {
    const i = insightsComisiones(base({ mes: '2026-11', ventasMes: [venta(1, 1_000_000, 1_000_000)] }))
    const p = i.find((x) => x.id === 'proyeccion')
    assert.ok(p)
    assert.match(p.titulo, /cerraría en/)
  })

  it('las liquidaciones aprobadas sin pagar van antes que lo informativo', () => {
    const i = insightsComisiones(base({ liquidacionesSinPagar: [{ estado: 'aprobada', total: 5000, periodo: '2026-10-01' }] }))
    const idx = i.findIndex((x) => x.id === 'aprobadas')
    assert.ok(idx >= 0)
    assert.ok(i.slice(0, idx).every((x) => x.tono === 'danger' || x.tono === 'warn'))
  })
})

describe('configuración', () => {
  it('% efectivo: propio, general si no tiene, 0 si no comisiona', () => {
    assert.equal(porcentajeEfectivo({ porcentaje: 5, activo: true }, 3), 5)
    assert.equal(porcentajeEfectivo({ porcentaje: null, activo: true }, 3), 3)
    assert.equal(porcentajeEfectivo({ porcentaje: 0, activo: true }, 3), 0, '0% propio pisa al general')
    assert.equal(porcentajeEfectivo({ porcentaje: 5, activo: false }, 3), 0)
  })

  it('avisa a quien quedó con 0% propio aunque el general no sea 0', () => {
    const i = insightsComisiones({
      mes: '2026-10', hoy: '2026-11-17', momento: 'cobro', porcentajeGeneral: 3, ranking: [], baseMes: 0, baseMesAnterior: 0,
      ventasMes: [], ventasPeriodo: [], pendienteTotal: 0, liquidacionesSinPagar: [],
      vendedores: [
        { id_usuario: 1, nombre: 'Ana', porcentaje: 0, activo: true, ventas: 4 },
        { id_usuario: 2, nombre: 'Beto', porcentaje: null, activo: true, ventas: 4 }
      ]
    })
    const s = i.find((x) => x.id === 'sin-porcentaje')
    assert.ok(s)
    assert.match(s.detalle, /^Ana: tiene 0% propio en vez del general \(3%\)/)
  })

  it('estima la comisión del mes según cuándo se gana', () => {
    const ventas = [venta(1, 1000, 400), venta(2, 2000, 2000), venta(1, 500, 0, '2026-11-10', { estado_pago: 'Cancelado' })]
    const pct = (id: number | null) => (id === 1 ? 10 : 5)
    assert.equal(estimarComisionMes(ventas, 'cobro', pct), 40 + 100)
    assert.equal(estimarComisionMes(ventas, 'venta', pct), 100 + 100)
    assert.equal(estimarComisionMes(ventas, 'factura', pct), null)
  })

  it('venta necesaria para una comisión objetivo', () => {
    assert.equal(ventaNecesaria(30000, 3), 1_000_000)
    assert.equal(ventaNecesaria(30000, 0), null)
  })
})

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  aplanar,
  claveDe,
  compararCodigos,
  construirArbol,
  controlesPlan,
  ecuacionPatrimonial,
  filtrarArbol,
  necesitaReestructurar,
  saldoNatural,
  type CuentaPC,
  type MovimientoPC
} from './planCuentas.ts'

let id = 0
const cta = (codigo: string, nombre: string, tipo: CuentaPC['tipo'], naturaleza: CuentaPC['naturaleza'], extra: Partial<CuentaPC> = {}): CuentaPC => ({
  id: ++id,
  codigo,
  nombre,
  tipo,
  naturaleza,
  nivel: codigo.split('.').length,
  activa: true,
  ...extra
})

// Plan nuevo, reducido
const plan: CuentaPC[] = [
  cta('1', 'ACTIVO', 'Activo', 'Deudora'),
  cta('1.1', 'Activo corriente', 'Activo', 'Deudora'),
  cta('1.1.1', 'Caja y bancos', 'Activo', 'Deudora'),
  cta('1.1.1.01', 'Caja', 'Activo', 'Deudora'),
  cta('1.1.1.02', 'Bancos cuenta corriente', 'Activo', 'Deudora'),
  cta('1.1.3', 'Créditos por ventas', 'Activo', 'Deudora'),
  cta('1.1.3.01', 'Deudores por ventas', 'Activo', 'Deudora'),
  cta('1.1.3.09', 'Previsión para deudores incobrables', 'Activo', 'Acreedora'),
  cta('1.1.4', 'Otros créditos', 'Activo', 'Deudora'),
  cta('1.1.4.01', 'IVA Crédito Fiscal', 'Activo', 'Deudora'),
  cta('2', 'PASIVO', 'Pasivo', 'Acreedora'),
  cta('2.1', 'Pasivo corriente', 'Pasivo', 'Acreedora'),
  cta('2.1.1', 'Deudas comerciales', 'Pasivo', 'Acreedora'),
  cta('2.1.1.01', 'Proveedores', 'Pasivo', 'Acreedora'),
  cta('2.1.3', 'Deudas fiscales', 'Pasivo', 'Acreedora'),
  cta('2.1.3.01', 'IVA Débito Fiscal', 'Pasivo', 'Acreedora'),
  cta('3', 'PATRIMONIO NETO', 'Patrimonio', 'Acreedora'),
  cta('3.1.1.01', 'Capital social', 'Patrimonio', 'Acreedora'),
  cta('4', 'INGRESOS', 'Ingreso', 'Acreedora'),
  cta('4.1.1.01', 'Ventas de productos', 'Ingreso', 'Acreedora'),
  cta('6', 'GASTOS', 'Gasto', 'Deudora'),
  cta('6.1.2.01', 'Alquiler del local', 'Gasto', 'Deudora')
]

// Capital 1000 a caja; venta 1210 (1000 + IVA 210) a deudores; alquiler 300 pagado por banco... con banco en 0 → saldo contrario
const movs = new Map<string, MovimientoPC>([
  ['1.1.1.01', { debe: 1000, haber: 0 }],
  ['3.1.1.01', { debe: 0, haber: 1000 }],
  ['1.1.3.01', { debe: 1210, haber: 0 }],
  ['4.1.1.01', { debe: 0, haber: 1000 }],
  ['2.1.3.01', { debe: 0, haber: 210 }],
  ['6.1.2.01', { debe: 300, haber: 0 }],
  ['1.1.1.02', { debe: 0, haber: 300 }]
])

describe('árbol', () => {
  it('orden natural de códigos', () => {
    assert.ok(compararCodigos('1.1.10', '1.1.9') > 0)
    assert.ok(compararCodigos('1.1', '1.1.1') < 0)
  })

  it('jerarquía por código, imputables = hojas, saldos que suben a los rubros', () => {
    const arbol = construirArbol(plan, movs)
    assert.deepEqual(arbol.map((r) => r.codigo), ['1', '2', '3', '4', '6'])
    const activo = arbol[0]
    assert.equal(activo.imputable, false)
    assert.equal(activo.saldoDH, 1000 - 300 + 1210)
    const capital = aplanar(arbol).find((n) => n.codigo === '3.1.1.01')!
    assert.equal(capital.imputable, true)
    // 3.1.1.01 cuelga de 3 aunque no existan 3.1 ni 3.1.1
    assert.equal(arbol[2].hijos[0].codigo, '3.1.1.01')
    assert.equal(saldoNatural(arbol[1]), 210, 'pasivo con saldo acreedor positivo')
  })

  it('regularizadoras: naturaleza contraria a la de su tipo', () => {
    const prev = aplanar(construirArbol(plan)).find((n) => n.codigo === '1.1.3.09')!
    assert.equal(prev.regularizadora, true)
  })

  it('filtrar conserva los rubros del camino', () => {
    const f = filtrarArbol(construirArbol(plan), (n) => /iva d/i.test(n.nombre))
    assert.deepEqual(aplanar(f).map((n) => n.codigo), ['2', '2.1', '2.1.3', '2.1.3.01'])
  })
})

describe('ecuación patrimonial', () => {
  it('Activo = Pasivo + PN + Resultado', () => {
    const e = ecuacionPatrimonial(plan, movs)
    assert.deepEqual(e, { activo: 1910, pasivo: 210, patrimonio: 1000, resultado: 700, diferencia: 0 })
  })
})

describe('controles', () => {
  it('plan sano: sin errores; avisa el banco con saldo acreedor', () => {
    const c = controlesPlan(plan, movs)
    assert.equal(c.filter((x) => x.nivel === 'error').length, 0, JSON.stringify(c))
    const contrario = c.find((x) => x.codigo === 'saldo-contrario')
    assert.deepEqual(contrario?.cuentas, ['1.1.1.02 Bancos cuenta corriente'])
    assert.ok(c.find((x) => x.codigo === 'huerfanas'), '3.1.1.01 sin 3.1.1')
  })

  it('plan viejo: IVA cruzado, faltan cuentas del sistema y pide reestructurar', () => {
    const viejo: CuentaPC[] = [
      cta('1', 'ACTIVO', 'Activo', 'Deudora'),
      cta('1.1.1.03', 'Clientes', 'Activo', 'Deudora'),
      cta('1.1.2.01', 'IVA Débito Fiscal', 'Pasivo', 'Acreedora'),
      cta('2', 'PASIVO', 'Pasivo', 'Acreedora'),
      cta('2.1.2.01', 'IVA Crédito Fiscal', 'Activo', 'Deudora')
    ]
    const c = controlesPlan(viejo)
    const cruzado = c.find((x) => x.codigo === 'tipo-cruzado')
    assert.equal(cruzado?.nivel, 'error')
    assert.equal(cruzado?.cuentas.length, 2)
    assert.ok(c.find((x) => x.codigo === 'sistema'))
    assert.equal(necesitaReestructurar(viejo), true)
    assert.equal(necesitaReestructurar(plan), false)
  })

  it('clave de sistema: de la base o por código', () => {
    assert.equal(claveDe({ codigo: '2.1.3.01', clave_sistema: null }), 'iva_debito')
    assert.equal(claveDe({ codigo: '9.9', clave_sistema: 'caja' }), 'caja')
    assert.equal(claveDe({ codigo: '6.1.2.01' }), null)
  })
})

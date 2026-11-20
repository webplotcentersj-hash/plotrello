import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  EMPLEADO_LEGAL_DEFAULT,
  calcularCargasLegales,
  parametrosLegalesDefault,
  remuneracionDeclarada,
  topesSipaPeriodo,
  type SnapshotLibroEmpleado
} from './rrhhCargasLegales.ts'
import { CARGAS_SOCIALES_DEFAULT } from './liquidacionMensual.ts'
import {
  ALICUOTAS_LCT_DEFAULT,
  aplicarLiquidacionAItem,
  liquidarRecibo,
  round2,
  type RrhhLibroSueldos,
  type RrhhLibroSueldosItem
} from './rrhhLibroSueldos.ts'
import { armarTxtLsd } from './exportLibroSueldosLsd.ts'

const P_NOV = parametrosLegalesDefault('2026-11')

function item(): RrhhLibroSueldosItem {
  return {
    id: 1,
    id_libro: 1,
    id_usuario: 7,
    incluido: true,
    n_legajo: 7,
    apellido_nombre: 'Prueba Ana',
    cuil: '27123456784',
    categoria: 'Operario',
    fecha_ingreso: '2023-01-10',
    antiguedad_reconocida: 0,
    anios_antiguedad: 0,
    dias: 30,
    etiqueta_basico: 'Sueldo básico',
    sueldo_basico: 0,
    adicional_antiguedad: 0,
    scvo: 0,
    banco: null,
    cbu: '0110599520000001234567',
    forma_pago: '3',
    conyuge: false,
    hijos: 0,
    cct: true,
    cct_codigo: '0409/05',
    cobertura_scvo: true,
    situacion_revista: '01',
    condicion: '01',
    actividad: '049',
    modalidad: '001',
    codigo_os: '000000',
    horas_trabajadas: 0,
    extras: []
  }
}

function libro(periodo: string, legal?: RrhhLibroSueldos['alicuotas']['legal']): RrhhLibroSueldos {
  return {
    id: 1,
    periodo,
    estado: 'borrador',
    empresa_nombre: 'EMPRESA',
    empresa_domicilio: 'Calle 1',
    empresa_cuit: '30715518801',
    jurisdiccion: 'SAN JUAN',
    cct_default: '0409/05',
    art_codigo: '00000',
    scvo_cia: '',
    banco: null,
    fecha_pago: null,
    scvo_default: 0,
    os_base_mult: 2,
    nro_liquidacion: 1,
    dias_base: 30,
    tipo_empleador: '1',
    codigo_actividad: '049',
    codigo_localidad: '00',
    codigo_os_default: null,
    importe_detraer: 0,
    alicuotas: { ...ALICUOTAS_LCT_DEFAULT, ...(legal ? { legal } : {}) },
    notas: null,
    id_lote_recibos: null,
    created_by: null,
    created_at: '2026-11-01T00:00:00Z'
  }
}

describe('cargas legales', () => {
  it('usa el tope ANSES del período', () => {
    assert.equal(topesSipaPeriodo('2026-11').maxima, 4861685.38)
    assert.equal(topesSipaPeriodo('2026-10').maxima, 4769631.49)
    assert.equal(topesSipaPeriodo('2027-03').desactualizado, true)
  })

  it('FAL: se detrae de SIPA sin cambiar el costo total, desde el período configurado', () => {
    const sin = calcularCargasLegales({
      periodo: '2026-11',
      remuneracion: 1000000,
      cargas: CARGAS_SOCIALES_DEFAULT,
      parametros: P_NOV,
      empleado: EMPLEADO_LEGAL_DEFAULT
    })
    assert.equal(sin.fal, 0)
    const con = calcularCargasLegales({
      periodo: '2026-12',
      remuneracion: 1000000,
      cargas: CARGAS_SOCIALES_DEFAULT,
      parametros: P_NOV,
      empleado: EMPLEADO_LEGAL_DEFAULT
    })
    assert.equal(con.fal, 25000)
    assert.equal(con.contribuciones.find((c) => c.id === 'co-fal')?.importe, 25000)
    assert.equal(con.contribuciones.find((c) => c.id === 'co-jub')?.importe, 107700 - 25000)
    assert.equal(con.totalContribuciones, sin.totalContribuciones)
  })

  it('RIFL: SIPA + INSSJP + AAFF + FNE suman 5%; OS sigue en 6%; sin FAL', () => {
    const r = calcularCargasLegales({
      periodo: '2026-12',
      remuneracion: 1000000,
      cargas: CARGAS_SOCIALES_DEFAULT,
      parametros: P_NOV,
      empleado: { ...EMPLEADO_LEGAL_DEFAULT, rifl: true }
    })
    const ss = r.contribuciones
      .filter((c) => ['co-jub', 'co-pami', 'co-af', 'co-fne'].includes(c.id))
      .reduce((s, c) => s + c.importe, 0)
    assert.ok(Math.abs(ss - 50000) < 1)
    assert.equal(r.contribuciones.find((c) => c.id === 'co-os')?.importe, 60000)
    assert.equal(r.fal, 0)
  })

  it('detracción: baja la base de contribuciones SS pero no la de OS', () => {
    const r = calcularCargasLegales({
      periodo: '2026-11',
      remuneracion: 500000,
      cargas: CARGAS_SOCIALES_DEFAULT,
      parametros: { ...P_NOV, detraccion: 7003.68 },
      empleado: EMPLEADO_LEGAL_DEFAULT
    })
    assert.equal(r.contribuciones.find((c) => c.id === 'co-jub')?.base, 492996.32)
    assert.equal(r.contribuciones.find((c) => c.id === 'co-os')?.base, 500000)
  })

  it('remuneración declarada: inasistencias y suspensión no son remuneración', () => {
    const r = remuneracionDeclarada({
      sueldoMensual: 600000,
      factorProporcional: 1,
      antiguedadAnios: 2,
      pctAntiguedad: 1,
      horasHe50: 4,
      importeHe50: 30000,
      horasHe100: 0,
      importeHe100: 0,
      diasInasistencia: 2,
      diasSuspension: 1,
      diasMediaJornada: 0
    })
    assert.equal(r.antiguedad, 12000)
    assert.equal(r.valorDia, 20400)
    assert.equal(r.remuneracion, round2(600000 + 12000 + 30000 - 3 * 20400))
    assert.equal(r.diasPagos, 27)
  })
})

describe('libro ← liquidación', () => {
  const snap: SnapshotLibroEmpleado = {
    sueldoMensual: 600000,
    factorProporcional: 1,
    antiguedadAnios: 2,
    pctAntiguedad: 1,
    horasHe50: 4,
    importeHe50: 30000,
    horasHe100: 0,
    importeHe100: 0,
    diasInasistencia: 2,
    diasSuspension: 0,
    diasMediaJornada: 0,
    legal: { ...EMPLEADO_LEGAL_DEFAULT },
    generado: ''
  }

  it('el bruto y los aportes del recibo son los de la liquidación', () => {
    const it0: RrhhLibroSueldosItem = {
      ...item(),
      extras: [{ id: 'm', concepto: 'Premio', tipo: 'no_remunerativo', unidad: '', base: null, monto: 5000, codigo_lsd: 'PREMIO' }]
    }
    const it1 = aplicarLiquidacionAItem(it0, snap, '0409/05')
    const legal = {
      version: 1 as const,
      origen: 'liquidacion' as const,
      parametros: P_NOV,
      cargas: CARGAS_SOCIALES_DEFAULT,
      empleados: { '7': snap.legal }
    }
    const liq = liquidarRecibo({ item: it1, libro: libro('2026-11', legal) })
    const decl = remuneracionDeclarada(snap)
    const cargas = calcularCargasLegales({
      periodo: '2026-11',
      remuneracion: decl.remuneracion,
      cargas: CARGAS_SOCIALES_DEFAULT,
      parametros: P_NOV,
      empleado: snap.legal
    })
    assert.equal(liq.bruto, decl.remuneracion)
    assert.equal(liq.descuentos, cargas.totalAportes)
    // El concepto manual del libro se conserva; los de la liquidación se agregan.
    assert.ok(it1.extras.some((x) => x.id === 'm'))
    assert.ok(it1.extras.some((x) => x.origen === 'liq' && x.codigo_lsd === 'INASIST' && x.monto < 0))
    // Volver a sincronizar no duplica.
    const it2 = aplicarLiquidacionAItem(it1, snap, '0409/05')
    assert.equal(it2.extras.length, it1.extras.length)
  })

  it('TXT LSD: incluye extras por % e inasistencias como débito', () => {
    const it1 = aplicarLiquidacionAItem(
      {
        ...item(),
        extras: [{ id: 'p', concepto: 'Presentismo', tipo: 'remunerativo' as const, unidad: '8,33%', base: null, monto: 0, codigo_lsd: 'PRESENT' }]
      },
      snap,
      '0409/05'
    )
    const { text, errores } = armarTxtLsd(libro('2026-11'), [it1])
    assert.deepEqual(errores, [])
    const lines = text.trim().split(/\r\n/)
    assert.ok(lines.some((l) => l.startsWith('03') && l.includes('PRESENT')))
    const inas = lines.find((l) => l.startsWith('03') && l.includes('INASIST'))
    assert.ok(inas)
    assert.equal(inas!.slice(44, 45), 'D')
  })
})

describe('conceptos para ARCA', () => {
  it('lista los del sistema y suma una vez cada código extra del período', async () => {
    const { conceptosParaArca, conceptosParaArcaCsv } = await import('./rrhhLibroSueldos.ts')
    const extra = { id: 'p', concepto: 'Presentismo', tipo: 'remunerativo' as const, unidad: '8,33%', base: null, monto: 0, codigo_lsd: 'PRESENT' }
    const lista = conceptosParaArca([{ extras: [extra] }, { extras: [{ ...extra, id: 'q' }] }])
    for (const cod of ['SUELDO', 'HE50', 'INASIST', 'SUSPSG', 'MEDIAJ', 'TARDANZA', 'JUB']) {
      assert.ok(lista.some((c) => c.codigo === cod), cod)
    }
    assert.equal(lista.filter((c) => c.codigo === 'PRESENT').length, 1)
    assert.match(conceptosParaArcaCsv(lista), /"TARDANZA";"Tardanzas \(tiempo no trabajado\)";"Remunerativo \(resta\)"/)
  })
})

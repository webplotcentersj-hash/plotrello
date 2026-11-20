import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  ALICUOTAS_LCT_DEFAULT,
  aniosAntiguedadAlPeriodo,
  formatAntiguedadReconocida,
  liquidarRecibo,
  mesesReconocidosEfectivos,
  parseImporteInput,
  tituloReciboPeriodo,
  round2,
  type RrhhLibroSueldos,
  type RrhhLibroSueldosItem
} from './rrhhLibroSueldos.ts'
import { armarTxtLsd, longitudesRegistrosLsd } from './exportLibroSueldosLsd.ts'

function itemEvelyn(): RrhhLibroSueldosItem {
  return {
    id: 1,
    id_libro: 1,
    id_usuario: 1,
    incluido: true,
    n_legajo: 1,
    apellido_nombre: 'Andrade Evelyn Alejandra',
    cuil: '23350912924',
    categoria: 'Administrativo 1°',
    fecha_ingreso: '2025-02-01',
    antiguedad_reconocida: 12,
    anios_antiguedad: 1,
    dias: 30,
    etiqueta_basico: 'Sueldo básico medio día',
    sueldo_basico: 137622.31,
    adicional_antiguedad: 7442.14,
    scvo: 424.62,
    banco: null,
    cbu: null,
    forma_pago: '1',
    conyuge: false,
    hijos: 0,
    cct: true,
    cct_codigo: '9999/99',
    cobertura_scvo: true,
    situacion_revista: '01',
    condicion: '01',
    actividad: '049',
    modalidad: '008',
    codigo_os: '000000',
    horas_trabajadas: 0,
    extras: []
  }
}

function libroAgosto(): RrhhLibroSueldos {
  return {
    id: 1,
    periodo: '2026-08',
    estado: 'borrador',
    empresa_nombre: 'PLOT CENTER SRL',
    empresa_domicilio: 'Avenida Libertador Este 580, San Juan',
    empresa_cuit: '30715518801',
    jurisdiccion: 'SAN JUAN',
    cct_default: '0409/05',
    art_codigo: '00000',
    scvo_cia: 'S880 EXPERTA SEGUROS',
    banco: null,
    fecha_pago: '2026-09-05',
    scvo_default: 424.62,
    os_base_mult: 2,
    nro_liquidacion: 1,
    dias_base: 30,
    tipo_empleador: '1',
    codigo_actividad: '049',
    codigo_localidad: '00',
    codigo_os_default: null,
    importe_detraer: 0,
    alicuotas: { ...ALICUOTAS_LCT_DEFAULT },
    notas: null,
    id_lote_recibos: null,
    created_by: null,
    created_at: '2026-08-01T00:00:00Z'
  }
}

describe('libro de sueldos LCT', () => {
  it('recibo de Evelyn (agosto 2026): jornada parcial y fuera de convenio', () => {
    const liq = liquidarRecibo({ item: itemEvelyn(), libro: libroAgosto() })
    const emp = (id: string) => liq.lineasEmpleador.find((l) => l.id === id)?.montoEmpleador
    const trab = (id: string) => liq.lineasTrabajador.find((l) => l.id === id)?.descuento
    assert.equal(liq.bruto, 145064.45)
    // Medio día (modalidad 008): OS sobre jornada completa (art. 92 ter LCT) = bruto × 2.
    assert.equal(liq.baseOs, 290128.9)
    assert.equal(emp('co-jub'), 15623.44)
    assert.equal(emp('co-pami'), 2306.52)
    assert.equal(emp('co-os'), 17407.73)
    assert.equal(emp('co-af'), 6818.03)
    assert.equal(emp('co-fne'), 1363.61)
    // 9999/99 (excluida de convenio): sin cuota ni contribución sindical.
    assert.equal(emp('co-sind'), undefined)
    assert.equal(trab('ap-sind'), undefined)
    assert.equal(liq.lineasEmpleador.find((l) => l.id === 'scvo')?.montoEmpleador, 424.62)
    assert.equal(liq.contribuciones, 43943.95)
    // 11% + 3% sobre bruto, 3% OS sobre jornada completa.
    assert.equal(trab('ap-jub'), 15957.09)
    assert.equal(trab('ap-pami'), 4351.93)
    assert.equal(trab('ap-os'), 8703.87)
    assert.equal(liq.descuentos, 29012.89)
    assert.equal(liq.neto, 116051.56)
    assert.equal(round2(liq.bruto + liq.contribuciones), liq.costoEmpleador)
  })

  it('cobra sindicato solo dentro de convenio', () => {
    const dentro = liquidarRecibo({ item: { ...itemEvelyn(), cct_codigo: '0409/05' }, libro: libroAgosto() })
    assert.equal(dentro.lineasTrabajador.find((l) => l.id === 'ap-sind')?.descuento, 2901.29)
    assert.equal(dentro.lineasEmpleador.find((l) => l.id === 'co-sind')?.montoEmpleador, 1087.98)
  })

  it('jornada completa: la base de obra social es el bruto', () => {
    const liq = liquidarRecibo({ item: { ...itemEvelyn(), modalidad: '001' }, libro: libroAgosto() })
    assert.equal(liq.baseOs, liq.bruto)
  })

  it('topa los aportes en la base imponible máxima y no las contribuciones', () => {
    const item = { ...itemEvelyn(), modalidad: '001', sueldo_basico: 6000000, adicional_antiguedad: 0 }
    const libro = { ...libroAgosto(), periodo: '2026-11' }
    const liq = liquidarRecibo({ item, libro })
    assert.equal(liq.topeAplicado, true)
    assert.equal(liq.bases.aportes, 4861685.38)
    assert.equal(liq.lineasTrabajador.find((l) => l.id === 'ap-jub')?.descuento, round2(4861685.38 * 0.11))
    assert.equal(liq.lineasEmpleador.find((l) => l.id === 'co-jub')?.montoEmpleador, round2(6000000 * 0.1077))
  })

  it('titula el recibo por mes', () => {
    assert.match(tituloReciboPeriodo('2026-11'), /Noviembre.*2026/i)
    assert.match(tituloReciboPeriodo('2026-08'), /Agosto.*2026/i)
  })

  it('parsea importes con coma o punto', () => {
    assert.equal(parseImporteInput('145064,45'), 145064.45)
    assert.equal(parseImporteInput('145.064,45'), 145064.45)
    assert.equal(parseImporteInput('137622.31'), 137622.31)
    assert.equal(parseImporteInput('150.000'), 150000)
    assert.equal(parseImporteInput('1.500.000'), 1500000)
    assert.equal(parseImporteInput('22.500'), 22500)
    assert.equal(parseImporteInput('22.50'), 22.5)
    assert.equal(parseImporteInput(''), null)
  })

  it('descuento extra baja el neto del empleado y aparece en recibo', () => {
    const base = liquidarRecibo({ item: itemEvelyn(), libro: libroAgosto() })
    const conDesc = liquidarRecibo({
      item: {
        ...itemEvelyn(),
        extras: [
          {
            id: 'd1',
            concepto: 'Retención Judicial',
            tipo: 'descuento',
            unidad: '',
            base: null,
            monto: 10000,
            codigo_lsd: ''
          }
        ]
      },
      libro: libroAgosto()
    })
    assert.equal(conDesc.descuentos, round2(base.descuentos + 10000))
    assert.equal(conDesc.neto, round2(base.neto - 10000))
    assert.ok(conDesc.lineasTrabajador.some((l) => l.concepto === 'Retención Judicial' && l.descuento === 10000))
  })

  it('descuento extra por % en unidad se aplica debajo de obra social y baja el neto', () => {
    const base = liquidarRecibo({ item: itemEvelyn(), libro: libroAgosto() })
    const conPct = liquidarRecibo({
      item: {
        ...itemEvelyn(),
        extras: [
          {
            id: 'd2',
            concepto: 'Retención Judicial',
            tipo: 'descuento',
            unidad: '22%',
            base: null,
            monto: 0,
            codigo_lsd: ''
          }
        ]
      },
      libro: libroAgosto()
    })
    const esperado = round2(base.bruto * 0.22)
    assert.equal(conPct.descuentos, round2(base.descuentos + esperado))
    assert.equal(conPct.neto, round2(base.neto - esperado))
    const linea = conPct.lineasTrabajador.find((l) => l.concepto === 'Retención Judicial')
    assert.ok(linea)
    assert.equal(linea!.descuento, esperado)
    assert.equal(linea!.base, base.bruto)
    const idxOs = conPct.lineasTrabajador.findIndex((l) => l.id === 'ap-os')
    const idxRet = conPct.lineasTrabajador.findIndex((l) => l.concepto === 'Retención Judicial')
    assert.ok(idxOs >= 0 && idxRet > idxOs)
  })

  it('antigüedad en años al cierre del período', () => {
    assert.equal(aniosAntiguedadAlPeriodo('2025-02-01', '2026-08'), 1)
    assert.equal(aniosAntiguedadAlPeriodo('2025-02-01', '2026-01'), 0)
  })

  it('formatea antigüedad reconocida solo en años para el recibo', () => {
    assert.equal(formatAntiguedadReconocida(0), '')
    assert.equal(formatAntiguedadReconocida(11), '')
    assert.equal(formatAntiguedadReconocida(12), '1 año')
    assert.equal(formatAntiguedadReconocida(20), '1 año')
    assert.equal(formatAntiguedadReconocida(39), '3 años')
  })

  it('corrige años cargados por error en el campo de meses', () => {
    assert.equal(
      mesesReconocidosEfectivos({
        antiguedad_reconocida: 3,
        anios_antiguedad: 3,
        fecha_ingreso: '2023-08-17',
        periodo: '2026-11'
      }),
      39
    )
    assert.equal(
      mesesReconocidosEfectivos({
        antiguedad_reconocida: 20,
        anios_antiguedad: 1,
        fecha_ingreso: '2025-02-01',
        periodo: '2026-11'
      }),
      20
    )
  })

  it('TXT LSD: longitudes 01=35 02=115 03=51 04=370', () => {
    const lens = longitudesRegistrosLsd(libroAgosto(), itemEvelyn())
    assert.equal(lens.r01, 35)
    assert.equal(lens.r02, 115)
    assert.equal(lens.r03, 51)
    assert.equal(lens.r04, 370)
    const { text, nTrab, errores } = armarTxtLsd(libroAgosto(), [itemEvelyn()])
    assert.equal(nTrab, 1)
    assert.equal(errores.length, 0)
    const lines = text.trim().split(/\r\n/)
    assert.equal(lines[0].startsWith('01'), true)
    assert.equal(lines[0].slice(13, 15), 'SJ')
    assert.ok(lines.some((l) => l.startsWith('02')))
    assert.ok(lines.some((l) => l.startsWith('03') && l.includes('SUELDO')))
    assert.ok(lines.some((l) => l.startsWith('04')))
  })
})

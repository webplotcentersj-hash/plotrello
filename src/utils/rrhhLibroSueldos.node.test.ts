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
  it('repite el recibo de Evelyn (agosto 2026)', () => {
    const liq = liquidarRecibo({ item: itemEvelyn(), libro: libroAgosto() })
    assert.equal(liq.bruto, 145064.45)
    assert.equal(liq.baseOs, 290128.9)
    assert.equal(liq.lineasEmpleador[0].montoEmpleador, 15623.44)
    assert.equal(liq.lineasEmpleador[1].montoEmpleador, 2306.52)
    assert.equal(liq.lineasEmpleador[2].montoEmpleador, 17407.73)
    assert.equal(liq.lineasEmpleador[3].montoEmpleador, 6818.03)
    assert.equal(liq.lineasEmpleador[4].montoEmpleador, 1363.61)
    assert.equal(liq.lineasEmpleador[5].montoEmpleador, 1087.98)
    assert.equal(liq.lineasEmpleador[6].montoEmpleador, 424.62)
    assert.equal(liq.contribuciones, 45031.93)
    assert.equal(liq.descuentos, 31914.18)
    assert.equal(liq.neto, 113150.27)
    assert.equal(round2(liq.bruto + liq.contribuciones), liq.costoEmpleador)
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
    const idxOs = conPct.lineasTrabajador.findIndex((l) => l.concepto === 'Obra Social')
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

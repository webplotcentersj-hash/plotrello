import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  diasEntreInclusive,
  mapearSolicitudANovedad,
  rangoFechasSolicitud,
  solicitudImpactaAsistencia
} from './rrhhPermisoAprobadoImpacto.ts'

describe('rrhhPermisoAprobadoImpacto', () => {
  it('mapea vacaciones y ausencia a novedades que liquidación no descuenta', () => {
    assert.deepEqual(
      mapearSolicitudANovedad({ tipo_solicitud: 'vacaciones', titulo: 'Vacaciones', descripcion: null }),
      { grupo: 'licencia', codigo: 'licencia_vacaciones', diaCompleto: true }
    )
    assert.equal(
      mapearSolicitudANovedad({
        tipo_solicitud: 'ausencia',
        titulo: 'Ausencia: Enfermedad / consulta médica',
        descripcion: null
      })?.codigo,
      'falta_justificada_enfermedad'
    )
    assert.equal(
      mapearSolicitudANovedad({
        tipo_solicitud: 'permiso',
        titulo: 'Retirarme temprano',
        descripcion: null
      })?.codigo,
      'retiro_anticipado'
    )
    assert.equal(solicitudImpactaAsistencia('turno'), false)
    assert.equal(solicitudImpactaAsistencia('ropa'), false)
  })

  it('acota rangos con fecha inválida o typo de año', () => {
    const ok = rangoFechasSolicitud({
      fecha_inicio: '2026-11-10',
      fecha_fin: '2026-11-12',
      fecha_solicitud: '2026-11-09'
    })
    assert.deepEqual(ok, { desde: '2026-11-10', hasta: '2026-11-12' })
    assert.deepEqual(diasEntreInclusive('2026-11-10', '2026-11-12'), [
      '2026-11-10',
      '2026-11-11',
      '2026-11-12'
    ])

    const typo = rangoFechasSolicitud({
      fecha_inicio: '2026-05-26',
      fecha_fin: '20206-06-02',
      fecha_solicitud: '2026-05-26'
    })
    assert.deepEqual(typo, { desde: '2026-05-26', hasta: '2026-05-26' })

    const sinInicio = rangoFechasSolicitud({
      fecha_inicio: null,
      fecha_fin: null,
      fecha_solicitud: '2026-11-05'
    })
    assert.deepEqual(sinInicio, { desde: '2026-11-05', hasta: '2026-11-05' })
  })
})

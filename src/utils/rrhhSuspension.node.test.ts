import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { RrhhNovedad } from '../types/api.ts'
import {
  diaEnMediaJornadaPostSuspension,
  diaEnSuspension,
  diaSiguienteIso
} from './rrhhSuspension.ts'

function nov(parcial: Partial<RrhhNovedad> & Pick<RrhhNovedad, 'codigo' | 'fecha_desde' | 'fecha_hasta'>): RrhhNovedad {
  return {
    id: 1,
    id_usuario: 1,
    id_solicitud_permiso: null,
    grupo: 'suspension',
    duracion_minutos: null,
    horas_extra_cantidad: null,
    observaciones: null,
    adjuntos: [],
    registrado_por: null,
    firma_data_url: null,
    firmado_at: null,
    created_at: '',
    updated_at: '',
    ...parcial
  }
}

describe('rrhh suspensión / media jornada', () => {
  it('diaSiguienteIso avanza el calendario', () => {
    assert.equal(diaSiguienteIso('2026-10-31'), '2026-11-01')
  })

  it('cubre el período de suspensión y no media jornada durante ese lapso', () => {
    const list = [nov({ codigo: 'suspension', fecha_desde: '2026-10-01', fecha_hasta: '2026-10-05' })]
    assert.equal(diaEnSuspension(list, 1, '2026-10-03'), true)
    assert.equal(diaEnMediaJornadaPostSuspension(list, 1, '2026-10-03'), false)
    assert.equal(diaEnSuspension(list, 1, '2026-10-06'), false)
    assert.equal(diaEnMediaJornadaPostSuspension(list, 1, '2026-10-06'), true)
  })

  it('restituir_jornada corta la media jornada', () => {
    const list = [
      nov({ id: 1, codigo: 'suspension', fecha_desde: '2026-10-01', fecha_hasta: '2026-10-05' }),
      nov({ id: 2, codigo: 'restituir_jornada', fecha_desde: '2026-10-20', fecha_hasta: '2026-10-20' })
    ]
    assert.equal(diaEnMediaJornadaPostSuspension(list, 1, '2026-10-19'), true)
    assert.equal(diaEnMediaJornadaPostSuspension(list, 1, '2026-10-20'), false)
    assert.equal(diaEnMediaJornadaPostSuspension(list, 1, '2026-10-21'), false)
  })
})

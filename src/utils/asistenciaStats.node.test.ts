import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { Asistencia, RrhhNovedad } from '../types/api.ts'
import { evaluarDiaAsistencia } from './asistenciaStats.ts'

function asis(partial: Partial<Asistencia>): Asistencia {
  return {
    id: 1,
    id_usuario: 82,
    fecha: '2026-10-19',
    hora_entrada: null,
    hora_salida: null,
    horas_trabajadas: null,
    tipo_registro: 'normal',
    observaciones: null,
    created_at: '',
    updated_at: '',
    ...partial
  }
}

function novTardanza(minutos = 80): RrhhNovedad {
  return {
    id: 1408,
    id_usuario: 82,
    id_solicitud_permiso: null,
    grupo: 'tardanza_retiro',
    codigo: 'tardanza',
    fecha_desde: '2026-10-19',
    fecha_hasta: '2026-10-19',
    duracion_minutos: minutos,
    horas_extra_cantidad: null,
    observaciones: 'Tardanza de 80 min (tablet · horario base 08:00).',
    adjuntos: [],
    registrado_por: null,
    firma_data_url: null,
    firmado_at: null,
    created_at: '',
    updated_at: ''
  }
}

const horario8 = { entrada: '08:00', salida: '16:00', horas: 8, trabajaSabado: false }

describe('evaluarDiaAsistencia tardanza vs horario', () => {
  it('no marca T si la entrada es 08:00 aunque haya novedad vieja', () => {
    const ev = evaluarDiaAsistencia({
      idUsuario: 82,
      fecha: '2026-10-19',
      asistencia: asis({
        hora_entrada: '2026-10-19T08:00:00-03:00',
        hora_salida: '2026-10-19T16:00:00-03:00',
        observaciones: 'Tardanza 80 min (tablet · horario base 08:00).'
      }),
      novedades: [novTardanza()],
      horario: horario8
    })
    assert.equal(ev.esTarde, false)
    assert.equal(ev.minutosTarde, 0)
  })

  it('sí marca T si la entrada supera la tolerancia', () => {
    const ev = evaluarDiaAsistencia({
      idUsuario: 82,
      fecha: '2026-10-19',
      asistencia: asis({
        hora_entrada: '2026-10-19T09:34:00-03:00',
        tipo_registro: 'tarde'
      }),
      novedades: [novTardanza(94)],
      horario: horario8
    })
    assert.equal(ev.esTarde, true)
    assert.ok(ev.minutosTarde > 15)
  })
})

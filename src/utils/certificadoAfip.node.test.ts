import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { avisoCertificado } from './certificadoAfip.ts'

describe('avisoCertificado', () => {
  it('vigente: informa hasta cuándo, sin alarma', () => {
    const a = avisoCertificado({ estado: 'vigente', vence: '2028-10-04', dias: 700 })
    assert.equal(a.nivel, 'ok')
    assert.match(a.texto, /hasta el 04\/10\/2028 \(faltan 700 días\)/)
  })

  it('por vencer: avisa con la fecha y los días que faltan', () => {
    const a = avisoCertificado({ estado: 'por_vencer', vence: '2026-12-01', dias: 28 })
    assert.equal(a.nivel, 'aviso')
    assert.match(a.texto, /vence el 01\/12\/2026 \(faltan 28 días\)/)
  })

  it('singular y último día', () => {
    assert.match(avisoCertificado({ estado: 'por_vencer', vence: '2026-12-01', dias: 1 }).texto, /falta 1 día/)
    assert.match(avisoCertificado({ estado: 'por_vencer', vence: '2026-12-01', dias: 0 }).texto, /vence hoy/)
  })

  it('vencido: error, no se puede emitir', () => {
    const a = avisoCertificado({ estado: 'vencido', vence: '2026-11-01', dias: -2 })
    assert.equal(a.nivel, 'error')
    assert.match(a.texto, /venció el 01\/11\/2026/)
  })

  it('sin certificado o ilegible no se muestran como vigentes', () => {
    assert.equal(avisoCertificado({ estado: 'sin_certificado' }).nivel, 'info')
    assert.equal(avisoCertificado({ estado: 'ilegible' }).nivel, 'aviso')
  })
})

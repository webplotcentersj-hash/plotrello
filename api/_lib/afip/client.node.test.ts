import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { rechazoAfip, unwrapAfipResult } from './client.ts'

describe('respuesta de ARCA', () => {
  it('desenvuelve FECAESolicitarResult', () => {
    const result = unwrapAfipResult('FECAESolicitar', {
      FECAESolicitarResult: { FeDetResp: { FECAEDetResponse: { Resultado: 'A', CAE: '1' } } }
    })
    assert.equal((result.FeDetResp as { FECAEDetResponse: { CAE: string } }).FECAEDetResponse.CAE, '1')
  })

  it('traduce el rechazo con código y texto', () => {
    const rechazo = rechazoAfip('FECAESolicitar', {
      FeDetResp: {
        FECAEDetResponse: {
          Resultado: 'R',
          Observaciones: { Obs: { Code: 10016, Msg: 'El número de comprobante no es correlativo.' } }
        }
      }
    })
    assert.equal(rechazo?.code, 10016)
    assert.match(rechazo?.message || '', /10016/)
    assert.match(rechazo?.message || '', /correlativo/)
  })

  it('no rechaza un comprobante aprobado', () => {
    assert.equal(
      rechazoAfip('FECAESolicitar', {
        FeDetResp: { FECAEDetResponse: { Resultado: 'A', CAE: '123' } }
      }),
      null
    )
  })
})

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { normalizarPem, rechazoAfip, unwrapAfipResult } from './client.ts'

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

  it('no manda una ruta de archivo como clave', () => {
    assert.equal(normalizarPem('.afip-certs/plotlab.key'), undefined)
    assert.equal(normalizarPem('C:\\\\certs\\\\plotlab.key'), undefined)
    const pem = normalizarPem('"-----BEGIN PRIVATE KEY-----\\nABC\\n-----END PRIVATE KEY-----"') || ''
    assert.match(pem, /BEGIN PRIVATE KEY/)
    assert.equal(pem.includes('\n\n'), false)
  })

  it('saca las líneas vacías que rompen la key en Afip SDK', () => {
    const roto = [
      '-----BEGIN RSA PRIVATE KEY-----',
      'AAAA',
      '',
      'BBBB',
      '-----END RSA PRIVATE KEY-----'
    ].join('\n')
    const pem = normalizarPem(roto) || ''
    assert.equal(pem.includes('\n\n'), false)
    assert.match(pem, /^-----BEGIN RSA PRIVATE KEY-----\nAAAABBBB\n-----END RSA PRIVATE KEY-----\n$/)
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

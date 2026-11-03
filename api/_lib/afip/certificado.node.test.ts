import assert from 'node:assert/strict'
import { X509Certificate } from 'node:crypto'
import { describe, it } from 'node:test'
import { certificadoDelServidor, infoCertificado } from './certificado.ts'

// Certificado autofirmado de prueba (la clave se descartó): CN=plotlab-prueba, vence 2036-10-31.
const PEM = `-----BEGIN CERTIFICATE-----
MIIBvTCCAWOgAwIBAgIUcex6xmJECDViuT+26hXl1vbS1k4wCgYIKoZIzj0EAwIw
NDEXMBUGA1UEAwwOcGxvdGxhYi1wcnVlYmExGTAXBgNVBAUTEENVSVQgMzA3MTU1
MTg4MDEwHhcNMjYxMTAzMTMwNzU1WhcNMzYxMDMxMTMwNzU1WjA0MRcwFQYDVQQD
DA5wbG90bGFiLXBydWViYTEZMBcGA1UEBRMQQ1VJVCAzMDcxNTUxODgwMTBZMBMG
ByqGSM49AgEGCCqGSM49AwEHA0IABGMM/Sm83kTaV0CtkF9DVUKifxL2al8RMtHz
J00J6DCS+yz9Bii7Hu6qh/heMzQ+2v59nkAiMnbJAKk6vP4laEejUzBRMB0GA1Ud
DgQWBBQJNTHFmntiGyEjXS+Uwl8aGrUB1zAfBgNVHSMEGDAWgBQJNTHFmntiGyEj
XS+Uwl8aGrUB1zAPBgNVHRMBAf8EBTADAQH/MAoGCCqGSM49BAMCA0gAMEUCIG76
G7q3eZbxtoc0PKdBO9FbKTiVlPQM5d1TTmOFZeg3AiEAmd8y5xukoca+LgCDqYGc
9RBRWYxg3Wa6txoGePHheb4=
-----END CERTIFICATE-----
`

const vence = new Date(new X509Certificate(PEM).validTo)
const DIA = 86_400_000
const faltando = (dias: number) => new Date(vence.getTime() - dias * DIA)

describe('infoCertificado', () => {
  it('sin certificado no hay nada que controlar', () => {
    assert.deepEqual(infoCertificado(undefined), { estado: 'sin_certificado' })
  })

  it('un PEM roto es ilegible', () => {
    assert.deepEqual(infoCertificado('-----BEGIN CERTIFICATE-----\nAAAA\n-----END CERTIFICATE-----\n'), { estado: 'ilegible' })
  })

  it('lee fecha de vencimiento y titular', () => {
    const info = infoCertificado(PEM, faltando(100))
    assert.equal(info.vence, '2036-10-31')
    assert.equal(info.titular, 'plotlab-prueba')
  })

  it('vigente con más de 30 días de margen', () => {
    assert.deepEqual(
      { estado: infoCertificado(PEM, faltando(100)).estado, dias: infoCertificado(PEM, faltando(100)).dias },
      { estado: 'vigente', dias: 100 }
    )
    assert.equal(infoCertificado(PEM, faltando(31)).estado, 'vigente')
  })

  it('avisa desde 30 días antes', () => {
    const info = infoCertificado(PEM, faltando(30))
    assert.equal(info.estado, 'por_vencer')
    assert.equal(info.dias, 30)
    assert.equal(infoCertificado(PEM, faltando(1)).estado, 'por_vencer')
  })

  it('vencido: ni el último minuto cuenta como vigente', () => {
    assert.equal(infoCertificado(PEM, new Date(vence.getTime() + 60_000)).estado, 'vencido')
    assert.equal(infoCertificado(PEM, vence).estado, 'vencido')
    const ayer = infoCertificado(PEM, new Date(vence.getTime() + DIA))
    assert.equal(ayer.estado, 'vencido')
    assert.equal(ayer.dias, -1)
  })
})

describe('certificadoDelServidor', () => {
  const VARS = ['AFIPSDK_CERT_PATH', 'AFIP_CERT_PATH', 'AFIPSDK_CERT', 'AFIP_CERT'] as const

  function conEntorno(valores: Partial<Record<(typeof VARS)[number], string>>, fn: () => void) {
    const antes = Object.fromEntries(VARS.map((v) => [v, process.env[v]]))
    for (const v of VARS) delete process.env[v]
    Object.assign(process.env, valores)
    try {
      fn()
    } finally {
      for (const v of VARS) {
        if (antes[v] === undefined) delete process.env[v]
        else process.env[v] = antes[v]
      }
    }
  }

  it('lee el PEM tal como lo guarda Vercel (con \\n escapadas)', () => {
    conEntorno({ AFIP_CERT: `"${PEM.trim().replace(/\n/g, '\\n')}"` }, () => {
      const info = certificadoDelServidor(faltando(100))
      assert.equal(info.estado, 'vigente')
      assert.equal(info.vence, '2036-10-31')
    })
  })

  it('sin variables configuradas no hay certificado', () => {
    conEntorno({}, () => assert.equal(certificadoDelServidor().estado, 'sin_certificado'))
  })
})

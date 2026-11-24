import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  ENVIO_MAX_ARCHIVOS,
  ENVIO_MAX_BYTES,
  agregarArchivosElegidos,
  esEnvioAtendidoHoy,
  formatearBytes,
  mostradorArchivosQrPath,
  nombreSeguroStorage,
  notificationIsEnvioArchivosQr,
  parseArchivosEnviados,
  parseEnvioArchivosQrId
} from './envioArchivosQr.ts'

const f = (name: string, size = 1000) => ({ name, size })

describe('envío de archivos por QR', () => {
  it('acepta PDF e imágenes y descarta otros formatos', () => {
    const r = agregarArchivosElegidos([], [f('a.pdf'), f('b.JPG'), f('c.docx'), f('d.heic')])
    assert.deepEqual(r.lista.map((x) => x.name), ['a.pdf', 'b.JPG', 'd.heic'])
    assert.match(r.aviso || '', /c\.docx/)
  })

  it('respeta tamaño máximo y cupo', () => {
    const grande = agregarArchivosElegidos([], [f('x.pdf', ENVIO_MAX_BYTES + 1)])
    assert.equal(grande.lista.length, 0)
    assert.match(grande.aviso || '', /supera/)

    const muchos = Array.from({ length: ENVIO_MAX_ARCHIVOS + 3 }, (_, i) => f(`p${i}.pdf`))
    const r = agregarArchivosElegidos([], muchos)
    assert.equal(r.lista.length, ENVIO_MAX_ARCHIVOS)
    assert.match(r.aviso || '', /Máximo/)
  })

  it('no duplica el mismo archivo elegido dos veces', () => {
    const r = agregarArchivosElegidos([f('a.pdf')], [f('a.pdf')])
    assert.equal(r.lista.length, 1)
    assert.equal(r.aviso, null)
  })

  it('arma nombres seguros para Storage', () => {
    assert.equal(nombreSeguroStorage('Diseño final (1).PDF'), 'Diseno_final_1.pdf')
    assert.equal(nombreSeguroStorage('###.png'), 'archivo.png')
  })

  it('normaliza la lista que devuelve la base', () => {
    const r = parseArchivosEnviados([{ url: 'https://x/y.pdf', nombre: 'y.pdf', bytes: '20' }, { url: '' }, null])
    assert.deepEqual(r, [{ url: 'https://x/y.pdf', nombre: 'y.pdf', bytes: 20 }])
    assert.deepEqual(parseArchivosEnviados('nada'), [])
  })

  it('formatea tamaños', () => {
    assert.equal(formatearBytes(512), '512 B')
    assert.equal(formatearBytes(2048), '2 KB')
    assert.equal(formatearBytes(3.5 * 1024 * 1024), '3.5 MB')
  })

  it('detecta notificaciones de envío QR y arma la ruta a la herramienta', () => {
    assert.equal(notificationIsEnvioArchivosQr({ origen: 'envio_archivos_qr' }), true)
    assert.equal(notificationIsEnvioArchivosQr({ related_id: 'envio-archivos-qr:12' }), true)
    assert.equal(parseEnvioArchivosQrId('envio-archivos-qr:12'), 12)
    assert.equal(mostradorArchivosQrPath({ id: 12 }), '/mostrador/archivos-qr?id=12')
    assert.equal(mostradorArchivosQrPath({ codigo: '0857' }), '/mostrador/archivos-qr?codigo=0857')
  })

  it('recibidos solo cuentan el día AR; al otro día desaparecen', () => {
    assert.equal(esEnvioAtendidoHoy('2026-11-20T18:00:00-03:00', '2026-11-20'), true)
    assert.equal(esEnvioAtendidoHoy('2026-11-19T23:30:00-03:00', '2026-11-20'), false)
    assert.equal(esEnvioAtendidoHoy(null, '2026-11-20'), false)
    assert.equal(esEnvioAtendidoHoy(null, '2026-11-20', '2026-11-20T10:00:00-03:00'), true)
  })
})

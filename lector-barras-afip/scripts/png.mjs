import { crc32, deflateSync } from 'node:zlib'

function bloque(tipo, datos) {
  const largo = Buffer.alloc(4)
  largo.writeUInt32BE(datos.length)
  const cuerpo = Buffer.concat([Buffer.from(tipo, 'ascii'), datos])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(cuerpo) >>> 0)
  return Buffer.concat([largo, cuerpo, crc])
}

/** PNG RGB de 8 bits. `rgb` es un Uint8Array de ancho × alto × 3. */
export function codificarPng(ancho, alto, rgb) {
  const cabecera = Buffer.alloc(13)
  cabecera.writeUInt32BE(ancho, 0)
  cabecera.writeUInt32BE(alto, 4)
  cabecera[8] = 8 // bits por canal
  cabecera[9] = 2 // RGB
  const fila = ancho * 3
  const datos = Buffer.alloc((fila + 1) * alto) // cada fila lleva un byte de filtro (0)
  for (let y = 0; y < alto; y++) Buffer.from(rgb.buffer, rgb.byteOffset + y * fila, fila).copy(datos, y * (fila + 1) + 1)
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    bloque('IHDR', cabecera),
    bloque('IDAT', deflateSync(datos)),
    bloque('IEND', Buffer.alloc(0))
  ])
}

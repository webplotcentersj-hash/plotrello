/** Guarda un archivo generado en el navegador (descarga con el nombre indicado). */
export function guardarBlob(blob: Blob, nombre: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = nombre
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

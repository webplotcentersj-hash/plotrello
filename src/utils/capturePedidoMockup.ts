import html2canvas from 'html2canvas'

export const PEDIDO_MOCKUP_FILENAME = 'mockup-vista-previa.png'
export const PEDIDO_MOCKUP_TIPO = 'mockup_vista_previa'

export function isPedidoMockupArchivo(archivo: { nombre_archivo?: string; tipo?: string | null }): boolean {
  return (
    archivo.tipo === PEDIDO_MOCKUP_TIPO ||
    (archivo.nombre_archivo?.toLowerCase().startsWith('mockup-vista-previa') ?? false)
  )
}

export async function dataUrlToFile(dataUrl: string, filename: string): Promise<File> {
  const res = await fetch(dataUrl)
  const blob = await res.blob()
  return new File([blob], filename, { type: blob.type || 'image/png' })
}

export async function captureElementAsPngFile(element: HTMLElement, filename: string): Promise<File> {
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    allowTaint: true,
    backgroundColor: null,
    logging: false
  })

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), 'image/png', 0.92)
  })

  if (!blob) {
    throw new Error('No se pudo capturar la vista previa del mockup.')
  }

  return new File([blob], filename, { type: 'image/png' })
}

/** Arma el archivo PNG del mockup (IA si existe, si no captura del panel visual). */
export async function buildPedidoMockupFile(input: {
  idPedido: number
  aiDataUrl?: string | null
  captureElement?: HTMLElement | null
}): Promise<File | null> {
  const filename = `mockup-vista-previa-pedido-${input.idPedido}.png`

  if (input.aiDataUrl?.startsWith('data:')) {
    return dataUrlToFile(input.aiDataUrl, filename)
  }

  if (input.captureElement) {
    try {
      return await captureElementAsPngFile(input.captureElement, filename)
    } catch {
      return null
    }
  }

  return null
}

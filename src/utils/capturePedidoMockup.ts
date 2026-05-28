import html2canvas from 'html2canvas'

export const PEDIDO_MOCKUP_FILENAME = 'mockup-vista-previa.png'
export const PEDIDO_MOCKUP_TIPO = 'mockup_vista_previa'

export const BRIEF_MOCKUP_FILENAME = 'mockup-vista-previa-brief.png'
export const BRIEF_MOCKUP_TIPO = 'mockup_vista_previa'
export const BRIEF_REFERENCIA_TIPO = 'referencia_cliente'

export function isPedidoMockupArchivo(archivo: { nombre_archivo?: string; tipo?: string | null }): boolean {
  return (
    archivo.tipo === PEDIDO_MOCKUP_TIPO ||
    (archivo.nombre_archivo?.toLowerCase().startsWith('mockup-vista-previa') ?? false)
  )
}

export function isBriefMockupArchivo(archivo: { nombre_archivo?: string; tipo?: string | null }): boolean {
  return isPedidoMockupArchivo(archivo)
}

export async function dataUrlToFile(dataUrl: string, filename: string): Promise<File> {
  const res = await fetch(dataUrl)
  const blob = await res.blob()
  return new File([blob], filename, { type: blob.type || 'image/png' })
}

/** Nodo visual del mockup (excluye estado vacío). */
export function resolveMockupCaptureNode(root: HTMLElement | null): HTMLElement | null {
  if (!root) return null
  const mockup = root.querySelector('.pedido-mockup:not(.pedido-mockup--empty)') as HTMLElement | null
  return mockup ?? root
}

async function renderNodeToPngFile(element: HTMLElement, filename: string): Promise<File> {
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    allowTaint: true,
    backgroundColor: '#ffffff',
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

/** Clona el mockup fuera del layout (sticky/transform) para captura fiable. */
export async function captureElementAsPngFile(element: HTMLElement, filename: string): Promise<File> {
  const target = resolveMockupCaptureNode(element) ?? element
  const host = document.createElement('div')
  host.setAttribute('aria-hidden', 'true')
  host.style.cssText =
    'position:fixed;left:-12000px;top:0;width:360px;z-index:-1;pointer-events:none;background:#fff;'
  const clone = target.cloneNode(true) as HTMLElement
  host.appendChild(clone)
  document.body.appendChild(host)

  try {
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    })
    return await renderNodeToPngFile(host, filename)
  } finally {
    host.remove()
  }
}

/** Arma el archivo PNG del mockup (IA si existe, si no captura del panel visual). */
export async function buildPedidoMockupFile(input: {
  idPedido: number
  aiDataUrl?: string | null
  captureElement?: HTMLElement | null
}): Promise<File | null> {
  const filename = `mockup-vista-previa-pedido-${input.idPedido}.png`

  if (input.aiDataUrl) {
    if (input.aiDataUrl.startsWith('data:')) {
      return dataUrlToFile(input.aiDataUrl, filename)
    }
    try {
      const res = await fetch(input.aiDataUrl)
      const blob = await res.blob()
      return new File([blob], filename, { type: blob.type || 'image/png' })
    } catch {
      /* sigue con captura DOM */
    }
  }

  if (input.captureElement) {
    const node = resolveMockupCaptureNode(input.captureElement)
    if (!node || node.classList.contains('pedido-mockup--empty')) {
      return null
    }
    return await captureElementAsPngFile(input.captureElement, filename)
  }

  return null
}

/** Mockup del brief (misma lógica que pedido). */
export async function buildBriefMockupFile(input: {
  idBrief: number
  aiDataUrl?: string | null
  captureElement?: HTMLElement | null
}): Promise<File | null> {
  const filename = `mockup-vista-previa-brief-${input.idBrief}.png`
  if (input.aiDataUrl) {
    if (input.aiDataUrl.startsWith('data:')) {
      return dataUrlToFile(input.aiDataUrl, filename)
    }
    try {
      const res = await fetch(input.aiDataUrl)
      const blob = await res.blob()
      return new File([blob], filename, { type: blob.type || 'image/png' })
    } catch {
      /* captura DOM */
    }
  }
  if (input.captureElement) {
    const node = resolveMockupCaptureNode(input.captureElement)
    if (!node || node.classList.contains('pedido-mockup--empty')) {
      return null
    }
    return await captureElementAsPngFile(input.captureElement, filename)
  }
  return null
}

import type { ReactNode } from 'react'
import { buildWhatsappLink } from './whatsappLink'

type MensajeChatMeta = {
  whatsapp?: string | null
  contacto_nombre?: string | null
}

const PHONE_IN_TEXT =
  /(?:\+?54[\s-]?)?(?:9[\s-]?)?\d[\d\s\-()]{6,}\d|\b\d{8,12}\b/g

function normalizePhoneForLink(raw: string): string | undefined {
  let d = raw.replace(/\D/g, '')
  if (!d) return undefined
  if (d.startsWith('0')) d = d.slice(1)
  if (d.startsWith('54') && d.length > 10) d = d.slice(2)
  if (d.startsWith('9') && d.length === 11) d = d.slice(1)
  if (d.length < 8) return undefined
  return d
}

/** Renderiza texto con números de teléfono/WhatsApp como enlaces wa.me. */
export function renderTextoConWhatsapp(
  text: string,
  meta?: MensajeChatMeta
): ReactNode {
  const waMeta = meta?.whatsapp?.trim()
  if (waMeta) {
    const link = buildWhatsappLink(waMeta)
    const nombre = meta?.contacto_nombre?.trim()
    if (link) {
      return (
        <>
          {nombre ? <>{nombre} </> : null}
          <a href={link} target="_blank" rel="noopener noreferrer" className="atencion-publico-wa-link">
            {waMeta}
          </a>
        </>
      )
    }
  }

  const nodes: ReactNode[] = []
  let last = 0
  let match: RegExpExecArray | null
  const re = new RegExp(PHONE_IN_TEXT.source, 'g')
  while ((match = re.exec(text)) !== null) {
    const full = match[0]
    const idx = match.index
    const digits = normalizePhoneForLink(full)
    if (idx > last) nodes.push(text.slice(last, idx))
    if (digits) {
      const link = buildWhatsappLink(digits)
      if (link) {
        nodes.push(
          <a
            key={`${idx}-${digits}`}
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className="atencion-publico-wa-link"
          >
            {full.trim()}
          </a>
        )
      } else {
        nodes.push(full)
      }
    } else {
      nodes.push(full)
    }
    last = idx + full.length
  }
  if (last < text.length) nodes.push(text.slice(last))
  return nodes.length ? nodes : text
}

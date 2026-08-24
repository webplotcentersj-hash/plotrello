import type { WorkPoolJob } from '../../types/workPool'
import { normalizePortfolioUrl } from './workPoolPostulacion'

const DRIVE_HOST_RE = /(^|\.)(google\.com|googledrive\.com)$/i

/** Normaliza y valida un link de Google Drive / Docs / Sheets / Slides. */
export function normalizeDriveUrl(raw: string): string {
  return normalizePortfolioUrl(raw)
}

export function isValidDriveUrl(raw: string): boolean {
  const t = raw.trim()
  if (!t) return false
  try {
    const u = new URL(normalizeDriveUrl(t))
    if (!DRIVE_HOST_RE.test(u.hostname)) return false
    // drive.google.com, docs.google.com, etc.
    return (
      u.hostname === 'drive.google.com' ||
      u.hostname === 'docs.google.com' ||
      u.hostname.endsWith('.google.com') ||
      u.hostname === 'googledrive.com'
    )
  } catch {
    return false
  }
}

export function jobEntregaDriveUrl(job: WorkPoolJob): string | null {
  const meta = job.metadata ?? {}
  const fromMeta = String(meta.entrega_drive_url ?? '').trim()
  if (fromMeta) return fromMeta

  const notas = (job.notas_entrega ?? '').trim()
  if (!notas) return null
  const m = notas.match(/https?:\/\/[^\s]+/i)
  if (m && isValidDriveUrl(m[0])) return normalizeDriveUrl(m[0])
  return null
}

import { useEffect, useId, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { isValidDriveUrl, normalizeDriveUrl } from './workPoolEntrega'

type Props = {
  jobTitle: string
  open: boolean
  busy?: boolean
  onClose: () => void
  onConfirm: (payload: { driveUrl: string; notas: string }) => void
}

export default function WorkPoolEntregaModal({
  jobTitle,
  open,
  busy = false,
  onClose,
  onConfirm
}: Props) {
  const titleId = useId()
  const [driveUrl, setDriveUrl] = useState('')
  const [notas, setNotas] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setDriveUrl('')
    setNotas('')
    setError('')
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, busy, onClose])

  if (!open) return null

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const url = normalizeDriveUrl(driveUrl)
    if (!isValidDriveUrl(url)) {
      setError('Pegá un link de Google Drive (drive.google.com o docs.google.com).')
      return
    }
    setError('')
    onConfirm({ driveUrl: url, notas: notas.trim() })
  }

  return createPortal(
    <div className="wp-entrega-modal" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <button
        type="button"
        className="wp-entrega-modal__backdrop"
        aria-label="Cerrar"
        disabled={busy}
        onClick={onClose}
      />
      <form className="wp-entrega-modal__panel" onSubmit={submit}>
        <header className="wp-entrega-modal__head">
          <h2 id={titleId}>Entregar trabajo</h2>
          <p className="wp-entrega-modal__sub">{jobTitle}</p>
        </header>

        <label className="wp-entrega-modal__label" htmlFor="wp-entrega-drive">
          Link de Google Drive <span aria-hidden>*</span>
        </label>
        <input
          id="wp-entrega-drive"
          type="url"
          inputMode="url"
          autoComplete="off"
          className="wp-entrega-modal__input"
          placeholder="https://drive.google.com/…"
          value={driveUrl}
          disabled={busy}
          onChange={(e) => setDriveUrl(e.target.value)}
          required
        />
        <p className="wp-entrega-modal__hint">
          Compartí la carpeta o el archivo con permiso de ver. Ahí va el original / editable.
        </p>

        <label className="wp-entrega-modal__label" htmlFor="wp-entrega-notas">
          Notas (opcional)
        </label>
        <textarea
          id="wp-entrega-notas"
          className="wp-entrega-modal__textarea"
          rows={3}
          placeholder="Comentarios para revisión…"
          value={notas}
          disabled={busy}
          onChange={(e) => setNotas(e.target.value)}
        />

        {error ? <p className="wp-entrega-modal__error">{error}</p> : null}

        <div className="wp-entrega-modal__actions">
          <button type="button" className="phi-btn phi-btn--outline" disabled={busy} onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="phi-btn phi-btn--dark" disabled={busy}>
            {busy ? 'Enviando…' : 'Entregar con Drive'}
          </button>
        </div>
      </form>
    </div>,
    document.body
  )
}

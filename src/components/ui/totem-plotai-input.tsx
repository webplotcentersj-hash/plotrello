import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Globe, Paperclip, Plus, Send } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Textarea } from '@/components/ui/textarea'
import styles from './totem-plotai-input.module.css'

export type TotemPlotAiInputProps = {
  onSend: (text: string) => void | Promise<void>
  disabled?: boolean
  className?: string
}

interface UseAutoResizeTextareaProps {
  minHeight: number
  maxHeight?: number
}

function useAutoResizeTextarea({ minHeight, maxHeight }: UseAutoResizeTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const adjustHeight = useCallback(
    (reset?: boolean) => {
      const textarea = textareaRef.current
      if (!textarea) return

      if (reset) {
        textarea.style.height = `${minHeight}px`
        return
      }

      textarea.style.height = `${minHeight}px`
      const cap = maxHeight ?? Number.POSITIVE_INFINITY
      const newHeight = Math.max(minHeight, Math.min(textarea.scrollHeight, cap))
      textarea.style.height = `${newHeight}px`
    },
    [minHeight, maxHeight]
  )

  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) textarea.style.height = `${minHeight}px`
  }, [minHeight])

  useEffect(() => {
    const handleResize = () => adjustHeight()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [adjustHeight])

  return { textareaRef, adjustHeight }
}

const MIN_HEIGHT = 52
const MAX_HEIGHT = 164

function AnimatedPlaceholder({ showSearch }: { showSearch: boolean }) {
  return (
    <AnimatePresence mode="wait">
      <motion.p
        key={showSearch ? 'search' : 'ask'}
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -5 }}
        transition={{ duration: 0.1 }}
        className={styles.placeholderOverlay}
      >
        {showSearch ? 'Buscá en la web…' : 'Preguntá a PlotAI…'}
      </motion.p>
    </AnimatePresence>
  )
}

export function TotemPlotAiInput({ onSend, disabled, className }: TotemPlotAiInputProps) {
  const [value, setValue] = useState('')
  const { textareaRef, adjustHeight } = useAutoResizeTextarea({
    minHeight: MIN_HEIGHT,
    maxHeight: MAX_HEIGHT
  })
  const [showSearch, setShowSearch] = useState(false)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [attachedFile, setAttachedFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleClosePreview = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (fileInputRef.current) fileInputRef.current.value = ''
    setImagePreview(null)
    setAttachedFile(null)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null
    if (file) {
      setAttachedFile(file)
      if (file.type.startsWith('image/')) {
        setImagePreview(URL.createObjectURL(file))
      } else {
        setImagePreview(null)
      }
    }
  }

  const handleSubmit = async () => {
    let line = value.trim()
    if (attachedFile) {
      const note = `(Adjunto: ${attachedFile.name})`
      line = line ? `${line}\n\n${note}` : note
    }
    if (!line || disabled) return
    const prefix = showSearch ? '(Quiero información actualizada de la web)\n\n' : ''
    try {
      await Promise.resolve(onSend(prefix + line))
    } finally {
      setValue('')
      adjustHeight(true)
      if (fileInputRef.current) fileInputRef.current.value = ''
      if (imagePreview) URL.revokeObjectURL(imagePreview)
      setImagePreview(null)
      setAttachedFile(null)
    }
  }

  useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview)
    }
  }, [imagePreview])

  return (
    <div className={cn(styles.wrap, className)}>
      <div className={styles.cardOuter}>
        <div className={styles.cardInner}>
          <div className={styles.growArea}>
            <div className={styles.taWrap}>
              <Textarea
                id="totem-plotai-input"
                value={value}
                placeholder=""
                className={styles.textarea}
                ref={textareaRef}
                disabled={disabled}
                onKeyDown={(e) => {
                  if (disabled) return
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    void handleSubmit()
                  }
                }}
                onChange={(e) => {
                  setValue(e.target.value)
                  adjustHeight()
                }}
              />
              {!value && <AnimatedPlaceholder showSearch={showSearch} />}
            </div>
          </div>

          <div className={styles.toolbar}>
            <div className={styles.toolbarLeft}>
              <label
                className={cn(
                  styles.iconBtn,
                  styles.clipLabel,
                  (imagePreview || attachedFile) && styles.iconBtnActive,
                  disabled && styles.iconBtnDisabled
                )}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  className={styles.clipInput}
                  accept="image/*,.pdf"
                  disabled={disabled}
                />
                <Paperclip className={styles.iconSm} aria-hidden />
                {imagePreview && (
                  <div className={styles.previewWrap}>
                    <img className={styles.previewImg} src={imagePreview} alt="" />
                    <button type="button" className={styles.previewClose} onClick={handleClosePreview} aria-label="Quitar adjunto">
                      <Plus className={styles.iconSm} aria-hidden />
                    </button>
                  </div>
                )}
              </label>

              <button
                type="button"
                onClick={() => setShowSearch((v) => !v)}
                disabled={disabled}
                className={cn(styles.globeBtn, showSearch && styles.globeBtnActive)}
              >
                <motion.span
                  className={styles.iconSm}
                  style={{ display: 'inline-flex' }}
                  animate={{ rotate: showSearch ? 180 : 0, scale: showSearch ? 1.08 : 1 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 22 }}
                >
                  <Globe className={styles.iconSm} aria-hidden />
                </motion.span>
                <AnimatePresence>
                  {showSearch && (
                    <motion.span
                      initial={{ width: 0, opacity: 0 }}
                      animate={{ width: 'auto', opacity: 1 }}
                      exit={{ width: 0, opacity: 0 }}
                      transition={{ duration: 0.18 }}
                      className={styles.globeLabel}
                    >
                      Web
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>
            </div>

            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={disabled}
              className={cn(styles.iconBtn, (value.trim() || attachedFile) && styles.iconBtnActive)}
              aria-label="Enviar mensaje"
            >
              <Send className={styles.iconSm} aria-hidden />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

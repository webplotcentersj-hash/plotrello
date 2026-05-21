import { useRef, useState } from 'react'
import type { ClienteCuentaCorrienteRecord, ClienteRecord } from '../types/api'
import {
  CONDICIONES_IVA_CUENTA_CORRIENTE,
  TIPO_CLIENTE_CC_LABELS,
  type CondicionIvaCuentaCorriente,
  type TipoClienteCuentaCorriente
} from '../constants/cuentaCorriente'
import { uploadAttachmentAndGetUrl } from '../utils/storage'
import { generarYGuardarPagareCuentaCorriente } from '../utils/cuentaCorrientePagare'
import './CuentaCorrienteAltaForm.css'

export type CuentaCorrienteFormValues = {
  cuit: string
  razon_social: string
  nombre: string
  apellido: string
  condicion_iva: CondicionIvaCuentaCorriente | ''
  email: string
  whatsapp: string
  persona_contacto: string
  domicilio: string
  localidad: string
  provincia: string
  codigo_postal: string
}

type DocKey = 'constancia_afip' | 'estatuto' | 'domicilio' | 'documento_dni'

const DOC_LABELS: Record<DocKey, string> = {
  constancia_afip: 'Constancia AFIP',
  estatuto: 'Estatuto / acta societaria',
  domicilio: 'Comprobante de domicilio',
  documento_dni: 'DNI (frente y dorso o PDF)'
}

const MAX_DOC_MB = 8
const DOC_ACCEPT = '.pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/*'

function defaultVencimiento(): string {
  const d = new Date()
  d.setDate(d.getDate() + 30)
  return d.toISOString().slice(0, 10)
}

function valuesFromRecord(
  cc: ClienteCuentaCorrienteRecord | null,
  cliente?: ClienteRecord | null
): CuentaCorrienteFormValues {
  const nombre = cc?.nombre ?? ''
  const apellido = cc?.apellido ?? ''
  const razon =
    cc?.razon_social ??
    cliente?.empresa ??
    cliente?.nombre ??
    [nombre, apellido].filter(Boolean).join(' ')
  return {
    cuit: cc?.cuit ?? cliente?.dni_cuit ?? '',
    razon_social: razon,
    nombre,
    apellido,
    condicion_iva: (cc?.condicion_iva as CondicionIvaCuentaCorriente) ?? '',
    email: cc?.email ?? cliente?.email ?? '',
    whatsapp: cc?.whatsapp ?? cliente?.telefono ?? '',
    persona_contacto: cc?.persona_contacto ?? '',
    domicilio: cc?.domicilio ?? cliente?.direccion ?? '',
    localidad: cc?.localidad ?? '',
    provincia: cc?.provincia ?? '',
    codigo_postal: cc?.codigo_postal ?? ''
  }
}

function nombreCompleto(values: CuentaCorrienteFormValues, tipo: TipoClienteCuentaCorriente): string {
  if (tipo === 'persona_fisica') {
    const n = [values.nombre.trim(), values.apellido.trim()].filter(Boolean).join(' ')
    return n || values.razon_social.trim()
  }
  return values.razon_social.trim()
}

type CuentaCorrienteAltaFormProps = {
  idCliente?: number | null
  clienteNombre?: string
  initialRecord?: ClienteCuentaCorrienteRecord | null
  initialCliente?: ClienteRecord | null
  isAdmin?: boolean
  onCancel: () => void
  onSubmit: (payload: {
    tipo_cliente: TipoClienteCuentaCorriente
    values: CuentaCorrienteFormValues
    urls: {
      constancia_afip: string
      estatuto: string
      domicilio: string
      documento_dni: string
      pagare: string
    }
    id_cliente?: number | null
  }) => Promise<void>
}

export default function CuentaCorrienteAltaForm({
  idCliente = null,
  clienteNombre,
  initialRecord = null,
  initialCliente = null,
  isAdmin = false,
  onCancel,
  onSubmit
}: CuentaCorrienteAltaFormProps) {
  const initialTipo: TipoClienteCuentaCorriente =
    initialRecord?.tipo_cliente === 'persona_fisica' ? 'persona_fisica' : 'empresa'

  const [tipoCliente, setTipoCliente] = useState<TipoClienteCuentaCorriente>(initialTipo)
  const [values, setValues] = useState<CuentaCorrienteFormValues>(() =>
    valuesFromRecord(initialRecord, initialCliente)
  )
  const [docLabels, setDocLabels] = useState<Partial<Record<DocKey, string>>>({})
  const [uploadedUrls, setUploadedUrls] = useState<Record<DocKey, string>>({
    constancia_afip: initialRecord?.url_constancia_afip ?? '',
    estatuto: initialRecord?.url_estatuto ?? '',
    domicilio: initialRecord?.url_comprobante_domicilio ?? '',
    documento_dni: initialRecord?.url_documento_dni ?? ''
  })
  const [pagareMonto, setPagareMonto] = useState('')
  const [pagareVencimiento, setPagareVencimiento] = useState(defaultVencimiento)
  const [pagareConcepto, setPagareConcepto] = useState('')
  const [pagareUrl, setPagareUrl] = useState(initialRecord?.url_pagare ?? '')
  const [generandoPagare, setGenerandoPagare] = useState(false)
  const [uploading, setUploading] = useState<DocKey | null>(null)
  const [docErrors, setDocErrors] = useState<Partial<Record<DocKey, string>>>({})
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const fileInputRefs = useRef<Record<DocKey, HTMLInputElement | null>>({
    constancia_afip: null,
    estatuto: null,
    domicilio: null,
    documento_dni: null
  })

  const storageFolder = `cuenta-corriente/${idCliente ?? 'nuevo'}`
  const esPersona = tipoCliente === 'persona_fisica'

  const docsRequeridos: DocKey[] = esPersona
    ? ['constancia_afip', 'documento_dni', 'domicilio']
    : ['constancia_afip', 'estatuto', 'domicilio']

  const set = (field: keyof CuentaCorrienteFormValues, v: string) => {
    setValues((prev) => ({ ...prev, [field]: v }))
  }

  const validate = (): string | null => {
    if (!values.cuit.trim()) return esPersona ? 'CUIT/DNI es obligatorio' : 'CUIT es obligatorio'
    if (esPersona) {
      if (!values.nombre.trim() && !values.apellido.trim() && !values.razon_social.trim()) {
        return 'Nombre y apellido son obligatorios'
      }
    } else if (!values.razon_social.trim()) {
      return 'Razón social es obligatoria'
    }
    if (!values.condicion_iva) return 'Condición de IVA es obligatoria'
    if (!values.email.trim()) return 'Email es obligatorio'
    if (!values.whatsapp.trim()) return 'WhatsApp es obligatorio'
    if (!esPersona && !values.persona_contacto.trim()) return 'Persona de contacto es obligatoria'
    if (!values.domicilio.trim()) return 'Domicilio es obligatorio'
    if (!values.localidad.trim()) return 'Localidad es obligatoria'
    if (!values.provincia.trim()) return 'Provincia es obligatoria'
    if (!values.codigo_postal.trim()) return 'Código postal es obligatorio'
    return null
  }

  const handleDocFile = async (key: DocKey, file: File | undefined) => {
    if (!file) return
    setDocErrors((prev) => ({ ...prev, [key]: undefined }))
    setFormError(null)

    if (file.size > MAX_DOC_MB * 1024 * 1024) {
      setDocErrors((prev) => ({
        ...prev,
        [key]: `El archivo no puede superar ${MAX_DOC_MB} MB`
      }))
      return
    }

    setUploading(key)
    try {
      const url = await uploadAttachmentAndGetUrl(file, storageFolder)
      setUploadedUrls((prev) => ({ ...prev, [key]: url }))
      setDocLabels((prev) => ({ ...prev, [key]: file.name }))
    } catch (ex) {
      setDocErrors((prev) => ({
        ...prev,
        [key]: ex instanceof Error ? ex.message : 'Error al subir el archivo'
      }))
      setUploadedUrls((prev) => ({ ...prev, [key]: '' }))
      setDocLabels((prev) => {
        const next = { ...prev }
        delete next[key]
        return next
      })
    } finally {
      setUploading(null)
    }
  }

  const quitarDoc = (key: DocKey) => {
    setUploadedUrls((prev) => ({ ...prev, [key]: '' }))
    setDocLabels((prev) => {
      const next = { ...prev }
      delete next[key]
      return next
    })
    setDocErrors((prev) => ({ ...prev, [key]: undefined }))
    const input = fileInputRefs.current[key]
    if (input) input.value = ''
  }

  const generarPagare = async () => {
    const err = validate()
    if (err) {
      setFormError(err)
      return
    }
    const monto = parseFloat(pagareMonto.replace(',', '.'))
    if (!Number.isFinite(monto) || monto <= 0) {
      setFormError('Indicá un monto válido para el pagaré')
      return
    }
    setFormError(null)
    setGenerandoPagare(true)
    try {
      const url = await generarYGuardarPagareCuentaCorriente(
        {
          tipo: tipoCliente,
          nombreDeudor: nombreCompleto(values, tipoCliente),
          cuit: values.cuit.trim(),
          monto,
          fechaVencimiento: pagareVencimiento || undefined,
          concepto: pagareConcepto.trim() || undefined,
          domicilio: values.domicilio.trim(),
          localidad: values.localidad.trim(),
          provincia: values.provincia.trim(),
          porcentajeInteresMensual: initialRecord?.porcentaje_interes_mensual ?? null,
          porcentajeInteresMoraMensual: initialRecord?.porcentaje_interes_mora_mensual ?? null
        },
        storageFolder
      )
      setPagareUrl(url)
    } catch (ex) {
      setFormError(ex instanceof Error ? ex.message : 'No se pudo guardar el pagaré')
    } finally {
      setGenerandoPagare(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const err = validate()
    if (err) {
      setFormError(err)
      return
    }

    if (!uploadedUrls.constancia_afip) {
      setFormError('Subí la Constancia AFIP desde archivo (PDF o imagen).')
      return
    }
    if (!esPersona && !uploadedUrls.estatuto) {
      setFormError('Subí el Estatuto desde archivo (PDF o imagen).')
      return
    }
    if (esPersona && !uploadedUrls.documento_dni) {
      setFormError('Subí el DNI desde archivo (PDF o imagen).')
      return
    }
    if (esPersona && !pagareUrl) {
      setFormError('Generá y guardá el pagaré antes de enviar la solicitud.')
      return
    }
    if (!uploadedUrls.domicilio) {
      setFormError('Subí el comprobante de Domicilio desde archivo (PDF o imagen).')
      return
    }
    if (uploading) {
      setFormError('Esperá a que termine la subida del archivo.')
      return
    }

    const nombreDisplay = nombreCompleto(values, tipoCliente)
    const submitValues: CuentaCorrienteFormValues = {
      ...values,
      razon_social: esPersona ? nombreDisplay : values.razon_social.trim()
    }

    setSaving(true)
    setFormError(null)
    try {
      await onSubmit({
        tipo_cliente: tipoCliente,
        values: submitValues,
        urls: {
          constancia_afip: uploadedUrls.constancia_afip,
          estatuto: uploadedUrls.estatuto,
          domicilio: uploadedUrls.domicilio,
          documento_dni: uploadedUrls.documento_dni,
          pagare: pagareUrl
        },
        id_cliente: idCliente
      })
    } catch (ex) {
      setFormError(ex instanceof Error ? ex.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="cc-alta-form" onSubmit={(e) => void handleSubmit(e)}>
      {clienteNombre && (
        <p className="cc-alta-form__cliente">
          Cliente vinculado: <strong>{clienteNombre}</strong>
        </p>
      )}

      <div className="cc-alta-tipo" role="tablist" aria-label="Tipo de cliente">
        {(['empresa', 'persona_fisica'] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tipoCliente === t}
            className={`cc-alta-tipo__btn${tipoCliente === t ? ' cc-alta-tipo__btn--active' : ''}`}
            onClick={() => {
              setTipoCliente(t)
              setFormError(null)
              if (t === 'empresa') setPagareUrl('')
            }}
            disabled={saving}
          >
            {TIPO_CLIENTE_CC_LABELS[t]}
          </button>
        ))}
      </div>

      {formError && (
        <div className="cc-alta-form__error" role="alert">
          {formError}
        </div>
      )}

      <div className="cc-alta-form__grid">
        <label className="cc-alta-field">
          <span>{esPersona ? 'CUIT / DNI *' : 'CUIT *'}</span>
          <input
            value={values.cuit}
            onChange={(e) => set('cuit', e.target.value)}
            placeholder={esPersona ? '20-12345678-9 o DNI' : '30-12345678-9'}
            required
          />
        </label>

        {esPersona ? (
          <>
            <label className="cc-alta-field">
              <span>Nombre *</span>
              <input
                value={values.nombre}
                onChange={(e) => set('nombre', e.target.value)}
                required
              />
            </label>
            <label className="cc-alta-field">
              <span>Apellido *</span>
              <input
                value={values.apellido}
                onChange={(e) => set('apellido', e.target.value)}
                required
              />
            </label>
          </>
        ) : (
          <label className="cc-alta-field cc-alta-field--wide">
            <span>Razón social *</span>
            <input
              value={values.razon_social}
              onChange={(e) => set('razon_social', e.target.value)}
              required
            />
          </label>
        )}

        <label className="cc-alta-field">
          <span>Condición IVA *</span>
          <select
            value={values.condicion_iva}
            onChange={(e) => set('condicion_iva', e.target.value)}
            required
          >
            <option value="">Seleccionar…</option>
            {CONDICIONES_IVA_CUENTA_CORRIENTE.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className="cc-alta-field">
          <span>Email *</span>
          <input
            type="email"
            value={values.email}
            onChange={(e) => set('email', e.target.value)}
            required
          />
        </label>
        <label className="cc-alta-field">
          <span>WhatsApp *</span>
          <input
            value={values.whatsapp}
            onChange={(e) => set('whatsapp', e.target.value)}
            required
          />
        </label>
        {!esPersona && (
          <label className="cc-alta-field">
            <span>Persona de contacto *</span>
            <input
              value={values.persona_contacto}
              onChange={(e) => set('persona_contacto', e.target.value)}
              required
            />
          </label>
        )}
        <label className="cc-alta-field cc-alta-field--wide">
          <span>Domicilio *</span>
          <input value={values.domicilio} onChange={(e) => set('domicilio', e.target.value)} required />
        </label>
        <label className="cc-alta-field">
          <span>Localidad *</span>
          <input value={values.localidad} onChange={(e) => set('localidad', e.target.value)} required />
        </label>
        <label className="cc-alta-field">
          <span>Provincia *</span>
          <input value={values.provincia} onChange={(e) => set('provincia', e.target.value)} required />
        </label>
        <label className="cc-alta-field">
          <span>Código postal *</span>
          <input
            value={values.codigo_postal}
            onChange={(e) => set('codigo_postal', e.target.value)}
            required
          />
        </label>
      </div>

      {esPersona && (
        <section className="cc-alta-pagare">
          <h3 className="cc-alta-pagare__title">Pagaré prearmado</h3>
          <p className="cc-alta-pagare__hint">
            Completá monto y vencimiento, luego generá el pagaré: se guarda en el sistema y se descarga
            una copia para imprimir y firmar. Es obligatorio antes de enviar la solicitud.
          </p>
          <div className="cc-alta-pagare__grid">
            <label className="cc-alta-field">
              <span>Monto ($) *</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={pagareMonto}
                onChange={(e) => setPagareMonto(e.target.value)}
                placeholder="0.00"
              />
            </label>
            <label className="cc-alta-field">
              <span>Vencimiento</span>
              <input
                type="date"
                value={pagareVencimiento}
                onChange={(e) => setPagareVencimiento(e.target.value)}
              />
            </label>
            <label className="cc-alta-field cc-alta-field--wide">
              <span>Concepto (opcional)</span>
              <input
                value={pagareConcepto}
                onChange={(e) => setPagareConcepto(e.target.value)}
                placeholder="Ej. operaciones en cuenta corriente Plot Center"
              />
            </label>
          </div>
          <div className="cc-alta-pagare__actions">
            <button
              type="button"
              className="cc-btn cc-btn--pagare"
              onClick={() => void generarPagare()}
              disabled={saving || !!uploading || generandoPagare}
            >
              {generandoPagare
                ? 'Guardando pagaré…'
                : pagareUrl
                  ? '📄 Regenerar y guardar pagaré'
                  : '📄 Generar y guardar pagaré'}
            </button>
            {pagareUrl && (
              <span className="cc-alta-pagare__ok">
                ✓ Pagaré guardado —{' '}
                <a href={pagareUrl} target="_blank" rel="noopener noreferrer">
                  Ver archivo
                </a>
              </span>
            )}
          </div>
        </section>
      )}

      <div className="cc-alta-docs">
        <p className="cc-alta-docs__title">
          Documentación obligatoria — {TIPO_CLIENTE_CC_LABELS[tipoCliente]} (PDF o imagen, máx.{' '}
          {MAX_DOC_MB} MB)
        </p>
        <div className="cc-alta-docs__list">
          {docsRequeridos.map((key) => {
            const tieneArchivo = Boolean(uploadedUrls[key])
            const nombre =
              docLabels[key] ?? (tieneArchivo ? 'Archivo cargado' : null)
            return (
              <div
                key={key}
                className={`cc-alta-doc-row${tieneArchivo ? ' cc-alta-doc-row--ok' : ''}${docErrors[key] ? ' cc-alta-doc-row--error' : ''}`}
              >
                <div className="cc-alta-doc-row__head">
                  <span className="cc-alta-doc-row__icon" aria-hidden>
                    📎
                  </span>
                  <span className="cc-alta-doc-row__title">{DOC_LABELS[key]}</span>
                  {tieneArchivo && <span className="cc-alta-doc-row__badge">✓ Cargado</span>}
                </div>

                <div className="cc-alta-doc-row__actions">
                  <label className="cc-alta-doc-file-btn">
                    <input
                      ref={(el) => {
                        fileInputRefs.current[key] = el
                      }}
                      type="file"
                      accept={DOC_ACCEPT}
                      className="cc-alta-doc-file-btn__input"
                      disabled={uploading === key || saving}
                      onChange={(e) => {
                        const f = e.target.files?.[0]
                        void handleDocFile(key, f)
                        e.target.value = ''
                      }}
                    />
                    {uploading === key ? 'Subiendo…' : tieneArchivo ? 'Cambiar archivo' : 'Elegir archivo'}
                  </label>
                  {tieneArchivo && (
                    <>
                      <a
                        href={uploadedUrls[key]}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="cc-alta-doc-link"
                      >
                        Ver archivo
                      </a>
                      <button
                        type="button"
                        className="cc-alta-doc-quitar"
                        onClick={() => quitarDoc(key)}
                        disabled={uploading === key || saving}
                      >
                        Quitar
                      </button>
                    </>
                  )}
                </div>

                {nombre && <p className="cc-alta-doc-row__filename">{nombre}</p>}
                {docErrors[key] && (
                  <p className="cc-alta-doc-row__error" role="alert">
                    {docErrors[key]}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="cc-alta-form__actions">
        <button type="button" className="cc-btn cc-btn--secondary" onClick={onCancel} disabled={saving}>
          Cancelar
        </button>
        <button type="submit" className="cc-btn cc-btn--primary" disabled={saving || !!uploading}>
          {saving
            ? 'Guardando…'
            : isAdmin
              ? 'Dar de alta (aprobada)'
              : 'Enviar solicitud a administración'}
        </button>
      </div>
    </form>
  )
}

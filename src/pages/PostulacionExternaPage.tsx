import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import apiService from '../services/api'
import {
  buildResumenFormulario,
  convocatoriaPorSlug,
  type FormularioExternoRespuestas,
  type RadioOption
} from '../data/convocatoriasPostulacion'
import './PostulacionExternaPage.css'

const LOGO_URL = 'https://trello.plotcenter.com.ar/Group%20187.png'

function padNum(n: number): string {
  return String(n).padStart(2, '0')
}

function BlockTitle({ children }: { children: string }) {
  return <h2 className="pex-block-title">{children}</h2>
}

function Question({
  num,
  label,
  hint,
  required,
  children
}: {
  num: number
  label: string
  hint?: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="pex-question">
      <div className="pex-q-head">
        <span className="pex-q-num">{padNum(num)}</span>
        <div>
          <div className="pex-q-label">
            {label}
            {required && <span className="req"> *</span>}
          </div>
          {hint && <p className="pex-q-hint">{hint}</p>}
        </div>
      </div>
      {children}
    </div>
  )
}

function RadioGroup({
  name,
  options,
  value,
  onChange
}: {
  name: string
  options: RadioOption[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="pex-radio-list" role="radiogroup" aria-label={name}>
      {options.map((opt) => (
        <label
          key={opt.value}
          className={`pex-radio-opt${value === opt.value ? ' selected' : ''}`}
        >
          <input
            type="radio"
            name={name}
            value={opt.value}
            checked={value === opt.value}
            onChange={() => onChange(opt.value)}
          />
          <span>{opt.label}</span>
        </label>
      ))}
    </div>
  )
}

const EMPTY: FormularioExternoRespuestas = {
  situacion_laboral: '',
  detalle_trabajo: '',
  experiencia_desde_cv: '',
  fortalezas_cm: '',
  conocimiento_ia: '',
  detalle_ia: '',
  disponibilidad_horaria: '',
  incorporacion: '',
  pretension_salarial: '',
  motivacion_plot: '',
  frase_compromiso: '',
  confirmacion_puesto: '',
  comentarios_adicionales: ''
}

const PostulacionExternaPage = () => {
  const { slug = 'community-manager' } = useParams<{ slug: string }>()
  const conv = useMemo(() => convocatoriaPorSlug(slug || ''), [slug])

  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [telefono, setTelefono] = useState('')
  const [resp, setResp] = useState<FormularioExternoRespuestas>(EMPTY)
  const [website, setWebsite] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const setR = <K extends keyof FormularioExternoRespuestas>(key: K, val: FormularioExternoRespuestas[K]) => {
    setResp((prev) => ({ ...prev, [key]: val }))
  }

  if (!conv) {
    return (
      <div className="pex-page pex-not-found">
        <h1>Convocatoria no encontrada</h1>
        <p>El enlace no corresponde a una convocatoria activa.</p>
      </div>
    )
  }

  const validate = (): string | null => {
    if (!nombre.trim()) return 'Ingresá tu nombre y apellido.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'Ingresá un email válido.'
    if (!telefono.trim()) return 'Ingresá teléfono o WhatsApp.'
    if (!resp.situacion_laboral) return 'Seleccioná tu situación laboral.'
    if (!resp.experiencia_desde_cv.trim()) return 'Contanos qué sumaste desde que cargaste tu CV.'
    if (!resp.fortalezas_cm.trim()) return 'Indicá tus tres principales fortalezas.'
    if (!resp.conocimiento_ia) return 'Seleccioná tu nivel de conocimiento en IA.'
    if (!resp.detalle_ia.trim()) return 'Completá el detalle sobre IA.'
    if (!resp.disponibilidad_horaria) return 'Seleccioná disponibilidad horaria.'
    if (!resp.incorporacion) return 'Indicá cuándo podrías incorporarte.'
    if (!resp.pretension_salarial.trim()) return 'Indicá pretensión salarial.'
    if (!resp.motivacion_plot.trim()) return 'Contanos por qué querés trabajar en Plot Center.'
    if (resp.frase_compromiso.trim() !== conv.fraseCompromiso) {
      return `Escribí exactamente: ${conv.fraseCompromiso}`
    }
    if (resp.confirmacion_puesto.trim().toLowerCase() !== conv.puesto.toLowerCase()) {
      return `El nombre del puesto debe ser exactamente: ${conv.puesto}`
    }
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const err = validate()
    if (err) {
      setError(err)
      return
    }
    setError('')
    setLoading(true)

    const resumen = buildResumenFormulario(conv, resp)
    const result = await apiService.submitFormularioExternoPublico({
      nombre: nombre.trim(),
      email: email.trim(),
      telefono: telefono.trim(),
      puesto: conv.puesto,
      categoria_puesto: conv.categoria,
      slug: conv.slug,
      respuestas: { ...resp },
      resumen,
      website
    })

    setLoading(false)
    if (result.success) {
      setSuccess(true)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } else {
      setError(result.error || 'No se pudo enviar la postulación.')
    }
  }

  if (success) {
    return (
      <div className="pex-page">
        <div className="pex-success">
          <h2>✓ Postulación enviada</h2>
          <p>
            Gracias, {nombre}. Tu candidatura quedó activa en la base de Plot Center. Nos pondremos en
            contacto si tu perfil encaja con la convocatoria.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="pex-page">
      <header className="pex-hero">
        <div className="pex-hero-inner">
          <div className="pex-brand">
            <img src={LOGO_URL} alt="Plot Center" />
            <div className="pex-brand-text">
              <strong>PLOT CENTER</strong>
              <span>Ecosistema de comunicación</span>
            </div>
          </div>
          <p className="pex-tagline">
            <span>● </span>Convocatoria profesional · Talento y desarrollo
          </p>
          <h1>
            Postulación <em>{conv.titulo}</em>
          </h1>
          <p className="pex-hero-intro">{conv.subtitulo}</p>
        </div>
      </header>

      <div className="pex-notice">
        <div className="pex-notice-box">
          <strong>Antes de comenzar:</strong> lea cada consigna con atención y responda todos los campos
          obligatorios (marcados con <span className="req">*</span>). El seguimiento completo de las
          indicaciones es parte de lo que valoramos. Tiempo estimado: 5 a 8 minutos.
        </div>
      </div>

      <form className="pex-form-wrap" onSubmit={(e) => void handleSubmit(e)} noValidate>
        {error && <div className="pex-error">{error}</div>}

        <BlockTitle>Bloque A · Identificación</BlockTitle>

        <Question num={1} label="Nombre y apellido completo" required>
          <input
            className="pex-input"
            type="text"
            placeholder="Su nombre y apellido"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            autoComplete="name"
          />
        </Question>

        <Question num={2} label="Correo electrónico de contacto" required>
          <input
            className="pex-input"
            type="email"
            placeholder="ejemplo@correo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </Question>

        <Question num={3} label="Teléfono / WhatsApp" required>
          <input
            className="pex-input"
            type="tel"
            placeholder="Cód. de área + número"
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            autoComplete="tel"
          />
        </Question>

        <BlockTitle>Bloque B · Situación laboral actual</BlockTitle>

        <Question num={4} label="¿Cuál es su situación laboral en este momento?" required>
          <RadioGroup
            name="situacion_laboral"
            options={conv.situacionLaboral}
            value={resp.situacion_laboral}
            onChange={(v) => setR('situacion_laboral', v)}
          />
        </Question>

        <Question
          num={5}
          label="Si trabaja o trabajó recientemente, indique dónde y desde cuándo"
          hint="Empresa, puesto y período. Opcional."
        >
          <textarea
            className="pex-textarea"
            placeholder="Ej: Empresa X, Community Manager, desde marzo 2025..."
            value={resp.detalle_trabajo}
            onChange={(e) => setR('detalle_trabajo', e.target.value)}
          />
        </Question>

        <BlockTitle>Bloque C · Experiencia reciente</BlockTitle>

        <Question
          num={6}
          label="Desde que cargó su CV, ¿sumó nueva experiencia, formación o habilidades?"
          hint="Cuéntenos brevemente con sus palabras."
          required
        >
          <textarea
            className="pex-textarea"
            placeholder="Describa lo que sumó en este tiempo..."
            value={resp.experiencia_desde_cv}
            onChange={(e) => setR('experiencia_desde_cv', e.target.value)}
          />
        </Question>

        <Question num={7} label="¿Cuáles son sus tres principales fortalezas como Community Manager?" required>
          <textarea
            className="pex-textarea"
            placeholder={'1. ...\n2. ...\n3. ...'}
            value={resp.fortalezas_cm}
            onChange={(e) => setR('fortalezas_cm', e.target.value)}
            rows={5}
          />
        </Question>

        <BlockTitle>Bloque D · Inteligencia artificial</BlockTitle>

        <Question
          num={8}
          label="¿Tiene interés o conocimiento en herramientas de IA aplicadas a la comunicación?"
          required
        >
          <RadioGroup
            name="conocimiento_ia"
            options={conv.conocimientoIa}
            value={resp.conocimiento_ia}
            onChange={(v) => setR('conocimiento_ia', v)}
          />
        </Question>

        <Question
          num={9}
          label="Si usa IA, ¿cuáles y para qué? Si no, ¿le interesaría aprender?"
          required
        >
          <textarea
            className="pex-textarea"
            placeholder="Cuéntenos su experiencia o interés con la IA..."
            value={resp.detalle_ia}
            onChange={(e) => setR('detalle_ia', e.target.value)}
          />
        </Question>

        <BlockTitle>Bloque E · Disponibilidad y expectativas</BlockTitle>

        <Question num={10} label="¿Cuál es su disponibilidad horaria?" required>
          <RadioGroup
            name="disponibilidad_horaria"
            options={conv.disponibilidadHoraria}
            value={resp.disponibilidad_horaria}
            onChange={(v) => setR('disponibilidad_horaria', v)}
          />
        </Question>

        <Question num={11} label="¿A partir de cuándo podría incorporarse?" required>
          <RadioGroup
            name="incorporacion"
            options={conv.incorporacion}
            value={resp.incorporacion}
            onChange={(v) => setR('incorporacion', v)}
          />
        </Question>

        <Question
          num={12}
          label="¿Cuál es su pretensión salarial mensual?"
          hint="Indique un valor o rango de referencia."
          required
        >
          <input
            className="pex-input"
            type="text"
            placeholder="Ej: $ ... / rango ..."
            value={resp.pretension_salarial}
            onChange={(e) => setR('pretension_salarial', e.target.value)}
          />
        </Question>

        <BlockTitle>Bloque F · Motivación</BlockTitle>

        <Question
          num={13}
          label="¿Por qué le gustaría trabajar en Plot Center? ¿Qué conoce de nosotros?"
          required
        >
          <textarea
            className="pex-textarea"
            placeholder="Cuéntenos su motivación y lo que sabe de la empresa..."
            value={resp.motivacion_plot}
            onChange={(e) => setR('motivacion_plot', e.target.value)}
            rows={5}
          />
        </Question>

        <BlockTitle>Bloque G · Confirmación final</BlockTitle>

        <div className="pex-confirm-box">
          <h3>◆ Lea con atención</h3>

          <Question
            num={14}
            label={`Para confirmar que leyó todo el formulario, escriba exactamente la frase: ${conv.fraseCompromiso}`}
            required
          >
            <input
              className="pex-input"
              type="text"
              placeholder="Escriba la frase exacta"
              value={resp.frase_compromiso}
              onChange={(e) => setR('frase_compromiso', e.target.value)}
            />
          </Question>

          <Question
            num={15}
            label="Indique el nombre exacto del puesto al que se postula, tal como figura en este formulario"
            required
          >
            <input
              className="pex-input"
              type="text"
              placeholder="Nombre de la posición"
              value={resp.confirmacion_puesto}
              onChange={(e) => setR('confirmacion_puesto', e.target.value)}
            />
          </Question>
        </div>

        <Question num={16} label="¿Desea agregar algún comentario o información adicional?">
          <textarea
            className="pex-textarea"
            placeholder="Comentarios adicionales..."
            value={resp.comentarios_adicionales}
            onChange={(e) => setR('comentarios_adicionales', e.target.value)}
          />
        </Question>

        <div className="pex-honeypot" aria-hidden="true">
          <input
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </div>

        <button type="submit" className="pex-submit" disabled={loading}>
          {loading ? 'Enviando…' : 'Enviar postulación →'}
        </button>

        <p className="pex-footer-note">
          Al enviar, su candidatura quedará nuevamente activa en la base de Plot Center.
          <br />
          Plot Center · San Juan, Argentina
        </p>
      </form>
    </div>
  )
}

export default PostulacionExternaPage

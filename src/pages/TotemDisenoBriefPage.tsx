import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import apiService from '../services/api'
import { TIPOS_PRODUCTO_BRIEF, emptyClienteBriefForm, type ClienteBriefFormData } from '../constants/clienteBriefForm'
import { TOTEM_DISENO_STEP_META, TOTEM_DISENO_TIPO_HINTS } from '../constants/totemDisenoBrief'
import {
  buildBriefMockupImagePrompt,
  calcBriefProgress,
  resolveBriefMockup
} from '../utils/clienteBriefMockup'
import { generarMockupImagenIa } from '../services/clienteBriefAiService'
import ClienteBriefMockupStudio from '../components/cliente/ClienteBriefMockupStudio'
import {
  listenDisenadorEnCamino,
  readPendingDisenadorAtencion,
  solicitarDisenadorTotem
} from '../utils/totemSolicitarDisenador'
import './TotemDisenoPages.css'

const LOGO_URL = '/plot-lab-logo.png'
const IDLE_MS = 180_000

const DONDE = [
  'En el local / comercio',
  'Redes sociales',
  'Vehículos',
  'Evento o feria',
  'Oficina / interior',
  'Cartelería exterior'
]

const DIGITAL = [
  { value: 'digital', label: 'Solo digital', hint: 'Redes, web, PDF' },
  { value: 'impresion', label: 'Con impresión', hint: 'Material físico' },
  { value: 'ambos', label: 'Ambos', hint: 'Digital + impreso' }
]

const ESTILOS = ['Minimalista', 'Corporativo', 'Moderno', 'Colorido', 'Elegante', 'Divertido']

export default function TotemDisenoBriefPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const autoLlamar = searchParams.get('llamar') === '1'

  const [stepIdx, setStepIdx] = useState(0)
  const [form, setForm] = useState<ClienteBriefFormData>(() => emptyClienteBriefForm())
  const [nombre, setNombre] = useState('')
  const [empresa, setEmpresa] = useState('')
  const [telefono, setTelefono] = useState('')
  const [hintTipo, setHintTipo] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [mensaje, setMensaje] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [briefToken, setBriefToken] = useState<string | null>(null)
  const [mockupAiUrl, setMockupAiUrl] = useState<string | null>(null)
  const [mockupAiLoading, setMockupAiLoading] = useState(false)
  const [llamando, setLlamando] = useState(false)
  const [disenadorMsg, setDisenadorMsg] = useState<string | null>(null)
  const [lastTouch, setLastTouch] = useState(() => Date.now())
  const unsubRef = useRef<(() => void) | null>(null)
  const autoLlamarDone = useRef(false)

  const touch = () => setLastTouch(Date.now())

  const step = TOTEM_DISENO_STEP_META[stepIdx]!
  const progress = useMemo(
    () =>
      calcBriefProgress(
        form.tipo_producto_servicio,
        form.tipo_producto_otro,
        form.donde_colocados,
        form.digital_o_impresion,
        form.necesita_asesoramiento,
        form.objetivo_proyecto,
        form.brief_publico,
        form.estilo_diseno
      ),
    [form]
  )

  const mockup = useMemo(
    () =>
      resolveBriefMockup(
        form.tipo_producto_servicio,
        form.tipo_producto_otro,
        form.donde_colocados,
        form.digital_o_impresion,
        form.necesita_asesoramiento
      ),
    [form]
  )

  useEffect(() => {
    return () => {
      unsubRef.current?.()
      unsubRef.current = null
    }
  }, [])

  /** Si volvemos al brief con una llamada pendiente, seguir escuchando la respuesta. */
  useEffect(() => {
    const pending = readPendingDisenadorAtencion()
    if (!pending?.atencionId || unsubRef.current) return
    setDisenadorMsg((prev) => prev || '🎨 Ya avisamos a un diseñador. Esperando respuesta…')
    unsubRef.current = listenDisenadorEnCamino(
      { atencionId: pending.atencionId, requestNonce: pending.requestNonce },
      (payload) => {
        setDisenadorMsg(`✅ ${payload.mensaje}`)
        unsubRef.current?.()
        unsubRef.current = null
      }
    )
  }, [])

  useEffect(() => {
    const id = window.setInterval(() => {
      if (Date.now() - lastTouch > IDLE_MS && !saving) {
        navigate('/totem/diseno', { replace: true })
      }
    }, 4000)
    return () => window.clearInterval(id)
  }, [lastTouch, navigate, saving])

  const patch = (partial: Partial<ClienteBriefFormData>) => {
    touch()
    setForm((prev) => ({ ...prev, ...partial }))
    setMockupAiUrl(null)
  }

  const toggleTipo = (tipo: string) => {
    touch()
    setHintTipo(TOTEM_DISENO_TIPO_HINTS[tipo] || null)
    const set = new Set(form.tipo_producto_servicio)
    if (set.has(tipo)) set.delete(tipo)
    else set.add(tipo)
    patch({ tipo_producto_servicio: [...set], necesita_asesoramiento: false })
  }

  const llamarDisenador = useCallback(async () => {
    if (llamando) return
    touch()
    setLlamando(true)
    setError(null)
    try {
      const r = await solicitarDisenadorTotem({
        clienteNombre: nombre.trim() || 'Cliente tótem diseño',
        briefToken: briefToken || undefined,
        contexto:
          'Cliente en tótem 1° piso Diseño tocó «Llamar a un diseñador».' +
          (form.tipo_producto_servicio.length
            ? ` Interés: ${form.tipo_producto_servicio.join(', ')}.`
            : '')
      })
      setDisenadorMsg(r.mensaje)
      if (!r.ok) {
        setError(r.mensaje)
        return
      }
      unsubRef.current?.()
      unsubRef.current = listenDisenadorEnCamino(
        { atencionId: r.atencionId, requestNonce: r.requestNonce },
        (payload) => {
          setDisenadorMsg(`✅ ${payload.mensaje}`)
          unsubRef.current?.()
          unsubRef.current = null
        }
      )
    } finally {
      setLlamando(false)
    }
  }, [briefToken, form.tipo_producto_servicio, llamando, nombre])

  useEffect(() => {
    if (!autoLlamar || autoLlamarDone.current) return
    autoLlamarDone.current = true
    void llamarDisenador()
  }, [autoLlamar, llamarDisenador])

  const handleGenerarMockupIa = async () => {
    if (mockup.empty) {
      setError('Elegí al menos un tipo de producto para generar el mockup.')
      return
    }
    touch()
    setMockupAiLoading(true)
    setError(null)
    try {
      const prompt = buildBriefMockupImagePrompt({
        productLabel: mockup.productLabel,
        productKind: mockup.productKind,
        sceneKind: mockup.sceneKind,
        tipos: form.tipo_producto_servicio,
        donde_colocados: form.donde_colocados,
        objetivo_proyecto: form.objetivo_proyecto,
        brief_publico: form.brief_publico,
        estilo_diseno: form.estilo_diseno,
        digital_o_impresion: form.digital_o_impresion,
        cantidades: form.cantidades
      })
      const dataUrl = await generarMockupImagenIa(prompt)
      setMockupAiUrl(dataUrl)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo generar la imagen')
    } finally {
      setMockupAiLoading(false)
    }
  }

  const canNext = (): boolean => {
    if (step.id === 'contacto') return nombre.trim().length >= 2
    if (step.id === 'producto')
      return form.tipo_producto_servicio.length > 0 || form.necesita_asesoramiento
    return true
  }

  const goNext = () => {
    touch()
    setError(null)
    if (!canNext()) {
      if (step.id === 'contacto') setError('Ingresá tu nombre para continuar.')
      else if (step.id === 'producto') setError('Elegí al menos una opción o pedí asesoramiento.')
      return
    }
    setStepIdx((i) => Math.min(i + 1, TOTEM_DISENO_STEP_META.length - 1))
  }

  const goPrev = () => {
    touch()
    setError(null)
    setStepIdx((i) => Math.max(i - 1, 0))
  }

  const handleEnviar = async () => {
    touch()
    if (!nombre.trim()) {
      setError('El nombre es obligatorio.')
      setStepIdx(0)
      return
    }
    if (form.tipo_producto_servicio.length === 0 && !form.necesita_asesoramiento) {
      setError('Elegí al menos un producto o pedí asesoramiento.')
      setStepIdx(1)
      return
    }

    setSaving(true)
    setError(null)
    try {
      const created = await apiService.crearBriefPublico()
      if (!created.success || !created.data) {
        setError(created.error || 'No se pudo crear el brief.')
        return
      }
      const token = created.data
      setBriefToken(token)

      const updated = await apiService.actualizarBriefPublico({
        token,
        cliente_nombre_completo: nombre.trim(),
        cliente_empresa: empresa.trim() || undefined,
        telefono_cliente: telefono.trim() || undefined,
        tipo_producto_servicio: form.tipo_producto_servicio,
        tipo_producto_otro: form.tipo_producto_otro || undefined,
        necesita_asesoramiento: form.necesita_asesoramiento,
        donde_colocados: form.donde_colocados || undefined,
        digital_o_impresion: form.digital_o_impresion || undefined,
        cantidades: form.cantidades || undefined,
        objetivo_proyecto: form.objetivo_proyecto || undefined,
        brief_publico: form.brief_publico || undefined,
        estilo_diseno: form.estilo_diseno || undefined,
        es_urgencia: form.es_urgencia
      })
      if (!updated.success) {
        setError(updated.error || 'No se pudo guardar el brief.')
        return
      }

      const briefInfo = await apiService.obtenerBriefPorToken(token)
      const idBrief =
        briefInfo.success && briefInfo.data?.id != null ? Number(briefInfo.data.id) : null

      if (idBrief && mockupAiUrl?.startsWith('data:')) {
        try {
          const blob = await (await fetch(mockupAiUrl)).blob()
          const file = new File([blob], `mockup-totem-${Date.now()}.png`, { type: blob.type || 'image/png' })
          await apiService.uploadArchivoBriefPublico(file, idBrief, {
            tipoEtiqueta: 'mockup_ia',
            nombreArchivo: file.name
          })
        } catch {
          /* mockup opcional */
        }
      }

      await apiService.crearAtencionMostrador({
        cliente_nombre: nombre.trim(),
        tipo: 'consulta',
        usuario_id: 1,
        usuario_nombre: 'Totem diseño',
        notas: `Brief desde tótem Diseño (1° piso). Token: ${token}. Productos: ${
          form.tipo_producto_servicio.join(', ') || 'asesoramiento'
        }.`,
        sector_destino: 'Diseño gráfico'
      })

      setMensaje('✅ Brief enviado a Diseño. Ya pueden verlo en Briefs pendientes.')
      setEnviado(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al enviar el brief')
    } finally {
      setSaving(false)
    }
  }

  if (enviado) {
    return (
      <div className="totem-diseno-page" onClick={touch} onTouchStart={touch}>
        <div className="totem-diseno-success">
          <span className="totem-diseno-success-badge">Diseño avisado</span>
          <h1>¡Listo, {nombre.split(' ')[0]}!</h1>
          <p>{mensaje}</p>
          {disenadorMsg && <p className="totem-diseno-call-feedback">{disenadorMsg}</p>}
          <div className="totem-diseno-success-actions">
            <button type="button" className="totem-diseno-btn-primary" onClick={() => void llamarDisenador()}>
              {llamando ? 'Avisando…' : '🎨 Llamar a un diseñador'}
            </button>
            <button type="button" className="totem-diseno-btn-ghost" onClick={() => navigate('/totem/diseno')}>
              Volver al inicio
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="totem-diseno-page totem-diseno-brief" onClick={touch} onTouchStart={touch}>
      <header className="totem-diseno-brief-top">
        <button type="button" className="totem-diseno-back" onClick={() => navigate('/totem/diseno')}>
          ← Diseño
        </button>
        <img src={LOGO_URL} alt="" className="totem-diseno-logo totem-diseno-logo--sm" />
        <button
          type="button"
          className="totem-diseno-call-fab"
          disabled={llamando}
          onClick={() => void llamarDisenador()}
        >
          {llamando ? 'Avisando…' : '🎨 Llamar diseñador'}
        </button>
      </header>

      <div className="totem-diseno-steps" role="navigation" aria-label="Pasos del brief">
        {TOTEM_DISENO_STEP_META.map((s, i) => (
          <button
            key={s.id}
            type="button"
            className={`totem-diseno-step-pill${i === stepIdx ? ' is-active' : ''}${i < stepIdx ? ' is-done' : ''}`}
            onClick={() => {
              touch()
              setStepIdx(i)
            }}
          >
            <span className="totem-diseno-step-num">{i + 1}</span>
            <span className="totem-diseno-step-label">{s.title}</span>
          </button>
        ))}
      </div>

      <div className="totem-diseno-brief-layout">
        <section className="totem-diseno-brief-main">
          <div className="totem-diseno-step-head">
            <h1>{step.title}</h1>
            <p>{step.hint}</p>
          </div>

          {step.id === 'contacto' && (
            <div className="totem-diseno-fields">
              <label>
                Tu nombre *
                <input
                  value={nombre}
                  onChange={(e) => {
                    touch()
                    setNombre(e.target.value)
                  }}
                  placeholder="Nombre y apellido"
                  autoComplete="name"
                />
              </label>
              <label>
                Empresa (opcional)
                <input
                  value={empresa}
                  onChange={(e) => {
                    touch()
                    setEmpresa(e.target.value)
                  }}
                  placeholder="Nombre del negocio"
                />
              </label>
              <label>
                Teléfono (opcional)
                <input
                  value={telefono}
                  onChange={(e) => {
                    touch()
                    setTelefono(e.target.value)
                  }}
                  placeholder="WhatsApp o celular"
                  inputMode="tel"
                />
              </label>
            </div>
          )}

          {step.id === 'producto' && (
            <div className="totem-diseno-tipos">
              {hintTipo && <p className="totem-diseno-tipo-hint">{hintTipo}</p>}
              <div className="totem-diseno-chips">
                {TIPOS_PRODUCTO_BRIEF.filter((t) => t !== 'No sé bien lo que necesito, quiero asesoramiento').map(
                  (tipo) => (
                    <button
                      key={tipo}
                      type="button"
                      className={`totem-diseno-chip${form.tipo_producto_servicio.includes(tipo) ? ' is-active' : ''}`}
                      onClick={() => toggleTipo(tipo)}
                      title={TOTEM_DISENO_TIPO_HINTS[tipo]}
                    >
                      {tipo}
                    </button>
                  )
                )}
              </div>
              <button
                type="button"
                className={`totem-diseno-asesor-chip${form.necesita_asesoramiento ? ' is-active' : ''}`}
                onClick={() => {
                  touch()
                  setHintTipo(TOTEM_DISENO_TIPO_HINTS['No sé bien lo que necesito, quiero asesoramiento'])
                  patch({
                    necesita_asesoramiento: !form.necesita_asesoramiento,
                    tipo_producto_servicio: []
                  })
                }}
              >
                No sé bien lo que necesito — quiero que me ayuden
              </button>
            </div>
          )}

          {step.id === 'uso' && (
            <div className="totem-diseno-fields">
              <p className="totem-diseno-field-label">¿Dónde se va a usar?</p>
              <div className="totem-diseno-chips">
                {DONDE.map((op) => (
                  <button
                    key={op}
                    type="button"
                    className={`totem-diseno-chip${form.donde_colocados === op ? ' is-active' : ''}`}
                    onClick={() => patch({ donde_colocados: form.donde_colocados === op ? '' : op })}
                  >
                    {op}
                  </button>
                ))}
              </div>
              <p className="totem-diseno-field-label">¿Digital, impresión o ambos?</p>
              <div className="totem-diseno-chips totem-diseno-chips--large">
                {DIGITAL.map((op) => (
                  <button
                    key={op.value}
                    type="button"
                    className={`totem-diseno-chip totem-diseno-chip--block${
                      form.digital_o_impresion === op.value ? ' is-active' : ''
                    }`}
                    onClick={() =>
                      patch({
                        digital_o_impresion: form.digital_o_impresion === op.value ? '' : op.value
                      })
                    }
                  >
                    <strong>{op.label}</strong>
                    <small>{op.hint}</small>
                  </button>
                ))}
              </div>
              <label>
                Objetivo del proyecto
                <textarea
                  rows={3}
                  value={form.objetivo_proyecto}
                  onChange={(e) => patch({ objetivo_proyecto: e.target.value })}
                  placeholder="Ej: lanzar promo de invierno, renovar identidad…"
                />
              </label>
            </div>
          )}

          {step.id === 'estilo' && (
            <div className="totem-diseno-fields">
              <p className="totem-diseno-field-label">Estilo visual</p>
              <div className="totem-diseno-chips">
                {ESTILOS.map((op) => (
                  <button
                    key={op}
                    type="button"
                    className={`totem-diseno-chip${form.estilo_diseno === op ? ' is-active' : ''}`}
                    onClick={() => patch({ estilo_diseno: form.estilo_diseno === op ? '' : op })}
                  >
                    {op}
                  </button>
                ))}
              </div>
              <label>
                Contanos más del diseño
                <textarea
                  rows={4}
                  value={form.brief_publico}
                  onChange={(e) => patch({ brief_publico: e.target.value })}
                  placeholder="Colores, textos, referencias, lo que no puede faltar…"
                />
              </label>
              <button
                type="button"
                className="totem-diseno-btn-primary"
                disabled={mockupAiLoading || mockup.empty}
                onClick={() => void handleGenerarMockupIa()}
              >
                {mockupAiLoading ? 'Generando imagen…' : '✨ Generar imagen con IA'}
              </button>
            </div>
          )}

          {step.id === 'enviar' && (
            <div className="totem-diseno-review">
              <dl>
                <div>
                  <dt>Cliente</dt>
                  <dd>
                    {nombre}
                    {empresa ? ` · ${empresa}` : ''}
                    {telefono ? ` · ${telefono}` : ''}
                  </dd>
                </div>
                <div>
                  <dt>Qué necesita</dt>
                  <dd>
                    {form.necesita_asesoramiento
                      ? 'Asesoramiento'
                      : form.tipo_producto_servicio.join(', ') || '—'}
                  </dd>
                </div>
                <div>
                  <dt>Uso</dt>
                  <dd>
                    {[form.donde_colocados, form.digital_o_impresion, form.estilo_diseno]
                      .filter(Boolean)
                      .join(' · ') || '—'}
                  </dd>
                </div>
              </dl>
              <label className="totem-diseno-check">
                <input
                  type="checkbox"
                  checked={form.es_urgencia}
                  onChange={(e) => patch({ es_urgencia: e.target.checked })}
                />
                Es urgente
              </label>
              <button
                type="button"
                className="totem-diseno-btn-primary totem-diseno-btn-primary--xl"
                disabled={saving}
                onClick={() => void handleEnviar()}
              >
                {saving ? 'Enviando a Diseño…' : 'Enviar brief a Diseño'}
              </button>
            </div>
          )}

          {(error || disenadorMsg) && (
            <div className="totem-diseno-feedback">
              {error && <p className="totem-diseno-error">{error}</p>}
              {disenadorMsg && <p className="totem-diseno-call-feedback">{disenadorMsg}</p>}
            </div>
          )}

          <div className="totem-diseno-nav">
            <button type="button" className="totem-diseno-btn-ghost" disabled={stepIdx === 0} onClick={goPrev}>
              Atrás
            </button>
            {step.id !== 'enviar' && (
              <button type="button" className="totem-diseno-btn-primary" onClick={goNext}>
                Siguiente
              </button>
            )}
          </div>
        </section>

        <div className="totem-diseno-mockup-wrap">
          <ClienteBriefMockupStudio
            productKind={mockup.productKind}
            sceneKind={mockup.sceneKind}
            productLabel={mockup.productLabel}
            especificacion={form.brief_publico}
            dondeColocados={form.donde_colocados}
            digitalOImpresion={form.digital_o_impresion}
            cantidades={form.cantidades}
            estiloDiseno={form.estilo_diseno}
            selectedTipos={form.tipo_producto_servicio}
            progress={progress}
            empty={mockup.empty}
            aiImageUrl={mockupAiUrl}
            loadingAi={mockupAiLoading}
            userImageUrl={null}
            iaLoading={false}
            onGenerarMockupIa={() => void handleGenerarMockupIa()}
            onGenerarTodoIa={() => void handleGenerarMockupIa()}
          />
        </div>
      </div>
    </div>
  )
}

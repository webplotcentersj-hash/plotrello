import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import type { ClienteBriefFormData } from '../../constants/clienteBriefForm'
import { TIPOS_PRODUCTO_BRIEF } from '../../constants/clienteBriefForm'
import { listenAsesorEnCamino, solicitarAsesorTotem } from '../../utils/totemSolicitarAsesor'
import './TotemCatalogoBriefForm.css'

type Props = {
  value: ClienteBriefFormData
  onChange: (next: ClienteBriefFormData) => void
  productoNombre: string
}

const TIPOS_SIN_ASESOR = TIPOS_PRODUCTO_BRIEF.filter(
  (t) => t !== 'No sé bien lo que necesito, quiero asesoramiento'
)

const DONDE_OPCIONES = [
  'En el local / comercio',
  'Redes sociales',
  'Vehículos',
  'Evento o feria',
  'Oficina / interior',
  'Cartelería exterior'
]

const DIGITAL_OPCIONES = [
  { value: 'digital', label: 'Solo digital', icon: '💻' },
  { value: 'impresion', label: 'Con impresión', icon: '🖨️' },
  { value: 'ambos', label: 'Ambos', icon: '✨' }
] as const

const CANTIDAD_OPCIONES = ['1–10', '11–50', '51–100', '100–500', 'Más de 500', 'A definir']

const OBJETIVO_OPCIONES = [
  'Vender más',
  'Comunicar un evento',
  'Reforzar la marca',
  'Lanzamiento',
  'Señalización',
  'Fidelizar clientes'
]

const LOGO_OPCIONES = [
  { value: 'si_pdf_eps_ai', label: 'Sí, vectorial (AI/EPS/PDF)' },
  { value: 'si_solo_imagen', label: 'Sí, solo imagen' },
  { value: 'no', label: 'No tengo logo' },
  { value: 'necesito_diseno', label: 'Necesito diseño de logo' }
]

const TEXTOS_OPCIONES = [
  { value: 'si_definitivos', label: 'Sí, listos' },
  { value: 'no', label: 'No tengo textos' },
  { value: 'necesito_redacten', label: 'Necesito que los redacten' }
]

const IMAGENES_OPCIONES = [
  { value: 'si_material_propio', label: 'Tengo fotos propias' },
  { value: 'no', label: 'No tengo imágenes' },
  { value: 'usar_banco_imagenes', label: 'Usar banco de imágenes' }
]

const ESTILO_OPCIONES = ['Minimalista', 'Corporativo', 'Moderno', 'Colorido', 'Elegante', 'Divertido']

function Chip({
  active,
  children,
  onClick,
  className = ''
}: {
  active?: boolean
  children: ReactNode
  onClick: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      className={`totem-brief-chip${active ? ' totem-brief-chip--active' : ''} ${className}`.trim()}
      onClick={onClick}
      aria-pressed={active}
    >
      {children}
    </button>
  )
}

export default function TotemCatalogoBriefForm({ value, onChange, productoNombre }: Props) {
  const [asesorMsg, setAsesorMsg] = useState<string | null>(null)
  const [llamandoAsesor, setLlamandoAsesor] = useState(false)
  const [asesorEnCamino, setAsesorEnCamino] = useState(false)
  const unsubEnCaminoRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    return () => {
      unsubEnCaminoRef.current?.()
      unsubEnCaminoRef.current = null
    }
  }, [])

  const patch = useCallback(
    (partial: Partial<ClienteBriefFormData>) => onChange({ ...value, ...partial }),
    [onChange, value]
  )

  const toggleTipo = (tipo: string) => {
    const already = value.tipo_producto_servicio.length === 1 && value.tipo_producto_servicio[0] === tipo
    patch({ tipo_producto_servicio: already ? [] : [tipo] })
  }

  const activarAsesoramiento = () => {
    if (value.necesita_asesoramiento || llamandoAsesor) return
    patch({ necesita_asesoramiento: true })
    setLlamandoAsesor(true)
    setAsesorEnCamino(false)
    void solicitarAsesorTotem({
      productoNombre,
      contexto: 'El cliente marcó que necesita asesoramiento en el brief del catálogo.'
    }).then((r) => {
      setAsesorMsg(r.mensaje)
      setLlamandoAsesor(false)
      if (!r.ok) {
        patch({ necesita_asesoramiento: false })
        return
      }
      unsubEnCaminoRef.current?.()
      unsubEnCaminoRef.current = listenAsesorEnCamino(
        { atencionId: r.atencionId, requestNonce: r.requestNonce },
        (payload) => {
          setAsesorEnCamino(true)
          setAsesorMsg(`✅ ${payload.mensaje}`)
          unsubEnCaminoRef.current?.()
          unsubEnCaminoRef.current = null
        }
      )
    })
  }

  const mostrarDetalles = value.tipo_producto_servicio.length > 0 && !value.necesita_asesoramiento

  return (
    <div className="totem-brief">
      <div className="totem-brief__hero">
        <span className="totem-brief__badge">Brief de diseño</span>
        <p className="totem-brief__producto">
          Producto: <strong>{productoNombre}</strong>
        </p>
        <p className="totem-brief__hint">Tocá las opciones que correspondan. No hace falta escribir mucho.</p>
      </div>

      <section className="totem-brief__section">
        <h3 className="totem-brief__title">
          <span className="totem-brief__step">1</span> ¿Qué necesitás?
        </h3>
        <p className="totem-brief__help">Elegí una sola opción</p>
        <div className="totem-brief__chips totem-brief__chips--grid">
          {TIPOS_SIN_ASESOR.map((tipo) => (
            <Chip
              key={tipo}
              active={value.tipo_producto_servicio.includes(tipo)}
              onClick={() => toggleTipo(tipo)}
            >
              {tipo}
            </Chip>
          ))}
        </div>
      </section>

      <section className="totem-brief__section totem-brief__section--asesor">
        <button
          type="button"
          className={`totem-brief__asesor-btn${value.necesita_asesoramiento ? ' totem-brief__asesor-btn--active' : ''}`}
          onClick={activarAsesoramiento}
          disabled={llamandoAsesor || value.necesita_asesoramiento}
        >
          <span className="totem-brief__asesor-icon" aria-hidden>
            📞
          </span>
          <span className="totem-brief__asesor-text">
            <strong>No sé bien lo que necesito</strong>
            <small>Llamar a un asesor para ayudarme</small>
          </span>
          {llamandoAsesor && <span className="totem-brief__asesor-loading">Avisando…</span>}
          {value.necesita_asesoramiento && !llamandoAsesor && !asesorEnCamino && (
            <span className="totem-brief__asesor-ok">✓ Asesor avisado</span>
          )}
          {asesorEnCamino && (
            <span className="totem-brief__asesor-ok">✓ En camino</span>
          )}
        </button>
        {asesorMsg && (
          <p className={`totem-brief__asesor-msg${asesorEnCamino ? ' totem-brief__asesor-msg--en-camino' : ''}`}>
            {asesorMsg}
          </p>
        )}
      </section>

      {mostrarDetalles && (
        <>
          <section className="totem-brief__section">
            <h3 className="totem-brief__title">
              <span className="totem-brief__step">2</span> ¿Dónde se va a usar?
            </h3>
            <div className="totem-brief__chips">
              {DONDE_OPCIONES.map((op) => (
                <Chip
                  key={op}
                  active={value.donde_colocados === op}
                  onClick={() => patch({ donde_colocados: value.donde_colocados === op ? '' : op })}
                >
                  {op}
                </Chip>
              ))}
            </div>
          </section>

          <section className="totem-brief__section">
            <h3 className="totem-brief__title">
              <span className="totem-brief__step">3</span> Formato y cantidad
            </h3>
            <p className="totem-brief__help">¿Digital, impreso o ambos?</p>
            <div className="totem-brief__chips totem-brief__chips--digital">
              {DIGITAL_OPCIONES.map((op) => (
                <Chip
                  key={op.value}
                  active={value.digital_o_impresion === op.value}
                  onClick={() =>
                    patch({
                      digital_o_impresion: value.digital_o_impresion === op.value ? '' : op.value
                    })
                  }
                  className="totem-brief-chip--large"
                >
                  <span aria-hidden>{op.icon}</span> {op.label}
                </Chip>
              ))}
            </div>
            <p className="totem-brief__help">Cantidad aproximada</p>
            <div className="totem-brief__chips">
              {CANTIDAD_OPCIONES.map((op) => (
                <Chip
                  key={op}
                  active={value.cantidades === op}
                  onClick={() => patch({ cantidades: value.cantidades === op ? '' : op })}
                >
                  {op}
                </Chip>
              ))}
            </div>
          </section>

          <section className="totem-brief__section">
            <h3 className="totem-brief__title">
              <span className="totem-brief__step">4</span> Objetivo del proyecto
            </h3>
            <p className="totem-brief__help">¿Para qué lo necesitás?</p>
            <div className="totem-brief__chips">
              {OBJETIVO_OPCIONES.map((op) => (
                <Chip
                  key={op}
                  active={value.objetivo_proyecto === op}
                  onClick={() =>
                    patch({ objetivo_proyecto: value.objetivo_proyecto === op ? '' : op })
                  }
                >
                  {op}
                </Chip>
              ))}
            </div>
          </section>

          <section className="totem-brief__section">
            <h3 className="totem-brief__title">
              <span className="totem-brief__step">5</span> Material disponible
            </h3>
            <p className="totem-brief__sub">Logo</p>
            <div className="totem-brief__chips">
              {LOGO_OPCIONES.map((op) => (
                <Chip
                  key={op.value}
                  active={value.material_logo === op.value}
                  onClick={() =>
                    patch({ material_logo: value.material_logo === op.value ? '' : op.value })
                  }
                >
                  {op.label}
                </Chip>
              ))}
            </div>
            <p className="totem-brief__sub">Textos</p>
            <div className="totem-brief__chips">
              {TEXTOS_OPCIONES.map((op) => (
                <Chip
                  key={op.value}
                  active={value.material_textos === op.value}
                  onClick={() =>
                    patch({ material_textos: value.material_textos === op.value ? '' : op.value })
                  }
                >
                  {op.label}
                </Chip>
              ))}
            </div>
            <p className="totem-brief__sub">Imágenes / fotos</p>
            <div className="totem-brief__chips">
              {IMAGENES_OPCIONES.map((op) => (
                <Chip
                  key={op.value}
                  active={value.material_imagenes === op.value}
                  onClick={() =>
                    patch({
                      material_imagenes: value.material_imagenes === op.value ? '' : op.value
                    })
                  }
                >
                  {op.label}
                </Chip>
              ))}
            </div>
          </section>

          <section className="totem-brief__section">
            <h3 className="totem-brief__title">
              <span className="totem-brief__step">6</span> Estilo y plazos
            </h3>
            <p className="totem-brief__help">Estilo visual deseado</p>
            <div className="totem-brief__chips">
              {ESTILO_OPCIONES.map((op) => (
                <Chip
                  key={op}
                  active={value.estilo_diseno === op}
                  onClick={() => patch({ estilo_diseno: value.estilo_diseno === op ? '' : op })}
                >
                  {op}
                </Chip>
              ))}
            </div>
            <div className="totem-brief__urgente">
              <Chip
                active={value.es_urgencia}
                onClick={() => patch({ es_urgencia: !value.es_urgencia })}
                className="totem-brief-chip--urgent"
              >
                ⚡ Es urgente
              </Chip>
            </div>
          </section>
        </>
      )}

      {value.necesita_asesoramiento && (
        <p className="totem-brief__footer-hint">
          Un asesor te va a ayudar a definir el proyecto. Podés agregar al carrito y pagar; el equipo
          te contacta para afinar detalles.
        </p>
      )}
    </div>
  )
}

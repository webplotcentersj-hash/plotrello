import type { ClienteBriefFormData } from '../../constants/clienteBriefForm'
import { TIPOS_PRODUCTO_BRIEF } from '../../constants/clienteBriefForm'
import './ClienteCatalogoBriefForm.css'

type Props = {
  value: ClienteBriefFormData
  onChange: (next: ClienteBriefFormData) => void
  productoNombre: string
}

export default function ClienteCatalogoBriefForm({ value, onChange, productoNombre }: Props) {
  const patch = (partial: Partial<ClienteBriefFormData>) => {
    onChange({ ...value, ...partial })
  }

  const toggleTipo = (tipo: string) => {
    const set = new Set(value.tipo_producto_servicio)
    if (set.has(tipo)) set.delete(tipo)
    else set.add(tipo)
    patch({ tipo_producto_servicio: [...set] })
  }

  return (
    <div className="cliente-catalogo-brief">
      <p className="cliente-catalogo-brief__producto">
        Producto del catálogo: <strong>{productoNombre}</strong>
      </p>

      <div className="form-section">
        <h2>2. Tipo de Producto o Servicio que Necesitás</h2>
        <p className="section-description">Marcá una o varias opciones</p>
        <div className="checkbox-grid">
          {TIPOS_PRODUCTO_BRIEF.map((tipo) => (
            <label key={tipo} className="checkbox-label">
              <input
                type="checkbox"
                checked={value.tipo_producto_servicio.includes(tipo)}
                onChange={() => toggleTipo(tipo)}
              />
              <span>{tipo}</span>
            </label>
          ))}
        </div>
        <div className="form-group">
          <label htmlFor="cca-tipo-otro">Otro:</label>
          <input
            id="cca-tipo-otro"
            type="text"
            value={value.tipo_producto_otro}
            onChange={(e) => patch({ tipo_producto_otro: e.target.value })}
            placeholder="Especifica otro tipo de producto o servicio"
          />
        </div>
        <div className="form-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={value.necesita_asesoramiento}
              onChange={(e) => patch({ necesita_asesoramiento: e.target.checked })}
            />
            <span>No sé bien lo que necesito, quiero asesoramiento</span>
          </label>
        </div>
      </div>

      {value.tipo_producto_servicio.length > 0 && (
        <div className="form-section">
          <h3>Detalles del Producto Seleccionado</h3>
          <div className="form-group">
            <label htmlFor="cca-donde">¿Dónde serán colocados?</label>
            <input
              id="cca-donde"
              type="text"
              value={value.donde_colocados}
              onChange={(e) => patch({ donde_colocados: e.target.value })}
              placeholder="Ej: En el local, en redes sociales, en vehículos, etc."
            />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="cca-digital">¿Digital o con impresión?</label>
              <select
                id="cca-digital"
                value={value.digital_o_impresion}
                onChange={(e) => patch({ digital_o_impresion: e.target.value })}
              >
                <option value="">Seleccionar...</option>
                <option value="digital">Solo Digital</option>
                <option value="impresion">Con Impresión</option>
                <option value="ambos">Ambos</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="cca-cantidades">¿Qué cantidades?</label>
              <input
                id="cca-cantidades"
                type="text"
                value={value.cantidades}
                onChange={(e) => patch({ cantidades: e.target.value })}
                placeholder="Ej: 100 unidades, 500 ejemplares, etc."
              />
            </div>
          </div>
        </div>
      )}

      <div className="form-section">
        <h2>3. Objetivo del Producto o Servicio</h2>
        <p className="section-description">
          Ej.: vender más, comunicar un evento, reforzar identidad, lanzamiento, señalización, etc.
        </p>
        <div className="form-group">
          <textarea
            rows={3}
            value={value.objetivo_proyecto}
            onChange={(e) => patch({ objetivo_proyecto: e.target.value })}
            placeholder="Describe el objetivo principal de este proyecto..."
          />
        </div>
      </div>

      <div className="form-section">
        <h2>4. Material que Tenés Disponible para Brindarnos</h2>
        <div className="form-group">
          <label htmlFor="cca-logo">Logo</label>
          <select
            id="cca-logo"
            value={value.material_logo}
            onChange={(e) => patch({ material_logo: e.target.value })}
          >
            <option value="">Seleccionar...</option>
            <option value="si_pdf_eps_ai">Sí (PDF, EPS, AI)</option>
            <option value="si_solo_imagen">Sí, pero solo en imagen o captura</option>
            <option value="no">No</option>
            <option value="necesito_diseno">Necesito que lo diseñen</option>
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="cca-textos">Textos</label>
          <select
            id="cca-textos"
            value={value.material_textos}
            onChange={(e) => patch({ material_textos: e.target.value })}
          >
            <option value="">Seleccionar...</option>
            <option value="si_definitivos">Sí, ya están definitivos</option>
            <option value="no">No</option>
            <option value="necesito_redacten">Necesito que ustedes los redacten</option>
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="cca-imagenes">Imágenes / Fotos</label>
          <select
            id="cca-imagenes"
            value={value.material_imagenes}
            onChange={(e) => patch({ material_imagenes: e.target.value })}
          >
            <option value="">Seleccionar...</option>
            <option value="si_material_propio">Sí, tengo material propio</option>
            <option value="no">No</option>
            <option value="usar_banco_imagenes">Usar banco de imágenes</option>
          </select>
        </div>
        <div className="form-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={value.tiene_referencias}
              onChange={(e) => patch({ tiene_referencias: e.target.checked })}
            />
            <span>Referencias de estilo</span>
          </label>
        </div>
        {value.tiene_referencias && (
          <div className="form-group">
            <label htmlFor="cca-ref-links">Adjuntar links o imágenes de referencias</label>
            <textarea
              id="cca-ref-links"
              rows={2}
              value={value.referencias_links}
              onChange={(e) => patch({ referencias_links: e.target.value })}
              placeholder="Pega aquí los links de Pinterest, Behance, imágenes..."
            />
          </div>
        )}
      </div>

      <div className="form-section">
        <h2>Información Adicional del Proyecto</h2>
        <div className="form-group">
          <label htmlFor="cca-brief">Descripción Detallada del Proyecto</label>
          <textarea
            id="cca-brief"
            rows={3}
            value={value.brief_publico}
            onChange={(e) => patch({ brief_publico: e.target.value })}
            placeholder="Describe tu proyecto, contexto, ideas..."
          />
        </div>
        <div className="form-group">
          <label htmlFor="cca-estilo">Estilo de Diseño Deseado</label>
          <input
            id="cca-estilo"
            type="text"
            value={value.estilo_diseno}
            onChange={(e) => patch({ estilo_diseno: e.target.value })}
            placeholder="Ej: Minimalista, Corporativo, Moderno, Colorido, etc."
          />
        </div>
        <div className="form-group">
          <label htmlFor="cca-referencias">Referencias adicionales</label>
          <textarea
            id="cca-referencias"
            rows={2}
            value={value.referencias}
            onChange={(e) => patch({ referencias: e.target.value })}
            placeholder="Marcas, ejemplos o ideas de referencia..."
          />
        </div>
      </div>

      <div className="form-section">
        <h2>5. Plazos</h2>
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="cca-fecha">¿Tenés una fecha límite?</label>
            <input
              id="cca-fecha"
              type="date"
              value={value.fecha_limite_brief}
              onChange={(e) => patch({ fecha_limite_brief: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label className="checkbox-label urgent-label">
              <input
                type="checkbox"
                checked={value.es_urgencia}
                onChange={(e) => patch({ es_urgencia: e.target.checked })}
              />
              <span>¿Este pedido es una urgencia?</span>
            </label>
            {value.es_urgencia && (
              <small className="urgent-warning">
                Los pedidos urgentes pueden tener tarifas diferenciales por prioridad de ejecución.
              </small>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

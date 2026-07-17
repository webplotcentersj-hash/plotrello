/** Indicadores cortos para el brief de Diseño en tótem (qué es cada opción). */
export const TOTEM_DISENO_TIPO_HINTS: Record<string, string> = {
  'Diseño de una pieza gráfica': 'Una pieza suelta: aviso, post, cartel o material puntual.',
  Flyer: 'Hoja promocional para repartir o dejar en el local.',
  Banner: 'Pieza grande para eventos, redes o fachada.',
  Carpetas: 'Portadas o carpetas institucionales.',
  Folletos: 'Varias caras con info de productos o servicios.',
  Agendas: 'Cubierta e interiores personalizados.',
  'Tarjetas personales': 'Tarjeta de presentación o de negocio.',
  Stickers: 'Calcos, etiquetas o vinilos adhesivos.',
  'Presentación PDF': 'Diapositivas o PDF comercial.',
  Packaging: 'Cajas, envoltorios o empaque de marca.',
  Brochure: 'Folleto multipágina o catálogo corto.',
  Cuaderno: 'Tapa y grilla personalizada.',
  Calendario: 'Mural, escritorio o imantado.',
  Logo: 'Marca nueva desde cero.',
  'Rediseño de logo existente': 'Actualizar un logo que ya tenés.',
  Cartelería: 'Carteles para local, vía pública o interior.',
  'Ploteo vehicular': 'Gráfica para autos, vans o flota.',
  'Ploteo de vidrieras/comercios': 'Vinilos y ploteo de vidrios o local.',
  Señalética: 'Señales internas, orientación o seguridad.',
  'Diseño y desarrollo web. Automatización con IA': 'Web, landing o automatización con IA.',
  'No sé bien lo que necesito, quiero asesoramiento': 'Te ayudamos a definir el proyecto.'
}

export const TOTEM_DISENO_STEP_META = [
  {
    id: 'contacto',
    title: 'Tus datos',
    hint: 'Para que Diseño te contacte y reserve el trabajo.'
  },
  {
    id: 'producto',
    title: '¿Qué necesitás?',
    hint: 'Elegí una o más opciones. Tocá para ver de qué se trata.'
  },
  {
    id: 'uso',
    title: 'Uso y formato',
    hint: 'Dónde se usa y si es digital, impreso o ambos.'
  },
  {
    id: 'estilo',
    title: 'Estilo y mockup',
    hint: 'Contanos el look y generá una vista previa con IA.'
  },
  {
    id: 'enviar',
    title: 'Confirmar',
    hint: 'Revisá y enviá el brief al sector Diseño.'
  }
] as const

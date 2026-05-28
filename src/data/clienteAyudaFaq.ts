export type ClienteFaqItem = {
  id: string
  pregunta: string
  respuesta: string
}

export type ClienteFaqCategoria = {
  id: string
  titulo: string
  descripcion?: string
  items: ClienteFaqItem[]
}

export const CLIENTE_FAQ_CATEGORIAS: ClienteFaqCategoria[] = [
  {
    id: 'cuenta',
    titulo: 'Cuenta y acceso',
    descripcion: 'Ingreso, sesión y datos de tu empresa.',
    items: [
      {
        id: 'cuenta-1',
        pregunta: '¿Cómo ingreso al portal?',
        respuesta:
          'Entrá a la dirección de Plot Center para clientes (ruta /cliente/login), completá usuario y contraseña que te dio el equipo, y pulsá Ingresar. Si las credenciales son correctas, vas a tu inicio (/cliente/dashboard).'
      },
      {
        id: 'cuenta-2',
        pregunta: 'Olvidé mi usuario o contraseña',
        respuesta:
          'El portal no permite restablecer la clave por tu cuenta. Escribinos por WhatsApp, teléfono o mail a atención al cliente indicando tu empresa o CUIT/DNI. Plot Center verifica tu identidad y te envía o renueva el acceso.'
      },
      {
        id: 'cuenta-3',
        pregunta: '¿Pueden varias personas usar la misma cuenta?',
        respuesta:
          'Sí, si tu empresa tiene un solo usuario web compartido. Para trazabilidad (quién hizo cada pedido o mensaje), conviene pedir usuarios separados en Gestión de clientes web.'
      },
      {
        id: 'cuenta-4',
        pregunta: '¿Cómo cierro sesión?',
        respuesta:
          'En la barra superior del portal, botón Salir (icono de puerta). En dispositivos compartidos, cerrá sesión siempre al terminar.'
      },
      {
        id: 'cuenta-5',
        pregunta: 'Modo claro y modo oscuro',
        respuesta:
          'El interruptor sol/luna en la barra cambia el tema del portal. La preferencia se guarda en tu navegador para la próxima visita.'
      }
    ]
  },
  {
    id: 'navegacion',
    titulo: 'Inicio y navegación',
    items: [
      {
        id: 'nav-1',
        pregunta: '¿Qué veo en el inicio (dashboard)?',
        respuesta:
          'Resumen de pedidos recientes, accesos rápidos (catálogo, carrito, presupuestos, mensajes, PlotAI, reclamos), briefs de diseño, trabajos listos para retirar y búsqueda rápida por número de OP o pedido.'
      },
      {
        id: 'nav-2',
        pregunta: '¿Para qué sirve el menú superior?',
        respuesta:
          'Inicio: panel principal. Catálogo: productos y servicios. Pedidos: armar un pedido nuevo. Buscar OP: estado de una orden de producción. Ayuda: esta página y herramientas de soporte.'
      },
      {
        id: 'nav-3',
        pregunta: '¿Qué es la campana de notificaciones?',
        respuesta:
          'Muestra avisos de Plot Center (por ejemplo cuando tu pedido pasa a OP, hay novedades o respuestas). El número naranja indica cuántas no leíste. Al entrar en Notificaciones se marcan como vistas.'
      },
      {
        id: 'nav-4',
        pregunta: '¿Puedo usar el portal desde el celular?',
        respuesta:
          'Sí. El diseño es adaptable. En pantallas chicas el menú se abre con el ícono de hamburguesa. Para subir archivos pesados o ver mockups grandes, una tablet o PC suele ser más cómoda.'
      }
    ]
  },
  {
    id: 'pedidos',
    titulo: 'Catálogo, carrito y pedidos',
    items: [
      {
        id: 'ped-1',
        pregunta: '¿Cómo compro o pido algo?',
        respuesta:
          'Catálogo → elegí artículos y cantidades → Carrito → revisá totales → Nuevo pedido (o checkout). Completá especificación, ubicación del trabajo, archivos si tenés, y confirmá. Recibirás número de pedido web.'
      },
      {
        id: 'ped-2',
        pregunta: '¿Qué es un pedido de compra vs cotización?',
        respuesta:
          'Compra: confirmás que querés el trabajo y, si el artículo controla stock, se descuenta al enviar (según configuración). Cotización: pedís presupuesto sin compromiso de stock hasta que Plot Center confirme y convierta el trabajo.'
      },
      {
        id: 'ped-3',
        pregunta: '¿Cómo agrego archivos a mi pedido?',
        respuesta:
          'En Nuevo pedido podés subir tu archivo original (logo, PDF, fotos). También se guarda automáticamente una vista previa (mockup) del panel lateral al crear el pedido, para que diseño vea tu idea.'
      },
      {
        id: 'ped-4',
        pregunta: 'Urgente y delivery',
        respuesta:
          'Marcá Urgente si necesitás prioridad (sujeto a confirmación del taller). Si activás delivery, completá dirección de entrega; el equipo coordinará logística y costo.'
      },
      {
        id: 'ped-5',
        pregunta: 'Estados del pedido web',
        respuesta:
          'Pendiente: recibido. En revisión: lo está viendo Plot Center. Aprobado / rechazado: decisión comercial. Convertido: ya generó OP en producción. Cancelado: no sigue. El detalle del pedido muestra estado y OP asociada si existe.'
      },
      {
        id: 'ped-6',
        pregunta: '¿Puedo modificar un pedido ya enviado?',
        respuesta:
          'No desde el portal una vez confirmado. Escribí en Mensajes (vinculado al pedido) o contactá a mostrador con el número de pedido para pedir cambios antes de que entre a producción.'
      },
      {
        id: 'ped-7',
        pregunta: '¿Dónde veo el detalle de un pedido?',
        respuesta:
          'Desde el inicio, lista de pedidos, o notificación “Ver pedido”. Ahí ves ítems, precios, especificación, archivos y estado.'
      }
    ]
  },
  {
    id: 'mockup',
    titulo: 'Especificación, mockup e IA',
    items: [
      {
        id: 'mock-1',
        pregunta: '¿Qué es la especificación del pedido?',
        respuesta:
          'Es el texto donde contás qué necesitás: medidas, cantidades, colores, texto a incluir, dónde se va a colocar el trabajo, etc. Cuanto más claro, menos idas y vueltas con diseño.'
      },
      {
        id: 'mock-2',
        pregunta: '¿Qué es el mockup (vista previa)?',
        respuesta:
          'Panel a la derecha en Nuevo pedido que simula cómo podría verse tu producto (banner, vidriera, vehículo, etc.) según el artículo y la ubicación que elijas. Al enviar el pedido se guarda una imagen para el equipo.'
      },
      {
        id: 'mock-3',
        pregunta: '“Generar con IA” en la especificación',
        respuesta:
          'Arma un brief ordenado para producción a partir de lo que escribiste (objetivo, estilo sugerido, descripción del ítem). Revisá siempre el texto antes de enviar: vos tenés la última palabra.'
      },
      {
        id: 'mock-4',
        pregunta: '“Vista previa realista (IA)”',
        respuesta:
          'Genera una imagen más realista del concepto (requiere servicio de IA activo en el servidor). Es orientativa, no es el archivo final de impresión. Si falla, igual podés enviar el pedido con el mockup visual estándar.'
      },
      {
        id: 'mock-5',
        pregunta: 'Foto de referencia en el mockup',
        respuesta:
          'Podés subir una imagen de referencia; se muestra en la vista previa y se adjunta al pedido para que diseño entienda colores o estilo.'
      }
    ]
  },
  {
    id: 'presupuestos',
    titulo: 'Presupuestos',
    items: [
      {
        id: 'pre-1',
        pregunta: '¿Dónde armo un presupuesto?',
        respuesta:
          'Desde el inicio: acceso Presupuestos, o menú interno del dashboard. Podés crear presupuesto nuevo, agregar ítems del catálogo y enviarlo a Plot Center.'
      },
      {
        id: 'pre-2',
        pregunta: 'Borrador vs enviado',
        respuesta:
          'Borrador: lo editás cuando quieras. Enviado: el equipo lo recibe para cotizar. Cuando respondan, ves importes y estado en el detalle del presupuesto.'
      },
      {
        id: 'pre-3',
        pregunta: '¿Un presupuesto aprobado se convierte en pedido?',
        respuesta:
          'Según el flujo acordado con Plot Center: a veces el equipo genera el pedido u OP desde su sistema. Consultá en Mensajes o con tu vendedor habitual si necesitás que quede registrado en el portal.'
      }
    ]
  },
  {
    id: 'disenos',
    titulo: 'Diseños y briefs',
    items: [
      {
        id: 'dis-1',
        pregunta: 'Sección Diseños en el inicio',
        respuesta:
          'Lista briefs públicos vinculados a tu mail o cuenta: formularios de idea/proyecto que completaste o que Plot Center te envió por link.'
      },
      {
        id: 'dis-2',
        pregunta: 'Link de brief sin estar logueado',
        respuesta:
          'Si recibiste un enlace /cliente/brief/... podés completarlo sin sesión. Al terminar, Plot Center puede asociarlo a una OP y avisarte por notificación cuando avance.'
      },
      {
        id: 'dis-3',
        pregunta: '¿Cuál es la diferencia entre brief y pedido?',
        respuesta:
          'El brief recopila la idea y requisitos creativos. El pedido web suma artículos, precios y compromiso comercial/stock. Muchos trabajos usan ambos: brief para diseño, pedido para facturación y producción.'
      }
    ]
  },
  {
    id: 'op',
    titulo: 'Buscar y seguir tu OP',
    items: [
      {
        id: 'op-1',
        pregunta: '¿Qué es una OP?',
        respuesta:
          'Orden de producción interna de Plot Center (ej. OP-000123). Es el número que seguís en taller, mostrador y en “Buscar mi OP”.'
      },
      {
        id: 'op-2',
        pregunta: '¿Cómo busco mi OP?',
        respuesta:
          'Menú Buscar OP o acceso desde Ayuda. Ingresá el número completo o parcial. Verás estado en taller, sector y fechas si están cargadas.'
      },
      {
        id: 'op-3',
        pregunta: 'Mi pedido web tiene OP asociada',
        respuesta:
          'En el detalle del pedido aparece el enlace a la OP cuando Plot Center ya lo convirtió a producción. También podés recibir una notificación “Tu pedido fue convertido en OP”.'
      },
      {
        id: 'op-4',
        pregunta: '¿Por qué mi OP no aparece todavía?',
        respuesta:
          'La conversión la hace el equipo cuando confirma datos, pago o disponibilidad. Si pasó mucho tiempo, usá Mensajes o contactá a mostrador con tu número de pedido.'
      }
    ]
  },
  {
    id: 'comunicacion',
    titulo: 'Mensajes, PlotAI y notificaciones',
    items: [
      {
        id: 'com-1',
        pregunta: 'Mensajes por pedido',
        respuesta:
          'En Mensajes elegís un pedido y chateás con el equipo (texto). Útil para aclarar archivos, fechas o cambios. Las respuestas las ves en la misma pantalla; refrescá si no aparecen al instante.'
      },
      {
        id: 'com-2',
        pregunta: 'PlotAI (chat)',
        respuesta:
          'Asistente para consultas generales sobre tus trabajos o el portal. No reemplaza a un vendedor para precios finales ni fechas comprometidas: ante dudas operativas, usá Mensajes o mostrador.'
      },
      {
        id: 'com-3',
        pregunta: 'Tipos de notificaciones',
        respuesta:
          'Avisos cuando tu pedido pasa a OP, hay novedades de brief, mensajes importantes, etc. Revisá la campana con regularidad.'
      }
    ]
  },
  {
    id: 'retiro',
    titulo: 'Retiro, firma y satisfacción',
    items: [
      {
        id: 'ret-1',
        pregunta: '“Listos para retirar” en el inicio',
        respuesta:
          'Muestra OP que el sistema marca como listas para entrega/retiro. Verificá horario de mostrador antes de viajar.'
      },
      {
        id: 'ret-2',
        pregunta: 'Firma y calificación al retirar',
        respuesta:
          'Cuando retirás, Plot Center puede pedirte firmar en pantalla y valorar la experiencia (estrellas/comentario). Ayuda a mejorar el servicio.'
      },
      {
        id: 'ret-3',
        pregunta: 'Encuesta de satisfacción pública',
        respuesta:
          'Desde Ayuda podés abrir la encuesta anónima de Plot Center (/satisfaccion-cliente) si querés dejar opinión sin entrar al portal.'
      },
      {
        id: 'ret-4',
        pregunta: 'Link /firma-cliente/...',
        respuesta:
          'Si te envían un enlace directo de firma para una OP, abrilo desde el mail o WhatsApp en el celular o PC y seguí los pasos en pantalla.'
      }
    ]
  },
  {
    id: 'reclamos',
    titulo: 'Reclamos y problemas',
    items: [
      {
        id: 'rec-1',
        pregunta: '¿Cómo hago un reclamo con cuenta?',
        respuesta:
          'Reclamos en el menú del inicio o desde Ayuda. Indicá OP o pedido, describí el problema y adjuntá fotos. Seguí el estado en la lista de reclamos.'
      },
      {
        id: 'rec-2',
        pregunta: 'Reclamo sin cuenta',
        respuesta:
          'Formulario público en /reclamos (enlace en Ayuda) si no podés ingresar. Dejá contacto y número de OP si lo tenés.'
      },
      {
        id: 'rec-3',
        pregunta: 'Plazos de respuesta',
        respuesta:
          'Plot Center gestiona reclamos en días hábiles. Urgencias de seguridad o trabajos frenados en obra tienen prioridad: marcá “urgente” en el reclamo y llamá a mostrador.'
      }
    ]
  },
  {
    id: 'pagos',
    titulo: 'Pagos, precios y facturación',
    items: [
      {
        id: 'pag-1',
        pregunta: '¿Los precios del catálogo son finales?',
        respuesta:
          'Son referencia según lista cargada; trabajos complejos, cambios de medida o materiales especiales pueden ajustarse. El presupuesto o confirmación de mostrador manda.'
      },
      {
        id: 'pag-2',
        pregunta: '¿Cómo pago?',
        respuesta:
          'Según tu cuenta: efectivo, transferencia, tarjeta o cuenta corriente habilitada. El pago se coordina en mostrador; el portal registra el pedido pero no siempre procesa cobro online.'
      },
      {
        id: 'pag-3',
        pregunta: 'Factura y comprobantes',
        respuesta:
          'Solicitálos en mostrador con número de OP o pedido. El portal no reemplaza la administración fiscal.'
      }
    ]
  },
  {
    id: 'tecnico',
    titulo: 'Problemas técnicos',
    items: [
      {
        id: 'tec-1',
        pregunta: 'No puedo subir un archivo',
        respuesta:
          'Revisá tamaño (límite habitual ~10 MB por archivo) y formato (imágenes, PDF, ZIP). Probá otro navegador o conexión. Si persiste, enviá el archivo por mail/WhatsApp citando el número de pedido.'
      },
      {
        id: 'tec-2',
        pregunta: 'La página no carga o se cierra la sesión',
        respuesta:
          'Actualizá el navegador, borrá caché o probá modo incógnito. Desactivá bloqueadores agresivos para el dominio de Plot Center. Volvé a iniciar sesión.'
      },
      {
        id: 'tec-3',
        pregunta: 'No veo el mockup guardado en mi pedido',
        respuesta:
          'El mockup se guarda al confirmar el pedido con al menos un artículo y especificación. Si el pedido es muy antiguo o hubo error de red, el equipo igual puede ver tu especificación y archivos subidos.'
      }
    ]
  },
  {
    id: 'contacto',
    titulo: 'Contacto con Plot Center',
    items: [
      {
        id: 'con-1',
        pregunta: '¿Cuándo usar el portal y cuándo llamar?',
        respuesta:
          'Portal: pedidos, archivos, seguimiento, mensajes escritos. Teléfono o WhatsApp de mostrador: urgencias, coordinar retiro hoy, pagos o situaciones que necesitan respuesta inmediata.'
      },
      {
        id: 'con-2',
        pregunta: 'Horario de atención',
        respuesta:
          'Consultá en mostrador o en la web institucional de Plot Center San Juan. El portal funciona 24 h para cargar pedidos; la respuesta humana es en horario comercial.'
      }
    ]
  }
]

/** Texto plano para búsqueda en la FAQ */
export function flattenClienteFaqForSearch(): Array<{
  categoriaId: string
  categoriaTitulo: string
  item: ClienteFaqItem
}> {
  return CLIENTE_FAQ_CATEGORIAS.flatMap((cat) =>
    cat.items.map((item) => ({
      categoriaId: cat.id,
      categoriaTitulo: cat.titulo,
      item
    }))
  )
}

import type { ActivityEvent, ColumnConfig, Task, TeamMember } from '../types/board'

export const BOARD_COLUMNS: ColumnConfig[] = [
  {
    id: 'diseno-grafico',
    label: 'Diseño Gráfico',
    description: 'Briefs y piezas esperando toma de trabajo',
    accent: '#f97316' // naranja intenso
  },
  {
    id: 'diseno-proceso',
    label: 'Diseño en Proceso',
    description: 'Diseñadores actuando ahora mismo',
    accent: '#ef4444' // rojo fuerte
  },
  {
    id: 'en-espera',
    label: 'En Espera',
    description: 'Pedidos pausados por aprobación o insumo',
    accent: '#eab308' // amarillo
  },
  {
    id: 'imprenta',
    label: 'Imprenta (Área de Impresión)',
    description: 'Archivos listos para salida de impresión',
    accent: '#22c55e' // verde
  },
  {
    id: 'taller-imprenta',
    label: 'Taller de Imprenta',
    description: 'Procesos físicos dentro de imprenta',
    accent: '#06b6d4' // cian
  },
  {
    id: 'taller-grafico',
    label: 'Taller Gráfico',
    description: 'Acabados, montaje y control visual',
    accent: '#3b82f6' // azul
  },
  {
    id: 'instalaciones',
    label: 'Instalaciones',
    description: 'Equipos listos para ir al sitio del cliente',
    accent: '#8b5cf6' // violeta
  },
  {
    id: 'metalurgica',
    label: 'Metalúrgica',
    description: 'Estructuras y soportes especiales',
    accent: '#ec4899' // rosa
  },
  {
    id: 'finalizado-taller',
    label: 'Finalizado en Taller',
    description: 'Listo para entregar desde taller',
    accent: '#14b8a6' // verde agua
  },
  {
    id: 'almacen-entrega',
    label: 'Almacén de Entrega',
    description: 'Pedidos embalados esperando retiro/entrega',
    accent: '#a3e635' // lima
  }
]

export const teamMembers: TeamMember[] = [
  {
    id: 'laura',
    name: 'Laura Méndez',
    role: 'Product Lead',
    avatar: 'LM',
    productivity: 92
  },
  {
    id: 'diego',
    name: 'Diego Ríos',
    role: 'Frontend',
    avatar: 'DR',
    productivity: 84
  },
  {
    id: 'ximena',
    name: 'Ximena Díaz',
    role: 'Backend',
    avatar: 'XD',
    productivity: 88
  },
  {
    id: 'sofia',
    name: 'Sofía Salas',
    role: 'QA Lead',
    avatar: 'SS',
    productivity: 79
  },
  {
    id: 'leo',
    name: 'Leo Navarro',
    role: 'Data',
    avatar: 'LN',
    productivity: 81
  }
]

const now = new Date()
const daysAgo = (count: number, hoursOffset = 0) => {
  const date = new Date(now)
  date.setDate(now.getDate() - count)
  date.setHours(date.getHours() - hoursOffset)
  return date.toISOString()
}

const photoPool = [
  'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=800',
  'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800',
  'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=800',
  'https://images.unsplash.com/photo-1503602642458-232111445657?w=800',
  'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=800',
  'https://images.unsplash.com/photo-1456406644174-8ddd4cd52a06?w=800',
  'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=800'
]

const pickPhoto = (index: number) => photoPool[index % photoPool.length]

export const initialTasks: Task[] = [
  {
    id: 'PLT-204',
    opNumber: '82431',
    title: 'Moreno Micaela',
    summary: 'Roll up sabores temporada uva. Ajustar balance de color.',
    status: 'diseno-proceso',
    priority: 'alta',
    ownerId: 'diego',
    createdBy: 'mica',
    tags: ['frontend', 'realtime'],
    materials: ['Vinilo premium 1.20m', 'Laminado mate'],
    assignedSector: 'Diseño en Proceso',
    photoUrl: pickPhoto(0),
    storyPoints: 5,
    progress: 62,
    createdAt: daysAgo(10),
    dueDate: daysAgo(-3),
    updatedAt: daysAgo(0),
    impact: 'alta'
  },
  {
    id: 'PLT-198',
    opNumber: '82717',
    title: 'Moreno Micaela',
    summary: 'Kit de frascos con ilustración floral, entrega retail.',
    status: 'diseno-grafico',
    priority: 'alta',
    ownerId: 'leo',
    createdBy: 'mica',
    tags: ['ml', 'priorities'],
    materials: ['Papel blue black x m² (0.500)', 'Tintas UV'],
    assignedSector: 'Diseño Gráfico',
    photoUrl: pickPhoto(1),
    storyPoints: 8,
    progress: 5,
    createdAt: daysAgo(14),
    dueDate: daysAgo(-1),
    updatedAt: daysAgo(6),
    impact: 'alta'
  },
  {
    id: 'PLT-201',
    opNumber: '82804',
    title: 'Yuste Agustina',
    summary: 'Señalética interna con pictogramas metálicos.',
    status: 'en-espera',
    priority: 'alta',
    ownerId: 'sofia',
    createdBy: 'nico',
    tags: ['observability'],
    materials: ['Acrílico 3mm', 'Corte láser'],
    assignedSector: 'En Espera',
    photoUrl: pickPhoto(2),
    storyPoints: 3,
    progress: 90,
    createdAt: daysAgo(7),
    dueDate: daysAgo(1),
    updatedAt: daysAgo(1),
    impact: 'alta'
  },
  {
    id: 'PLT-185',
    opNumber: '82911',
    title: 'Cordoba Alejandra',
    summary: 'Backlight 3x2 LED para frente comercial.',
    status: 'finalizado-taller',
    priority: 'media',
    ownerId: 'ximena',
    createdBy: 'pao',
    tags: ['backend', 'integraciones'],
    materials: ['Backlight 510gr', 'Fijaciones metálicas'],
    assignedSector: 'Finalizado en Taller',
    photoUrl: pickPhoto(3),
    storyPoints: 13,
    progress: 100,
    createdAt: daysAgo(21),
    dueDate: daysAgo(5),
    updatedAt: daysAgo(4),
    impact: 'media'
  },
  {
    id: 'PLT-210',
    opNumber: '83102',
    title: 'Plot Center Interno',
    summary: 'Manual de marca vitrina campaña Trello Plot.',
    status: 'diseno-grafico',
    priority: 'media',
    ownerId: 'laura',
    createdBy: 'gino',
    tags: ['design', 'branding'],
    materials: ['Vinilo microperforado', 'Plotter corte'],
    assignedSector: 'Diseño Gráfico',
    photoUrl: pickPhoto(4),
    storyPoints: 2,
    progress: 0,
    createdAt: daysAgo(3),
    dueDate: daysAgo(6),
    updatedAt: daysAgo(3),
    impact: 'media'
  },
  {
    id: 'PLT-193',
    opNumber: '83655',
    title: 'Aroos SAS',
    summary: 'Tótems con impresión doble faz y base metálica.',
    status: 'taller-grafico',
    priority: 'alta',
    ownerId: 'ximena',
    createdBy: 'mica',
    tags: ['backend', 'api'],
    materials: ['Forex 10mm', 'Base metalúrgica'],
    assignedSector: 'Taller Gráfico',
    photoUrl: pickPhoto(5),
    storyPoints: 8,
    progress: 40,
    createdAt: daysAgo(9),
    dueDate: daysAgo(2),
    updatedAt: daysAgo(0),
    impact: 'alta'
  },
  {
    id: 'PLT-188',
    opNumber: '83288',
    title: 'Banco Nación',
    summary: 'Cartelería promocional UV + laminado sector financiero.',
    status: 'imprenta',
    priority: 'media',
    ownerId: 'laura',
    createdBy: 'joaco',
    tags: ['ops'],
    materials: ['Offset 300gr', 'Laminado brillo'],
    assignedSector: 'Imprenta (Área de Impresión)',
    photoUrl: pickPhoto(6),
    storyPoints: 5,
    progress: 75,
    createdAt: daysAgo(5),
    dueDate: daysAgo(2),
    updatedAt: daysAgo(2),
    impact: 'media'
  },
  {
    id: 'PLT-214',
    opNumber: '84012',
    title: 'HG Perforaciones',
    summary: 'Pad de vehículos con instalación en sitio.',
    status: 'almacen-entrega',
    priority: 'alta',
    ownerId: 'leo',
    createdBy: 'nico',
    tags: ['analytics'],
    materials: ['Lona front 440', 'Refuerzos industriales'],
    assignedSector: 'Almacén de Entrega',
    photoUrl: pickPhoto(0),
    storyPoints: 3,
    progress: 10,
    createdAt: daysAgo(4),
    dueDate: daysAgo(0),
    updatedAt: daysAgo(1),
    impact: 'alta'
  }
]

export const initialActivity: ActivityEvent[] = [
  {
    id: 'move-1',
    taskId: 'PLT-185',
    from: 'taller-grafico',
    to: 'finalizado-taller',
    actorId: 'ximena',
    timestamp: daysAgo(4),
    note: 'Integración validada por seguridad'
  },
  {
    id: 'move-2',
    taskId: 'PLT-193',
    from: 'diseno-proceso',
    to: 'taller-grafico',
    actorId: 'ximena',
    timestamp: daysAgo(3),
    note: 'API aprobada en planning'
  },
  {
    id: 'move-3',
    taskId: 'PLT-201',
    from: 'diseno-proceso',
    to: 'en-espera',
    actorId: 'sofia',
    timestamp: daysAgo(2),
    note: 'Pasó test unitarios'
  },
  {
    id: 'move-4',
    taskId: 'PLT-188',
    from: 'imprenta',
    to: 'taller-grafico',
    actorId: 'laura',
    timestamp: daysAgo(1),
    note: 'Listo para QA'
  },
  {
    id: 'move-5',
    taskId: 'PLT-204',
    from: 'diseno-grafico',
    to: 'diseno-proceso',
    actorId: 'diego',
    timestamp: daysAgo(1),
    note: 'Sprint express'
  }
]


export type PuestoPostulacionGrupo = {
  categoria: string
  puestos: string[]
}

/** Puestos disponibles en el formulario público (Trabajá con Nosotros). */
export const PUESTOS_POSTULACION: PuestoPostulacionGrupo[] = [
  {
    categoria: 'Administración',
    puestos: [
      'Administrativo/a Contable',
      'Administrativo/a de Personal',
      'Asistente Administrativo/a'
    ]
  },
  {
    categoria: 'Caja',
    puestos: ['Cajero/a']
  },
  {
    categoria: 'Diseño Gráfico Imprenta',
    puestos: [
      'Diseñador/a Gráfico/a Senior',
      'Diseñador/a Gráfico/a Junior',
      'Pre-impresor/a',
      'Especialista en Color'
    ]
  },
  {
    categoria: 'Instalaciones',
    puestos: ['Instalador/a de Cartelería', 'Técnico/a en Instalaciones']
  },
  {
    categoria: 'Metalúrgica',
    puestos: ['Soldador/a', 'Mecánico/a', 'Tornero/a']
  },
  {
    categoria: 'Electricidad',
    puestos: ['Electricista']
  },
  {
    categoria: 'Taller Gráfico',
    puestos: [
      'Operario/a de Impresión',
      'Operario/a de Terminación',
      'Operador/a de máquinas de corte y troquel'
    ]
  },
  {
    categoria: 'Desarrollo Web',
    puestos: [
      'Desarrollador/a Frontend',
      'Desarrollador/a Backend',
      'Diseñador/a UX/UI'
    ]
  },
  {
    categoria: 'Gerencia',
    puestos: [
      'Gerente General',
      'Gerente de Producción',
      'Gerente de Marketing',
      'Jefe de Área'
    ]
  },
  {
    categoria: 'Marketing',
    puestos: ['Community Manager', 'Analista de Marketing']
  },
  {
    categoria: 'Ventas',
    puestos: ['Vendedor/a', 'Asesor/a Comercial']
  },
  {
    categoria: 'Otro',
    puestos: ['Otro']
  }
]

export function categoriaDePuesto(puesto: string): string {
  for (const g of PUESTOS_POSTULACION) {
    if (g.puestos.includes(puesto)) return g.categoria
  }
  return 'Otro'
}

/**
 * Provincia de San Juan (Argentina): 19 departamentos y localidades/distritos
 * para encuesta pública. Listas alineadas al relevamiento indicado por el equipo.
 * Las coordenadas del mapa salen de `coordsDistritoEnDepartamento` (aprox. por depto + nombre).
 */

export type DepartamentoSJ = {
  id: string
  nombre: string
  centro: { lat: number; lng: number }
  /** Localidades / distritos del departamento. */
  distritos: string[]
}

export const DEPARTAMENTOS_SAN_JUAN: DepartamentoSJ[] = [
  {
    id: 'albardon',
    nombre: 'Albardón',
    centro: { lat: -31.252, lng: -68.525 },
    distritos: ['Campo Afuera', 'El Rincón', 'General San Martín', 'La Cañada', 'Villa Ampacama']
  },
  {
    id: 'angaco',
    nombre: 'Angaco',
    centro: { lat: -31.2, lng: -68.44 },
    distritos: ['Las Tapias', 'Villa del Salvador', 'Villa Sefair Talacasto']
  },
  {
    id: 'calingasta',
    nombre: 'Calingasta',
    centro: { lat: -31.78, lng: -69.38 },
    distritos: ['Barreal', 'Calingasta', 'Tamberías', 'Villa Pituil']
  },
  {
    id: 'capital',
    nombre: 'Capital',
    centro: { lat: -31.5375, lng: -68.5364 },
    distritos: ['Concepción', 'Desamparados', 'Trinidad']
  },
  {
    id: 'caucete',
    nombre: 'Caucete',
    centro: { lat: -31.66, lng: -68.28 },
    distritos: [
      'Bermejo',
      'Caucete',
      'El Rincón',
      'Las Talas',
      'Los Médanos',
      'Marayes',
      'Pie de Palo',
      'Vallecito',
      'Villa Independencia'
    ]
  },
  {
    id: 'chimbas',
    nombre: 'Chimbas',
    centro: { lat: -31.48, lng: -68.53 },
    distritos: ['Chimbas', 'El Mogote', 'Villa Paula Albarracín de Sarmiento']
  },
  {
    id: 'iglesia',
    nombre: 'Iglesia',
    centro: { lat: -30.3, lng: -69.2 },
    distritos: ['Angualasto', 'Bella Vista', 'Iglesia', 'Las Flores', 'Pismanta', 'Rodeo', 'Tudcum']
  },
  {
    id: 'jachal',
    nombre: 'Jáchal',
    centro: { lat: -30.24, lng: -68.75 },
    distritos: [
      'El Fical',
      'El Médano',
      'Gran China',
      'Huaco',
      'La Falda',
      'Mogna',
      'Niquivil',
      'Pampa Vieja',
      'San Isidro',
      'San José de Jáchal',
      'Tamberías',
      'Tucunuco',
      'Villa Malvinas Argentinas',
      'Villa Mercedes'
    ]
  },
  {
    id: 'nueve-de-julio',
    nombre: '9 de Julio',
    centro: { lat: -31.65, lng: -68.39 },
    distritos: ['Alto de Sierra Este', 'Colonia Fiorito', 'Las Chacritas', '9 de Julio']
  },
  {
    id: 'pocito',
    nombre: 'Pocito',
    centro: { lat: -31.68, lng: -68.54 },
    distritos: [
      'Barrio José Ramírez',
      'Carpintería',
      'La Rinconada',
      'Quinto Cuartel',
      'Villa Aberastain',
      'Villa Barboza',
      'Villa Centenario',
      'Villa Nacusi'
    ]
  },
  {
    id: 'rawson',
    nombre: 'Rawson',
    centro: { lat: -31.62, lng: -68.52 },
    distritos: ['El Medanito', 'Rawson', 'Santa Lucía', 'Villa Bolaños']
  },
  {
    id: 'rivadavia',
    nombre: 'Rivadavia',
    centro: { lat: -31.58, lng: -68.62 },
    distritos: ['Rivadavia']
  },
  {
    id: 'san-martin',
    nombre: 'San Martín',
    centro: { lat: -31.55, lng: -68.24 },
    distritos: [
      'Barrio Sadop',
      'Dos Acequias',
      'San Isidro',
      'Villa Dominguito',
      'Villa Don Bosco',
      'Villa San Martín'
    ]
  },
  {
    id: 'santa-lucia',
    nombre: 'Santa Lucía',
    centro: { lat: -31.53, lng: -68.48 },
    distritos: ['Alto de Sierra', 'Colonia Gutiérrez', 'Santa Lucía']
  },
  {
    id: 'sarmiento',
    nombre: 'Sarmiento',
    centro: { lat: -32.31, lng: -68.69 },
    distritos: [
      'Cañada Honda',
      'Cienaguita',
      'Colonia Fiscal',
      'Divisadero',
      'Guanacache',
      'Las Lagunas',
      'Los Berros',
      'Media Agua',
      'Pedernal',
      'Punta del Médano'
    ]
  },
  {
    id: 'veinticinco-de-mayo',
    nombre: '25 de Mayo',
    centro: { lat: -31.67, lng: -68.23 },
    distritos: ['El Encón', 'La Chimbera', 'Las Casuarinas', 'Santa Rosa', 'Tupelí', 'Villa El Tango']
  },
  {
    id: 'ullum',
    nombre: 'Ullum',
    centro: { lat: -31.03, lng: -68.87 },
    distritos: ['Villa Ibáñez']
  },
  {
    id: 'valle-fertil',
    nombre: 'Valle Fértil',
    centro: { lat: -30.6, lng: -67.48 },
    distritos: [
      'Astica',
      'Balde del Rosario',
      'Chucuma',
      'La Majadita',
      'La Mesada',
      'Las Tumanas',
      'Los Baldecitos',
      'Villa San Agustín'
    ]
  },
  {
    id: 'zonda',
    nombre: 'Zonda',
    centro: { lat: -31.55, lng: -68.72 },
    distritos: ['Villa Basilio Nievas', 'Villa Tacú']
  }
]

export function departamentoPorId(id: string): DepartamentoSJ | undefined {
  return DEPARTAMENTOS_SAN_JUAN.find((d) => d.id === id)
}

/** Coordenadas aproximadas para marcar en el mapa (no son parcelas exactas). */
export function coordsDistritoEnDepartamento(
  departamentoId: string,
  distritoNombre: string
): { lat: number; lng: number } {
  const dep = departamentoPorId(departamentoId)
  if (!dep) return { lat: -31.5375, lng: -68.5364 }
  const s = `${departamentoId}|${distritoNombre}`
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  const angle = ((h >>> 0) % 360) * (Math.PI / 180)
  const radius = 0.01 + ((h >>> 3) % 8) * 0.0035
  return {
    lat: dep.centro.lat + Math.cos(angle) * radius * 0.55,
    lng: dep.centro.lng + Math.sin(angle) * radius * 0.55
  }
}

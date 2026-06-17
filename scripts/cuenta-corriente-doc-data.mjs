/** Documentación detallada: /mostrador/cuenta-corriente */
export const doc = {
  title: 'Cuenta corriente — Mostrador',
  subtitle:
    'Módulo completo de crédito comercial en Plot Lab: alta con documentación, aprobación administrativa, scoring, libro de movimientos, pagos, intereses, pagaré e integración con ventas en mostrador.',
  routes: [
    ['/mostrador/cuenta-corriente', 'CuentaCorrientePage — listado, cartera, altas y aprobaciones'],
    ['/mostrador/cuenta-corriente/cliente/:idCliente', 'CuentaCorrientePerfilPage — perfil, libro, pagos, ventas']
  ],
  problema: `Plot Center vende a empresas y clientes habituales que no pagan en el momento. Sin un sistema de cuenta corriente integrado al mostrador, la deuda queda en cuadernos o planillas: no hay límite de crédito claro, no se audita quién autorizó fiar, los pagos no se vinculan a comprobantes y gerencia no ve la cartera total adeudada. Cuando un cliente pide "a cuenta", el vendedor no sabe si está aprobado, si superó el límite o si tiene mal historial de pago.`,
  comoFunciona: `El módulo vive en Mostrador y se apoya en Supabase: tabla clientes_cuenta_corriente (ficha, documentos, estado, scoring), cc_cuenta_movimientos (libro contable simplificado con debe/haber) y RPCs que sincronizan ventas marcadas como "Cuenta Corriente" desde VentaRapidaModal. Un cliente pasa por alta con documentación (AFIP, DNI, domicilio, pagaré firmado), queda en estado pendiente hasta que administración aprueba, y recién entonces cliente_habilitado_cuenta_corriente permite vender fiado. Cada venta genera un cargo automático; cada pago registrado en el perfil genera un haber con comprobante obligatorio en Storage. El scoring (0–100, niveles excelente→crítico) y el límite de crédito alertan en venta si el cliente es riesgo o excede cupo.`,
  quienUsa: 'Mostrador (altas, consulta saldo, derivación a perfil), administración (aprobar/rechazar solicitudes, scoring, límites, intereses), caja (cobros que pueden reflejarse como pagos CC).',
  diagramAlta: 'alta',
  diagramLibro: 'libro',
  diagramVenta: 'venta',
  flujos: [
    {
      title: 'Alta y habilitación',
      steps: [
        'Mostrador abre /mostrador/cuenta-corriente → "Nueva solicitud" o vincula cliente existente del CRM.',
        'CuentaCorrienteAltaForm: tipo empresa o persona física, datos fiscales, contacto, condición IVA.',
        'Sube documentos a Supabase Storage (constancia AFIP, estatuto, domicilio, DNI; máx. 8 MB c/u).',
        'Genera pagaré PDF automático (cuentaCorrientePagare) — obligatorio para persona física.',
        'RPC registrar_alta_cuenta_corriente → estado pendiente (o aprobada si admin completa con permisos).',
        'Admin revisa en dashboard "Solicitudes pendientes" → aprobar o rechazar con motivo.',
        'Al aprobar: calcular_scoring_cuenta_corriente asigna score, nivel y límite sugerido.'
      ]
    },
    {
      title: 'Venta fiada en mostrador',
      steps: [
        'VentaRapidaModal (tablero o mostrador): seleccionar cliente y activar "Cuenta corriente".',
        'Sistema consulta cliente_habilitado_cuenta_corriente — si no aprobado, bloquea la venta.',
        'Muestra CuentaCorrienteScoreBadge; alerta si nivel riesgo/crítico (requiereAlertaScoring).',
        'Venta se guarda con estado_pago Pendiente y metodo_pago Cuenta Corriente.',
        'Trigger/RPC cc_upsert_movimiento_venta crea cargo en cc_cuenta_movimientos.',
        'Se recalcula scoring y saldo_actual del cliente.'
      ]
    },
    {
      title: 'Cobro y regularización',
      steps: [
        'En perfil /mostrador/cuenta-corriente/cliente/:id → pestaña Pago.',
        'Registrar monto, fecha, método (transferencia, etc.), referencia opcional.',
        'Obligatorio: subir comprobante (foto/PDF) a cuenta-corriente/{id}/pagos.',
        'Opcional: vincular pago a venta CC pendiente específica.',
        'RPC cc_registrar_pago → haber en libro, actualiza saldos y scoring.',
        'Sincronizar ventas (cc_sincronizar_ventas_cliente) al abrir perfil por si hubo ventas nuevas.'
      ]
    }
  ],
  pantallas: [
    {
      name: 'Listado — CuentaCorrientePage',
      desc: 'Vista principal de cartera.',
      detalles: [
        'CuentaCorrienteDashboard: KPIs deuda total, clientes con deuda, aprobados/pendientes/rechazados, saldo neto cartera.',
        'Filtros por estado (todos, pendiente, aprobada, rechazada) y búsqueda texto (razón social, CUIT, email, localidad).',
        'CuentaCorrienteRegistry: tarjetas por cliente con badge de scoring, saldo, acciones ver perfil / editar / scoring / quitar.',
        'Modos formulario: nuevo, editar ficha, vincular cliente CRM existente sin duplicar.',
        'Admin: aprobar/rechazar desde dashboard o tarjeta; recalcular scoring de toda la cartera.',
        'Export cartera CSV (downloadCarteraCsv).'
      ]
    },
    {
      name: 'Perfil — CuentaCorrientePerfilPage',
      desc: 'Detalle de un cliente CC.',
      detalles: [
        'Pestaña Cuenta: libro de movimientos con saldo corrido (movimientosConSaldoCorrido), tipos venta/pago/interés/ajuste.',
        'Alerta visual si saldo_actual supera limite_credito (efectivo o sugerido).',
        'Pestaña Ventas: listado ventas_cc vinculadas con estado de cobro.',
        'Pestaña Pago: formulario registro con comprobante obligatorio.',
        'Paneles: CuentaCorrienteScoringPanel (factores, ajuste manual, límite), CuentaCorrienteInteresesPanel (tasas, devengamiento).',
        'CcExportMenu: pack CSV + PDF estado de cuenta, libro movimientos, ventas, intereses.'
      ]
    }
  ],
  componentes: [
    { name: 'CuentaCorrienteAltaForm', desc: 'Formulario alta/edición con upload docs y generación pagaré.' },
    { name: 'CuentaCorrienteDashboard', desc: 'KPIs cartera y tabla solicitudes pendientes (admin).' },
    { name: 'CuentaCorrienteRegistry', desc: 'Listado tarjetas con filtros y acciones.' },
    { name: 'CuentaCorrienteScoringPanel', desc: 'Score, factores, límite manual, notas internas, recalcular.' },
    { name: 'CuentaCorrienteScoreBadge', desc: 'Badge color por nivel en listado y VentaRapidaModal.' },
    { name: 'CuentaCorrienteInteresesPanel', desc: '% mensual, mora, días gracia, registrar devengados.' },
    { name: 'CcExportMenu', desc: 'Menú export PDF estado cuenta y CSVs.' },
    { name: 'VentaRapidaModal', desc: 'Toggle CC, validación habilitado + scoring en venta.' }
  ],
  estados: [
    { estado: 'pendiente', label: 'Pendiente de aprobación', efecto: 'No puede operar fiado hasta que admin apruebe.' },
    { estado: 'aprobada', label: 'Aprobada', efecto: 'cliente_habilitado_cuenta_corriente = true; ventas CC permitidas.' },
    { estado: 'rechazada', label: 'Rechazada', efecto: 'Solicitud archivada con motivo; no opera en CC.' }
  ],
  scoring: [
    { nivel: 'excelente', rango: '80–100', uso: 'Cliente confiable; límite alto sugerido.' },
    { nivel: 'bueno', rango: '65–79', uso: 'Operación normal.' },
    { nivel: 'regular', rango: '50–64', uso: 'Monitorear; límite moderado.' },
    { nivel: 'riesgo', rango: '35–49', uso: 'requiereAlertaScoring en venta — mostrador ve advertencia.' },
    { nivel: 'critico', rango: '0–34', uso: 'Alerta fuerte; revisar antes de fiar.' }
  ],
  documentos: [
    { doc: 'Constancia AFIP', obligatorio: 'Empresa / RI', storage: 'url_constancia_afip' },
    { doc: 'Estatuto o acta societaria', obligatorio: 'Empresa', storage: 'url_estatuto' },
    { doc: 'Comprobante domicilio', obligatorio: 'Ambos', storage: 'url_comprobante_domicilio' },
    { doc: 'DNI frente/dorso o PDF', obligatorio: 'Persona física', storage: 'url_documento_dni' },
    { doc: 'Pagaré firmado', obligatorio: 'Persona física (generado PDF)', storage: 'url_pagare' }
  ],
  rpcs: [
    { rpc: 'registrar_alta_cuenta_corriente', uso: 'Alta/actualización ficha + docs' },
    { rpc: 'resolver_solicitud_cuenta_corriente', uso: 'Admin aprueba o rechaza' },
    { rpc: 'cliente_habilitado_cuenta_corriente', uso: 'Bool operativo para ventas' },
    { rpc: 'calcular_scoring_cuenta_corriente', uso: 'Recalcula score tras venta/pago' },
    { rpc: 'recalcular_scoring_cc_todos', uso: 'Batch toda la cartera' },
    { rpc: 'cc_obtener_perfil_cliente', uso: 'Perfil completo: ficha, movimientos, ventas, intereses' },
    { rpc: 'cc_sincronizar_ventas_cliente', uso: 'Alinea ventas CC con libro' },
    { rpc: 'cc_registrar_pago', uso: 'Haber con comprobante' },
    { rpc: 'cc_registrar_intereses_devengados', uso: 'Cargos por mora proporcional' },
    { rpc: 'cc_upsert_movimiento_venta', uso: 'Trigger lógica cargo por venta CC' },
    { rpc: 'agregar_cliente_cuenta_corriente', uso: 'Legacy simple (deprecated)' },
    { rpc: 'quitar_cliente_cuenta_corriente', uso: 'Baja de cartera CC' }
  ],
  tablas: [
    { tabla: 'clientes_cuenta_corriente', campos: 'estado, tipo_cliente, CUIT, razón social, URLs docs, score, limite_credito, saldo_actual, tasas interés' },
    { tabla: 'cc_cuenta_movimientos', campos: 'tipo (venta/pago/interes/ajuste), debe, haber, fecha, id_venta, url_comprobante' },
    { tabla: 'ventas', campos: 'metodo_pago Cuenta Corriente, estado_pago Pendiente/Pagado — origen del cargo' }
  ],
  exports: [
    'downloadEstadoCuentaPdf — PDF formal estado de cuenta',
    'downloadPerfilCsvPack — movimientos + ventas + intereses CSV',
    'downloadCarteraCsv — export listado cartera',
    'buildPagareCuentaCorrienteDoc — pagaré legal PDF con monto en letras'
  ],
  integraciones: [
    'VentaRapidaModal y CRM ventas — única puerta de cargos por venta fiada.',
    'Caja Plot Lab — medio de pago cuenta_corriente en planillas de cierre (plotlab_caja_sync).',
    'Storage Supabase — documentos alta y comprobantes de pago.',
    'Fusión clientes — al unificar duplicados, valida que no haya dos fichas CC.'
  ]
}

export const diagrams = {
  alta: `<svg viewBox="0 0 560 200" xmlns="http://www.w3.org/2000/svg" class="diagram-svg">
    <text x="280" y="18" text-anchor="middle" font-size="10" font-weight="700" fill="#111">FLUJO ALTA CUENTA CORRIENTE</text>
    <rect x="10" y="35" width="95" height="40" rx="5" fill="#eff6ff" stroke="#2563eb"/><text x="57" y="58" text-anchor="middle" font-size="8" fill="#111">Mostrador</text><text x="57" y="70" text-anchor="middle" font-size="7" fill="#666">form + docs</text>
    <line x1="105" y1="55" x2="125" y2="55" stroke="#666"/><polygon points="120,50 130,55 120,60" fill="#666"/>
    <rect x="130" y="35" width="95" height="40" rx="5" fill="#fef3c7" stroke="#d97706"/><text x="177" y="58" text-anchor="middle" font-size="8" fill="#111">Pendiente</text>
    <line x1="225" y1="55" x2="245" y2="55" stroke="#666"/><polygon points="240,50 250,55 240,60" fill="#666"/>
    <rect x="250" y="35" width="95" height="40" rx="5" fill="#fff7ed" stroke="#eb671b"/><text x="297" y="58" text-anchor="middle" font-size="8" fill="#111">Admin revisa</text>
    <line x1="345" y1="55" x2="365" y2="55" stroke="#666"/><polygon points="360,50 370,55 360,60" fill="#666"/>
    <rect x="375" y="35" width="85" height="40" rx="5" fill="#dcfce7" stroke="#16a34a"/><text x="417" y="58" text-anchor="middle" font-size="8" fill="#111">Aprobada</text>
    <line x1="460" y1="55" x2="475" y2="55" stroke="#666"/><polygon points="470,50 480,55 470,60" fill="#666"/>
    <rect x="485" y="35" width="65" height="40" rx="5" fill="#f0fdf4" stroke="#16a34a"/><text x="517" y="58" text-anchor="middle" font-size="8" fill="#111">Scoring</text>
    <rect x="130" y="100" width="120" height="36" rx="4" fill="#fef2f2" stroke="#dc2626"/><text x="190" y="122" text-anchor="middle" font-size="8" fill="#111">Rechazada + motivo</text>
    <line x1="177" y1="75" x2="190" y2="100" stroke="#dc2626" stroke-dasharray="4"/>
    <rect x="280" y="100" width="200" height="50" rx="5" fill="#f8fafc" stroke="#94a3b8"/><text x="380" y="120" text-anchor="middle" font-size="8" fill="#111">Storage: AFIP · DNI · domicilio · pagaré</text><text x="380" y="136" text-anchor="middle" font-size="7" fill="#666">registrar_alta_cuenta_corriente</text>
    <rect x="10" y="155" width="540" height="35" rx="4" fill="#f1f5f9" stroke="#cbd5e1"/><text x="280" y="176" text-anchor="middle" font-size="8" fill="#334155">Persona física: pagaré PDF obligatorio · Empresa: estatuto + constancia AFIP</text>
  </svg>`,
  venta: `<svg viewBox="0 0 520 120" xmlns="http://www.w3.org/2000/svg" class="diagram-svg">
    <text x="260" y="16" text-anchor="middle" font-size="10" font-weight="700" fill="#111">VENTA EN CUENTA CORRIENTE</text>
    <rect x="10" y="35" width="90" height="45" rx="4" fill="#fff7ed" stroke="#eb671b"/><text x="55" y="55" text-anchor="middle" font-size="8" fill="#111">VentaRapida</text><text x="55" y="68" text-anchor="middle" font-size="7" fill="#666">toggle CC</text>
    <line x1="100" y1="57" x2="120" y2="57" stroke="#666"/><polygon points="115,52 125,57 115,62" fill="#666"/>
    <rect x="125" y="35" width="100" height="45" rx="4" fill="#dbeafe" stroke="#2563eb"/><text x="175" y="55" text-anchor="middle" font-size="7" fill="#111">¿Habilitado?</text><text x="175" y="68" text-anchor="middle" font-size="7" fill="#666">+ scoring</text>
    <line x1="225" y1="57" x2="245" y2="57" stroke="#666"/><polygon points="240,52 250,57 240,62" fill="#666"/>
    <rect x="250" y="35" width="85" height="45" rx="4" fill="#fef3c7" stroke="#d97706"/><text x="292" y="62" text-anchor="middle" font-size="8" fill="#111">Venta CC</text>
    <line x1="335" y1="57" x2="355" y2="57" stroke="#666"/><polygon points="350,52 360,57 350,62" fill="#666"/>
    <rect x="360" y="35" width="75" height="45" rx="4" fill="#fee2e2" stroke="#dc2626"/><text x="397" y="55" text-anchor="middle" font-size="7" fill="#111">Cargo</text><text x="397" y="68" text-anchor="middle" font-size="7" fill="#666">debe</text>
    <line x1="435" y1="57" x2="450" y2="57" stroke="#666"/><rect x="455" y="35" width="55" height="45" rx="4" fill="#f0fdf4" stroke="#16a34a"/><text x="482" y="62" text-anchor="middle" font-size="7" fill="#111">Saldo+</text>
    <text x="10" y="105" font-size="7" fill="#666">Alerta si nivel riesgo/crítico · estado_pago Pendiente · cc_upsert_movimiento_venta</text>
  </svg>`,
  libro: `<svg viewBox="0 0 520 140" xmlns="http://www.w3.org/2000/svg" class="diagram-svg">
    <text x="260" y="16" text-anchor="middle" font-size="10" font-weight="700" fill="#111">LIBRO cc_cuenta_movimientos</text>
    <rect x="20" y="35" width="480" height="22" rx="3" fill="#fff7ed" stroke="#eb671b"/><text x="30" y="50" font-size="8" fill="#111">Venta CC → DEBE (cargo) aumenta deuda del cliente</text>
    <rect x="20" y="62" width="480" height="22" rx="3" fill="#dcfce7" stroke="#16a34a"/><text x="30" y="77" font-size="8" fill="#111">Pago con comprobante → HABER disminuye deuda</text>
    <rect x="20" y="89" width="480" height="22" rx="3" fill="#fef3c7" stroke="#d97706"/><text x="30" y="104" font-size="8" fill="#111">Interés devengado → DEBE (mora proporcional por días)</text>
    <text x="260" y="130" text-anchor="middle" font-size="7" fill="#666">saldo_acumulado corrido en perfil · cc_actualizar_resumen_saldos → saldo_actual en ficha</text>
  </svg>`
}

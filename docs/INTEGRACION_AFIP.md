# Integración con AFIP - Facturación Electrónica

## Web Services Disponibles

Según la [documentación oficial de AFIP](https://www.afip.gob.ar/ws/documentacion/ws-factura-electronica.asp), existen varios webservices:

### Para nuestro sistema ERP:

**Recomendado: `wsmtxca` (R.G. N° 2.904)**
- ✅ Permite facturas A y B **con detalle de items**
- ✅ Soporta CAE y CAEA
- ✅ Ideal para sistemas ERP completos
- 📄 Manual: Versión 0.25.4

**Alternativa: `wsfev1` (R.G. N° 4.291)**
- ⚠️ Solo para facturas sin detalle de items
- ✅ Soporta comprobantes A, B, C y M
- ✅ Soporta CAE y CAEA (solo A y B)
- 📄 Manual: Versión 4.1

## Requisitos para Integración

### 1. Certificado Digital
- Obtener certificado digital (.p12 o .pfx) de AFIP
- Configurar en `configuracion_afip.certificado_afip`
- Guardar clave en `configuracion_afip.clave_certificado` (encriptada)

### 2. Autenticación WSAA
- Obtener Token y Sign mediante Web Service de Autenticación y Autorización (WSAA)
- Los tokens expiran cada 12 horas
- Implementar renovación automática de tokens

### 3. Punto de Venta
- Configurar punto de venta en `configuracion_afip.punto_venta`
- Cada punto de venta tiene su propia numeración

### 4. Ambiente
- **Testing**: Usar URLs de homologación
- **Producción**: Usar URLs de producción
- Cambiar `configuracion_afip.ambiente` cuando esté listo

## Flujo de Facturación Electrónica

```
1. Usuario crea factura en el sistema
   ↓
2. Sistema valida datos (cliente, items, totales)
   ↓
3. Sistema obtiene Token/Sign de WSAA (si expiró, renueva)
   ↓
4. Sistema envía comprobante a wsmtxca
   ↓
5. AFIP responde con:
   - CAE (Código de Autorización Electrónico)
   - Fecha de vencimiento del CAE
   - Número de comprobante autorizado
   ↓
6. Sistema actualiza factura con:
   - estado_afip = 'Autorizada'
   - cae = código recibido
   - numero_comprobante = número asignado
   - fecha_vencimiento_cae = fecha recibida
   ↓
7. Sistema genera PDF de la factura con código QR
   ↓
8. Sistema crea asiento contable automático (si está configurado)
```

## Estructura de Datos

### Facturas con Detalle de Items

La tabla `facturas_items` contiene el detalle que se enviará a AFIP:

```sql
- item_numero: Número de línea (1, 2, 3...)
- descripcion: Descripción del producto/servicio
- cantidad: Cantidad
- unidad_medida: Unidad (UN, MTS, KG, etc.)
- precio_unitario: Precio unitario sin IVA
- iva_porcentaje: Porcentaje de IVA (21%, 10.5%, etc.)
- iva_monto: Monto de IVA calculado
- subtotal: Subtotal sin IVA
- total: Total con IVA
```

### Campos AFIP en Factura

```sql
- tipo_comprobante: Tipo de factura (A, B, C, etc.)
- punto_venta: Punto de venta configurado
- numero_comprobante: Número asignado por AFIP
- cae: Código de Autorización Electrónico
- fecha_vencimiento_cae: Fecha de vencimiento del CAE
- estado_afip: Estado del comprobante en AFIP
```

## Implementación Técnica

### Backend (Node.js/TypeScript)

```typescript
// Servicio para comunicación con AFIP
class AFIPService {
  async obtenerToken(): Promise<TokenResponse>
  async autorizarComprobante(factura: FacturaVentaRecord): Promise<CAEResponse>
  async consultarComprobante(numero: string): Promise<ConsultaResponse>
}
```

### Endpoints Necesarios

1. **POST /api/erp/facturas/autorizar**
   - Autoriza una factura con AFIP
   - Retorna CAE y datos de autorización

2. **GET /api/erp/facturas/:id/pdf**
   - Genera PDF de factura con código QR
   - Incluye datos de AFIP

3. **POST /api/erp/afip/renovar-token**
   - Renueva token de WSAA
   - Se ejecuta automáticamente cuando expira

## Código QR

El código QR debe contener:
- CUIT del emisor
- Tipo de comprobante
- Punto de venta
- Número de comprobante
- Fecha de emisión
- Importe total
- CAE
- Fecha de vencimiento del CAE

Formato según normativa AFIP vigente.

## Validaciones

### Antes de Enviar a AFIP:

1. ✅ Cliente tiene CUIT/DNI válido
2. ✅ Items tienen descripción y precios válidos
3. ✅ Totales calculados correctamente
4. ✅ IVA calculado correctamente según condición del cliente
5. ✅ Punto de venta configurado
6. ✅ Certificado válido y no expirado
7. ✅ Token/Sign válidos (renovar si expiraron)

### Después de Autorización:

1. ✅ Guardar CAE en base de datos
2. ✅ Actualizar estado de factura
3. ✅ Generar PDF con código QR
4. ✅ Crear asiento contable (si aplica)
5. ✅ Crear cuenta por cobrar (si aplica)

## Errores Comunes

### Error: "Token expirado"
- **Solución**: Renovar token mediante WSAA

### Error: "Certificado inválido"
- **Solución**: Verificar que el certificado no haya expirado
- Renovar certificado en AFIP si es necesario

### Error: "Número de comprobante duplicado"
- **Solución**: Verificar numeración en `configuracion_afip`
- Incrementar `ultimo_numero_factura_X` correctamente

### Error: "Cliente no encontrado en AFIP"
- **Solución**: Verificar CUIT del cliente
- Consultar padrón de contribuyentes de AFIP

## Recursos

- [Documentación Oficial AFIP](https://www.afip.gob.ar/ws/documentacion/ws-factura-electronica.asp)
- [Manual wsmtxca V0.25.4](https://www.afip.gob.ar/fe/documentos/manual_desarrollador_wsmtxca_v0_25_4.pdf)
- [Web Service de Autenticación (WSAA)](https://www.afip.gob.ar/fe/documentos/manual_desarrollador_wsaa_v1_0_0.pdf)
- [Homologación Externa](https://www.afip.gob.ar/fe/homologacion/)

## Homologación Externa (Obligatorio)

Antes de pasar a producción, **es obligatorio** realizar la homologación externa según la [Resolución General N° 5.616/2024](https://www.afip.gob.ar/ws/documentacion/homologacion-externa.asp).

### Manuales de Homologación

- **wsmtxca** (R.G. N° 2.904): [Manual para el desarrollador V 0.25.2](https://www.afip.gob.ar/ws/documentacion/homologacion-externa.asp)
- **wsfev1** (R.G. N° 4.291): Manual para el desarrollador V. 4.1
- **wsseg** (R.G. N° 2.668): Manual para el desarrollador V.1.0
- **wsbfev1** (R.G. N° 5427/2023): Manual para el desarrollador V. 3.2

### Proceso de Homologación

1. **Desarrollo en Ambiente Testing**
   - Configurar `ambiente = 'Testing'` en `configuracion_afip`
   - Usar URLs de homologación
   - Probar todos los flujos de facturación

2. **Solicitud de Homologación**
   - Completar formulario en AFIP
   - Enviar documentación técnica
   - Esperar aprobación de AFIP

3. **Pruebas de Homologación**
   - Ejecutar casos de prueba según manual
   - Validar todos los tipos de comprobantes
   - Verificar manejo de errores

4. **Aprobación y Producción**
   - Una vez aprobado, cambiar a `ambiente = 'Producción'`
   - Actualizar URLs a producción
   - Iniciar facturación real

### Checklist de Homologación

- [ ] Sistema funciona correctamente en ambiente testing
- [ ] Todos los tipos de comprobantes implementados (A, B, C)
- [ ] Manejo correcto de errores de AFIP
- [ ] Validación de datos antes de enviar
- [ ] Generación correcta de PDFs con QR
- [ ] Numeración de comprobantes correcta
- [ ] Renovación automática de tokens
- [ ] Logs y auditoría implementados
- [ ] Documentación técnica completa

## Próximos Pasos

1. ✅ Estructura de base de datos creada
2. ⏳ Implementar servicio de comunicación con WSAA
3. ⏳ Implementar servicio de comunicación con wsmtxca
4. ⏳ Crear generador de PDFs con código QR
5. ⏳ Implementar renovación automática de tokens
6. ⏳ Crear interfaz de configuración AFIP
7. ⏳ **Testing en ambiente de homologación (OBLIGATORIO)**
8. ⏳ Solicitar homologación externa a AFIP
9. ⏳ Pasar pruebas de homologación
10. ⏳ Migrar a producción después de aprobación


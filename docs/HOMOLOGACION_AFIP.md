# Proceso de Homologación Externa AFIP

## Información General

Según la [Resolución General N° 5.616/2024](https://www.afip.gob.ar/ws/documentacion/homologacion-externa.asp), es **obligatorio** realizar la homologación externa antes de facturar en producción.

## Manuales de Homologación

### Para wsmtxca (Nuestro Web Service)

- **Manual**: Versión 0.25.2
- **R.G.**: N° 2.904
- **Enlace**: [Documentación de Homologación Externa](https://www.afip.gob.ar/ws/documentacion/homologacion-externa.asp)

### Otros Web Services

- **wsfev1** (R.G. N° 4.291): Manual V. 4.1
- **wsseg** (R.G. N° 2.668): Manual V.1.0
- **wsbfev1** (R.G. N° 5427/2023): Manual V. 3.2

## Estados del Sistema

El sistema tiene tres estados posibles:

1. **Testing**: Desarrollo y pruebas locales
2. **Homologación**: Proceso de homologación con AFIP
3. **Producción**: Solo después de aprobación

## Proceso Paso a Paso

### Fase 1: Preparación

1. **Completar desarrollo en Testing**
   - Implementar todos los tipos de comprobantes
   - Validar flujos completos
   - Probar manejo de errores

2. **Configurar ambiente de Homologación**
   ```sql
   UPDATE configuracion_afip
   SET ambiente = 'Homologación'
   WHERE activo = true;
   ```

3. **Obtener certificado de homologación**
   - Solicitar certificado específico para homologación
   - Configurar en el sistema

### Fase 2: Solicitud de Homologación

1. **Completar formulario en AFIP**
   - Acceder al sistema de AFIP
   - Completar datos de la empresa
   - Especificar Web Service a homologar (wsmtxca)

2. **Enviar documentación técnica**
   - Arquitectura del sistema
   - Flujos de facturación
   - Manejo de errores
   - Seguridad implementada

3. **Esperar asignación de expediente**
   - AFIP asignará un número de expediente
   - Guardar en `numero_expediente_homologacion`

### Fase 3: Pruebas de Homologación

1. **Ejecutar casos de prueba según manual**
   - Facturas tipo A
   - Facturas tipo B
   - Facturas tipo C
   - Notas de crédito
   - Notas de débito
   - Manejo de errores

2. **Validar resultados**
   - Verificar CAE recibido
   - Validar numeración
   - Comprobar PDFs generados
   - Verificar códigos QR

3. **Documentar resultados**
   - Guardar logs de todas las pruebas
   - Capturas de pantalla
   - Evidencias de funcionamiento

### Fase 4: Aprobación

1. **AFIP revisa pruebas**
   - Validación técnica
   - Verificación de cumplimiento normativo

2. **Aprobación recibida**
   ```sql
   UPDATE configuracion_afip
   SET 
     homologacion_aprobada = true,
     fecha_aprobacion_homologacion = CURRENT_DATE,
     ambiente = 'Producción'
   WHERE activo = true;
   ```

3. **Migrar a producción**
   - Actualizar URLs a producción
   - Configurar certificado de producción
   - Iniciar facturación real

## Checklist de Homologación

### Funcionalidades Requeridas

- [ ] Emisión de Factura A con items
- [ ] Emisión de Factura B con items
- [ ] Emisión de Factura C (si aplica)
- [ ] Emisión de Nota de Crédito A
- [ ] Emisión de Nota de Crédito B
- [ ] Emisión de Nota de Débito A
- [ ] Emisión de Nota de Débito B
- [ ] Manejo de errores de AFIP
- [ ] Validación de datos antes de enviar
- [ ] Generación de PDFs con código QR
- [ ] Numeración correcta de comprobantes
- [ ] Renovación automática de tokens WSAA
- [ ] Consulta de comprobantes autorizados
- [ ] Anulación de comprobantes (si aplica)

### Validaciones Técnicas

- [ ] Certificado digital válido
- [ ] Token WSAA se renueva automáticamente
- [ ] Totales calculados correctamente
- [ ] IVA aplicado según condición del cliente
- [ ] Items con descripciones válidas
- [ ] Unidades de medida correctas
- [ ] Códigos de barras (si aplica)
- [ ] Código QR con datos correctos

### Documentación

- [ ] Manual técnico del sistema
- [ ] Diagramas de flujo
- [ ] Casos de uso documentados
- [ ] Manejo de errores documentado
- [ ] Políticas de seguridad
- [ ] Procedimientos de backup

## Errores Comunes en Homologación

### Error: "Certificado inválido"
- **Causa**: Certificado no es el de homologación
- **Solución**: Usar certificado específico de homologación

### Error: "Token expirado"
- **Causa**: No se renueva automáticamente
- **Solución**: Implementar renovación automática

### Error: "Número de comprobante incorrecto"
- **Causa**: Numeración no secuencial
- **Solución**: Validar numeración antes de enviar

### Error: "Datos del cliente inválidos"
- **Causa**: CUIT/DNI no válido o no encontrado
- **Solución**: Validar contra padrón de AFIP

## Recursos

- [Página de Homologación Externa](https://www.afip.gob.ar/ws/documentacion/homologacion-externa.asp)
- [Manual wsmtxca V0.25.2](https://www.afip.gob.ar/ws/documentacion/homologacion-externa.asp)
- [Resolución General N° 5.616/2024](https://www.afip.gob.ar/fe/documentos/rg_5616_2024.pdf)
- [Sistema de Homologación AFIP](https://www.afip.gob.ar/fe/homologacion/)

## Notas Importantes

⚠️ **No se puede facturar en producción sin homologación aprobada**

⚠️ **El proceso de homologación puede tardar varias semanas**

⚠️ **Mantener documentación completa de todas las pruebas**

⚠️ **No cambiar configuración durante el proceso de homologación**


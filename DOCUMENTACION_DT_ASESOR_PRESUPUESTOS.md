# 📐 DOCUMENTACIÓN COMPLETA: DT (Asesor Técnico / Presupuestos)

## 🎯 RESUMEN EJECUTIVO

El sistema **DT (Asesor Técnico / Presupuestos)** es un módulo especializado para gestionar mediciones, evaluación de factibilidad y presupuestos de proyectos. Tiene funcionalidades únicas que no están disponibles en el Kanban general.

---

## 🔐 1. ROLES Y PERMISOS

### Roles Implementados:
- **`asesor-tecnico`**: Asesor técnico que sale a hacer medidas y explica factibilidad
- **`presupuestos`**: Usuario de presupuestos que genera cotizaciones
- **`administracion`**: Tiene acceso completo a DT (puede ver y gestionar todo)

### Permisos de Acceso:
- ✅ **Asesor Técnico**: Puede acceder a DT, crear fichas No OP, gestionar sus fichas
- ✅ **Presupuestos**: Puede acceder a DT, ver fichas relacionadas, gestionar presupuestos
- ✅ **Administración**: Acceso completo a DT (puede ver y gestionar todo)

### Archivos Relacionados:
- `src/hooks/useAuth.ts`: Define los roles y permisos
- `src/types/api.ts`: Tipos TypeScript para los roles
- `supabase/patches/2025-01-17_agregar_roles_asesor_tecnico_presupuestos.sql`: Migración de roles

---

## 📋 2. KANBAN DEDICADO

### Características:
- **Kanban separado** del Kanban general (no aparecen en el Kanban principal)
- **3 columnas específicas**:
  1. **Asesor Técnico** (cyan #06b6d4): Mediciones y evaluación de factibilidad
  2. **Presupuestos** (amber #f59e0b): Cotizaciones y presupuestos
  3. **Finalizado** (verde #10b981): Proyectos completados

### Archivos Relacionados:
- `src/pages/AsesorPresupuestosPage.tsx`: Página principal del Kanban DT
- `src/data/asesorPresupuestosColumns.ts`: Definición de columnas
- `src/components/Header.tsx`: Botón "📐 DT" para navegar
- `src/App.tsx`: Ruta `/asesor-presupuestos`

### Filtrado de Tareas:
- Solo muestra fichas con sector "Asesor Técnico" o "Presupuestos"
- Filtros por prioridad, búsqueda y estado
- No muestra fichas de otros sectores

---

## 🆔 3. FICHAS NO OP

### Concepto:
Las **Fichas No OP** son fichas especiales que **NO tienen número de OP real**. Se usan para proyectos en etapa de medición y presupuesto antes de convertirse en órdenes de trabajo formales.

### Generación Automática de ID:
- **Formato**: `FICHA-YY#####` (ejemplo: `FICHA-2500001`)
- **Año**: Últimos 2 dígitos del año actual
- **Número secuencial**: 5 dígitos con ceros a la izquierda
- **Función DB**: `generar_numero_ficha_no_op()`

### Archivos Relacionados:
- `supabase/patches/2025-01-17_generar_id_ficha_no_op.sql`: Función de generación
- `supabase/patches/2025-01-17_update_create_orden_fichas_no_op.sql`: Lógica en `create_orden_with_contact`

---

## 📝 4. CREACIÓN DE FICHAS NO OP

### Modal Simplificado (`FichaNoOPModal`):
- **Campos requeridos**:
  - Nombre del Cliente
  - Datos de Contacto
  - Especificaciones
- **Campos opcionales**:
  - Enlace a Google Drive
  - Enlace a Ubicación
  - Prioridad (Baja, Normal, Alta)
- **Funcionalidades especiales**:
  - ✅ Subida de PDF de Ficha Técnica
  - ✅ Checkbox "Marcar como Planilla Preliminar"

### Archivos Relacionados:
- `src/components/FichaNoOPModal.tsx`: Modal de creación
- `src/components/FichaNoOPModal.css`: Estilos del modal

---

## 📄 5. FICHA TÉCNICA (PDF)

### Funcionalidad:
- Permite subir un **PDF con información de medidas y especificaciones**
- Se almacena en Supabase Storage en la carpeta `fichas-tecnicas/`
- URL se guarda en `ficha_tecnica_pdf_url`

### En Modal de Edición:
- **Ver/Descargar PDF**: Si hay ficha técnica cargada, muestra botón para ver/descargar
- **Subir nueva**: Permite reemplazar la ficha técnica existente
- **Eliminar**: Permite eliminar la ficha técnica

### Archivos Relacionados:
- `src/components/TaskEditModal.tsx`: Sección de ficha técnica (líneas 1297-1409)
- `src/components/TaskEditModal.css`: Estilos para ficha técnica
- `src/utils/storage.ts`: Función `uploadAttachmentAndGetUrl`

---

## 🟡 6. PLANILLA PRELIMINAR

### Concepto:
La **Planilla Preliminar** es un estado especial que indica que la ficha está en etapa preliminar y lista para que el otro sector avance.

### Funcionalidad:
- **Checkbox en creación**: Al crear ficha No OP, se puede marcar como Planilla Preliminar
- **Cambio de color**: Las tarjetas marcadas como Planilla Preliminar tienen:
  - Borde izquierdo naranja/amarillo (#f59e0b)
  - Fondo con gradiente naranja/amarillo
- **Habilitación de checklists**: Cuando una ficha se marca como Planilla Preliminar, la ficha relacionada en el otro sector tiene los checklists habilitados

### Archivos Relacionados:
- `src/components/TaskCard.tsx`: Clase CSS `planilla-preliminar` (línea 153)
- `src/components/TaskCard.css`: Estilos para planilla preliminar (líneas 1-7)
- `src/components/TaskEditModal.tsx`: Sección de Planilla Preliminar (líneas 1410-1455)
- `supabase/patches/2025-01-17_habilitar_checklists_planilla_preliminar.sql`: Trigger que habilita checklists

---

## ✅ 7. CHECKLISTS

### Dos Checklists Implementados:

#### 1. **FICHA TECNICA CARGADA** (Asesor Técnico)
- Se marca cuando el asesor técnico carga la ficha técnica
- **Notificación**: Al marcarse, notifica a usuarios de Presupuestos
- **Cambio de color**: La tarjeta cambia a color cyan (#06b6d4)

#### 2. **PRESUPUESTO ENVIADO AL CLIENTE** (Presupuestos)
- Se marca cuando el presupuesto se envía al cliente
- **Notificación**: Al marcarse, notifica a usuarios de Asesor Técnico
- **Cambio de color**: La tarjeta cambia a color amber (#f59e0b)

### Reglas de Habilitación:
- Los checklists **solo se muestran** si:
  - La ficha actual está marcada como Planilla Preliminar, **O**
  - La ficha relacionada (en el otro sector) está marcada como Planilla Preliminar

### Archivos Relacionados:
- `src/components/TaskEditModal.tsx`: Sección de checklists (líneas 1456-1520)
- `src/components/TaskEditModal.css`: Estilos para checklists
- `src/components/TaskCard.tsx`: Clases CSS `ficha-tecnica-cargada` y `presupuesto-enviado` (líneas 154-155)
- `src/components/TaskCard.css`: Estilos para tarjetas con checklists marcados (líneas 9-47)
- `supabase/patches/2025-01-17_agregar_checklists_fichas_no_op.sql`: Campos en DB
- `supabase/patches/2025-01-17_crear_funcion_notificar_checklist_fichas_no_op.sql`: Función de notificación
- `src/services/api.ts`: Método `notificarChecklistFichaNoOP` (líneas 6524-6545)

---

## 🔔 8. SISTEMA DE NOTIFICACIONES

### Notificaciones entre Sectores:

#### Cuando se marca "FICHA TECNICA CARGADA":
- **Origen**: Asesor Técnico
- **Destino**: Presupuestos
- **Mensaje**: "La ficha técnica de [OP] ha sido cargada. Puedes proceder con el presupuesto."

#### Cuando se marca "PRESUPUESTO ENVIADO AL CLIENTE":
- **Origen**: Presupuestos
- **Destino**: Asesor Técnico
- **Mensaje**: "El presupuesto de [OP] ha sido enviado al cliente."

### Archivos Relacionados:
- `supabase/patches/2025-01-17_crear_funcion_notificar_checklist_fichas_no_op.sql`: Función de notificación
- `src/services/api.ts`: Método `notificarChecklistFichaNoOP`

---

## 🎨 9. CAMBIOS VISUALES (COLORES)

### Tarjetas con Estados Especiales:

1. **Planilla Preliminar**:
   - Borde izquierdo: #f59e0b (amber)
   - Fondo: Gradiente naranja/amarillo

2. **Ficha Técnica Cargada**:
   - Borde izquierdo: #06b6d4 (cyan)
   - Fondo: Gradiente cyan

3. **Presupuesto Enviado**:
   - Borde izquierdo: #f59e0b (amber)
   - Fondo: Gradiente amber

### Archivos Relacionados:
- `src/components/TaskCard.css`: Estilos para todos los estados

---

## 🗄️ 10. BASE DE DATOS

### Campos Nuevos en `ordenes_trabajo`:

```sql
es_ficha_no_op BOOLEAN DEFAULT false
planilla_preliminar BOOLEAN DEFAULT false
ficha_tecnica_pdf_url TEXT NULL
ficha_tecnica_cargada BOOLEAN DEFAULT false
presupuesto_enviado_cliente BOOLEAN DEFAULT false
```

### Funciones Nuevas:

1. **`generar_numero_ficha_no_op()`**: Genera ID automático para fichas No OP
2. **`notificar_checklist_ficha_no_op()`**: Envía notificaciones entre sectores
3. **`habilitar_checklists_planilla_preliminar()`**: Trigger que habilita checklists cuando se marca Planilla Preliminar

### Triggers:

1. **`trigger_habilitar_checklists_planilla_preliminar`**: Se ejecuta cuando se actualiza `planilla_preliminar`

### Archivos de Migración:
- `supabase/patches/2025-01-17_agregar_checklists_fichas_no_op.sql`
- `supabase/patches/2025-01-17_generar_id_ficha_no_op.sql`
- `supabase/patches/2025-01-17_crear_funcion_notificar_checklist_fichas_no_op.sql`
- `supabase/patches/2025-01-17_habilitar_checklists_planilla_preliminar.sql`
- `supabase/patches/2025-01-17_update_create_orden_fichas_no_op.sql`

---

## 🔄 11. FLUJO DE TRABAJO

### Flujo Completo:

1. **Asesor Técnico crea Ficha No OP**:
   - Completa datos básicos
   - Sube PDF de ficha técnica (opcional)
   - Marca como Planilla Preliminar (opcional)
   - Se genera ID automático (FICHA-YY#####)

2. **Si se marca Planilla Preliminar**:
   - La ficha relacionada en Presupuestos tiene checklists habilitados
   - Presupuestos puede avanzar con los checklists

3. **Asesor Técnico marca "FICHA TECNICA CARGADA"**:
   - Tarjeta cambia a color cyan
   - Presupuestos recibe notificación
   - Presupuestos puede proceder con el presupuesto

4. **Presupuestos marca "PRESUPUESTO ENVIADO AL CLIENTE"**:
   - Tarjeta cambia a color amber
   - Asesor Técnico recibe notificación
   - Proyecto avanza

5. **Finalización**:
   - Ficha se mueve a columna "Finalizado"
   - Estado: `finalizado-asesor-presupuestos`

---

## 📱 12. NAVEGACIÓN

### Botón en Header:
- **Texto**: "📐 DT"
- **Visible para**: Admin, Asesor Técnico, Presupuestos
- **Ruta**: `/asesor-presupuestos`

### Archivos Relacionados:
- `src/components/Header.tsx`: Botón de navegación (líneas con `canAccessAsesorPresupuestos`)

---

## ⚠️ 13. CONSIDERACIONES IMPORTANTES

### ⚠️ NO aparecen en Kanban General:
- Las fichas de Asesor Técnico y Presupuestos **NO** aparecen en el Kanban principal
- Solo son visibles en el Kanban DT

### ⚠️ Fichas Relacionadas:
- Si una ficha No OP tiene sectores `['Asesor Técnico', 'Presupuestos']`, se crean fichas duplicadas
- Cada sector tiene su propia ficha, pero comparten el mismo `numero_op`
- Los checklists se habilitan cuando la ficha relacionada tiene Planilla Preliminar

### ⚠️ Generación de ID:
- El ID se genera automáticamente solo si `numero_op` es `'FICHA-'` o `NULL`
- Si se proporciona un `numero_op` específico, se usa ese

---

## 📚 14. ARCHIVOS CLAVE

### Frontend:
- `src/pages/AsesorPresupuestosPage.tsx`: Página principal
- `src/components/FichaNoOPModal.tsx`: Modal de creación
- `src/components/TaskEditModal.tsx`: Modal de edición (con checklists y ficha técnica)
- `src/components/TaskCard.tsx`: Tarjeta con estilos especiales
- `src/data/asesorPresupuestosColumns.ts`: Columnas del Kanban
- `src/types/api.ts`: Tipos TypeScript
- `src/types/board.ts`: Tipos de tareas
- `src/utils/dataMappers.ts`: Mapeo de datos

### Backend (Supabase):
- `supabase/patches/2025-01-17_agregar_roles_asesor_tecnico_presupuestos.sql`
- `supabase/patches/2025-01-17_generar_id_ficha_no_op.sql`
- `supabase/patches/2025-01-17_update_create_orden_fichas_no_op.sql`
- `supabase/patches/2025-01-17_agregar_checklists_fichas_no_op.sql`
- `supabase/patches/2025-01-17_crear_funcion_notificar_checklist_fichas_no_op.sql`
- `supabase/patches/2025-01-17_habilitar_checklists_planilla_preliminar.sql`

---

## ✅ 15. CHECKLIST DE VERIFICACIÓN

### Funcionalidades Implementadas:
- ✅ Roles `asesor-tecnico` y `presupuestos`
- ✅ Kanban dedicado con 3 columnas
- ✅ Botón "DT" en Header
- ✅ Fichas No OP con ID automático
- ✅ Modal simplificado de creación
- ✅ Subida de PDF de ficha técnica
- ✅ Checkbox Planilla Preliminar
- ✅ Cambio de color por Planilla Preliminar
- ✅ Checklists (Ficha Técnica Cargada, Presupuesto Enviado)
- ✅ Cambio de color por checklists marcados
- ✅ Notificaciones entre sectores
- ✅ Habilitación de checklists cuando ficha relacionada tiene Planilla Preliminar
- ✅ Visualización y descarga de PDF en modal de edición
- ✅ Filtrado de tareas solo de DT en el Kanban dedicado

---

## 🎯 CONCLUSIÓN

El sistema **DT (Asesor Técnico / Presupuestos)** es un módulo completo y especializado que permite gestionar el flujo de trabajo desde la medición técnica hasta el envío del presupuesto al cliente, con notificaciones automáticas y cambios visuales que facilitan el seguimiento del estado de cada proyecto.


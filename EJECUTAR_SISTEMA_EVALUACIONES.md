# ⚠️ EJECUTAR ESTO EN LA BASE DE DATOS PRINCIPAL

**Base de datos:** https://bwdtrzcdzbzrtykjzber.supabase.co

## Pasos para configurar el sistema de evaluaciones de desempeño:

### 1. Crear tablas y funciones SQL

1. Ve a: https://bwdtrzcdzbzrtykjzber.supabase.co
2. Abre el **SQL Editor**
3. Copia y pega el contenido del archivo `supabase/patches/2025-01-20_create_sistema_evaluaciones.sql`
4. Haz clic en **RUN** o presiona `Ctrl+Enter`
5. Verifica que no haya errores

Este script crea:
- Tabla `evaluaciones` con todos los campos necesarios
- Tabla `evaluaciones_criterios` para los criterios de evaluación
- Funciones SQL:
  - `crear_evaluacion`: Crear nuevas evaluaciones
  - `obtener_evaluaciones`: Listar evaluaciones con filtros
  - `obtener_criterios_evaluacion`: Obtener criterios de una evaluación
  - `agregar_criterio_evaluacion`: Agregar criterios a una evaluación
  - `actualizar_criterio_evaluacion`: Actualizar un criterio
  - `actualizar_evaluacion`: Actualizar una evaluación
  - `aprobar_evaluacion`: Aprobar una evaluación
  - `eliminar_criterio_evaluacion`: Eliminar un criterio
  - `eliminar_evaluacion`: Eliminar una evaluación
- Políticas RLS para acceso seguro

## ✅ Funcionalidades Implementadas

### Para RRHH/Admin:
- **Página de gestión** (`/rrhh/evaluaciones`) con:
  - Filtros por usuario, estado, tipo, fechas
  - Lista de todas las evaluaciones
  - Crear/Editar evaluaciones
  - Agregar criterios de evaluación con calificaciones
  - Cálculo automático de calificación general
  - Aprobar evaluaciones
  - Eliminar evaluaciones y criterios

### Características:
- **Tipos de evaluación**: Anual, Semestral, Trimestral, Mensual, Período de Prueba, Especial
- **Criterios personalizados**: Cada evaluación puede tener múltiples criterios con:
  - Nombre del criterio
  - Descripción
  - Calificación (0-10)
  - Peso (para calcular promedio ponderado)
  - Comentarios
- **Calificación automática**: Se calcula automáticamente basada en los criterios
- **Estados**: Borrador, Completada, Revisada, Aprobada
- **Comentarios**: Del evaluador, objetivos cumplidos, áreas de mejora, recomendaciones

## 📋 Estructura de Evaluaciones

1. **Información básica**: Usuario evaluado, evaluador, tipo, período, fechas
2. **Criterios**: Múltiples criterios con calificaciones individuales
3. **Comentarios**: Evaluador, objetivos, áreas de mejora, recomendaciones
4. **Aprobación**: Sistema de aprobación por RRHH/Admin

## 🔔 Próximas Mejoras

- Notificaciones cuando se crea/aprueba una evaluación
- Exportar evaluaciones a PDF
- Gráficos de evolución de desempeño
- Plantillas de criterios predefinidas
- Autoevaluación del empleado


# Lógica de Múltiples Sectores - Opciones de Implementación

## Contexto Actual

- **10 Columnas del Kanban** = Sectores válidos:
  1. Diseño Gráfico
  2. Diseño en Proceso
  3. En Espera
  4. Imprenta (Área de Impresión)
  5. Taller de Imprenta
  6. Taller Gráfico
  7. Instalaciones
  8. Metalúrgica
  9. Finalizado en Taller
  10. Almacén de Entrega

- **Campos en la BD:**
  - `sectores[]`: Array con TODOS los sectores requeridos
  - `sector_inicial`: Sector donde aparece la ficha principal
  - **IMPORTANTE**: `sector_inicial` NO necesita estar en `sectores[]`

---

## Pregunta 2: ¿Cómo manejar cuando `sector_inicial` NO está en `sectores[]`?

### Opción A: Duplicar Ficha Principal (Momentánea)

**Lógica:**
- La ficha principal aparece en `sector_inicial`
- Se crea una **copia/duplicado** de la ficha principal en cada sector de `sectores[]`
- Todas las fichas (original + duplicados) comparten el mismo `id_orden`
- Cuando todas las tareas están completadas, se unifican automáticamente
- La ficha unificada aparece en "Almacén de Entrega" o "Finalizado en Taller"

**Ventajas:**
- Simple de implementar
- Cada sector ve su propia ficha
- Fácil de rastrear progreso por sector

**Desventajas:**
- Múltiples fichas visibles (puede ser confuso)
- Necesita lógica de sincronización entre duplicados
- Más complejo al actualizar (¿qué ficha se actualiza?)

**Implementación:**
```sql
-- Crear una "ficha duplicada" en cada sector requerido
-- Todas apuntan al mismo id_orden
-- Se marcan como "duplicadas" con un flag
```

---

### Opción B: Asignar por Usuario/Sector (Flujo Dinámico)

**Lógica:**
- La ficha principal aparece en `sector_inicial`
- Se crean sub-tareas para cada sector en `sectores[]`
- Cada sub-tarea se asigna a un usuario del sector correspondiente
- La ficha aparece en el flujo según el usuario que la está trabajando
- Si un usuario de "Taller de Imprenta" toma la ficha, aparece en esa columna

**Ventajas:**
- Más organizado (una ficha por sector)
- Asignación clara de responsabilidades
- Flujo natural según quién trabaja

**Desventajas:**
- Requiere tabla `usuario_sectores` (ya existe)
- Lógica más compleja de asignación
- Necesita UI para asignar usuarios a sectores

**Implementación:**
```sql
-- Crear sub-tarea para cada sector
-- Asignar automáticamente a usuario del sector (si existe)
-- La ficha aparece donde el usuario asignado está trabajando
```

---

## Pregunta 4: Flujo cuando una ficha pasa de un sector a otro

### Opción 1: Movimiento Independiente por Sector

**Lógica:**
- Cada sector tiene su propia ficha/sub-tarea
- Cada una se mueve independientemente en su columna
- No hay sincronización automática
- La ficha principal puede estar en "Diseño Gráfico" mientras una sub-tarea está en "Taller de Imprenta"

**Ejemplo:**
- Ficha principal: `sector_inicial = "Diseño Gráfico"` → Columna "Diseño Gráfico"
- Sub-tarea 1: `sector = "Taller de Imprenta"` → Columna "Taller de Imprenta"
- Sub-tarea 2: `sector = "Instalaciones"` → Columna "Instalaciones"

Cada una se mueve independientemente.

---

### Opción 2: Movimiento Sincronizado (Cascada)

**Lógica:**
- Cuando la ficha principal avanza, las sub-tareas avanzan automáticamente
- O cuando todas las sub-tareas completan, la ficha principal avanza
- Hay reglas de sincronización

**Ejemplo:**
- Ficha principal en "Diseño Gráfico" → "Diseño en Proceso"
- Sub-tareas se mueven automáticamente a "En Proceso" en sus respectivas columnas

---

### Opción 3: Movimiento con Dependencias

**Lógica:**
- Las sub-tareas tienen un orden/prioridad
- La sub-tarea 2 no puede avanzar hasta que la sub-tarea 1 esté completa
- O la ficha principal no puede avanzar hasta que todas las sub-tareas estén completas

**Ejemplo:**
- Sub-tarea "Diseño" debe completarse antes de que "Imprenta" pueda empezar
- Ficha principal solo avanza cuando todas las sub-tareas están en "Finalizado"

---

### Opción 4: Movimiento Manual con Indicadores

**Lógica:**
- Cada ficha/sub-tarea se mueve manualmente
- Se muestran indicadores visuales del estado de las otras fichas relacionadas
- El usuario decide cuándo mover basándose en el estado general

**Ejemplo:**
- Ficha principal muestra: "2/3 sectores completados"
- Sub-tarea muestra: "Ficha principal en Diseño en Proceso"
- Usuario decide mover cuando tiene contexto completo

---

## Recomendación

Basándome en tu descripción, recomiendo:

**Para Pregunta 2: Opción A (Duplicar Momentánea)**
- Más simple de implementar
- Cada sector ve su ficha
- Se unifica al final automáticamente

**Para Pregunta 4: Opción 1 (Movimiento Independiente)**
- Más flexible
- Cada sector trabaja a su ritmo
- Sin complejidad de sincronización

---

## ¿Qué opción prefieres?

1. **Pregunta 2**: ¿Opción A (Duplicar) o Opción B (Asignar por Usuario)?
2. **Pregunta 4**: ¿Opción 1, 2, 3 o 4? (o una combinación)

Una vez que elijas, implemento la lógica completa.


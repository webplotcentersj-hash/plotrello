# Ejecutar Fix: convertir_pedido_a_op

Este patch corrige los siguientes problemas en la función `convertir_pedido_a_op`:

## Problemas corregidos:

1. **Ambiguidad en `numero_op`**: La función tenía una referencia ambigua a `numero_op` en la línea 513. Ahora usa `ot.numero_op` con alias explícito.

2. **Tabla `clientes_web` obsoleta**: La función buscaba clientes en `clientes_web`, pero después de la unificación de tablas debe usar `clientes`.

3. **Mejoras en la lógica**: Se agregaron validaciones adicionales y mejor manejo de errores.

## Pasos para ejecutar:

1. Abre el SQL Editor en Supabase Dashboard
2. Copia y pega el contenido completo del archivo:
   ```
   supabase/patches/2025-01-17_fix_convertir_pedido_a_op.sql
   ```
3. Ejecuta el script
4. Verifica que no haya errores

## Verificación:

Después de ejecutar el patch, prueba convertir un pedido a OP desde la página de administración:
- Ve a `/clientes-web/pedidos`
- Haz click en "Convertir a OP" en un pedido pendiente
- Completa el formulario y confirma la conversión
- Verifica que la OP se haya creado correctamente en el tablero Kanban

## Notas:

- Este patch es seguro de ejecutar en producción
- No afecta datos existentes, solo corrige la función SQL
- La función ahora usa la tabla `clientes` unificada correctamente


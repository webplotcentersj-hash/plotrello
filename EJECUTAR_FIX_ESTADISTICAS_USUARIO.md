# Ejecutar Fix: obtener_estadisticas_usuario

## Problema
La función `obtener_estadisticas_usuario` arrojaba el error "structure of query does not match function result type" cuando no había órdenes para el usuario, porque no retornaba ninguna fila.

## Solución
Se modificó la función para que siempre retorne exactamente una fila, incluso cuando no hay órdenes para el usuario, usando variables DECLARE y RETURN QUERY.

## Pasos para ejecutar

1. Abre el SQL Editor en Supabase Dashboard
2. Copia y pega el contenido del archivo:
   ```
   supabase/patches/2025-01-20_fix_obtener_estadisticas_usuario.sql
   ```
3. Ejecuta el script
4. Verifica que la función se haya creado correctamente

## Verificación
Después de ejecutar el parche, prueba generar un reporte por usuario en la página de reportes de RRHH (`/rrhh/reportes`). Debería funcionar correctamente incluso para usuarios sin órdenes.



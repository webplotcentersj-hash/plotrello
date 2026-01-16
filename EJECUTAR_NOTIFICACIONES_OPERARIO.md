# 🔔 Ejecutar Script de Notificaciones para Operarios

## Objetivo
Asegurar que cuando se asigne una OP a un operario, le llegue una notificación automáticamente.

## Pasos para Ejecutar

1. **Abre Supabase Dashboard**
   - Ve a tu proyecto en Supabase
   - Abre el **SQL Editor** (menú lateral izquierdo)

2. **Copia y pega el script completo**
   - Abre el archivo: `supabase/patches/2025-01-22_verificar_notificaciones_operario.sql`
   - Copia TODO el contenido

3. **Ejecuta el script**
   - Pega el contenido en el SQL Editor
   - Haz clic en **"Run"** o presiona **F5**
   - Espera a que termine la ejecución

4. **Verifica los mensajes**
   - Deberías ver mensajes como:
     - ✅ Función get_user_id_from_nombre existe
     - ✅ Trigger trigger_notify_operario_assignment creado/actualizado
     - ✅ Trigger trigger_notify_operario_assignment está activo
     - 📋 Usuarios disponibles en la tabla usuarios: (lista de usuarios)

## Verificación

Después de ejecutar, puedes verificar que el trigger está activo ejecutando:

```sql
SELECT 
  trigger_name, 
  event_manipulation, 
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_name = 'trigger_notify_operario_assignment';
```

**Debes ver el trigger listado.** Si lo ves, el sistema está configurado correctamente.

## Prueba

Para probar que funciona:

1. Edita una OP en el sistema
2. Asigna un operario a esa OP
3. El operario debería recibir una notificación automáticamente
4. La notificación aparecerá en el icono de campana (🔔) en el header

## Notas Importantes

- El script es seguro de ejecutar múltiples veces (usa `CREATE OR REPLACE`)
- Si ves errores, cópialos y compártelos para diagnóstico
- El trigger solo se dispara cuando el operario **cambia** (no si ya estaba asignado)
- El nombre del operario debe coincidir exactamente con el nombre en la tabla `usuarios`


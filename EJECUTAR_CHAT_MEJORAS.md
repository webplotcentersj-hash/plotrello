# Ejecutar Mejoras del Chat Interno

## 📋 Resumen de Cambios

Este patch implementa las siguientes mejoras en el sistema de chat interno:

1. **Canales actualizados**: Recursos Humanos, Metalurgica, Mostrador, TG (Taller Gráfico)
2. **Contador de mensajes**: Muestra el número de mensajes por canal
3. **Vista previa de archivos**: Los archivos se muestran antes de enviar (con preview para imágenes)
4. **Archivos en mensajes**: Los archivos enviados se muestran en los mensajes con enlaces o previews
5. **Usuarios en línea reales**: Muestra solo los usuarios que están realmente conectados
6. **Botones del header funcionales**: Información del canal, notificaciones y más opciones
7. **Mejoras visuales**: Mejor organización y presentación de elementos

## 🔧 Pasos para Ejecutar

### 1. Ejecutar el Patch SQL

Ve a Supabase Dashboard → SQL Editor y ejecuta el contenido del archivo:
```
supabase/patches/2025-01-17_chat_mejoras.sql
```

Este patch crea:
- Función `marcar_usuario_online`: Marca usuarios como en línea
- Función `obtener_usuarios_online`: Obtiene usuarios en línea (últimos 5 minutos)
- Función `contar_mensajes_canal`: Cuenta mensajes por canal
- Columna `archivos_urls` en `chat_messages` para almacenar URLs de archivos

### 2. Verificar que los Rooms Existan

Asegúrate de que existan los siguientes rooms en la tabla `chat_rooms`:

```sql
INSERT INTO public.chat_rooms (id, nombre, tipo) VALUES
  (1, 'Recursos Humanos', 'publico'),
  (2, 'Metalurgica', 'publico'),
  (3, 'Mostrador', 'publico'),
  (4, 'Taller Gráfico', 'publico')
ON CONFLICT (id) DO NOTHING;
```

### 3. Verificar Permisos RLS

Asegúrate de que las políticas RLS permitan:
- Lectura de `chat_messages` para usuarios autenticados
- Escritura de `chat_messages` para usuarios autenticados
- Lectura de `online_users` para usuarios autenticados
- Escritura de `online_users` para usuarios autenticados

### 4. Verificar Storage

Asegúrate de que el bucket `archivos` en Supabase Storage:
- Exista y sea público o tenga políticas RLS apropiadas
- Permita subir archivos desde la carpeta `chat/`

## ✅ Verificación

Después de ejecutar el patch:

1. **Canales**: Deberías ver 4 canales: Recursos Humanos, Metalurgica, Mostrador, TG
2. **Contadores**: Cada canal debería mostrar el número de mensajes
3. **Usuarios en línea**: Deberías ver solo usuarios realmente conectados
4. **Archivos**: Al seleccionar archivos, deberías ver previews antes de enviar
5. **Botones del header**: Deberían mostrar popups al hacer clic

## 🐛 Solución de Problemas

### Los usuarios no aparecen como en línea
- Verifica que la función `marcar_usuario_online` se esté ejecutando correctamente
- Revisa los logs de la consola del navegador

### Los archivos no se suben
- Verifica que el bucket `archivos` exista en Supabase Storage
- Verifica los permisos RLS del bucket
- Revisa los logs de la consola del navegador

### Los contadores no se actualizan
- Verifica que la función `contar_mensajes_canal` exista
- Verifica que los `room_id` coincidan con los canales


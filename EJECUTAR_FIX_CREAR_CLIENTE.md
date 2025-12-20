# Fix: Error al crear cliente web

## Problema
Al intentar crear un nuevo cliente web, aparece el siguiente error:

```
Could not choose the best candidate function between:
public.crear_cliente(p_usuario => character varying, p_password => character varying, ...)
public.crear_cliente(p_usuario => character varying, p_password => text, ...)
```

Este error ocurre porque hay dos funciones `crear_cliente` con diferentes tipos para el parámetro `p_password` (una con `varchar` y otra con `text`), lo que causa ambigüedad en PostgreSQL.

## Solución
Se ha creado un script SQL que:
1. Elimina todas las variantes de la función `crear_cliente`
2. Crea una sola versión correcta con `p_password text`

## Cómo ejecutar el fix

### Opción 1: Usando Supabase Dashboard
1. Ve a tu proyecto en [Supabase Dashboard](https://app.supabase.com)
2. Navega a **SQL Editor**
3. Abre el archivo `supabase/patches/2025-01-17_fix_crear_cliente_ambiguity.sql`
4. Copia y pega todo el contenido
5. Haz clic en **Run** o presiona `Ctrl+Enter`

### Opción 2: Usando Supabase CLI
```bash
supabase db execute -f supabase/patches/2025-01-17_fix_crear_cliente_ambiguity.sql
```

### Opción 3: Ejecutar directamente en la base de datos
Si tienes acceso directo a PostgreSQL, ejecuta:
```bash
psql -h [tu-host] -U [tu-usuario] -d [tu-database] -f supabase/patches/2025-01-17_fix_crear_cliente_ambiguity.sql
```

## Verificación
Después de ejecutar el script, intenta crear un nuevo cliente web nuevamente. El error debería estar resuelto.

## Notas
- Este script es seguro de ejecutar y no afecta los datos existentes
- Solo elimina funciones duplicadas y crea una versión unificada
- La función creada usa `p_password text` que es el tipo correcto


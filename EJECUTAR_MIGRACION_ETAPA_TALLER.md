# ⚠️ EJECUTAR ESTO EN LA BASE DE DATOS PRINCIPAL

**Base de datos:** https://bwdtrzcdzbzrtykjzber.supabase.co

## Pasos:

1. Ve a: https://bwdtrzcdzbzrtykjzber.supabase.co
2. Abre el **SQL Editor**
3. Copia y pega este código:

```sql
-- Agregar campo etapa_taller_grafico para gestionar los pasos dentro de Taller Gráfico

BEGIN;

ALTER TABLE public.ordenes_trabajo
ADD COLUMN IF NOT EXISTS etapa_taller_grafico varchar(100);

-- Crear índice para búsquedas por etapa
CREATE INDEX IF NOT EXISTS idx_ordenes_trabajo_etapa_taller_grafico 
ON public.ordenes_trabajo(etapa_taller_grafico);

-- Comentario para documentación
COMMENT ON COLUMN public.ordenes_trabajo.etapa_taller_grafico IS 'Etapa actual dentro de Taller Gráfico: Falta Material para Impresión o archivo, En Proceso, Para Cortar o Pegar, Para Rotular, Instalaciones/Ploteo, Metalurgica Instalacion, laminas';

COMMIT;
```

4. Haz clic en **Run** (o presiona `Ctrl+Enter`)
5. Verifica que aparezca el mensaje de éxito ✅

## Lo que hace el script:

1. ✅ Agrega la columna `etapa_taller_grafico` a la tabla `ordenes_trabajo`
2. ✅ Crea un índice para búsquedas rápidas por etapa
3. ✅ Agrega documentación sobre las etapas disponibles

## Verificación después de ejecutar:

```sql
-- Verificar que la columna existe
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'ordenes_trabajo' 
  AND column_name = 'etapa_taller_grafico';

-- Verificar el índice
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'ordenes_trabajo' 
  AND indexname = 'idx_ordenes_trabajo_etapa_taller_grafico';
```

## Etapas disponibles:

- Falta Material para Impresión o archivo
- En Proceso
- Para Cortar o Pegar
- Para Rotular
- Instalaciones/Ploteo
- Metalurgica Instalacion
- laminas


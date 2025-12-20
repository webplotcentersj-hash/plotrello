-- Fix: Resolver ambigüedad en función agregar_imagen_articulo_empresa
-- Problema: La línea "WHERE aei.id = id" es ambigua porque "id" puede referirse a la columna o a la variable
-- Solución: Usar variables explícitas en lugar de referencias ambiguas

DROP FUNCTION IF EXISTS public.agregar_imagen_articulo_empresa(integer, text, integer);

CREATE OR REPLACE FUNCTION public.agregar_imagen_articulo_empresa(
  p_id_articulo integer,
  p_imagen_url text,
  p_orden integer DEFAULT NULL
)
RETURNS TABLE (
  id integer,
  id_articulo integer,
  imagen_url text,
  orden integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  nuevo_orden integer;
  nuevo_id integer;
  nuevo_id_articulo integer;
  nuevo_imagen_url text;
  nuevo_orden_val integer;
BEGIN
  -- Si no se proporciona orden, usar el máximo + 1
  IF p_orden IS NULL THEN
    SELECT COALESCE(MAX(orden), 0) + 1
    INTO nuevo_orden
    FROM public.articulos_empresa_imagenes
    WHERE id_articulo = p_id_articulo;
  ELSE
    nuevo_orden := p_orden;
  END IF;

  -- Insertar imagen
  INSERT INTO public.articulos_empresa_imagenes (id_articulo, imagen_url, orden)
  VALUES (p_id_articulo, p_imagen_url, nuevo_orden)
  RETURNING 
    articulos_empresa_imagenes.id,
    articulos_empresa_imagenes.id_articulo,
    articulos_empresa_imagenes.imagen_url,
    articulos_empresa_imagenes.orden
  INTO 
    nuevo_id,
    nuevo_id_articulo,
    nuevo_imagen_url,
    nuevo_orden_val;

  -- Retornar resultado usando variables en lugar de columna ambigua
  RETURN QUERY
  SELECT 
    nuevo_id,
    nuevo_id_articulo,
    nuevo_imagen_url,
    nuevo_orden_val;
END;
$$;


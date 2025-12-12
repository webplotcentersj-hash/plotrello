BEGIN;

-- Corregir función extraer_dimensiones_cm para manejar correctamente el tipo de array
CREATE OR REPLACE FUNCTION public.extraer_dimensiones_cm(descripcion text)
RETURNS TABLE(ancho_cm numeric, alto_cm numeric) AS $$
DECLARE
  dimension_match text[];
  ancho_str text;
  alto_str text;
  ancho_num numeric;
  alto_num numeric;
BEGIN
  -- Buscar patrones como "290CM X 215CM", "100CM X 100CM", "30CM X 42CM"
  -- También puede ser "290 CM X 215 CM" o "290cm x 215cm"
  dimension_match := regexp_match(
    descripcion,
    '(\d+(?:\.\d+)?)\s*CM\s*[Xx]\s*(\d+(?:\.\d+)?)\s*CM',
    'i'
  );
  
  IF dimension_match IS NOT NULL AND array_length(dimension_match, 1) >= 3 THEN
    ancho_str := dimension_match[1];
    alto_str := dimension_match[2];
    
    BEGIN
      ancho_num := ancho_str::numeric;
      alto_num := alto_str::numeric;
      
      RETURN QUERY SELECT ancho_num, alto_num;
    EXCEPTION WHEN OTHERS THEN
      RETURN;
    END;
  ELSE
    RETURN;
  END IF;
END;
$$ LANGUAGE plpgsql;

COMMIT;


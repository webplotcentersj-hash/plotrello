-- Agregar campo color a etiquetas_disponibles
-- Asignar colores aleatorios a etiquetas existentes
-- Actualizar funciones para asignar colores automáticamente

-- Función helper para generar un color aleatorio
CREATE OR REPLACE FUNCTION public.generar_color_aleatorio()
RETURNS varchar(7)
LANGUAGE plpgsql
AS $$
DECLARE
  colores_disponibles varchar(7)[] := ARRAY[
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
    '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B739', '#52BE80',
    '#EC7063', '#5DADE2', '#58D68D', '#F4D03F', '#AF7AC5',
    '#85C1E9', '#F1948A', '#73C6B6', '#F9E79F', '#A569BD',
    '#5DADE2', '#58D68D', '#F4D03F', '#AF7AC5', '#85C1E9',
    '#E74C3C', '#3498DB', '#2ECC71', '#F39C12', '#9B59B6',
    '#1ABC9C', '#34495E', '#E67E22', '#95A5A6', '#16A085'
  ];
  color_seleccionado varchar(7);
BEGIN
  -- Seleccionar un color aleatorio del array
  color_seleccionado := colores_disponibles[1 + floor(random() * array_length(colores_disponibles, 1))::int];
  RETURN color_seleccionado;
END;
$$;

-- Agregar columna color a etiquetas_disponibles
ALTER TABLE public.etiquetas_disponibles
ADD COLUMN IF NOT EXISTS color varchar(7);

-- Asignar colores aleatorios a etiquetas existentes que no tienen color
DO $$
DECLARE
  etiqueta_record RECORD;
  color_asignado varchar(7);
  colores_usados varchar(7)[] := ARRAY[]::varchar(7)[];
  colores_disponibles varchar(7)[] := ARRAY[
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
    '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B739', '#52BE80',
    '#EC7063', '#5DADE2', '#58D68D', '#F4D03F', '#AF7AC5',
    '#85C1E9', '#F1948A', '#73C6B6', '#F9E79F', '#A569BD',
    '#5DADE2', '#58D68D', '#F4D03F', '#AF7AC5', '#85C1E9',
    '#E74C3C', '#3498DB', '#2ECC71', '#F39C12', '#9B59B6',
    '#1ABC9C', '#34495E', '#E67E22', '#95A5A6', '#16A085'
  ];
  indice_color integer := 1;
BEGIN
  -- Asignar colores a etiquetas existentes sin color
  FOR etiqueta_record IN 
    SELECT id, nombre
    FROM public.etiquetas_disponibles
    WHERE color IS NULL OR color = ''
    ORDER BY id
  LOOP
    -- Usar colores de forma cíclica para asegurar distribución uniforme
    color_asignado := colores_disponibles[1 + ((indice_color - 1) % array_length(colores_disponibles, 1))];
    indice_color := indice_color + 1;
    
    UPDATE public.etiquetas_disponibles
    SET color = color_asignado
    WHERE id = etiqueta_record.id;
  END LOOP;
END;
$$;

-- Actualizar función agregar_etiqueta_disponible para asignar color automáticamente
CREATE OR REPLACE FUNCTION public.agregar_etiqueta_disponible(p_nombre text)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  color_asignado varchar(7);
BEGIN
  -- Generar color aleatorio para nueva etiqueta
  color_asignado := public.generar_color_aleatorio();
  
  INSERT INTO public.etiquetas_disponibles (nombre, veces_usada, ultima_uso, color)
  VALUES (LOWER(TRIM(p_nombre)), 1, NOW(), color_asignado)
  ON CONFLICT (nombre) 
  DO UPDATE SET 
    veces_usada = etiquetas_disponibles.veces_usada + 1,
    ultima_uso = NOW();
    -- No actualizar el color si ya existe (mantener el color original)
END;
$$;

-- Actualizar función obtener_etiquetas_disponibles para incluir color
DROP FUNCTION IF EXISTS public.obtener_etiquetas_disponibles();

CREATE FUNCTION public.obtener_etiquetas_disponibles()
RETURNS TABLE (
  nombre text,
  veces_usada integer,
  color varchar(7)
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.nombre::text,
    e.veces_usada,
    COALESCE(e.color, public.generar_color_aleatorio())::varchar(7) as color
  FROM public.etiquetas_disponibles e
  ORDER BY e.veces_usada DESC, e.ultima_uso DESC
  LIMIT 100;
END;
$$;

-- Función para obtener el color de una etiqueta específica
CREATE OR REPLACE FUNCTION public.obtener_color_etiqueta(p_nombre text)
RETURNS varchar(7)
LANGUAGE plpgsql
AS $$
DECLARE
  color_etiqueta varchar(7);
BEGIN
  SELECT color INTO color_etiqueta
  FROM public.etiquetas_disponibles
  WHERE nombre = LOWER(TRIM(p_nombre));
  
  -- Si no existe, generar un color aleatorio
  IF color_etiqueta IS NULL THEN
    color_etiqueta := public.generar_color_aleatorio();
  END IF;
  
  RETURN color_etiqueta;
END;
$$;


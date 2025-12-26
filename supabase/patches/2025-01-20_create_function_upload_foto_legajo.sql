-- Función RPC para subir fotos de legajos usando nuestro sistema de autenticación
-- Esta función permite subir fotos sin requerir Supabase Auth

CREATE OR REPLACE FUNCTION public.subir_foto_legajo(
  p_id_usuario integer,
  p_file_name text,
  p_file_data bytea
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_file_path text;
  v_url text;
BEGIN
  -- Verificar que el usuario existe
  IF NOT EXISTS (SELECT 1 FROM public.usuarios WHERE id = p_id_usuario) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Usuario no encontrado'
    );
  END IF;

  -- Construir la ruta del archivo
  v_file_path := 'empleados/' || p_id_usuario::text || '_' || extract(epoch from now())::text || '_' || p_file_name;

  -- Insertar el archivo en storage.objects directamente
  -- Nota: Esto requiere permisos especiales, por lo que usamos SECURITY DEFINER
  INSERT INTO storage.objects (
    bucket_id,
    name,
    owner,
    metadata,
    created_at,
    updated_at
  ) VALUES (
    'legajos',
    v_file_path,
    auth.uid(), -- Usar el usuario autenticado de Supabase Auth si existe
    jsonb_build_object(
      'size', length(p_file_data),
      'mimetype', 'image/jpeg',
      'cacheControl', '3600'
    ),
    now(),
    now()
  );

  -- Construir la URL pública
  v_url := 'https://' || current_setting('app.settings.supabase_url', true) || '/storage/v1/object/public/legajos/' || v_file_path;

  RETURN json_build_object(
    'success', true,
    'url', v_url,
    'path', v_file_path
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- Comentario
COMMENT ON FUNCTION public.subir_foto_legajo IS 'Función para subir fotos de legajos usando autenticación personalizada';


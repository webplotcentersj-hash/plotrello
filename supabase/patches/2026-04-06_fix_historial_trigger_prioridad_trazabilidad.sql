-- El trigger armaba comentario de prioridad pero nunca ponía hay_cambio_importante := true,
-- así que el INSERT a historial_movimientos no ocurría en cambios solo de prioridad.

BEGIN;

CREATE OR REPLACE FUNCTION public.registrar_historial_movimiento()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  usuario_actual_id integer;
  usuario_actual_nombre varchar(255);
  estado_anterior_val varchar(50);
  estado_nuevo_val varchar(50);
  operario_anterior_val varchar(255);
  operario_nuevo_val varchar(255);
  sector_anterior_val varchar(100);
  sector_nuevo_val varchar(100);
  comentario_historial text;
  hay_cambio_importante boolean := false;
BEGIN
  BEGIN
    usuario_actual_nombre := current_setting('app.current_user_name', true);
  EXCEPTION WHEN OTHERS THEN
    usuario_actual_nombre := NULL;
  END;

  IF usuario_actual_nombre IS NULL OR usuario_actual_nombre = '' THEN
    usuario_actual_nombre := COALESCE(
      NULLIF(trim(NEW.operario_asignado), ''),
      NULLIF(trim(NEW.usuario_trabajando_nombre), ''),
      NULLIF(trim(NEW.nombre_creador), ''),
      'Sistema'
    );
  END IF;

  IF usuario_actual_nombre IS NOT NULL AND usuario_actual_nombre != 'Sistema' THEN
    SELECT id INTO usuario_actual_id
    FROM public.usuarios
    WHERE nombre = usuario_actual_nombre
    LIMIT 1;
  END IF;

  IF usuario_actual_id IS NULL THEN
    SELECT id INTO usuario_actual_id
    FROM public.usuarios
    ORDER BY id
    LIMIT 1;

    IF usuario_actual_id IS NULL THEN
      RETURN NEW;
    END IF;
  END IF;

  estado_anterior_val := OLD.estado;
  estado_nuevo_val := NEW.estado;
  operario_anterior_val := COALESCE(OLD.operario_asignado, '');
  operario_nuevo_val := COALESCE(NEW.operario_asignado, '');
  sector_anterior_val := COALESCE(OLD.sector, '');
  sector_nuevo_val := COALESCE(NEW.sector, '');

  comentario_historial := '';

  IF OLD.estado IS DISTINCT FROM NEW.estado THEN
    hay_cambio_importante := true;
    IF comentario_historial != '' THEN
      comentario_historial := comentario_historial || ' | ';
    END IF;
    comentario_historial := comentario_historial || 'Estado: ' || COALESCE(OLD.estado, 'N/A') || ' → ' || COALESCE(NEW.estado, 'N/A');
  END IF;

  IF trim(COALESCE(OLD.operario_asignado, '')) IS DISTINCT FROM trim(COALESCE(NEW.operario_asignado, '')) THEN
    hay_cambio_importante := true;
    IF comentario_historial != '' THEN
      comentario_historial := comentario_historial || ' | ';
    END IF;
    IF NEW.operario_asignado IS NULL OR trim(NEW.operario_asignado) = '' THEN
      comentario_historial := comentario_historial || 'Operario desasignado';
    ELSIF OLD.operario_asignado IS NULL OR trim(OLD.operario_asignado) = '' THEN
      comentario_historial := comentario_historial || 'Operario asignado: ' || trim(NEW.operario_asignado);
    ELSE
      comentario_historial := comentario_historial || 'Operario: ' || trim(OLD.operario_asignado) || ' → ' || trim(NEW.operario_asignado);
    END IF;

    IF NEW.operario_asignado IS NOT NULL AND trim(NEW.operario_asignado) != '' THEN
      usuario_actual_nombre := trim(NEW.operario_asignado);
      SELECT id INTO usuario_actual_id
      FROM public.usuarios
      WHERE nombre = usuario_actual_nombre
      LIMIT 1;
      IF usuario_actual_id IS NULL THEN
        SELECT id INTO usuario_actual_id
        FROM public.usuarios
        ORDER BY id
        LIMIT 1;
        IF usuario_actual_id IS NULL THEN
          RETURN NEW;
        END IF;
      END IF;
    END IF;
  END IF;

  IF OLD.sector IS DISTINCT FROM NEW.sector THEN
    hay_cambio_importante := true;
    IF comentario_historial != '' THEN
      comentario_historial := comentario_historial || ' | ';
    END IF;
    comentario_historial := comentario_historial || 'Sector: ' || COALESCE(OLD.sector, 'N/A') || ' → ' || COALESCE(NEW.sector, 'N/A');
  END IF;

  IF OLD.prioridad IS DISTINCT FROM NEW.prioridad THEN
    hay_cambio_importante := true;
    IF comentario_historial != '' THEN
      comentario_historial := comentario_historial || ' | ';
    END IF;
    comentario_historial := comentario_historial || 'Prioridad: ' || COALESCE(OLD.prioridad, 'N/A') || ' → ' || COALESCE(NEW.prioridad, 'N/A');
  END IF;

  IF hay_cambio_importante THEN
    INSERT INTO public.historial_movimientos (
      id_orden,
      id_usuario,
      nombre_usuario,
      estado_anterior,
      estado_nuevo,
      timestamp,
      comentario
    ) VALUES (
      NEW.id,
      usuario_actual_id,
      usuario_actual_nombre,
      estado_anterior_val,
      estado_nuevo_val,
      now(),
      CASE
        WHEN comentario_historial != '' THEN comentario_historial
        ELSE 'Cambio registrado'
      END
    );
  END IF;

  RETURN NEW;
END;
$$;

COMMIT;

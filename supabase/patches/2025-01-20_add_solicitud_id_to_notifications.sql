-- Agregar campo solicitud_id a user_notifications para vincular notificaciones con solicitudes

BEGIN;

-- Agregar columna solicitud_id si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_notifications'
      AND column_name = 'solicitud_id'
  ) THEN
    ALTER TABLE public.user_notifications
    ADD COLUMN solicitud_id integer REFERENCES public.solicitudes_permisos(id) ON DELETE CASCADE;
    
    CREATE INDEX IF NOT EXISTS idx_user_notifications_solicitud_id 
    ON public.user_notifications(solicitud_id);
    
    RAISE NOTICE '✅ Columna solicitud_id agregada a user_notifications';
  ELSE
    RAISE NOTICE 'ℹ️ Columna solicitud_id ya existe en user_notifications';
  END IF;
END $$;

COMMIT;


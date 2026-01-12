-- Agregar campo capacitacion_id a user_notifications para vincular notificaciones con capacitaciones

BEGIN;

-- Agregar columna capacitacion_id si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_notifications'
      AND column_name = 'capacitacion_id'
  ) THEN
    ALTER TABLE public.user_notifications
    ADD COLUMN capacitacion_id integer REFERENCES public.capacitaciones(id) ON DELETE CASCADE;
    
    CREATE INDEX IF NOT EXISTS idx_user_notifications_capacitacion_id 
    ON public.user_notifications(capacitacion_id);
    
    RAISE NOTICE '✅ Columna capacitacion_id agregada a user_notifications';
  ELSE
    RAISE NOTICE 'ℹ️ Columna capacitacion_id ya existe en user_notifications';
  END IF;
END $$;

COMMIT;


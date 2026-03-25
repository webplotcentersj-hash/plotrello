-- Sistema de Gestión de Flota
-- Permite registrar salidas de vehículos y ver su estado en tiempo real

BEGIN;

-- ============================================
-- TABLA: vehiculos
-- ============================================
CREATE TABLE IF NOT EXISTS public.vehiculos (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL UNIQUE,
  patente VARCHAR(20),
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Insertar vehículos predefinidos
INSERT INTO public.vehiculos (nombre, patente, activo) VALUES
  ('Amarok', NULL, true),
  ('Berlingo', NULL, true),
  ('Camión MB', NULL, true),
  ('Lifán', NULL, true),
  ('Máster', NULL, true),
  ('Ránger', NULL, true),
  ('Camión LED', NULL, true)
ON CONFLICT (nombre) DO NOTHING;

-- ============================================
-- TABLA: registros_salidas_vehiculos
-- ============================================
CREATE TABLE IF NOT EXISTS public.registros_salidas_vehiculos (
  id SERIAL PRIMARY KEY,
  id_vehiculo INTEGER NOT NULL REFERENCES public.vehiculos(id) ON DELETE CASCADE,
  id_usuario INTEGER REFERENCES public.usuarios(id) ON DELETE SET NULL,
  nombre_usuario VARCHAR(255) NOT NULL,
  sector VARCHAR(100) NOT NULL,
  km_aproximado INTEGER,
  numero_op VARCHAR(255),
  motivo_salida TEXT NOT NULL,
  hora_salida TIMESTAMPTZ DEFAULT now(),
  hora_estimada_llegada TIMESTAMPTZ,
  hora_llegada_real TIMESTAMPTZ,
  litros_combustible_llegada NUMERIC(10, 2),
  ubicacion_destino TEXT,
  latitud NUMERIC(10, 8),
  longitud NUMERIC(11, 8),
  estado VARCHAR(50) DEFAULT 'en_uso' CHECK (estado IN ('pendiente_autorizacion', 'en_uso', 'retrasado', 'finalizado')),
  llave_entregada BOOLEAN DEFAULT false,
  id_usuario_caja_entrego_llave INTEGER REFERENCES public.usuarios(id) ON DELETE SET NULL,
  nombre_usuario_caja_entrego_llave VARCHAR(255),
  observaciones TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_registros_vehiculo ON public.registros_salidas_vehiculos(id_vehiculo);
CREATE INDEX IF NOT EXISTS idx_registros_estado ON public.registros_salidas_vehiculos(estado);
CREATE INDEX IF NOT EXISTS idx_registros_fecha_salida ON public.registros_salidas_vehiculos(hora_salida);
CREATE INDEX IF NOT EXISTS idx_registros_hora_estimada ON public.registros_salidas_vehiculos(hora_estimada_llegada);

-- ============================================
-- FUNCIÓN: Actualizar estado automáticamente
-- ============================================
CREATE OR REPLACE FUNCTION public.actualizar_estado_vehiculos_retrasados()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Marcar como retrasados los vehículos que pasaron la hora estimada
  UPDATE public.registros_salidas_vehiculos
  SET estado = 'retrasado',
      updated_at = now()
  WHERE estado = 'en_uso'
    AND hora_estimada_llegada IS NOT NULL
    AND hora_estimada_llegada < now()
    AND hora_llegada_real IS NULL;
END;
$$;

-- ============================================
-- TRIGGER: Actualizar estados al consultar
-- ============================================
-- Nota: Se puede llamar manualmente o desde el frontend periódicamente
-- También se puede configurar un cron job en Supabase para ejecutarlo cada minuto

-- ============================================
-- TRIGGER: Actualizar updated_at automáticamente
-- ============================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_vehiculos_updated_at ON public.vehiculos;
CREATE TRIGGER update_vehiculos_updated_at
  BEFORE UPDATE ON public.vehiculos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_registros_vehiculos_updated_at ON public.registros_salidas_vehiculos;
CREATE TRIGGER update_registros_vehiculos_updated_at
  BEFORE UPDATE ON public.registros_salidas_vehiculos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- RLS POLICIES
-- ============================================
ALTER TABLE public.vehiculos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registros_salidas_vehiculos ENABLE ROW LEVEL SECURITY;

-- Políticas para vehiculos: todos pueden leer, solo admin/caja pueden modificar
CREATE POLICY "Todos pueden ver vehículos"
  ON public.vehiculos FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Solo admin y caja pueden modificar vehículos"
  ON public.vehiculos FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.usuarios
      WHERE id = auth.uid()::text::integer
      AND rol IN ('administracion', 'caja', 'gerencia')
    )
  );

-- Políticas para registros: todos pueden leer y crear, solo admin/caja pueden modificar
CREATE POLICY "Todos pueden ver registros de salidas"
  ON public.registros_salidas_vehiculos FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Todos pueden crear registros de salidas"
  ON public.registros_salidas_vehiculos FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Todos pueden actualizar sus propios registros"
  ON public.registros_salidas_vehiculos FOR UPDATE
  TO authenticated
  USING (
    id_usuario = auth.uid()::text::integer
    OR EXISTS (
      SELECT 1 FROM public.usuarios
      WHERE id = auth.uid()::text::integer
      AND rol IN ('administracion', 'caja', 'gerencia')
    )
  );

COMMIT;


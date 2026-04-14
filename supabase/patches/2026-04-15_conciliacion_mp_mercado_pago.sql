-- Conciliación planilla bancaria vs Mercado Pago (sesiones + historial Gemini)
-- JSON en sesión evita miles de inserts desde el cliente; se puede normalizar después.

BEGIN;

CREATE TABLE IF NOT EXISTS public.conciliacion_mp_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_user_id integer REFERENCES public.usuarios(id) ON DELETE SET NULL,
  created_by_user_name text,

  bank_file_name text NOT NULL DEFAULT '',
  mp_file_name text NOT NULL DEFAULT '',
  bank_sheet_name text,
  mp_sheet_name text,

  rules_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  bank_movements jsonb NOT NULL DEFAULT '[]'::jsonb,
  mp_movements jsonb NOT NULL DEFAULT '[]'::jsonb,
  heuristic_matches jsonb NOT NULL DEFAULT '[]'::jsonb,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,

  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'ready', 'error'))
);

CREATE INDEX IF NOT EXISTS idx_conc_mp_sessions_created
  ON public.conciliacion_mp_sessions (created_at DESC);

CREATE TABLE IF NOT EXISTS public.conciliacion_mp_ai_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.conciliacion_mp_sessions(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by_user_id integer REFERENCES public.usuarios(id) ON DELETE SET NULL,
  scope text NOT NULL DEFAULT 'unmatched',
  input_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  output_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  provider text NOT NULL DEFAULT 'gemini'
);

CREATE INDEX IF NOT EXISTS idx_conc_mp_ai_session
  ON public.conciliacion_mp_ai_runs (session_id, created_at DESC);

COMMIT;

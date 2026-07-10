import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseServerKey, getSupabaseServerUrl } from '../_lib/security'

export function getRelojTabletSupabase(): SupabaseClient | null {
  const url = getSupabaseServerUrl()
  const key = getSupabaseServerKey()
  if (!url || !key) return null
  return createClient(url, key)
}

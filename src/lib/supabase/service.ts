import "server-only";

import { createClient } from "@supabase/supabase-js";

/**
 * Cliente con la clave de servicio de Supabase. Ignora RLS: usarlo solo para
 * operaciones de Auth que no tienen alternativa (invitar o eliminar cuentas),
 * siempre después de comprobar en servidor que quien lo pide es admin.
 */
export function createServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return null;
  return createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

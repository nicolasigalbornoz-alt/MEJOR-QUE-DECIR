import "server-only";

import { createPublicSupabaseClient } from "@/lib/supabase/public";

export type PublicAct = {
  id: string;
  commission_id: string;
  commission: string;
  summary: string;
  uploaded_at: string;
  public_document_path: string | null;
};

export async function listPublicActs(): Promise<PublicAct[]> {
  const supabase = createPublicSupabaseClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("published_commission_acts")
    .select("id,commission_id,commission,summary,uploaded_at,public_document_path")
    .order("uploaded_at", { ascending: false });
  return error || !data ? [] : data as PublicAct[];
}

import { NextResponse } from "next/server";
import { createPublicSupabaseClient } from "@/lib/supabase/public";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const eventId = url.searchParams.get("eventId") ?? "";
  const query = (url.searchParams.get("q") ?? "").trim();
  if (!eventId || query.length < 3 || query.length > 100) {
    return NextResponse.json([]);
  }

  const supabase = createPublicSupabaseClient();
  if (!supabase) return NextResponse.json([]);

  const { data, error } = await supabase.rpc("search_attendees", {
    requested_event: eventId,
    query_text: query,
  });

  // Mientras no se importe el padrón, la encuesta permite completar el
  // nombre, provincia y localidad manualmente.
  if (error) return NextResponse.json([]);
  return NextResponse.json(data ?? [], {
    headers: { "Cache-Control": "private, no-store" },
  });
}

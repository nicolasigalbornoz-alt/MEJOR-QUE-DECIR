import "server-only";

import type { PublicEvent } from "@/features/forms/types";
import { createPublicSupabaseClient } from "@/lib/supabase/public";

const demoEvent: PublicEvent = {
  id: "00000000-0000-4000-8000-000000000001",
  slug: "encuentro-nacional-jovenes-fr-2026",
  title: "Encuentro Nacional de Jóvenes FR",
  description: "Encuentro federal de escucha de Jóvenes FR.",
  starts_at: "2026-09-19T03:00:00.000Z",
  status: "published",
};

export async function listPublishedEvents(): Promise<PublicEvent[]> {
  const supabase = createPublicSupabaseClient();
  if (supabase) {
    const { data, error } = await supabase
      .from("events")
      .select("id,slug,title,description,starts_at,ends_at,status")
      .eq("status", "published")
      .order("starts_at", { ascending: false });
    if (!error && data) return data as PublicEvent[];
  }
  return [demoEvent];
}

export async function getPublishedEvent(slug: string): Promise<PublicEvent | null> {
  const events = await listPublishedEvents();
  return events.find((event) => event.slug === slug) ?? null;
}

export async function getPublicEventById(id: string): Promise<PublicEvent | null> {
  const events = await listPublishedEvents();
  return events.find((event) => event.id === id) ?? null;
}

export { demoEvent };

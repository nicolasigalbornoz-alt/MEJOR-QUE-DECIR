import { NextResponse } from "next/server";
import { loadPublicReport } from "@/lib/data/public-report";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const report = await loadPublicReport();
    return NextResponse.json(report, {
      headers: { "Cache-Control": "public, max-age=0, s-maxage=60, stale-while-revalidate=300" },
    });
  } catch (error) {
    console.error("No se pudo preparar el informe público", error);
    return NextResponse.json({ error: "El informe todavía no está disponible." }, { status: 503 });
  }
}

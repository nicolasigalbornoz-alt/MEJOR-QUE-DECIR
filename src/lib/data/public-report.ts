import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import Papa from "papaparse";
import { PROVINCES, matchProvince, normalizeText } from "@/data/provinces";
import { COMMISSIONS } from "@/features/forms/catalogs";
import { createPublicSupabaseClient } from "@/lib/supabase/public";
import type { PublicReport, Quote } from "@/features/reports/types";

type SurveyRow = {
  provincia: string;
  provinceId: string;
  localidad: string;
  participa: string;
  situacionEscala: number | null;
  situacionTexto: string;
  problemas: string[];
  necesidades: string[];
  comision: string;
  comisionComentario: string;
  taller: string;
  tallerComentario: string;
  visionEscala: number | null;
  visionFrase: string;
  problematicaTerritorio: string;
};

const SITUATION = new Map([
  ["muy mala", 1], ["mala", 2], ["regular", 3], ["buena", 4], ["muy buena", 5],
]);
const VISION = new Map([
  ["muy pesimista", -2], ["pesimista", -1], ["ni pesimista ni optimista", 0],
  ["neutral", 0], ["optimista", 1], ["muy optimista", 2],
]);

function findHeader(headers: string[], fragments: string[]) {
  return headers.find((header) => {
    const normalized = normalizeText(header);
    return fragments.some((fragment) => normalized.includes(fragment));
  });
}

function splitMulti(value: string) {
  return value.split(/[;,]/).map((item) => item.trim()).filter(Boolean);
}

function parseDemoCsv(csv: string): SurveyRow[] {
  const parsed = Papa.parse<string[]>(csv, { skipEmptyLines: true });
  const [headers = [], ...values] = parsed.data;
  const provincia = findHeader(headers, ["que provincia", "provincia"]);
  const localidad = findHeader(headers, ["localidad", "ciudad o barrio"]);
  const situacion = findHeader(headers, ["situacion general"]);
  const situacionTexto = findHeader(headers, ["contanos brevemente", "situacion de tu distrito"]);
  const problemas = findHeader(headers, ["problemas de la juventud"]);
  const necesidades = findHeader(headers, ["que necesitan", "necesitan los"]);
  const vision = findHeader(headers, ["tan optimista"]);
  const visionFrase = findHeader(headers, ["pais te gustaria"]);
  const participa = findHeader(headers, ["participas en algun espacio"]);

  const get = (row: string[], header: string | undefined) =>
    header ? String(row[headers.indexOf(header)] ?? "").trim() : "";

  return values.flatMap((row) => {
    const provinciaRaw = get(row, provincia);
    const provinceId = matchProvince(provinciaRaw);
    if (!provinceId) return [];
    const situationRaw = normalizeText(get(row, situacion));
    const visionRaw = normalizeText(get(row, vision));
    return [{
      provincia: provinciaRaw,
      provinceId,
      localidad: get(row, localidad),
      participa: get(row, participa),
      situacionEscala: SITUATION.get(situationRaw) ?? null,
      situacionTexto: get(row, situacionTexto),
      problemas: splitMulti(get(row, problemas)),
      necesidades: splitMulti(get(row, necesidades)),
      comision: "",
      comisionComentario: "",
      taller: "",
      tallerComentario: "",
      visionEscala: VISION.get(visionRaw) ?? null,
      visionFrase: get(row, visionFrase),
      problematicaTerritorio: "",
    }];
  });
}

function bump(counts: Record<string, number>, key: string) {
  if (key) counts[key] = (counts[key] ?? 0) + 1;
}

function emptyCounts(keys: string[]) {
  return Object.fromEntries(keys.map((key) => [key, 0]));
}

function completeCatalogs(report: PublicReport): PublicReport {
  const byProvince = Object.fromEntries(PROVINCES.map((province) => [province.id, report.byProvince?.[province.id] ?? {
    id: province.id,
    name: province.name,
    region: province.region,
    count: 0,
    situacionSum: 0,
    situacionN: 0,
    visionSum: 0,
    visionN: 0,
    problemas: {},
    necesidades: {},
    localidades: {},
    quotes: [],
  }]));
  const byCommission = Object.fromEntries(COMMISSIONS.map((commission) => [commission.id, report.byCommission?.[commission.id] ?? {
    name: commission.name,
    count: 0,
    problemas: {},
    necesidades: {},
    situacionSum: 0,
    situacionN: 0,
    visionSum: 0,
    visionN: 0,
    quotes: [],
  }]));
  return { ...report, byProvince, byCommission, maxCount: Math.max(1, report.maxCount ?? 1) };
}

export function aggregateSurvey(rows: SurveyRow[], isDemo: boolean): PublicReport {
  const byProvince = Object.fromEntries(PROVINCES.map((province) => [province.id, {
    id: province.id,
    name: province.name,
    region: province.region,
    count: 0,
    situacionSum: 0,
    situacionN: 0,
    visionSum: 0,
    visionN: 0,
    problemas: {} as Record<string, number>,
    necesidades: {} as Record<string, number>,
    localidades: {} as Record<string, number>,
    quotes: [] as Quote[],
  }]));
  const byCommission = Object.fromEntries(COMMISSIONS.map((commission) => [commission.id, {
    name: commission.name,
    count: 0,
    problemas: {} as Record<string, number>,
    necesidades: {} as Record<string, number>,
    situacionSum: 0,
    situacionN: 0,
    visionSum: 0,
    visionN: 0,
    quotes: [] as Quote[],
  }]));
  const nacProblemas: Record<string, number> = {};
  const nacNecesidades: Record<string, number> = {};
  const nacParticipa: Record<string, number> = {};
  const nacVision = emptyCounts(["-2", "-1", "0", "1", "2"]);
  const nacSituacion = emptyCounts(["1", "2", "3", "4", "5"]);
  const localityVariants = new Map<string, Map<string, Map<string, number>>>();

  for (const row of rows) {
    const province = byProvince[row.provinceId];
    if (!province) continue;
    province.count++;

    if (row.localidad) {
      const normalized = normalizeText(row.localidad.split(/[,-]/)[0]);
      if (normalized) {
        let provinceVariants = localityVariants.get(row.provinceId);
        if (!provinceVariants) {
          provinceVariants = new Map();
          localityVariants.set(row.provinceId, provinceVariants);
        }
        let variants = provinceVariants.get(normalized);
        if (!variants) {
          variants = new Map();
          provinceVariants.set(normalized, variants);
        }
        variants.set(row.localidad, (variants.get(row.localidad) ?? 0) + 1);
      }
    }

    if (row.situacionEscala !== null) {
      province.situacionSum += row.situacionEscala;
      province.situacionN++;
      bump(nacSituacion, String(row.situacionEscala));
    }
    if (row.visionEscala !== null) {
      province.visionSum += row.visionEscala;
      province.visionN++;
      bump(nacVision, String(row.visionEscala));
    }
    row.problemas.forEach((problem) => {
      bump(province.problemas, problem);
      bump(nacProblemas, problem);
    });
    row.necesidades.forEach((need) => {
      bump(province.necesidades, need);
      bump(nacNecesidades, need);
    });
    bump(nacParticipa, row.participa);

    const quote = row.problematicaTerritorio || row.situacionTexto || row.visionFrase;
    if (quote && province.quotes.length < 8) {
      province.quotes.push({ text: quote, localidad: row.localidad, provincia: province.name });
    }

    const commission = byCommission[row.comision];
    if (commission) {
      commission.count++;
      if (row.situacionEscala !== null) {
        commission.situacionSum += row.situacionEscala;
        commission.situacionN++;
      }
      if (row.visionEscala !== null) {
        commission.visionSum += row.visionEscala;
        commission.visionN++;
      }
      row.problemas.forEach((problem) => bump(commission.problemas, problem));
      row.necesidades.forEach((need) => bump(commission.necesidades, need));
      const commissionQuote = row.comisionComentario || row.situacionTexto || row.visionFrase;
      if (commissionQuote && commission.quotes.length < 6) {
        commission.quotes.push({ text: commissionQuote, localidad: row.localidad, provincia: province.name });
      }
    }
  }

  for (const [provinceId, variantsByKey] of localityVariants) {
    const province = byProvince[provinceId];
    for (const variants of variantsByKey.values()) {
      const [displayName] = [...variants.entries()].sort((a, b) => b[1] - a[1])[0] ?? [];
      if (displayName) province.localidades[displayName] = [...variants.values()].reduce((sum, count) => sum + count, 0);
    }
  }

  const provincesWithData = Object.values(byProvince).filter((province) => province.count > 0);
  return {
    isDemo,
    empty: rows.length === 0,
    totalResponses: rows.length,
    totalProvinces: provincesWithData.length,
    totalLocalidades: Object.values(byProvince).reduce((total, province) => total + Object.keys(province.localidades).length, 0),
    byProvince,
    byCommission,
    maxCount: Math.max(1, ...provincesWithData.map((province) => province.count)),
    nacProblemas,
    nacNecesidades,
    nacParticipa,
    nacVision,
    nacSituacion,
  };
}

export async function loadPublicReport(): Promise<PublicReport> {
  const supabase = createPublicSupabaseClient();
  if (supabase) {
    const { data, error } = await supabase.rpc("get_public_survey_report", {
      requested_form_slug: "mejor-que-decir",
    });
    if (!error && data && typeof data === "object") {
      const report = completeCatalogs(data as unknown as PublicReport);
      if (report.totalResponses > 0) return report;
    }
  }

  const fixturePath = path.join(process.cwd(), "public", "data", "respuestas-demo.csv");
  const csv = await readFile(fixturePath, "utf8");
  return aggregateSurvey(parseDemoCsv(csv), true);
}

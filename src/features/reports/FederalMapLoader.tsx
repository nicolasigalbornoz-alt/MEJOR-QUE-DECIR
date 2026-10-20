"use client";

import dynamic from "next/dynamic";
import type { PublicReport } from "@/features/reports/types";

const FederalMap = dynamic(
  () => import("@/features/reports/FederalMap").then((module) => module.FederalMap),
  {
    ssr: false,
    loading: () => <div className="map-canvas skeleton" aria-label="Cargando el mapa" />,
  },
);

export function FederalMapLoader({ report }: { report: PublicReport }) {
  return <FederalMap report={report} />;
}

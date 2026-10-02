export type Quote = {
  text: string;
  localidad?: string;
  provincia?: string;
};

export type ProvinceReport = {
  id: string;
  name: string;
  region: string;
  count: number;
  situacionSum: number;
  situacionN: number;
  visionSum: number;
  visionN: number;
  problemas: Record<string, number>;
  necesidades: Record<string, number>;
  localidades: Record<string, number>;
  quotes: Quote[];
};

export type CommissionReport = {
  name: string;
  count: number;
  problemas: Record<string, number>;
  necesidades: Record<string, number>;
  situacionSum: number;
  situacionN: number;
  visionSum: number;
  visionN: number;
  quotes: Quote[];
};

export type PublicReport = {
  isDemo: boolean;
  empty: boolean;
  totalResponses: number;
  totalProvinces: number;
  totalLocalidades: number;
  byProvince: Record<string, ProvinceReport>;
  byCommission: Record<string, CommissionReport>;
  maxCount: number;
  nacProblemas: Record<string, number>;
  nacNecesidades: Record<string, number>;
  nacParticipa: Record<string, number>;
  nacVision: Record<string, number>;
  nacSituacion: Record<string, number>;
};

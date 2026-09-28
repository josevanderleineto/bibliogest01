// ============================================
// BiblioGest - Configurações do sistema
//
// Identificação da instituição/biblioteca e
// parâmetros de circulação. Linha única (singleton).
// ============================================

import prisma from "@/lib/prisma";

export const SETTINGS_ID = "singleton";

/** Valores usados quando nada foi configurado ainda. */
export const DEFAULT_SETTINGS = {
  institutionName: "Museu de Astronomia e Ciências Afins",
  institutionAcronym: "MAB",
  libraryName: "Biblioteca do MAB",
  libraryCode: "MAB-BIB",
  address: "",
  phone: "",
  email: "",
  website: "",
  loanDays: 14,
  maxLoansPerUser: 3,
  maxRenewals: 3,
  showCredit: true,
} as const;

export type Settings = {
  id: string;
  institutionName: string;
  institutionAcronym: string;
  libraryName: string;
  libraryCode: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  loanDays: number;
  maxLoansPerUser: number;
  maxRenewals: number;
  showCredit: boolean;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Lê as configurações criando a linha padrão na primeira vez.
 * Assim o sistema funciona sem script de seed.
 */
export async function getSettings(): Promise<Settings> {
  return prisma.settings.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID, ...DEFAULT_SETTINGS },
    update: {},
  });
}

/** Título curto para exibir no cabeçalho: biblioteca + instituição. */
export function brandTitle(s: Pick<Settings, "libraryName" | "institutionAcronym">) {
  return {
    library: s.libraryName,
    institution: s.institutionAcronym,
    full: `${s.libraryName} · ${s.institutionAcronym}`,
  };
}

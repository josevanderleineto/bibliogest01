"use client";

// ============================================
// BiblioGest - Contexto de Configurações
// Carrega uma vez e disponibiliza para toda a interface.
// ============================================

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";

export interface SettingsData {
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
}

/** Usado antes da carregar, e como reserva se a API falhar. */
export const FALLBACK: SettingsData = {
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
};

interface SettingsContextValue {
  settings: SettingsData;
  loading: boolean;
  reload: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue>({
  settings: FALLBACK,
  loading: true,
  reload: async () => {},
});

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<SettingsData>(FALLBACK);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      const res = await fetch("/api/settings");
      const data = await res.json();
      if (res.ok && data.settings) {
        setSettings({ ...FALLBACK, ...data.settings });
      }
    } catch {
      // mantém os valores padrão
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return (
    <SettingsContext.Provider value={{ settings, loading, reload }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext);
}

/** Atalho: "Biblioteca do MAB · MAB" */
export function useBrand() {
  const { settings } = useSettings();
  return {
    library: settings.libraryName,
    institution: settings.institutionName,
    acronym: settings.institutionAcronym,
    full: `${settings.libraryName} · ${settings.institutionAcronym}`,
  };
}

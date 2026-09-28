// ============================================
// BiblioGest - Layout Principal
// ============================================

import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { getSettings } from "@/lib/settings";
import { SettingsProvider } from "@/components/SettingsProvider";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

// Nome da biblioteca vem das configurações (personalizável)
export async function generateMetadata(): Promise<Metadata> {
  let title = "BiblioGest";
  let description = "Sistema de gestão de biblioteca";

  try {
    const s = await getSettings();
    title = `${s.libraryName} · ${s.institutionAcronym}`;
    description = `Sistema de gestão da ${s.libraryName} — catalogação, exemplares e empréstimos.`;
  } catch {
    // mantém o padrão se o banco estiver indisponível
  }

  return { title, description };
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className={`${inter.className} bg-gray-50 text-gray-900 antialiased`}>
        <SettingsProvider>{children}</SettingsProvider>
      </body>
    </html>
  );
}

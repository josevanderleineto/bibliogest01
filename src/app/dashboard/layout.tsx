// ============================================
// BiblioGest - Layout do Dashboard
// ============================================

"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useSettings } from "@/components/SettingsProvider";

const NAV = [
  { href: "/dashboard", icon: "📊", label: "Painel" },
  { href: "/dashboard/catalog", icon: "📖", label: "Catalogação" },
  { href: "/dashboard/exemplars", icon: "📚", label: "Exemplares" },
  { href: "/dashboard/loans", icon: "🧾", label: "Empréstimos" },
  { href: "/dashboard/loans/new", icon: "📋", label: "Balcão" },
  { href: "/dashboard/users", icon: "👤", label: "Usuários" },
  { href: "/dashboard/labels", icon: "🏷️", label: "Etiquetas" },
  { href: "/dashboard/reports", icon: "📈", label: "Relatórios" },
  { href: "/dashboard/settings", icon: "⚙️", label: "Configurações" },
];

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Administrador",
  LIBRARIAN: "Bibliotecário",
  ASSISTANT: "Assistente",
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { settings } = useSettings();
  const [user, setUser] = useState<{
    id: string;
    name: string;
    email: string;
    role: string;
  } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/auth/me");
        const data = await res.json();
        if (res.ok && data.user) {
          setUser(data.user);
        } else {
          router.replace("/auth/login");
        }
      } catch {
        router.replace("/auth/login");
      }
    })();
  }, [router]);

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/auth/login");
  };

  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === href : pathname.startsWith(href);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-60 bg-white border-r border-gray-200 fixed left-0 top-0 bottom-0 flex flex-col z-20">
        <div className="p-4 border-b border-gray-200">
          <Link href="/dashboard" className="block">
            <span className="text-lg font-bold text-primary-700 leading-tight block truncate">
              📚 {settings.libraryName}
            </span>
            <span className="text-xs text-gray-500 block truncate">
              {settings.institutionName}
            </span>
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto py-3">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-2.5 text-sm transition ${
                isActive(item.href)
                  ? "bg-primary-50 text-primary-700 font-medium border-r-2 border-primary-600"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              <span className="text-base">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}

          <div className="mt-3 pt-3 border-t border-gray-100">
            <Link
              href="/catalog"
              target="_blank"
              className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-500 hover:bg-gray-50"
            >
              <span className="text-base">🌐</span>
              <span>Catálogo público</span>
            </Link>
          </div>
        </nav>

        {user && (
          <div className="p-3 border-t border-gray-200">
            <p className="text-sm font-medium text-gray-900 truncate">{user.name}</p>
            <p className="text-xs text-gray-500 truncate">
              {ROLE_LABEL[user.role] || user.role}
            </p>
            <button
              onClick={logout}
              className="mt-2 w-full text-xs text-red-600 hover:underline"
            >
              Sair
            </button>
          </div>
        )}
      </aside>

      {/* Conteúdo */}
      <main className="ml-60 p-8 pb-16 min-h-screen">{children}</main>
    </div>
  );
}

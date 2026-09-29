// ============================================
// BiblioGest - Layout do Dashboard
// Responsivo: menu lateral em telas grandes,
// gaveta deslizante no celular
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
  const [open, setOpen] = useState(false);
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
        if (res.ok && data.user) setUser(data.user);
        else router.replace("/auth/login");
      } catch {
        router.replace("/auth/login");
      }
    })();
  }, [router]);

  // Fecha a gaveta ao trocar de página
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Bloqueia a rolagem do fundo com a gaveta aberta
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/auth/login");
  };

  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === href : pathname.startsWith(href);

  const nav = (
    <>
      <div className="p-4 border-b border-gray-200 flex items-center gap-3">
        {settings.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={settings.logoUrl}
            alt={settings.libraryName}
            className="h-10 w-10 shrink-0 rounded object-contain"
          />
        ) : (
          <span className="text-2xl shrink-0">📚</span>
        )}
        <Link href="/dashboard" className="min-w-0 flex-1">
          <span className="text-base font-bold text-primary-700 leading-tight block truncate">
            {settings.libraryName}
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
    </>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ---------- Barra superior (celular) ---------- */}
      <header className="lg:hidden fixed top-0 inset-x-0 h-14 bg-white border-b border-gray-200 flex items-center gap-3 px-4 z-30">
        <button
          onClick={() => setOpen(true)}
          aria-label="Abrir menu"
          className="p-2 -ml-2 rounded-md text-gray-600 hover:bg-gray-100"
        >
          <span className="block w-5 h-0.5 bg-current mb-1" />
          <span className="block w-5 h-0.5 bg-current mb-1" />
          <span className="block w-5 h-0.5 bg-current" />
        </button>
        <div className="min-w-0">
          {settings.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={settings.logoUrl}
              alt=""
              className="h-8 w-8 rounded object-contain"
            />
          ) : (
            <span className="text-xl">📚</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-primary-700 truncate leading-tight">
            {settings.libraryName}
          </p>
          <p className="text-[11px] text-gray-500 truncate leading-tight">
            {NAV.find((n) => isActive(n.href))?.label ?? "Menu"}
          </p>
        </div>
      </header>

      {/* ---------- Gaveta (celular) ---------- */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute left-0 top-0 bottom-0 w-64 bg-white shadow-xl flex flex-col">
            {nav}
          </aside>
        </div>
      )}

      {/* ---------- Sidebar (telas grandes) ---------- */}
      <aside className="hidden lg:flex lg:w-60 bg-white border-r border-gray-200 fixed left-0 top-0 bottom-0 flex-col z-20">
        {nav}
      </aside>

      {/* ---------- Conteúdo ---------- */}
      <main className="lg:ml-60 pt-14 lg:pt-0 p-4 sm:p-6 lg:p-8 min-h-screen">
        {children}
      </main>
    </div>
  );
}

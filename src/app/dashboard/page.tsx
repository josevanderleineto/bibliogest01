// ============================================
// BiblioGest - Painel de Controle
// ============================================

import Link from "next/link";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [totalTitles, totalExemplars, availableExemplars, activeLoans, overdueLoans, totalUsers] =
    await Promise.all([
      prisma.catalog.count(),
      prisma.exemplar.count(),
      prisma.exemplar.count({ where: { status: "AVAILABLE" } }),
      prisma.loan.count({ where: { status: "ACTIVE" } }),
      prisma.loan.count({ where: { status: "OVERDUE" } }),
      prisma.user.count({ where: { isActive: true } }),
    ]);

  const cards = [
    { label: "Títulos catalogados", value: totalTitles, icon: "📖", color: "text-primary-600", href: "/dashboard/catalog" },
    { label: "Exemplares", value: totalExemplars, icon: "📦", color: "text-gray-800", href: "/dashboard/exemplars" },
    { label: "Disponíveis", value: availableExemplars, icon: "✅", color: "text-green-600", href: "/dashboard/exemplars" },
    { label: "Empréstimos ativos", value: activeLoans, icon: "🧾", color: "text-blue-600", href: "/dashboard/loans" },
    { label: "Em atraso", value: overdueLoans, icon: "⚠️", color: "text-red-600", href: "/dashboard/loans" },
    { label: "Usuários ativos", value: totalUsers, icon: "👤", color: "text-purple-600", href: "/dashboard/users" },
  ];

  const actions = [
    { label: "Catalogar item", icon: "📖", href: "/dashboard/catalog", cls: "bg-primary-100 text-primary-700 hover:bg-primary-200" },
    { label: "Balcão de empréstimo", icon: "📋", href: "/dashboard/loans/new", cls: "bg-blue-100 text-blue-700 hover:bg-blue-200" },
    { label: "Novo usuário", icon: "👤", href: "/dashboard/users/new", cls: "bg-green-100 text-green-700 hover:bg-green-200" },
    { label: "Gerar etiquetas", icon: "🏷️", href: "/dashboard/labels", cls: "bg-purple-100 text-purple-700 hover:bg-purple-200" },
  ];

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-1">Painel de Controle</h1>
      <p className="text-sm text-gray-500 mb-6">Visão geral do acervo e da circulação.</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {cards.map((c) => (
          <Link
            key={c.label}
            href={c.href}
            className="bg-white rounded-lg shadow p-5 hover:shadow-md transition"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{c.label}</p>
                <p className={`text-3xl font-bold ${c.color}`}>{c.value}</p>
              </div>
              <span className="text-3xl">{c.icon}</span>
            </div>
          </Link>
        ))}
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-bold mb-4">Ações rápidas</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {actions.map((a) => (
            <Link
              key={a.href}
              href={a.href}
              className={`py-3 px-4 rounded-lg text-center font-medium text-sm ${a.cls}`}
            >
              {a.icon} {a.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

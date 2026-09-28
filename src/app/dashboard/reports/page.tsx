// ============================================
// BiblioGest - Relatórios (Dashboard)
// ============================================

"use client";

import { useState, useEffect } from "react";

export default function ReportsPage() {
  const [summary, setSummary] = useState<any>(null);
  const [type, setType] = useState("summary");

  useEffect(() => {
    fetch(`/api/reports?type=${type}`).then(r => r.json()).then(d => setSummary(d));
  }, [type]);

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-8">📊 Relatórios</h1>
      <div className="flex gap-2 mb-6">
        {[
          { key: "summary", label: "📈 Resumo" },
          { key: "loans", label: "🧾 Empréstimos" },
          { key: "overdue", label: "⚠️ Em Atraso" },
          { key: "catalog", label: "📚 Acervo" },
        ].map((r) => (
          <button key={r.key} onClick={() => setType(r.key)} className={`px-4 py-2 rounded-lg font-medium ${type === r.key ? "bg-primary-600 text-white" : "bg-white text-gray-700 hover:bg-gray-100"}`}>{r.label}</button>
        ))}
      </div>
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200"><h2 className="text-lg font-bold">Relatório</h2></div>
        <div className="p-6">
          {type === "summary" && summary && (
            <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
              {[
                { label: "Títulos", value: summary.totalTitles, color: "text-primary-600" },
                { label: "Exemplares", value: summary.totalExemplars, color: "text-green-600" },
                { label: "Disponíveis", value: summary.availableExemplars, color: "text-blue-600" },
                { label: "Empréstimos", value: summary.totalLoans, color: "text-yellow-600" },
                { label: "Em Atraso", value: summary.overdueLoans, color: "text-red-600" },
              ].map((c, i) => (
                <div key={i} className="bg-gray-50 p-4 rounded-lg text-center">
                  <p className="text-sm text-gray-600">{c.label}</p>
                  <p className={`text-3xl font-bold ${c.color}`}>{c.value}</p>
                </div>
              ))}
            </div>
          )}
          {type === "overdue" && summary && (
            <div>
              <p className="mb-4">Total em atraso: <strong>{summary.count}</strong></p>
              {(summary.overdueLoans || []).map((loan: any, i: number) => (
                <div key={i} className="flex justify-between items-center bg-red-50 p-3 rounded mb-2">
                  <div><strong>{loan.user?.name}</strong> - {loan.catalog?.title}</div>
                  <span className="text-red-600 text-sm">Vencido</span>
                </div>
              ))}
            </div>
          )}
          {!summary && <p className="text-gray-500 text-center py-8">Carregando relatório...</p>}
        </div>
      </div>
      <button className="mt-6 bg-green-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-green-700">📥 Exportar CSV</button>
    </div>
  );
}

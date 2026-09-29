// ============================================
// BiblioGest - Empréstimos (Dashboard)
// ============================================

"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface Loan {
  id: string;
  loanDate: string;
  dueDate: string;
  returnDate?: string;
  status: string;
  user: { id: string; name: string; email: string };
  catalog: { id: string; title: string };
  exemplar: { barcode: string; accessionNumber?: string };
}

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Ativo",
  RETURNED: "Devolvido",
  OVERDUE: "Em atraso",
  RENEWED: "Renovado",
};

const FILTERS = [
  { value: "ACTIVE", label: "📖 Ativos" },
  { value: "OVERDUE", label: "⚠️ Em atraso" },
  { value: "RETURNED", label: "✅ Devolvidos" },
  { value: "", label: "Todos" },
];

const fmt = (d?: string) =>
  d ? new Date(d).toLocaleDateString("pt-BR") : "—";

export default function LoansPage() {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [filter, setFilter] = useState("ACTIVE");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");

  const load = useCallback(async (status: string) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/loans?limit=50${status ? `&status=${status}` : ""}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Erro ao carregar empréstimos");
        return;
      }
      setLoans(data.loans || []);
    } catch {
      setError("Erro de conexão");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(filter);
  }, [load, filter]);

  const act = async (id: string, action: "return" | "renew") => {
    setBusyId(id);
    setError("");
    try {
      const res = await fetch("/api/loans", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "Erro na operação");
        return;
      }
      load(filter);
    } catch {
      setError("Erro de conexão");
    } finally {
      setBusyId("");
    }
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">🧾 Empréstimos</h1>
          <p className="text-sm text-gray-500 mt-1">
            Use o balcão com leitor de código de barras para empréstimo e devolução.
          </p>
        </div>
        <Link
          href="/dashboard/loans/new"
          className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700"
        >
          📋 Balcão de empréstimo
        </Link>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`px-4 py-2 rounded-lg font-medium text-sm ${
              filter === f.value
                ? "bg-primary-600 text-white"
                : "bg-white text-gray-700 hover:bg-gray-100"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 p-3 rounded bg-red-100 text-red-700 text-sm">{error}</div>
      )}

      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {["Usuário", "Item", "Exemplar", "Emprestado", "Devolução", "Status", "Ações"].map(
                (h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap"
                  >
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-500">
                  Carregando...
                </td>
              </tr>
            )}
            {!loading && loans.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-500">
                  Nenhum empréstimo encontrado.
                </td>
              </tr>
            )}
            {!loading &&
              loans.map((loan) => {
                const late =
                  loan.status !== "RETURNED" && new Date(loan.dueDate) < new Date();
                return (
                  <tr key={loan.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-gray-900">
                        {loan.user.name}
                      </p>
                      <p className="text-xs text-gray-500">{loan.user.email}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-800 max-w-xs">
                      <p className="truncate">{loan.catalog.title}</p>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600 whitespace-nowrap">
                      {loan.exemplar.barcode}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                      {fmt(loan.loanDate)}
                    </td>
                    <td
                      className={`px-4 py-3 text-sm whitespace-nowrap ${
                        late ? "text-red-600 font-medium" : "text-gray-600"
                      }`}
                    >
                      {fmt(loan.dueDate)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${
                          late
                            ? "bg-red-100 text-red-700"
                            : loan.status === "RETURNED"
                            ? "bg-green-100 text-green-700"
                            : "bg-blue-100 text-blue-700"
                        }`}
                      >
                        {late ? "Em atraso" : STATUS_LABEL[loan.status] || loan.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {loan.status !== "RETURNED" && (
                        <div className="flex gap-2 text-xs">
                          <button
                            onClick={() => act(loan.id, "return")}
                            disabled={busyId === loan.id}
                            className="text-green-700 hover:underline disabled:opacity-50"
                          >
                            Devolver
                          </button>
                          <button
                            onClick={() => act(loan.id, "renew")}
                            disabled={busyId === loan.id}
                            className="text-primary-600 hover:underline disabled:opacity-50"
                          >
                            Renovar
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================
// BiblioGest - Exemplares (Dashboard)
// ============================================

"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface Exemplar {
  id: string;
  barcode: string;
  accessionNumber?: string;
  exemplarNumber?: number;
  status: string;
  callNumber?: string;
  cutterCode?: string;
  catalog: {
    id: string;
    title: string;
    authors: string[];
    callNumber?: string;
    cutterCode?: string;
    classification?: string;
    controlNumber?: string;
    tombo?: string;
  };
}

/** Número de chamada completo: classificação + cutter. */
function fullCallNumber(ex: Exemplar): string {
  return [
    ex.callNumber || ex.catalog.classification || ex.catalog.callNumber,
    ex.cutterCode || ex.catalog.cutterCode,
  ]
    .filter(Boolean)
    .join(" ");
}

const STATUS_LABEL: Record<string, string> = {
  AVAILABLE: "Disponível",
  LOANED: "Emprestado",
  PROCESSING: "Em processamento",
  RESTORATION: "Em restauro",
  MAINTENANCE: "Em manutenção",
  LOST: "Perdido",
};

const STATUS_STYLE: Record<string, string> = {
  AVAILABLE: "bg-green-100 text-green-700",
  LOANED: "bg-blue-100 text-blue-700",
  PROCESSING: "bg-amber-100 text-amber-700",
  RESTORATION: "bg-purple-100 text-purple-700",
  MAINTENANCE: "bg-orange-100 text-orange-700",
  LOST: "bg-red-100 text-red-700",
};

const FILTERS = [
  { value: "", label: "Todos" },
  { value: "AVAILABLE", label: "Disponíveis" },
  { value: "LOANED", label: "Emprestados" },
  { value: "PROCESSING", label: "Em processamento" },
  { value: "RESTORATION", label: "Em restauro" },
  { value: "MAINTENANCE", label: "Em manutenção" },
];

const EDITABLE = ["AVAILABLE", "PROCESSING", "RESTORATION", "MAINTENANCE", "LOST"];

export default function ExemplarsPage() {
  const [exemplars, setExemplars] = useState<Exemplar[]>([]);
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");

  const load = useCallback(async (statusFilter = "", search = "") => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ limit: "200" });
      if (statusFilter) params.set("status", statusFilter);
      if (search) params.set("q", search);
      const res = await fetch(`/api/exemplars?${params}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Erro ao carregar exemplares");
        return;
      }
      setExemplars(data.exemplars || []);
    } catch {
      setError("Erro de conexão");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(status, q);
  }, [load, status, q]);

  const changeStatus = async (exemplar: Exemplar, newStatus: string) => {
    setBusyId(exemplar.id);
    setError("");
    try {
      const res = await fetch("/api/exemplars", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: exemplar.id, status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "Erro ao alterar status");
        return;
      }
      setExemplars((prev) =>
        prev.map((e) => (e.id === exemplar.id ? { ...e, status: newStatus } : e))
      );
    } catch {
      setError("Erro de conexão");
    } finally {
      setBusyId("");
    }
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="flex-1">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">📚 Exemplares</h1>
          <p className="text-sm text-gray-500 mt-1">
            Cada exemplar tem número de acervo e código de barras próprios.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Link
            href="/dashboard/exemplars/novo"
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm text-center"
          >
            ➕ Inserir exemplar
          </Link>
          <Link
            href="/dashboard/labels"
            className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-sm text-center"
          >
            🏷️ Etiquetas
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-3 mb-4 flex flex-col sm:flex-row gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por título, código de barras, nº de acervo..."
          className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-md"
        >
          {FILTERS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded bg-red-100 text-red-700 text-sm">{error}</div>
      )}

      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              {["Acervo", "Ex.", "Tombo", "Cód. barras", "Chamada", "Título", "Status", "Alterar"].map(
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
                <td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-500">
                  Carregando...
                </td>
              </tr>
            )}
            {!loading && exemplars.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-500">
                  Nenhum exemplar encontrado.
                </td>
              </tr>
            )}
            {!loading &&
              exemplars.map((ex) => (
                <tr key={ex.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-sm text-gray-700">
                    {ex.accessionNumber || "—"}
                  </td>
                  <td className="px-4 py-3 font-mono text-sm text-gray-700">
                    {ex.exemplarNumber ? `Ex.${ex.exemplarNumber}` : "—"}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">
                    {ex.catalog.tombo || "—"}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">
                    {ex.barcode}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-700 whitespace-nowrap">
                    {fullCallNumber(ex) || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm text-gray-900 max-w-xs truncate">
                      {ex.catalog.title}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {ex.catalog.authors?.join(", ")}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${
                        STATUS_STYLE[ex.status] || "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {STATUS_LABEL[ex.status] || ex.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={ex.status}
                      disabled={busyId === ex.id}
                      onChange={(e) => changeStatus(ex, e.target.value)}
                      className="text-xs px-2 py-1 border border-gray-300 rounded disabled:opacity-50"
                    >
                      {EDITABLE.map((s) => (
                        <option key={s} value={s}>
                          {STATUS_LABEL[s]}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

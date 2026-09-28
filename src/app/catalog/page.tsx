// ============================================
// BiblioGest - Catálogo Público (sem login)
// Mostra somente exemplares com status Disponível
// ============================================

"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSettings } from "@/components/SettingsProvider";

interface CatalogItem {
  id: string;
  title: string;
  subtitle?: string;
  authors: string[];
  publisher?: string;
  publicationYear?: string;
  materialType: string;
  classification?: string;
  callNumber?: string;
  cutterCode?: string;
  cdd?: string;
  cdu?: string;
  controlNumber?: string;
  subjects: string[];
  exemplars: Array<{
    id: string;
    status: string;
    callNumber?: string;
    cutterCode?: string;
    accessionNumber?: string;
  }>;
}

/** Número de chamada completo: classificação + cutter. */
function fullCallNumber(item: CatalogItem): string {
  const parts = [
    item.classification || item.callNumber,
    item.cutterCode,
  ].filter(Boolean);
  return parts.join(" ");
}

const TYPE_LABEL: Record<string, string> = {
  BOOK: "Livro",
  PERIODICAL: "Periódico",
  OTHER: "Outro",
};

export default function PublicCatalogPage() {
  const { settings } = useSettings();
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);

  const search = useCallback(async (query = "", matType = "") => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      if (matType) params.set("type", matType);
      // Apenas exemplares disponíveis ficam visíveis ao público
      params.set("status", "AVAILABLE");
      params.set("limit", "50");

      const res = await fetch(`/api/catalog?${params}`);
      const data = await res.json();
      if (res.ok) {
        setItems(data.catalogs || []);
        setTotal(data.total || 0);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    search();
  }, [search]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    search(q, type);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-primary-700 text-white py-8">
        <div className="max-w-4xl mx-auto px-4">
          <h1 className="text-3xl font-bold">
            📚 Acervo — {settings.libraryName}
          </h1>
          <p className="text-primary-100 mt-1">{settings.institutionName}</p>
          <p className="text-primary-200/80 text-sm mt-1">
            {total} título{total === 1 ? "" : "s"} disponível
            {total === 1 ? "" : "is"} para consulta
          </p>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        <form onSubmit={submit} className="bg-white rounded-lg shadow p-3 mb-6 flex flex-col sm:flex-row gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por título, autor, ISBN ou número de chamada..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
          />
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md"
          >
            <option value="">Todos os tipos</option>
            <option value="BOOK">Livros</option>
            <option value="PERIODICAL">Periódicos</option>
            <option value="OTHER">Outros</option>
          </select>
          <button
            type="submit"
            className="px-5 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
          >
            Buscar
          </button>
        </form>

        {loading && (
          <p className="text-center text-gray-500 py-8">Carregando...</p>
        )}

        {!loading && items.length === 0 && (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-500">
              Nenhum título disponível no momento.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {items.map((item) => (
            <article
              key={item.id}
              className="bg-white rounded-lg shadow p-4 hover:shadow-md transition"
            >
              <div className="flex items-start gap-2 mb-1">
                <span className="text-lg">{item.materialType === "BOOK" ? "📗" : item.materialType === "PERIODICAL" ? "📘" : "📕"}</span>
                <span className="text-xs text-gray-500 uppercase tracking-wide">
                  {TYPE_LABEL[item.materialType] || item.materialType}
                </span>
              </div>

              <h2 className="font-semibold text-gray-900 leading-snug">
                {item.title}
                {item.subtitle && (
                  <span className="font-normal text-gray-600"> : {item.subtitle}</span>
                )}
              </h2>

              {item.authors?.length > 0 && (
                <p className="text-sm text-gray-600 mt-1">
                  {item.authors.join("; ")}
                </p>
              )}

              <dl className="mt-3 space-y-1 text-xs text-gray-600">
                <div className="flex gap-2">
                  <dt className="text-gray-400 w-20 shrink-0">Chamada</dt>
                  <dd className="font-mono font-semibold text-gray-800">
                    {fullCallNumber(item) || "—"}
                  </dd>
                </div>
                {item.publisher && (
                  <div className="flex gap-2">
                    <dt className="text-gray-400 w-20 shrink-0">Editora</dt>
                    <dd>
                      {item.publisher}
                      {item.publicationYear ? `, ${item.publicationYear}` : ""}
                    </dd>
                  </div>
                )}
                {item.subjects?.length > 0 && (
                  <div className="flex gap-2">
                    <dt className="text-gray-400 w-20 shrink-0">Assuntos</dt>
                    <dd>{item.subjects.join("; ")}</dd>
                  </div>
                )}
              </dl>

              <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                <span className="text-xs text-green-700 font-medium">
                  {item.exemplars.length} exemplar
                  {item.exemplars.length === 1 ? "" : "es"} disponível
                  {item.exemplars.length === 1 ? "" : "is"}
                </span>
                <Link
                  href={`/catalog/${item.id}`}
                  className="text-sm text-primary-700 hover:underline"
                >
                  Detalhes →
                </Link>
              </div>
            </article>
          ))}
        </div>
      </main>

      <footer className="border-t border-gray-200 py-6 text-center text-xs text-gray-500 space-y-1">
        {settings.address && <p>{settings.address}</p>}
        <p>
          {[settings.phone && `Tel: ${settings.phone}`, settings.email]
            .filter(Boolean)
            .join(" · ")}
        </p>
        {settings.showCredit && (
          <p>
            <a
              href="https://www.vanderleineto.online/"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-primary-700"
            >
              Feito por Vanderlei Neto — vanderleineto.online
            </a>
          </p>
        )}
      </footer>
    </div>
  );
}

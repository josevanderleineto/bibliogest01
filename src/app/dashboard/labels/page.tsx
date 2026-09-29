// ============================================
// BiblioGest - Etiquetas (Dashboard)
// Segue o modelo do Koha: cada etiqueta identifica um
// "item" com código de barras (Code 39) e número de
// chamada (classificação + cutter).
// ============================================

"use client";

import { useState, useEffect, useCallback } from "react";
import Barcode39 from "@/components/Barcode39";
import { useSettings } from "@/components/SettingsProvider";

interface Exemplar {
  id: string;
  barcode: string;
  accessionNumber?: string;
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
  };
}

interface LabelData {
  type: string;
  exemplarId: string;
  barcode: string;
  accessionNumber?: string;
  exemplarIndex: number;
  callNumber: string;
  classification: string;
  cutter: string;
  edition?: string | null;
  status: string;
  size: { w: number; h: number };
  catalog: {
    title: string;
    subtitle?: string;
    authors: string[];
    edition?: string;
    publisher?: string;
    publicationYear?: string;
    callNumber?: string;
    cutterCode?: string;
    classification?: string;
    cdd?: string;
    cdu?: string;
    controlNumber?: string;
  };
}

type LabelType = "SPINE" | "FRONT" | "BARCODE";

const TYPES: { value: LabelType; label: string; desc: string }[] = [
  { value: "SPINE", label: "📏 Lombada", desc: "50×20mm · número de chamada" },
  { value: "FRONT", label: "📋 Frente", desc: "70×30mm · título + código" },
  { value: "BARCODE", label: "🔖 Só código", desc: "40×20mm · apenas barcode" },
];

const STATUS_LABEL: Record<string, string> = {
  AVAILABLE: "Disponível",
  LOANED: "Emprestado",
  PROCESSING: "Em processamento",
  RESTORATION: "Em restauro",
  MAINTENANCE: "Em manutenção",
  LOST: "Perdido",
};

export default function LabelsPage() {
  const { settings } = useSettings();
  const [labelType, setLabelType] = useState<LabelType>("SPINE");
  const [exemplars, setExemplars] = useState<Exemplar[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [labels, setLabels] = useState<LabelData[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (q = "") => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/exemplars?limit=200${q ? `&q=${encodeURIComponent(q)}` : ""}`
      );
      const data = await res.json();
      if (res.ok) setExemplars(data.exemplars || []);
    } catch {
      setError("Erro ao carregar exemplares");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = (id: string) =>
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  const toggleAll = () =>
    setSelected((prev) =>
      prev.length === exemplars.length ? [] : exemplars.map((e) => e.id)
    );

  const generate = async () => {
    if (selected.length === 0) return;
    setBusy(true);
    setError("");
    setLabels([]);
    try {
      const res = await fetch("/api/labels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: labelType, exemplarIds: selected }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Erro ao gerar etiquetas");
        return;
      }
      setLabels(data.labels || []);
    } catch {
      setError("Erro de conexão");
    } finally {
      setBusy(false);
    }
  };

  const changeType = (t: LabelType) => {
    setLabelType(t);
    setLabels([]);
  };

  return (
    <div>
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">🏷️ Etiquetas</h1>
      <p className="text-sm text-gray-500 mb-6">
        Selecione os exemplares do acervo para imprimir as etiquetas de identificação.
      </p>

      {error && (
        <div className="mb-4 p-3 rounded bg-red-100 text-red-700 text-sm">{error}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* ---------- Configuração ---------- */}
        <div className="bg-white rounded-lg shadow p-6 space-y-5 no-print">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tipo de etiqueta
            </label>
            <div className="grid grid-cols-1 gap-2">
              {TYPES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => changeType(t.value)}
                  className={`text-left px-4 py-2.5 rounded-lg border transition ${
                    labelType === t.value
                      ? "border-primary-600 bg-primary-50"
                      : "border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  <span
                    className={`text-sm font-medium ${
                      labelType === t.value ? "text-primary-700" : "text-gray-700"
                    }`}
                  >
                    {t.label}
                  </span>
                  <span className="block text-xs text-gray-500">{t.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Filtrar exemplares
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && load(search)}
                placeholder="Título, código de barras, nº de acervo..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
              <button
                onClick={() => load(search)}
                className="px-4 py-2 bg-primary-600 text-white rounded-md text-sm hover:bg-primary-700"
              >
                Buscar
              </button>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Exemplares ({exemplars.length})
              </label>
              {exemplars.length > 0 && (
                <button
                  onClick={toggleAll}
                  className="text-xs text-primary-600 hover:underline"
                >
                  {selected.length === exemplars.length
                    ? "Desmarcar todos"
                    : "Marcar todos"}
                </button>
              )}
            </div>

            <div className="max-h-72 overflow-y-auto border border-gray-300 rounded-md divide-y divide-gray-100">
              {loading && (
                <p className="p-4 text-sm text-gray-500 text-center">Carregando...</p>
              )}
              {!loading && exemplars.length === 0 && (
                <p className="p-4 text-sm text-gray-500 text-center">
                  Nenhum exemplar encontrado. Cadastre itens no catálogo primeiro.
                </p>
              )}
              {!loading &&
                exemplars.map((ex) => (
                  <label
                    key={ex.id}
                    className="flex items-start gap-3 p-3 cursor-pointer hover:bg-gray-50"
                  >
                    <input
                      type="checkbox"
                      checked={selected.includes(ex.id)}
                      onChange={() => toggle(ex.id)}
                      className="mt-1 rounded"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {ex.catalog.title}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {ex.catalog.authors?.join(", ")}
                      </p>
                      <p className="text-xs text-gray-500 font-mono mt-0.5">
                        {[ex.callNumber || ex.catalog.callNumber, ex.cutterCode || ex.catalog.cutterCode]
                          .filter(Boolean)
                          .join(" ") || "sem número de chamada"}
                      </p>
                      <p className="text-xs text-gray-400 font-mono">
                        {ex.barcode}
                        {ex.accessionNumber ? ` · acervo ${ex.accessionNumber}` : ""}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded ${
                        ex.status === "AVAILABLE"
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {STATUS_LABEL[ex.status] || ex.status}
                    </span>
                  </label>
                ))}
            </div>
          </div>

          <button
            onClick={generate}
            disabled={selected.length === 0 || busy}
            className="w-full bg-primary-600 text-white py-3 rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50"
          >
            {busy ? "Gerando..." : `🖨️ Gerar etiquetas (${selected.length})`}
          </button>
        </div>

        {/* ---------- Pré-visualização ---------- */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4">Pré-visualização</h2>

          {labels.length === 0 ? (
            <p className="text-gray-500 text-center py-12 text-sm">
              Selecione os exemplares e clique em gerar etiquetas
            </p>
          ) : (
            <>
              <div className="flex flex-wrap gap-3 mb-4">
                {labels.map((label) => (
                  <div
                    key={label.exemplarId}
                    className="border border-gray-400 rounded p-1.5 flex flex-col bg-white overflow-hidden"
                    style={{ width: `${label.size.w}mm`, minHeight: `${label.size.h}mm` }}
                  >
                    {/* ---------- Lombada: classificação / cutter / edição / Ex.N ---------- */}
                    {label.type === "SPINE" && (
                      <div className="flex h-full flex-col items-center justify-center text-center leading-none">
                        {label.classification && (
                          <div className="font-mono text-[13px] font-bold leading-tight">
                            {label.classification}
                          </div>
                        )}
                        {label.cutter && (
                          <div className="font-mono text-[13px] font-bold leading-tight">
                            {label.cutter}
                          </div>
                        )}
                        {label.edition && (
                          <div className="font-mono text-[9px] leading-tight text-gray-700">
                            {label.edition}
                          </div>
                        )}
                        <div className="font-mono text-[9px] mt-0.5 text-gray-700">
                          Ex.{label.exemplarIndex}
                        </div>
                      </div>
                    )}

                    {/* ---------- Identificação: campos nomeados + código de barras ---------- */}
                    {label.type === "FRONT" && (
                      <div className="flex h-full flex-col leading-tight gap-0.5">
                        <div className="text-[6.5px] uppercase tracking-wide text-gray-500 border-b border-gray-300 pb-0.5 truncate">
                          {settings.libraryName}
                          {settings.libraryCode ? ` · ${settings.libraryCode}` : ""}
                        </div>

                        {label.callNumber && (
                          <div className="text-[7px]">
                            <span className="text-gray-500">N.Cham.: </span>
                            <span className="font-mono font-semibold">
                              {label.callNumber}
                            </span>
                          </div>
                        )}
                        {label.catalog.authors?.length > 0 && (
                          <div className="text-[6.5px]">
                            <span className="text-gray-500">Autor: </span>
                            <span className="line-clamp-1">
                              {label.catalog.authors.join("; ")}
                            </span>
                          </div>
                        )}
                        <div className="text-[6.5px]">
                          <span className="text-gray-500">Título: </span>
                          <span className="line-clamp-2 font-semibold">
                            {label.catalog.title}
                          </span>
                        </div>

                        <div className="mt-auto pt-0.5">
                          <Barcode39 value={label.barcode} heightMm={5} showText={false} />
                          <div className="text-center font-mono text-[7px] text-gray-900 font-semibold">
                            {label.barcode}
                          </div>
                          <div className="flex justify-between font-mono text-[6px] text-gray-600">
                            <span>Ac.{label.accessionNumber || "—"}</span>
                            <span>Ex.{label.exemplarIndex}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ---------- Só código ---------- */}
                    {label.type === "BARCODE" && (
                      <div className="flex h-full flex-col justify-center">
                        <Barcode39 value={label.barcode} heightMm={8} />
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <button
                onClick={() => window.print()}
                className="no-print w-full bg-green-600 text-white py-3 rounded-lg font-medium hover:bg-green-700"
              >
                🖨️ Imprimir etiquetas
              </button>
              <p className="text-xs text-gray-400 text-center mt-2">
                Desative cabeçalhos e rodapés na impressão. O tamanho da etiqueta é
                respectado — selecione a escala 100%.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

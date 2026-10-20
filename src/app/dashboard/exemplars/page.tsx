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
  internalNote?: string;
  catalog: {
    id: string;
    title: string;
    subtitle?: string;
    titleStatement?: string;
    authors: string[];
    contributors: string[];
    edition?: string;
    publisher?: string;
    publicationPlace?: string;
    publicationYear?: string;
    seriesTitle?: string;
    seriesVolume?: string;
    isbn?: string;
    issn?: string;
    subjects: string[];
    classification?: string;
    cdd?: string;
    cdu?: string;
    callNumber?: string;
    cutterCode?: string;
    physicalDesc?: string;
    generalNote?: string;
    contentNote?: string;
    contentNoteMarc?: any;
    bibReference?: string;
    uniformSeriesTitle?: string;
    tombo?: string;
    coverUrl?: string;
    fixedFields?: string;
    volume?: string;
    number?: string;
    period?: string;
    materialType: string;
    customFields?: any[];
    controlNumber?: string;
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

type ExemplarEdit = Pick<Exemplar, "id" | "accessionNumber" | "barcode" | "callNumber" | "cutterCode" | "status" | "internalNote"> & {
  // Campos do catálogo
  catalogId: string;
  title: string;
  subtitle: string;
  titleStatement: string;
  authors: string;
  contributors: string;
  edition: string;
  publisher: string;
  publicationPlace: string;
  publicationYear: string;
  seriesTitle: string;
  seriesVolume: string;
  isbn: string;
  issn: string;
  subjects: string;
  classification: string;
  cdd: string;
  cdu: string;
  physicalDesc: string;
  generalNote: string;
  contentNote: string;
  contentNoteIndicator1: string;
  contentNoteIndicator2: string;
  contentNoteG: string;
  contentNoteR: string;
  contentNoteT: string;
  bibReference: string;
  uniformSeriesTitle: string;
  tombo: string;
  coverUrl: string;
  fixedFields: string;
  volume: string;
  number: string;
  period: string;
  materialType: string;
  customFields: any[];
};

const emptyEdit = (): ExemplarEdit => ({
  id: "",
  accessionNumber: "",
  barcode: "",
  callNumber: "",
  cutterCode: "",
  status: "AVAILABLE",
  internalNote: "",
  catalogId: "",
  title: "",
  subtitle: "",
  titleStatement: "",
  authors: "",
  contributors: "",
  edition: "",
  publisher: "",
  publicationPlace: "",
  publicationYear: "",
  seriesTitle: "",
  seriesVolume: "",
  isbn: "",
  issn: "",
  subjects: "",
  classification: "",
  cdd: "",
  cdu: "",
  physicalDesc: "",
  generalNote: "",
  contentNote: "",
  contentNoteIndicator1: " ",
  contentNoteIndicator2: " ",
  contentNoteG: "",
  contentNoteR: "",
  contentNoteT: "",
  bibReference: "",
  uniformSeriesTitle: "",
  tombo: "",
  coverUrl: "",
  fixedFields: "",
  volume: "",
  number: "",
  period: "",
  materialType: "BOOK",
  customFields: [],
});

export default function ExemplarsPage() {
  const [exemplars, setExemplars] = useState<Exemplar[]>([]);
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [editing, setEditing] = useState<ExemplarEdit | null>(null);
  const [success, setSuccess] = useState("");

  const deleteExemplar = async (exemplarId: string) => {
    if (!confirm("Tem certeza que deseja excluir este exemplar? Esta ação não pode ser desfeita.")) return;
    setBusyId(exemplarId);
    setError("");
    try {
      const res = await fetch("/api/exemplars", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: exemplarId }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "Erro ao excluir exemplar");
        return;
      }
      setExemplars((prev) => prev.filter((e) => e.id !== exemplarId));
      setSuccess("Exemplar excluído com sucesso.");
    } catch {
      setError("Erro de conexão ao excluir exemplar.");
    } finally {
      setBusyId("");
    }
  };

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

  const openEdit = (exemplar: Exemplar) => {
    setError("");
    setSuccess("");
    
    // Extrai subcampos do contentNoteMarc (MARC 505) de forma segura
    const cnMarc = exemplar.catalog.contentNoteMarc || {};
    const cnSubfields = Array.isArray(cnMarc.subfields) ? cnMarc.subfields : [];
    const getSubfield = (code: string) => cnSubfields.find((f: any) => f.code === code)?.value || '';
    
    setEditing({
      id: exemplar.id,
      accessionNumber: exemplar.accessionNumber || "",
      barcode: exemplar.barcode,
      callNumber: exemplar.callNumber || exemplar.catalog.callNumber || "",
      cutterCode: exemplar.cutterCode || exemplar.catalog.cutterCode || "",
      status: exemplar.status,
      internalNote: exemplar.internalNote || "",
      // Todos os campos do catálogo
      catalogId: exemplar.catalog.id,
      title: exemplar.catalog.title || "",
      subtitle: exemplar.catalog.subtitle || "",
      titleStatement: exemplar.catalog.titleStatement || "",
      authors: Array.isArray(exemplar.catalog.authors) ? exemplar.catalog.authors.join(", ") : "",
      contributors: Array.isArray(exemplar.catalog.contributors) ? exemplar.catalog.contributors.join(", ") : "",
      edition: exemplar.catalog.edition || "",
      publisher: exemplar.catalog.publisher || "",
      publicationPlace: exemplar.catalog.publicationPlace || "",
      publicationYear: exemplar.catalog.publicationYear || "",
      seriesTitle: exemplar.catalog.seriesTitle || "",
      seriesVolume: exemplar.catalog.seriesVolume || "",
      isbn: exemplar.catalog.isbn || "",
      issn: exemplar.catalog.issn || "",
      subjects: Array.isArray(exemplar.catalog.subjects) ? exemplar.catalog.subjects.join(", ") : "",
      classification: exemplar.catalog.classification || "",
      cdd: exemplar.catalog.cdd || "",
      cdu: exemplar.catalog.cdu || "",
      physicalDesc: exemplar.catalog.physicalDesc || "",
      generalNote: exemplar.catalog.generalNote || "",
      contentNote: getSubfield('a') || exemplar.catalog.contentNote || "",
      contentNoteIndicator1: cnMarc.indicator1 || " ",
      contentNoteIndicator2: cnMarc.indicator2 || " ",
      contentNoteG: getSubfield('g'),
      contentNoteR: getSubfield('r'),
      contentNoteT: getSubfield('t'),
      bibReference: exemplar.catalog.bibReference || "",
      uniformSeriesTitle: exemplar.catalog.uniformSeriesTitle || "",
      tombo: exemplar.catalog.tombo || "",
      coverUrl: exemplar.catalog.coverUrl || "",
      fixedFields: exemplar.catalog.fixedFields || "",
      volume: exemplar.catalog.volume || "",
      number: exemplar.catalog.number || "",
      period: exemplar.catalog.period || "",
      materialType: exemplar.catalog.materialType || "BOOK",
      customFields: Array.isArray(exemplar.catalog.customFields) ? exemplar.catalog.customFields : [],
    });
  };

  const saveEdit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editing) return;
    if (!editing.barcode.trim()) {
      setError("O código de barras é obrigatório.");
      return;
    }
    if (!editing.title.trim()) {
      setError("O título é obrigatório.");
      return;
    }
    setBusyId(editing.id);
    setError("");
    
    // Constrói o contentNoteMarc para MARC 505
    const contentNoteMarc = {
      indicator1: editing.contentNoteIndicator1,
      indicator2: editing.contentNoteIndicator2,
      subfields: [
        ["a", editing.contentNote], ["g", editing.contentNoteG], ["r", editing.contentNoteR], ["t", editing.contentNoteT],
      ].filter(([, value]) => Boolean(String(value).trim())).map(([code, value]) => ({ code, value: String(value).trim() })),
    };
    
    const list = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);
    
    try {
      const res = await fetch("/api/exemplars", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...editing,
          authors: list(editing.authors),
          contributors: list(editing.contributors),
          subjects: list(editing.subjects),
          contentNoteMarc,
          customFields: editing.customFields,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "Não foi possível salvar as alterações.");
        return;
      }
      setExemplars((previous) => previous.map((exemplar) =>
        exemplar.id === editing.id ? { ...exemplar, ...data.exemplar, catalog: { ...exemplar.catalog, ...data.catalog } } : exemplar
      ));
      setEditing(null);
      setSuccess("Exemplar e registro bibliográfico atualizados com sucesso.");
    } catch {
      setError("Erro de conexão ao salvar o exemplar.");
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
      {success && (
        <div className="mb-4 p-3 rounded bg-green-100 text-green-700 text-sm">{success}</div>
      )}

      {editing && (
        <form onSubmit={saveEdit} className="mb-4 bg-white rounded-lg shadow p-5 border-l-4 border-primary-600">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <h2 className="font-bold text-gray-900">Editar exemplar e registro bibliográfico</h2>
              <p className="text-sm text-gray-500">Todos os campos são editáveis. Alterações no catálogo afetam todos os exemplares deste título.</p>
            </div>
            <button type="button" onClick={() => setEditing(null)} className="text-sm text-gray-500 hover:text-gray-800">Cancelar</button>
          </div>
          
          {/* Dados do Exemplar */}
          <fieldset className="mb-4 p-3 bg-gray-50 rounded border border-gray-200">
            <legend className="font-bold text-gray-900 mb-3">📦 Dados do Exemplar</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <label className="text-sm text-gray-700">Nº de acervo
                <input value={editing.accessionNumber || ""} onChange={(e) => setEditing({ ...editing, accessionNumber: e.target.value })} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md font-mono" />
              </label>
              <label className="text-sm text-gray-700">Código de barras *
                <input required value={editing.barcode} onChange={(e) => setEditing({ ...editing, barcode: e.target.value })} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md font-mono" />
              </label>
              <label className="text-sm text-gray-700">Status
                <select value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value })} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md">
                  {Object.entries(STATUS_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <label className="text-sm text-gray-700">Número de chamada
                <input value={editing.callNumber || ""} onChange={(e) => setEditing({ ...editing, callNumber: e.target.value })} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md font-mono" />
              </label>
              <label className="text-sm text-gray-700">Código Cutter ou PHA
                <input value={editing.cutterCode || ""} onChange={(e) => setEditing({ ...editing, cutterCode: e.target.value })} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md font-mono" />
              </label>
              <label className="text-sm text-gray-700">Nota interna
                <input value={editing.internalNote || ""} onChange={(e) => setEditing({ ...editing, internalNote: e.target.value })} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md" />
              </label>
            </div>
          </fieldset>

          {/* Dados Bibliográficos - MARC 21 */}
          <fieldset className="mb-4 p-3 bg-blue-50 rounded border border-blue-200">
            <legend className="font-bold text-blue-900 mb-3">📖 Dados Bibliográficos (MARC 21)</legend>
            
            <div className="mb-3">
              <label className="text-sm text-gray-700 block">Tipo de material
                <select value={editing.materialType} onChange={(e) => setEditing({ ...editing, materialType: e.target.value })} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md">
                  <option value="BOOK">📗 Livro</option>
                  <option value="PERIODICAL">📘 Periódico</option>
                  <option value="OTHER">📕 Outro</option>
                </select>
              </label>
            </div>

            <div className="mb-3">
              <label className="text-sm text-gray-700 block">Título principal *
                <input required value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md" placeholder="Título principal" />
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <label className="text-sm text-gray-700">Subtítulo
                <input value={editing.subtitle} onChange={(e) => setEditing({ ...editing, subtitle: e.target.value })} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md" />
              </label>
              <label className="text-sm text-gray-700">Indicação de responsabilidade (245 $c)
                <input value={editing.titleStatement} onChange={(e) => setEditing({ ...editing, titleStatement: e.target.value })} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md" />
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <label className="text-sm text-gray-700">Autor principal (100 $a) — separe por vírgula
                <input value={editing.authors} onChange={(e) => setEditing({ ...editing, authors: e.target.value })} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md" placeholder="Sobrenome, Nome" />
              </label>
              <label className="text-sm text-gray-700">Autoridade secundária (700) — separe por vírgula
                <input value={editing.contributors} onChange={(e) => setEditing({ ...editing, contributors: e.target.value })} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md" placeholder="Silva, João, Santos, Maria" />
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <label className="text-sm text-gray-700">Edição (250 $a)
                <input value={editing.edition} onChange={(e) => setEditing({ ...editing, edition: e.target.value })} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md" placeholder="2ª ed." />
              </label>
              <label className="text-sm text-gray-700">Editora (264 $b)
                <input value={editing.publisher} onChange={(e) => setEditing({ ...editing, publisher: e.target.value })} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md" />
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
              <label className="text-sm text-gray-700">Local (264 $a)
                <input value={editing.publicationPlace} onChange={(e) => setEditing({ ...editing, publicationPlace: e.target.value })} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md" />
              </label>
              <label className="text-sm text-gray-700">Ano (264 $c)
                <input value={editing.publicationYear} onChange={(e) => setEditing({ ...editing, publicationYear: e.target.value })} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md" />
              </label>
              <label className="text-sm text-gray-700">ISBN (020 $a)
                <input value={editing.isbn} onChange={(e) => setEditing({ ...editing, isbn: e.target.value })} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md" />
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
              <label className="text-sm text-gray-700">ISSN (022 $a)
                <input value={editing.issn} onChange={(e) => setEditing({ ...editing, issn: e.target.value })} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md" />
              </label>
              <label className="text-sm text-gray-700">Série (490 $a)
                <input value={editing.seriesTitle} onChange={(e) => setEditing({ ...editing, seriesTitle: e.target.value })} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md" />
              </label>
              <label className="text-sm text-gray-700">Volume da série (490 $v)
                <input value={editing.seriesVolume} onChange={(e) => setEditing({ ...editing, seriesVolume: e.target.value })} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md" />
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
              <label className="text-sm text-gray-700">Assuntos (650) — separe por vírgula
                <input value={editing.subjects} onChange={(e) => setEditing({ ...editing, subjects: e.target.value })} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md" placeholder="Internet, Hackers" />
              </label>
              <label className="text-sm text-gray-700">Classificação (050 $a)
                <input value={editing.classification} onChange={(e) => setEditing({ ...editing, classification: e.target.value })} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md" />
              </label>
              <label className="text-sm text-gray-700">CDD (082 $a)
                <input value={editing.cdd} onChange={(e) => setEditing({ ...editing, cdd: e.target.value })} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md" />
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
              <label className="text-sm text-gray-700">CDU (084 $a)
                <input value={editing.cdu} onChange={(e) => setEditing({ ...editing, cdu: e.target.value })} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md" />
              </label>
              <label className="text-sm text-gray-700">Tombo
                <input value={editing.tombo} onChange={(e) => setEditing({ ...editing, tombo: e.target.value })} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md font-mono" placeholder="Opcional" />
              </label>
              <label className="text-sm text-gray-700">URL da capa (856 $u)
                <input type="url" value={editing.coverUrl} onChange={(e) => setEditing({ ...editing, coverUrl: e.target.value })} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md" placeholder="https://..." />
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <label className="text-sm text-gray-700">Descrição física (300 $a)
                <input value={editing.physicalDesc} onChange={(e) => setEditing({ ...editing, physicalDesc: e.target.value })} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md" placeholder="176 p. ; 21 cm" />
              </label>
              <label className="text-sm text-gray-700">MARC 008 — Campos fixos
                <input value={editing.fixedFields} onChange={(e) => setEditing({ ...editing, fixedFields: e.target.value })} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md font-mono" placeholder="230101s2023    br a     000 0 por d" />
              </label>
            </div>

            <div className="mb-3">
              <label className="text-sm text-gray-700 block">Nota geral (500 $a)
                <textarea value={editing.generalNote} onChange={(e) => setEditing({ ...editing, generalNote: e.target.value })} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md" rows={2} />
              </label>
            </div>

            <div className="mb-3">
              <label className="text-sm text-gray-700 block">Nota de conteúdo / Sumário (MARC 505)
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-2">
                  <label className="text-xs text-gray-500">
                    Indicador 1
                    <select value={editing.contentNoteIndicator1} onChange={(e) => setEditing({ ...editing, contentNoteIndicator1: e.target.value })} className="mt-1 w-full px-2 py-1.5 border border-gray-300 rounded text-xs">
                      <option value=" ">em branco</option><option value="0">0</option><option value="1">1</option><option value="2">2</option><option value="8">8</option>
                    </select>
                  </label>
                  <label className="text-xs text-gray-500">
                    Indicador 2
                    <select value={editing.contentNoteIndicator2} onChange={(e) => setEditing({ ...editing, contentNoteIndicator2: e.target.value })} className="mt-1 w-full px-2 py-1.5 border border-gray-300 rounded text-xs">
                      <option value=" ">em branco</option><option value="0">0</option><option value="1">1</option><option value="2">2</option><option value="8">8</option>
                    </select>
                  </label>
                  <label className="text-xs text-gray-500 col-span-2 sm:col-span-3">
                    $t — Título da parte
                    <input value={editing.contentNoteT} onChange={(e) => setEditing({ ...editing, contentNoteT: e.target.value })} className="mt-1 w-full px-2 py-1.5 border border-gray-300 rounded text-xs" placeholder="Título de capítulo ou obra" />
                  </label>
                </div>
                <textarea value={editing.contentNote} onChange={(e) => setEditing({ ...editing, contentNote: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md" rows={3} placeholder="$a — Nota de conteúdo / sumário" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                  <input value={editing.contentNoteG} onChange={(e) => setEditing({ ...editing, contentNoteG: e.target.value })} className="px-3 py-2 border border-gray-300 rounded-md" placeholder="$g — Informações diversas" />
                  <input value={editing.contentNoteR} onChange={(e) => setEditing({ ...editing, contentNoteR: e.target.value })} className="px-3 py-2 border border-gray-300 rounded-md" placeholder="$r — Declaração de responsabilidade" />
                </div>
                <p className="text-xs text-gray-500 mt-1">Subcampos preenchidos são preservados na exportação MARC.</p>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <label className="text-sm text-gray-700">Referência bibliográfica (510 $a)
                <textarea value={editing.bibReference} onChange={(e) => setEditing({ ...editing, bibReference: e.target.value })} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md" rows={2} />
              </label>
              <label className="text-sm text-gray-700">Título uniforme de série (830 $a)
                <input value={editing.uniformSeriesTitle} onChange={(e) => setEditing({ ...editing, uniformSeriesTitle: e.target.value })} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md" />
              </label>
            </div>

            {/* Periódicos */}
            {editing.materialType === "PERIODICAL" && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3 p-3 bg-purple-50 rounded border border-purple-200">
                <label className="text-sm text-purple-700">Volume (362)
                  <input value={editing.volume} onChange={(e) => setEditing({ ...editing, volume: e.target.value })} className="mt-1 w-full px-3 py-2 border border-purple-300 rounded-md" />
                </label>
                <label className="text-sm text-purple-700">Número (362)
                  <input value={editing.number} onChange={(e) => setEditing({ ...editing, number: e.target.value })} className="mt-1 w-full px-3 py-2 border border-purple-300 rounded-md" />
                </label>
                <label className="text-sm text-purple-700">Frequência (362)
                  <input value={editing.period} onChange={(e) => setEditing({ ...editing, period: e.target.value })} className="mt-1 w-full px-3 py-2 border border-purple-300 rounded-md" placeholder="Mensal" />
                </label>
              </div>
            )}
          </fieldset>

          <div className="mt-4 flex gap-2">
            <button disabled={busyId === editing.id} className="px-5 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50">
              {busyId === editing.id ? "Salvando..." : "💾 Salvar alterações"}
            </button>
            <button type="button" onClick={() => setEditing(null)} className="px-5 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50">Cancelar</button>
            <button
              type="button"
              onClick={() => deleteExemplar(editing.id)}
              disabled={busyId === editing.id}
              className="px-5 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
            >
              🗑️ Excluir exemplar
            </button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              {["Acervo", "Ex.", "Tombo", "Cód. barras", "Chamada", "Título", "Status", "Ações"].map(
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
                    <div className="flex items-center gap-2">
                      <select value={ex.status} disabled={busyId === ex.id} onChange={(e) => changeStatus(ex, e.target.value)} className="text-xs px-2 py-1 border border-gray-300 rounded disabled:opacity-50">
                        {EDITABLE.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                      </select>
                      <button type="button" onClick={() => openEdit(ex)} className="text-xs px-3 py-1.5 rounded bg-primary-100 text-primary-700 hover:bg-primary-200 whitespace-nowrap">✏️ Editar</button>
                      <button
                        type="button"
                        onClick={() => deleteExemplar(ex.id)}
                        disabled={busyId === ex.id}
                        className="text-xs px-3 py-1.5 rounded bg-red-100 text-red-700 hover:bg-red-200 whitespace-nowrap disabled:opacity-50"
                      >
                        🗑️ Excluir
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

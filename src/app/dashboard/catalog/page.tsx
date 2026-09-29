// ============================================
// BiblioGest - Catalogação (Dashboard)
// Formulário MARC 21/RDA com:
//  · consulta interna antes de inserir
//  · MARC 001 e número de acervo gerados pelo sistema
//  · status inicial do exemplar
// ============================================

"use client";

import { useState, useCallback } from "react";
import Link from "next/link";

interface CustomField {
  tag: string;
  name: string;
  value: string;
}

const EMPTY = {
  materialType: "BOOK",
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
  tombo: "",
  coverUrl: "",
  physicalDesc: "",
  generalNote: "",
  bibReference: "",
  uniformSeriesTitle: "",
  callNumber: "",
  cutterCode: "",
  totalCopies: 1,
  volume: "",
  number: "",
  period: "",
  exemplarStatus: "AVAILABLE",
};

const STATUS_OPTIONS = [
  { value: "AVAILABLE", label: "✅ Disponível — aparece no catálogo público" },
  { value: "PROCESSING", label: "🔄 Em processamento — ainda não circula" },
  { value: "RESTORATION", label: "🛠️ Em restauro — aguardando conservação" },
  { value: "MAINTENANCE", label: "🔧 Em manutenção" },
];

interface Found {
  id: string;
  title: string;
  subtitle?: string;
  controlNumber?: string;
  authors: string[];
  publisher?: string;
  publicationYear?: string;
  isbn?: string;
  callNumber?: string;
  cutterCode?: string;
  classification?: string;
  _count?: { exemplars: number };
  exemplars?: Array<{ id: string; barcode: string; accessionNumber?: string; status: string }>;
}

const field =
  "w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500";
const label = "block text-sm font-medium text-gray-700 mb-1";

export default function CatalogPage() {
  const [form, setForm] = useState({ ...EMPTY });
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [newField, setNewField] = useState<CustomField>({ tag: "", name: "", value: "" });

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [created, setCreated] = useState<{ controlNumber: string; exemplars: any[] } | null>(null);

  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [found, setFound] = useState<Found[]>([]);
  const [searched, setSearched] = useState(false);

  const set = (k: string, v: string | number) => setForm((f) => ({ ...f, [k]: v }));
  const list = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);

  // ---------- Consulta interna ----------
  const internalSearch = useCallback(async () => {
    if (!query.trim()) return;
    setSearching(true);
    setError("");
    setFound([]);
    try {
      const res = await fetch(`/api/catalog?q=${encodeURIComponent(query.trim())}&limit=10`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Erro na consulta");
        return;
      }
      setFound(data.catalogs || []);
      setSearched(true);
    } catch {
      setError("Erro de conexão");
    } finally {
      setSearching(false);
    }
  }, [query]);

  const addCustomField = () => {
    if (newField.tag && newField.value) {
      setCustomFields((p) => [...p, { ...newField }]);
      setNewField({ tag: "", name: "", value: "" });
    }
  };

  const resetForm = () => {
    setForm({ ...EMPTY });
    setCustomFields([]);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setCreated(null);

    if (!form.title.trim()) {
      setError("O título é obrigatório");
      return;
    }
    if (!form.callNumber.trim()) {
      setError("Informe o número de chamada com a classificação (ex.: 004.67 M278)");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/catalog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          authors: list(form.authors),
          contributors: list(form.contributors),
          subjects: list(form.subjects),
          totalCopies: Number(form.totalCopies) || 1,
          customFields,
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || "Erro ao catalogar");
        return;
      }

      setCreated({
        controlNumber: data.catalog.controlNumber,
        exemplars: data.exemplars || [],
      });
      setMessage("Item catalogado com sucesso");
      resetForm();
    } catch {
      setError("Erro de conexão");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl">
      <div className="flex items-center gap-3 mb-2">
        <Link href="/dashboard" className="text-gray-500 hover:text-gray-700 text-sm">
          ← Painel
        </Link>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">📖 Catalogação</h1>
      </div>
      <p className="text-sm text-gray-500 mb-6">
        Antes de inserir, faça a consulta interna para não duplicar registros.
      </p>

      {/* ---------- Consulta interna ---------- */}
      <section className="bg-white rounded-lg shadow p-4 mb-6 border-l-4 border-primary-500">
        <h2 className="font-bold text-primary-700 mb-2">
          🔍 Consulta interna (somente staff)
        </h2>
        <div className="flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && internalSearch()}
            placeholder="Título, autor, ISBN, nº de acervo..."
            className={field}
          />
          <button
            onClick={internalSearch}
            disabled={searching || !query.trim()}
            className="px-5 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50 whitespace-nowrap"
          >
            {searching ? "..." : "Consultar"}
          </button>
          {searched && (
            <button
              onClick={() => {
                setFound([]);
                setSearched(false);
                setQuery("");
              }}
              className="px-3 text-gray-500 hover:text-gray-700"
            >
              Limpar
            </button>
          )}
        </div>

        {searched && (
          <div className="mt-3">
            {found.length === 0 ? (
              <p className="text-sm text-gray-500 py-2">
                Nenhum registro encontrado. Pode seguir com a catalogação.
              </p>
            ) : (
              <>
                <p className="text-xs text-amber-700 bg-amber-50 px-3 py-1.5 rounded mb-2">
                  ⚠️ Já existe {found.length} registro(s) parecido(s). Se for o mesmo
                  item, use a opção de inserir novo exemplar no registro encontrado.
                </p>
                <ul className="divide-y divide-gray-100 border border-gray-200 rounded-md max-h-60 overflow-y-auto">
                  {found.map((c) => (
                    <li key={c.id} className="p-3 hover:bg-gray-50">
                      <p className="text-sm font-medium text-gray-900">
                        {c.title}
                        {c.subtitle ? ` : ${c.subtitle}` : ""}
                      </p>
                      <p className="text-xs text-gray-500">
                        {c.authors?.join(", ")} · {c.publisher} · {c.publicationYear}
                      </p>
                      <p className="text-xs text-gray-400 font-mono mt-0.5">
                        ISBN {c.isbn || "—"} · controle {c.controlNumber || "—"} ·{" "}
                        {c.callNumber || "—"} {c.cutterCode || ""} ·{" "}
                        {c._count?.exemplars ?? 0} exemplar(es)
                      </p>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
      </section>

      {/* ---------- Resultado da inserção ---------- */}
      {created && (
        <div className="mb-6 p-4 rounded-lg bg-green-50 border border-green-200">
          <p className="font-semibold text-green-900 mb-1">
            ✅ MARC 001 (controle): {created.controlNumber}
          </p>
          <p className="text-sm text-green-800">
            {created.exemplars.length} exemplar(es) gerado(s):
          </p>
          <ul className="text-xs font-mono text-green-700 mt-1 space-y-0.5">
            {created.exemplars.map((e) => (
              <li key={e.id}>
                acervo {e.accessionNumber} · código {e.barcode} · {e.status}
              </li>
            ))}
          </ul>
          <Link
            href="/dashboard/labels"
            className="inline-block mt-2 text-sm text-primary-700 hover:underline"
          >
            🏷️ Ir para gerar as etiquetas →
          </Link>
        </div>
      )}

      {message && (
        <div className="mb-4 p-3 rounded bg-green-100 text-green-700 text-sm">
          {message}
        </div>
      )}
      {error && (
        <div className="mb-4 p-3 rounded bg-red-100 text-red-700 text-sm">{error}</div>
      )}

      {/* ---------- Formulário ---------- */}
      <form onSubmit={submit} className="bg-white rounded-lg shadow p-6 space-y-6">
        {/* Tipo e quantidade */}
        <section className="border-l-4 border-gray-400 pl-4">
          <h2 className="font-bold text-gray-700 mb-3">Tipo de material</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={label}>Material</label>
              <select
                value={form.materialType}
                onChange={(e) => set("materialType", e.target.value)}
                className={field}
              >
                <option value="BOOK">📗 Livro</option>
                <option value="PERIODICAL">📘 Periódico</option>
                <option value="OTHER">📕 Outro</option>
              </select>
            </div>
            <div>
              <label className={label}>Nº de exemplares</label>
              <input
                type="number"
                min={1}
                value={form.totalCopies}
                onChange={(e) => set("totalCopies", e.target.value)}
                className={field}
              />
            </div>
            <div>
              <label className={label}>Status inicial do exemplar</label>
              <select
                value={form.exemplarStatus}
                onChange={(e) => set("exemplarStatus", e.target.value)}
                className={field}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* 245 */}
        <section className="border-l-4 border-green-500 pl-4">
          <h2 className="font-bold text-green-700 mb-3">
            Descrição — MARC 245
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className={label}>Título principal *</label>
              <input
                required
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
                className={field}
                placeholder="Manifesto Cypherpunks"
              />
            </div>
            <div>
              <label className={label}>
                Imagem da capa{" "}
                <span className="text-gray-400 font-normal">(opcional)</span>
              </label>
              <input
                type="url"
                value={form.coverUrl}
                onChange={(e) => set("coverUrl", e.target.value)}
                className={field}
                placeholder="https://.../capa.jpg"
              />
              <p className="text-xs text-gray-500 mt-1">
                Cole o link de uma imagem já hospedada. Não é feito upload de
                arquivo.
              </p>
              {form.coverUrl && (
                // Imagem externa: next/image exigiria domínios permitidos,
                // então usa-se <img> com a URL validada no servidor.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={form.coverUrl}
                  alt="Pré-visualização da capa"
                  className="mt-2 h-28 w-auto rounded border border-gray-200 object-contain"
                />
              )}
            </div>
            <div>
              <label className={label}>Subtítulo</label>
              <input
                value={form.subtitle}
                onChange={(e) => set("subtitle", e.target.value)}
                className={field}
              />
            </div>
            <div>
              <label className={label}>Indicação de responsabilidade (245 $c)</label>
              <input
                value={form.titleStatement}
                onChange={(e) => set("titleStatement", e.target.value)}
                className={field}
              />
            </div>
          </div>
        </section>

        {/* 100 / 700 */}
        <section className="border-l-4 border-blue-500 pl-4">
          <h2 className="font-bold text-blue-700 mb-3">
            Responsáveis — MARC 100 / 700
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={label}>Autor principal (100 $a) — separe por vírgula</label>
              <input
                value={form.authors}
                onChange={(e) => set("authors", e.target.value)}
                className={field}
                placeholder="Foleetto, Leonardo"
              />
            </div>
            <div>
              <label className={label}>Autor secundário (700)</label>
              <input
                value={form.contributors}
                onChange={(e) => set("contributors", e.target.value)}
                className={field}
              />
            </div>
          </div>
        </section>

        {/* Classificação e chamada */}
        <section className="border-l-4 border-teal-500 pl-4">
          <h2 className="font-bold text-teal-700 mb-1">
            Classificação e localização
          </h2>
          <p className="text-xs text-gray-500 mb-3">
            No Koha o número de chamada é obrigatório e identifica a localização do
            item na estante. Formato: classificação + código Cutter (ex.: 004.67 M278).
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={label}>Número de chamada (classificação) *</label>
              <input
                value={form.callNumber}
                onChange={(e) => set("callNumber", e.target.value)}
                className={field}
                placeholder="004.67"
              />
            </div>
            <div>
              <label className={label}>Código Cutter (gerado se vazio)</label>
              <input
                value={form.cutterCode}
                onChange={(e) => set("cutterCode", e.target.value)}
                className={field}
                placeholder="M278"
              />
            </div>
            <div>
              <label className={label}>Classificação CDD</label>
              <input
                value={form.cdd}
                onChange={(e) => set("cdd", e.target.value)}
                className={field}
              />
            </div>
            <div>
              <label className={label}>Classificação CDU</label>
              <input
                value={form.cdu}
                onChange={(e) => set("cdu", e.target.value)}
                className={field}
              />
            </div>
            <div>
              <label className={label}>
                Número de tombo{" "}
                <span className="text-gray-400 font-normal">(opcional)</span>
              </label>
              <input
                value={form.tombo}
                onChange={(e) => set("tombo", e.target.value)}
                className={field}
                placeholder="Somente se já existir tombo"
              />
              <p className="text-xs text-gray-500 mt-1">
                Preencha apenas se o item já tiver tombo afixado antes da
                informatização. Deixe vazio nos demais casos — o número de
                acervo é gerado pelo sistema.
              </p>
            </div>
          </div>
          {form.callNumber && (
            <p className="mt-3 text-xs text-teal-700 bg-teal-50 px-3 py-2 rounded">
              A etiqueta de lombada será impressa como:{" "}
              <strong className="font-mono">
                {form.callNumber}
                {form.cutterCode ? ` ${form.cutterCode}` : ""}
              </strong>
            </p>
          )}
        </section>

        {/* 250 / 260 / 264 / 490 */}
        <section className="border-l-4 border-purple-500 pl-4">
          <h2 className="font-bold text-purple-700 mb-3">
            Publicação e série — MARC 250, 260/264, 490
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={label}>Edição</label>
              <input
                value={form.edition}
                onChange={(e) => set("edition", e.target.value)}
                className={field}
                placeholder="2ª ed."
              />
            </div>
            <div>
              <label className={label}>Editora (264 $b)</label>
              <input
                value={form.publisher}
                onChange={(e) => set("publisher", e.target.value)}
                className={field}
              />
            </div>
            <div>
              <label className={label}>Local (264 $a)</label>
              <input
                value={form.publicationPlace}
                onChange={(e) => set("publicationPlace", e.target.value)}
                className={field}
              />
            </div>
            <div>
              <label className={label}>Ano (264 $c)</label>
              <input
                value={form.publicationYear}
                onChange={(e) => set("publicationYear", e.target.value)}
                className={field}
              />
            </div>
            <div>
              <label className={label}>Série (490 $a)</label>
              <input
                value={form.seriesTitle}
                onChange={(e) => set("seriesTitle", e.target.value)}
                className={field}
              />
            </div>
            <div>
              <label className={label}>Volume da série (490 $v)</label>
              <input
                value={form.seriesVolume}
                onChange={(e) => set("seriesVolume", e.target.value)}
                className={field}
              />
            </div>
          </div>
        </section>

        {/* 020 / 022 / 650 */}
        <section className="border-l-4 border-yellow-500 pl-4">
          <h2 className="font-bold text-yellow-700 mb-3">
            Identificadores e assuntos — MARC 020, 022, 650
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={label}>ISBN (020 $a)</label>
              <input
                value={form.isbn}
                onChange={(e) => set("isbn", e.target.value)}
                className={field}
              />
            </div>
            <div>
              <label className={label}>ISSN (022 $a)</label>
              <input
                value={form.issn}
                onChange={(e) => set("issn", e.target.value)}
                className={field}
              />
            </div>
            <div className="md:col-span-2">
              <label className={label}>Assuntos (650) — separe por vírgula</label>
              <input
                value={form.subjects}
                onChange={(e) => set("subjects", e.target.value)}
                className={field}
                placeholder="Internet, Hakers"
              />
            </div>
          </div>
        </section>

        {/* 300 / 500 / 510 / 830 */}
        <section className="border-l-4 border-gray-500 pl-4">
          <h2 className="font-bold text-gray-600 mb-3">
            Notas e descrição física — MARC 300, 500, 510, 830
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={label}>Descrição física (300 $a)</label>
              <input
                value={form.physicalDesc}
                onChange={(e) => set("physicalDesc", e.target.value)}
                className={field}
                placeholder="176 p. ; 21 cm"
              />
            </div>
            <div>
              <label className={label}>Título uniforme de série (830 $a)</label>
              <input
                value={form.uniformSeriesTitle}
                onChange={(e) => set("uniformSeriesTitle", e.target.value)}
                className={field}
              />
            </div>
            <div>
              <label className={label}>Nota geral (500 $a)</label>
              <textarea
                rows={2}
                value={form.generalNote}
                onChange={(e) => set("generalNote", e.target.value)}
                className={field}
              />
            </div>
            <div>
              <label className={label}>Referência bibliográfica (510 $a)</label>
              <textarea
                rows={2}
                value={form.bibReference}
                onChange={(e) => set("bibReference", e.target.value)}
                className={field}
              />
            </div>
          </div>
        </section>

        {/* Periódico 362 */}
        {form.materialType === "PERIODICAL" && (
          <section className="border-l-4 border-red-500 pl-4">
            <h2 className="font-bold text-red-700 mb-3">Periódico — MARC 362</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className={label}>Volume</label>
                <input
                  value={form.volume}
                  onChange={(e) => set("volume", e.target.value)}
                  className={field}
                />
              </div>
              <div>
                <label className={label}>Número</label>
                <input
                  value={form.number}
                  onChange={(e) => set("number", e.target.value)}
                  className={field}
                />
              </div>
              <div>
                <label className={label}>Frequência</label>
                <input
                  value={form.period}
                  onChange={(e) => set("period", e.target.value)}
                  className={field}
                  placeholder="Mensal"
                />
              </div>
            </div>
          </section>
        )}

        {/* Campos MARC extras */}
        <section className="border-2 border-dashed border-gray-300 rounded-lg p-4">
          <h3 className="font-bold text-gray-700 mb-3">
            ➕ Campos MARC extras (opcional)
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <input
              placeholder="Tag (ex.: 246)"
              value={newField.tag}
              onChange={(e) => setNewField({ ...newField, tag: e.target.value })}
              className={field}
            />
            <input
              placeholder="Nome do campo"
              value={newField.name}
              onChange={(e) => setNewField({ ...newField, name: e.target.value })}
              className={field}
            />
            <input
              placeholder="Valor"
              value={newField.value}
              onChange={(e) => setNewField({ ...newField, value: e.target.value })}
              className={field}
            />
          </div>
          <button
            type="button"
            onClick={addCustomField}
            className="mt-2 px-4 py-1.5 bg-green-100 text-green-700 rounded text-sm hover:bg-green-200"
          >
            Adicionar campo
          </button>
          {customFields.length > 0 && (
            <ul className="mt-3 space-y-1">
              {customFields.map((c, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between bg-gray-50 px-3 py-1.5 rounded text-sm"
                >
                  <span>
                    <strong>{c.tag}</strong> {c.name && `(${c.name})`}: {c.value}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setCustomFields((p) => p.filter((_, x) => x !== i))
                    }
                    className="text-red-500 hover:text-red-700"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => {
              resetForm();
              setMessage("");
              setError("");
            }}
            className="px-5 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
          >
            Limpar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-primary-600 text-white py-2.5 rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50"
          >
            {loading ? "Catalogando..." : "💾 Catalogar e gerar exemplares"}
          </button>
        </div>
      </form>
    </div>
  );
}

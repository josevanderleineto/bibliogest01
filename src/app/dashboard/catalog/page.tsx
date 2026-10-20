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
  contentNote: "",
  contentNoteIndicator1: " ",
  contentNoteIndicator2: " ",
  contentNoteG: "",
  contentNoteR: "",
  contentNoteT: "",
  bibReference: "",
  uniformSeriesTitle: "",
  callNumber: "",
  cutterCode: "",
  totalCopies: 1,
  volume: "",
  number: "",
  period: "",
  exemplarStatus: "AVAILABLE",
  fixedFields: "", // MARC 008 - elementos de tamanho fixo

  // Catalogação cooperativa
  importMode: false,
  fromLibrary: "",
  marcData: "",
  tagsInicial: "&lt;inicio&gt;",
  tagsFinal: "&lt;fim&gt;",
  overwriteImport: true,
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
const labelWithHint = (hint: string) => `block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1${hint}`;

export default function CatalogPage() {
  const [form, setForm] = useState({ ...EMPTY });
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [newField, setNewField] = useState<CustomField>({ tag: "", name: "", value: "" });

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [created, setCreated] = useState<{ controlNumber: string; exemplars: any[] } | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editingRecord, setEditingRecord] = useState<{
    id: string;
    controlNumber: string;
    exemplars: any[];
  } | null>(null);
  const [editLoading, setEditLoading] = useState(false);

  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [found, setFound] = useState<Found[]>([]);
  const [searched, setSearched] = useState(false);

  const set = (k: string, v: string | number | boolean) => setForm((f) => ({ ...f, [k]: v }));
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

  const loadRecordForEdit = useCallback(async (controlNumber: string) => {
    setEditLoading(true);
    setError('');
    try {
      const res = await fetch('/api/catalog?controlNumber=' + controlNumber);
      const data = await res.json();
      if (res.ok && data.catalogs && data.catalogs.length > 0) {
        const catalog = data.catalogs[0];
        
        // Extrai subcampos do contentNoteMarc (MARC 505) de forma segura
        const cnMarc = catalog.contentNoteMarc || {};
        const cnSubfields = Array.isArray(cnMarc.subfields) ? cnMarc.subfields : [];
        const getSubfield = (code: string) => cnSubfields.find((f: any) => f.code === code)?.value || '';
        
        // Determina o status inicial do exemplar baseado no primeiro exemplar existente
        const firstExemplarStatus = catalog.exemplars?.[0]?.status || 'AVAILABLE';
        
        // Preenche TODOS os campos do formulário com dados do banco
        setForm({
          ...EMPTY,
          // Identificação e tipo
          materialType: catalog.materialType || 'BOOK',
          title: catalog.title || '',
          subtitle: catalog.subtitle || '',
          titleStatement: catalog.titleStatement || '',
          
          // Responsáveis
          authors: Array.isArray(catalog.authors) ? catalog.authors.join(', ') : '',
          contributors: Array.isArray(catalog.contributors) ? catalog.contributors.join(', ') : '',
          
          // Publicação
          edition: catalog.edition || '',
          publisher: catalog.publisher || '',
          publicationPlace: catalog.publicationPlace || '',
          publicationYear: catalog.publicationYear || '',
          seriesTitle: catalog.seriesTitle || '',
          seriesVolume: catalog.seriesVolume || '',
          
          // Identificadores
          isbn: catalog.isbn || '',
          issn: catalog.issn || '',
          subjects: Array.isArray(catalog.subjects) ? catalog.subjects.join(', ') : '',
          
          // Classificação
          classification: catalog.classification || '',
          cdd: catalog.cdd || '',
          cdu: catalog.cdu || '',
          callNumber: catalog.callNumber || '',
          cutterCode: catalog.cutterCode || '',
          
          // Descrição física e notas
          physicalDesc: catalog.physicalDesc || '',
          fixedFields: catalog.fixedFields || '',
          generalNote: catalog.generalNote || '',
          bibReference: catalog.bibReference || '',
          uniformSeriesTitle: catalog.uniformSeriesTitle || '',
          
          // MARC 505 - Nota de conteúdo / Sumário (com indicadores e subcampos)
          contentNote: getSubfield('a') || catalog.contentNote || '',
          contentNoteIndicator1: cnMarc.indicator1 || ' ',
          contentNoteIndicator2: cnMarc.indicator2 || ' ',
          contentNoteG: getSubfield('g'),
          contentNoteR: getSubfield('r'),
          contentNoteT: getSubfield('t'),
          
          // Operacionais
          tombo: catalog.tombo || '',
          coverUrl: catalog.coverUrl || '',
          totalCopies: catalog.totalCopies || 1,
          exemplarStatus: firstExemplarStatus,
          
          // Periódicos (MARC 362)
          volume: catalog.volume || '',
          number: catalog.number || '',
          period: catalog.period || '',
          
          // Campos de importação (preservados para re-exportação)
          importMode: false,
          fromLibrary: catalog.importSource || '',
          marcData: catalog.importMarcData || '',
          tagsInicial: '<inicio>',
          tagsFinal: '<fim>',
          overwriteImport: true,
        });
        
        setEditingRecord({
          id: catalog.id,
          controlNumber: catalog.controlNumber,
          exemplars: catalog.exemplars || [],
        });
        setCustomFields(Array.isArray(catalog.customFields) ? catalog.customFields : []);
        setEditMode(true);
        setMessage('Registro carregado para edição. Todos os campos foram preenchidos.');
      } else {
        setError('Registro não encontrado');
      }
    } catch {
      setError('Erro de conexão ao carregar registro');
    } finally {
      setEditLoading(false);
    }
  }, []);

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

  // ---------- Catalogação Cooperativa ----------
  const [exportToLibrary, setExportToLibrary] = useState("");
  const [exportFormat, setExportFormat] = useState<"marc" | "json">("marc");
  const [exportTagInicial, setExportTagInicial] = useState("&lt;inicio&gt;");
  const [exportTagFinal, setExportTagFinal] = useState("&lt;fim&gt;");
  const [exportResult, setExportResult] = useState("");

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


    // Se modo edição, faz PUT em vez de POST
    const isEdit = editMode && editingRecord;
    if (isEdit) {
      setLoading(true);
      try {
        const { importMode, fromLibrary, marcData, tagsInicial, tagsFinal, overwriteImport, ...formData } = form;
        const contentNoteMarc = {
          indicator1: form.contentNoteIndicator1,
          indicator2: form.contentNoteIndicator2,
          subfields: [
            ["a", form.contentNote], ["g", form.contentNoteG], ["r", form.contentNoteR], ["t", form.contentNoteT],
          ].filter(([, value]) => Boolean(String(value).trim())).map(([code, value]) => ({ code, value: String(value).trim() })),
        };
        const res = await fetch("/api/catalog", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editingRecord.id,
            ...formData,
            authors: list(formData.authors),
            contributors: list(formData.contributors),
            subjects: list(formData.subjects),
            totalCopies: Number(formData.totalCopies) || 1,
            customFields,
            contentNoteMarc,
            exemplars: editingRecord.exemplars,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          setError(data.error || "Erro ao atualizar registro");
          return;
        }
        setMessage("Registro e exemplares atualizados com sucesso");
        setEditMode(false);
        setEditingRecord(null);
        resetForm();
      } catch {
        setError("Erro de conexão ao atualizar registro");
      } finally {
        setLoading(false);
      }
      return;
    }
setLoading(true);
    try {
      // Exclui campos de UI da importação/exportação
      const { importMode, fromLibrary, marcData, tagsInicial, tagsFinal, overwriteImport, ...formData } = form;
      const contentNoteMarc = {
        indicator1: form.contentNoteIndicator1,
        indicator2: form.contentNoteIndicator2,
        subfields: [
          ["a", form.contentNote], ["g", form.contentNoteG], ["r", form.contentNoteR], ["t", form.contentNoteT],
        ].filter(([, value]) => Boolean(String(value).trim())).map(([code, value]) => ({ code, value: String(value).trim() })),
      };
      const res = await fetch("/api/catalog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          authors: list(formData.authors),
          contributors: list(formData.contributors),
          subjects: list(formData.subjects),
          totalCopies: Number(formData.totalCopies) || 1,
          customFields,
          contentNoteMarc,
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
                                        <button
                      type="button"
                      onClick={() => c.controlNumber && loadRecordForEdit(c.controlNumber)}
                      className="ml-2 text-xs text-primary-600 hover:underline"
                    >
                      ✏️ Editar
                    </button></li>
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
      {editMode && editingRecord && (
        <div className="mb-4 p-3 rounded bg-blue-50 border border-blue-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-blue-800 font-medium">✏️ Modo Edição</span>
              <span className="text-sm text-blue-600 px-2 py-0.5 bg-blue-100 rounded">
                Controle: {editingRecord.controlNumber}
              </span>
              <span className="text-sm text-blue-600 px-2 py-0.5 bg-blue-100 rounded">
                {editingRecord.exemplars.length} exemplar(es)
              </span>
            </div>
            <button
              type="button"
              onClick={() => { setEditMode(false); setEditingRecord(null); setForm({ ...EMPTY }); setMessage(''); }}
              className="text-sm text-blue-600 hover:underline"
            >
              Cancelar edição
            </button>
          </div>
        </div>
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
              <label className={label}>Autoridade secundária (700) — Separe por vírgula.</label>
              <input
                value={form.contributors}
                onChange={(e) => set("contributors", e.target.value)}
                className={field}
                placeholder="Silva, João, Santos, Maria"
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
              <label className={label}>Código Cutter ou PHA</label>
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

        {/* 300 / 500 / 505 / 510 / 830 / 008 */}
        <section className="border-l-4 border-gray-500 pl-4">
          <h2 className="font-bold text-gray-600 mb-3">
            Notas e descrição física — MARC 300, 500, 505, 510, 830, 008
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
              <label className={label}>MARC 008 — Campos fixos (fixedFields)</label>
              <input
                value={form.fixedFields}
                onChange={(e) => set("fixedFields", e.target.value)}
                className={field}
                placeholder="Ex.: 230101s2023    br a     000 0 por d"
              />
              <p className="text-xs text-gray-500 mt-1">
                Elementos de tamanho fixo (Leader + 008). Gerado automaticamente se vazio.
              </p>
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
            <div className="md:col-span-2">
              <label className={label}>Nota de conteúdo / Sumário (MARC 505)</label>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-2">
                <label className="text-xs text-gray-500">
                  Indicador 1
                  <select value={form.contentNoteIndicator1} onChange={(e) => set("contentNoteIndicator1", e.target.value)} className={field}>
                    <option value=" ">em branco</option><option value="0">0</option><option value="1">1</option><option value="2">2</option><option value="8">8</option>
                  </select>
                </label>
                <label className="text-xs text-gray-500">
                  Indicador 2
                  <select value={form.contentNoteIndicator2} onChange={(e) => set("contentNoteIndicator2", e.target.value)} className={field}>
                    <option value=" ">em branco</option><option value="0">0</option><option value="1">1</option><option value="2">2</option><option value="8">8</option>
                  </select>
                </label>
                <label className="text-xs text-gray-500 col-span-2 sm:col-span-3">
                  $t — Título da parte
                  <input value={form.contentNoteT} onChange={(e) => set("contentNoteT", e.target.value)} className={field} placeholder="Título de capítulo ou obra" />
                </label>
              </div>
              <textarea
                rows={3}
                value={form.contentNote}
                onChange={(e) => set("contentNote", e.target.value)}
                className={field}
                placeholder="$a — Nota de conteúdo / sumário"
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                <input value={form.contentNoteG} onChange={(e) => set("contentNoteG", e.target.value)} className={field} placeholder="$g — Informações diversas" />
                <input value={form.contentNoteR} onChange={(e) => set("contentNoteR", e.target.value)} className={field} placeholder="$r — Declaração de responsabilidade" />
              </div>
              <p className="text-xs text-gray-500 mt-1">Os subcampos preenchidos são preservados na exportação MARC.</p>
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

        {/* ---------- Exemplares (apenas no modo edição) ---------- */}
        {editMode && editingRecord && (
          <section className="border-l-4 border-orange-500 pl-4 bg-orange-50 rounded-r-lg">
            <h2 className="font-bold text-orange-700 mb-3 flex items-center gap-2">
              📦 Exemplares do Registro ({editingRecord.exemplars.length})
            </h2>
            <p className="text-xs text-orange-600 mb-4">
              Cada exemplar tem seu próprio número de acervo e código de barras. Edite os campos abaixo e salve o registro para aplicar as alterações.
            </p>
            <div className="space-y-3">
              {editingRecord.exemplars.map((ex: any, idx: number) => (
                <div
                  key={ex.id}
                  className="bg-white p-4 rounded border border-orange-200 shadow-sm"
                >
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium text-orange-800">Exemplar {ex.exemplarNumber || idx + 1}</h4>
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                      ex.status === 'AVAILABLE' ? 'bg-green-100 text-green-700' :
                      ex.status === 'LOANED' ? 'bg-yellow-100 text-yellow-700' :
                      ex.status === 'PROCESSING' ? 'bg-blue-100 text-blue-700' :
                      ex.status === 'MAINTENANCE' ? 'bg-gray-100 text-gray-700' :
                      ex.status === 'RESTORATION' ? 'bg-purple-100 text-purple-700' :
                      ex.status === 'LOST' ? 'bg-red-100 text-red-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {ex.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Nº Acervo</label>
                      <input
                        type="text"
                        value={ex.accessionNumber || ''}
                        onChange={(e) => {
                          const updated = [...editingRecord.exemplars];
                          updated[idx] = { ...updated[idx], accessionNumber: e.target.value };
                          setEditingRecord({ ...editingRecord, exemplars: updated });
                        }}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-orange-500 font-mono"
                        placeholder="Ex: 000123"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Código de Barras</label>
                      <input
                        type="text"
                        value={ex.barcode || ''}
                        onChange={(e) => {
                          const updated = [...editingRecord.exemplars];
                          updated[idx] = { ...updated[idx], barcode: e.target.value };
                          setEditingRecord({ ...editingRecord, exemplars: updated });
                        }}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-orange-500 font-mono"
                        placeholder="Ex: 000123"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Nº Chamada</label>
                      <input
                        type="text"
                        value={ex.callNumber || form.callNumber || ''}
                        onChange={(e) => {
                          const updated = [...editingRecord.exemplars];
                          updated[idx] = { ...updated[idx], callNumber: e.target.value };
                          setEditingRecord({ ...editingRecord, exemplars: updated });
                        }}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-orange-500 font-mono"
                        placeholder="Ex: 354.8151"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Código Cutter ou PHA</label>
                      <input
                        type="text"
                        value={ex.cutterCode || form.cutterCode || ''}
                        onChange={(e) => {
                          const updated = [...editingRecord.exemplars];
                          updated[idx] = { ...updated[idx], cutterCode: e.target.value };
                          setEditingRecord({ ...editingRecord, exemplars: updated });
                        }}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-orange-500 font-mono"
                        placeholder="Ex: S580"
                      />
                    </div>
                    <div className="sm:col-span-2 lg:col-span-1">
                      <label className="block text-xs text-gray-500 mb-1">Status</label>
                      <select
                        value={ex.status || 'AVAILABLE'}
                        onChange={(e) => {
                          const updated = [...editingRecord.exemplars];
                          updated[idx] = { ...updated[idx], status: e.target.value };
                          setEditingRecord({ ...editingRecord, exemplars: updated });
                        }}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-orange-500"
                      >
                        <option value="AVAILABLE">✅ Disponível</option>
                        <option value="LOANED">📚 Emprestado</option>
                        <option value="PROCESSING">🔄 Em processamento</option>
                        <option value="MAINTENANCE">🔧 Em manutenção</option>
                        <option value="RESTORATION">🛠️ Em restauro</option>
                        <option value="LOST">❌ Perdido</option>
                      </select>
                    </div>
                    <div className="sm:col-span-2 lg:col-span-3">
                      <label className="block text-xs text-gray-500 mb-1">Nota Interna</label>
                      <input
                        type="text"
                        value={ex.internalNote || ''}
                        onChange={(e) => {
                          const updated = [...editingRecord.exemplars];
                          updated[idx] = { ...updated[idx], internalNote: e.target.value };
                          setEditingRecord({ ...editingRecord, exemplars: updated });
                        }}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-orange-500"
                        placeholder="Observações internas sobre este exemplar..."
                      />
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-gray-100 flex gap-2">
                    <Link
                      href={`/dashboard/labels?exemplar=${ex.id}`}
                      className="text-xs bg-orange-100 text-orange-700 px-3 py-1.5 rounded hover:bg-orange-200"
                      target="_blank"
                    >
                      🏷️ Etiqueta deste exemplar
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        const updated = editingRecord.exemplars.filter((_: any, i: number) => i !== idx);
                        setEditingRecord({ ...editingRecord, exemplars: updated });
                      }}
                      className="text-xs bg-red-100 text-red-700 px-3 py-1.5 rounded hover:bg-red-200"
                    >
                      🗑️ Remover exemplar
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  const newEx = {
                    id: 'new-' + Date.now(),
                    accessionNumber: '',
                    barcode: '',
                    exemplarNumber: editingRecord.exemplars.length + 1,
                    callNumber: form.callNumber,
                    cutterCode: form.cutterCode,
                    status: 'AVAILABLE',
                    internalNote: '',
                  };
                  setEditingRecord({ ...editingRecord, exemplars: [...editingRecord.exemplars, newEx] });
                }}
                className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 text-sm"
              >
                ➕ Adicionar Novo Exemplar
              </button>
              <Link
                href={`/dashboard/exemplars/novo?catalog=${editingRecord.controlNumber}`}
                className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 text-sm text-gray-700"
              >
                📋 Gestão Completa de Exemplares
              </Link>
            </div>
          </section>
        )}

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
            {loading ? "Salvando..." : editMode ? "💾 Salvar alterações" : "💾 Catalogar e gerar exemplares"}
          </button>
        </div>
      </form>
    </div>
  );
}

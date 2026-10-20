// ============================================
// BiblioGest - Import/Export Catalogação Cooperativa
// Aceita MARC bruto (ISO 2709/texto), compara, importa, exporta
// ============================================

"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface MarcField {
  tag: string;
  indicators: string;
  subfields: { code: string; value: string }[];
}

interface ParsedRecord {
  fields: MarcField[];
  leader: string;
  controlNumber?: string;
}

interface FoundMatch {
  id: string;
  title: string;
  authors: string[];
  controlNumber?: string;
  isbn?: string;
  callNumber?: string;
  cutterCode?: string;
  publisher?: string;
  publicationYear?: string;
  exemplarsCount: number;
  similarity: number;
}

interface Exemplar {
  id: string;
  accessionNumber: string;
  barcode: string;
  callNumber?: string;
  cutterCode?: string;
  status: string;
  internalNote?: string;
}

interface CatalogRecord {
  id: string;
  controlNumber: string;
  title: string;
  subtitle?: string;
  titleStatement?: string;
  authors: string[];
  contributors: string[];
  publisher?: string;
  publicationPlace?: string;
  publicationYear?: string;
  callNumber?: string;
  cutterCode?: string;
  cdd?: string;
  cdu?: string;
  isbn?: string;
  issn?: string;
  physicalDesc?: string;
  generalNote?: string;
  contentNote?: string;
  subjects: string[];
  exemplars: Exemplar[];
  importSource?: string;
  importDate?: string;
  materialType: string;
}

const MARC_EXAMPLE = `000 00775nam a22002054a 4500
001 000069526
005 20250930122228.0
008                                    por  
082 __ |a 354.8151
092 __ |z Manuscritos
093 __ |a MS-580 (21) D.141
094 __ |a mss1437779
095 __ |a Manuscrito
100 __ |a Silva, João Carneiro da
245 __ |a [Carta a Domingos José Gomes informando que disse a João Rodrigues que o Machado pediu vinte machos, e que com estes iriam também 40 ou 50 bestas]. |h Manuscrito
260 __ |a Tejuco [Diamantina, MG] |c 13 fev. 1780
300 __ |a 1 f.
540 __ |a Biblioteca Nacional (Brasil)
546 __ |a por
600 __ |a Silva, João Carneiro da |x Correspondência
600 __ |a Silva, João Carneiro da |x Correspondence
600 __ |a Gomes, Domingos José |x Correspondência
600 __ |a Gomes, Domingos José |x Correspondence
650 __ |a Administração pública |z Minas Gerais
650 __ |a Public administration |z Minas Gerais (Brazil)
651 __ |a Minas Gerais |x Política e governo
651 __ |a Minas Gerais (Brazil) |x Politics and government
852 __ |b Casa dos Contos
856 __ |u 
856 __ |q tiff
990 __ |a Manuscrito`;

export default function ImportExportPage() {
  const router = useRouter();
  
  // Estado principal
  const [activeTab, setActiveTab] = useState<"import" | "export" | "editor">("import");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  
  // Import
  const [marcInput, setMarcInput] = useState(MARC_EXAMPLE);
  const [parsedRecord, setParsedRecord] = useState<ParsedRecord | null>(null);
  const [matches, setMatches] = useState<FoundMatch[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<FoundMatch | null>(null);
  const [importMode, setImportMode] = useState<"new" | "add-exemplar" | "update">("new");
  const [fromLibrary, setFromLibrary] = useState("");
  const [importResult, setImportResult] = useState<CatalogRecord | null>(null);
  
  // Export
  const [exportIds, setExportIds] = useState("");
  const [exportFormat, setExportFormat] = useState<"marc21" | "marcxml" | "json">("marc21");
  const [exportToLibrary, setExportToLibrary] = useState("");
  const [exportResult, setExportResult] = useState("");
  const [exporting, setExporting] = useState(false);
  
  // Editor
  const [editRecord, setEditRecord] = useState<CatalogRecord | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // ---------- PARSER MARC BRUTO ----------
  const parseMarcRaw = useCallback((raw: string): ParsedRecord => {
    const lines = raw.trim().split(/\r?\n/);
    const fields: MarcField[] = [];
    let leader = "";
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      
      // Leader (primeira linha começando com 000)
      if (trimmed.startsWith("000 ")) {
        leader = trimmed.substring(4).trim();
        continue;
      }
      
      // Campos de controle (001-009, 008)
      const controlMatch = trimmed.match(/^(\d{3})\s+(.+)$/);
      if (controlMatch) {
        const tag = controlMatch[1];
        const value = controlMatch[2].trim();
        fields.push({
          tag,
          indicators: "  ",
          subfields: [{ code: "a", value }]
        });
        continue;
      }
      
      // Campos variáveis com indicadores e subcódigos
      // Formato: TAG IND1 IND2 |$a valor $b valor...
      const varMatch = trimmed.match(/^(\d{3})\s+(.)(.)\s*(.+)$/);
      if (varMatch) {
        const tag = varMatch[1];
        const ind1 = varMatch[2];
        const ind2 = varMatch[3];
        const rest = varMatch[4].trim();
        
        const subfields: { code: string; value: string }[] = [];
        const subfieldRegex = /\|([a-z0-9])\s*([^|]*)/g;
        let match;
        while ((match = subfieldRegex.exec(rest)) !== null) {
          const code = match[1];
          const value = match[2].trim();
          if (value) subfields.push({ code, value });
        }
        
        fields.push({
          tag,
          indicators: ind1 + ind2,
          subfields
        });
      }
    }
    
    // Extrai número de controle do 001
    const controlField = fields.find(f => f.tag === "001");
    const controlNumber = controlField?.subfields[0]?.value;
    
    return { fields, leader, controlNumber };
  }, []);

  // Converte MARC parseado para dados do catálogo
  const marcToCatalogData = useCallback((record: ParsedRecord): Partial<CatalogRecord> => {
    const getField = (tag: string) => record.fields.filter(f => f.tag === tag);
    const getSubfield = (field: MarcField, code: string) => field.subfields.find(s => s.code === code)?.value || "";
    const getAllSubfields = (tag: string, code: string) => getField(tag).map(f => getSubfield(f, code)).filter(Boolean);
    
    // 245 - Título
    const f245 = getField("245")[0];
    const title = getSubfield(f245, "a") || "";
    const subtitle = getSubfield(f245, "b") || "";
    const titleStatement = getSubfield(f245, "c") || "";
    
    // 100 - Autor principal
    const authors = getAllSubfields("100", "a");
    
    // 700 - Autores secundários
    const contributors = getAllSubfields("700", "a");
    
    // 260/264 - Publicação
    const pubFields = [...getField("260"), ...getField("264")];
    const publisher = getSubfield(pubFields[0] || {subfields: []}, "b") || "";
    const publicationPlace = getSubfield(pubFields[0] || {subfields: []}, "a") || "";
    const publicationYear = getSubfield(pubFields[0] || {subfields: []}, "c") || "";
    
    // 300 - Descrição física
    const physicalDesc = getAllSubfields("300", "a").join(" ");
    
    // 082/092 - Classificação
    const cdd = getAllSubfields("082", "a").join(" ") || getAllSubfields("092", "a").join(" ");
    const callNumber = getAllSubfields("093", "a").join(" ") || cdd;
    
    // 650/651 - Assuntos
    const subjects = [...getAllSubfields("650", "a"), ...getAllSubfields("651", "a")];
    
    // 600 - Nomes como assunto
    const nameSubjects = getAllSubfields("600", "a");
    if (nameSubjects.length > 0) subjects.push(...nameSubjects);
    
    // 540/546 - Notas
    const generalNote = [
      ...getAllSubfields("540", "a"),
      ...getAllSubfields("546", "a"),
      ...getAllSubfields("500", "a")
    ].join(" | ");
    
    // 852 - Localização/Exemplar
    const location = getAllSubfields("852", "b").join(" ");
    
    // ISBN/ISSN
    const isbn = getAllSubfields("020", "a")[0] || "";
    const issn = getAllSubfields("022", "a")[0] || "";
    
    // 990 - Tipo de material
    const materialTypeMap: Record<string, string> = {
      "Manuscrito": "OTHER",
      "Livro": "BOOK",
      "Periódico": "PERIODICAL"
    };
    const materialType = materialTypeMap[getAllSubfields("990", "a")[0] || ""] || "BOOK";
    
    return {
      title,
      subtitle,
      titleStatement,
      authors,
      contributors,
      publisher,
      publicationPlace,
      publicationYear,
      physicalDesc,
      cdd,
      callNumber,
      subjects,
      generalNote,
      isbn,
      issn,
      materialType: materialType as "BOOK" | "PERIODICAL" | "OTHER",
    };
  }, []);

  // ---------- IMPORT ----------
  const handleParse = useCallback(() => {
    setError("");
    try {
      const parsed = parseMarcRaw(marcInput);
      setParsedRecord(parsed);
      setMessage("MARC parseado com sucesso. Buscando registros similares...");
      
      // Busca automaticamente matches
      searchMatches(parsed);
    } catch (err) {
      setError("Erro ao parsear MARC: " + (err as Error).message);
    }
  }, [marcInput, parseMarcRaw]);

  const searchMatches = useCallback(async (record: ParsedRecord) => {
    if (!record.controlNumber) return;
    
    setSearching(true);
    try {
      // Busca por ISBN, título, autor, número de controle
      const searchTerms: string[] = [];
      const data = marcToCatalogData(record);
      
      if (data.isbn) searchTerms.push(data.isbn);
      if (data.title) searchTerms.push(data.title.substring(0, 50));
      if (data.authors && data.authors.length > 0) searchTerms.push(data.authors[0]);
      if (record.controlNumber) searchTerms.push(record.controlNumber);
      
      if (searchTerms.length === 0) return;
      
      const query = searchTerms.join(" ");
      const res = await fetch(`/api/catalog?q=${encodeURIComponent(query)}&limit=10`);
      const result = await res.json();
      
      if (result.catalogs) {
        const matchesWithSimilarity = result.catalogs.map((cat: any) => {
          let similarity = 0;
          if (cat.isbn && data.isbn && cat.isbn === data.isbn) similarity += 50;
          if (cat.controlNumber && record.controlNumber && cat.controlNumber === record.controlNumber) similarity += 50;
          if (cat.title && data.title && cat.title.toLowerCase().includes(data.title.toLowerCase().substring(0, 20))) similarity += 30;
          if (cat.authors?.some((a: string) => data.authors?.includes(a))) similarity += 20;
          
          return {
            ...cat,
            exemplarsCount: cat._count?.exemplars || 0,
            similarity
          };
        }).filter((m: any) => m.similarity > 0)
        .sort((a: any, b: any) => b.similarity - a.similarity);
        
        setMatches(matchesWithSimilarity);
      }
    } catch (err) {
      console.error("Search error:", err);
    } finally {
      setSearching(false);
    }
  }, [marcToCatalogData]);

  const handleImport = useCallback(async () => {
    if (!parsedRecord || !fromLibrary.trim()) {
      setError("Preencha a biblioteca de origem e parseie o MARC primeiro");
      return;
    }
    
    setLoading(true);
    setError("");
    
    try {
      const catalogData = marcToCatalogData(parsedRecord);
      const rawMarc = marcInput;
      
      let url = "/api/catalog/import";
      let method = "POST";
      let body: any = {
        fromLibrary,
        marcData: rawMarc,
        tagsInicial: "<inicio>",
        tagsFinal: "<fim>",
        overwrite: true,
        ...catalogData,
        importMode
      };
      
      // Se for adicionar exemplar a registro existente
      if (importMode === "add-exemplar" && selectedMatch) {
        url = `/api/catalog/${selectedMatch.id}/exemplar`;
        method = "POST";
        body = { 
          callNumber: catalogData.callNumber,
          cutterCode: catalogData.cutterCode 
        };
      }
      
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      
      const data = await res.json();
      
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Erro na importação");
      }
      
      setImportResult(data.catalog);
      setMessage(importMode === "add-exemplar" 
        ? `Exemplar adicionado ao registro ${selectedMatch?.controlNumber}` 
        : `Registro importado com sucesso! Controle: ${data.catalog.controlNumber}`);
      
      // Limpa formulário após sucesso
      if (importMode === "new") {
        setMarcInput("");
        setParsedRecord(null);
        setMatches([]);
        setFromLibrary("");
        setImportMode("new");
        setSelectedMatch(null);
      }
    } catch (err) {
      setError("Erro: " + (err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [parsedRecord, fromLibrary, marcInput, marcToCatalogData, importMode, selectedMatch]);

  // ---------- EXPORT ----------
  const handleExport = useCallback(async () => {
    if (!exportIds.trim()) {
      setError("Informe IDs dos registros para exportar (separados por vírgula)");
      return;
    }
    
    setExporting(true);
    setError("");
    
    try {
      const ids = exportIds.split(",").map(id => id.trim()).filter(Boolean);
      const params = new URLSearchParams({
        ids: ids.join(","),
        format: exportFormat,
        toLibrary: exportToLibrary
      });
      
      const res = await fetch(`/api/catalog/export?${params}`);
      const data = await res.json();
      
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Erro na exportação");
      }
      
      setExportResult(data.export.data);
      setMessage(`Exportado ${ids.length} registro(s) para ${exportToLibrary || "download"}`);
    } catch (err) {
      setError("Erro: " + (err as Error).message);
    } finally {
      setExporting(false);
    }
  }, [exportIds, exportFormat, exportToLibrary]);

  const copyExport = useCallback(() => {
    navigator.clipboard.writeText(exportResult);
    setMessage("Copiado para área de transferência!");
  }, [exportResult]);

  // ---------- EDITOR ----------
  const loadRecordForEdit = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/catalog/${id}`);
      const data = await res.json();
      if (data) {
        setEditRecord(data);
        setEditing(true);
        setActiveTab("editor");
      }
    } catch (err) {
      setError("Erro ao carregar registro");
    } finally {
      setLoading(false);
    }
  }, []);

  const saveEdit = useCallback(async () => {
    if (!editRecord) return;
    
    setSaving(true);
    setError("");
    
    try {
      const res = await fetch("/api/catalog", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...editRecord, id: editRecord.id })
      });
      
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error);
      
      setMessage("Registro atualizado com sucesso");
      setEditRecord(data.catalog);
    } catch (err) {
      setError("Erro: " + (err as Error).message);
    } finally {
      setSaving(false);
    }
  }, [editRecord]);

  // Parse automático ao colar
  useEffect(() => {
    const timer = setTimeout(() => {
      if (marcInput.trim() && activeTab === "import") {
        handleParse();
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [marcInput, activeTab, handleParse]);

  // ---------- UI HELPERS ----------
  const field = "w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500";
  const label = "block text-sm font-medium text-gray-700 mb-1";
  const btnPrimary = "px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700 disabled:opacity-50";
  const btnSecondary = "px-4 py-2 border border-gray-300 rounded hover:bg-gray-50";
  const btnSuccess = "px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700";

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard" className="text-gray-500 hover:text-gray-700">← Painel</Link>
        <h1 className="text-2xl font-bold">🤝 Catalogação Cooperativa — Import/Export</h1>
      </div>

      {message && <div className="mb-4 p-3 bg-green-100 text-green-800 rounded">{message}</div>}
      {error && <div className="mb-4 p-3 bg-red-100 text-red-800 rounded">{error}</div>}

      {/* TABS */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-1" role="tablist">
          {[
            { id: "import", label: "📥 Importar MARC", desc: "Colar MARC bruto e importar" },
            { id: "export", label: "📤 Exportar", desc: "Gerar MARC para outras bibliotecas" },
            { id: "editor", label: "✏️ Editor", desc: "Editar registro existente" }
          ].map(tab => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => { setActiveTab(tab.id as any); setMessage(""); setError(""); }}
              className={`px-4 py-2 rounded-t-lg text-sm font-medium transition ${
                activeTab === tab.id 
                  ? "bg-primary-50 text-primary-700 border-b-2 border-primary-600" 
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* ============ IMPORT ============ */}
      {activeTab === "import" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* PAINEL ESQUERDO - ENTRADA MARC */}
          <section className="lg:col-span-2 bg-white rounded-lg shadow p-6 space-y-4">
            <h2 className="text-lg font-bold text-gray-900">Dados MARC Bruto</h2>
            <p className="text-sm text-gray-500">
              Cole o registro MARC no formato texto (ex.: ISO 2709, MARCEDIT, ou formato da BN).
              O parser aceita leader (000), campos de controle (001-009) e variáveis com |$subcodes.
            </p>
            
            <div>
              <label className={label}>Biblioteca de Origem *</label>
              <input
                value={fromLibrary}
                onChange={(e) => setFromLibrary(e.target.value)}
                className={field}
                placeholder="Ex.: Biblioteca Nacional, Pergamum, Sophia, Koha..."
              />
            </div>

            <div>
              <label className={label}>MARC Bruto</label>
              <textarea
                value={marcInput}
                onChange={(e) => setMarcInput(e.target.value)}
                rows={20}
                className={`${field} font-mono text-sm`}
                placeholder={MARC_EXAMPLE}
                spellCheck={false}
              />
            </div>

            <div className="flex gap-2">
              <button onClick={handleParse} className={btnPrimary} disabled={loading || !marcInput.trim()}>
                {loading ? "Processando..." : "🔍 Parse & Buscar Similares"}
              </button>
              <button 
                onClick={handleImport} 
                className={btnSuccess + " " + (loading ? "opacity-50" : "")}
                disabled={loading || !parsedRecord || !fromLibrary.trim()}
              >
                {importMode === "add-exemplar" ? "➕ Adicionar Exemplar" : "💾 Importar Novo Registro"}
              </button>
              <select 
                value={importMode} 
                onChange={(e) => setImportMode(e.target.value as any)}
                className={field + " w-auto"}
                disabled={loading || !matches.length}
              >
                <option value="new">🆕 Novo Registro</option>
                {matches.length > 0 && <option value="add-exemplar">➕ Adicionar Exemplar a Existente</option>}
                {matches.length > 0 && <option value="update">🔄 Atualizar Existente</option>}
              </select>
            </div>

            {/* RESULTADO DO PARSE */}
            {parsedRecord && (
              <div className="bg-gray-50 p-4 rounded border border-gray-200">
                <h3 className="font-medium mb-2">📋 Campos Parseados ({parsedRecord.fields.length} campos)</h3>
                <div className="grid grid-cols-2 gap-2 text-sm font-mono">
                  {parsedRecord.fields.slice(0, 30).map((f, i) => (
                    <div key={i} className="flex gap-2">
                      <span className="text-blue-600 font-bold">{f.tag}</span>
                      <span className="text-gray-500">{f.indicators}</span>
                      <span>{f.subfields.map(s => `|$${s.code}${s.value}`).join(" ")}</span>
                    </div>
                  ))}
                  {parsedRecord.fields.length > 30 && (
                    <div className="col-span-2 text-gray-500 text-xs">
                      ... e mais {parsedRecord.fields.length - 30} campos
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* MATCHES ENCONTRADOS */}
            {matches.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <h3 className="font-bold text-amber-800 mb-3 flex items-center gap-2">
                  ⚠️ {matches.length} registro(s) similar(es) encontrado(s)
                </h3>
                <p className="text-sm text-amber-700 mb-3">
                  Verifique se já existe para não duplicar. Selecione um para adicionar exemplar ou atualizar.
                </p>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {matches.map((match, i) => (
                    <label key={match.id} className="flex items-start gap-3 p-3 bg-white rounded border cursor-pointer hover:bg-amber-50 transition">
                      <input
                        type="radio"
                        name="match"
                        checked={selectedMatch?.id === match.id}
                        onChange={() => setSelectedMatch(match)}
                        className="mt-1 text-primary-600"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">{match.title}</p>
                        <p className="text-xs text-gray-500">
                          {match.authors.join(", ")} | {match.publisher} | {match.publicationYear}
                        </p>
                        <p className="text-xs text-gray-400 font-mono mt-1">
                          Controle: {match.controlNumber} | ISBN: {match.isbn || "—"} | Chamada: {match.callNumber || "—"}
                        </p>
                        <div className="flex gap-2 mt-1 text-xs">
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded">
                            {match.similarity}% similar
                          </span>
                          <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded">
                            {match.exemplarsCount} exemplar(es)
                          </span>
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {matches.length === 0 && parsedRecord && !searching && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                <p className="text-green-700 font-medium">✅ Nenhum registro similar encontrado. Pode importar como novo.</p>
              </div>
            )}
          </section>

          {/* PAINEL DIREITO - RESULTADO / EXEMPLARES */}
          <section className="bg-white rounded-lg shadow p-6 space-y-4">
            <h2 className="text-lg font-bold">Resultado / Ações</h2>
            
            {importResult && (
              <div className="space-y-4">
                <div className="bg-green-50 border border-green-200 rounded p-4">
                  <h3 className="font-bold text-green-900 mb-2">✅ Importado com Sucesso</h3>
                  <div className="space-y-1 text-sm">
                    <p><strong>Controle:</strong> {importResult.controlNumber}</p>
                    <p><strong>Título:</strong> {importResult.title}</p>
                    <p><strong>Autor(es):</strong> {importResult.authors.join(", ")}</p>
                    <p><strong>Chamada:</strong> {importResult.callNumber || "—"} {importResult.cutterCode || ""}</p>
                    <p><strong>Exemplares:</strong> {importResult.exemplars.length}</p>
                  </div>
                </div>

                {/* LISTA EXEMPLARES */}
                <div>
                  <h4 className="font-medium mb-2">📦 Exemplares do Registro</h4>
                  <div className="space-y-2">
                    {importResult.exemplars.map((ex, i) => (
                      <div key={ex.id} className="bg-gray-50 p-3 rounded border border-gray-200 flex items-center justify-between">
                        <div className="text-sm">
                          <p className="font-mono font-semibold">Acervo: {ex.accessionNumber}</p>
                          <p className="font-mono text-xs text-gray-600">Código: {ex.barcode}</p>
                          <p className="text-xs text-gray-500">Chamada: {ex.callNumber || importResult.callNumber} {ex.cutterCode || importResult.cutterCode}</p>
                        </div>
                        <div className="flex gap-2">
                          <Link 
                            href={`/dashboard/labels?exemplar=${ex.id}`}
                            className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200"
                          >
                            🏷️ Etiqueta
                          </Link>
                          <button className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded hover:bg-gray-200">
                            ✏️ Editar
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2 pt-4 border-t">
                  <Link 
                    href={`/dashboard/catalog?id=${importResult.id}`}
                    className={btnPrimary + " flex-1 text-center"}
                  >
                    ✏️ Editar Registro Completo
                  </Link>
                  <Link 
                    href={`/dashboard/exemplars/novo?catalog=${importResult.id}`}
                    className={btnSecondary + " flex-1 text-center"}
                  >
                    ➕ Inserir Novo Exemplar
                  </Link>
                </div>
              </div>
            )}

            {!importResult && !parsedRecord && (
              <div className="text-center py-12 text-gray-500">
                <p className="text-lg mb-2">📥</p>
                <p>Cole um MARC bruto ao lado e clique em Parse para começar</p>
              </div>
            )}
          </section>
        </div>
      )}

      {/* ============ EXPORT ============ */}
      {activeTab === "export" && (
        <section className="bg-white rounded-lg shadow p-6 space-y-6 max-w-3xl">
          <h2 className="text-lg font-bold">📤 Exportar Registros para Outra Biblioteca</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={label}>IDs dos Registros (separados por vírgula) *</label>
              <textarea
                value={exportIds}
                onChange={(e) => setExportIds(e.target.value)}
                rows={3}
                className={field}
                placeholder="000069526, 000069527, 000069528\nOu números de controle MARC 001"
              />
            </div>
            <div>
              <label className={label}>Biblioteca de Destino</label>
              <input
                value={exportToLibrary}
                onChange={(e) => setExportToLibrary(e.target.value)}
                className={field}
                placeholder="Ex.: Pergamum, Sophia, Koha..."
              />
            </div>
            <div>
              <label className={label}>Formato de Exportação</label>
              <select value={exportFormat} onChange={(e) => setExportFormat(e.target.value as any)} className={field}>
                <option value="marc21">MARC 21 (Texto com tags)</option>
                <option value="marcxml">MARCXML (XML)</option>
                <option value="json">JSON Completo</option>
              </select>
            </div>
          </div>

          <button onClick={handleExport} className={btnPrimary} disabled={exporting || !exportIds.trim()}>
            {exporting ? "Exportando..." : "📤 Exportar"}
          </button>

          {exportResult && (
            <div className="border border-gray-200 rounded p-4 bg-gray-50">
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-medium">Resultado da Exportação ({exportFormat.toUpperCase()})</h3>
                <button onClick={copyExport} className="text-sm text-primary-600 hover:underline">📋 Copiar</button>
              </div>
              <textarea
                readOnly
                rows={15}
                className="w-full font-mono text-xs bg-white p-2 border rounded"
                value={exportResult}
              />
            </div>
          )}
        </section>
      )}

      {/* ============ EDITOR ============ */}
      {activeTab === "editor" && (
        <section className="bg-white rounded-lg shadow p-6 space-y-6 max-w-4xl">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">✏️ Editor de Registro</h2>
            <button onClick={() => { setEditRecord(null); setEditing(false); setActiveTab("import"); }} className="text-gray-500 hover:text-gray-700">← Voltar</button>
          </div>

          {!editRecord ? (
            <div className="text-center py-12 text-gray-500">
              <p className="text-lg mb-2">🔍</p>
              <p>Use a aba Import para buscar e carregar um registro, ou digite o ID abaixo:</p>
              <input 
                type="text" 
                placeholder="ID do registro ou número de controle"
                className={field + " w-64 mx-auto mt-2"}
                onKeyDown={(e) => e.key === "Enter" && loadRecordForEdit((e.target as HTMLInputElement).value)}
              />
            </div>
          ) : (
            <form onSubmit={(e) => { e.preventDefault(); saveEdit(); }} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={label}>Número de Controle (001)</label>
                  <input value={editRecord.controlNumber} readOnly className={field + " bg-gray-100"} />
                </div>
                <div>
                  <label className={label}>Título *</label>
                  <input 
                    value={editRecord.title} 
                    onChange={(e) => setEditRecord({...editRecord, title: e.target.value})}
                    className={field} required 
                  />
                </div>
                <div>
                  <label className={label}>Subtítulo</label>
                  <input 
                    value={editRecord.subtitle || ""} 
                    onChange={(e) => setEditRecord({...editRecord, subtitle: e.target.value})}
                    className={field} 
                  />
                </div>
                <div>
                  <label className={label}>Autor(es) — separe por vírgula</label>
                  <input 
                    value={editRecord.authors.join(", ")} 
                    onChange={(e) => setEditRecord({...editRecord, authors: e.target.value.split(",").map(s => s.trim()).filter(Boolean)})}
                    className={field} 
                  />
                </div>
                <div>
                  <label className={label}>Autor(es) secundário(s)</label>
                  <input 
                    value={editRecord.contributors.join(", ")} 
                    onChange={(e) => setEditRecord({...editRecord, contributors: e.target.value.split(",").map(s => s.trim()).filter(Boolean)})}
                    className={field} 
                  />
                </div>
                <div>
                  <label className={label}>Editora</label>
                  <input 
                    value={editRecord.publisher || ""} 
                    onChange={(e) => setEditRecord({...editRecord, publisher: e.target.value})}
                    className={field} 
                  />
                </div>
                <div>
                  <label className={label}>Ano</label>
                  <input 
                    value={editRecord.publicationYear || ""} 
                    onChange={(e) => setEditRecord({...editRecord, publicationYear: e.target.value})}
                    className={field} 
                  />
                </div>
                <div>
                  <label className={label}>Número de Chamada (Classificação)</label>
                  <input 
                    value={editRecord.callNumber || ""} 
                    onChange={(e) => setEditRecord({...editRecord, callNumber: e.target.value})}
                    className={field} 
                  />
                </div>
                <div>
                  <label className={label}>Código Cutter / PHA</label>
                  <input 
                    value={editRecord.cutterCode || ""} 
                    onChange={(e) => setEditRecord({...editRecord, cutterCode: e.target.value})}
                    className={field} 
                  />
                </div>
                <div>
                  <label className={label}>CDD</label>
                  <input 
                    value={editRecord.cdd || ""} 
                    onChange={(e) => setEditRecord({...editRecord, cdd: e.target.value})}
                    className={field} 
                  />
                </div>
                <div>
                  <label className={label}>CDU</label>
                  <input 
                    value={editRecord.cdu || ""} 
                    onChange={(e) => setEditRecord({...editRecord, cdu: e.target.value})}
                    className={field} 
                  />
                </div>
                <div>
                  <label className={label}>ISBN</label>
                  <input 
                    value={editRecord.isbn || ""} 
                    onChange={(e) => setEditRecord({...editRecord, isbn: e.target.value})}
                    className={field} 
                  />
                </div>
                <div>
                  <label className={label}>ISSN</label>
                  <input 
                    value={editRecord.issn || ""} 
                    onChange={(e) => setEditRecord({...editRecord, issn: e.target.value})}
                    className={field} 
                  />
                </div>
              </div>

              <div>
                <label className={label}>Assuntos (650) — separe por vírgula</label>
                <input 
                  value={editRecord.subjects.join(", ")} 
                  onChange={(e) => setEditRecord({...editRecord, subjects: e.target.value.split(",").map(s => s.trim()).filter(Boolean)})}
                  className={field} 
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className={label}>Descrição Física (300)</label>
                  <input 
                    value={editRecord.physicalDesc || ""} 
                    onChange={(e) => setEditRecord({...editRecord, physicalDesc: e.target.value})}
                    className={field} 
                  />
                </div>
                <div className="md:col-span-2">
                  <label className={label}>Nota Geral (500)</label>
                  <textarea 
                    value={editRecord.generalNote || ""} 
                    onChange={(e) => setEditRecord({...editRecord, generalNote: e.target.value})}
                    rows={2} className={field} 
                  />
                </div>
                <div className="md:col-span-2">
                  <label className={label}>Nota de Conteúdo / Sumário (505)</label>
                  <textarea 
                    value={editRecord.contentNote || ""} 
                    onChange={(e) => setEditRecord({...editRecord, contentNote: e.target.value})}
                    rows={3} className={field} 
                    placeholder="Cap. 1: Título — Cap. 2: Título — ..."
                  />
                </div>
              </div>

              {/* EXEMPLARES */}
              <div className="border-t pt-4">
                <h3 className="font-bold mb-3">📦 Exemplares ({editRecord.exemplars.length})</h3>
                <div className="space-y-2">
                  {editRecord.exemplars.map((ex, i) => (
                    <div key={ex.id} className="bg-gray-50 p-3 rounded border border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div className="flex-1 grid grid-cols-4 gap-2 text-sm">
                        <div>
                          <p className="text-gray-400 text-xs">Acervo</p>
                          <p className="font-mono font-semibold">{ex.accessionNumber}</p>
                        </div>
                        <div>
                          <p className="text-gray-400 text-xs">Código de Barras</p>
                          <p className="font-mono">{ex.barcode}</p>
                        </div>
                        <div>
                          <p className="text-gray-400 text-xs">Chamada</p>
                          <p className="font-mono">{ex.callNumber || editRecord.callNumber}</p>
                        </div>
                        <div>
                          <p className="text-gray-400 text-xs">Status</p>
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            ex.status === "AVAILABLE" ? "bg-green-100 text-green-700" :
                            ex.status === "LOANED" ? "bg-yellow-100 text-yellow-700" :
                            "bg-gray-100 text-gray-700"
                          }`}>
                            {ex.status}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Link href={`/dashboard/labels?exemplar=${ex.id}`} className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">🏷️ Etiqueta</Link>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 mt-4">
                  <Link href={`/dashboard/exemplars/novo?catalog=${editRecord.id}`} className={btnSecondary}>
                    ➕ Inserir Novo Exemplar
                  </Link>
                  <Link href={`/dashboard/labels?catalog=${editRecord.id}`} className={btnPrimary}>
                    🏷️ Gerar Etiquetas em Lote
                  </Link>
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t">
                <button type="submit" className={btnPrimary} disabled={saving}>
                  {saving ? "Salvando..." : "💾 Salvar Alterações"}
                </button>
                <button type="button" onClick={() => router.refresh()} className={btnSecondary}>
                  🔄 Recarregar
                </button>
              </div>
            </form>
          )}
        </section>
      )}
    </div>
  );
}
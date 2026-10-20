// ============================================
// BiblioGest - API Catálogo
// Listar, buscar, criar e atualizar registros
// MARC 001 gerado automaticamente (nunca repete)
// Número de acervo gerado automaticamente por exemplar
// ============================================

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** Só aceita http/https — evita injeção de javascript: no src da img. */
const urlOrNull = (v: unknown, max = 600) => {
  const s = typeof v === "string" ? v.trim().slice(0, max) : null;
  if (!s) return null;
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
};
import type { ExemplarStatus } from "@prisma/client";
import {
  nextControlNumber,
  nextAcquisitionNumber,
  nextBarcode,
  nextRegisterDate,
  generateCutter,
  buildSearchText,
} from "@/lib/numbering";

// Status válidos para inserção de exemplar
const VALID_STATUSES: ExemplarStatus[] = [
  "AVAILABLE",
  "PROCESSING",
  "RESTORATION",
  "MAINTENANCE",
];

/**
 * Extrai campos MARC de dados brutos entre tags <inicio> <fim>
 * Formato esperado: <inicio>TAG$subcode$valor<fim>
 * Exemplo: <inicio>245$aTítulo principal$cResponsabilidade<fim>
 */
function parseMarcData(marcData: string, tagInicial: string = "<inicio>", tagFinal: string = "<fim>"): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  const regex = new RegExp(`${escapeRegExp(tagInicial)}([^<]+)${escapeRegExp(tagFinal)}`, "g");

  let match;
  while ((match = regex.exec(marcData)) !== null) {
    const fieldData = match[1];
    // Parse MARC field: 3 chars tag + $subfield$value...
    const tag = fieldData.substring(0, 3);
    const subfields = fieldData.substring(3);

    // Parse subfields
    const subfieldRegex = /\$([a-z0-9])([^$]*)/g;
    let subMatch;
    const values: string[] = [];

    while ((subMatch = subfieldRegex.exec(subfields)) !== null) {
      const code = subMatch[1];
      const value = subMatch[2].trim();
      if (value) {
        // Mantém a notação de subcampo para que parseSubfields consiga
        // reconstruir o registro depois. A versão anterior guardava "a:...",
        // que não era reconhecida pelo parser abaixo.
        values.push(`$${code}${value}`);
      }
    }

    if (values.length > 0) {
      if (!result[tag]) result[tag] = [];
      result[tag].push(...values);
    }
  }

  return result;
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Converte campos MARC parseados para formato do catálogo
 */
function marcToCatalogData(marcFields: Record<string, string[]>): Partial<{
  title: string;
  subtitle: string;
  titleStatement: string;
  authors: string[];
  contributors: string[];
  edition: string;
  publisher: string;
  publicationPlace: string;
  publicationYear: string;
  seriesTitle: string;
  seriesVolume: string;
  isbn: string;
  issn: string;
  subjects: string[];
  classification: string;
  cdd: string;
  cdu: string;
  callNumber: string;
  cutterCode: string;
  physicalDesc: string;
  generalNote: string;
  contentNote: string;
  contentNoteMarc: Marc505;
  bibReference: string;
  uniformSeriesTitle: string;
  volume: string;
  number: string;
  period: string;
  fixedFields: string;
  tombo: string;
  coverUrl: string;
  materialType: "BOOK" | "PERIODICAL" | "OTHER";
}> {
  const data: any = {
    authors: [],
    contributors: [],
    subjects: [],
  };

  // MARC 245 - Título
  if (marcFields["245"]) {
    for (const field of marcFields["245"]) {
      const subfields = parseSubfields(field);
      if (subfields.a) data.title = subfields.a;
      if (subfields.b) data.subtitle = subfields.b;
      if (subfields.c) data.titleStatement = subfields.c;
    }
  }

  // MARC 100 - Autor principal
  if (marcFields["100"]) {
    for (const field of marcFields["100"]) {
      const subfields = parseSubfields(field);
      if (subfields.a) data.authors.push(subfields.a);
    }
  }

  // MARC 700 - Autores secundários
  if (marcFields["700"]) {
    for (const field of marcFields["700"]) {
      const subfields = parseSubfields(field);
      if (subfields.a) data.contributors.push(subfields.a);
    }
  }

  // MARC 250 - Edição
  if (marcFields["250"]) {
    for (const field of marcFields["250"]) {
      const subfields = parseSubfields(field);
      if (subfields.a) data.edition = subfields.a;
    }
  }

  // MARC 264/260 - Publicação
  const pubFields = [...(marcFields["264"] || []), ...(marcFields["260"] || [])];
  if (pubFields.length > 0) {
    for (const field of pubFields) {
      const subfields = parseSubfields(field);
      if (subfields.a) data.publicationPlace = subfields.a;
      if (subfields.b) data.publisher = subfields.b;
      if (subfields.c) data.publicationYear = subfields.c;
    }
  }

  // MARC 490 - Série
  if (marcFields["490"]) {
    for (const field of marcFields["490"]) {
      const subfields = parseSubfields(field);
      if (subfields.a) data.seriesTitle = subfields.a;
      if (subfields.v) data.seriesVolume = subfields.v;
    }
  }

  // MARC 020 - ISBN
  if (marcFields["020"]) {
    for (const field of marcFields["020"]) {
      const subfields = parseSubfields(field);
      if (subfields.a) data.isbn = subfields.a;
    }
  }

  // MARC 022 - ISSN
  if (marcFields["022"]) {
    for (const field of marcFields["022"]) {
      const subfields = parseSubfields(field);
      if (subfields.a) data.issn = subfields.a;
    }
  }

  // MARC 650 - Assuntos
  if (marcFields["650"]) {
    for (const field of marcFields["650"]) {
      const subfields = parseSubfields(field);
      if (subfields.a) data.subjects.push(subfields.a);
    }
  }

  // MARC 082 - Classificação CDD
  if (marcFields["082"]) {
    for (const field of marcFields["082"]) {
      const subfields = parseSubfields(field);
      if (subfields.a) data.cdd = subfields.a;
    }
  }

  // MARC 084 - Classificação CDU
  if (marcFields["084"]) {
    for (const field of marcFields["084"]) {
      const subfields = parseSubfields(field);
      if (subfields.a) data.cdu = subfields.a;
    }
  }

  // MARC 050 - Classificação LC (usar como classification)
  if (marcFields["050"]) {
    for (const field of marcFields["050"]) {
      const subfields = parseSubfields(field);
      if (subfields.a) data.classification = subfields.a;
    }
  }

  // MARC 300 - Descrição física
  if (marcFields["300"]) {
    for (const field of marcFields["300"]) {
      const subfields = parseSubfields(field);
      if (subfields.a) data.physicalDesc = subfields.a;
    }
  }

  // MARC 500 - Nota geral
  if (marcFields["500"]) {
    for (const field of marcFields["500"]) {
      const subfields = parseSubfields(field);
      if (subfields.a) data.generalNote = subfields.a;
    }
  }

  // MARC 505 - Nota de conteúdo / Sumário
  if (marcFields["505"]) {
    const subfields = marcFields["505"].flatMap((field) => {
      const parsed = parseSubfields(field);
      return (["a", "g", "r", "t"] as const)
        .filter((code) => parsed[code])
        .map((code) => ({ code, value: parsed[code] }));
    });
    if (subfields.length > 0) {
      data.contentNoteMarc = { indicator1: " ", indicator2: " ", subfields };
      data.contentNote = subfields.map((field) => field.value).join(" -- ");
    }
  }

  // MARC 510 - Referência bibliográfica
  if (marcFields["510"]) {
    for (const field of marcFields["510"]) {
      const subfields = parseSubfields(field);
      if (subfields.a) data.bibReference = subfields.a;
    }
  }

  // MARC 830 - Título uniforme de série
  if (marcFields["830"]) {
    for (const field of marcFields["830"]) {
      const subfields = parseSubfields(field);
      if (subfields.a) data.uniformSeriesTitle = subfields.a;
    }
  }

  // MARC 008 - Campos fixos
  if (marcFields["008"]) {
    for (const field of marcFields["008"]) {
      const subfields = parseSubfields(field);
      if (subfields.a) data.fixedFields = subfields.a;
    }
  }

  // MARC 856 - URL da capa
  if (marcFields["856"]) {
    for (const field of marcFields["856"]) {
      const subfields = parseSubfields(field);
      if (subfields.u) data.coverUrl = subfields.u;
    }
  }

  // MARC 362 - Periódicos
  if (marcFields["362"]) {
    for (const field of marcFields["362"]) {
      const subfields = parseSubfields(field);
      if (subfields.a) {
        // Tentar extrair volume, número, frequência
        const parts = subfields.a.split(/[,;]/);
        if (parts[0]) data.volume = parts[0].trim();
        if (parts[1]) data.number = parts[1].trim();
        if (parts[2]) data.period = parts[2].trim();
      }
    }
  }

  return data;
}

function parseSubfields(fieldStr: string): Record<string, string> {
  const result: Record<string, string> = {};
  const subfieldRegex = /\$([a-z0-9])([^$]*)/g;
  let match;
  while ((match = subfieldRegex.exec(fieldStr)) !== null) {
    result[match[1]] = match[2].trim();
  }
  return result;
}

type Marc505 = {
  indicator1: string;
  indicator2: string;
  subfields: Array<{ code: "a" | "g" | "r" | "t"; value: string }>;
};

/** Valida a parte estruturada do MARC 505 e produz a nota para exibição/busca. */
function normalizeMarc505(value: unknown, fallback?: unknown): { marc: Marc505; display: string } {
  const raw = value && typeof value === "object" ? value as Partial<Marc505> : {};
  const validCode = new Set(["a", "g", "r", "t"]);
  const subfields = Array.isArray(raw.subfields)
    ? (raw.subfields as unknown[])
        .filter((item) => !!item && typeof item === "object")
        .map((item: any) => ({ code: String(item.code).toLowerCase(), value: String(item.value ?? "").trim() }))
        .filter((item) => validCode.has(item.code) && Boolean(item.value))
        .map((item) => ({ code: item.code as Marc505["subfields"][number]["code"], value: item.value }))
    : [];

  if (subfields.length === 0 && typeof fallback === "string" && fallback.trim()) {
    subfields.push({ code: "a", value: fallback.trim() });
  }

  const indicator = (value: unknown) => typeof value === "string" && /^[0-9 ]$/.test(value) ? value : " ";
  const marc = {
    indicator1: indicator(raw.indicator1),
    indicator2: indicator(raw.indicator2),
    subfields,
  };
  return { marc, display: subfields.map((field) => field.value).join(" -- ") };
}

function normalizeAuthority(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase().replace(/\s+/g, " ");
}

/** Mantém o vocabulário reutilizável sem alterar os arrays MARC já existentes. */
async function registerAuthorities(authors: string[], contributors: string[], subjects: string[], publisher?: unknown, place?: unknown) {
  const people = Array.from(new Set([...authors, ...contributors]));
  await Promise.all([
    ...people.map((name) => prisma.authorityAuthor.upsert({
      where: { normalized: normalizeAuthority(name) },
      create: { name, normalized: normalizeAuthority(name), source: "manual" },
      update: {},
    })),
    ...subjects.map((term) => prisma.authoritySubject.upsert({
      where: { normalized: normalizeAuthority(term) },
      create: { term, normalized: normalizeAuthority(term), source: "manual" },
      update: {},
    })),
    ...(typeof publisher === "string" && publisher.trim() ? [prisma.authorityPublisher.upsert({
      where: { normalized: normalizeAuthority(publisher) },
      create: { name: publisher.trim(), normalized: normalizeAuthority(publisher), place: typeof place === "string" ? place.trim() || null : null, source: "manual" },
      update: {},
    })] : []),
  ]);
}

/**
 * Converte dados do catálogo para formato MARC com tags <inicio> <fim>
 */
function catalogToMarcData(catalog: any, tagInicial: string = "<inicio>", tagFinal: string = "<fim>"): string {
  const fields: string[] = [];

  // 245 - Título
  if (catalog.title) {
    let field = "245";
    if (catalog.title) field += `$a${catalog.title}`;
    if (catalog.subtitle) field += `$b${catalog.subtitle}`;
    if (catalog.titleStatement) field += `$c${catalog.titleStatement}`;
    fields.push(`${tagInicial}${field}${tagFinal}`);
  }

  // 100 - Autor principal
  if (catalog.authors?.length > 0) {
    for (const author of catalog.authors) {
      fields.push(`${tagInicial}100\$a${author}${tagFinal}`);
    }
  }

  // 700 - Autores secundários
  if (catalog.contributors?.length > 0) {
    for (const contributor of catalog.contributors) {
      fields.push(`${tagInicial}700\$a${contributor}${tagFinal}`);
    }
  }

  // 250 - Edição
  if (catalog.edition) {
    fields.push(`${tagInicial}250\$a${catalog.edition}${tagFinal}`);
  }

  // 264 - Publicação
  if (catalog.publisher || catalog.publicationPlace || catalog.publicationYear) {
    let field = "264";
    if (catalog.publicationPlace) field += `$a${catalog.publicationPlace}`;
    if (catalog.publisher) field += `$b${catalog.publisher}`;
    if (catalog.publicationYear) field += `$c${catalog.publicationYear}`;
    fields.push(`${tagInicial}${field}${tagFinal}`);
  }

  // 490 - Série
  if (catalog.seriesTitle || catalog.seriesVolume) {
    let field = "490";
    if (catalog.seriesTitle) field += `$a${catalog.seriesTitle}`;
    if (catalog.seriesVolume) field += `$v${catalog.seriesVolume}`;
    fields.push(`${tagInicial}${field}${tagFinal}`);
  }

  // 020 - ISBN
  if (catalog.isbn) {
    fields.push(`${tagInicial}020\$a${catalog.isbn}${tagFinal}`);
  }

  // 022 - ISSN
  if (catalog.issn) {
    fields.push(`${tagInicial}022\$a${catalog.issn}${tagFinal}`);
  }

  // 650 - Assuntos
  if (catalog.subjects?.length > 0) {
    for (const subject of catalog.subjects) {
      fields.push(`${tagInicial}650\$a${subject}${tagFinal}`);
    }
  }

  // 082 - CDD
  if (catalog.cdd) {
    fields.push(`${tagInicial}082\$a${catalog.cdd}${tagFinal}`);
  }

  // 084 - CDU
  if (catalog.cdu) {
    fields.push(`${tagInicial}084\$a${catalog.cdu}${tagFinal}`);
  }

  // 050 - Classificação LC
  if (catalog.classification) {
    fields.push(`${tagInicial}050\$a${catalog.classification}${tagFinal}`);
  }

  // 300 - Descrição física
  if (catalog.physicalDesc) {
    fields.push(`${tagInicial}300\$a${catalog.physicalDesc}${tagFinal}`);
  }

  // 500 - Nota geral
  if (catalog.generalNote) {
    fields.push(`${tagInicial}500\$a${catalog.generalNote}${tagFinal}`);
  }

  // 505 - Nota de conteúdo, preservando indicadores e subcampos quando
  // disponíveis; registros antigos continuam sendo emitidos como $a.
  const marc505 = normalizeMarc505(catalog.contentNoteMarc, catalog.contentNote).marc;
  if (marc505.subfields.length > 0) {
    const subfields = marc505.subfields.map((field) => `$${field.code}${field.value}`).join("");
    fields.push(`${tagInicial}505${marc505.indicator1}${marc505.indicator2}${subfields}${tagFinal}`);
  }

  // 510 - Referência bibliográfica
  if (catalog.bibReference) {
    fields.push(`${tagInicial}510\$a${catalog.bibReference}${tagFinal}`);
  }

  // 830 - Título uniforme de série
  if (catalog.uniformSeriesTitle) {
    fields.push(`${tagInicial}830\$a${catalog.uniformSeriesTitle}${tagFinal}`);
  }

  // 008 - Campos fixos
  if (catalog.fixedFields) {
    fields.push(`${tagInicial}008\$a${catalog.fixedFields}${tagFinal}`);
  }

  // 856 - URL da capa
  if (catalog.coverUrl) {
    fields.push(`${tagInicial}856\$u${catalog.coverUrl}${tagFinal}`);
  }

  // 362 - Periódicos
  if (catalog.volume || catalog.number || catalog.period) {
    let field = "362";
    const parts = [];
    if (catalog.volume) parts.push(catalog.volume);
    if (catalog.number) parts.push(catalog.number);
    if (catalog.period) parts.push(catalog.period);
    if (parts.length > 0) {
      field += `$a${parts.join(", ")}`;
      fields.push(`${tagInicial}${field}${tagFinal}`);
    }
  }

  return fields.join("\n");
}

// ============================================
// GET - Listar catálogos
// ============================================
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") || "";
    const type = searchParams.get("type") || "";
    const author = searchParams.get("author") || "";
    const subject = searchParams.get("subject") || "";
    const status = searchParams.get("status") || "";
    const isbn = searchParams.get("isbn") || "";
    const controlNumber = searchParams.get("controlNumber") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;

    const where: any = {};

    // Busca exata por número de controle (MARC 001)
    if (controlNumber) {
      where.controlNumber = controlNumber;
    }

    if (query) {
      // Todos os campos pesquisáveis do registro bibliográfico
      const scalarFields = [
        "title",
        "subtitle",
        "isbn",
        "issn",
        "controlNumber",
        "callNumber",
        "cutterCode",
        "classification",
        "cdd",
        "cdu",
        "tombo",
        "seriesTitle",
        "generalNote",
        "contentNote",
      ];

      // searchText cobre também a busca por parte do nome do autor e
      // por parte do assunto, que o `has` exato não encontra
      // ("Souza" dentro de "Souza, Ana").
      const matchTerm = (term: string) => [
        ...scalarFields.map((f) => ({ [f]: { contains: term, mode: "insensitive" } })),
        { authors: { has: term } },
        { subjects: { has: term } },
        { searchText: { contains: term.toLowerCase(), mode: "insensitive" } },
        {
          exemplars: {
            some: {
              OR: [
                { callNumber: { contains: term, mode: "insensitive" } },
                { cutterCode: { contains: term, mode: "insensitive" } },
                { accessionNumber: { contains: term, mode: "insensitive" } },
                { barcode: { contains: term, mode: "insensitive" } },
              ],
            },
          },
        },
      ];

      // "Ex.3" / "exemplar 3" procura pelo número do exemplar.
      // Substitui a busca por texto: não faz sentido procurar a
      // string "Ex.3" no texto do registro.
      const comoExemplar = query
        .trim()
        .match(/^(?:ex\.?|exemplar)\s*0*(\d{1,4})$/i);
      if (comoExemplar) {
        where.exemplars = {
          ...(where.exemplars as object),
          some: {
            ...((where.exemplars as { some?: object })?.some ?? {}),
            exemplarNumber: parseInt(comoExemplar[1], 10),
          },
        };
      } else {
        // Termos separados por espaço: todos precisam existir (AND),
        // para que "004.67 M278" encontre classificação + cutter.
        const terms = query.trim().split(/\s+/).filter(Boolean);

        if (terms.length > 1) {
          where.AND = terms.map((term) => ({ OR: matchTerm(term) }));
        } else {
          where.OR = matchTerm(terms[0]);
        }
      }
    }

    if (isbn) where.isbn = { contains: isbn, mode: "insensitive" };
    if (type) where.materialType = type;
    if (author) where.authors = { has: author };
    if (subject) where.subjects = { has: subject };

    // Filtro por status dos exemplares (usado pelo catálogo público)
    if (status) {
      where.exemplars = { some: { status } };
    }

    const [catalogs, total] = await Promise.all([
      prisma.catalog.findMany({
        where,
        include: {
          exemplars: {
            select: {
              id: true,
              barcode: true,
              accessionNumber: true,
              exemplarNumber: true,
              status: true,
              callNumber: true,
              cutterCode: true,
              internalNote: true,
            },
            orderBy: { exemplarNumber: "asc" },
          },
          _count: { select: { exemplars: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.catalog.count({ where }),
    ]);

    return NextResponse.json({
      catalogs,
      total,
      page,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (error) {
    console.error("Catalog list error:", error);
    return NextResponse.json(
      { error: "Erro ao buscar catálogo" },
      { status: 500 }
    );
  }
}

// ============================================
// POST - Criar/Importar registro de catálogo
// ============================================
// Modo normal: { title, authors, ... }
// Modo importação (catalogação cooperativa): {
//   fromLibrary: string,  // nome da biblioteca origem
//   marcData: string,     // dados MARC entre <inicio> <fim>
//   tagsInicial: string,  // tag de início (default: "<inicio>")
//   tagsFinal: string,    // tag de fim (default: "<fim>")
//   overwrite: boolean,   // substituir campos existentes
//   title, authors, ...   // campos opcionais para sobrescrever/completar
// }
// ============================================
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Verifica se é uma importação de catalogação cooperativa
    const isImport = !!body.fromLibrary && !!body.marcData;
    const tagInicial = body.tagsInicial || "<inicio>";
    const tagFinal = body.tagsFinal || "<fim>";
    const overwrite = body.overwrite ?? true;

    let importData: any = {};
    let marcFields: Record<string, string[]> = {};

    if (isImport) {
      // Parse dos dados MARC entre as tags
      marcFields = parseMarcData(body.marcData, tagInicial, tagFinal);
      importData = marcToCatalogData(marcFields);

      // Mescla com dados do body (body tem prioridade se overwrite=true)
      if (overwrite) {
        importData = { ...importData, ...body };
      } else {
        importData = { ...body, ...importData };
      }
    }

    // Validação do campo obrigatório
    const finalTitle = importData.title || body.title;
    if (!finalTitle || !finalTitle.trim()) {
      return NextResponse.json(
        { error: "O título é obrigatório" },
        { status: 400 }
      );
    }

    const totalCopies = Math.max(1, parseInt(body.totalCopies) || 1);

    // Status inicial dos exemplares inseridos
    const requestedStatus = String(body.exemplarStatus || "AVAILABLE").toUpperCase();
    const initialStatus: ExemplarStatus = VALID_STATUSES.includes(
      requestedStatus as ExemplarStatus
    )
      ? (requestedStatus as ExemplarStatus)
      : "AVAILABLE";

    // Números gerados automaticamente
    const controlNumber = await nextControlNumber();        // MARC 001
    const acquisition = await nextAcquisitionNumber();     // nº do acervo
    const registerDate = await nextRegisterDate();         // MARC 008

    // Usa dados da importação ou do body
    const uniqueTerms = (value: unknown): string[] =>
      Array.from(new Map((Array.isArray(value) ? value : [])
        .filter((term): term is string => typeof term === "string")
        .map((term) => term.trim())
        .filter(Boolean)
        .map((term) => [term.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(), term] as const)).values());
    const authors = uniqueTerms(Array.isArray(importData.authors) ? importData.authors : body.authors);
    const contributors = uniqueTerms(Array.isArray(importData.contributors) ? importData.contributors : body.contributors);
    const subjects = uniqueTerms(Array.isArray(importData.subjects) ? importData.subjects : body.subjects);
    const cutterCode = importData.cutterCode?.trim() || body.cutterCode?.trim() || generateCutter(authors);
    const marc505 = normalizeMarc505(importData.contentNoteMarc ?? body.contentNoteMarc, importData.contentNote || body.contentNote);

    // Texto consolidado para a busca
    const searchText = buildSearchText({
      title: finalTitle.trim(),
      subtitle: importData.subtitle || body.subtitle,
      authors,
      contributors,
      subjects,
      callNumber: importData.callNumber || body.callNumber,
      cutterCode,
      classification: importData.classification || body.classification,
      cdd: importData.cdd || body.cdd,
      cdu: importData.cdu || body.cdu,
      isbn: importData.isbn || body.isbn,
      issn: importData.issn || body.issn,
      edition: importData.edition || body.edition,
      publisher: importData.publisher || body.publisher,
      tombo: importData.tombo || body.tombo,
      acquisition,
      contentNote: marc505.display,
    });

    await registerAuthorities(authors, contributors, subjects, importData.publisher || body.publisher, importData.publicationPlace || body.publicationPlace);

    const catalog = await prisma.catalog.create({
      data: {
        // Identificação automática
        controlNumber,
        fixedFields: importData.fixedFields?.trim() || body.fixedFields?.trim() || registerDate,

        // MARC 245
        materialType: importData.materialType || body.materialType || "BOOK",
        title: finalTitle.trim(),
        subtitle: importData.subtitle || body.subtitle,
        titleStatement: importData.titleStatement || body.titleStatement,

        // MARC 100 / 700
        authors,
        contributors,

        // MARC 250 / 260 / 264
        edition: importData.edition || body.edition,
        publisher: importData.publisher || body.publisher,
        publicationPlace: importData.publicationPlace || body.publicationPlace,
        publicationYear: importData.publicationYear || body.publicationYear,

        // MARC 490
        seriesTitle: importData.seriesTitle || body.seriesTitle,
        seriesVolume: importData.seriesVolume || body.seriesVolume,

        // MARC 020 / 022
        isbn: importData.isbn || body.isbn,
        issn: importData.issn || body.issn,

        // MARC 650
        subjects,

        // MARC 082 + classificação
        classification: importData.classification || body.classification,
        cdd: importData.cdd || body.cdd,
        cdu: importData.cdu || body.cdu,

        // MARC 300 / 500 / 505 / 510 / 830
        physicalDesc: importData.physicalDesc || body.physicalDesc,
        generalNote: importData.generalNote || body.generalNote,
        contentNote: marc505.display || null,
        contentNoteMarc: marc505.marc,
        bibReference: importData.bibReference || body.bibReference,
        uniformSeriesTitle: importData.uniformSeriesTitle || body.uniformSeriesTitle,

        // Operacional
        callNumber: importData.callNumber || body.callNumber,
        cutterCode,
        acquisitionNumber: acquisition,
        accessionNumber: acquisition,
        tombo: importData.tombo?.trim() || body.tombo?.trim() || null,
        coverUrl: urlOrNull(importData.coverUrl || body.coverUrl),
        searchText,
        totalCopies,

        // Periódicos (MARC 362)
        volume: importData.volume || body.volume,
        number: importData.number || body.number,
        period: importData.period || body.period,

        // Catalogação cooperativa
        importSource: isImport ? body.fromLibrary : null,
        importDate: isImport ? new Date() : null,
        importMarcData: isImport ? body.marcData : null,

        // Campos MARC extras
        customFields: body.customFields || [],
      },
    });

    // Cria um exemplar por cópia.
    // Todos compartilham o MESMO número de acervo — é o que mostra
    // que são o mesmo item. O que muda é o número do exemplar e o
    // código de barras, que precisa ser único para o leitor.
    const exemplars = [];
    for (let i = 0; i < totalCopies; i++) {
      const exemplar = await prisma.exemplar.create({
        data: {
          catalogId: catalog.id,
          accessionNumber: acquisition,
          exemplarNumber: i + 1,
          barcode: await nextBarcode(),
          callNumber: catalog.callNumber,
          cutterCode: catalog.cutterCode,
          status: initialStatus,
        },
        select: {
          id: true,
          accessionNumber: true,
          exemplarNumber: true,
          barcode: true,
          status: true,
        },
      });
      exemplars.push(exemplar);
    }

    return NextResponse.json({
      success: true,
      catalog,
      exemplars,
      message: "Registro criado com sucesso",
    });
  } catch (error) {
    console.error("Catalog create error:", error);
    return NextResponse.json(
      { error: "Erro ao criar registro" },
      { status: 500 }
    );
  }
}

// ============================================
// PUT - Atualizar registro de catálogo
// ============================================
export async function PUT(request: NextRequest) {
  try {
    const { id, ...body } = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: "ID do registro não informado" },
        { status: 400 }
      );
    }

    if (typeof body.title !== "string" || !body.title.trim()) {
      return NextResponse.json({ error: "O título é obrigatório" }, { status: 400 });
    }
    const terms = (value: unknown): string[] => Array.from(new Map(
      (Array.isArray(value) ? value : []).filter((v): v is string => typeof v === "string")
        .map((v) => v.trim()).filter(Boolean)
        .map((v) => [v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(), v] as const)
    ).values());
    const authors = terms(body.authors);
    const contributors = terms(body.contributors);
    const subjects = terms(body.subjects);
    const cutterCode = String(body.cutterCode || generateCutter(authors)).trim();
    const marc505 = normalizeMarc505(body.contentNoteMarc, body.contentNote);
    const exemplarsData = Array.isArray(body.exemplars) ? body.exemplars : null;
    const current = await prisma.catalog.findUnique({
      where: { id },
      include: { exemplars: { select: { id: true, barcode: true, exemplarNumber: true, status: true } } },
    });
    if (!current) return NextResponse.json({ error: "Registro não encontrado" }, { status: 404 });

    const incomingIds = new Set((exemplarsData || []).filter((ex: any) => ex?.id && !String(ex.id).startsWith("new-")).map((ex: any) => ex.id));
    const existingById = new Map(current.exemplars.map((ex) => [ex.id, ex]));
    if (exemplarsData) {
      const requestedBarcodes = new Set<string>();
      for (const ex of exemplarsData) {
        if (!ex?.id) return NextResponse.json({ error: "Exemplar inválido" }, { status: 400 });
        if (!String(ex.id).startsWith("new-") && !existingById.has(ex.id)) {
          return NextResponse.json({ error: "Exemplar não pertence a este registro" }, { status: 400 });
        }
        if (!String(ex.id).startsWith("new-") && !String(ex.barcode || "").trim()) {
          return NextResponse.json({ error: "O código de barras é obrigatório" }, { status: 400 });
        }
        const nextStatus = String(ex.status || "AVAILABLE").toUpperCase();
        if (!VALID_STATUSES.includes(nextStatus as ExemplarStatus) && nextStatus !== "LOANED" && nextStatus !== "LOST") {
          return NextResponse.json({ error: "Status de exemplar inválido" }, { status: 400 });
        }
        if (ex.barcode && requestedBarcodes.has(String(ex.barcode).trim())) {
          return NextResponse.json({ error: "Há códigos de barras repetidos na edição" }, { status: 400 });
        }
        if (ex.barcode) requestedBarcodes.add(String(ex.barcode).trim());
        if (String(ex.id).startsWith("new-") && !String(ex.barcode || "").trim()) {
          ex.barcode = await nextBarcode();
          requestedBarcodes.add(ex.barcode);
        }
        if (ex.barcode) {
          const owner = await prisma.exemplar.findUnique({ where: { barcode: String(ex.barcode).trim() }, select: { id: true } });
          if (owner && owner.id !== ex.id) {
            return NextResponse.json({ error: "Este código de barras já pertence a outro exemplar" }, { status: 409 });
          }
        }
      }
      const changedOrRemoved = current.exemplars.filter((ex) => !incomingIds.has(ex.id) || (() => {
        const submitted = exemplarsData.find((item: any) => item.id === ex.id);
        return submitted && String(submitted.status || ex.status).toUpperCase() !== ex.status;
      })());
      if (changedOrRemoved.length > 0) {
        const activeLoan = await prisma.loan.findFirst({ where: { exemplarId: { in: changedOrRemoved.map((ex) => ex.id) }, status: { in: ["ACTIVE", "OVERDUE", "RENEWED"] } } });
        if (activeLoan) return NextResponse.json({ error: "Não é possível remover ou alterar o status de exemplar com empréstimo ativo" }, { status: 400 });
      }
    }

    const searchText = buildSearchText({ title: body.title.trim(), subtitle: body.subtitle, authors, contributors, subjects, callNumber: body.callNumber, cutterCode, classification: body.classification, cdd: body.cdd, cdu: body.cdu, isbn: body.isbn, issn: body.issn, edition: body.edition, publisher: body.publisher, tombo: body.tombo, acquisition: current.acquisitionNumber, contentNote: marc505.display });
    await registerAuthorities(authors, contributors, subjects, body.publisher, body.publicationPlace);
    const catalog = await prisma.$transaction(async (tx) => {
      const updated = await tx.catalog.update({ where: { id }, data: {
        materialType: body.materialType, title: body.title.trim(), subtitle: body.subtitle || null, titleStatement: body.titleStatement || null,
        authors, contributors, edition: body.edition || null, publisher: body.publisher || null, publicationPlace: body.publicationPlace || null, publicationYear: body.publicationYear || null,
        seriesTitle: body.seriesTitle || null, seriesVolume: body.seriesVolume || null, isbn: body.isbn || null, issn: body.issn || null, subjects,
        classification: body.classification || null, cdd: body.cdd || null, cdu: body.cdu || null, physicalDesc: body.physicalDesc || null, generalNote: body.generalNote || null,
        contentNote: marc505.display || null, contentNoteMarc: marc505.marc, bibReference: body.bibReference || null, uniformSeriesTitle: body.uniformSeriesTitle || null,
        callNumber: body.callNumber || null, cutterCode: cutterCode || null, tombo: body.tombo || null, coverUrl: urlOrNull(body.coverUrl), fixedFields: body.fixedFields?.trim() || null, volume: body.volume || null, number: body.number || null, period: body.period || null,
        customFields: Array.isArray(body.customFields) ? body.customFields : [], searchText,
      }});
      if (exemplarsData) {
        const removedIds = current.exemplars.filter((ex) => !incomingIds.has(ex.id)).map((ex) => ex.id);
        if (removedIds.length) await tx.exemplar.deleteMany({ where: { id: { in: removedIds }, catalogId: id } });
        let nextNumber = Math.max(0, ...current.exemplars.map((ex) => ex.exemplarNumber));
        for (const ex of exemplarsData) {
          const status = String(ex.status || "AVAILABLE").toUpperCase() as ExemplarStatus;
          if (String(ex.id).startsWith("new-")) {
            nextNumber += 1;
            await tx.exemplar.create({ data: { catalogId: id, accessionNumber: String(ex.accessionNumber || current.acquisitionNumber || "") || null, exemplarNumber: nextNumber, barcode: String(ex.barcode).trim(), callNumber: ex.callNumber || updated.callNumber, cutterCode: ex.cutterCode || updated.cutterCode, status, internalNote: ex.internalNote || null } });
          } else {
            await tx.exemplar.update({ where: { id: ex.id }, data: { accessionNumber: ex.accessionNumber || null, barcode: String(ex.barcode).trim(), callNumber: ex.callNumber || null, cutterCode: ex.cutterCode || null, status, internalNote: ex.internalNote || null } });
          }
        }
        const totalCopies = await tx.exemplar.count({ where: { catalogId: id } });
        return tx.catalog.update({ where: { id }, data: { totalCopies } });
      }
      return updated;
    });

    return NextResponse.json({
      success: true,
      catalog,
      message: "Registro atualizado com sucesso",
    });
  } catch (error) {
    console.error("Catalog update error:", error);
    return NextResponse.json(
      { error: "Erro ao atualizar catálogo" },
      { status: 500 }
    );
  }
}

// ============================================
// DELETE - Deletar registro de catálogo
// ============================================
export async function DELETE(request: NextRequest) {
  try {
    const { id } = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: "ID do registro não informado" },
        { status: 400 }
      );
    }

    await prisma.catalog.delete({ where: { id } });

    return NextResponse.json({
      success: true,
      message: "Registro deletado com sucesso",
    });
  } catch (error) {
    console.error("Catalog delete error:", error);
    return NextResponse.json(
      { error: "Erro ao deletar catálogo" },
      { status: 500 }
    );
  }
}

// ============================================
// GET - Exportar registro para catalogação cooperativa
// ============================================
// Query params: ?id=<id>&format=marc&tagInicial=<inicio>&tagFinal=<fim>&toLibrary=<biblioteca>
// ============================================
export async function PATCH(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const format = searchParams.get("format") || "marc";
    const tagInicial = searchParams.get("tagInicial") || "<inicio>";
    const tagFinal = searchParams.get("tagFinal") || "<fim>";
    const toLibrary = searchParams.get("toLibrary") || "";

    if (!id) {
      return NextResponse.json(
        { error: "ID do registro não informado" },
        { status: 400 }
      );
    }

    const catalog = await prisma.catalog.findUnique({
      where: { id },
      include: {
        exemplars: {
          select: {
            id: true,
            barcode: true,
            accessionNumber: true,
            exemplarNumber: true,
            status: true,
            callNumber: true,
            cutterCode: true,
          },
          orderBy: { exemplarNumber: "asc" },
        },
      },
    });

    if (!catalog) {
      return NextResponse.json(
        { error: "Registro não encontrado" },
        { status: 404 }
      );
    }

    // Atualiza lista de bibliotecas exportadas
    if (toLibrary) {
      const exportedTo = [...new Set([...(catalog.exportedTo || []), toLibrary])];
      await prisma.catalog.update({
        where: { id },
        data: { exportedTo },
      });
    }

    if (format === "marc") {
      const marcData = catalogToMarcData(catalog, tagInicial, tagFinal);
      return NextResponse.json({
        success: true,
        export: {
          format: "MARC21",
          tags: { inicial: tagInicial, final: tagFinal },
          data: marcData,
          library: toLibrary,
          exportedAt: new Date().toISOString(),
        },
      });
    }

    if (format === "json") {
      return NextResponse.json({
        success: true,
        export: {
          format: "JSON",
          data: catalog,
          library: toLibrary,
          exportedAt: new Date().toISOString(),
        },
      });
    }

    return NextResponse.json(
      { error: "Formato não suportado. Use 'marc' ou 'json'." },
      { status: 400 }
    );
  } catch (error) {
    console.error("Catalog export error:", error);
    return NextResponse.json(
      { error: "Erro ao exportar registro" },
      { status: 500 }
    );
  }
}

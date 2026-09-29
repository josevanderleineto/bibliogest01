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
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;

    const where: any = {};

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
// POST - Criar novo registro de catálogo
// ============================================
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validação do campo obrigatório
    if (!body.title || !body.title.trim()) {
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
    const authors: string[] = Array.isArray(body.authors) ? body.authors : [];
    const cutterCode = body.cutterCode?.trim() || generateCutter(authors);
    const subjects: string[] = Array.isArray(body.subjects) ? body.subjects : [];

    // Texto consolidado para a busca. Montado agora, já com o
    // número de acervo — que também precisa ser pesquisável.
    const searchText = buildSearchText({
      title: body.title.trim(),
      subtitle: body.subtitle,
      authors,
      contributors: body.contributors,
      subjects,
      callNumber: body.callNumber,
      cutterCode,
      classification: body.classification,
      cdd: body.cdd,
      cdu: body.cdu,
      isbn: body.isbn,
      issn: body.issn,
      edition: body.edition,
      publisher: body.publisher,
      tombo: body.tombo,
      acquisition,
    });

    const catalog = await prisma.catalog.create({
      data: {
        // Identificação automática
        controlNumber,
        fixedFields: body.fixedFields?.trim() || registerDate,

        // MARC 245
        materialType: body.materialType || "BOOK",
        title: body.title.trim(),
        subtitle: body.subtitle,
        titleStatement: body.titleStatement,

        // MARC 100 / 700
        authors,
        contributors: body.contributors || [],

        // MARC 250 / 260 / 264
        edition: body.edition,
        publisher: body.publisher,
        publicationPlace: body.publicationPlace,
        publicationYear: body.publicationYear,

        // MARC 490
        seriesTitle: body.seriesTitle,
        seriesVolume: body.seriesVolume,

        // MARC 020 / 022
        isbn: body.isbn,
        issn: body.issn,

        // MARC 650
        subjects,

        // MARC 082 + classificação
        classification: body.classification,
        cdd: body.cdd,
        cdu: body.cdu,

        // MARC 300 / 500 / 510 / 830
        physicalDesc: body.physicalDesc,
        generalNote: body.generalNote,
        bibReference: body.bibReference,
        uniformSeriesTitle: body.uniformSeriesTitle,

        // Operacional
        callNumber: body.callNumber,
        cutterCode,
        acquisitionNumber: acquisition,
        accessionNumber: acquisition,
        tombo: body.tombo?.trim() || null,
        coverUrl: urlOrNull(body.coverUrl),
        searchText,
        totalCopies,

        // Periódicos (MARC 362)
        volume: body.volume,
        number: body.number,
        period: body.period,

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

    const authors: string[] = Array.isArray(body.authors) ? body.authors : undefined;

    const catalog = await prisma.catalog.update({
      where: { id },
      data: {
        title: body.title,
        subtitle: body.subtitle,
        titleStatement: body.titleStatement,
        authors,
        contributors: body.contributors,
        edition: body.edition,
        publisher: body.publisher,
        publicationPlace: body.publicationPlace,
        publicationYear: body.publicationYear,
        seriesTitle: body.seriesTitle,
        seriesVolume: body.seriesVolume,
        isbn: body.isbn,
        issn: body.issn,
        subjects: body.subjects,
        classification: body.classification,
        cdd: body.cdd,
        cdu: body.cdu,
        physicalDesc: body.physicalDesc,
        generalNote: body.generalNote,
        bibReference: body.bibReference,
        uniformSeriesTitle: body.uniformSeriesTitle,
        callNumber: body.callNumber,
        cutterCode: body.cutterCode || (authors ? generateCutter(authors) : undefined),
        volume: body.volume,
        number: body.number,
        period: body.period,
        customFields: body.customFields,
      },
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

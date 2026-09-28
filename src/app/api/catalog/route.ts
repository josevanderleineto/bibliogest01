// ============================================
// BiblioGest - API Catálogo
// Listar, buscar, criar e atualizar registros
// MARC 001 gerado automaticamente (nunca repete)
// Número de acervo gerado automaticamente por exemplar
// ============================================

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";
import type { ExemplarStatus } from "@prisma/client";
import {
  nextControlNumber,
  nextAccessionNumbers,
  nextRegisterDate,
  barcodeFromAccession,
  generateCutter,
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
        "seriesTitle",
        "generalNote",
      ];

      const matchTerm = (term: string) => [
        ...scalarFields.map((f) => ({ [f]: { contains: term, mode: "insensitive" } })),
        { authors: { has: term } },
        { subjects: { has: term } },
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

      // Termos separados por espaço: todos precisam existir (AND),
      // para que "004.67 M278" encontre classificação + cutter.
      const terms = query.trim().split(/\s+/).filter(Boolean);

      if (terms.length > 1) {
        where.AND = terms.map((term) => ({ OR: matchTerm(term) }));
      } else {
        where.OR = matchTerm(terms[0]);
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
              status: true,
              callNumber: true,
              cutterCode: true,
            },
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
    const controlNumber = await nextControlNumber();           // MARC 001
    const accessions = await nextAccessionNumbers(totalCopies); // 000001, 000002...
    const registerDate = await nextRegisterDate();             // MARC 008
    const authors: string[] = Array.isArray(body.authors) ? body.authors : [];
    const cutterCode = body.cutterCode?.trim() || generateCutter(authors);

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
        subjects: body.subjects || [],

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
        accessionNumber: accessions[0],
        totalCopies,

        // Periódicos (MARC 362)
        volume: body.volume,
        number: body.number,
        period: body.period,

        // Campos MARC extras
        customFields: body.customFields || [],
      },
    });

    // Cria um exemplar por cópia, com número de acervo e etiqueta próprios
    const exemplars = [];
    for (let i = 0; i < totalCopies; i++) {
      const accession = accessions[i];
      const exemplar = await prisma.exemplar.create({
        data: {
          catalogId: catalog.id,
          accessionNumber: accession,
          barcode: barcodeFromAccession(accession),
          callNumber: catalog.callNumber,
          cutterCode: catalog.cutterCode,
          status: initialStatus,
        },
        select: {
          id: true,
          accessionNumber: true,
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

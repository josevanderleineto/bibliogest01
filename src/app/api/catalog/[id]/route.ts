// ============================================
// BiblioGest - API Catálogo: Detalhe, Editar, Excluir
// ============================================

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { generateCutter, buildSearchText } from "@/lib/numbering";

export const dynamic = "force-dynamic";

// ============================================
// GET - Buscar por ID
// ============================================
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const catalog = await prisma.catalog.findUnique({
      where: { id: params.id },
      include: {
        exemplars: {
          select: {
            id: true,
            barcode: true,
            accessionNumber: true,
            callNumber: true,
            cutterCode: true,
            status: true,
            internalNote: true,
            loans: {
              where: { status: { in: ["ACTIVE", "OVERDUE", "RENEWED"] } },
              orderBy: { loanDate: "desc" },
              take: 1,
              select: {
                id: true,
                dueDate: true,
                status: true,
                user: { select: { id: true, name: true, email: true } },
              },
            },
          },
          orderBy: { accessionNumber: "asc" },
        },
      },
    });

    if (!catalog) {
      return NextResponse.json({ error: "Registro não encontrado" }, { status: 404 });
    }

    return NextResponse.json(catalog);
  } catch (error) {
    console.error("Catalog get error:", error);
    return NextResponse.json({ error: "Erro ao buscar registro" }, { status: 500 });
  }
}

// ============================================
// PUT - Atualizar registro
// ============================================
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();

    const current = await prisma.catalog.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        authors: true,
        contributors: true,
        subjects: true,
        title: true,
        subtitle: true,
        callNumber: true,
        cutterCode: true,
        classification: true,
        cdd: true,
        cdu: true,
        isbn: true,
        issn: true,
        edition: true,
        publisher: true,
        tombo: true,
        acquisitionNumber: true,
        accessionNumber: true,
      },
    });

    if (!current) {
      return NextResponse.json({ error: "Registro não encontrado" }, { status: 404 });
    }

    const authors = Array.isArray(body.authors) ? body.authors : undefined;
    const subjects = Array.isArray(body.subjects) ? body.subjects : undefined;
    const contributors = Array.isArray(body.contributors) ? body.contributors : undefined;

    // Refaz o texto de busca com os valores finais, para que a
    // consulta por autor/assunto continue funcionando após editar.
    const finais = {
      title: body.title ?? current.title,
      subtitle: body.subtitle ?? current.subtitle,
      authors: authors ?? current.authors,
      contributors: contributors ?? current.contributors,
      subjects: subjects ?? current.subjects,
      callNumber: body.callNumber ?? current.callNumber,
      cutterCode: body.cutterCode ?? current.cutterCode,
      classification: body.classification ?? current.classification,
      cdd: body.cdd ?? current.cdd,
      cdu: body.cdu ?? current.cdu,
      isbn: body.isbn ?? current.isbn,
      issn: body.issn ?? current.issn,
      edition: body.edition ?? current.edition,
      publisher: body.publisher ?? current.publisher,
      tombo: body.tombo ?? current.tombo,
      acquisition: current.acquisitionNumber ?? current.accessionNumber,
    };

    const catalog = await prisma.catalog.update({
      where: { id: params.id },
      data: {
        materialType: body.materialType,
        title: body.title,
        subtitle: body.subtitle,
        titleStatement: body.titleStatement,
        authors,
        contributors,
        edition: body.edition,
        publisher: body.publisher,
        publicationPlace: body.publicationPlace,
        publicationYear: body.publicationYear,
        seriesTitle: body.seriesTitle,
        seriesVolume: body.seriesVolume,
        isbn: body.isbn,
        issn: body.issn,
        subjects,
        classification: body.classification,
        cdd: body.cdd,
        cdu: body.cdu,
        physicalDesc: body.physicalDesc,
        generalNote: body.generalNote,
        bibReference: body.bibReference,
        uniformSeriesTitle: body.uniformSeriesTitle,
        callNumber: body.callNumber,
        cutterCode: body.cutterCode || (authors ? generateCutter(authors) : undefined),
        tombo: body.tombo?.trim() || null,
        coverUrl: body.coverUrl?.trim() || null,
        searchText: buildSearchText(finais),
        volume: body.volume,
        number: body.number,
        period: body.period,
        customFields: body.customFields,
      },
    });

    // Propaga número de chamada e cutter para os exemplares
    if (body.callNumber || body.cutterCode) {
      await prisma.exemplar.updateMany({
        where: { catalogId: params.id },
        data: {
          ...(body.callNumber ? { callNumber: body.callNumber } : {}),
          ...(body.cutterCode ? { cutterCode: body.cutterCode } : {}),
        },
      });
    }

    return NextResponse.json({ success: true, catalog });
  } catch (error) {
    console.error("Catalog update error:", error);
    return NextResponse.json({ error: "Erro ao atualizar registro" }, { status: 500 });
  }
}

// ============================================
// DELETE - Excluir registro
// ============================================
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const activeLoans = await prisma.loan.count({
      where: { catalogId: params.id, status: { in: ["ACTIVE", "OVERDUE", "RENEWED"] } },
    });

    if (activeLoans > 0) {
      return NextResponse.json(
        { error: "Não é possível excluir: existem empréstimos ativos" },
        { status: 400 }
      );
    }

    await prisma.catalog.delete({ where: { id: params.id } });

    return NextResponse.json({ success: true, message: "Registro excluído" });
  } catch (error) {
    console.error("Catalog delete error:", error);
    return NextResponse.json({ error: "Erro ao excluir registro" }, { status: 500 });
  }
}

// ============================================
// BiblioGest - API Catálogo: Detalhe, Editar, Excluir
// ============================================

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { generateCutter } from "@/lib/numbering";

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
      select: { id: true, authors: true },
    });

    if (!current) {
      return NextResponse.json({ error: "Registro não encontrado" }, { status: 404 });
    }

    const authors = Array.isArray(body.authors) ? body.authors : undefined;

    const catalog = await prisma.catalog.update({
      where: { id: params.id },
      data: {
        materialType: body.materialType,
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

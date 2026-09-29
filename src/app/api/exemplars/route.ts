// ============================================
// BiblioGest - API Exemplares
// Listagem, busca por código de barras,
// criação e alteração de status
// ============================================

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import type { ExemplarStatus } from "@prisma/client";
import { nextBarcode, nextExemplarNumber } from "@/lib/numbering";

export const dynamic = "force-dynamic";

const EXEMPLAR_SELECT = {
  id: true,
  catalogId: true,
  barcode: true,
  accessionNumber: true,
  exemplarNumber: true,
  callNumber: true,
  cutterCode: true,
  status: true,
  internalNote: true,
  createdAt: true,
} as const;

const VALID_STATUSES: ExemplarStatus[] = [
  "AVAILABLE",
  "LOANED",
  "PROCESSING",
  "RESTORATION",
  "MAINTENANCE",
  "LOST",
];

// ============================================
// GET - Listar exemplares / buscar por código de barras
// ============================================
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const catalogId = searchParams.get("catalogId");
    const status = searchParams.get("status");
    const barcode = searchParams.get("barcode");
    const q = searchParams.get("q") || "";
    const tombo = searchParams.get("tombo") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");

    // Busca exata por código de barras (usada no fluxo de empréstimo)
    if (barcode) {
      const exemplar = await prisma.exemplar.findFirst({
        where: { barcode: { equals: barcode.trim(), mode: "insensitive" } },
        select: {
          ...EXEMPLAR_SELECT,
          catalog: {
            select: {
              id: true,
              title: true,
              subtitle: true,
              authors: true,
              isbn: true,
              callNumber: true,
              classification: true,
            },
          },
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
      });

      if (!exemplar) {
        return NextResponse.json(
          { error: "Exemplar não encontrado para este código de barras" },
          { status: 404 }
        );
      }

      return NextResponse.json({ exemplar });
    }

    const where: any = {};
    if (catalogId) where.catalogId = catalogId;
    if (status) where.status = status;
    if (tombo) where.catalog = { tombo: { equals: tombo.trim(), mode: "insensitive" } };
    if (q) {
      const matchTerm = (term: string) => {
        // "Ex.3" / "exemplar 3" procura pelo número do exemplar
        const comoExemplar = term.match(/^(?:ex\.?|exemplar)\s*0*(\d{1,4})$/i);
        if (comoExemplar) {
          return [{ exemplarNumber: parseInt(comoExemplar[1], 10) }];
        }
        return [
          { barcode: { contains: term, mode: "insensitive" } },
          { accessionNumber: { contains: term, mode: "insensitive" } },
          { callNumber: { contains: term, mode: "insensitive" } },
          { cutterCode: { contains: term, mode: "insensitive" } },
          { catalog: { title: { contains: term, mode: "insensitive" } } },
          { catalog: { authors: { has: term } } },
          { catalog: { subjects: { has: term } } },
          { catalog: { classification: { contains: term, mode: "insensitive" } } },
          { catalog: { accessionNumber: { contains: term, mode: "insensitive" } } },
          // cobre busca por parte do nome do autor e do assunto
          { catalog: { searchText: { contains: term.toLowerCase(), mode: "insensitive" } } },
        ];
      };

      // Todos os termos precisam existir (ex.: "004.67 M278")
      const terms = q.trim().split(/\s+/).filter(Boolean);
      if (terms.length > 1) {
        where.AND = terms.map((term) => ({ OR: matchTerm(term) }));
      } else {
        where.OR = matchTerm(terms[0]);
      }
    }

    const [exemplars, total] = await Promise.all([
      prisma.exemplar.findMany({
        where,
        select: {
          ...EXEMPLAR_SELECT,
          catalog: {
            select: {
              id: true,
              title: true,
              authors: true,
              callNumber: true,
              cutterCode: true,
              classification: true,
              tombo: true,
            },
          },
        },
        orderBy: [{ status: "asc" }, { accessionNumber: "asc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.exemplar.count({ where }),
    ]);

    return NextResponse.json({ exemplars, total, page });
  } catch (error) {
    console.error("Exemplars list error:", error);
    return NextResponse.json(
      { error: "Erro ao buscar exemplares" },
      { status: 500 }
    );
  }
}

// ============================================
// POST - Inserir exemplar em acervo já existente
//
// Cópia do mesmo item NÃO vira registro novo: entra como
// mais um exemplar dentro do mesmo número de acervo.
// ============================================
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.catalogId) {
      return NextResponse.json(
        { error: "catálogo (catalogId) é obrigatório" },
        { status: 400 }
      );
    }

    const catalog = await prisma.catalog.findUnique({
      where: { id: body.catalogId },
      select: {
        id: true,
        callNumber: true,
        cutterCode: true,
        accessionNumber: true,
        acquisitionNumber: true,
      },
    });

    if (!catalog) {
      return NextResponse.json({ error: "Catálogo não encontrado" }, { status: 404 });
    }

    const requestedStatus = String(body.status || "AVAILABLE").toUpperCase();
    const status: ExemplarStatus = VALID_STATUSES.includes(
      requestedStatus as ExemplarStatus
    )
      ? (requestedStatus as ExemplarStatus)
      : "AVAILABLE";

    // O acervo é o do registro: nunca muda ao acrescentar cópias.
    const acervo = catalog.acquisitionNumber || catalog.accessionNumber || null;

    // Quantas cópias inserir (padrão: 1)
    const quantidade = Math.min(Math.max(1, parseInt(body.quantity) || 1), 200);

    const created = [];
    for (let i = 0; i < quantidade; i++) {
      created.push(
        await prisma.exemplar.create({
          data: {
            catalogId: catalog.id,
            accessionNumber: acervo,
            exemplarNumber: await nextExemplarNumber(catalog.id),
            barcode: await nextBarcode(),
            callNumber: body.callNumber ?? catalog.callNumber,
            cutterCode: body.cutterCode ?? catalog.cutterCode,
            status,
            internalNote: body.internalNote,
          },
          select: {
            ...EXEMPLAR_SELECT,
            catalog: {
              select: { id: true, title: true, accessionNumber: true },
            },
          },
        })
      );
    }

    // Mantém o total de cópias do catálogo em dia
    const total = await prisma.exemplar.count({ where: { catalogId: catalog.id } });
    await prisma.catalog.update({
      where: { id: catalog.id },
      data: { totalCopies: total },
    });

    return NextResponse.json({
      success: true,
      exemplars: created,
      message:
        created.length === 1
          ? "Exemplar inserido no acervo"
          : `${created.length} exemplares inseridos no acervo`,
    });
  } catch (error) {
    console.error("Exemplar create error:", error);
    return NextResponse.json(
      { error: "Erro ao criar exemplar" },
      { status: 500 }
    );
  }
}

// ============================================
// PUT - Alterar status / dados do exemplar
// ============================================
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, status, internalNote, callNumber, cutterCode } = body;

    if (!id) {
      return NextResponse.json(
        { error: "ID do exemplar é obrigatório" },
        { status: 400 }
      );
    }

    const current = await prisma.exemplar.findUnique({
      where: { id },
      select: { id: true, status: true, catalogId: true },
    });

    if (!current) {
      return NextResponse.json({ error: "Exemplar não encontrado" }, { status: 404 });
    }

    // Não permite marcar como disponível enquanto houver empréstimo ativo
    if (status && status !== "AVAILABLE" && current.status === "AVAILABLE") {
      const activeLoan = await prisma.loan.findFirst({
        where: { exemplarId: id, status: { in: ["ACTIVE", "OVERDUE", "RENEWED"] } },
        select: { id: true },
      });
      if (activeLoan) {
        return NextResponse.json(
          { error: "Exemplar possui empréstimo ativo" },
          { status: 400 }
        );
      }
    }

    const data: any = {};
    if (status) {
      const upper = String(status).toUpperCase();
      if (!VALID_STATUSES.includes(upper as ExemplarStatus)) {
        return NextResponse.json({ error: "Status inválido" }, { status: 400 });
      }
      data.status = upper;
    }
    if (internalNote !== undefined) data.internalNote = internalNote;
    if (callNumber !== undefined) data.callNumber = callNumber;
    if (cutterCode !== undefined) data.cutterCode = cutterCode;

    const exemplar = await prisma.exemplar.update({
      where: { id },
      data,
      select: EXEMPLAR_SELECT,
    });

    return NextResponse.json({ success: true, exemplar });
  } catch (error) {
    console.error("Exemplar update error:", error);
    return NextResponse.json(
      { error: "Erro ao atualizar exemplar" },
      { status: 500 }
    );
  }
}

// ============================================
// DELETE - Remover exemplar
// ============================================
export async function DELETE(request: NextRequest) {
  try {
    const { id } = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: "ID do exemplar é obrigatório" },
        { status: 400 }
      );
    }

    const activeLoan = await prisma.loan.findFirst({
      where: { exemplarId: id, status: { in: ["ACTIVE", "OVERDUE", "RENEWED"] } },
      select: { id: true },
    });

    if (activeLoan) {
      return NextResponse.json(
        { error: "Não é possível remover: exemplar tem empréstimo ativo" },
        { status: 400 }
      );
    }

    const exemplar = await prisma.exemplar.findUnique({
      where: { id },
      select: { catalogId: true },
    });

    await prisma.exemplar.delete({ where: { id } });

    if (exemplar) {
      const count = await prisma.exemplar.count({
        where: { catalogId: exemplar.catalogId },
      });
      await prisma.catalog.update({
        where: { id: exemplar.catalogId },
        data: { totalCopies: count },
      });
    }

    return NextResponse.json({ success: true, message: "Exemplar removido" });
  } catch (error) {
    console.error("Exemplar delete error:", error);
    return NextResponse.json(
      { error: "Erro ao remover exemplar" },
      { status: 500 }
    );
  }
}

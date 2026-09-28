// ============================================
// BiblioGest - API Empréstimos
//
// Fluxo de empréstimo (terminal com leitor de código de barras):
//   1. Usuário digita a matrícula (e-mail)
//   2. Escaneia o código de barras do exemplar
//   3. Confirma com a senha
//
// Fluxo de devolução:
//   Basta escanear o código de barras do exemplar
// ============================================

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { addDays } from "date-fns";
import { verifyPassword } from "@/lib/auth";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

// ============================================
// GET - Listar empréstimos
// ============================================
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const userId = searchParams.get("userId");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) where.status = status;
    if (userId) where.userId = userId;

    const [loans, total] = await Promise.all([
      prisma.loan.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true } },
          catalog: { select: { id: true, title: true } },
          exemplar: {
            select: {
              id: true,
              barcode: true,
              accessionNumber: true,
              callNumber: true,
              cutterCode: true,
            },
          },
        },
        orderBy: { loanDate: "desc" },
        skip,
        take: limit,
      }),
      prisma.loan.count({ where }),
    ]);

    return NextResponse.json({ loans, total, page, totalPages: Math.max(1, Math.ceil(total / limit)) });
  } catch (error) {
    console.error("Loans list error:", error);
    return NextResponse.json({ error: "Erro ao buscar empréstimos" }, { status: 500 });
  }
}

// ============================================
// POST - Empréstimo (matrícula + senha + código de barras)
//        ou Devolução (apenas código de barras)
// ============================================
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action = "loan", email, password, barcode, dueDate } = body;

    // ================= DEVOLUÇÃO =================
    if (action === "return") {
      if (!barcode) {
        return NextResponse.json(
          { success: false, error: "Código de barras é obrigatório" },
          { status: 400 }
        );
      }

      const exemplar = await prisma.exemplar.findFirst({
        where: { barcode: { equals: barcode.trim(), mode: "insensitive" } },
        select: {
          id: true,
          catalogId: true,
          barcode: true,
          loans: {
            where: { status: { in: ["ACTIVE", "OVERDUE", "RENEWED"] } },
            orderBy: { loanDate: "desc" },
            take: 1,
            include: {
              user: { select: { name: true, email: true } },
              catalog: { select: { title: true } },
            },
          },
        },
      });

      if (!exemplar) {
        return NextResponse.json(
          { success: false, error: "Exemplar não encontrado" },
          { status: 404 }
        );
      }

      const loan = exemplar.loans?.[0];
      if (!loan) {
        return NextResponse.json(
          { success: false, error: "Este exemplar não possui empréstimo ativo" },
          { status: 400 }
        );
      }

      const now = new Date();
      const wasOverdue = new Date(loan.dueDate) < now;

      await prisma.loan.update({
        where: { id: loan.id },
        data: {
          status: "RETURNED",
          actualReturnDate: now,
          returnDate: now,
        },
      });

      await prisma.exemplar.update({
        where: { id: exemplar.id },
        data: { status: "AVAILABLE" },
      });

      return NextResponse.json({
        success: true,
        message: wasOverdue ? "Devolução realizada (em atraso)" : "Devolução realizada",
        data: {
          barcode: exemplar.barcode,
          title: loan.catalog.title,
          userName: loan.user.name,
          dueDate: loan.dueDate,
          returnedAt: now.toISOString(),
          wasOverdue,
        },
      });
    }

    // ================= EMPRÉSTIMO =================

    // 1. Localizar usuário pela matrícula (e-mail)
    if (!email) {
      return NextResponse.json(
        { success: false, error: "Matrícula (e-mail) é obrigatória" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Usuário não encontrado" },
        { status: 404 }
      );
    }

    if (!user.isActive) {
      return NextResponse.json(
        { success: false, error: "Usuário inativo" },
        { status: 403 }
      );
    }

    // 2. Validar senha
    if (!password) {
      return NextResponse.json(
        { success: false, error: "Senha é obrigatória" },
        { status: 400 }
      );
    }

    const passwordOk = await verifyPassword(password, user.password);
    // Compatibilidade com contas legadas com senha em texto puro
    if (!passwordOk && user.password !== password) {
      return NextResponse.json(
        { success: false, error: "Senha incorreta" },
        { status: 401 }
      );
    }

    // 3. Localizar exemplar pelo código de barras
    if (!barcode) {
      return NextResponse.json(
        { success: false, error: "Código de barras é obrigatório" },
        { status: 400 }
      );
    }

    const exemplar = await prisma.exemplar.findFirst({
      where: { barcode: { equals: barcode.trim(), mode: "insensitive" } },
      include: { catalog: { select: { id: true, title: true } } },
    });

    if (!exemplar) {
      return NextResponse.json(
        { success: false, error: "Exemplar não encontrado" },
        { status: 404 }
      );
    }

    if (exemplar.status !== "AVAILABLE") {
      const friendly: Record<string, string> = {
        LOANED: "Exemplar já está emprestado",
        PROCESSING: "Exemplar em processamento",
        RESTORATION: "Exemplar em restauro",
        MAINTENANCE: "Exemplar em manutenção",
        LOST: "Exemplar marcado como perdido",
      };
      return NextResponse.json(
        { success: false, error: friendly[exemplar.status] || "Exemplar indisponível" },
        { status: 400 }
      );
    }

    // 4. Regras de empréstimo (definidas em Configurações)
    const rules = await getSettings();

    const userActiveLoans = await prisma.loan.count({
      where: { userId: user.id, status: { in: ["ACTIVE", "OVERDUE", "RENEWED"] } },
    });
    if (userActiveLoans >= rules.maxLoansPerUser) {
      return NextResponse.json(
        {
          success: false,
          error: `Limite de ${rules.maxLoansPerUser} empréstimos simultâneos atingido`,
        },
        { status: 400 }
      );
    }

    const userOverdue = await prisma.loan.count({
      where: { userId: user.id, status: "OVERDUE" },
    });
    if (userOverdue > 0) {
      return NextResponse.json(
        { success: false, error: "Usuário possui empréstimo em atraso" },
        { status: 403 }
      );
    }

    // 5. Registrar empréstimo
    const loan = await prisma.loan.create({
      data: {
        catalogId: exemplar.catalogId,
        exemplarId: exemplar.id,
        userId: user.id,
        dueDate: dueDate ? new Date(dueDate) : addDays(new Date(), rules.loanDays),
        status: "ACTIVE",
      },
    });

    await prisma.exemplar.update({
      where: { id: exemplar.id },
      data: { status: "LOANED" },
    });

    return NextResponse.json({
      success: true,
      message: "Empréstimo realizado com sucesso",
      data: {
        loanId: loan.id,
        barcode: exemplar.barcode,
        title: exemplar.catalog.title,
        userName: user.name,
        dueDate: loan.dueDate.toISOString(),
      },
    });
  } catch (error) {
    console.error("Loan create error:", error);
    return NextResponse.json(
      { success: false, error: "Erro ao registrar empréstimo" },
      { status: 500 }
    );
  }
}

// ============================================
// PUT - Devolver / Renovar / alterar status
// ============================================
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, action } = body;

    if (!id) {
      return NextResponse.json({ error: "ID do empréstimo é obrigatório" }, { status: 400 });
    }

    const loan = await prisma.loan.findUnique({
      where: { id },
      include: { exemplar: { select: { id: true, status: true } } },
    });

    if (!loan) {
      return NextResponse.json({ error: "Empréstimo não encontrado" }, { status: 404 });
    }

    if (action === "return") {
      const now = new Date();
      await prisma.loan.update({
        where: { id },
        data: { status: "RETURNED", actualReturnDate: now, returnDate: now },
      });
      await prisma.exemplar.update({
        where: { id: loan.exemplarId },
        data: { status: "AVAILABLE" },
      });
    } else if (action === "renew") {
      const rules = await getSettings();

      if (loan.status === "RETURNED") {
        return NextResponse.json(
          { error: "Empréstimo já devolvido" },
          { status: 400 }
        );
      }
      if (rules.maxRenewals <= 0) {
        return NextResponse.json(
          { error: "Renovações não permitidas pela biblioteca" },
          { status: 400 }
        );
      }
      if (loan.renewalCount >= rules.maxRenewals) {
        return NextResponse.json(
          { error: `Máximo de ${rules.maxRenewals} renovações atingido` },
          { status: 400 }
        );
      }
      if (new Date(loan.dueDate) < new Date()) {
        return NextResponse.json(
          { error: "Empréstimo em atraso não pode ser renovado" },
          { status: 400 }
        );
      }

      await prisma.loan.update({
        where: { id },
        data: {
          dueDate: addDays(new Date(loan.dueDate), rules.loanDays),
          renewalCount: { increment: 1 },
          status: "ACTIVE",
        },
      });
    } else {
      return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Loan update error:", error);
    return NextResponse.json(
      { error: "Erro ao atualizar empréstimo" },
      { status: 500 }
    );
  }
}

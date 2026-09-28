// ============================================
// BiblioGest - API Relatórios
// ============================================

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { format, startOfMonth, endOfMonth } from "date-fns";

export const dynamic = "force-dynamic";

// GET - Gerar relatórios
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "summary";
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    let data: any = {};

    switch (type) {
      case "summary":
        // Resumo geral do acervo
        const [totalTitles, totalExemplars, availableExemplars, activeLoansCount, overdueLoansCount] =
          await Promise.all([
            prisma.catalog.count(),
            prisma.exemplar.count(),
            prisma.exemplar.count({ where: { status: "AVAILABLE" } }),
            prisma.loan.count({ where: { status: "ACTIVE" } }),
            prisma.loan.count({ where: { status: "OVERDUE" } }),
          ]);

        data = {
          totalTitles,
          totalExemplars,
          availableExemplars,
          totalLoans: activeLoansCount,
          overdueLoans: overdueLoansCount,
          percentageAvailable:
            totalExemplars > 0
              ? ((availableExemplars / totalExemplars) * 100).toFixed(1)
              : 0,
        };
        break;

      case "loans":
        // Empréstimos por período
        const loanWhere: any = {};
        if (startDate && endDate) {
          loanWhere.loanDate = {
            gte: new Date(startDate),
            lte: new Date(endDate),
          };
        } else {
          loanWhere.loanDate = {
            gte: startOfMonth(new Date()),
            lte: endOfMonth(new Date()),
          };
        }

        const loansByMonth = await prisma.loan.groupBy({
          by: ["status"],
          where: loanWhere,
          _count: { id: true },
        });

        const totalLoansCount = await prisma.loan.count({ where: loanWhere });

        data = {
          totalLoans: totalLoansCount,
          byStatus: loansByMonth,
          period: { start: startDate || format(startOfMonth(new Date()), "yyyy-MM-dd"), end: endDate || format(endOfMonth(new Date()), "yyyy-MM-dd") },
        };
        break;

      case "overdue":
        // Devoluções em atraso
        const overdueItems = await prisma.loan.findMany({
          where: { status: "OVERDUE" },
          include: {
            user: { select: { id: true, name: true, email: true } },
            catalog: { select: { id: true, title: true } },
            exemplar: {
              select: { barcode: true, accessionNumber: true, callNumber: true },
            },
          },
          orderBy: { dueDate: "asc" },
        });

        data = { overdueLoans: overdueItems, count: overdueItems.length };
        break;

      case "catalog":
        // Estatísticas do acervo por tipo
        const catalogByMaterial = await prisma.catalog.groupBy({
          by: ["materialType"],
          _count: { id: true },
        });

        const exemplarsByStatus = await prisma.exemplar.groupBy({
          by: ["status"],
          _count: { id: true },
        });

        data = { catalogByMaterial, exemplarsByStatus };
        break;
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Reports error:", error);
    return NextResponse.json(
      { error: "Erro ao gerar relatório" },
      { status: 500 }
    );
  }
}

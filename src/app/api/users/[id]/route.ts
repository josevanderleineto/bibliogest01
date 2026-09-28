// ============================================
// BiblioGest - API Usuário: Detalhe, Editar, Desativar
// ============================================

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import type { UserRole } from "@prisma/client";

export const dynamic = "force-dynamic";

const VALID_ROLES: UserRole[] = ["ADMIN", "LIBRARIAN", "ASSISTANT"];

const SAFE_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  failedAttempts: true,
  lockedUntil: true,
  lastLoginAt: true,
  createdAt: true,
  _count: { select: { loans: true } },
} as const;

// ============================================
// GET - Detalhe do usuário
// ============================================
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: params.id },
      select: {
        ...SAFE_SELECT,
        loans: {
          orderBy: { loanDate: "desc" },
          take: 10,
          select: {
            id: true,
            loanDate: true,
            dueDate: true,
            status: true,
            catalog: { select: { id: true, title: true } },
            exemplar: { select: { barcode: true, accessionNumber: true } },
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error("User get error:", error);
    return NextResponse.json({ error: "Erro ao buscar usuário" }, { status: 500 });
  }
}

// ============================================
// PUT - Atualizar usuário
// ============================================
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();

    const current = await prisma.user.findUnique({
      where: { id: params.id },
      select: { id: true, role: true },
    });

    if (!current) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
    }

    const data: any = {};

    if (body.name !== undefined) data.name = body.name;
    if (body.email !== undefined) data.email = body.email;
    if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);

    if (body.role !== undefined) {
      const role = String(body.role).toUpperCase() as UserRole;
      if (!VALID_ROLES.includes(role)) {
        return NextResponse.json({ error: "Função inválida" }, { status: 400 });
      }
      // Impede remover o último administrador ativo
      if (current.role === "ADMIN" && role !== "ADMIN" && current.id === params.id) {
        const admins = await prisma.user.count({
          where: { role: "ADMIN", isActive: true },
        });
        if (admins <= 1) {
          return NextResponse.json(
            { error: "Não é possível remover o último administrador" },
            { status: 400 }
          );
        }
      }
      data.role = role;
    }

    if (body.newPassword) {
      if (String(body.newPassword).length < 6) {
        return NextResponse.json(
          { error: "A senha deve ter no mínimo 6 caracteres" },
          { status: 400 }
        );
      }
      data.password = await hashPassword(body.newPassword);
    }

    // Desbloqueio
    if (body.unlock) {
      data.failedAttempts = 0;
      data.lockedUntil = null;
    }

    const user = await prisma.user.update({
      where: { id: params.id },
      data,
      select: SAFE_SELECT,
    });

    return NextResponse.json({ success: true, user });
  } catch (error) {
    console.error("User update error:", error);
    return NextResponse.json({ error: "Erro ao atualizar usuário" }, { status: 500 });
  }
}

// ============================================
// DELETE - Desativar usuário
// ============================================
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const current = await prisma.user.findUnique({
      where: { id: params.id },
      select: { id: true, role: true },
    });

    if (!current) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
    }

    if (current.role === "ADMIN") {
      const admins = await prisma.user.count({
        where: { role: "ADMIN", isActive: true },
      });
      if (admins <= 1) {
        return NextResponse.json(
          { error: "Não é possível desativar o último administrador" },
          { status: 400 }
        );
      }
    }

    // Não desativa se tiver empréstimo em aberto
    const activeLoans = await prisma.loan.count({
      where: { userId: params.id, status: { in: ["ACTIVE", "OVERDUE", "RENEWED"] } },
    });

    if (activeLoans > 0) {
      return NextResponse.json(
        { error: `Usuário possui ${activeLoans} empréstimo(s) em aberto` },
        { status: 400 }
      );
    }

    await prisma.user.update({
      where: { id: params.id },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true, message: "Usuário desativado" });
  } catch (error) {
    console.error("User delete error:", error);
    return NextResponse.json({ error: "Erro ao desativar usuário" }, { status: 500 });
  }
}

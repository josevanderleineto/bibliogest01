// ============================================
// BiblioGest - API Usuários do Sistema
// ============================================

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

const USER_SELECT = {
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
// GET - Listar / buscar usuários
// ============================================
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") || "";
    const role = searchParams.get("role") || "";
    const isActive = searchParams.get("isActive");

    const where: any = {};
    if (q) {
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
      ];
    }
    if (role) where.role = role;
    if (isActive !== null && isActive !== "") {
      where.isActive = isActive === "true";
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: USER_SELECT,
        orderBy: { name: "asc" },
      }),
      prisma.user.count({ where }),
    ]);

    return NextResponse.json({ users, total });
  } catch (error) {
    console.error("Users list error:", error);
    return NextResponse.json({ error: "Erro ao buscar usuários" }, { status: 500 });
  }
}

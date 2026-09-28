// ============================================
// BiblioGest - API Auth: Registro de usuários
// ============================================

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import type { UserRole } from "@prisma/client";

export const dynamic = "force-dynamic";

const VALID_ROLES: UserRole[] = ["ADMIN", "LIBRARIAN", "ASSISTANT"];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, password, role } = body;

    if (!name || !email || !password) {
      return NextResponse.json(
        { success: false, error: "Nome, e-mail e senha são obrigatórios" },
        { status: 400 }
      );
    }

    if (String(password).length < 6) {
      return NextResponse.json(
        { success: false, error: "A senha deve ter no mínimo 6 caracteres" },
        { status: 400 }
      );
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      return NextResponse.json(
        { success: false, error: "E-mail já cadastrado" },
        { status: 409 }
      );
    }

    const normalizedRole = String(role || "LIBRARIAN").toUpperCase() as UserRole;
    const finalRole = VALID_ROLES.includes(normalizedRole) ? normalizedRole : "LIBRARIAN";

    const user = await prisma.user.create({
      data: {
        name: String(name).trim(),
        email: normalizedEmail,
        password: await hashPassword(password),
        role: finalRole,
      },
      select: { id: true, name: true, email: true, role: true, isActive: true },
    });

    return NextResponse.json({
      success: true,
      message: "Usuário criado com sucesso",
      user,
    });
  } catch (error) {
    console.error("Register error:", error);
    return NextResponse.json(
      { success: false, error: "Erro ao criar usuário" },
      { status: 500 }
    );
  }
}

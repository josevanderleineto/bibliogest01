// ============================================
// BiblioGest - API Auth: Login
// ============================================

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyPassword, generateToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

const MAX_ATTEMPTS = parseInt(process.env.LOGIN_MAX_ATTEMPTS || "5", 10);
const BLOCK_MINUTES = parseInt(process.env.LOGIN_BLOCK_DURATION_MINUTES || "15", 10);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: "E-mail e senha são obrigatórios" },
        { status: 400 }
      );
    }

    // Buscar usuário (normaliza o e-mail)
    const normalizedEmail = String(email).trim().toLowerCase();

    const user = await prisma.user.findFirst({
      where: {
        OR: [{ email: normalizedEmail }, { email: { equals: normalizedEmail, mode: "insensitive" } }],
      },
    });

    if (!user || !user.isActive) {
      return NextResponse.json(
        { success: false, error: "Usuário não encontrado ou desativado" },
        { status: 401 }
      );
    }

    // Verificar se está bloqueado
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const remainingMinutes = Math.ceil(
        (user.lockedUntil.getTime() - new Date().getTime()) / 60000
      );
      return NextResponse.json(
        { success: false, error: `Conta bloqueada. Tente novamente em ${remainingMinutes} minutos.` },
        { status: 403 }
      );
    }

    // Verificar senha
    const validPassword = await verifyPassword(password, user.password);
    if (!validPassword) {
      // Libera o bloqueio ao atingir o limite (evita conta presa para sempre)
      // Incrementar tentativas falhas
      const newFailedAttempts = user.failedAttempts + 1;
      let lockedUntil = null;

      if (newFailedAttempts >= MAX_ATTEMPTS) {
        lockedUntil = new Date(Date.now() + BLOCK_MINUTES * 60 * 1000);
      }

      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedAttempts: newFailedAttempts,
          lockedUntil,
        },
      });

      return NextResponse.json(
        {
          success: false,
          error: `Senha incorreta. ${Math.max(0, MAX_ATTEMPTS - newFailedAttempts)} tentativa(s) restante(s).${lockedUntil ? ` Conta bloqueada por ${BLOCK_MINUTES} minutos.` : ""}`,
        },
        { status: 401 }
      );
    }

    // Resetar tentativas falhas
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
      },
    });

    // Gerar token JWT
    const token = generateToken(user.id);

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      token,
    });

    // Cookie para manter sessão
    response.cookies.set("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 604800, // 7 dias
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

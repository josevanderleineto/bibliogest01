// ============================================
// BiblioGest - API Configurações
// GET  : leitura (pública — usada no cabeçalho e no catálogo)
// PUT  : alteração (somente administrador)
// ============================================

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { verifyToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

const MAX = {
  loanDays: 90,
  maxLoansPerUser: 20,
  maxRenewals: 10,
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));

const str = (v: unknown, max = 200) =>
  typeof v === "string" ? v.trim().slice(0, max) : null;

/** Só aceita http/https — evita injeção de javascript: no src da img. */
const urlOrNull = (v: unknown, max = 600) => {
  const s = str(v, max);
  if (!s) return null;
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
};

// ============================================
// GET - Configurações
// ============================================
export async function GET() {
  try {
    const settings = await getSettings();
    return NextResponse.json({ settings });
  } catch (error) {
    console.error("Settings read error:", error);
    return NextResponse.json({ error: "Erro ao carregar configurações" }, { status: 500 });
  }
}

// ============================================
// PUT - Atualizar configurações (admin)
// ============================================
export async function PUT(request: NextRequest) {
  try {
    // Somente administrador pode alterar
    const token = request.cookies.get("token")?.value;
    const decoded = token ? verifyToken(token) : null;

    if (!decoded) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, role: true, isActive: true },
    });

    if (!user || !user.isActive) {
      return NextResponse.json({ error: "Sessão inválida" }, { status: 401 });
    }

    if (user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Apenas administradores podem alterar as configurações" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const current = await getSettings();

    const data: Record<string, unknown> = { updatedBy: user.id };

    if (body.institutionName !== undefined) {
      const v = str(body.institutionName, 150);
      if (!v) {
        return NextResponse.json(
          { error: "O nome da instituição é obrigatório" },
          { status: 400 }
        );
      }
      data.institutionName = v;
    }
    if (body.institutionAcronym !== undefined) {
      data.institutionAcronym = (str(body.institutionAcronym, 20) || "").toUpperCase();
    }
    if (body.libraryName !== undefined) {
      const v = str(body.libraryName, 150);
      if (!v) {
        return NextResponse.json(
          { error: "O nome da biblioteca é obrigatório" },
          { status: 400 }
        );
      }
      data.libraryName = v;
    }
    if (body.libraryCode !== undefined) data.libraryCode = str(body.libraryCode, 30);
    if (body.address !== undefined) data.address = str(body.address, 300);
    if (body.phone !== undefined) data.phone = str(body.phone, 40);
    if (body.email !== undefined) {
      const v = str(body.email, 120);
      if (v && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) {
        return NextResponse.json({ error: "E-mail inválido" }, { status: 400 });
      }
      data.email = v;
    }
    if (body.website !== undefined) data.website = str(body.website, 200);
    if (body.logoUrl !== undefined) {
      const v = str(body.logoUrl, 600);
      if (v && !urlOrNull(v)) {
        return NextResponse.json(
          { error: "URL do logotipo inválida (use http:// ou https://)" },
          { status: 400 }
        );
      }
      data.logoUrl = urlOrNull(v);
    }

    if (body.loanDays !== undefined) {
      data.loanDays = clamp(Number(body.loanDays), 1, MAX.loanDays);
    }
    if (body.maxLoansPerUser !== undefined) {
      data.maxLoansPerUser = clamp(Number(body.maxLoansPerUser), 1, MAX.maxLoansPerUser);
    }
    if (body.maxRenewals !== undefined) {
      data.maxRenewals = clamp(Number(body.maxRenewals), 0, MAX.maxRenewals);
    }
    if (body.showCredit !== undefined) data.showCredit = Boolean(body.showCredit);

    const settings = await prisma.settings.upsert({
      where: { id: current.id },
      create: { id: current.id, ...data },
      update: data,
    });

    return NextResponse.json({
      success: true,
      settings,
      message: "Configurações salvas",
    });
  } catch (error) {
    console.error("Settings update error:", error);
    return NextResponse.json({ error: "Erro ao salvar configurações" }, { status: 500 });
  }
}

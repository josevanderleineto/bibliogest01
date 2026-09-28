// ============================================
// BiblioGest - Funções de Autenticação JWT
// ============================================

import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

const JWT_SECRET = process.env.JWT_SECRET || "mudar-para-uma-chave-segura";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

// Hash de senha
export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(12);
  return bcrypt.hash(password, salt);
}

// Verificar senha
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Criar token JWT
export function generateToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as any) as string;
}

// Verificar token JWT
export function verifyToken(token: string): { userId: string } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as { userId: string };
  } catch {
    return null;
  }
}

// Extrair token do header Authorization
export function getTokenFromHeader(authHeader: string | null): string | null {
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  return authHeader.substring(7);
}

// Gerar código Cutter (letra do primeiro autor + número)
export function generateCutterCode(author: string): string {
  if (!author || author.length === 0) return "";
  const firstLetter = author.charAt(0).toUpperCase();
  const cleanName = author.replace(/[^a-zA-Z]/g, "");
  const numbers = cleanName.length > 1 ? cleanName.charCodeAt(1) - 96 : 1;
  return `${firstLetter}${numbers.toString().padStart(3, "0")}`;
}

// Gerar código de barras simples
export function generateBarcode(catalogId: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `BG-${catalogId}-${timestamp}-${random}`;
}

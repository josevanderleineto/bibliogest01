// ============================================
// BiblioGest - Numeração Automática
// Gera MARC 001 (controle), número de acervo e
// códigos de barras sequenciais e únicos
// ============================================

import prisma from "@/lib/prisma";

/**
 * Gera um número sequencial único para a chave informada.
 * Usa upsert + increment para garantir unicidade mesmo
 * com requisições simultâneas.
 */
export async function nextSequence(key: string, amount = 1): Promise<number> {
  const counter = await prisma.counter.upsert({
    where: { key },
    create: { key, value: amount },
    update: { value: { increment: amount } },
  });

  // Se acabou de criar, o value já é o número final
  return counter.value;
}

/** Próximo número de controle MARC 001 (ex: 000123) */
export async function nextControlNumber(): Promise<string> {
  const n = await nextSequence("marc001");
  return n.toString().padStart(6, "0");
}

/** Próximo número de registro MARC 008 (ex: 20260928) */
export async function nextRegisterDate(): Promise<string> {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

/** Próximos N números de acervo sequenciais (ex: 000001, 000002) */
export async function nextAccessionNumbers(amount: number): Promise<string[]> {
  if (amount <= 0) return [];
  const final = await nextSequence("acervo", amount);
  const start = final - amount + 1;
  return Array.from({ length: amount }, (_, i) =>
    (start + i).toString().padStart(6, "0")
  );
}

/**
 * Código de barras do exemplar.
 *
 * Apenas dígitos: assim o bip funciona em qualquer leitor
 * (Code 39, Code 128, EAN-13, UPC) e pode ser lido por outros
 * sistemas de biblioteca, como no Koha.
 */
export function barcodeFromAccession(accessionNumber: string): string {
  return String(accessionNumber ?? "").replace(/\D+/g, "");
}

/** Gera código Cutter a partir dos autores */
export function generateCutter(authors: string[]): string {
  if (!authors || authors.length === 0) return "";

  const firstAuthor = authors[0].trim();
  if (!firstAuthor) return "";

  // Formato "Sobrenome, Nome" → usa sobrenome
  const parts = firstAuthor.split(",");
  const surname = (parts[0] || firstAuthor).trim();

  // Remove acentos e caracteres especiais
  const normalized = surname
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z]/g, "");

  if (!normalized) return "";

  const firstLetter = normalized.charAt(0).toUpperCase();

  // 3 letras + 3 números a partir do nome (determinístico, sem Math.random)
  const letters = (normalized.slice(1, 4) || "000")
    .toUpperCase()
    .padEnd(3, "0");

  let hash = 0;
  for (let i = 0; i < firstAuthor.length; i++) {
    hash = (hash * 31 + firstAuthor.charCodeAt(i)) % 1000;
  }

  return `${firstLetter}${letters}${String(hash).padStart(3, "0")}`;
}

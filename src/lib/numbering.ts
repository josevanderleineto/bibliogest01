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

/**
 * Próximo NÚMERO DE ACERVO.
 *
 * O acervo identifica a aquisição: um número por título adquirido.
 * Todos os exemplares daquela aquisição compartilham o mesmo acervo —
 * é o que permite reconhecer que duas cópias são o mesmo item.
 * Só muda quando o título é adquirido novamente.
 */
export async function nextAcquisitionNumber(): Promise<string> {
  const n = await nextSequence("acervo");
  return n.toString().padStart(6, "0");
}

/**
 * Próximo CÓDIGO DE BARRAS, único no acervo inteiro.
 *
 * Cada exemplar físico tem o seu, porque o leitor precisa
 * distinguir uma cópia da outra. Sequencial global para
 * garantir que nenhum se repita.
 */
export async function nextBarcode(): Promise<string> {
  const n = await nextSequence("barcode");
  return n.toString().padStart(6, "0");
}

/**
 * Próximo NÚMERO DE EXEMPLAR dentro de um acervo.
 * Conta os exemplares já inseridos e soma 1.
 */
export async function nextExemplarNumber(catalogId: string): Promise<number> {
  const ultimo = await prisma.exemplar.findFirst({
    where: { catalogId },
    orderBy: { exemplarNumber: "desc" },
    select: { exemplarNumber: true },
  });
  return (ultimo?.exemplarNumber ?? 0) + 1;
}

/**
 * Monta o texto consolidado de busca de um registro.
 *
 * O Prisma só faz correspondência EXATA em campos de lista String[]
 * (`authors`, `subjects`). Guardar "Souza, Ana" e pesquisar por
 * "Souza" não encontra nada com `has`. Juntando tudo num único
 * campo String, a busca por qualquer parte do valor funciona.
 */
export function buildSearchText(d: {
  title?: string | null;
  subtitle?: string | null;
  authors?: string[] | null;
  contributors?: string[] | null;
  subjects?: string[] | null;
  callNumber?: string | null;
  cutterCode?: string | null;
  classification?: string | null;
  cdd?: string | null;
  cdu?: string | null;
  isbn?: string | null;
  issn?: string | null;
  edition?: string | null;
  publisher?: string | null;
  tombo?: string | null;
  acquisition?: string | null;
}): string {
  const partes = [
    d.title,
    d.subtitle,
    ...(d.authors ?? []),
    ...(d.contributors ?? []),
    ...(d.subjects ?? []),
    d.callNumber,
    d.cutterCode,
    d.classification,
    d.cdd,
    d.cdu,
    d.isbn,
    d.issn,
    d.edition,
    d.publisher,
    d.tombo,
    d.acquisition,
  ];

  return partes
    .filter((p): p is string => !!p && String(p).trim().length > 0)
    .join(" ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
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

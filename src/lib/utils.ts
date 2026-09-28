// ============================================
// BiblioGest - Utilidades
// ============================================

import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

// Formatar data em PT-BR
export function formatDate(dateString: string | Date): string {
  const date = dateString instanceof Date ? dateString : new Date(dateString);
  return format(date, "dd/MM/yyyy", { locale: ptBR });
}

// Formatar data com hora
export function formatDateTime(dateString: string | Date): string {
  const date = dateString instanceof Date ? dateString : new Date(dateString);
  return format(date, "dd/MM/yyyy HH:mm", { locale: ptBR });
}

// Diferença relativa (ex: "há 3 dias")
export function formatRelativeDate(dateString: string | Date): string {
  const date = dateString instanceof Date ? dateString : new Date(dateString);
  return formatDistanceToNow(date, { addSuffix: true, locale: ptBR });
}

// Formatar CPF
export function formatCPF(cpf: string): string {
  const cleaned = cpf.replace(/\D/g, "");
  if (cleaned.length !== 11) return cpf;
  return `${cleaned.slice(0, 3)}.${cleaned.slice(3, 6)}.${cleaned.slice(6, 9)}-${cleaned.slice(9)}`;
}

// Verificar se CPF é válido
export function isValidCPF(cpf: string): boolean {
  const cleaned = cpf.replace(/\D/g, "");
  if (cleaned.length !== 11) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleaned.charAt(i)) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (parseInt(cleaned.charAt(9)) !== remainder) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleaned.charAt(i)) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (parseInt(cleaned.charAt(10)) !== remainder) return false;

  return true;
}

// Dados de teste para desenvolvimento
export function generateDummyData() {
  return {
    users: [
      { name: "Administrador", email: "admin@bibliogest.local", password: "admin123", role: "ADMIN" },
      { name: "Bibliotecário", email: "biblio@bibliogest.local", password: "biblio123", role: "LIBRARIAN" },
      { name: "Assistente", email: "assistente@bibliogest.local", password: "assistente123", role: "ASSISTANT" },
    ],
  };
}

// Helper para Date
function DateInstance(input: string | Date): Date {
  return input instanceof Date ? input : new Date(input);
}

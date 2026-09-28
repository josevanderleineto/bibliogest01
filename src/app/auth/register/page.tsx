// ============================================
// BiblioGest - Registro Page (Apenas Admin)
// ============================================
// Este formulário é acessado pelo painel admin para criar novos usuários.
// Não há cadastro público — apenas administradores podem criar usuários.
// ============================================

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    role: "LIBRARIAN" as "ADMIN" | "LIBRARIAN" | "ASSISTANT",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(false);
    setError("");
    setSuccess("");

    if (formData.password !== formData.confirmPassword) {
      setError("As senhas não coincidem");
      return;
    }

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password,
          role: formData.role,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess("✅ Usuário criado com sucesso!");
        setFormData({ name: "", email: "", password: "", confirmPassword: "", role: "LIBRARIAN" });
      } else {
        setError(data.error || "Erro ao criar conta");
      }
    } catch (err) {
      setError("Erro de conexão com o servidor");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-900 via-primary-800 to-primary-700 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <div className="mx-auto h-16 w-16 flex items-center justify-center rounded-full bg-white/20">
            <span className="text-white text-3xl">👤</span>
          </div>
          <h2 className="mt-4 text-center text-3xl font-extrabold text-white">
            Cadastrar Usuário
          </h2>
          <p className="mt-2 text-center text-sm text-primary-200">
            Apenas administradores podem criar novos usuários
          </p>
        </div>

        <form className="mt-8 space-y-6 bg-white rounded-lg p-8 shadow-xl" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">{error}</div>
          )}
          {success && (
            <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">{success}</div>
          )}

          <div className="rounded-md shadow-sm space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome Completo</label>
              <input
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 sm:text-sm"
                placeholder="João da Silva"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
              <input
                type="email"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 sm:text-sm"
                placeholder="joao@biblioteca.local"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
              <input
                type="password"
                required
                minLength={6}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 sm:text-sm"
                placeholder="Mínimo 6 caracteres"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar Senha</label>
              <input
                type="password"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 sm:text-sm"
                placeholder="Confirme a senha"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Função</label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 sm:text-sm"
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
              >
                <option value="LIBRARIAN">Bibliotecário</option>
                <option value="ASSISTANT">Assistente</option>
                <option value="ADMIN">Administrador</option>
              </select>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-primary-600 text-white py-3 rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50"
            >
              {loading ? "Cadastrando..." : "Cadastrar"}
            </button>
            <Link href="/auth/login" className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg text-center font-medium hover:bg-gray-300 transition-colors">
              ← Voltar ao Login
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

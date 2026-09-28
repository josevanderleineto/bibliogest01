// ============================================
// BiblioGest - Novo Usuário
// ============================================

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const ROLES = [
  { value: "LIBRARIAN", label: "Bibliotecário — pode catalogar e emprestar" },
  { value: "ASSISTANT", label: "Assistente — operação do dia a dia" },
  { value: "ADMIN", label: "Administrador — acesso total" },
];

export default function NewUserPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    role: "LIBRARIAN",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (form.password.length < 6) {
      setError("A senha deve ter no mínimo 6 caracteres");
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError("As senhas não conferem");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          password: form.password,
          role: form.role,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "Erro ao criar usuário");
        return;
      }
      router.push("/dashboard/users");
    } catch {
      setError("Erro de conexão");
    } finally {
      setLoading(false);
    }
  };

  const field =
    "w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500";

  return (
    <div className="max-w-lg">
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/dashboard/users"
          className="text-gray-500 hover:text-gray-700 text-sm"
        >
          ← Usuários
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">👤 Novo Usuário</h1>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded bg-red-100 text-red-700 text-sm">{error}</div>
      )}

      <form onSubmit={submit} className="bg-white rounded-lg shadow p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Nome completo *
          </label>
          <input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className={field}
            placeholder="Nome do usuário"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            E-mail (matrícula) *
          </label>
          <input
            required
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className={field}
            placeholder="usuario@biblioteca.com"
          />
          <p className="text-xs text-gray-500 mt-1">
            Este e-mail será a matrícula usada no empréstimo.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Senha *</label>
            <input
              required
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className={field}
              placeholder="mín. 6 caracteres"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Confirmar *
            </label>
            <input
              required
              type="password"
              value={form.confirmPassword}
              onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
              className={field}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Função</label>
          <select
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
            className={field}
          >
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-3 pt-2">
          <Link
            href="/dashboard/users"
            className="flex-1 text-center px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-primary-600 text-white py-2.5 rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50"
          >
            {loading ? "Criando..." : "Criar usuário"}
          </button>
        </div>
      </form>
    </div>
  );
}

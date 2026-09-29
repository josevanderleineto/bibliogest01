// ============================================
// BiblioGest - Usuários (Dashboard)
// ============================================

"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  failedAttempts: number;
  lockedUntil: string | null;
  lastLoginAt: string | null;
  _count?: { loans: number };
}

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Administrador",
  LIBRARIAN: "Bibliotecário",
  ASSISTANT: "Assistente",
};

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");

  const load = useCallback(async (search = "") => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/users${search ? `?q=${encodeURIComponent(search)}` : ""}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Erro ao carregar usuários");
        return;
      }
      setUsers(data.users || []);
    } catch {
      setError("Erro de conexão");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggleActive = async (user: User) => {
    setBusyId(user.id);
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !user.isActive }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "Erro ao atualizar usuário");
        return;
      }
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, isActive: !u.isActive } : u))
      );
    } catch {
      setError("Erro de conexão");
    } finally {
      setBusyId("");
    }
  };

  const unlock = async (user: User) => {
    setBusyId(user.id);
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unlock: true }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "Erro ao desbloquear");
        return;
      }
      load(q);
    } catch {
      setError("Erro de conexão");
    } finally {
      setBusyId("");
    }
  };

  const isLocked = (u: User) =>
    !!u.lockedUntil && new Date(u.lockedUntil) > new Date();

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">👤 Usuários</h1>
          <p className="text-sm text-gray-500 mt-1">
            O e-mail de cada usuário funciona como matrícula no balcão de empréstimo.
          </p>
        </div>
        <Link
          href="/dashboard/users/new"
          className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700"
        >
          + Novo Usuário
        </Link>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          load(q);
        }}
        className="bg-white rounded-lg shadow p-3 mb-4 flex gap-2"
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nome ou e-mail..."
          className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
        />
        <button
          type="submit"
          className="bg-primary-600 text-white px-4 py-2 rounded-md hover:bg-primary-700"
        >
          Buscar
        </button>
        {q && (
          <button
            type="button"
            onClick={() => {
              setQ("");
              load("");
            }}
            className="px-3 py-2 text-gray-500 hover:text-gray-700"
          >
            Limpar
          </button>
        )}
      </form>

      {error && (
        <div className="mb-4 p-3 rounded bg-red-100 text-red-700 text-sm">{error}</div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {["Usuário", "Função", "Empréstimos", "Status", "Ações"].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500">
                  Carregando...
                </td>
              </tr>
            )}
            {!loading && users.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500">
                  Nenhum usuário encontrado.
                </td>
              </tr>
            )}
            {!loading &&
              users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-gray-900">{u.name}</p>
                    <p className="text-xs text-gray-500">{u.email}</p>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {ROLE_LABEL[u.role] || u.role}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {u._count?.loans ?? 0}
                  </td>
                  <td className="px-4 py-3">
                    {isLocked(u) ? (
                      <span className="px-2 py-1 rounded-full text-xs bg-orange-100 text-orange-700">
                        Bloqueado
                      </span>
                    ) : u.isActive ? (
                      <span className="px-2 py-1 rounded-full text-xs bg-green-100 text-green-700">
                        Ativo
                      </span>
                    ) : (
                      <span className="px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-600">
                        Inativo
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2 text-xs">
                      {isLocked(u) && (
                        <button
                          onClick={() => unlock(u)}
                          disabled={busyId === u.id}
                          className="text-orange-600 hover:underline"
                        >
                          Desbloquear
                        </button>
                      )}
                      <button
                        onClick={() => toggleActive(u)}
                        disabled={busyId === u.id}
                        className="text-primary-600 hover:underline"
                      >
                        {u.isActive ? "Desativar" : "Ativar"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

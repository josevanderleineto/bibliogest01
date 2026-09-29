// ============================================
// BiblioGest - Login Page
// ============================================
// Apenas login. Cadastro de usuários feito pelo painel (admin).
// ============================================

"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSettings } from "@/components/SettingsProvider";
import BiblioGestLogo from "@/components/BiblioGestLogo";

interface LoginFormData {
  email: string;
  password: string;
}

interface LoginResponse {
  success: boolean;
  token?: string;
  user?: { id: string; name: string; role: string };
  error?: string;
}

export default function LoginPage() {
  const router = useRouter();
  const { settings } = useSettings();
  const [formData, setFormData] = useState<LoginFormData>({
    email: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
        }),
      });

      const data: LoginResponse = await response.json();

      if (data.success && data.user) {
        // O cookie httpOnly já é definido pela API
        router.push("/dashboard");
        router.refresh();
      } else {
        setError(data.error || "Erro no login");
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
          {/* Logo do BiblioGest à esquerda, logo da biblioteca à direita */}
          <div className="flex items-center justify-center gap-3">
            <div className="h-16 w-16 flex items-center justify-center rounded-2xl bg-white/95">
              <BiblioGestLogo size={40} />
            </div>
            {settings.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={settings.logoUrl}
                alt={settings.libraryName}
                className="h-16 w-16 rounded-2xl bg-white/95 p-2 object-contain"
              />
            )}
          </div>
          <h2 className="mt-4 text-center text-3xl font-extrabold text-white">
            {settings.libraryName}
          </h2>
          <p className="mt-1 text-center text-sm text-primary-200">
            {settings.institutionName}
          </p>
          <p className="mt-2 text-center text-xs text-primary-200/70">
            Sistema BiblioGest de Gestão de Bibliotecas
          </p>
        </div>

        <form className="mt-8 space-y-6 bg-white rounded-lg p-8 shadow-xl" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
              <span className="block sm:inline">{error}</span>
            </div>
          )}

          <div className="rounded-md shadow-sm space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                E-mail
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                className="appearance-none rounded relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-400 text-gray-900 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                placeholder="seu@email.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Senha
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                className="appearance-none rounded relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-400 text-gray-900 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                placeholder="Sua senha"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 transition-colors"
            >
              {loading ? "Entrando..." : "🔐 Entrar"}
            </button>
          </div>
        </form>

        <div className="text-center space-y-2">
          <Link
            href="/catalog"
            className="inline-block text-sm text-primary-100 hover:text-white hover:underline"
          >
            📚 Consultar acervo
          </Link>
          {settings.showCredit && (
            <p className="text-xs text-primary-200/70">
              Feito por Vanderlei Neto —{" "}
              <a
                href="https://www.vanderleineto.online/"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
              >
                vanderleineto.online
              </a>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

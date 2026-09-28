// ============================================
// BiblioGest - Novo Empréstimo / Devolução
// Fluxo com leitor de código de barras + teclado
//
// Empréstimo: matrícula → código de barras → senha
// Devolução : apenas código de barras
// ============================================

"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useSettings } from "@/components/SettingsProvider";

interface UserInfo {
  id: string;
  name: string;
  email: string;
}

interface ExemplarInfo {
  id: string;
  barcode: string;
  accessionNumber?: string;
  status: string;
  callNumber?: string;
  catalog: {
    title: string;
    authors: string[];
    isbn?: string;
    classification?: string;
  };
  loans?: Array<{
    id: string;
    dueDate: string;
    status: string;
    user: { name: string; email: string };
  }>;
}

const STATUS_MSG: Record<string, string> = {
  AVAILABLE: "Disponível",
  LOANED: "Emprestado",
  PROCESSING: "Em processamento",
  RESTORATION: "Em restauro",
  MAINTENANCE: "Em manutenção",
  LOST: "Perdido",
};

export default function NewLoanPage() {
  const { settings } = useSettings();
  const [mode, setMode] = useState<"loan" | "return">("loan");

  const [email, setEmail] = useState("");
  const [user, setUser] = useState<UserInfo | null>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const [barcode, setBarcode] = useState("");
  const [exemplar, setExemplar] = useState<ExemplarInfo | null>(null);
  const [password, setPassword] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const emailRef = useRef<HTMLInputElement>(null);
  const barcodeRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  // Foca o campo do passo atual (terminal com teclado/leitor)
  useEffect(() => {
    const target = step === 1 ? emailRef.current : step === 2 ? barcodeRef.current : passwordRef.current;
    target?.focus();
  }, [step, mode]);

  const reset = useCallback(() => {
    setEmail("");
    setUser(null);
    setBarcode("");
    setExemplar(null);
    setPassword("");
    setError("");
    setSuccess("");
    setStep(1);
  }, []);

  const switchMode = (m: "loan" | "return") => {
    setMode(m);
    reset();
  };

  // ---------- Passo 1: matrícula ----------
  const findUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(
        `/api/auth/search?email=${encodeURIComponent(email.trim().toLowerCase())}`
      );
      const data = await res.json();
      if (!res.ok || !data.user) {
        setError(data.message || data.error || "Usuário não encontrado");
        return;
      }
      setUser(data.user);
      setStep(2);
    } catch {
      setError("Erro de conexão");
    } finally {
      setBusy(false);
    }
  };

  // ---------- Passo 2: código de barras ----------
  const findExemplar = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!barcode.trim()) return;
    setBusy(true);
    setError("");
    setExemplar(null);
    try {
      const res = await fetch(
        `/api/exemplars?barcode=${encodeURIComponent(barcode.trim())}`
      );
      const data = await res.json();
      if (!res.ok || !data.exemplar) {
        setError(data.error || "Exemplar não encontrado");
        return;
      }
      setExemplar(data.exemplar);
      setStep(mode === "loan" ? 3 : 1);
      if (mode === "return") doReturn(barcode.trim());
    } catch {
      setError("Erro de conexão");
    } finally {
      setBusy(false);
    }
  };

  // ---------- Passo 3: senha + empréstimo ----------
  const doLoan = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!user || !exemplar || !password) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/loans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "loan",
          email: user.email,
          password,
          barcode: exemplar.barcode,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "Erro ao registrar empréstimo");
        return;
      }
      setSuccess(
        `Empréstimo registrado: "${data.data.title}" · devolução até ${new Date(
          data.data.dueDate
        ).toLocaleDateString("pt-BR")}`
      );
      setTimeout(() => {
        reset();
        setSuccess("");
      }, 2500);
    } catch {
      setError("Erro de conexão");
    } finally {
      setBusy(false);
    }
  };

  // ---------- Devolução só com código de barras ----------
  const doReturn = async (code: string) => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/loans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "return", barcode: code }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "Erro ao registrar devolução");
        return;
      }
      setSuccess(
        `Devolução registrada: "${data.data.title}" — ${data.data.userName}${
          data.data.wasOverdue ? " (em atraso)" : ""
        }`
      );
      setTimeout(() => {
        reset();
        setSuccess("");
      }, 2500);
    } catch {
      setError("Erro de conexão");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">
        📋 Empréstimo e Devolução
      </h1>
      <p className="text-sm text-gray-500 mb-6">
        {mode === "loan"
          ? "Informe a matrícula do usuário, escaneie o código de barras do exemplar e confirme com a senha."
          : "Escaneie o código de barras do exemplar para registrar a devolução."}
      </p>

      {/* Abas */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => switchMode("loan")}
          className={`px-5 py-2.5 rounded-lg font-medium ${
            mode === "loan"
              ? "bg-primary-600 text-white"
              : "bg-white text-gray-700 hover:bg-gray-100"
          }`}
        >
          📖 Empréstimo
        </button>
        <button
          onClick={() => switchMode("return")}
          className={`px-5 py-2.5 rounded-lg font-medium ${
            mode === "return"
              ? "bg-green-600 text-white"
              : "bg-white text-gray-700 hover:bg-gray-100"
          }`}
        >
          ↩️ Devolução
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded bg-red-100 text-red-700 text-sm font-medium">
          ❌ {error}
        </div>
      )}
      {success && (
        <div className="mb-4 p-3 rounded bg-green-100 text-green-700 text-sm font-medium">
          ✅ {success}
        </div>
      )}

      <div className="bg-white rounded-lg shadow p-6 space-y-5">
        {/* Etapa 1 — matrícula */}
        {mode === "loan" && step === 1 && (
          <form onSubmit={findUser}>
            <h2 className="font-bold text-gray-900 mb-1">
              1º · Matrícula do usuário
            </h2>
            <p className="text-xs text-gray-500 mb-3">
              Digite o e-mail cadastrado ou passe o cartão de usuário.
            </p>
            <div className="flex gap-2">
              <input
                ref={emailRef}
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="usuario@email.com"
                autoComplete="off"
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-lg"
              />
              <button
                type="submit"
                disabled={busy || !email.trim()}
                className="bg-primary-600 text-white px-6 py-3 rounded-lg hover:bg-primary-700 disabled:opacity-50"
              >
                {busy ? "..." : "Continuar"}
              </button>
            </div>
          </form>
        )}

        {/* Usuário encontrado */}
        {mode === "loan" && user && (
          <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
            <span className="text-xl">👤</span>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-green-900 truncate">{user.name}</p>
              <p className="text-xs text-green-700 truncate">{user.email}</p>
            </div>
            {step > 1 && (
              <button
                onClick={() => { setUser(null); setExemplar(null); setStep(1); }}
                className="text-xs text-gray-500 hover:underline"
              >
                trocar
              </button>
            )}
          </div>
        )}

        {/* Etapa 2 — código de barras */}
        {(mode === "loan" && (step === 2 || step === 3)) || mode === "return" ? (
          <form onSubmit={findExemplar}>
            <h2 className="font-bold text-gray-900 mb-1">
              {mode === "return" ? "Código de barras" : "2º · Código de barras do exemplar"}
            </h2>
            <p className="text-xs text-gray-500 mb-3">
              Escaneie o código de barras ou digite e pressione Enter.
            </p>
            <div className="flex gap-2">
              <input
                ref={barcodeRef}
                type="text"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                placeholder="BG000001"
                autoComplete="off"
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-lg font-mono"
              />
              <button
                type="submit"
                disabled={busy || !barcode.trim()}
                className="bg-primary-600 text-white px-6 py-3 rounded-lg hover:bg-primary-700 disabled:opacity-50"
              >
                {busy ? "..." : mode === "return" ? "Devolver" : "Continuar"}
              </button>
            </div>
          </form>
        ) : null}

        {/* Exemplar encontrado */}
        {exemplar && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium text-blue-900 truncate">
                  {exemplar.catalog.title}
                </p>
                <p className="text-xs text-blue-700 truncate">
                  {exemplar.catalog.authors?.join(", ")}
                </p>
                <p className="text-xs text-blue-500 font-mono mt-1">
                  {exemplar.barcode}
                  {exemplar.accessionNumber ? ` · acervo ${exemplar.accessionNumber}` : ""}
                  {exemplar.callNumber ? ` · ${exemplar.callNumber}` : ""}
                </p>
                {exemplar.loans?.[0] && (
                  <p className="text-xs text-amber-700 mt-1">
                    Emprestado por {exemplar.loans[0].user.name} · vence{" "}
                    {new Date(exemplar.loans[0].dueDate).toLocaleDateString("pt-BR")}
                  </p>
                )}
              </div>
              <span
                className={`shrink-0 text-[10px] px-2 py-1 rounded font-medium ${
                  exemplar.status === "AVAILABLE"
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-200 text-gray-700"
                }`}
              >
                {STATUS_MSG[exemplar.status] || exemplar.status}
              </span>
            </div>
          </div>
        )}

        {/* Etapa 3 — senha */}
        {mode === "loan" && step === 3 && user && exemplar && (
          <form onSubmit={doLoan}>
            <h2 className="font-bold text-gray-900 mb-1">3º · Confirmar senha</h2>
            <p className="text-xs text-gray-500 mb-3">
              O usuário deve digitar a própria senha para confirmar o empréstimo.
            </p>
            <div className="flex gap-2">
              <input
                ref={passwordRef}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Senha do usuário"
                autoComplete="off"
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-lg"
              />
              <button
                type="submit"
                disabled={busy || !password}
                className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {busy ? "..." : "Emprestar"}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Regras do sistema */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg text-xs text-gray-600 space-y-1">
        <p className="font-semibold text-gray-700">
          Regras — {settings.libraryName}
        </p>
        <p>• Prazo de empréstimo: {settings.loanDays} dias</p>
        <p>• Renovação: até {settings.maxRenewals} vezes</p>
        <p>• Máximo de {settings.maxLoansPerUser} empréstimos simultâneos por usuário</p>
        <p>
          • Só aparecem no catálogo público exemplares com status{" "}
          <strong>Disponível</strong>
        </p>
        <p>• Usuário com empréstimo em atraso não pode fazer novo empréstimo</p>
      </div>
    </div>
  );
}

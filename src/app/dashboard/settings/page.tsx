// ============================================
// BiblioGest - Configurações
// Personalização da biblioteca e parâmetros de operação
// ============================================

"use client";

import { useState, useEffect } from "react";
import { useSettings, type SettingsData } from "@/components/SettingsProvider";

const field =
  "w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500";
const label = "block text-sm font-medium text-gray-700 mb-1";
const section = "bg-white rounded-lg shadow p-6";

export default function SettingsPage() {
  const { settings, reload } = useSettings();
  const [form, setForm] = useState<SettingsData>(settings);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!ready) {
      setForm(settings);
      setReady(true);
    }
  }, [settings, ready]);

  const set = <K extends keyof SettingsData>(k: K, v: SettingsData[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setMessage({ ok: false, text: data.error || "Erro ao salvar" });
        return;
      }
      setForm(data.settings);
      await reload();
      setMessage({ ok: true, text: "Configurações salvas" });
    } catch {
      setMessage({ ok: false, text: "Erro de conexão" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl">
      <h1 className="text-3xl font-bold text-gray-900 mb-1">⚙️ Configurações</h1>
      <p className="text-sm text-gray-500 mb-6">
        Personalize a identificação da biblioteca e os parâmetros de circulação.
      </p>

      {message && (
        <div
          className={`mb-4 p-3 rounded text-sm ${
            message.ok ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
          }`}
        >
          {message.text}
        </div>
      )}

      <form onSubmit={save} className="space-y-6">
        {/* ---- Identificação ---- */}
        <section className={section}>
          <h2 className="font-bold text-gray-900 mb-1">Identificação</h2>
          <p className="text-xs text-gray-500 mb-4">
            Estes nomes aparecem no sistema, no catálogo público e nas etiquetas.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className={label}>Nome da biblioteca *</label>
              <input
                required
                value={form.libraryName}
                onChange={(e) => set("libraryName", e.target.value)}
                className={field}
                placeholder="Biblioteca do MAB"
              />
            </div>
            <div className="md:col-span-2">
              <label className={label}>Nome da instituição *</label>
              <input
                required
                value={form.institutionName}
                onChange={(e) => set("institutionName", e.target.value)}
                className={field}
                placeholder="Museu de Astronomia e Ciências Afins"
              />
            </div>
            <div>
              <label className={label}>Sigla da instituição</label>
              <input
                value={form.institutionAcronym}
                onChange={(e) => set("institutionAcronym", e.target.value)}
                className={field}
                placeholder="MAB"
              />
            </div>
            <div>
              <label className={label}>Código da biblioteca</label>
              <input
                value={form.libraryCode ?? ""}
                onChange={(e) => set("libraryCode", e.target.value)}
                className={field}
                placeholder="MAB-BIB"
              />
              <p className="text-xs text-gray-500 mt-1">
                Usado no cabeçalho da etiqueta de identificação.
              </p>
            </div>
          </div>
        </section>

        {/* ---- Contato ---- */}
        <section className={section}>
          <h2 className="font-bold text-gray-900 mb-4">Contato</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className={label}>Endereço</label>
              <input
                value={form.address ?? ""}
                onChange={(e) => set("address", e.target.value)}
                className={field}
                placeholder="Rua, número, bairro, cidade"
              />
            </div>
            <div>
              <label className={label}>Telefone</label>
              <input
                value={form.phone ?? ""}
                onChange={(e) => set("phone", e.target.value)}
                className={field}
                placeholder="(21) 1234-5678"
              />
            </div>
            <div>
              <label className={label}>E-mail</label>
              <input
                type="email"
                value={form.email ?? ""}
                onChange={(e) => set("email", e.target.value)}
                className={field}
                placeholder="biblioteca@mab.br"
              />
            </div>
            <div className="md:col-span-2">
              <label className={label}>Site</label>
              <input
                value={form.website ?? ""}
                onChange={(e) => set("website", e.target.value)}
                className={field}
                placeholder="https://www.mab.br"
              />
            </div>
          </div>
        </section>

        {/* ---- Circulação ---- */}
        <section className={section}>
          <h2 className="font-bold text-gray-900 mb-1">Circulação</h2>
          <p className="text-xs text-gray-500 mb-4">
            Regras aplicadas no balcão de empréstimo.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={label}>Prazo do empréstimo (dias)</label>
              <input
                type="number"
                min={1}
                max={90}
                value={form.loanDays}
                onChange={(e) => set("loanDays", Number(e.target.value))}
                className={field}
              />
            </div>
            <div>
              <label className={label}>Empréstimos por usuário</label>
              <input
                type="number"
                min={1}
                max={20}
                value={form.maxLoansPerUser}
                onChange={(e) => set("maxLoansPerUser", Number(e.target.value))}
                className={field}
              />
            </div>
            <div>
              <label className={label}>Renovações</label>
              <input
                type="number"
                min={0}
                max={10}
                value={form.maxRenewals}
                onChange={(e) => set("maxRenewals", Number(e.target.value))}
                className={field}
              />
            </div>
          </div>
        </section>

        {/* ---- Apresentação ---- */}
        <section className={section}>
          <h2 className="font-bold text-gray-900 mb-4">Apresentação</h2>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.showCredit}
              onChange={(e) => set("showCredit", e.target.checked)}
              className="mt-1 rounded"
            />
            <span>
              <span className="text-sm font-medium text-gray-800">
                Exibir crédito do desenvolvedor
              </span>
              <span className="block text-xs text-gray-500">
                Mostra &quot;Feito por Vanderlei Neto&quot; no rodapé e na tela de login.
              </span>
            </span>
          </label>
        </section>

        {/* ---- Pré-visualização ---- */}
        <section className="border border-dashed border-gray-300 rounded-lg p-4">
          <h2 className="font-bold text-gray-700 text-sm mb-2">Como aparecerá</h2>
          <div className="text-sm text-gray-600 space-y-1">
            <p>
              <span className="text-gray-400">Cabeçalho:</span>{" "}
              <strong>{form.libraryName}</strong> · {form.institutionAcronym}
            </p>
            <p>
              <span className="text-gray-400">Catálogo público:</span> Acervo —{" "}
              {form.libraryName}
            </p>
            <p>
              <span className="text-gray-400">Etiqueta:</span>{" "}
              {form.libraryName}
              {form.libraryCode ? ` (${form.libraryCode})` : ""}
            </p>
          </div>
        </section>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setForm(settings)}
            className="px-5 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
          >
            Descartar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 bg-primary-600 text-white py-2.5 rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50"
          >
            {saving ? "Salvando..." : "Salvar configurações"}
          </button>
        </div>
      </form>
    </div>
  );
}

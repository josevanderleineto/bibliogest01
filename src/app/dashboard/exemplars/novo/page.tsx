// ============================================
// BiblioGest - Inserir exemplar em acervo existente
//
// Cópia do mesmo item não vira registro novo: entra como
// mais um exemplar dentro do mesmo número de acervo.
// ============================================

"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";

interface Resultado {
  id: string;
  title: string;
  subtitle?: string;
  authors: string[];
  subjects: string[];
  callNumber?: string;
  cutterCode?: string;
  classification?: string;
  accessionNumber?: string;
  controlNumber?: string;
  exemplars: Array<{ id: string; status: string; exemplarNumber?: number }>;
}

const STATUS_LABEL: Record<string, string> = {
  AVAILABLE: "Disponível",
  LOANED: "Emprestado",
  PROCESSING: "Em processamento",
  RESTORATION: "Em restauro",
  MAINTENANCE: "Em manutenção",
  LOST: "Perdido",
};

const SUGESTOES = [
  "Autor",
  "Título",
  "Acervo",
  "Assunto",
  "Exemplar (Ex.3)",
  "Código de barras",
];

const field =
  "w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500";

export default function AddExemplarPage() {
  const [q, setQ] = useState("");
  const [resultados, setResultados] = useState<Resultado[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [consultou, setConsultou] = useState(false);
  const [erro, setErro] = useState("");

  // alvo: registro escolhido para receber cópias
  const [alvo, setAlvo] = useState<Resultado | null>(null);
  const [quantidade, setQuantidade] = useState(1);
  const [status, setStatus] = useState("AVAILABLE");
  const [inserindo, setInserindo] = useState(false);
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);

  const buscar = useCallback(async (termo: string) => {
    if (!termo.trim()) return;
    setBuscando(true);
    setErro("");
    setAlvo(null);
    try {
      const res = await fetch(`/api/catalog?q=${encodeURIComponent(termo.trim())}&limit=25`);
      const data = await res.json();
      if (!res.ok) {
        setErro(data.error || "Erro na consulta");
        return;
      }
      setResultados(data.catalogs || []);
      setConsultou(true);
    } catch {
      setErro("Erro de conexão");
    } finally {
      setBuscando(false);
    }
  }, []);

  useEffect(() => {
    buscar("");
  }, [buscar]);

  // Ao escolher um registro, recarrega para pegar o total de exemplares atualizado
  const escolher = (r: Resultado) => {
    setAlvo(r);
    setAviso(null);
    setQuantidade(1);
  };

  const inserir = async () => {
    if (!alvo) return;
    setInserindo(true);
    setErro("");
    try {
      const res = await fetch("/api/exemplars", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          catalogId: alvo.id,
          quantity: quantidade,
          status,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setErro(data.error || "Erro ao inserir exemplar");
        return;
      }

      const novos = data.exemplars || [];
      setAviso({
        ok: true,
        texto:
          `${data.message} — acervo ${alvo.accessionNumber || "—"} · ` +
          novos
            .map((e: { exemplarNumber: number; barcode: string }) =>
              `Ex.${e.exemplarNumber} (cód. ${e.barcode})`
            )
            .join(", "),
      });

      // Atualiza a contagem na lista
      setResultados((prev) =>
        prev.map((r) =>
          r.id === alvo.id
            ? {
                ...r,
                exemplars: [
                  ...r.exemplars,
                  ...novos.map((e: { id: string; status: string; exemplarNumber: number }) => ({
                    id: e.id,
                    status: e.status,
                    exemplarNumber: e.exemplarNumber,
                  })),
                ],
              }
            : r
        )
      );
    } catch {
      setErro("Erro de conexão");
    } finally {
      setInserindo(false);
    }
  };

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <Link href="/dashboard/catalog" className="text-gray-500 hover:text-gray-700 text-sm">
          ← Catalogação
        </Link>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mt-1">
          ➕ Inserir exemplar
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Para acrescentar mais uma cópia de um item que já está no acervo, procure
          o registro e insira o exemplar. O número de acervo continua o mesmo.
        </p>
      </div>

      {erro && (
        <div className="mb-4 p-3 rounded bg-red-100 text-red-700 text-sm">{erro}</div>
      )}
      {aviso && (
        <div
          className={`mb-4 p-3 rounded text-sm ${
            aviso.ok ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
          }`}
        >
          {aviso.texto}
        </div>
      )}

      {/* ---------- Consulta ---------- */}
      <section className="bg-white rounded-lg shadow p-4 mb-6 border-l-4 border-primary-500">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Consultar acervo
        </label>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && buscar(q)}
            placeholder="Autor, título, número de acervo, assunto, Ex.3 ou código de barras..."
            className={field}
          />
          <button
            onClick={() => buscar(q)}
            disabled={buscando || !q.trim()}
            className="px-5 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50 whitespace-nowrap"
          >
            {buscando ? "..." : "Consultar"}
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Pode procurar por:{" "}
          {SUGESTOES.map((s, i) => (
            <span key={s}>
              {i > 0 && " · "}
              <button
                onClick={() => {
                  setQ(s);
                  buscar(s);
                }}
                className="text-primary-600 hover:underline"
              >
                {s}
              </button>
            </span>
          ))}
        </p>
      </section>

      {/* ---------- Resultados ---------- */}
      {consultou && !alvo && (
        <section>
          {resultados.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-6 text-center">
              <p className="text-gray-500 text-sm">
                Nenhum registro encontrado para “{q}”.
              </p>
              <p className="text-gray-500 text-sm mt-2">
                Se for um item novo, cadastre em{" "}
                <Link href="/dashboard/catalog" className="text-primary-600 hover:underline">
                  Catalogação
                </Link>
                .
              </p>
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-500 mb-2">
                {resultados.length} registro(s). Escolha o item para inserir cópias.
              </p>
              <ul className="space-y-2">
                {resultados.map((r) => {
                  const dispo = r.exemplars.filter(
                    (e) => e.status === "AVAILABLE"
                  ).length;
                  return (
                    <li
                      key={r.id}
                      className="bg-white rounded-lg shadow p-4 flex flex-col sm:flex-row sm:items-center gap-3"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900">
                          {r.title}
                          {r.subtitle ? ` : ${r.subtitle}` : ""}
                        </p>
                        {r.authors.length > 0 && (
                          <p className="text-sm text-gray-600">{r.authors.join("; ")}</p>
                        )}
                        <p className="text-xs text-gray-500 font-mono mt-1">
                          {[r.callNumber, r.cutterCode].filter(Boolean).join(" ")}
                          {r.accessionNumber ? ` · acervo ${r.accessionNumber}` : ""}
                        </p>
                        {r.subjects.length > 0 && (
                          <p className="text-xs text-gray-400 mt-0.5">
                            {r.subjects.join("; ")}
                          </p>
                        )}
                        <p className="text-xs text-gray-500 mt-1">
                          {r.exemplars.length} exemplar
                          {r.exemplars.length === 1 ? "" : "es"} · {dispo} disponível
                          {dispo === 1 ? "" : "is"}
                        </p>
                      </div>
                      <button
                        onClick={() => escolher(r)}
                        className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium whitespace-nowrap"
                      >
                        Inserir exemplar
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </section>
      )}

      {/* ---------- Inserção ---------- */}
      {alvo && (
        <section className="bg-white rounded-lg shadow p-6 border-l-4 border-green-500">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="min-w-0">
              <h2 className="font-bold text-gray-900">Inserindo em:</h2>
              <p className="font-medium text-gray-800">{alvo.title}</p>
              <p className="text-sm text-gray-600">{alvo.authors.join("; ")}</p>
              <p className="text-xs text-gray-500 font-mono mt-1">
                {[alvo.callNumber, alvo.cutterCode].filter(Boolean).join(" ")} · acervo{" "}
                {alvo.accessionNumber || "—"} · {alvo.exemplars.length} exemplar
                {alvo.exemplars.length === 1 ? "" : "es"} hoje
              </p>
            </div>
            <button
              onClick={() => setAlvo(null)}
              className="text-gray-400 hover:text-gray-700 text-sm whitespace-nowrap"
            >
              Trocar item
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Quantidade de exemplares
              </label>
              <input
                type="number"
                min={1}
                max={200}
                value={quantidade}
                onChange={(e) => setQuantidade(Number(e.target.value) || 1)}
                className={field}
              />
              <p className="text-xs text-gray-500 mt-1">
                Cada unidade recebe um número de exemplar e um código de barras
                próprios.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status inicial
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className={field}
              >
                <option value="AVAILABLE">Disponível</option>
                <option value="PROCESSING">Em processamento</option>
                <option value="RESTORATION">Em restauro</option>
                <option value="MAINTENANCE">Em manutenção</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Só “Disponível” aparece no catálogo público.
              </p>
            </div>
          </div>

          {/* Prévia da numeração */}
          {(() => {
            const ultimo = alvo.exemplars.reduce(
              (max, e) => Math.max(max, e.exemplarNumber ?? 0),
              0
            );
            const numeros = Array.from({ length: Math.min(quantidade, 6) }, (_, i) => ultimo + 1 + i);
            return (
              <p className="text-xs text-gray-600 bg-gray-50 px-3 py-2 rounded mb-4">
                Serão inseridos os exemplares:{" "}
                <strong className="font-mono">
                  {numeros.map((n) => `Ex.${n}`).join(", ")}
                  {quantidade > 6 ? ` … Ex.${ultimo + quantidade}` : ""}
                </strong>{" "}
                no acervo{" "}
                <strong className="font-mono">{alvo.accessionNumber || "—"}</strong>
              </p>
            );
          })()}

          <button
            onClick={inserir}
            disabled={inserindo}
            className="w-full bg-green-600 text-white py-3 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50"
          >
            {inserindo
              ? "Inserindo..."
              : `Inserir ${quantidade} exemplar${quantidade === 1 ? "" : "es"}`}
          </button>
        </section>
      )}
    </div>
  );
}

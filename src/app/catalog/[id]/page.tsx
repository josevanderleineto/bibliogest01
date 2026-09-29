// ============================================
// BiblioGest - Detalhe do item (Catálogo Público)
// ============================================

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useSettings } from "@/components/SettingsProvider";

interface Exemplar {
  id: string;
  status: string;
  callNumber?: string;
  cutterCode?: string;
  accessionNumber?: string;
  loans?: Array<{ dueDate: string }>;
}

interface Item {
  id: string;
  title: string;
  subtitle?: string;
  titleStatement?: string;
  authors: string[];
  contributors: string[];
  edition?: string;
  publisher?: string;
  publicationPlace?: string;
  publicationYear?: string;
  materialType: string;
  controlNumber?: string;
  isbn?: string;
  issn?: string;
  subjects: string[];
  classification?: string;
  cdd?: string;
  cdu?: string;
  callNumber?: string;
  cutterCode?: string;
  physicalDesc?: string;
  generalNote?: string;
  seriesTitle?: string;
  seriesVolume?: string;
  customFields: unknown;
  coverUrl?: string;
  tombo?: string;
  exemplars: Exemplar[];
}

const STATUS_LABEL: Record<string, string> = {
  AVAILABLE: "Disponível",
  LOANED: "Emprestado",
  PROCESSING: "Em processamento",
  RESTORATION: "Em restauro",
  MAINTENANCE: "Em manutenção",
  LOST: "Perdido",
};

const Row = ({ term, children }: { term: string; children?: React.ReactNode }) =>
  children ? (
    <div className="flex gap-3 py-1.5 border-b border-gray-100 last:border-0">
      <dt className="text-xs text-gray-500 w-36 shrink-0 pt-0.5">{term}</dt>
      <dd className="text-sm text-gray-800 flex-1">{children}</dd>
    </div>
  ) : null;

export default function CatalogDetailPage() {
  const params = useParams<{ id: string }>();
  const { settings } = useSettings();
  const [item, setItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!params?.id) return;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/catalog/${params.id}`);
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Registro não encontrado");
          return;
        }
        setItem(data);
      } catch {
        setError("Erro de conexão");
      } finally {
        setLoading(false);
      }
    })();
  }, [params]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-500">
        Carregando...
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4 text-gray-500">
        <p>{error || "Registro não encontrado"}</p>
        <Link href="/catalog" className="text-primary-700 hover:underline">
          ← Voltar ao acervo
        </Link>
      </div>
    );
  }

  const available = item.exemplars.filter((e) => e.status === "AVAILABLE").length;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-primary-700 text-white py-6">
        <div className="max-w-3xl mx-auto px-4 flex items-center gap-3">
          {settings.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={settings.logoUrl}
              alt={settings.libraryName}
              className="h-12 w-12 shrink-0 rounded object-contain bg-white/10 p-1"
            />
          )}
          <div className="min-w-0">
            <Link href="/catalog" className="text-primary-100 text-sm hover:underline">
              ← Acervo
            </Link>
            <h1 className="text-2xl font-bold mt-2">{item.title}</h1>
            {item.subtitle && <p className="text-primary-100">{item.subtitle}</p>}
            <p className="text-primary-200/80 text-sm mt-1">
              {settings.libraryName} · {settings.institutionAcronym}
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-5">
        {item.coverUrl && (
          <section className="bg-white rounded-lg shadow p-4 flex justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.coverUrl}
              alt={`Capa de ${item.title}`}
              className="max-h-96 w-auto object-contain"
            />
          </section>
        )}
        <section className="bg-white rounded-lg shadow p-5">
          <h2 className="font-semibold text-gray-900 mb-3">Descrição</h2>
          <dl>
            {item.authors?.length > 0 && (
              <Row term="Autores">{item.authors.join("; ")}</Row>
            )}
            {item.contributors?.length > 0 && (
              <Row term="Outros responsáveis">{item.contributors.join("; ")}</Row>
            )}
            {item.titleStatement && <Row term="Responsabilidade">{item.titleStatement}</Row>}
            {item.edition && <Row term="Edição">{item.edition}</Row>}
            {item.publisher && (
              <Row term="Publicação">
                {[item.publicationPlace, item.publisher, item.publicationYear]
                  .filter(Boolean)
                  .join(" : ")}
              </Row>
            )}
            {item.physicalDesc && <Row term="Descrição física">{item.physicalDesc}</Row>}
            {item.isbn && <Row term="ISBN">{item.isbn}</Row>}
            {item.issn && <Row term="ISSN">{item.issn}</Row>}
            {item.seriesTitle && (
              <Row term="Série">
                {[item.seriesTitle, item.seriesVolume].filter(Boolean).join(" · ")}
              </Row>
            )}
            {item.subjects?.length > 0 && (
              <Row term="Assuntos">{item.subjects.join("; ")}</Row>
            )}
            {item.tombo && <Row term="Tombo">{item.tombo}</Row>}
            {(item.classification || item.callNumber) && (
              <Row term="Número de chamada">
                <span className="font-mono font-semibold">
                  {[item.classification, item.callNumber, item.cutterCode]
                    .filter(Boolean)
                    .join(" ")}
                </span>
              </Row>
            )}
            {(item.cdd || item.cdu) && (
              <Row term="Classificação">
                <span className="font-mono text-gray-700">
                  {[item.cdd && `CDD ${item.cdd}`, item.cdu && `CDU ${item.cdu}`]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </Row>
            )}
            {item.generalNote && <Row term="Nota geral">{item.generalNote}</Row>}
          </dl>
        </section>

        <section className="bg-white rounded-lg shadow p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-900">
              Exemplares ({item.exemplars.length})
            </h2>
            <span className="text-sm text-green-700 font-medium">
              {available} disponível{available === 1 ? "" : "is"}
            </span>
          </div>

          {item.exemplars.length === 0 ? (
            <p className="text-sm text-gray-500">Nenhum exemplar cadastrado.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {item.exemplars.map((ex) => {
                const call = [
                  ex.callNumber || item.callNumber,
                  ex.cutterCode || item.cutterCode,
                ]
                  .filter(Boolean)
                  .join(" ");

                return (
                  <li
                    key={ex.id}
                    className="py-2.5 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm text-gray-800 font-mono font-semibold">
                        {call || "—"}
                      </p>
                      {ex.accessionNumber && (
                        <p className="text-xs text-gray-500 font-mono">
                          acervo {ex.accessionNumber}
                        </p>
                      )}
                      {ex.status !== "AVAILABLE" && ex.loans?.[0] && (
                        <p className="text-xs text-gray-500">
                          Previsto para{" "}
                          {new Date(ex.loans[0].dueDate).toLocaleDateString("pt-BR")}
                        </p>
                      )}
                    </div>
                    <span
                      className={`shrink-0 text-xs px-2 py-1 rounded-full font-medium ${
                        ex.status === "AVAILABLE"
                          ? "bg-green-100 text-green-700"
                          : ex.status === "LOANED" || ex.status === "RESTORATION"
                          ? "bg-gray-100 text-gray-600"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {STATUS_LABEL[ex.status] || ex.status}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>

      <footer className="border-t border-gray-200 py-6 text-center text-xs text-gray-500 space-y-1">
        {settings.address && <p>{settings.address}</p>}
        {settings.showCredit && (
          <p>
            <a
              href="https://www.vanderleineto.online/"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-primary-700"
            >
              Feito por Vanderlei Neto — vanderleineto.online
            </a>
          </p>
        )}
      </footer>
    </div>
  );
}

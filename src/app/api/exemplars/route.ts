// ============================================
// BiblioGest - API Exemplares
// Listagem, busca por código de barras,
// criação e alteração de status
// ============================================

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import type { ExemplarStatus } from "@prisma/client";
import { nextBarcode, nextExemplarNumber } from "@/lib/numbering";

export const dynamic = "force-dynamic";

// ============================================
// Helpers copiados de catalog/route.ts
// ============================================

type Marc505 = {
  indicator1: string;
  indicator2: string;
  subfields: Array<{ code: "a" | "g" | "r" | "t"; value: string }>;
};

function normalizeMarc505(value: unknown, fallback?: unknown): { marc: Marc505; display: string } {
  const raw = value && typeof value === "object" ? value as Partial<Marc505> : {};
  const validCode = new Set(["a", "g", "r", "t"]);
  const subfields = Array.isArray(raw.subfields)
    ? (raw.subfields as unknown[])
        .filter((item) => !!item && typeof item === "object")
        .map((item: any) => ({ code: String(item.code).toLowerCase(), value: String(item.value ?? "").trim() }))
        .filter((item) => validCode.has(item.code) && Boolean(item.value))
        .map((item) => ({ code: item.code as Marc505["subfields"][number]["code"], value: item.value }))
    : [];

  if (subfields.length === 0 && typeof fallback === "string" && fallback.trim()) {
    subfields.push({ code: "a", value: fallback.trim() });
  }

  const indicator = (value: unknown) => typeof value === "string" && /^[0-9 ]$/.test(value) ? value : " ";
  const marc = {
    indicator1: indicator(raw.indicator1),
    indicator2: indicator(raw.indicator2),
    subfields,
  };
  return { marc, display: subfields.map((field) => field.value).join(" -- ") };
}

function normalizeAuthority(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase().replace(/\s+/g, " ");
}

async function registerAuthorities(authors: string[], contributors: string[], subjects: string[], publisher?: unknown, place?: unknown) {
  const people = Array.from(new Set([...authors, ...contributors]));
  await Promise.all([
    ...people.map((name) => prisma.authorityAuthor.upsert({
      where: { normalized: normalizeAuthority(name) },
      create: { name, normalized: normalizeAuthority(name), source: "manual" },
      update: {},
    })),
    ...subjects.map((term) => prisma.authoritySubject.upsert({
      where: { normalized: normalizeAuthority(term) },
      create: { term, normalized: normalizeAuthority(term), source: "manual" },
      update: {},
    })),
    ...(typeof publisher === "string" && publisher.trim() ? [prisma.authorityPublisher.upsert({
      where: { normalized: normalizeAuthority(publisher) },
      create: { name: publisher.trim(), normalized: normalizeAuthority(publisher), place: typeof place === "string" ? place.trim() || null : null, source: "manual" },
      update: {},
    })] : []),
  ]);
}

const EXEMPLAR_SELECT = {
  id: true,
  catalogId: true,
  barcode: true,
  accessionNumber: true,
  exemplarNumber: true,
  callNumber: true,
  cutterCode: true,
  status: true,
  internalNote: true,
  createdAt: true,
} as const;

const VALID_STATUSES: ExemplarStatus[] = [
  "AVAILABLE",
  "LOANED",
  "PROCESSING",
  "RESTORATION",
  "MAINTENANCE",
  "LOST",
];

// ============================================
// GET - Listar exemplares / buscar por código de barras
// ============================================
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const catalogId = searchParams.get("catalogId");
    const status = searchParams.get("status");
    const barcode = searchParams.get("barcode");
    const q = searchParams.get("q") || "";
    const tombo = searchParams.get("tombo") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");

    // Busca exata por código de barras (usada no fluxo de empréstimo)
    if (barcode) {
      const exemplar = await prisma.exemplar.findFirst({
        where: { barcode: { equals: barcode.trim(), mode: "insensitive" } },
        select: {
          ...EXEMPLAR_SELECT,
          catalog: {
            select: {
              id: true,
              title: true,
              subtitle: true,
              authors: true,
              isbn: true,
              callNumber: true,
              classification: true,
            },
          },
          loans: {
            where: { status: { in: ["ACTIVE", "OVERDUE", "RENEWED"] } },
            orderBy: { loanDate: "desc" },
            take: 1,
            select: {
              id: true,
              dueDate: true,
              status: true,
              user: { select: { id: true, name: true, email: true } },
            },
          },
        },
      });

      if (!exemplar) {
        return NextResponse.json(
          { error: "Exemplar não encontrado para este código de barras" },
          { status: 404 }
        );
      }

      return NextResponse.json({ exemplar });
    }

    const where: any = {};
    if (catalogId) where.catalogId = catalogId;
    if (status) where.status = status;
    if (tombo) where.catalog = { tombo: { equals: tombo.trim(), mode: "insensitive" } };
    if (q) {
      const matchTerm = (term: string) => {
        // "Ex.3" / "exemplar 3" procura pelo número do exemplar
        const comoExemplar = term.match(/^(?:ex\.?|exemplar)\s*0*(\d{1,4})$/i);
        if (comoExemplar) {
          return [{ exemplarNumber: parseInt(comoExemplar[1], 10) }];
        }
        return [
          { barcode: { contains: term, mode: "insensitive" } },
          { accessionNumber: { contains: term, mode: "insensitive" } },
          { callNumber: { contains: term, mode: "insensitive" } },
          { cutterCode: { contains: term, mode: "insensitive" } },
          { catalog: { title: { contains: term, mode: "insensitive" } } },
          { catalog: { authors: { has: term } } },
          { catalog: { subjects: { has: term } } },
          { catalog: { classification: { contains: term, mode: "insensitive" } } },
          { catalog: { accessionNumber: { contains: term, mode: "insensitive" } } },
          // cobre busca por parte do nome do autor e do assunto
          { catalog: { searchText: { contains: term.toLowerCase(), mode: "insensitive" } } },
        ];
      };

      // Todos os termos precisam existir (ex.: "004.67 M278")
      const terms = q.trim().split(/\s+/).filter(Boolean);
      if (terms.length > 1) {
        where.AND = terms.map((term) => ({ OR: matchTerm(term) }));
      } else {
        where.OR = matchTerm(terms[0]);
      }
    }

    const [exemplars, total] = await Promise.all([
      prisma.exemplar.findMany({
        where,
        select: {
          ...EXEMPLAR_SELECT,
          catalog: {
            select: {
              id: true,
              title: true,
              authors: true,
              callNumber: true,
              cutterCode: true,
              classification: true,
              tombo: true,
            },
          },
        },
        orderBy: [{ status: "asc" }, { accessionNumber: "asc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.exemplar.count({ where }),
    ]);

    return NextResponse.json({ exemplars, total, page });
  } catch (error) {
    console.error("Exemplars list error:", error);
    return NextResponse.json(
      { error: "Erro ao buscar exemplares" },
      { status: 500 }
    );
  }
}

// ============================================
// POST - Inserir exemplar em acervo já existente
//
// Cópia do mesmo item NÃO vira registro novo: entra como
// mais um exemplar dentro do mesmo número de acervo.
// ============================================
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.catalogId) {
      return NextResponse.json(
        { error: "catálogo (catalogId) é obrigatório" },
        { status: 400 }
      );
    }

    const catalog = await prisma.catalog.findUnique({
      where: { id: body.catalogId },
      select: {
        id: true,
        callNumber: true,
        cutterCode: true,
        accessionNumber: true,
        acquisitionNumber: true,
      },
    });

    if (!catalog) {
      return NextResponse.json({ error: "Catálogo não encontrado" }, { status: 404 });
    }

    const requestedStatus = String(body.status || "AVAILABLE").toUpperCase();
    const status: ExemplarStatus = VALID_STATUSES.includes(
      requestedStatus as ExemplarStatus
    )
      ? (requestedStatus as ExemplarStatus)
      : "AVAILABLE";

    // O acervo é o do registro: nunca muda ao acrescentar cópias.
    const acervo = catalog.acquisitionNumber || catalog.accessionNumber || null;

    // Quantas cópias inserir (padrão: 1)
    const quantidade = Math.min(Math.max(1, parseInt(body.quantity) || 1), 200);

    const created = [];
    for (let i = 0; i < quantidade; i++) {
      created.push(
        await prisma.exemplar.create({
          data: {
            catalogId: catalog.id,
            accessionNumber: acervo,
            exemplarNumber: await nextExemplarNumber(catalog.id),
            barcode: await nextBarcode(),
            callNumber: body.callNumber ?? catalog.callNumber,
            cutterCode: body.cutterCode ?? catalog.cutterCode,
            status,
            internalNote: body.internalNote,
          },
          select: {
            ...EXEMPLAR_SELECT,
            catalog: {
              select: { id: true, title: true, accessionNumber: true },
            },
          },
        })
      );
    }

    // Mantém o total de cópias do catálogo em dia
    const total = await prisma.exemplar.count({ where: { catalogId: catalog.id } });
    await prisma.catalog.update({
      where: { id: catalog.id },
      data: { totalCopies: total },
    });

    return NextResponse.json({
      success: true,
      exemplars: created,
      message:
        created.length === 1
          ? "Exemplar inserido no acervo"
          : `${created.length} exemplares inseridos no acervo`,
    });
  } catch (error) {
    console.error("Exemplar create error:", error);
    return NextResponse.json(
      { error: "Erro ao criar exemplar" },
      { status: 500 }
    );
  }
}

// ============================================
// PUT - Alterar status / dados do exemplar E catálogo
// ============================================
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      id, 
      status, 
      internalNote, 
      callNumber, 
      cutterCode, 
      barcode, 
      accessionNumber,
      // Campos do catálogo (opcionais, para edição completa)
      catalogId,
      title,
      subtitle,
      titleStatement,
      authors,
      contributors,
      edition,
      publisher,
      publicationPlace,
      publicationYear,
      seriesTitle,
      seriesVolume,
      isbn,
      issn,
      subjects,
      classification,
      cdd,
      cdu,
      physicalDesc,
      generalNote,
      contentNote,
      contentNoteMarc,
      bibReference,
      uniformSeriesTitle,
      tombo,
      coverUrl,
      fixedFields,
      volume,
      number,
      period,
      materialType,
      customFields,
    } = body;

    if (!id) {
      return NextResponse.json(
        { error: "ID do exemplar é obrigatório" },
        { status: 400 }
      );
    }

    const current = await prisma.exemplar.findUnique({
      where: { id },
      select: { id: true, status: true, catalogId: true, barcode: true },
    });

    if (!current) {
      return NextResponse.json({ error: "Exemplar não encontrado" }, { status: 404 });
    }

    // O status de um exemplar com empréstimo ativo é controlado pelo fluxo
    // de empréstimos/devoluções, para não deixar o acervo inconsistente.
    if (status && String(status).toUpperCase() !== current.status) {
      const activeLoan = await prisma.loan.findFirst({
        where: { exemplarId: id, status: { in: ["ACTIVE", "OVERDUE", "RENEWED"] } },
        select: { id: true },
      });
      if (activeLoan) {
        return NextResponse.json(
          { error: "Exemplar possui empréstimo ativo" },
          { status: 400 }
        );
      }
    }

    const data: any = {};
    if (status) {
      const upper = String(status).toUpperCase();
      if (!VALID_STATUSES.includes(upper as ExemplarStatus)) {
        return NextResponse.json({ error: "Status inválido" }, { status: 400 });
      }
      data.status = upper;
    }
    if (internalNote !== undefined) data.internalNote = internalNote;
    if (callNumber !== undefined) data.callNumber = callNumber;
    if (cutterCode !== undefined) data.cutterCode = cutterCode;
    if (accessionNumber !== undefined) data.accessionNumber = accessionNumber || null;
    if (barcode !== undefined) {
      const normalizedBarcode = String(barcode).trim();
      if (!normalizedBarcode) {
        return NextResponse.json({ error: "O código de barras é obrigatório" }, { status: 400 });
      }
      if (normalizedBarcode !== current.barcode) {
        const barcodeInUse = await prisma.exemplar.findUnique({
          where: { barcode: normalizedBarcode },
          select: { id: true },
        });
        if (barcodeInUse) {
          return NextResponse.json(
            { error: "Este código de barras já pertence a outro exemplar" },
            { status: 409 }
          );
        }
      }
      data.barcode = normalizedBarcode;
    }

    // Se há dados do catálogo, atualiza também o registro bibliográfico
    let updatedCatalog = null;
    const hasCatalogData = title !== undefined || authors !== undefined || contributors !== undefined ||
      edition !== undefined || publisher !== undefined || publicationPlace !== undefined ||
      publicationYear !== undefined || seriesTitle !== undefined || seriesVolume !== undefined ||
      isbn !== undefined || issn !== undefined || subjects !== undefined || classification !== undefined ||
      cdd !== undefined || cdu !== undefined || physicalDesc !== undefined || generalNote !== undefined ||
      contentNote !== undefined || contentNoteMarc !== undefined || bibReference !== undefined ||
      uniformSeriesTitle !== undefined || tombo !== undefined || coverUrl !== undefined ||
      fixedFields !== undefined || volume !== undefined || number !== undefined || period !== undefined ||
      materialType !== undefined || subtitle !== undefined || titleStatement !== undefined ||
      callNumber !== undefined || cutterCode !== undefined || customFields !== undefined;

    if (hasCatalogData && catalogId) {
      const { generateCutter, buildSearchText } = await import("@/lib/numbering");
      // urlOrNull helper - copy from catalog/route.ts
      const urlOrNull = (v: unknown, max = 600) => {
        const s = typeof v === "string" ? v.trim().slice(0, max) : null;
        if (!s) return null;
        try {
          const u = new URL(s);
          return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
        } catch {
          return null;
        }
      };
      
      // Busca o catálogo atual para mesclar dados
      const currentCatalog = await prisma.catalog.findUnique({
        where: { id: catalogId },
      });
      
      if (currentCatalog) {
        const list = (value: unknown): string[] => Array.from(new Map(
          (Array.isArray(value) ? value : []).filter((v): v is string => typeof v === "string")
            .map((v) => v.trim()).filter(Boolean)
            .map((v) => [v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(), v] as const)
        ).values());
        
        const finalAuthors = list(authors ?? currentCatalog.authors);
        const finalContributors = list(contributors ?? currentCatalog.contributors);
        const finalSubjects = list(subjects ?? currentCatalog.subjects);
        const finalCutterCode = String(cutterCode ?? currentCatalog.cutterCode ?? generateCutter(finalAuthors)).trim();
        
        const marc505 = normalizeMarc505(contentNoteMarc ?? currentCatalog.contentNoteMarc, contentNote ?? currentCatalog.contentNote);
        
        const searchText = buildSearchText({ 
          title: (title ?? currentCatalog.title).trim(), 
          subtitle: subtitle ?? currentCatalog.subtitle, 
          authors: finalAuthors, 
          contributors: finalContributors, 
          subjects: finalSubjects, 
          callNumber: callNumber ?? currentCatalog.callNumber, 
          cutterCode: finalCutterCode, 
          classification: classification ?? currentCatalog.classification, 
          cdd: cdd ?? currentCatalog.cdd, 
          cdu: cdu ?? currentCatalog.cdu, 
          isbn: isbn ?? currentCatalog.isbn, 
          issn: issn ?? currentCatalog.issn, 
          edition: edition ?? currentCatalog.edition, 
          publisher: publisher ?? currentCatalog.publisher, 
          tombo: tombo ?? currentCatalog.tombo, 
          acquisition: currentCatalog.acquisitionNumber, 
          contentNote: marc505.display 
        });
        
        await registerAuthorities(finalAuthors, finalContributors, finalSubjects, publisher ?? currentCatalog.publisher, publicationPlace ?? currentCatalog.publicationPlace);
        
        updatedCatalog = await prisma.catalog.update({
          where: { id: catalogId },
          data: {
            materialType: materialType ?? currentCatalog.materialType,
            title: title ?? currentCatalog.title,
            subtitle: subtitle ?? currentCatalog.subtitle,
            titleStatement: titleStatement ?? currentCatalog.titleStatement,
            authors: finalAuthors,
            contributors: finalContributors,
            edition: edition ?? currentCatalog.edition,
            publisher: publisher ?? currentCatalog.publisher,
            publicationPlace: publicationPlace ?? currentCatalog.publicationPlace,
            publicationYear: publicationYear ?? currentCatalog.publicationYear,
            seriesTitle: seriesTitle ?? currentCatalog.seriesTitle,
            seriesVolume: seriesVolume ?? currentCatalog.seriesVolume,
            isbn: isbn ?? currentCatalog.isbn,
            issn: issn ?? currentCatalog.issn,
            subjects: finalSubjects,
            classification: classification ?? currentCatalog.classification,
            cdd: cdd ?? currentCatalog.cdd,
            cdu: cdu ?? currentCatalog.cdu,
            physicalDesc: physicalDesc ?? currentCatalog.physicalDesc,
            generalNote: generalNote ?? currentCatalog.generalNote,
            contentNote: marc505.display || null,
            contentNoteMarc: marc505.marc,
            bibReference: bibReference ?? currentCatalog.bibReference,
            uniformSeriesTitle: uniformSeriesTitle ?? currentCatalog.uniformSeriesTitle,
            callNumber: callNumber ?? currentCatalog.callNumber,
            cutterCode: finalCutterCode || null,
            tombo: tombo ?? currentCatalog.tombo,
            coverUrl: urlOrNull(coverUrl ?? currentCatalog.coverUrl),
            fixedFields: fixedFields ?? currentCatalog.fixedFields,
            volume: volume ?? currentCatalog.volume,
            number: number ?? currentCatalog.number,
            period: period ?? currentCatalog.period,
            customFields: Array.isArray(customFields) ? customFields : (Array.isArray(currentCatalog.customFields) ? currentCatalog.customFields : []),
            searchText,
          },
        });
        
        // Propaga callNumber e cutterCode para TODOS os exemplares do catálogo
        if (callNumber !== undefined || cutterCode !== undefined) {
          await prisma.exemplar.updateMany({
            where: { catalogId },
            data: {
              ...(callNumber !== undefined ? { callNumber } : {}),
              ...(cutterCode !== undefined ? { cutterCode: finalCutterCode } : {}),
            },
          });
        }
      }
    }

    const exemplar = await prisma.exemplar.update({
      where: { id },
      data,
      select: EXEMPLAR_SELECT,
    });

    return NextResponse.json({ success: true, exemplar, catalog: updatedCatalog });
  } catch (error) {
    console.error("Exemplar update error:", error);
    return NextResponse.json(
      { error: "Erro ao atualizar exemplar" },
      { status: 500 }
    );
  }
}

// ============================================
// DELETE - Remover exemplar
// ============================================
export async function DELETE(request: NextRequest) {
  try {
    const { id } = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: "ID do exemplar é obrigatório" },
        { status: 400 }
      );
    }

    const activeLoan = await prisma.loan.findFirst({
      where: { exemplarId: id, status: { in: ["ACTIVE", "OVERDUE", "RENEWED"] } },
      select: { id: true },
    });

    if (activeLoan) {
      return NextResponse.json(
        { error: "Não é possível remover: exemplar tem empréstimo ativo" },
        { status: 400 }
      );
    }

    const exemplar = await prisma.exemplar.findUnique({
      where: { id },
      select: { catalogId: true },
    });

    await prisma.exemplar.delete({ where: { id } });

    if (exemplar) {
      const count = await prisma.exemplar.count({
        where: { catalogId: exemplar.catalogId },
      });
      await prisma.catalog.update({
        where: { id: exemplar.catalogId },
        data: { totalCopies: count },
      });
    }

    return NextResponse.json({ success: true, message: "Exemplar removido" });
  } catch (error) {
    console.error("Exemplar delete error:", error);
    return NextResponse.json(
      { error: "Erro ao remover exemplar" },
      { status: 500 }
    );
  }
}

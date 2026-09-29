// ============================================
// BiblioGest - API Etiquetas
//
// Segue o modelo do Koha: cada etiqueta é um "item",
// impresso com código de barras (Code 39) + dados
// bibliográficos. O número de chamada pode ser dividido
// entre classificação e cutter (padrão para lombada).
// ============================================

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Dimensões em mm por tipo de etiqueta
const SIZES: Record<string, { w: number; h: number }> = {
  SPINE: { w: 50, h: 20 },
  FRONT: { w: 70, h: 30 },
  BARCODE: { w: 40, h: 20 },
};

/**
 * Divide o número de chamada em classificação + cutter.
 * Ex.: "004.67 M278" -> { classification: "004.67", cutter: "M278" }
 *      "050.2 A123"  -> { classification: "050.2",  cutter: "A123" }
 */
function splitCallNumber(
  callNumber?: string | null,
  cutterCode?: string | null
) {
  const call = (callNumber || "").trim();
  const cutter = (cutterCode || "").trim();

  // Se o cutter já estiver embutido no número de chamada, separa
  const embedded = call.match(/^(.*?)[\s.]?([A-Z]{1,3}\d{1,4})$/i);

  if (embedded && !cutter) {
    return {
      classification: embedded[1].trim() || call,
      cutter: embedded[2].toUpperCase(),
    };
  }

  return {
    classification: call,
    cutter,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type = "SPINE", exemplarIds } = body;

    if (!Array.isArray(exemplarIds) || exemplarIds.length === 0) {
      return NextResponse.json(
        { error: "Selecione ao menos um exemplar" },
        { status: 400 }
      );
    }

    const exemplars = await prisma.exemplar.findMany({
      where: { id: { in: exemplarIds } },
      include: {
        catalog: {
          select: {
            id: true,
            title: true,
            subtitle: true,
            authors: true,
            edition: true,
            publisher: true,
            publicationYear: true,
            callNumber: true,
            cutterCode: true,
            classification: true,
            cdd: true,
            cdu: true,
            controlNumber: true,
            subjects: true,
          },
        },
      },
      orderBy: { accessionNumber: "asc" },
    });

    const labels = exemplars.map((exemplar, i) => {
      const catalog = exemplar.catalog;

      // Número de chamada do exemplar; senão o do catálogo
      const fullCall = [
        exemplar.callNumber || catalog.callNumber || catalog.classification || "",
        exemplar.cutterCode || catalog.cutterCode || "",
      ]
        .filter(Boolean)
        .join(" ")
        .trim();

      const { classification, cutter } = splitCallNumber(
        catalog.classification || catalog.callNumber,
        exemplar.cutterCode || catalog.cutterCode
      );

      return {
        type,
        exemplarId: exemplar.id,
        barcode: exemplar.barcode,
        accessionNumber: exemplar.accessionNumber,
        // "Ex.5" — posição do exemplar dentro do título
        exemplarIndex: i + 1,
        callNumber: fullCall,
        classification,
        cutter,
        edition: catalog.edition || null,
        status: exemplar.status,
        size: SIZES[type] ?? SIZES.SPINE,
        catalog: {
          ...catalog,
          authors: catalog.authors ?? [],
          subjects: catalog.subjects ?? [],
        },
      };
    });

    return NextResponse.json({ success: true, labels, total: labels.length });
  } catch (error) {
    console.error("Labels error:", error);
    return NextResponse.json(
      { error: "Erro ao gerar etiquetas" },
      { status: 500 }
    );
  }
}

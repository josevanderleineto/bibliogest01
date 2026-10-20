// ============================================
// BiblioGest - API Adicionar Exemplar a Registro Existente
// ============================================

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { nextAcquisitionNumber, nextBarcode, nextExemplarNumber } from "@/lib/numbering";
import type { ExemplarStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

const VALID_STATUSES: ExemplarStatus[] = ["AVAILABLE", "PROCESSING", "RESTORATION", "MAINTENANCE"];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    const catalog = await prisma.catalog.findUnique({
      where: { id },
      include: { exemplars: true }
    });
    
    if (!catalog) {
      return NextResponse.json({ error: "Registro não encontrado" }, { status: 404 });
    }
    
    // Gera número de acervo novo (nova aquisição) ou usa o existente?
    // Para adicionar exemplar ao mesmo acervo, usa o acquisitionNumber existente
    // Para nova aquisição do mesmo título, gera novo acquisitionNumber
    const isNewAcquisition = body.newAcquisition === true;
    const acquisition = isNewAcquisition 
      ? await nextAcquisitionNumber() 
      : catalog.acquisitionNumber || await nextAcquisitionNumber();
    
    const exemplarNumber = await nextExemplarNumber(id);
    const barcode = await nextBarcode();
    
    const status = VALID_STATUSES.includes(body.status as ExemplarStatus) 
      ? body.status 
      : "AVAILABLE";
    
    const exemplar = await prisma.exemplar.create({
      data: {
        catalogId: id,
        accessionNumber: acquisition,
        exemplarNumber,
        barcode,
        callNumber: body.callNumber || catalog.callNumber,
        cutterCode: body.cutterCode || catalog.cutterCode,
        status,
        internalNote: body.internalNote,
      }
    });
    
    // Atualiza totalCopies se nova aquisição
    if (isNewAcquisition) {
      await prisma.catalog.update({
        where: { id },
        data: { 
          totalCopies: { increment: 1 },
          acquisitionNumber: acquisition,
          accessionNumber: acquisition,
        }
      });
    } else {
      await prisma.catalog.update({
        where: { id },
        data: { totalCopies: { increment: 1 } }
      });
    }
    
    return NextResponse.json({
      success: true,
      exemplar,
      message: `Exemplar ${exemplarNumber} adicionado com sucesso`
    });
    
  } catch (error) {
    console.error("Add exemplar error:", error);
    return NextResponse.json({ error: "Erro ao adicionar exemplar" }, { status: 500 });
  }
}
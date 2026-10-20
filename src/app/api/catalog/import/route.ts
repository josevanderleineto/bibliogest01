// ============================================
// BiblioGest - API Import Catalogação Cooperativa
// Aceita MARC bruto, parseia, compara, cria registro
// ============================================

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  nextControlNumber,
  nextAcquisitionNumber,
  nextBarcode,
  nextRegisterDate,
  generateCutter,
  buildSearchText,
} from "@/lib/numbering";
import type { ExemplarStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

const VALID_STATUSES: ExemplarStatus[] = [
  "AVAILABLE", "PROCESSING", "RESTORATION", "MAINTENANCE"
];

// Parser MARC bruto (mesmo da frontend)
function parseMarcRaw(raw: string) {
  const lines = raw.trim().split(/\r?\n/);
  const fields: any[] = [];
  let leader = "";
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    if (trimmed.startsWith("000 ")) {
      leader = trimmed.substring(4).trim();
      continue;
    }
    
    const controlMatch = trimmed.match(/^(\d{3})\s+(.+)$/);
    if (controlMatch) {
      fields.push({
        tag: controlMatch[1],
        indicators: "  ",
        subfields: [{ code: "a", value: controlMatch[2].trim() }]
      });
      continue;
    }
    
    const varMatch = trimmed.match(/^(\d{3})\s+(.)(.)\s*(.+)$/);
    if (varMatch) {
      const subfields: any[] = [];
      const subfieldRegex = /\|([a-z0-9])\s*([^|]*)/g;
      let match;
      while ((match = subfieldRegex.exec(varMatch[4])) !== null) {
        if (match[2].trim()) subfields.push({ code: match[1], value: match[2].trim() });
      }
      fields.push({
        tag: varMatch[1],
        indicators: varMatch[2] + varMatch[3],
        subfields
      });
    }
  }
  
  const controlField = fields.find(f => f.tag === "001");
  return { fields, leader, controlNumber: controlField?.subfields[0]?.value };
}

function getField(record: any, tag: string) {
  return record.fields.filter((f: any) => f.tag === tag);
}
function getSubfield(field: any, code: string) {
  return field?.subfields?.find((s: any) => s.code === code)?.value || "";
}
function getAllSubfields(record: any, tag: string, code: string) {
  return getField(record, tag).map((f: any) => getSubfield(f, code)).filter(Boolean);
}

function marcToCatalogData(record: any) {
  const f245 = getField(record, "245")[0];
  const pubFields = [...getField(record, "260"), ...getField(record, "264")];
  const f260 = pubFields[0];
  
  const authors = getAllSubfields(record, "100", "a");
  const contributors = getAllSubfields(record, "700", "a");
  const subjects = [...getAllSubfields(record, "650", "a"), ...getAllSubfields(record, "651", "a"), ...getAllSubfields(record, "600", "a")];
  
  const materialTypeMap: Record<string, string> = {
    "Manuscrito": "OTHER", "Livro": "BOOK", "Periódico": "PERIODICAL"
  };
  const materialType = materialTypeMap[getAllSubfields(record, "990", "a")[0] || ""] || "BOOK";
  const marc505Fields = getField(record, "505");
  const contentNoteMarc = {
    indicator1: marc505Fields[0]?.indicators?.[0] || " ",
    indicator2: marc505Fields[0]?.indicators?.[1] || " ",
    subfields: marc505Fields.flatMap((field: any) => field.subfields
      .filter((subfield: any) => ["a", "g", "r", "t"].includes(subfield.code) && subfield.value)
      .map((subfield: any) => ({ code: subfield.code, value: subfield.value }))),
  };
  
  return {
    title: getSubfield(f245, "a") || "",
    subtitle: getSubfield(f245, "b") || "",
    titleStatement: getSubfield(f245, "c") || "",
    authors,
    contributors,
    publisher: getSubfield(f260, "b") || "",
    publicationPlace: getSubfield(f260, "a") || "",
    publicationYear: getSubfield(f260, "c") || "",
    physicalDesc: getAllSubfields(record, "300", "a").join(" "),
    cdd: getAllSubfields(record, "082", "a").join(" ") || getAllSubfields(record, "092", "a").join(" "),
    callNumber: getAllSubfields(record, "093", "a").join(" ") || getAllSubfields(record, "082", "a").join(" "),
    subjects,
    generalNote: [...getAllSubfields(record, "540", "a"), ...getAllSubfields(record, "546", "a"), ...getAllSubfields(record, "500", "a")].join(" | "),
    contentNote: contentNoteMarc.subfields.map((field: any) => field.value).join(" -- "),
    contentNoteMarc,
    isbn: getAllSubfields(record, "020", "a")[0] || "",
    issn: getAllSubfields(record, "022", "a")[0] || "",
    materialType: materialType as "BOOK" | "PERIODICAL" | "OTHER",
    cutterCode: "",
    classification: getAllSubfields(record, "082", "a")[0] || "",
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      fromLibrary, 
      marcData, 
      tagsInicial = "<inicio>", 
      tagsFinal = "<fim>", 
      overwrite = true,
      importMode = "new",
      ...catalogFields 
    } = body;

    if (!fromLibrary?.trim() || !marcData?.trim()) {
      return NextResponse.json({ error: "Biblioteca de origem e dados MARC são obrigatórios" }, { status: 400 });
    }

    // Parse do MARC
    const parsed = parseMarcRaw(marcData);
    const marcDataParsed = marcToCatalogData(parsed);
    
    // Mescla com campos do body (body tem prioridade)
    const finalData = { ...marcDataParsed, ...catalogFields };
    
    // Gera cutter se não tiver
    if (!finalData.cutterCode && finalData.authors.length > 0) {
      finalData.cutterCode = generateCutter(finalData.authors);
    }

    // Valida título
    if (!finalData.title?.trim()) {
      return NextResponse.json({ error: "Título é obrigatório" }, { status: 400 });
    }

    // Números automáticos
    const controlNumber = await nextControlNumber();
    const acquisition = await nextAcquisitionNumber();
    const registerDate = await nextRegisterDate();
    
    const searchText = buildSearchText({
      title: finalData.title.trim(),
      subtitle: finalData.subtitle,
      authors: finalData.authors,
      contributors: finalData.contributors,
      subjects: finalData.subjects,
      callNumber: finalData.callNumber,
      cutterCode: finalData.cutterCode,
      classification: finalData.classification,
      cdd: finalData.cdd,
      cdu: finalData.cdu,
      isbn: finalData.isbn,
      issn: finalData.issn,
      edition: finalData.edition,
      publisher: finalData.publisher,
      tombo: finalData.tombo,
      acquisition,
    });

    // Cria registro
    const catalog = await prisma.catalog.create({
      data: {
        controlNumber,
        fixedFields: registerDate,
        materialType: finalData.materialType,
        title: finalData.title.trim(),
        subtitle: finalData.subtitle,
        titleStatement: finalData.titleStatement,
        authors: finalData.authors,
        contributors: finalData.contributors,
        publisher: finalData.publisher,
        publicationPlace: finalData.publicationPlace,
        publicationYear: finalData.publicationYear,
        physicalDesc: finalData.physicalDesc,
        cdd: finalData.cdd,
        callNumber: finalData.callNumber,
        cutterCode: finalData.cutterCode,
        classification: finalData.classification,
        subjects: finalData.subjects,
        generalNote: finalData.generalNote,
        contentNote: finalData.contentNote,
        contentNoteMarc: finalData.contentNoteMarc,
        isbn: finalData.isbn,
        issn: finalData.issn,
        searchText,
        acquisitionNumber: acquisition,
        accessionNumber: acquisition,
        importSource: fromLibrary,
        importDate: new Date(),
        importMarcData: marcData,
        totalCopies: 1,
      }
    });

    // Cria 1 exemplar
    const exemplar = await prisma.exemplar.create({
      data: {
        catalogId: catalog.id,
        accessionNumber: acquisition,
        exemplarNumber: 1,
        barcode: await nextBarcode(),
        callNumber: catalog.callNumber,
        cutterCode: catalog.cutterCode,
        status: "AVAILABLE",
      }
    });

    return NextResponse.json({
      success: true,
      catalog: { ...catalog, exemplars: [exemplar] },
      message: "Registro importado com sucesso"
    });

  } catch (error) {
    console.error("Import error:", error);
    return NextResponse.json({ error: "Erro ao importar: " + (error as Error).message }, { status: 500 });
  }
}

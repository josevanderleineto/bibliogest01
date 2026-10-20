// ============================================
// BiblioGest - API Export Catalogação Cooperativa
// Exporta registros em MARC21, MARCXML ou JSON
// ============================================

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

function marc505(catalog: any) {
  const raw = catalog.contentNoteMarc && typeof catalog.contentNoteMarc === "object" ? catalog.contentNoteMarc : {};
  const allowed = new Set(["a", "g", "r", "t"]);
  const subfields = Array.isArray(raw.subfields)
    ? raw.subfields.filter((field: any) => allowed.has(field?.code) && String(field?.value || "").trim())
    : (catalog.contentNote ? [{ code: "a", value: catalog.contentNote }] : []);
  return {
    indicator1: /^[0-9 ]$/.test(raw.indicator1 || "") ? raw.indicator1 : " ",
    indicator2: /^[0-9 ]$/.test(raw.indicator2 || "") ? raw.indicator2 : " ",
    subfields,
  };
}

function catalogToMarc21(catalog: any): string {
  const fields: string[] = [];
  
  // Leader simulado
  fields.push("=LDR  00000nam a2200000 a 4500");
  
  // 001 - Número de controle
  if (catalog.controlNumber) {
    fields.push(`=001  ${catalog.controlNumber}`);
  }
  
  // 005 - Timestamp
  fields.push(`=005  ${new Date().toISOString().replace(/[-:]/g, "").split(".")[0]}.0`);
  
  // 008 - Fixed fields (simplificado)
  const year = catalog.publicationYear?.substring(0, 4) || new Date().getFullYear().toString();
  fields.push(`=008  ${year}                            por  `);
  
  // 020 - ISBN
  if (catalog.isbn) {
    fields.push(`=020  \\\\$a${catalog.isbn}`);
  }
  
  // 022 - ISSN
  if (catalog.issn) {
    fields.push(`=022  \\\\$a${catalog.issn}`);
  }
  
  // 040 - Catálogo de origem
  fields.push(`=040  \\\\$a${catalog.importSource || "BiblioGest"}$c${catalog.importSource || "BiblioGest"}`);
  
  // 082 - CDD
  if (catalog.cdd) {
    fields.push(`=082  \\\\$a${catalog.cdd}`);
  }
  
  // 090/092/093 - Classificação local
  if (catalog.callNumber) {
    fields.push(`=090  \\\\$a${catalog.callNumber}`);
  }
  if (catalog.cutterCode) {
    fields.push(`=092  \\\\$a${catalog.cutterCode}`);
  }
  
  // 100 - Autor principal
  if (catalog.authors?.length > 0) {
    catalog.authors.forEach((author: string, i: number) => {
      const tag = i === 0 ? "100" : "700";
      fields.push(`=${tag}  1\\$a${author}`);
    });
  }
  
  // 245 - Título
  if (catalog.title) {
    let f245 = "=245  10$a" + catalog.title;
    if (catalog.subtitle) f245 += "$b" + catalog.subtitle;
    if (catalog.titleStatement) f245 += "$c" + catalog.titleStatement;
    fields.push(f245);
  }
  
  // 260/264 - Publicação
  if (catalog.publisher || catalog.publicationPlace || catalog.publicationYear) {
    let f260 = "=260  \\\\";
    if (catalog.publicationPlace) f260 += "$a" + catalog.publicationPlace;
    if (catalog.publisher) f260 += "$b" + catalog.publisher;
    if (catalog.publicationYear) f260 += "$c" + catalog.publicationYear;
    fields.push(f260);
  }
  
  // 300 - Descrição física
  if (catalog.physicalDesc) {
    fields.push(`=300  \\\\$a${catalog.physicalDesc}`);
  }
  
  // 500 - Nota geral
  if (catalog.generalNote) {
    fields.push(`=500  \\\\$a${catalog.generalNote}`);
  }
  
  // 505 - Nota de conteúdo, mantendo indicadores e subcampos MARC.
  const note505 = marc505(catalog);
  if (note505.subfields.length) {
    fields.push(`=505  ${note505.indicator1}${note505.indicator2}${note505.subfields.map((field: any) => `$${field.code}${field.value}`).join("")}`);
  }
  
  // 650/651 - Assuntos
  catalog.subjects?.forEach((subject: string) => {
    fields.push(`=650  \\0$a${subject}`);
  });
  
  // 852 - Localização
  fields.push(`=852  \\\\$b${catalog.importSource || "Acervo Geral"}`);
  
  // 990 - Tipo de material
  const typeMap: Record<string, string> = { BOOK: "Livro", PERIODICAL: "Periódico", OTHER: "Manuscrito" };
  fields.push(`=990  \\\\$a${typeMap[catalog.materialType] || "Livro"}`);
  
  return fields.join("\n");
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/"/g, '"')
    .replace(/'/g, "&apos;");
}

function catalogToMarcXML(catalog: any): string {
  const ns = 'xmlns="http://www.loc.gov/MARC21/slim"';
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<collection ${ns}>\n  <record>\n`;
  
  // Leader
  xml += `    <leader>00000nam a2200000 a 4500</leader>\n`;
  
  // Control fields
  if (catalog.controlNumber) {
    xml += `    <controlfield tag="001">${escapeXml(catalog.controlNumber)}</controlfield>\n`;
  }
  
  // Data fields helper
  const addField = (tag: string, ind1: string, ind2: string, subfields: {code: string, value: string}[]) => {
    if (subfields.length === 0) return;
    xml += `    <datafield tag="${tag}" ind1="${ind1}" ind2="${ind2}">\n`;
    subfields.forEach(sf => {
      xml += `      <subfield code="${sf.code}">${escapeXml(sf.value)}</subfield>\n`;
    });
    xml += `    </datafield>\n`;
  };
  
  // 020 ISBN
  if (catalog.isbn) addField("020", " ", " ", [{code: "a", value: catalog.isbn}]);
  if (catalog.issn) addField("022", " ", " ", [{code: "a", value: catalog.issn}]);
  if (catalog.cdd) addField("082", " ", " ", [{code: "a", value: catalog.cdd}]);
  if (catalog.callNumber) addField("090", " ", " ", [{code: "a", value: catalog.callNumber}]);
  
  // Authors
  catalog.authors?.forEach((a: string, i: number) => {
    addField(i === 0 ? "100" : "700", "1", " ", [{code: "a", value: a}]);
  });
  
  // 245
  const sf245: any[] = [];
  if (catalog.title) sf245.push({code: "a", value: catalog.title});
  if (catalog.subtitle) sf245.push({code: "b", value: catalog.subtitle});
  if (catalog.titleStatement) sf245.push({code: "c", value: catalog.titleStatement});
  addField("245", "1", "0", sf245);
  
  // 260
  const sf260: any[] = [];
  if (catalog.publicationPlace) sf260.push({code: "a", value: catalog.publicationPlace});
  if (catalog.publisher) sf260.push({code: "b", value: catalog.publisher});
  if (catalog.publicationYear) sf260.push({code: "c", value: catalog.publicationYear});
  addField("260", " ", " ", sf260);
  
  if (catalog.physicalDesc) addField("300", " ", " ", [{code: "a", value: catalog.physicalDesc}]);
  if (catalog.generalNote) addField("500", " ", " ", [{code: "a", value: catalog.generalNote}]);
  const note505 = marc505(catalog);
  if (note505.subfields.length) addField("505", note505.indicator1, note505.indicator2, note505.subfields);
  
  catalog.subjects?.forEach((s: string) => {
    addField("650", " ", "0", [{code: "a", value: s}]);
  });
  
  if (catalog.importSource) addField("852", " ", " ", [{code: "b", value: catalog.importSource}]);
  
  const typeMap: Record<string, string> = { BOOK: "Livro", PERIODICAL: "Periódico", OTHER: "Manuscrito" };
  addField("990", " ", " ", [{code: "a", value: typeMap[catalog.materialType] || "Livro"}]);
  
  xml += `  </record>\n</collection>`;
  return xml;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const idsParam = searchParams.get("ids") || "";
    const format = searchParams.get("format") || "marc21";
    const toLibrary = searchParams.get("toLibrary") || "";
    
    const ids = idsParam.split(",").map(id => id.trim()).filter(Boolean);
    
    if (ids.length === 0) {
      return NextResponse.json({ error: "Nenhum ID informado" }, { status: 400 });
    }
    
    // Busca por ID ou controlNumber
    const catalogs = await prisma.catalog.findMany({
      where: {
        OR: [
          { id: { in: ids } },
          { controlNumber: { in: ids } }
        ]
      },
      include: {
        exemplars: {
          select: { id: true, accessionNumber: true, barcode: true, exemplarNumber: true, status: true }
        }
      }
    });
    
    if (catalogs.length === 0) {
      return NextResponse.json({ error: "Nenhum registro encontrado" }, { status: 404 });
    }
    
    // Atualiza exportedTo
    if (toLibrary) {
      await prisma.catalog.updateMany({
        where: { id: { in: catalogs.map(c => c.id) } },
        data: { exportedTo: { push: toLibrary } }
      });
    }
    
    let exportData = "";
    
    if (format === "marc21") {
      exportData = catalogs.map(catalogToMarc21).join("\n\n");
    } else if (format === "marcxml") {
      exportData = catalogs.map(catalogToMarcXML).join("\n\n");
    } else if (format === "json") {
      exportData = JSON.stringify(catalogs, null, 2);
    } else {
      return NextResponse.json({ error: "Formato inválido" }, { status: 400 });
    }
    
    return NextResponse.json({
      success: true,
      export: {
        format: format.toUpperCase(),
        count: catalogs.length,
        library: toLibrary,
        exportedAt: new Date().toISOString(),
        data: exportData
      }
    });
    
  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json({ error: "Erro ao exportar: " + (error as Error).message }, { status: 500 });
  }
}

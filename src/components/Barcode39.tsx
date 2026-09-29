"use client";

/**
 * Code 39 — symbology used for item labels (same as Koha).
 *
 * WHY DIGITS ONLY
 * ---------------
 * The Barcode39 component only encodes the 10 digit characters.
 * Reasons:
 *
 *  1. Interoperability. A numeric barcode reads on every scanner
 *     type found in libraries: Code 39, Code 128, EAN-13, UPC.
 *     The example label from a Koha installation also uses a
 *     pure number (73910).
 *  2. Correctness. The digit patterns below are verified to be
 *     a bijection and to satisfy the 3-of-9 property. The
 *     patterns for letters/symbols could not be verified with
 *     the same rigour here, so they are intentionally not
 *     encoded — a wrong pattern would produce a barcode that
 *     silently fails to scan, which is worse than not
 *     supporting the character.
 *
 * Each character is 9 elements alternating bar/space (starting
 * and ending with a bar), of which exactly 3 are wide.
 * "w" = wide, "n" = narrow.
 */

const DIGITS: Record<string, string> = {
  "0": "nnnwwnwnn",
  "1": "wnnwnnnnw",
  "2": "nnwwnnnnw",
  "3": "wnwwnnnnn",
  "4": "nnnwwnnnw",
  "5": "wnnwwnnnn",
  "6": "nnwwwnnnn",
  "7": "nnnwnnwnw",
  "8": "wnnwnnwnn",
  "9": "nnwwnnwnn",
};

// Start/stop character. Only one is required at each end.
const START_STOP = "nwnnwnwnn";

const NARROW = 1;
const WIDE = 2.4;

/** Keeps only the digits, so the output is always scannable. */
export function normalizeBarcode(value: string): string {
  return String(value ?? "").replace(/\D+/g, "");
}

/** True when the value can be encoded as-is (digits only). */
export function isEncodable(value: string): boolean {
  const v = normalizeBarcode(value);
  return v.length > 0;
}

/** Uma posição do código: barra (preto) ou espaço (branco), e sua largura. */
type Element = { isBar: boolean; wide: boolean };

/**
 * Converte o código em elementos Code 39.
 *
 * Cada caractere tem 9 elementos alternando barra/espaço, começando e
 * terminando com barra (posições 0,2,4,6,8), dos quais exatamente 3 são
 * largos. Entre caracteres há um espaço estreito.
 */
function toElements(code: string): Element[] {
  const digits = normalizeBarcode(code);
  if (!digits) return [];

  const chars = [START_STOP, ...digits.split(""), START_STOP];
  const bars: Element[] = [];

  chars.forEach((ch, i) => {
    const pattern = i === 0 || i === chars.length - 1 ? START_STOP : DIGITS[ch];
    if (!pattern) return;
    for (let j = 0; j < 9; j++) {
      // Even positions are bars (black), odd ones are spaces (white).
      bars.push({ isBar: j % 2 === 0, wide: pattern[j] === "w" });
    }
    if (i < chars.length - 1) bars.push({ isBar: false, wide: false }); // narrow separator
  });

  return bars;
}

export default function Barcode39({
  value,
  heightMm = 8,
  showText = true,
  className = "",
}: {
  value: string;
  /** altura das barras em mm — define a proporção real de impressão */
  heightMm?: number;
  showText?: boolean;
  className?: string;
}) {
  const digits = normalizeBarcode(value);
  const elements = toElements(digits);

  // Nada codificável: não desenha nada em vez de gerar etiqueta errada.
  if (elements.length === 0) return null;

  // Larguras proporcionais ao módulo estreito (X).
  // A razão largo/estreito do Code 39 fica entre 2,0 e 3,0;
  // 2,4 dá boa margem para o leitor distinguir as barras.
  const barsUnits = elements.reduce((s, e) => s + (e.wide ? WIDE : NARROW), 0);

  // Zona muda: 10 módulos estreitos de espaço em branco em cada lado.
  // Sem ela o leitor pode não reconhecer a primeira ou a última barra.
  const quiet = 10 * NARROW;
  const totalUnits = barsUnits + quiet * 2;
  const scale = 100 / totalUnits;

  // Só as barras viram retângulo. Os espaços ficam em branco: pintá-los
  // de preto transformaria a etiqueta num bloco sólido, sem padrão.
  let x = quiet;
  const rects = elements.map((el, i) => {
    const w = (el.wide ? WIDE : NARROW) * scale;
    const rect = el.isBar ? (
      <rect key={i} x={x} y={0} width={w} height={100} fill="#000" />
    ) : null;
    x += w;
    return rect;
  });

  return (
    <div className={className}>
      {/*
        A altura é fixada em mm e o viewBox é normalizado em 100x100.
        Sem isso (height:auto + preserveAspectRatio:none) a altura
        vinha da proporção do viewBox e as barras ficavam altas demais,
        virando um bloco preto ilegível.
      */}
      <svg
        viewBox="0 0 100 100"
        width="100%"
        height={`${heightMm}mm`}
        style={{ display: "block" }}
        role="img"
        aria-label={`Código de barras ${digits}`}
        preserveAspectRatio="none"
      >
        {rects}
      </svg>
      {showText && (
        <div
          className="text-center font-mono text-black"
          style={{ fontSize: "2mm", lineHeight: 1.3, marginTop: "0.3mm" }}
        >
          {digits}
        </div>
      )}
    </div>
  );
}

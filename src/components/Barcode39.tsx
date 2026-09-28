"use client";

/**
 * Code 39 — simbologia padrão do Koha para etiquetas de item.
 *
 * Renderizado como SVG: não depende de fonte nem de imagem externa,
 * portanto imprime corretamente em qualquer navegador/impressora.
 *
 * No Code 39 cada caractere vira 9 elementos (5 barras e 4 espaços)
 * + um espaço separador estreito entre caracteres. "w" = elemento largo.
 */

const CODE39: Record<string, string> = {
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
  A: "wnnnnwnnw",
  B: "nnwnnwnnw",
  C: "wnwnnwnnn",
  D: "nnnnwwnnw",
  E: "wnnnwwnnn",
  F: "nnwnwwnnn",
  G: "nnnnnwwnw",
  H: "wnnnnwwnn",
  I: "nnwnnwwnn",
  J: "nnnnwwwnn",
  K: "wnnnnnnww",
  L: "nnwnnnnww",
  M: "wnwnnnnwn",
  N: "nnnnwnnww",
  O: "wnnnwnnwn",
  P: "nnwnwnnwn",
  Q: "nnnnnnwww",
  R: "wnnnnnwwn",
  S: "nnwnnnwwn",
  T: "nnnnwnwwn",
  U: "wwnnnnnnw",
  V: "nwwnnnnnw",
  W: "wwwnnnnnn",
  X: "nwnnwnnnw",
  Y: "wwnnwnnnn",
  Z: "nwwnwnnnn",
  "-": "nwnnnnwnw",
  ".": "wwnnnnwnn",
  " ": "nwwnnnwnn",
  "/": "nwnwnwnnn",
  "+": "nwnnnwnwn",
  "%": "nnnwnwnwn",
  $: "nwnwnwnnn",
  "*": "nwnnwnwnn",
};

const NARROW = 1;
const WIDE = 2.4;

/** Converte o código em barras com largura relativa. */
function toBars(code: string): boolean[] {
  const clean = code.toUpperCase().replace(/[^0-9A-Z\-. $/+%*]/g, "");
  const chars = ["*", ...clean.split(""), "*"];
  const bars: boolean[] = [];

  chars.forEach((ch, i) => {
    const pattern = CODE39[ch];
    if (!pattern) return;
    for (let j = 0; j < 9; j++) {
      bars.push(pattern[j] === "w"); // true = largo
    }
    if (i < chars.length - 1) bars.push(false); // separador estreito
  });

  return bars;
}

export default function Barcode39({
  value,
  heightMm = 10,
  showText = true,
  className = "",
}: {
  value: string;
  /** altura das barras em mm */
  heightMm?: number;
  showText?: boolean;
  className?: string;
}) {
  const bars = toBars(value);
  if (bars.length === 0) return null;

  // viewBox normalizado em largura 100
  const totalUnits = bars.reduce((s, b) => s + (b ? WIDE : NARROW), 0);
  const scale = 100 / totalUnits;

  // altura visual proporcional (relação ~1:4 das barras)
  const H = Math.max(24, heightMm * 6);
  const textH = showText ? 11 : 0;

  let x = 0;
  const rects = bars.map((wide, i) => {
    const w = (wide ? WIDE : NARROW) * scale;
    const rect = <rect key={i} x={x} y={0} width={w} height={H} fill="#000" />;
    x += w;
    return rect;
  });

  return (
    <svg
      viewBox={`0 0 100 ${H + textH}`}
      className={className}
      style={{ width: "100%", height: "auto", display: "block" }}
      role="img"
      aria-label={`Código de barras ${value}`}
      preserveAspectRatio="none"
    >
      {rects}
      {showText && (
        <text
          x={50}
          y={H + 8.5}
          textAnchor="middle"
          fontSize="8.5"
          fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
          fill="#000"
        >
          {value}
        </text>
      )}
    </svg>
  );
}

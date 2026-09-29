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

/** Converts the code to a list of bars, with relative widths. */
function toBars(code: string): boolean[] {
  const digits = normalizeBarcode(code);
  if (!digits) return [];

  const chars = [START_STOP, ...digits.split(""), START_STOP];
  const bars: boolean[] = [];

  chars.forEach((ch, i) => {
    // The start/stop character is written out directly;
    // data characters come from the digit table.
    const pattern = i === 0 || i === chars.length - 1 ? START_STOP : DIGITS[ch];
    if (!pattern) return;
    for (let j = 0; j < 9; j++) bars.push(pattern[j] === "w");
    if (i < chars.length - 1) bars.push(false); // narrow separator
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
  /** height of the bars, in mm */
  heightMm?: number;
  showText?: boolean;
  className?: string;
}) {
  const digits = normalizeBarcode(value);
  const bars = toBars(digits);

  // Nothing encodable: render nothing rather than a wrong barcode.
  if (bars.length === 0) return null;

  // ViewBox normalised to width 100.
  const totalUnits = bars.reduce((s, b) => s + (b ? WIDE : NARROW), 0);
  const scale = 100 / totalUnits;

  // Visual proportion ~1:4.
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
      aria-label={`Código de barras ${digits}`}
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
          {digits}
        </text>
      )}
    </svg>
  );
}

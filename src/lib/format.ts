import numbro from "numbro";

export const fmtUSD = (n: number, opts?: { compact?: boolean }) =>
  opts?.compact
    ? "$" + numbro(n).format({ average: true, totalLength: 3, trimMantissa: true })
    : numbro(n).formatCurrency({ thousandSeparated: true, mantissa: 0 });

export const fmtUSDRange = (a: number, b: number) =>
  `${fmtUSD(a, { compact: true })}–${fmtUSD(b, { compact: true })}`;

export const fmtPct = (n: number, mantissa = 1) =>
  `${n >= 0 ? "+" : ""}${(n * (Math.abs(n) > 1.5 ? 1 : 100)).toFixed(mantissa)}%`;

export const fmtPctRaw = (n: number, mantissa = 1) => `${n >= 0 ? "+" : ""}${n.toFixed(mantissa)}%`;

export const fmtNum = (n: number) => numbro(n).format({ thousandSeparated: true });

export const signClass = (n: number) =>
  n > 0
    ? "text-[var(--positive)]"
    : n < 0
      ? "text-[var(--negative)]"
      : "text-[var(--text-secondary)]";

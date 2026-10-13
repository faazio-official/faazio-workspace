/** Money is always integer paisa. These two are the only conversion points. */
export function formatINR(paisa: number, opts?: { compact?: boolean }): string {
  const rupees = paisa / 100;
  if (opts?.compact) {
    if (Math.abs(rupees) >= 10000000)
      return `₹${(rupees / 10000000).toFixed(2)}Cr`;
    if (Math.abs(rupees) >= 100000) return `₹${(rupees / 100000).toFixed(2)}L`;
    if (Math.abs(rupees) >= 1000) return `₹${(rupees / 1000).toFixed(1)}K`;
  }
  return `₹${rupees.toLocaleString("en-IN", {
    minimumFractionDigits: rupees % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

export function parseRupeesToPaisa(input: string): number {
  const cleaned = input.replace(/[^0-9.]/g, "");
  if (!cleaned) return 0;
  return Math.round(Number(cleaned) * 100);
}

export function formatNumber(value: number): string {
  return value.toLocaleString("en-IN");
}

export function formatPercent(value: number, digits = 1): string {
  return `${value.toFixed(digits)}%`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

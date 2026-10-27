const money = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });

/** "$ 23.000", the way amounts appear across the panel. Negative values become "– $ 5.000". */
export function formatMoney(amount: number): string {
  const formatted = `$ ${money.format(Math.abs(amount))}`;
  return amount < 0 ? `– ${formatted}` : formatted;
}

/** "1.284" */
export function formatCount(value: number): string {
  return money.format(value);
}

/** Initials for avatars: "Marcela Bruno" → "MB". */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}

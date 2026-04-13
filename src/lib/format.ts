export function formatMoney(value: string | number, currencyCode: string) {
  const amount = typeof value === "number" ? value : Number(value);

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode,
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
}

export function formatSignedMoney(value: string | number, currencyCode: string) {
  const amount = typeof value === "number" ? value : Number(value);
  const sign = amount > 0 ? "+" : "";
  return `${sign}${formatMoney(amount, currencyCode)}`;
}

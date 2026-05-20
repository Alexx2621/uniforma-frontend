export const formatCurrency = (value: number | string | null | undefined) =>
  `Q ${Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const formatNumber = (value: number | string | null | undefined, decimals = 2) =>
  Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

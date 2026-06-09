export const emptyWhenZero = (value: number | string | null | undefined) => {
  if (value === "" || value === null || value === undefined) return "";
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric === 0 ? "" : value;
};

export const parseNumberInput = (value: string) => {
  if (`${value}`.trim() === "") return 0;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

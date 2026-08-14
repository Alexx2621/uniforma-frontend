export const PRODUCT_SEARCH_RESULT_LIMIT = 50;

export type ProductSearchEntry = {
  haystack: string;
  talla: string;
};

export const normalizeProductSearch = (value: unknown) =>
  `${value ?? ""}`
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

export const createProductSearchEntry = (
  values: unknown[],
  talla: unknown,
): ProductSearchEntry => ({
  haystack: values.map(normalizeProductSearch).join(" "),
  talla: normalizeProductSearch(talla),
});

export const filterIndexedProducts = <T,>(
  options: readonly T[],
  index: ReadonlyMap<T, ProductSearchEntry>,
  inputValue: string,
  exactTallas: ReadonlySet<string>,
  limit = PRODUCT_SEARCH_RESULT_LIMIT,
) => {
  const terms = normalizeProductSearch(inputValue).split(/\s+/).filter(Boolean);
  const matches: T[] = [];

  for (const option of options) {
    const entry = index.get(option);
    if (!entry) continue;

    const isMatch = !terms.length || terms.every((term) =>
      exactTallas.has(term) ? entry.talla === term : entry.haystack.includes(term),
    );

    if (isMatch) matches.push(option);
    if (matches.length >= limit) break;
  }

  return matches;
};

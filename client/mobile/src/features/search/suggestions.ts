import type { Product } from '@data/types';

/**
 * One Flipkart-style type-ahead suggestion. Primary text is the product name,
 * with a blue "In <category>" subtitle and the product thumbnail on the left.
 */
export interface SearchSuggestion {
  id: string;
  term: string;
  /** Tamil name authored by the seller (0107/0108). Shown instead of `term` when the app is in Tamil. */
  termTa?: string;
  category: string;
  image?: string;
}

/** Max number of suggestions surfaced while typing. */
const MAX_SUGGESTIONS = 8;

/**
 * Pure type-ahead engine. Ranks product suggestions by: name prefix match >
 * name substring match > category match, de-duplicating by product id and
 * capping at MAX_SUGGESTIONS. Category matches surface the product with its
 * own category as the subtitle. Works on the shared Product shape, so it plugs
 * into Mart / Pharma / Home-Hub configs; Food is deferred (different item shape).
 */
export function buildProductSuggestions(
  products: Product[],
  query: string,
): SearchSuggestion[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const seen = new Set<string>();
  const push = (p: Product) => {
    if (seen.has(p.id)) return;
    seen.add(p.id);
    return {
      id: p.id,
      term: p.name,
      ...(p.nameTa ? { termTa: p.nameTa } : {}),
      category: p.category,
      image: p.image,
    } as SearchSuggestion;
  };

  const prefix: SearchSuggestion[] = [];
  const nameMatch: SearchSuggestion[] = [];
  const categoryMatch: SearchSuggestion[] = [];

  for (const p of products) {
    const name = p.name.toLowerCase();
    const nameTa = (p.nameTa ?? '').toLowerCase();
    if (name.startsWith(q) || (nameTa && nameTa.startsWith(q))) {
      const s = push(p);
      if (s) prefix.push(s);
    } else if (name.includes(q) || (nameTa && nameTa.includes(q))) {
      const s = push(p);
      if (s) nameMatch.push(s);
    } else if (p.category.toLowerCase().includes(q)) {
      const s = push(p);
      if (s) categoryMatch.push(s);
    }
    if (prefix.length >= MAX_SUGGESTIONS) break;
  }

  const result = [...prefix, ...nameMatch, ...categoryMatch];
  return result.slice(0, MAX_SUGGESTIONS);
}

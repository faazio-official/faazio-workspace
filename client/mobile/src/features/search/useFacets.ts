import { useMemo } from 'react';
import type { ActiveFacets, FacetGroup, FacetSchema } from './types';

/**
 * Attribute-driven faceting. Aggregates `attributes` from the matched result
 * set — never a hand-mapped keyword→filter table — mirroring how Algolia /
 * Typesense / Meilisearch derive facet option counts natively.
 *
 * Counts follow standard faceted-search semantics: each facet's option counts
 * reflect the query + boolean chips + every *other* active facet, but not the
 * facet's own selection. This lets the user see what remains across facets and
 * that they can widen/clear the current facet without the counts collapsing.
 */
export function useFacets<TItem>({
  data,
  predicate,
  query,
  chipIds,
  facetSchema,
  activeFacets,
}: {
  data: TItem[];
  predicate: (item: TItem, query: string, chipIds: string[], facets: ActiveFacets) => boolean;
  query: string;
  chipIds: string[];
  facetSchema?: FacetSchema[];
  activeFacets: ActiveFacets;
}): FacetGroup[] {
  return useMemo(() => {
    if (!facetSchema || facetSchema.length === 0) return [];

    // Items matching query + boolean chips (ignoring all facets) = the base set
    // against which every facet's counts are derived.
    const base = data.filter((item) => predicate(item, query, chipIds, {}));

    return facetSchema.map((schema) => {
      const facetsFor = { ...activeFacets } as ActiveFacets;
      delete facetsFor[schema.key];

      const candidates = base.filter((item) =>
        predicate(item, query, chipIds, facetsFor),
      );

      const counter = new Map<string, number>();
      for (const item of candidates) {
        const attr = (item as { attributes?: Record<string, string | number | string[]> })
          .attributes?.[schema.key];
        if (attr === undefined || attr === null) continue;
        const values = Array.isArray(attr) ? attr : [String(attr)];
        for (const raw of values) {
          const value = String(raw);
          if (!value.trim()) continue;
          counter.set(value, (counter.get(value) ?? 0) + 1);
        }
      }

      const options = [...counter.entries()]
        .map(([value, count]) => ({ value, label: value, count }))
        .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

      return {
        key: schema.key,
        label: schema.label,
        multiSelect: schema.multiSelect ?? true,
        options,
      };
    }).filter((group) => group.options.length > 0);
  }, [data, predicate, query, chipIds, facetSchema, activeFacets]);
}

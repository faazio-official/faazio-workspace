import { useMemo } from 'react';
import { resolveInfo, type InfoDoc } from '@/lib/pageInfo';

/**
 * Resolves the guidance doc for a page/component key from the registry.
 *
 * Returns `null` when the key is not registered, so callers can decide whether
 * to render an InfoButton at all. Pure lookup — no side effects, no network.
 */
export function usePageInfo(contentKey: string): InfoDoc | null {
  return useMemo(() => resolveInfo(contentKey), [contentKey]);
}

export type { InfoDoc };

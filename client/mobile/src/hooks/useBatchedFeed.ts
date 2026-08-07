import { useState, useEffect, useCallback } from 'react';
import type { Product } from '@data/types';

// Batched loading for a finite pool: grows the visible slice in fixed batches.
// Pure and presentation-agnostic — the trigger strategy (button, scroll, etc.)
// lives in the consumer.
export function useBatchedFeed(pool: Product[], batchSize = 8) {
  const [visibleCount, setVisibleCount] = useState(batchSize);

  useEffect(() => {
    setVisibleCount(batchSize);
  }, [pool, batchSize]);

  const visibleItems = pool.slice(0, visibleCount);
  const hasMore = visibleCount < pool.length;
  const loadMore = useCallback(() => {
    setVisibleCount((c) => Math.min(c + batchSize, pool.length));
  }, [batchSize, pool.length]);

  return { visibleItems, hasMore, loadMore, total: pool.length, visibleCount };
}

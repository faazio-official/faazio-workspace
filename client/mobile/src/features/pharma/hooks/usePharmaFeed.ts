import { useEffect, useState } from 'react';
import { fetchPharmaFeed, type PharmaFeed } from '../services/pharmaService';

export function usePharmaFeed() {
  const [feed, setFeed] = useState<PharmaFeed | null>(null);

  useEffect(() => {
    let active = true;
    fetchPharmaFeed()
      .then((data) => {
        if (active) setFeed(data);
      })
      .catch(() => {
        if (active) setFeed(null);
      });
    return () => {
      active = false;
    };
  }, []);

  return feed;
}

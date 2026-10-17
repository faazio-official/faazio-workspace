import { useEffect, useState } from 'react';
import { fetchMartFeed, type MartFeed } from '../services/martService';

export function useMartFeed() {
  const [feed, setFeed] = useState<MartFeed | null>(null);

  useEffect(() => {
    let active = true;
    fetchMartFeed()
      .then((data) => {
        if (active) setFeed(data);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  return feed;
}

import { useEffect, useState } from 'react';
import { fetchDiningFeed, type DiningFeed } from '../services/diningService';

export function useDiningFeed() {
  const [feed, setFeed] = useState<DiningFeed | null>(null);

  useEffect(() => {
    let active = true;
    fetchDiningFeed().then((data) => {
      if (active) setFeed(data);
    });
    return () => {
      active = false;
    };
  }, []);

  return feed;
}

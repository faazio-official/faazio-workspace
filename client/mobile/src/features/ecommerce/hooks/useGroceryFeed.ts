import { useEffect, useState } from 'react';
import { fetchGroceryFeed, type GroceryFeed } from '../services/groceryService';

export function useGroceryFeed() {
  const [feed, setFeed] = useState<GroceryFeed | null>(null);

  useEffect(() => {
    let active = true;
    fetchGroceryFeed().then((data) => {
      if (active) setFeed(data);
    });
    return () => {
      active = false;
    };
  }, []);

  return feed;
}

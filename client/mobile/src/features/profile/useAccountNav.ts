import { useEffect, useMemo, useState } from 'react';
import type { AccountNavGroup } from '@data/types';
import { gateway } from '@/services/api/GatewayClient';

/**
 * Nav source for the "You" page. Server-authoritative (`GET /account-nav`): the gateway returns the
 * full committed group catalog (with empty rows for a fresh user), so no bundled @data group is ever
 * substituted. A failed/disabled read renders an empty list — the app's own catalog is never fixture
 * data on the client.
 */
export function useAccountNav(): AccountNavGroup[] {
  const [serverGroups, setServerGroups] = useState<AccountNavGroup[] | null>(null);

  useEffect(() => {
    let alive = true;
    gateway
      .getAccountNav()
      .then((groups) => {
        if (alive) setServerGroups(groups ?? []);
      })
      .catch(() => {
        if (alive) setServerGroups([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  return useMemo(() => serverGroups ?? [], [serverGroups]);
}
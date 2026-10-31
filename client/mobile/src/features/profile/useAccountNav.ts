import { useEffect, useMemo, useState } from 'react';
import { accountNavGroups } from '@data/index';
import type { AccountNavGroup } from '@data/types';
import { gateway } from '@/services/api/GatewayClient';

/**
 * Nav source for the "You" page. Row data is server-authoritative (`GET /account-nav`); the
 * committed universal group catalog fills in any group whose server rows are empty or absent (a
 * fresh user has no `accounts.nav` rows yet, and the group titles are universal UI, not user data).
 * Fixture rows are never rendered as live user data, and every rendered row has a real
 * destination in `AccountView.handleRowPress`.
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

  return useMemo(() => {
    if (!serverGroups) return accountNavGroups;
    const byKey = new Map(serverGroups.map((g) => [g.key, g]));
    return accountNavGroups.map((group) => {
      const server = byKey.get(group.key);
      if (!server || server.rows.length === 0) return group;
      return {
        ...server,
        title: server.title || group.title,
      };
    });
  }, [serverGroups]);
}
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AccountNavGroup } from '@data/types';
import { gateway } from '@/services/api/GatewayClient';

interface AccountNavState {
  groups: AccountNavGroup[];
  loading: boolean;
  error: boolean;
  retry: () => void;
}

/**
 * Nav source for the "You" page. Server-authoritative (`GET /account-nav`): the gateway merges the
 * DB-backed universal default rows (`accounts.nav_defaults`) with any per-user overrides and omits
 * groups without real destinations. No bundled @data group is ever substituted. A failed read
 * surfaces an error so the page can offer retry rather than silently rendering as if the account
 * had no rows.
 */
export function useAccountNav(): AccountNavState {
  const [serverGroups, setServerGroups] = useState<AccountNavGroup[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(false);
    gateway
      .getAccountNav()
      .then((groups) => {
        if (!alive) return;
        setServerGroups(groups ?? []);
      })
      .catch(() => {
        if (!alive) return;
        setServerGroups(null);
        setError(true);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  const groups = useMemo(() => serverGroups ?? [], [serverGroups]);
  return { groups, loading, error, retry };
}
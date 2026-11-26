import { create } from 'zustand';
import { gateway } from '@/services/api/GatewayClient';

/**
 * Shared unread badge for the customer in-app notification inbox. The server
 * (`GET /notifications/unread-count`) is the authority; this store only holds the
 * last count so a bell rendered on any screen shows the same number without each
 * mount downloading the whole list. Refresh is best-effort — offline keeps the
 * previous count rather than fabricating one.
 */
interface NotificationsState {
  unread: number;
  refreshUnread: () => Promise<void>;
  /** Zero the badge immediately after "mark all read" so the bell clears without a round-trip. */
  setUnread: (n: number) => void;
  reset: () => void;
}

export const useNotificationsStore = create<NotificationsState>((set) => ({
  unread: 0,
  refreshUnread: async () => {
    const count = await gateway.getUnreadNotificationCount();
    set({ unread: count });
  },
  setUnread: (n) => set({ unread: Math.max(0, n) }),
  reset: () => set({ unread: 0 }),
}));

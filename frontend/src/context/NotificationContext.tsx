import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import socket from '../services/socket';
import type { Shipment } from '../types';

// ─── Shape ────────────────────────────────────────────────────────────────────

interface NotificationContextValue {
  /** Count of new Preparation shipments arrived since the user last visited /preparation */
  unviewedPrepCount: number;
  /** True while at least one shipment has an unread carrier reply */
  hasDashboardUpdate: boolean;
  /** Reset unviewedPrepCount to 0 (call on entering /preparation) */
  clearPrepCount: () => void;
  /** Remove a single shipment ID from the unread set */
  markShipmentRead: (id: string) => void;
  /** Populate the unread set from the initial DB load */
  setInitialUnread: (ids: string[]) => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const NotificationContext = createContext<NotificationContextValue>({
  unviewedPrepCount: 0,
  hasDashboardUpdate: false,
  clearPrepCount: () => {},
  markShipmentRead: () => {},
  setInitialUnread: () => {},
});

// ─── Provider ─────────────────────────────────────────────────────────────────

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [unviewedPrepCount, setUnviewedPrepCount] = useState(0);
  const [unreadIds, setUnreadIds] = useState<Set<string>>(new Set());

  // Listen for real-time events — works regardless of which page is active
  useEffect(() => {
    function onCreated(shipment: Shipment) {
      if (shipment.status === 'Preparation') {
        setUnviewedPrepCount((c) => c + 1);
      }
    }

    function onUpdated(shipment: Shipment) {
      if (shipment.isUnread) {
        setUnreadIds((prev) => new Set([...prev, shipment._id]));
      }
    }

    socket.on('shipment:created', onCreated);
    socket.on('shipment:updated', onUpdated);
    return () => {
      socket.off('shipment:created', onCreated);
      socket.off('shipment:updated', onUpdated);
    };
  }, []);

  const clearPrepCount = useCallback(() => setUnviewedPrepCount(0), []);

  const markShipmentRead = useCallback((id: string) => {
    setUnreadIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  // Called by Dashboard after it fetches shipments so the navbar dot reflects
  // existing unread state even before any new socket event arrives.
  const setInitialUnread = useCallback((ids: string[]) => {
    setUnreadIds(new Set(ids));
  }, []);

  return (
    <NotificationContext.Provider
      value={{
        unviewedPrepCount,
        hasDashboardUpdate: unreadIds.size > 0,
        clearPrepCount,
        markShipmentRead,
        setInitialUnread,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useNotifications() {
  return useContext(NotificationContext);
}

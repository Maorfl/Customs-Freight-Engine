import { useState, useEffect, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { shipmentsApi } from '../services/api';
import type { Shipment } from '../types';
import StatusBadge from '../components/StatusBadge';
import ConfirmModal from '../components/ConfirmModal';
import type { ModalIcon, ModalType } from '../components/ConfirmModal';
import socket from '../services/socket';
import { useNotifications } from '../context/NotificationContext';

// ─── Filter tabs ──────────────────────────────────────────────────────────────

type FilterTab = 'all' | 'pending' | 'replied' | 'completed';

const TAB_LABELS: Record<FilterTab, string> = {
  all: 'הכל',
  pending: 'ממתין',
  replied: 'התקבל מענה',
  completed: 'הושלם',
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [recentlyUpdated, setRecentlyUpdated] = useState<Set<string>>(new Set());
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [loadingList, setLoadingList] = useState(true);
  const [resumingId, setResumingId] = useState<string | null>(null);

  const { markShipmentRead, setInitialUnread } = useNotifications();

  const [modal, setModal] = useState<{
    open: boolean;
    title: string;
    message: string;
    type: ModalType;
    icon: ModalIcon;
    confirmLabel: string;
    onConfirm: () => void;
  }>({
    open: false,
    title: '',
    message: '',
    type: 'danger',
    icon: 'alertTriangle',
    confirmLabel: 'אישור',
    onConfirm: () => {},
  });

  function closeModal() {
    setModal((m) => ({ ...m, open: false }));
  }

  const loadShipments = useCallback(async () => {
    try {
      const data = await shipmentsApi.getAll();
      const filtered = data.filter((s) => s.status !== 'Preparation');
      setShipments(filtered);
      // Seed the notification context with shipments that already have unread replies
      setInitialUnread(filtered.filter((s) => s.isUnread).map((s) => s._id));
    } catch {
      // silently ignore — list will stay empty
    } finally {
      setLoadingList(false);
    }
  }, [setInitialUnread]);

  useEffect(() => {
    loadShipments();
  }, [loadShipments]);

  // ── Real-time updates via Socket.io ──────────────────────────────────────────

  function flashId(id: string) {
    setRecentlyUpdated((prev) => new Set(prev).add(id));
    setTimeout(() => {
      setRecentlyUpdated((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 2000);
  }

  useEffect(() => {
    function onShipmentUpdated(updated: Shipment) {
      if (updated.status === 'Preparation') return;
      setShipments((prev) => {
        const idx = prev.findIndex((s) => s._id === updated._id);
        if (idx === -1) return prev;
        const next = [...prev];
        next[idx] = updated;
        return next;
      });
      flashId(updated._id);
      if (updated.status === 'Paused - Reply Received') {
        toast.success(`התקבלה הצעת מחיר חדשה לתיק ${updated.fileNumber}!`, { duration: 5000 });
      }
    }

    function onShipmentCreated(created: Shipment) {
      if (created.status === 'Preparation') return;
      setShipments((prev) => {
        if (prev.some((s) => s._id === created._id)) return prev;
        return [created, ...prev];
      });
      flashId(created._id);
    }

    socket.on('shipment:updated', onShipmentUpdated);
    socket.on('shipment:created', onShipmentCreated);
    return () => {
      socket.off('shipment:updated', onShipmentUpdated);
      socket.off('shipment:created', onShipmentCreated);
    };
  }, []);
  // ── Mark shipment as read ───────────────────────────────────────

  async function handleMarkAsRead(id: string) {
    try {
      const updated = await shipmentsApi.markAsRead(id);
      setShipments((prev) => prev.map((s) => (s._id === id ? updated : s)));
      markShipmentRead(id);
    } catch {
      // silently ignore — badge will self-correct on next load
    }
  }
  // ── Delete shipment ──────────────────────────────────────────────────────────

  function handleDelete(id: string, fileNumber: string) {
    setModal({
      open: true,
      title: 'מחיקת היסטוריה',
      message: `הפעולה תסיר את תיק ${fileNumber} לצמיתות. לא ניתן לבטל פעולה זו.`,
      type: 'danger',
      icon: 'fileX',
      confirmLabel: 'מחק לצמיתות',
      onConfirm: async () => {
        try {
          await shipmentsApi.delete(id);
          setShipments((prev) => prev.filter((s) => s._id !== id));
        } catch {
          // ignore
        }
      },
    });
  }

  // ── Resume escalation ────────────────────────────────────────────────────────

  async function handleResume(id: string) {
    setResumingId(id);
    try {
      const result = await shipmentsApi.resume(id);
      setShipments((prev) => prev.map((s) => (s._id === id ? result.shipment : s)));
      toast.success(
        <div className="flex flex-col text-right">
          <span className="font-bold text-gray-900">אימייל נשלח למוביל {result.carrierName}</span>
          <span className="text-sm text-gray-600 mt-1">ניתן לעקוב אחרי עדכונים עבור בקשת הצעת המחיר בעמוד לוח בקרה</span>
        </div>,
        { duration: 5000 }
      );
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? 'שגיאה בחידוש האשכול';
      toast.error(msg);
    } finally {
      setResumingId(null);
    }
  }

  // ── Derived: filtered list ────────────────────────────────────────────────

  const visibleShipments = shipments.filter((s) => {
    if (activeTab === 'pending') return s.status === 'Pending' || s.status === 'Processing';
    if (activeTab === 'replied') return s.status === 'Paused - Reply Received';
    if (activeTab === 'completed') return s.status === 'Completed';
    return true;
  });

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-gray-900">לוח בקרה — מעקב בזמן אמת</h1>

      {/* ── Shipments List ────────────────────────────────────────────────────── */}
      <section className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="px-6 py-3 border-b border-gray-200 flex items-center justify-between gap-4 flex-wrap">
          {/* Status filter tabs */}
          <div className="flex gap-1">
            {(Object.keys(TAB_LABELS) as FilterTab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === tab
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                {TAB_LABELS[tab]}
              </button>
            ))}
          </div>
          <button
            onClick={loadShipments}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            רענן
          </button>
        </div>

        {loadingList ? (
          <div className="p-10 text-center text-gray-400">טוען...</div>
        ) : visibleShipments.length === 0 ? (
          <div className="p-10 text-center text-gray-400">
            {shipments.length === 0 ? 'אין משלוחים עדיין' : 'אין תוצאות לסינון זה'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {[
                    'מספר תיק',
                    'נקודת שחרור',
                    'סוג',
                    'יעד',
                    'סטטוס',
                    'מובילים',
                    'מוביל נוכחי',
                    'תאריך',
                    '',
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {visibleShipments.map((s) => (
                  <tr
                    key={s._id}
                    onClick={() => s.isUnread && handleMarkAsRead(s._id)}
                    className={`transition-colors duration-700 ${
                      s.isUnread
                        ? 'bg-blue-50 cursor-pointer hover:bg-blue-100'
                        : recentlyUpdated.has(s._id)
                        ? 'bg-yellow-50'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <td className="px-4 py-3 font-semibold text-gray-900">
                      {s.fileNumber}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {s.releasePoint}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${
                          s.shipmentType === 'FCL'
                            ? 'bg-indigo-50 text-indigo-700'
                            : 'bg-orange-50 text-orange-700'
                        }`}
                      >
                        {s.shipmentType}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{s.destination}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={s.status} repliedBy={s.repliedBy} />
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {s.currentCarrierIndex + 1} / {s.carriersQueue.length}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {s.carriersQueue[s.currentCarrierIndex]?.name ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {new Date(s.createdAt).toLocaleDateString('he-IL')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1.5 items-start">
                        {s.status === 'Paused - Reply Received' && (
                          <button
                            onClick={(e) => { e.stopPropagation(); void handleResume(s._id); }}
                            disabled={resumingId === s._id}
                            className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs rounded font-medium whitespace-nowrap"
                          >
                            {resumingId === s._id && <Loader2 size={12} className="animate-spin" />}
                            {resumingId === s._id ? 'שולח...' : 'המשך שליחה למובילים הבאים'}
                          </button>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(s._id, s.fileNumber); }}
                          className="text-red-500 hover:text-red-700 text-xs"
                        >
                          מחק
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ConfirmModal
        isOpen={modal.open}
        onClose={closeModal}
        onConfirm={modal.onConfirm}
        title={modal.title}
        message={modal.message}
        type={modal.type}
        icon={modal.icon}
        confirmLabel={modal.confirmLabel}
      />
    </div>
  );
}

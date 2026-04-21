import { useState, useEffect, useCallback, useRef } from 'react';
import { shipmentsApi } from '../services/api';
import type { Shipment } from '../types';
import socket from '../services/socket';

const PORT_NAMES: Record<string, string> = {
  ILHFA: 'נמל חיפה',
  ILHBT: 'נמל המפרץ חיפה',
  ILOVR: 'מסוף אוברסיז חיפה',
  ILHDC: 'מסוף מדלוג חיפה',
  ILASH: 'נמל אשדוד',
  ILAST: 'נמל אשדוד דרום',
  ILOVO: 'מסוף אוברסיז אשדוד',
  ILMTS: 'מסוף 207 אשדוד',
  ILCXQ: 'מסוף גולד בונד אשדוד',
  ILBXQ: 'מסוף בונדד אשדוד',
};

function shipmentTypeLabel(s: Shipment): string {
  if (s.shipmentType === 'FCL') {
    return s.containerSize ? `FCL ${s.containerSize}'` : 'FCL';
  }
  return 'LCL';
}

export default function PreparationTable() {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [dispatchingId, setDispatchingId] = useState<string | null>(null);
  const [errorMap, setErrorMap] = useState<Record<string, string>>({});
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const loadShipments = useCallback(async () => {
    try {
      const data = await shipmentsApi.getAll('Preparation');
      setShipments(data);
    } catch {
      // silently ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadShipments();
  }, [loadShipments]);

  // Poll every 10 seconds as a safety net in case a Socket.io event is missed
  useEffect(() => {
    const interval = setInterval(loadShipments, 10_000);
    return () => clearInterval(interval);
  }, [loadShipments]);

  // Real-time: new Preparation shipments arrive via Socket.io
  useEffect(() => {
    function onCreated(shipment: Shipment) {
      if (shipment.status === 'Preparation') {
        setShipments((prev) => [shipment, ...prev]);
      }
    }

    function onUpdated(updated: Shipment) {
      setShipments((prev) => {
        if (updated.status !== 'Preparation') {
          // Shipment was dispatched — remove from this table
          return prev.filter((s) => s._id !== updated._id);
        }
        const idx = prev.findIndex((s) => s._id === updated._id);
        if (idx === -1) return prev;
        const next = [...prev];
        next[idx] = updated;
        return next;
      });
    }

    socket.on('shipment:created', onCreated);
    socket.on('shipment:updated', onUpdated);
    return () => {
      socket.off('shipment:created', onCreated);
      socket.off('shipment:updated', onUpdated);
    };
  }, []);

  async function handlePackingListUpload(id: string, file: File) {
    setUploadingId(id);
    setErrorMap((m) => ({ ...m, [id]: '' }));
    try {
      const updated = await shipmentsApi.uploadPackingList(id, file);
      setShipments((prev) => prev.map((s) => (s._id === id ? updated : s)));
      // Clear the file input
      const ref = fileInputRefs.current[id];
      if (ref) ref.value = '';
    } catch {
      setErrorMap((m) => ({ ...m, [id]: 'שגיאה בהעלאת הקובץ' }));
    } finally {
      setUploadingId(null);
    }
  }

  async function handleDispatch(id: string) {
    setDispatchingId(id);
    setErrorMap((m) => ({ ...m, [id]: '' }));
    try {
      await shipmentsApi.dispatch(id);
      // Remove from list after successful dispatch
      setShipments((prev) => prev.filter((s) => s._id !== id));
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? 'שגיאה בשליחה';
      setErrorMap((m) => ({ ...m, [id]: msg }));
    } finally {
      setDispatchingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">
          הכנה למשלוח
        </h1>
        <button
          onClick={loadShipments}
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          רענן
        </button>
      </div>

      <section className="bg-white rounded-xl shadow-sm border border-gray-200">
        {loading ? (
          <div className="p-10 text-center text-gray-400">טוען...</div>
        ) : shipments.length === 0 ? (
          <div className="p-10 text-center text-gray-400">
            אין משלוחים בהכנה כרגע
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {[
                    'מספר תיק',
                    'נקודת שחרור',
                    'סוג משלוח',
                    'סחורה מסוכנת?',
                    'מס׳ אריזות / מכולות',
                    'משקל (ק״ג)',
                    'נפח (CBM)',
                    'יעד',
                    'פעולות',
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {shipments.map((s) => (
                  <tr key={s._id} className="hover:bg-gray-50">
                    {/* File Number */}
                    <td className="px-4 py-3 font-semibold text-gray-900 whitespace-nowrap">
                      {s.fileNumber}
                    </td>

                    {/* Release Point */}
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      {PORT_NAMES[s.releasePoint] ?? s.releasePoint}
                    </td>

                    {/* Shipment Type */}
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap ${
                          s.shipmentType === 'FCL'
                            ? 'bg-indigo-50 text-indigo-700'
                            : 'bg-orange-50 text-orange-700'
                        }`}
                      >
                        {shipmentTypeLabel(s)}
                      </span>
                    </td>

                    {/* Dangerous */}
                    <td className="px-4 py-3">
                      {s.isDangerous ? (
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-50 text-red-700">
                          ⚠ כן
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">לא</span>
                      )}
                    </td>

                    {/* Quantity */}
                    <td className="px-4 py-3 text-gray-700 text-center">
                      {s.quantity}
                    </td>

                    {/* Weight */}
                    <td className="px-4 py-3 text-gray-700 text-center">
                      {s.weight.toLocaleString('he-IL')}
                    </td>

                    {/* Volume */}
                    <td className="px-4 py-3 text-gray-700 text-center">
                      {s.shipmentType === 'LCL' && s.volume != null
                        ? s.volume
                        : '—'}
                    </td>

                    {/* Destination */}
                    <td className="px-4 py-3 text-gray-700">{s.destination}</td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-2 min-w-[200px]">
                        {/* Packing List Upload */}
                        <div className="flex items-center gap-2">
                          <label className="flex-1">
                            <input
                              type="file"
                              accept=".pdf,.doc,.docx,.xls,.xlsx"
                              ref={(el) => {
                                fileInputRefs.current[s._id] = el;
                              }}
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handlePackingListUpload(s._id, file);
                              }}
                              disabled={uploadingId === s._id}
                              className="w-full text-xs text-gray-600
                                file:ml-2 file:py-1 file:px-3
                                file:rounded file:border-0
                                file:text-xs file:font-medium
                                file:bg-gray-100 file:text-gray-700
                                hover:file:bg-gray-200 cursor-pointer
                                border border-gray-200 rounded-md"
                            />
                          </label>
                          {uploadingId === s._id && (
                            <span className="text-xs text-gray-400 whitespace-nowrap">
                              מעלה...
                            </span>
                          )}
                          {s.packingListUrl && uploadingId !== s._id && (
                            <a
                              href={`/${s.packingListUrl}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-blue-600 hover:underline whitespace-nowrap"
                            >
                              צפה בקובץ ✓
                            </a>
                          )}
                        </div>

                        {/* Dispatch Button */}
                        <button
                          onClick={() => handleDispatch(s._id)}
                          disabled={dispatchingId === s._id}
                          className="w-full px-4 py-1.5 bg-blue-700 hover:bg-blue-800
                            disabled:opacity-50 disabled:cursor-not-allowed
                            text-white text-sm font-semibold rounded-lg
                            shadow-sm transition-colors"
                        >
                          {dispatchingId === s._id ? 'שולח...' : 'שלח ▶'}
                        </button>

                        {/* Inline error */}
                        {errorMap[s._id] && (
                          <p className="text-xs text-red-500">{errorMap[s._id]}</p>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

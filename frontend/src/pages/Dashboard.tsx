import { useState, useEffect, useCallback } from 'react';
import { shipmentsApi } from '../services/api';
import type { Shipment } from '../types';
import StatusBadge from '../components/StatusBadge';
import ConfirmModal from '../components/ConfirmModal';
import type { ModalIcon, ModalType } from '../components/ConfirmModal';
import socket from '../services/socket';

// ─── Port data ────────────────────────────────────────────────────────────────

const HAIFA_PORTS = [
  { code: 'ILHFA', label: 'נמל חיפה (ILHFA)' },
  { code: 'ILHBT', label: 'נמל המפרץ חיפה (ILHBT)' },
  { code: 'ILOVR', label: 'מסוף אוברסיז חיפה (ILOVR)' },
  { code: 'ILHDC', label: 'מסוף מדלוג חיפה (ILHDC)' },
];

const ASHDOD_PORTS = [
  { code: 'ILASH', label: 'נמל אשדוד (ILASH)' },
  { code: 'ILAST', label: 'נמל אשדוד דרום (ILAST)' },
  { code: 'ILOVO', label: 'מסוף אוברסיז אשדוד (ILOVO)' },
  { code: 'ILMTS', label: 'מסוף 207 אשדוד (ILMTS)' },
  { code: 'ILCXQ', label: 'מסוף גולד בונד אשדוד (ILCXQ)' },
  { code: 'ILBXQ', label: 'מסוף בונדד אשדוד (ILBXQ)' },
];

// ─── Form state ───────────────────────────────────────────────────────────────

interface FormState {
  fileNumber: string;
  releasePoint: string;
  isDangerous: boolean;
  shipmentType: 'FCL' | 'LCL';
  containerSize: '20' | '40' | '';
  quantity: string;
  weight: string;
  volume: string;
  destination: string;
  specialNotes: string;
  packingList: File | null;
}

const EMPTY_FORM: FormState = {
  fileNumber: '',
  releasePoint: '',
  isDangerous: false,
  shipmentType: 'FCL',
  containerSize: '',
  quantity: '',
  weight: '',
  volume: '',
  destination: '',
  specialNotes: '',
  packingList: null,
};

type FormErrors = Partial<Record<keyof FormState, string>>;

// ─── Component ────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loadingList, setLoadingList] = useState(true);

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
      setShipments(data);
    } catch {
      // silently ignore — list will stay empty
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    loadShipments();
  }, [loadShipments]);

  // ── Real-time updates via Socket.io ──────────────────────────────────────────

  useEffect(() => {
    function onShipmentUpdated(updated: Shipment) {
      setShipments((prev) => {
        const idx = prev.findIndex((s) => s._id === updated._id);
        if (idx === -1) return prev;
        const next = [...prev];
        next[idx] = updated;
        return next;
      });
    }

    socket.on('shipment:updated', onShipmentUpdated);
    return () => {
      socket.off('shipment:updated', onShipmentUpdated);
    };
  }, []);

  // ── Validation ──────────────────────────────────────────────────────────────

  function validate(): boolean {
    const e: FormErrors = {};

    if (!/^6\d{6}$/.test(form.fileNumber)) {
      e.fileNumber = 'מספר תיק חייב להיות בן 7 ספרות ולהתחיל ב-6';
    }
    if (!form.releasePoint) {
      e.releasePoint = 'נא לבחור נקודת שחרור';
    }
    if (!form.quantity || Number(form.quantity) < 1) {
      e.quantity = 'נא להזין כמות תקינה';
    }
    if (!form.weight || Number(form.weight) <= 0) {
      e.weight = 'נא להזין משקל תקין';
    }
    if (form.shipmentType === 'FCL' && !form.containerSize) {
      e.containerSize = 'נא לבחור גודל מכולה עבור FCL';
    }
    if (
      form.shipmentType === 'LCL' &&
      (!form.volume || Number(form.volume) <= 0)
    ) {
      e.volume = 'נא להזין נפח עבור משלוח LCL';
    }
    if (!form.destination.trim()) {
      e.destination = 'נא להזין יעד';
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  }

  // ── Submit ──────────────────────────────────────────────────────────────────

  async function doSubmit() {
    setSubmitting(true);
    try {
      const data = new FormData();
      data.append('fileNumber', form.fileNumber);
      data.append('releasePoint', form.releasePoint);
      data.append('isDangerous', String(form.isDangerous));
      data.append('shipmentType', form.shipmentType);
      if (form.shipmentType === 'FCL' && form.containerSize) {
        data.append('containerSize', form.containerSize);
      }
      data.append('quantity', form.quantity);
      data.append('weight', form.weight);
      if (form.shipmentType === 'LCL' && form.volume) {
        data.append('volume', form.volume);
      }
      data.append('destination', form.destination);
      if (form.specialNotes.trim()) {
        data.append('specialNotes', form.specialNotes);
      }
      if (form.packingList) {
        data.append('packingList', form.packingList);
      }

      await shipmentsApi.create(data);
      setSuccessMsg(
        'המשלוח נוצר בהצלחה! הצעת המחיר נשלחה למוביל הראשון ✓'
      );
      setForm(EMPTY_FORM);
      loadShipments();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? 'שגיאה ביצירת המשלוח';
      setErrorMsg(msg);
    } finally {
      setSubmitting(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSuccessMsg('');
    setErrorMsg('');
    if (!validate()) return;
    setModal({
      open: true,
      title: 'אישור שליחת בקשה להצעת מחיר',
      message: `האם אתה בטוח שברצונך להתחיל את תהליך שליחת המיילים עבור תיק ${form.fileNumber}?`,
      type: 'info',
      icon: 'send',
      confirmLabel: 'שלח עכשיו',
      onConfirm: doSubmit,
    });
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
    try {
      const updated = await shipmentsApi.resume(id);
      setShipments((prev) => prev.map((s) => (s._id === id ? updated : s)));
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? 'שגיאה בחידוש האשכול';
      alert(msg);
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  function field(name: keyof FormState) {
    return {
      className: `w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white ${
        errors[name] ? 'border-red-400' : 'border-gray-300'
      }`,
    };
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">לוח בקרה — יצירת הודעת משלוח</h1>

      {/* ── Add Shipment Form ─────────────────────────────────────────────────── */}
      <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-6">פרטי המשלוח</h2>

        {successMsg && (
          <div className="mb-5 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
            {successMsg}
          </div>
        )}
        {errorMsg && (
          <div className="mb-5 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="space-y-6">
          {/* Row 1 — File Number + Release Point */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                מספר תיק <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="6XXXXXX"
                maxLength={7}
                value={form.fileNumber}
                onChange={(e) =>
                  setForm((p) => ({ ...p, fileNumber: e.target.value }))
                }
                {...field('fileNumber')}
              />
              {errors.fileNumber && (
                <p className="mt-1 text-xs text-red-500">{errors.fileNumber}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                נקודת שחרור <span className="text-red-500">*</span>
              </label>
              <select
                value={form.releasePoint}
                onChange={(e) =>
                  setForm((p) => ({ ...p, releasePoint: e.target.value }))
                }
                {...field('releasePoint')}
              >
                <option value="">— בחר נקודת שחרור —</option>
                <optgroup label="נמלי חיפה">
                  {HAIFA_PORTS.map((p) => (
                    <option key={p.code} value={p.code}>
                      {p.label}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="נמלי אשדוד">
                  {ASHDOD_PORTS.map((p) => (
                    <option key={p.code} value={p.code}>
                      {p.label}
                    </option>
                  ))}
                </optgroup>
              </select>
              {errors.releasePoint && (
                <p className="mt-1 text-xs text-red-500">
                  {errors.releasePoint}
                </p>
              )}
            </div>
          </div>

          {/* Row 2 — Shipment Type + Dangerous Flag */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <p className="block text-sm font-medium text-gray-700 mb-2">
                סוג משלוח
              </p>
              <div className="flex gap-6">
                {(['FCL', 'LCL'] as const).map((t) => (
                  <label key={t} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      value={t}
                      checked={form.shipmentType === t}
                      onChange={() =>
                        setForm((p) => ({ ...p, shipmentType: t, volume: '', containerSize: '' }))
                      }
                      className="accent-blue-600 w-4 h-4"
                    />
                    <span className="text-sm text-gray-700">
                      {t === 'FCL' ? 'FCL — מכולה מלאה' : 'LCL — משלוח חלקי'}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex items-center">
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={form.isDangerous}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, isDangerous: e.target.checked }))
                  }
                  className="w-5 h-5 accent-red-600 rounded"
                />
                <span className="text-sm font-medium text-gray-700">
                  <span className="text-red-600">⚠ </span>סחורה מסוכנת
                </span>
              </label>
            </div>
          </div>

          {/* Container Size — only for FCL */}
          {form.shipmentType === 'FCL' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <p className="block text-sm font-medium text-gray-700 mb-2">
                  גודל מכולה <span className="text-red-500">*</span>
                </p>
                <div className="flex gap-6">
                  {(['20', '40'] as const).map((size) => (
                    <label key={size} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        value={size}
                        checked={form.containerSize === size}
                        onChange={() =>
                          setForm((p) => ({ ...p, containerSize: size }))
                        }
                        className="accent-blue-600 w-4 h-4"
                      />
                      <span className="text-sm text-gray-700">{size}&#x2032;</span>
                    </label>
                  ))}
                </div>
                {errors.containerSize && (
                  <p className="mt-1 text-xs text-red-500">{errors.containerSize}</p>
                )}
              </div>
            </div>
          )}

          {/* Row 3 — Quantity / Weight / Volume */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {form.shipmentType === 'FCL' ? 'מספר מכולות' : 'מספר חבילות'}{' '}
                <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                value={form.quantity}
                onChange={(e) =>
                  setForm((p) => ({ ...p, quantity: e.target.value }))
                }
                {...field('quantity')}
              />
              {errors.quantity && (
                <p className="mt-1 text-xs text-red-500">{errors.quantity}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                משקל (ק&quot;ג) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="0.1"
                step="0.1"
                value={form.weight}
                onChange={(e) =>
                  setForm((p) => ({ ...p, weight: e.target.value }))
                }
                {...field('weight')}
              />
              {errors.weight && (
                <p className="mt-1 text-xs text-red-500">{errors.weight}</p>
              )}
            </div>

            {form.shipmentType === 'LCL' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  נפח (CBM) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.volume}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, volume: e.target.value }))
                  }
                  {...field('volume')}
                />
                {errors.volume && (
                  <p className="mt-1 text-xs text-red-500">{errors.volume}</p>
                )}
              </div>
            )}
          </div>

          {/* Row 4 — Destination */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              יעד <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder="לדוגמא: תל אביב"
              value={form.destination}
              onChange={(e) =>
                setForm((p) => ({ ...p, destination: e.target.value }))
              }
              {...field('destination')}
            />
            {errors.destination && (
              <p className="mt-1 text-xs text-red-500">{errors.destination}</p>
            )}
          </div>

          {/* Row 5 — Special Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              הערות מיוחדות
            </label>
            <textarea
              rows={3}
              placeholder="הערות נוספות שיכללו בגוף האימייל..."
              value={form.specialNotes}
              onChange={(e) =>
                setForm((p) => ({ ...p, specialNotes: e.target.value }))
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* Row 6 — Packing List Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              רשימת תכולה (PDF / Word / Excel)
            </label>
            <input
              type="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx"
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  packingList: e.target.files?.[0] ?? null,
                }))
              }
              className="w-full text-sm text-gray-600 file:ml-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer border border-gray-300 rounded-lg"
            />
            {form.packingList && (
              <p className="mt-1 text-xs text-green-600">
                קובץ נבחר: {form.packingList.name}
              </p>
            )}
          </div>

          {/* Submit */}
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="px-8 py-3 bg-blue-700 text-white rounded-lg hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed font-semibold shadow-sm"
            >
              {submitting ? 'שולח...' : 'שלח בקשה להצעת מחיר'}
            </button>
          </div>
        </form>
      </section>

      {/* ── Shipments List ────────────────────────────────────────────────────── */}
      <section className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800">
            משלוחים אחרונים
          </h2>
          <button
            onClick={loadShipments}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            רענן
          </button>
        </div>

        {loadingList ? (
          <div className="p-10 text-center text-gray-400">טוען...</div>
        ) : shipments.length === 0 ? (
          <div className="p-10 text-center text-gray-400">
            אין משלוחים עדיין
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
                {shipments.map((s) => (
                  <tr key={s._id} className="hover:bg-gray-50">
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
                            onClick={() => handleResume(s._id)}
                            className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white text-xs rounded font-medium whitespace-nowrap"
                          >
                            המשך שליחה למובילים הבאים
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(s._id, s.fileNumber)}
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

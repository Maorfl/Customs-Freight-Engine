import { useState, useCallback } from 'react';
import { shipmentsApi } from '../services/api';
import ConfirmModal from '../components/ConfirmModal';
import type { ModalIcon, ModalType } from '../components/ConfirmModal';

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

export default function NewShipment() {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

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
    type: 'info',
    icon: 'send',
    confirmLabel: 'אישור',
    onConfirm: () => {},
  });

  function closeModal() {
    setModal((m) => ({ ...m, open: false }));
  }

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
    if (form.shipmentType === 'LCL' && (!form.volume || Number(form.volume) <= 0)) {
      e.volume = 'נא להזין נפח עבור משלוח LCL';
    }
    if (!form.destination.trim()) {
      e.destination = 'נא להזין יעד';
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  }

  // ── Submit ──────────────────────────────────────────────────────────────────

  const doSubmit = useCallback(async () => {
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
      setSuccessMsg('המשלוח נוצר בהצלחה! הצעת המחיר נשלחה למוביל הראשון ✓');
      setForm(EMPTY_FORM);
      setErrors({});
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? 'שגיאה ביצירת המשלוח';
      setErrorMsg(msg);
    } finally {
      setSubmitting(false);
    }
  }, [form]);

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
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">יצירת משלוח חדש</h1>

      <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-5">פרטי המשלוח</h2>

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
                onChange={(e) => setForm((p) => ({ ...p, fileNumber: e.target.value }))}
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
                onChange={(e) => setForm((p) => ({ ...p, releasePoint: e.target.value }))}
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
                <p className="mt-1 text-xs text-red-500">{errors.releasePoint}</p>
              )}
            </div>
          </div>

          {/* Row 2 — Shipment Type + Dangerous Flag */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <p className="block text-sm font-medium text-gray-700 mb-2">סוג משלוח</p>
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
                  onChange={(e) => setForm((p) => ({ ...p, isDangerous: e.target.checked }))}
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
                        onChange={() => setForm((p) => ({ ...p, containerSize: size }))}
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {form.shipmentType === 'FCL' ? 'מספר מכולות' : 'מספר חבילות'}{' '}
                <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                value={form.quantity}
                onChange={(e) => setForm((p) => ({ ...p, quantity: e.target.value }))}
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
                onChange={(e) => setForm((p) => ({ ...p, weight: e.target.value }))}
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
                  onChange={(e) => setForm((p) => ({ ...p, volume: e.target.value }))}
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
              onChange={(e) => setForm((p) => ({ ...p, destination: e.target.value }))}
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
              onChange={(e) => setForm((p) => ({ ...p, specialNotes: e.target.value }))}
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
                setForm((p) => ({ ...p, packingList: e.target.files?.[0] ?? null }))
              }
              className="w-full text-sm text-gray-600 file:ml-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer border border-gray-300 rounded-lg"
            />
            {form.packingList && (
              <p className="mt-1 text-xs text-green-600">קובץ נבחר: {form.packingList.name}</p>
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

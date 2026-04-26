import { useState, useEffect, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Users, Edit3, Trash2, ExternalLink, FileText, Search, Plus, X, Upload } from "lucide-react";
import { carriersApi } from "../services/api";
import type { Carrier, CarrierFormData } from "../types";
import ConfirmModal from "../components/ConfirmModal";
import type { ModalIcon, ModalType } from "../components/ConfirmModal";

// --- Form state ---

const EMPTY_FORM: CarrierFormData = {
    name: "",
    hpNumber: "",
    email: "",
    location: "Both",
    type: "Both",
};

type FormErrors = Partial<Record<keyof CarrierFormData, string>>;

// --- Component ---

export default function CarrierManagement() {
    const [carriers, setCarriers] = useState<Carrier[]>([]);
    const [loading, setLoading] = useState(true);
    const [query, setQuery] = useState("");

    const [showModal, setShowModal] = useState(false);
    const [editing, setEditing] = useState<Carrier | null>(null);
    const [form, setForm] = useState<CarrierFormData>(EMPTY_FORM);
    const [formErrors, setFormErrors] = useState<FormErrors>({});
    const [saving, setSaving] = useState(false);

    const [uploadingId, setUploadingId] = useState<string | null>(null);
    const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

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
        title: "",
        message: "",
        type: "danger",
        icon: "alertTriangle",
        confirmLabel: "אישור",
        onConfirm: () => {},
    });

    function closeModal() {
        setModal((m) => ({ ...m, open: false }));
    }

    const loadCarriers = useCallback(async () => {
        try {
            const data = await carriersApi.getAll();
            setCarriers(data);
        } catch {
            showToast("שגיאה בטעינת המובילים", false);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadCarriers();
    }, [loadCarriers]);

    const filtered =
        query.trim() ?
            carriers.filter(
                (c) =>
                    c.name.toLowerCase().includes(query.toLowerCase()) ||
                    c.hpNumber.toLowerCase().includes(query.toLowerCase()) ||
                    c.email.toLowerCase().includes(query.toLowerCase())
            )
        :   carriers;

    function showToast(msg: string, ok: boolean) {
        setToast({ msg, ok });
        setTimeout(() => setToast(null), 4000);
    }

    function openAdd() {
        setEditing(null);
        setForm(EMPTY_FORM);
        setFormErrors({});
        setShowModal(true);
    }

    function openEdit(carrier: Carrier) {
        setEditing(carrier);
        setForm({
            name: carrier.name,
            hpNumber: carrier.hpNumber,
            email: carrier.email,
            location: carrier.location,
            type: carrier.type,
        });
        setFormErrors({});
        setShowModal(true);
    }

    function validate(): boolean {
        const e: FormErrors = {};
        if (!form.name.trim()) e.name = "שם חובה";
        if (!form.hpNumber.trim()) e.hpNumber = "מספר ח.פ. חובה";
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
            e.email = "כתובת אימייל לא תקינה";
        }
        setFormErrors(e);
        return Object.keys(e).length === 0;
    }

    async function handleSave() {
        if (!validate()) return;
        setSaving(true);
        try {
            if (editing) {
                const updated = await carriersApi.update(editing._id, form);
                setCarriers((prev) => prev.map((c) => (c._id === updated._id ? updated : c)));
                showToast("הספק עודכן בהצלחה", true);
            } else {
                const created = await carriersApi.create(form);
                setCarriers((prev) => [...prev, created]);
                showToast("הספק נוסף בהצלחה", true);
            }
            setShowModal(false);
        } catch (err: unknown) {
            const msg =
                (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "שגיאה בשמירת הספק";
            showToast(msg, false);
        } finally {
            setSaving(false);
        }
    }

    function handleDelete(id: string, name: string) {
        setModal({
            open: true,
            title: "מחיקת מוביל",
            message: `האם אתה בטוח? פעולה זו תסיר את ${name} מהמערכת לצמיתות.`,
            type: "danger",
            icon: "alertTriangle",
            confirmLabel: "הן, מחק",
            onConfirm: async () => {
                try {
                    await carriersApi.delete(id);
                    setCarriers((prev) => prev.filter((c) => c._id !== id));
                    showToast("הספק נמחק", true);
                } catch {
                    showToast("שגיאה במחיקת הספק", false);
                }
            },
        });
    }

    async function handlePriceList(carrierId: string, file: File) {
        setUploadingId(carrierId);
        try {
            const result = await carriersApi.uploadPriceList(carrierId, file);
            setCarriers((prev) => prev.map((c) => (c._id === carrierId ? result.carrier : c)));
            showToast("רשימת המחירים הועלתה בהצלחה", true);
        } catch {
            showToast("שגיאה בהעלאת הקובץ", false);
        } finally {
            setUploadingId(null);
        }
    }

    const locLabel: Record<string, string> = {
        Haifa: "חיפה",
        Ashdod: "אשדוד",
        Both: "חיפה + אשדוד",
    };
    const typeLabel: Record<string, string> = {
        FCL: "FCL",
        LCL: "LCL",
        Both: "FCL + LCL",
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-100">
                        <Users className="w-5 h-5 text-blue-700" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">ניהול מובילים</h1>
                        <p className="text-sm text-gray-500 mt-0.5">{carriers.length} מובילים רשומים</p>
                    </div>
                </div>
                <button
                    onClick={openAdd}
                    className="flex items-center gap-2 px-5 py-2.5 bg-blue-700 text-white rounded-xl hover:bg-blue-800 font-semibold shadow-sm transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    הוסף מוביל
                </button>
            </div>

            {/* Toast */}
            <AnimatePresence>
                {toast && (
                    <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        className={`p-4 rounded-xl text-sm flex items-center justify-between border ${
                            toast.ok ?
                                "bg-green-50 border-green-200 text-green-700"
                            :   "bg-red-50 border-red-200 text-red-700"
                        }`}
                    >
                        <span>{toast.msg}</span>
                        <button onClick={() => setToast(null)} className="opacity-60 hover:opacity-100 ml-4">
                            <X className="w-4 h-4" />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Search bar */}
            {carriers.length > 0 && (
                <div className="relative">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    <input
                        type="text"
                        placeholder="חיפוש לפי שם, ח.פ. או אימייל..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        className="w-full pr-9 pl-4 py-2.5 border border-gray-300 rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    {query && (
                        <button
                            onClick={() => setQuery("")}
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>
            )}

            {/* Table / States */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                {loading ?
                    <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-3">
                        <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
                        <span className="text-sm">טוען מובילים...</span>
                    </div>
                : carriers.length === 0 ?
                    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
                        <div className="flex items-center justify-center w-20 h-20 rounded-full bg-blue-50 mb-5">
                            <Users className="w-10 h-10 text-blue-300" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-800 mb-1">אין מובילים רשומים עדיין</h3>
                        <p className="text-sm text-gray-500 max-w-xs mb-6">
                            הוסף את המוביל הראשון שלך כדי להתחיל לשלוח בקשות להצעות מחיר אוטומטית.
                        </p>
                        <button
                            onClick={openAdd}
                            className="flex items-center gap-2 px-6 py-2.5 bg-blue-700 text-white rounded-xl hover:bg-blue-800 font-semibold shadow-sm transition-colors"
                        >
                            <Plus className="w-4 h-4" />
                            הוסף מוביל ראשון
                        </button>
                    </div>
                : filtered.length === 0 ?
                    <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                        <Search className="w-10 h-10 text-gray-300 mb-3" />
                        <p className="text-sm text-gray-500">לא נמצאו מובילים עבור &quot;{query}&quot;</p>
                        <button onClick={() => setQuery("")} className="mt-3 text-sm text-blue-600 hover:underline">
                            נקה חיפוש
                        </button>
                    </div>
                :   <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                    {["שם המוביל", "ח.פ.", "אימייל", "מיקום", "סוג", "רשימת מחירים", "פעולות"].map(
                                        (h) => (
                                            <th
                                                key={h}
                                                className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide"
                                            >
                                                {h}
                                            </th>
                                        )
                                    )}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filtered.map((c) => (
                                    <tr key={c._id} className="hover:bg-blue-50/40 transition-colors">
                                        <td className="px-4 py-3 font-semibold text-gray-900">{c.name}</td>
                                        <td className="px-4 py-3 text-gray-500 font-mono text-xs">{c.hpNumber}</td>
                                        <td className="px-4 py-3 text-gray-600 text-xs" dir="ltr">
                                            {c.email}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded text-xs font-medium">
                                                {locLabel[c.location]}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs font-medium">
                                                {typeLabel[c.type]}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                {c.priceListUrl ?
                                                    <a
                                                        href={`/${c.priceListUrl}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="flex items-center gap-1.5 text-blue-600 hover:text-blue-800 text-xs font-medium"
                                                    >
                                                        <FileText className="w-3.5 h-3.5" />
                                                        צפה בקובץ
                                                        <ExternalLink className="w-3 h-3 opacity-70" />
                                                    </a>
                                                :   <span className="text-gray-400 text-xs">אין קובץ</span>}
                                                <label className="cursor-pointer">
                                                    <span className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200 border border-gray-200 transition-colors">
                                                        <Upload className="w-3 h-3" />
                                                        {uploadingId === c._id ? "מעלה..." : "העלה"}
                                                    </span>
                                                    <input
                                                        type="file"
                                                        accept=".pdf,.doc,.docx,.xls,.xlsx"
                                                        className="hidden"
                                                        disabled={uploadingId === c._id}
                                                        onChange={(e) => {
                                                            const file = e.target.files?.[0];
                                                            if (file) {
                                                                handlePriceList(c._id, file);
                                                                e.target.value = "";
                                                            }
                                                        }}
                                                    />
                                                </label>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-1">
                                                <button
                                                    onClick={() => openEdit(c)}
                                                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                >
                                                    <Edit3 className="w-3.5 h-3.5" />
                                                    עריכה
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(c._id, c.name)}
                                                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                    מחיקה
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {query && (
                            <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 text-xs text-gray-400">
                                מציג {filtered.length} מתוך {carriers.length} מובילים
                            </div>
                        )}
                    </div>
                }
            </div>

            {/* Add / Edit Modal */}
            <AnimatePresence>
                {showModal && (
                    <>
                        <motion.div
                            key="carrier-backdrop"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
                            onClick={() => setShowModal(false)}
                        />
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
                            <motion.div
                                key="carrier-panel"
                                initial={{ opacity: 0, scale: 0.92, y: 12 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.94, y: 6 }}
                                transition={{ type: "spring", stiffness: 420, damping: 26, mass: 0.8 }}
                                className="pointer-events-auto w-full max-w-md bg-white rounded-2xl shadow-2xl ring-1 ring-blue-100 overflow-hidden"
                            >
                                <div className="h-1 w-full bg-gradient-to-r from-blue-500 to-indigo-400" />
                                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                                    <h3 className="text-base font-semibold text-gray-900">
                                        {editing ? "עריכת מוביל" : "הוספת מוביל חדש"}
                                    </h3>
                                    <button
                                        onClick={() => setShowModal(false)}
                                        className="text-gray-400 hover:text-gray-600 transition-colors"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
                                <div className="px-6 py-5 space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            שם <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={form.name}
                                            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                                            className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${formErrors.name ? "border-red-400" : "border-gray-300"}`}
                                        />
                                        {formErrors.name && (
                                            <p className="mt-1 text-xs text-red-500">{formErrors.name}</p>
                                        )}
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            מספר ח.פ. <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={form.hpNumber}
                                            onChange={(e) => setForm((p) => ({ ...p, hpNumber: e.target.value }))}
                                            className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${formErrors.hpNumber ? "border-red-400" : "border-gray-300"}`}
                                        />
                                        {formErrors.hpNumber && (
                                            <p className="mt-1 text-xs text-red-500">{formErrors.hpNumber}</p>
                                        )}
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            אימייל <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="email"
                                            value={form.email}
                                            onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                                            className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${formErrors.email ? "border-red-400" : "border-gray-300"}`}
                                        />
                                        {formErrors.email && (
                                            <p className="mt-1 text-xs text-red-500">{formErrors.email}</p>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                מיקום
                                            </label>
                                            <select
                                                value={form.location}
                                                onChange={(e) =>
                                                    setForm((p) => ({
                                                        ...p,
                                                        location: e.target.value as CarrierFormData["location"],
                                                    }))
                                                }
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                            >
                                                <option value="Haifa">חיפה</option>
                                                <option value="Ashdod">אשדוד</option>
                                                <option value="Both">שניהם</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">סוג</label>
                                            <select
                                                value={form.type}
                                                onChange={(e) =>
                                                    setForm((p) => ({
                                                        ...p,
                                                        type: e.target.value as CarrierFormData["type"],
                                                    }))
                                                }
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                            >
                                                <option value="FCL">FCL</option>
                                                <option value="LCL">LCL</option>
                                                <option value="Both">שניהם</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                                <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
                                    <button
                                        onClick={() => setShowModal(false)}
                                        className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
                                    >
                                        ביטול
                                    </button>
                                    <motion.button
                                        onClick={handleSave}
                                        disabled={saving}
                                        whileTap={{ scale: 0.97 }}
                                        className="px-6 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md shadow-blue-200 disabled:opacity-50 transition-colors"
                                    >
                                        {saving ?
                                            "שומר..."
                                        : editing ?
                                            "שמור שינויים"
                                        :   "הוסף מוביל"}
                                    </motion.button>
                                </div>
                            </motion.div>
                        </div>
                    </>
                )}
            </AnimatePresence>

            {/* Confirm Modal */}
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

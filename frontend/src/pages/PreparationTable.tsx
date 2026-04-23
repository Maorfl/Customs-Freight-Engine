import { useState, useEffect, useCallback, useRef } from "react";
import { Pencil, Trash2, Paperclip, Eye, X, Send } from "lucide-react";
import { shipmentsApi } from "../services/api";
import type { Shipment } from "../types";
import socket from "../services/socket";
import ConfirmModal from "../components/ConfirmModal";

const PORT_NAMES: Record<string, string> = {
    ILHFA: "נמל חיפה",
    ILHBT: "מפרץ חיפה",
    ILOVR: "אוברסיז חיפה",
    ILHDC: "מדלוג חיפה",
    ILASH: "נמל אשדוד",
    ILAST: "אשדוד דרום",
    ILOVO: "אוברסיז אשדוד",
    ILMTS: "מסוף 207",
    ILCXQ: "גולד בונד",
    ILBXQ: "בונדד אשדוד",
};

function portNameToCode(name: string): string {
    switch (name) {
        case "נמל חיפה":
            return "ILHFA";
        case "מפרץ חיפה":
            return "ILHBT";
        case "אוברסיז חיפה":
            return "ILOVR";
        case "מדלוג חיפה":
            return "ILHDC";
        case "נמל אשדוד":
            return "ILASH";
        case "אשדוד דרום":
            return "ILAST";
        case "אוברסיז אשדוד":
            return "ILOVO";
        case "מסוף 207":
            return "ILMTS";
        case "גולד בונד":
            return "ILCXQ";
        case "בונדד אשדוד":
            return "ILBXQ";
        default:
            return "";
    }
}

function shipmentTypeLabel(s: Shipment): string {
    if (s.shipmentType === "FCL") {
        return s.containerSize ? `FCL ${s.containerSize}'` : "FCL";
    }
    return "LCL";
}

// ─── Edit Modal ──────────────────────────────────────────────────────────────

interface EditModalProps {
    shipment: Shipment;
    onClose: () => void;
    onSaved: (updated: Shipment) => void;
}

function EditModal({ shipment, onClose, onSaved }: EditModalProps) {
    const [form, setForm] = useState({
        fileNumber: shipment.fileNumber,
        destination: shipment.destination ?? "",
        releasePoint: shipment.releasePoint,
        shipmentType: shipment.shipmentType,
        containerSize: shipment.containerSize?.toString() ?? "",
        quantity: shipment.quantity?.toString() ?? "",
        weight: shipment.weight?.toString() ?? "",
        volume: shipment.volume?.toString() ?? "",
        isDangerous: shipment.isDangerous,
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    function set(field: string, value: string | boolean) {
        setForm((prev) => ({ ...prev, [field]: value }));
    }

    async function handleSave() {
        setSaving(true);
        setError("");
        try {
            const payload: Record<string, unknown> = {
                fileNumber: form.fileNumber,
                destination: form.destination,
                releasePoint: form.releasePoint,
                shipmentType: form.shipmentType,
                quantity: Number(form.quantity),
                weight: Number(form.weight),
                isDangerous: form.isDangerous,
            };
            if (form.shipmentType === "FCL" && form.containerSize) {
                payload.containerSize = Number(form.containerSize);
            }
            if (form.shipmentType === "LCL" && form.volume) {
                payload.volume = Number(form.volume);
            }
            const updated = await shipmentsApi.update(shipment._id, payload as Partial<Shipment>);
            onSaved(updated);
            onClose();
        } catch {
            setError("שגיאה בשמירה — בדוק את הנתונים ונסה שוב");
        } finally {
            setSaving(false);
        }
    }

    const inputCls =
        "w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400";
    const labelCls = "block text-xs font-medium text-gray-500 mb-1";

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-6">
                <div className="flex items-center justify-between mb-5">
                    <h2 className="text-lg font-bold text-gray-800">עריכת משלוח {shipment.fileNumber}</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X size={20} />
                    </button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className={labelCls}>מספר תיק</label>
                        <input
                            className={inputCls}
                            value={form.fileNumber}
                            onChange={(e) => set("fileNumber", e.target.value)}
                        />
                    </div>
                    <div>
                        <label className={labelCls}>יעד</label>
                        <input
                            className={inputCls}
                            value={form.destination}
                            onChange={(e) => set("destination", e.target.value)}
                        />
                    </div>
                    <div>
                        <label className={labelCls}>נקודת שחרור</label>
                        <input
                            className={inputCls}
                            value={form.releasePoint}
                            onChange={(e) => set("releasePoint", e.target.value)}
                        />
                    </div>
                    <div>
                        <label className={labelCls}>סוג משלוח</label>
                        <select
                            className={inputCls}
                            value={form.shipmentType}
                            onChange={(e) => set("shipmentType", e.target.value)}
                        >
                            <option value="LCL">LCL</option>
                            <option value="FCL">FCL</option>
                        </select>
                    </div>
                    {form.shipmentType === "FCL" && (
                        <div>
                            <label className={labelCls}>גודל מכולה</label>
                            <select
                                className={inputCls}
                                value={form.containerSize}
                                onChange={(e) => set("containerSize", e.target.value)}
                            >
                                <option value="">— בחר —</option>
                                <option value="20">20'</option>
                                <option value="40">40'</option>
                            </select>
                        </div>
                    )}
                    <div>
                        <label className={labelCls}>כמות</label>
                        <input
                            type="number"
                            min="1"
                            className={inputCls}
                            value={form.quantity}
                            onChange={(e) => set("quantity", e.target.value)}
                        />
                    </div>
                    <div>
                        <label className={labelCls}>משקל (ק"ג)</label>
                        <input
                            type="number"
                            min="0"
                            className={inputCls}
                            value={form.weight}
                            onChange={(e) => set("weight", e.target.value)}
                        />
                    </div>
                    {form.shipmentType === "LCL" && (
                        <div>
                            <label className={labelCls}>נפח (CBM)</label>
                            <input
                                type="number"
                                min="0"
                                className={inputCls}
                                value={form.volume}
                                onChange={(e) => set("volume", e.target.value)}
                            />
                        </div>
                    )}
                    <div className="col-span-2 flex items-center gap-2">
                        <input
                            id="isDangerous"
                            type="checkbox"
                            checked={form.isDangerous}
                            onChange={(e) => set("isDangerous", e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300 text-blue-600"
                        />
                        <label htmlFor="isDangerous" className="text-sm text-gray-700">
                            סחורה מסוכנת
                        </label>
                    </div>
                </div>

                {error && <p className="mt-3 text-sm text-red-500">{error}</p>}

                <div className="flex justify-end gap-3 mt-6">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                        ביטול
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50"
                    >
                        {saving ? "שומר..." : "שמור"}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function PreparationTable() {
    const [shipments, setShipments] = useState<Shipment[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploadingId, setUploadingId] = useState<string | null>(null);
    const [dispatchingId, setDispatchingId] = useState<string | null>(null);
    const [errorMap, setErrorMap] = useState<Record<string, string>>({});
    const [editingShipment, setEditingShipment] = useState<Shipment | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<Shipment | null>(null);
    const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

    const loadShipments = useCallback(async () => {
        try {
            const data = await shipmentsApi.getAll("Preparation");
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

    useEffect(() => {
        const interval = setInterval(loadShipments, 10_000);
        return () => clearInterval(interval);
    }, [loadShipments]);

    useEffect(() => {
        function onCreated(shipment: Shipment) {
            if (shipment.status === "Preparation") {
                setShipments((prev) => [shipment, ...prev]);
            }
        }
        function onUpdated(updated: Shipment) {
            setShipments((prev) => {
                if (updated.status !== "Preparation") return prev.filter((s) => s._id !== updated._id);
                const idx = prev.findIndex((s) => s._id === updated._id);
                if (idx === -1) return prev;
                const next = [...prev];
                next[idx] = updated;
                return next;
            });
        }
        socket.on("shipment:created", onCreated);
        socket.on("shipment:updated", onUpdated);
        return () => {
            socket.off("shipment:created", onCreated);
            socket.off("shipment:updated", onUpdated);
        };
    }, []);

    async function handlePackingListUpload(id: string, file: File) {
        setUploadingId(id);
        setErrorMap((m) => ({ ...m, [id]: "" }));
        try {
            const updated = await shipmentsApi.uploadPackingList(id, file);
            setShipments((prev) => prev.map((s) => (s._id === id ? updated : s)));
            const ref = fileInputRefs.current[id];
            if (ref) ref.value = "";
        } catch {
            setErrorMap((m) => ({ ...m, [id]: "שגיאה בהעלאת הקובץ" }));
        } finally {
            setUploadingId(null);
        }
    }

    async function handleDelete(id: string) {
        try {
            await shipmentsApi.delete(id);
            setShipments((prev) => prev.filter((s) => s._id !== id));
        } catch {
            setErrorMap((m) => ({ ...m, [id]: "שגיאה במחיקה" }));
        } finally {
            setDeleteTarget(null);
        }
    }

    async function handleDispatch(id: string) {
        setDispatchingId(id);
        setErrorMap((m) => ({ ...m, [id]: "" }));
        try {
            await shipmentsApi.dispatch(id);
            setShipments((prev) => prev.filter((s) => s._id !== id));
        } catch (err: unknown) {
            const msg =
                (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "שגיאה בשליחה";
            setErrorMap((m) => ({ ...m, [id]: msg }));
        } finally {
            setDispatchingId(null);
        }
    }

    const HEADERS = [
        "מספר תיק",
        "נקודת שחרור",
        "סוג משלוח",
        "סחורה מסוכנת",
        "כמות",
        'משקל (ק"ג)',
        "נפח (CBM)",
        "יעד",
        "רשימת תכולה",
        "פעולות",
        "שליחה",
    ];

    return (
        <>
            {editingShipment && (
                <EditModal
                    shipment={editingShipment}
                    onClose={() => setEditingShipment(null)}
                    onSaved={(updated) =>
                        setShipments((prev) => prev.map((s) => (s._id === updated._id ? updated : s)))
                    }
                />
            )}

            <ConfirmModal
                isOpen={!!deleteTarget}
                onClose={() => setDeleteTarget(null)}
                onConfirm={() => deleteTarget && handleDelete(deleteTarget._id)}
                title="מחיקת משלוח"
                message={`האם למחוק את תיק ${deleteTarget?.fileNumber ?? ""}? פעולה זו אינה הפיכה.`}
                type="danger"
                icon="alertTriangle"
                confirmLabel="מחק"
            />

            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold text-gray-900">הכנה למשלוח</h1>
                    <button onClick={loadShipments} className="text-sm text-blue-600 hover:text-blue-800">
                        רענן
                    </button>
                </div>

                <section className="bg-white rounded-xl shadow-sm border border-gray-200">
                    {loading ?
                        <div className="p-10 text-center text-gray-400">טוען...</div>
                    : shipments.length === 0 ?
                        <div className="p-10 text-center text-gray-400">אין משלוחים בהכנה כרגע</div>
                    :   <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 border-b border-gray-200">
                                    <tr>
                                        {HEADERS.map((h) => (
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
                                            <td className="px-4 py-3 font-semibold text-gray-900 whitespace-nowrap">
                                                {s.fileNumber}
                                            </td>

                                            <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                                                {PORT_NAMES[portNameToCode(s.releasePoint)] ?? s.releasePoint}
                                            </td>

                                            <td className="px-4 py-3">
                                                <span
                                                    className={`px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap ${
                                                        s.shipmentType === "FCL" ?
                                                            "bg-indigo-50 text-indigo-700"
                                                        :   "bg-orange-50 text-orange-700"
                                                    }`}
                                                >
                                                    {shipmentTypeLabel(s)}
                                                </span>
                                            </td>

                                            <td className="px-4 py-3">
                                                {s.isDangerous ?
                                                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-50 text-red-700">
                                                        ⚠ כן
                                                    </span>
                                                :   <span className="text-gray-400 text-xs">לא</span>}
                                            </td>

                                            <td className="px-4 py-3 text-gray-700 text-center">{s.quantity}</td>

                                            <td className="px-4 py-3 text-gray-700 text-center">
                                                {s.weight.toLocaleString("he-IL")}
                                            </td>

                                            <td className="px-4 py-3 text-gray-700 text-center">
                                                {s.shipmentType === "LCL" && s.volume != null ? s.volume : "—"}
                                            </td>

                                            <td
                                                className="px-4 py-3 text-gray-700 max-w-[160px] truncate"
                                                title={s.destination}
                                            >
                                                {s.destination}
                                            </td>

                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-1.5">
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
                                                        className="hidden"
                                                        id={`file-${s._id}`}
                                                    />
                                                    <label
                                                        htmlFor={`file-${s._id}`}
                                                        title="העלאת רשימת תכולה"
                                                        className="cursor-pointer p-1.5 rounded-md text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                                                    >
                                                        {uploadingId === s._id ?
                                                            <span className="text-xs text-gray-400">מעלה...</span>
                                                        :   <Paperclip size={16} />}
                                                    </label>
                                                    {s.packingListUrl && uploadingId !== s._id && (
                                                        <a
                                                            href={`/${s.packingListUrl}`}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            title="צפה בקובץ"
                                                            className="p-1.5 rounded-md text-green-600 hover:bg-green-50 transition-colors"
                                                        >
                                                            <Eye size={16} />
                                                        </a>
                                                    )}
                                                </div>
                                                {errorMap[s._id] === "שגיאה בהעלאת הקובץ" && (
                                                    <p className="text-xs text-red-500 mt-1">{errorMap[s._id]}</p>
                                                )}
                                            </td>

                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-1">
                                                    <button
                                                        onClick={() => setEditingShipment(s)}
                                                        title="עריכה"
                                                        className="p-1.5 rounded-md text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                                                    >
                                                        <Pencil size={15} />
                                                    </button>
                                                    <button
                                                        onClick={() => setDeleteTarget(s)}
                                                        title="מחיקה"
                                                        className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                                    >
                                                        <Trash2 size={15} />
                                                    </button>
                                                </div>
                                                {errorMap[s._id] && errorMap[s._id] !== "שגיאה בהעלאת הקובץ" && (
                                                    <p className="text-xs text-red-500 mt-1 whitespace-nowrap">
                                                        {errorMap[s._id]}
                                                    </p>
                                                )}
                                            </td>

                                            <td className="px-4 py-3">
                                                <button
                                                    onClick={() => handleDispatch(s._id)}
                                                    disabled={dispatchingId === s._id}
                                                    title="שלח למובילים"
                                                    className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-700
                            disabled:opacity-50 disabled:cursor-not-allowed
                            text-white text-xs font-semibold rounded-lg shadow-sm transition-colors whitespace-nowrap"
                                                >
                                                    <Send size={13} />
                                                    {dispatchingId === s._id ? "שולח..." : "שלח"}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    }
                </section>
            </div>
        </>
    );
}

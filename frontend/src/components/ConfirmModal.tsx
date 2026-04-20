import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, FileX, Send } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ModalType = 'danger' | 'info' | 'success';
export type ModalIcon = 'send' | 'alertTriangle' | 'fileX';

export interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  type?: ModalType;
  icon?: ModalIcon;
  confirmLabel?: string;
}

// ─── Theme map ────────────────────────────────────────────────────────────────

const THEME = {
  danger: {
    iconBg: 'bg-red-100',
    iconColor: 'text-red-600',
    button: 'bg-red-600 hover:bg-red-700 focus:ring-red-500 shadow-red-200',
    ring: 'ring-red-100',
  },
  info: {
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-600',
    button: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500 shadow-blue-200',
    ring: 'ring-blue-100',
  },
  success: {
    iconBg: 'bg-green-100',
    iconColor: 'text-green-600',
    button: 'bg-green-600 hover:bg-green-700 focus:ring-green-500 shadow-green-200',
    ring: 'ring-green-100',
  },
} satisfies Record<ModalType, { iconBg: string; iconColor: string; button: string; ring: string }>;

// ─── Icon resolver ────────────────────────────────────────────────────────────

function resolveIcon(icon: ModalIcon | undefined, type: ModalType) {
  const key = icon ?? (type === 'danger' ? 'alertTriangle' : 'send');
  switch (key) {
    case 'send':
      return Send;
    case 'fileX':
      return FileX;
    case 'alertTriangle':
    default:
      return AlertTriangle;
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  type = 'danger',
  icon,
  confirmLabel = 'אישור',
}: ConfirmModalProps) {
  const theme = THEME[type];
  const Icon = resolveIcon(icon, type);

  function handleConfirm() {
    onConfirm();
    onClose();
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* ── Backdrop ──────────────────────────────────────────────────────── */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* ── Panel ─────────────────────────────────────────────────────────── */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              key="panel"
              initial={{ opacity: 0, scale: 0.92, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 6 }}
              transition={{
                type: 'spring',
                stiffness: 420,
                damping: 26,
                mass: 0.8,
              }}
              className={`pointer-events-auto w-full max-w-md bg-white rounded-2xl shadow-2xl ring-1 ${theme.ring} overflow-hidden`}
            >
              {/* Top accent bar */}
              <div
                className={`h-1 w-full ${
                  type === 'danger'
                    ? 'bg-gradient-to-r from-red-500 to-rose-400'
                    : type === 'info'
                    ? 'bg-gradient-to-r from-blue-500 to-indigo-400'
                    : 'bg-gradient-to-r from-green-500 to-emerald-400'
                }`}
              />

              <div className="p-6 sm:p-7">
                {/* Icon + Title */}
                <div className="flex items-start gap-4">
                  <div
                    className={`shrink-0 flex items-center justify-center w-12 h-12 rounded-full ${theme.iconBg}`}
                  >
                    <Icon className={`w-6 h-6 ${theme.iconColor}`} strokeWidth={2} />
                  </div>
                  <div className="pt-0.5 min-w-0">
                    <h3 className="text-base font-semibold text-gray-900 leading-snug">
                      {title}
                    </h3>
                    <p className="mt-1.5 text-sm text-gray-500 leading-relaxed">
                      {message}
                    </p>
                  </div>
                </div>

                {/* Divider */}
                <div className="my-5 border-t border-gray-100" />

                {/* Actions */}
                <div className="flex items-center justify-end gap-3">
                  <button
                    onClick={onClose}
                    className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-gray-300"
                  >
                    ביטול
                  </button>
                  <motion.button
                    onClick={handleConfirm}
                    whileTap={{ scale: 0.96 }}
                    className={`px-5 py-2.5 text-sm font-semibold text-white rounded-xl transition-colors shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 ${theme.button}`}
                  >
                    {confirmLabel}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

import type { Shipment } from '../types';

interface Props {
  status: Shipment['status'];
  repliedBy?: string;
}

export default function StatusBadge({ status, repliedBy }: Props) {
  // Priority 1: reply received — green, shows carrier name
  if (repliedBy) {
    return (
      <span className="inline-flex flex-wrap items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border bg-green-100 text-green-800 border-green-200 whitespace-nowrap">
        מענה מכ: <span className="font-bold">{repliedBy}</span>
      </span>
    );
  }

  // Priority 2: escalation active — red + pulse
  if (status === 'Processing' || status === 'Paused - Reply Received') {
    if (status === 'Processing') {
      return (
        <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold border bg-red-100 text-red-700 border-red-200 animate-pulse">
          בתהליך
        </span>
      );
    }
    // Paused but no repliedBy yet (edge case)
    return (
      <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold border bg-amber-100 text-amber-800 border-amber-200">
        הושהה
      </span>
    );
  }

  // Priority 3: queue exhausted, no reply — amber
  if (status === 'Completed') {
    return (
      <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold border bg-yellow-100 text-yellow-700 border-yellow-200">
        אין מענה
      </span>
    );
  }

  // Pending
  return (
    <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold border bg-gray-100 text-gray-600 border-gray-200">
      ממתין
    </span>
  );
}

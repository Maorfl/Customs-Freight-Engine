// ─── Carrier ──────────────────────────────────────────────────────────────────

export interface Carrier {
  _id: string;
  name: string;
  hpNumber: string;
  email: string;
  priceListUrl?: string;
  location: 'Haifa' | 'Ashdod' | 'Both';
  type: 'FCL' | 'LCL' | 'Both';
  createdAt: string;
  updatedAt: string;
}

export type CarrierFormData = Omit<
  Carrier,
  '_id' | 'priceListUrl' | 'createdAt' | 'updatedAt'
>;

// ─── Shipment ─────────────────────────────────────────────────────────────────

export interface CarrierQueueItem {
  name: string;
  emails: string[];
}

export type ShipmentStatus = 'Pending' | 'Processing' | 'Paused - Reply Received' | 'Completed';
export type ShipmentType = 'FCL' | 'LCL';

export interface Shipment {
  _id: string;
  fileNumber: string;
  releasePoint: string;
  isDangerous: boolean;
  shipmentType: ShipmentType;
  quantity: number;
  weight: number;
  volume?: number;
  destination: string;
  specialNotes?: string;
  packingListUrl?: string;
  status: ShipmentStatus;
  currentCarrierIndex: number;
  carriersQueue: CarrierQueueItem[];
  lastEmailSentAt?: string;
  repliedBy?: string;        // name/email of the carrier who replied
  isQueueFinished?: boolean; // true once every carrier has been emailed
  createdAt: string;
  updatedAt: string;
}

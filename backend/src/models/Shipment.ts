import mongoose, { Document, Schema } from 'mongoose';

export interface CarrierQueueItem {
  name: string;
  emails: string[];
}

export interface IShipment extends Document {
  fileNumber: string;
  releasePoint: string;
  isDangerous: boolean;
  shipmentType: 'FCL' | 'LCL';
  containerSize?: 20 | 40;
  quantity: number;
  weight: number;
  volume?: number;
  destination: string;
  specialNotes?: string;
  packingListUrl?: string;
  status: 'Preparation' | 'Pending' | 'Processing' | 'Paused - Reply Received' | 'Completed';
  repliedBy?: string;          // carrier name (or email) that sent the first reply
  isQueueFinished: boolean;    // true once every carrier in the queue has been contacted
  currentCarrierIndex: number;
  carriersQueue: CarrierQueueItem[];
  lastEmailSentAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const CarrierQueueItemSchema = new Schema<CarrierQueueItem>(
  {
    name: { type: String, required: true },
    emails: [{ type: String, required: true }],
  },
  { _id: false }
);

const ShipmentSchema = new Schema<IShipment>(
  {
    fileNumber: {
      type: String,
      required: true,
      validate: {
        validator: (v: string) => /^6\d{6}$/.test(v),
        message: 'מספר תיק חייב להיות 7 ספרות ולהתחיל ב-6',
      },
    },
    releasePoint: { type: String, required: true, trim: true },
    isDangerous: { type: Boolean, default: false },
    shipmentType: { type: String, enum: ['FCL', 'LCL'], required: true },
    containerSize: {
      type: Number,
      enum: [20, 40],
      required: function (this: IShipment) {
        return this.shipmentType === 'FCL';
      },
    },
    quantity: { type: Number, required: true, min: 1 },
    weight: { type: Number, required: true, min: 0 },
    volume: { type: Number, min: 0 },
    destination: { type: String, required: true, trim: true },
    specialNotes: { type: String, trim: true },
    packingListUrl: { type: String },
    status: {
      type: String,
      enum: ['Preparation', 'Pending', 'Processing', 'Paused - Reply Received', 'Completed'],
      default: 'Pending',
    },
    currentCarrierIndex: { type: Number, default: 0 },
    carriersQueue: { type: [CarrierQueueItemSchema], default: [] },
    lastEmailSentAt: { type: Date },
    repliedBy: { type: String, trim: true },
    isQueueFinished: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model<IShipment>('Shipment', ShipmentSchema);

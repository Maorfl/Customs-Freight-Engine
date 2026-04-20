import mongoose, { Document, Schema } from 'mongoose';

export interface ICarrier extends Document {
  name: string;
  hpNumber: string;
  email: string;
  priceListUrl?: string;
  location: 'Haifa' | 'Ashdod' | 'Both';
  type: 'FCL' | 'LCL' | 'Both';
  createdAt: Date;
  updatedAt: Date;
}

const CarrierSchema = new Schema<ICarrier>(
  {
    name: { type: String, required: true, trim: true },
    hpNumber: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    priceListUrl: { type: String },
    location: {
      type: String,
      enum: ['Haifa', 'Ashdod', 'Both'],
      required: true,
    },
    type: {
      type: String,
      enum: ['FCL', 'LCL', 'Both'],
      required: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model<ICarrier>('Carrier', CarrierSchema);

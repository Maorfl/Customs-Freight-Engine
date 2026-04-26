import axios from 'axios';
import type { Carrier, CarrierFormData, Shipment } from '../types';

const api = axios.create({
  baseURL: '/api',
});

// ─── Carriers ─────────────────────────────────────────────────────────────────

export const carriersApi = {
  getAll: (): Promise<Carrier[]> =>
    api.get<Carrier[]>('/carriers').then((r) => r.data),

  getById: (id: string): Promise<Carrier> =>
    api.get<Carrier>(`/carriers/${id}`).then((r) => r.data),

  create: (data: CarrierFormData): Promise<Carrier> =>
    api.post<Carrier>('/carriers', data).then((r) => r.data),

  update: (id: string, data: Partial<CarrierFormData>): Promise<Carrier> =>
    api.put<Carrier>(`/carriers/${id}`, data).then((r) => r.data),

  delete: (id: string): Promise<{ message: string }> =>
    api.delete(`/carriers/${id}`).then((r) => r.data),

  uploadPriceList: (
    id: string,
    file: File
  ): Promise<{ message: string; carrier: Carrier }> => {
    const form = new FormData();
    form.append('priceList', file);
    return api
      .post<{ message: string; carrier: Carrier }>(
        `/carriers/${id}/price-list`,
        form,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      )
      .then((r) => r.data);
  },
};

// ─── Shipments ────────────────────────────────────────────────────────────────

export const shipmentsApi = {
  getAll: (status?: string): Promise<Shipment[]> => {
    const params = status ? { status } : {};
    return api.get<Shipment[]>('/shipments', { params }).then((r) => r.data);
  },

  getById: (id: string): Promise<Shipment> =>
    api.get<Shipment>(`/shipments/${id}`).then((r) => r.data),

  create: (formData: FormData): Promise<Shipment> =>
    api
      .post<Shipment>('/shipments', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data),

  delete: (id: string): Promise<{ message: string }> =>
    api.delete(`/shipments/${id}`).then((r) => r.data),

  update: (id: string, data: Partial<Shipment>): Promise<Shipment> =>
    api.put<Shipment>(`/shipments/${id}`, data).then((r) => r.data),

  resume: (id: string): Promise<{ shipment: Shipment; carrierName: string }> =>
    api.post<{ shipment: Shipment; carrierName: string }>(`/shipments/${id}/resume`).then((r) => r.data),

  uploadPackingList: (id: string, file: File): Promise<Shipment> => {
    const form = new FormData();
    form.append('packingList', file);
    return api
      .patch<Shipment>(`/shipments/${id}/packing-list`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data);
  },

  dispatch: (id: string): Promise<{ shipment: Shipment; carrierName: string }> =>
    api.post<{ shipment: Shipment; carrierName: string }>(`/shipments/${id}/dispatch`).then((r) => r.data),

  markAsRead: (id: string): Promise<Shipment> =>
    api.patch<Shipment>(`/shipments/${id}/read`).then((r) => r.data),
};

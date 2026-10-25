import { SplitBill } from '../types';

export function createEmptyBill(): SplitBill {
  const now = new Date();
  return {
    id: 'sb-' + now.getTime().toString(36),
    title: '',
    category: 'Makan & Minum',
    date: now.toISOString().slice(0, 10),
    createdAt: now.toISOString(),
    mode: 'itemized',
    extraRule: 'proportional',
    taxPercent: 0,
    taxAmount: 0,
    useTaxPercent: true,
    servicePercent: 0,
    serviceAmount: 0,
    useServicePercent: true,
    deliveryAmount: 0,
    discountAmount: 0,
    notes: '',
    creatorName: '',
    paymentChannels: [],
    participants: [],
    items: [],
  };
}

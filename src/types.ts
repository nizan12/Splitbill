export type SplitMode = 'itemized' | 'equal';

export type ExtraSplitRule = 'proportional' | 'equal';

export type PaymentStatus = 'unpaid' | 'pending_verification' | 'paid';

export interface RegisteredUser {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  phoneOrHandle?: string;
  updatedAt?: string;
}

export interface Participant {
  id: string;
  name: string;
  phoneOrHandle?: string;
  email?: string;
  userId?: string;
  photoURL?: string;
  isOwner?: boolean;
  status: PaymentStatus;
  paidAt?: string;
  paidVia?: string;
  paidNote?: string;
  proofImageUrl?: string;
  proofRefNumber?: string;
  equalPortions?: number; // Used in 'equal' mode (default 1)
}

export interface SavedContactGroup {
  id: string;
  name: string;
  members: Array<{ name: string; phoneOrHandle: string; email?: string; userId?: string }>;
}

export interface BillItem {
  id: string;
  name: string;
  qty: number;
  unitPrice: number;
  assignedTo: string[]; // Array of participant IDs
}

export interface PaymentChannel {
  id: string;
  provider: 'QRIS' | 'BCA' | 'Mandiri' | 'SeaBank' | 'BRI' | 'BNI' | 'OVO' | 'DANA' | 'ShopeePay';
  accountNumber: string;
  accountHolder: string;
  enabled: boolean;
  qrisImageUrl?: string;
  qrisRawString?: string;
}

export interface SplitBill {
  id: string;
  ownerId?: string;
  ownerEmail?: string;
  title: string;
  category: string;
  date: string;
  createdAt: string;
  updatedAt?: string;
  mode: SplitMode;
  extraRule: ExtraSplitRule;
  equalManualSubtotal?: number;
  taxPercent: number;
  taxAmount: number;
  useTaxPercent: boolean;
  servicePercent: number;
  serviceAmount: number;
  useServicePercent: boolean;
  deliveryAmount: number;
  discountAmount: number;
  notes?: string;
  creatorName: string;
  paymentChannels: PaymentChannel[];
  participants: Participant[];
  items: BillItem[];
}

export interface ParticipantBreakdownItem {
  itemId: string;
  name: string;
  totalQty: number;
  unitPrice: number;
  lineTotal: number;
  sharedWithCount: number;
  sharedWithNames: string[];
  shareAmount: number;
}

export interface ParticipantCalculation {
  participant: Participant;
  items: ParticipantBreakdownItem[];
  subtotal: number;
  taxShare: number;
  serviceShare: number;
  deliveryShare: number;
  discountShare: number;
  finalTotal: number;
  uniqueCode: number;
}

export interface BillCalculationSummary {
  rawSubtotal: number;
  computedTax: number;
  computedService: number;
  computedDelivery: number;
  computedDiscount: number;
  grandTotal: number;
  totalPaidAmount: number;
  totalUnpaidAmount: number;
  paidCount: number;
  participantBreakdowns: ParticipantCalculation[];
}

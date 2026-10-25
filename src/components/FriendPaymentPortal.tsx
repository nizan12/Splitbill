import React, { useState, useRef } from 'react';
import {
  Check,
  Copy,
  QrCode,
  Wallet,
  Building2,
  ArrowLeft,
  Share2,
  CheckCircle2,
  Clock,
  Receipt,
  Upload,
  FileCheck2,
  X,
  ListChecks,
} from 'lucide-react';
import {
  SplitBill,
  BillCalculationSummary,
  PaymentStatus,
} from '../types';
import { formatRupiah, buildShareablePaymentLink } from '../utils/splitCalculator';

interface FriendPaymentPortalProps {
  bill: SplitBill;
  summary: BillCalculationSummary;
  initialParticipantId?: string;
  onUpdatePaymentStatus: (
    participantId: string,
    status: PaymentStatus,
    paidVia?: string,
    paidNote?: string,
    proofImageUrl?: string,
    proofRefNumber?: string
  ) => void;
  onBackToEditor: () => void;
}

const AVATAR_COLORS = [
  'bg-[#00AED6] text-white',
  'bg-[#00880D] text-white',
  'bg-[#0284C7] text-white',
  'bg-[#0D9488] text-white',
  'bg-[#2563EB] text-white',
  'bg-[#4F46E5] text-white',
  'bg-[#059669] text-white',
];

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'P';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function getAvatarColor(index: number): string {
  return AVATAR_COLORS[index % AVATAR_COLORS.length];
}

export const FriendPaymentPortal: React.FC<FriendPaymentPortalProps> = ({
  bill,
  summary,
  initialParticipantId,
  onUpdatePaymentStatus,
  onBackToEditor,
}) => {
  const defaultParticipant =
    summary.participantBreakdowns.find(
      (b) => b.participant.id === initialParticipantId
    ) ||
    summary.participantBreakdowns.find((b) => b.participant.status !== 'paid') ||
    summary.participantBreakdowns[0];

  const [selectedId, setSelectedId] = useState<string>(
    defaultParticipant?.participant.id || ''
  );
  const [mobileSection, setMobileSection] = useState<'personal' | 'full_receipt'>('personal');
  const [useUniqueCode, setUseUniqueCode] = useState<boolean>(false);
  const [selectedVia, setSelectedVia] = useState<string>(
    bill.paymentChannels.find((c) => c.enabled)?.provider || 'QRIS'
  );
  const [paymentNote, setPaymentNote] = useState<string>(
    defaultParticipant?.participant.paidNote || ''
  );
  const [proofPreview, setProofPreview] = useState<string | undefined>(
    defaultParticipant?.participant.proofImageUrl
  );
  const [proofRefNumber, setProofRefNumber] = useState<string>(
    defaultParticipant?.participant.proofRefNumber || ''
  );
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showQrisModal, setShowQrisModal] = useState<boolean>(true);
  const [showReceiptProofModal, setShowReceiptProofModal] = useState<boolean>(false);

  const proofFileRef = useRef<HTMLInputElement>(null);

  const activeBreakdown =
    summary.participantBreakdowns.find((b) => b.participant.id === selectedId) ||
    summary.participantBreakdowns[0];

  const enabledChannels = bill.paymentChannels.filter((c) => c.enabled);

  const handleCopy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(key);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopiedField(key);
      setTimeout(() => setCopiedField(null), 2000);
    }
  };

  if (!activeBreakdown) {
    return (
      <div className="max-w-3xl mx-auto px-3 sm:px-6 py-8">
        <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 text-center space-y-4 shadow-2xs">
          <h1 className="text-base sm:text-lg font-extrabold text-slate-900 font-display">
            Belum Ada Anggota di Split Bill Ini
          </h1>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Tambahkan nama teman dan daftar pesanan terlebih dahulu di halaman Buat Split Bill sebelum membuka link pembayaran.
          </p>
          <button
            type="button"
            onClick={onBackToEditor}
            className="min-h-[44px] px-5 py-2.5 rounded-full bg-[#00AED6] hover:bg-[#0099BD] text-white text-xs font-extrabold inline-flex items-center gap-2 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Kembali ke Buat Split Bill
          </button>
        </div>
      </div>
    );
  }

  const transferAmount = useUniqueCode
    ? activeBreakdown.finalTotal + activeBreakdown.uniqueCode
    : activeBreakdown.finalTotal;

  const handleProofFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setProofPreview(result);
      if (!proofRefNumber) {
        setProofRefNumber('SB-' + Date.now().toString().slice(-8));
      }
    };
    reader.readAsDataURL(file);
  };

  const progressPercent =
    summary.grandTotal > 0
      ? Math.min(100, Math.round((summary.totalPaidAmount / summary.grandTotal) * 100))
      : 0;

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 py-4 sm:py-6">
      {/* Top Action Bar for Portal Mode */}
      <div className="flex items-center justify-between gap-2 pb-4">
        <button
          type="button"
          onClick={onBackToEditor}
          className="min-h-[42px] px-3.5 sm:px-4 py-2 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 flex items-center gap-1.5 transition-colors whitespace-nowrap"
        >
          <ArrowLeft className="w-4 h-4 text-[#00AED6]" />
          <span>Kembali ke Editor</span>
        </button>

        <button
          type="button"
          onClick={() =>
            handleCopy(
              buildShareablePaymentLink(bill, activeBreakdown.participant.id),
              'personal-link'
            )
          }
          className="min-h-[42px] px-4 py-2 rounded-full bg-[#00880D] hover:bg-[#00700B] text-white text-xs font-extrabold flex items-center gap-1.5 transition-colors whitespace-nowrap shadow-2xs"
        >
          {copiedField === 'personal-link' ? (
            <>
              <Check className="w-4 h-4" />
              <span>Link {activeBreakdown.participant.name} Disalin</span>
            </>
          ) : (
            <>
              <Share2 className="w-4 h-4" />
              <span>Salin Link {activeBreakdown.participant.name}</span>
            </>
          )}
        </button>
      </div>

      {/* Split Bill Teal Header Card */}
      <div className="bg-gradient-to-r from-[#00AED6] to-[#0093B8] rounded-3xl p-4 sm:p-6 text-white shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4">
          <div>
            <div className="text-[11px] sm:text-xs text-white/85 font-bold flex flex-wrap items-center gap-1.5">
              <Receipt className="w-3.5 h-3.5" />
              <span>Oleh {bill.creatorName || 'Pembuat Split Bill'}</span>
              <span aria-hidden="true">·</span>
              <span>{bill.category}</span>
              <span aria-hidden="true">·</span>
              <span>{bill.date}</span>
            </div>
            <h1 className="text-xl sm:text-3xl font-extrabold font-display mt-1">
              {bill.title || 'Tagihan Split Bill'}
            </h1>
            {bill.notes && (
              <p className="mt-2 text-xs text-white/95 bg-white/15 px-3 py-1.5 rounded-2xl inline-block">
                Catatan: “{bill.notes}”
              </p>
            )}
          </div>
          <div className="flex sm:block items-center justify-between bg-white/15 px-3.5 py-2.5 rounded-2xl border border-white/20">
            <span className="text-xs text-white/85 block">Total Struk Utuh</span>
            <span className="text-base sm:text-xl font-extrabold font-mono tabular-nums text-white">
              {formatRupiah(summary.grandTotal)}
            </span>
          </div>
        </div>

        {/* Pelunasan Progress Bar */}
        <div className="mt-4 pt-3.5 border-t border-white/20">
          <div className="flex items-center justify-between text-[11px] sm:text-xs mb-1.5">
            <span className="font-bold text-white">
              Status Patungan: {summary.paidCount}/{bill.participants.length} lunas
            </span>
            <span className="font-mono tabular-nums font-extrabold text-white">
              {formatRupiah(summary.totalPaidAmount)} ({progressPercent}%)
            </span>
          </div>
          <div className="w-full h-2 bg-white/25 rounded-full overflow-hidden">
            <div
              className="h-full bg-white transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Step 1: Mobile-First Participant Selector (Horizontal Scroll on Mobile + Grid on Desktop) */}
      <div className="mt-4 bg-white border border-slate-200 rounded-3xl p-4 sm:p-6 shadow-2xs">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-extrabold text-slate-900 font-display">
            1. Pilih Nama Kamu ({summary.participantBreakdowns.length} Orang)
          </h2>
          <span className="text-[11px] text-slate-500">
            Ketuk nama untuk lihat tagihan
          </span>
        </div>

        {/* Mobile Horizontal Pill Strip + Desktop Grid */}
        <div className="flex sm:grid sm:grid-cols-2 lg:grid-cols-3 gap-2 overflow-x-auto pb-1 sm:pb-0 -mx-1 px-1">
          {summary.participantBreakdowns.map((b, idx) => {
            const isSelected = b.participant.id === activeBreakdown.participant.id;
            const isPaid = b.participant.status === 'paid';
            return (
              <button
                key={b.participant.id}
                type="button"
                onClick={() => {
                  setSelectedId(b.participant.id);
                  setPaymentNote(b.participant.paidNote || '');
                  setProofPreview(b.participant.proofImageUrl);
                  setProofRefNumber(b.participant.proofRefNumber || '');
                }}
                className={`min-w-[215px] sm:min-w-0 min-h-[58px] p-3 rounded-2xl border text-left transition-all flex items-center justify-between gap-2.5 shrink-0 ${
                  isSelected
                    ? 'border-[#00AED6] bg-[#00AED6]/[0.08] ring-2 ring-[#00AED6]/25'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center font-extrabold text-xs shrink-0 ${getAvatarColor(
                      idx
                    )}`}
                  >
                    {getInitials(b.participant.name)}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs sm:text-sm font-extrabold text-slate-900 truncate">
                      {b.participant.name}
                    </div>
                    <div className="text-[11px] flex items-center gap-1 mt-0.5">
                      {isPaid ? (
                        <span className="text-[#00880D] font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Lunas
                        </span>
                      ) : (
                        <span className="text-amber-700 font-semibold flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Belum Bayar
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs sm:text-sm font-extrabold font-mono tabular-nums text-slate-900">
                    {formatRupiah(b.finalTotal)}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono tabular-nums">
                    {b.items.length} menu
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Mobile Sub-View Switcher (Personal Bill & Payment vs Full Receipt Menu List) */}
      <div className="lg:hidden mt-4 bg-white border border-slate-200 rounded-2xl p-1.5 grid grid-cols-2 gap-1.5 shadow-2xs">
        <button
          type="button"
          onClick={() => setMobileSection('personal')}
          className={`min-h-[42px] px-3 py-2 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all ${
            mobileSection === 'personal'
              ? 'bg-[#00AED6] text-white shadow-2xs'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Receipt className="w-3.5 h-3.5" />
          <span>Tagihan & QRIS Kamu</span>
        </button>
        <button
          type="button"
          onClick={() => setMobileSection('full_receipt')}
          className={`min-h-[42px] px-3 py-2 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all ${
            mobileSection === 'full_receipt'
              ? 'bg-[#00AED6] text-white shadow-2xs'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <ListChecks className="w-3.5 h-3.5" />
          <span>Semua Menu ({bill.items.length})</span>
        </button>
      </div>

      {/* Main 2-Column Split Bill Portal */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-8 mt-4 sm:mt-6 items-start">
        {/* Left Column (7 cols): Personal Perforated Receipt & Full Receipt Overview */}
        <div className="lg:col-span-7 space-y-5 sm:space-y-6">
          {/* Perforated Digital Receipt Card for Selected Participant */}
          <div
            className={`${
              mobileSection === 'full_receipt' ? 'hidden lg:block' : 'block'
            } relative bg-white border border-slate-200 rounded-3xl p-4 sm:p-6 shadow-2xs overflow-hidden`}
          >
            {/* Decorative Side Cutout Notches */}
            <div
              aria-hidden="true"
              className="hidden sm:block absolute -left-3 top-20 w-6 h-6 rounded-full bg-[#F1F5F9] border border-slate-200"
            />
            <div
              aria-hidden="true"
              className="hidden sm:block absolute -right-3 top-20 w-6 h-6 rounded-full bg-[#F1F5F9] border border-slate-200"
            />

            <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b-2 border-dashed border-slate-200">
              <div className="flex items-center gap-2.5">
                <Receipt className="w-5 h-5 text-[#00AED6] shrink-0" />
                <div>
                  <h2 className="text-sm sm:text-base font-extrabold text-slate-900 font-display">
                    Struk Split Bill: {activeBreakdown.participant.name}
                  </h2>
                  <p className="text-[11px] sm:text-xs text-slate-500">
                    Metode: {bill.mode === 'itemized' ? 'Per Menu' : 'Bagi Rata'} ·{' '}
                    Pajak: {bill.extraRule === 'proportional' ? 'Proporsional' : 'Bagi Rata'}
                  </p>
                </div>
              </div>
              <div className="text-xs font-bold">
                {activeBreakdown.participant.status === 'paid' ? (
                  <button
                    type="button"
                    onClick={() => setShowReceiptProofModal(true)}
                    className="text-[#00880D] hover:underline flex items-center gap-1"
                  >
                    <FileCheck2 className="w-4 h-4" />
                    Lihat Bukti Lunas
                  </button>
                ) : (
                  <span className="text-amber-700 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    Menunggu Bayar
                  </span>
                )}
              </div>
            </div>

            {/* Mobile-Friendly Item List with Pre-Split Original Price & Personal Share */}
            <div className="mt-3 divide-y divide-slate-100">
              {activeBreakdown.items.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400">
                  Belum ada item pesanan yang ditugaskan untuk nama ini.
                </div>
              ) : (
                activeBreakdown.items.map((item, idx) => (
                  <div
                    key={`${item.itemId}-${idx}`}
                    className="py-3 flex flex-col sm:flex-row sm:items-start justify-between gap-2"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold text-slate-900">
                        {item.name}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                        {bill.mode === 'itemized' && (
                          <span className="font-mono tabular-nums">
                            {item.totalQty} × {formatRupiah(item.unitPrice)}
                          </span>
                        )}
                        <span aria-hidden="true">·</span>
                        {item.sharedWithCount > 1 ? (
                          <span className="text-[#00AED6] font-semibold">
                            Patungan {item.sharedWithCount} org ({item.sharedWithNames.join(', ')})
                          </span>
                        ) : (
                          <span>Pesanan pribadi (1 org)</span>
                        )}
                      </div>
                    </div>

                    {/* Pre-Split Price vs Share Amount Box */}
                    <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start bg-slate-50 sm:bg-transparent px-3 py-1.5 sm:p-0 rounded-xl shrink-0">
                      <div className="text-[11px] font-mono tabular-nums text-slate-500">
                        Harga Asli: <span className="font-semibold text-slate-700">{formatRupiah(item.lineTotal)}</span>
                        {item.sharedWithCount > 1 ? ` ÷ ${item.sharedWithCount}` : ''}
                      </div>
                      <div className="text-xs sm:text-sm font-mono tabular-nums font-extrabold text-slate-900">
                        Bagianmu: {formatRupiah(item.shareAmount)}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Proportional Breakdown */}
            <div className="mt-3 pt-4 border-t-2 border-dashed border-slate-200 space-y-2 text-xs">
              <div className="flex items-center justify-between text-slate-600">
                <span>Subtotal Bagian Pesanan Kamu</span>
                <span className="font-mono tabular-nums font-bold text-slate-900">
                  {formatRupiah(activeBreakdown.subtotal)}
                </span>
              </div>
              {activeBreakdown.taxShare > 0 && (
                <div className="flex items-center justify-between text-slate-600">
                  <span>
                    + Pajak PB1 / PPN (Dari Total Pajak {formatRupiah(summary.computedTax)})
                  </span>
                  <span className="font-mono tabular-nums font-semibold text-slate-900">
                    +{formatRupiah(activeBreakdown.taxShare)}
                  </span>
                </div>
              )}
              {activeBreakdown.serviceShare > 0 && (
                <div className="flex items-center justify-between text-slate-600">
                  <span>
                    + Biaya Layanan (Dari Total {formatRupiah(summary.computedService)})
                  </span>
                  <span className="font-mono tabular-nums">
                    +{formatRupiah(activeBreakdown.serviceShare)}
                  </span>
                </div>
              )}
              {activeBreakdown.deliveryShare > 0 && (
                <div className="flex items-center justify-between text-slate-600">
                  <span>
                    + Biaya Ongkir & Kemasan (Dari Total {formatRupiah(summary.computedDelivery)})
                  </span>
                  <span className="font-mono tabular-nums">
                    +{formatRupiah(activeBreakdown.deliveryShare)}
                  </span>
                </div>
              )}
              {activeBreakdown.discountShare > 0 && (
                <div className="flex items-center justify-between text-[#00880D] font-bold">
                  <span>
                    - Potongan Diskon / Promo (Dari Total {formatRupiah(summary.computedDiscount)})
                  </span>
                  <span className="font-mono tabular-nums">
                    -{formatRupiah(activeBreakdown.discountShare)}
                  </span>
                </div>
              )}
              {useUniqueCode && (
                <div className="flex items-center justify-between text-slate-600">
                  <span>Kode Unik Verifikasi Transfer</span>
                  <span className="font-mono tabular-nums">
                    +{activeBreakdown.uniqueCode}
                  </span>
                </div>
              )}
            </div>

            {/* Grand Total for Selected Friend + Copy Nominal */}
            <div className="mt-4 pt-4 border-t-2 border-dashed border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-xs text-slate-500 block">
                  Total yang harus dibayar oleh {activeBreakdown.participant.name}
                </span>
                <div className="text-2xl font-extrabold font-mono tabular-nums text-[#00880D] mt-0.5">
                  {formatRupiah(transferAmount)}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setUseUniqueCode(!useUniqueCode)}
                  className="min-h-[40px] flex-1 sm:flex-initial px-3.5 py-2 rounded-full border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-600 transition-colors whitespace-nowrap"
                >
                  {useUniqueCode ? 'Tanpa Kode Unik' : `Kode Unik (+${activeBreakdown.uniqueCode})`}
                </button>
                <button
                  type="button"
                  onClick={() => handleCopy(String(transferAmount), 'nominal')}
                  className="min-h-[40px] flex-1 sm:flex-initial px-4 py-2 rounded-full bg-[#00AED6] hover:bg-[#0099BD] text-white text-xs font-extrabold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
                >
                  {copiedField === 'nominal' ? (
                    <>
                      <Check className="w-4 h-4" />
                      Nominal Disalin
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Salin Nominal
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Full Receipt Overview: All Menus Being Split on This Bill */}
          <div
            className={`${
              mobileSection === 'personal' ? 'hidden lg:block' : 'block'
            } bg-white border border-slate-200 rounded-3xl p-4 sm:p-6 shadow-2xs`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-dashed border-slate-200">
              <div>
                <h2 className="text-sm sm:text-base font-extrabold text-slate-900 font-display">
                  Daftar Seluruh Menu yang Di-Split Bill ({bill.items.length} Menu)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Transparansi harga asli setiap menu sebelum dibagi patungan beserta daftar pemesannya
                </p>
              </div>
              <span className="text-xs font-mono tabular-nums font-bold text-slate-700">
                Total Struk: {formatRupiah(summary.grandTotal)}
              </span>
            </div>

            {bill.items.length === 0 ? (
              <div className="mt-4 p-5 rounded-2xl border border-dashed border-slate-200 text-center text-xs text-slate-400">
                Tagihan ini menggunakan mode Bagi Rata tanpa rincian item menu.
              </div>
            ) : (
              <div className="mt-3 divide-y divide-slate-100">
                {bill.items.map((item) => {
                  const fullLinePrice = Math.max(0, item.qty) * Math.max(0, item.unitPrice);
                  const validIds = (item.assignedTo || []).filter((id) =>
                    bill.participants.some((p) => p.id === id)
                  );
                  const targetIds =
                    validIds.length > 0
                      ? validIds
                      : bill.participants.map((p) => p.id);
                  const assignedNames = targetIds
                    .map(
                      (id) => bill.participants.find((p) => p.id === id)?.name || ''
                    )
                    .filter(Boolean);
                  const perPersonShare = Math.round(
                    fullLinePrice / Math.max(1, targetIds.length)
                  );

                  return (
                    <div
                      key={item.id}
                      className="py-3.5 flex flex-col sm:flex-row sm:items-start justify-between gap-2"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-sm font-bold text-slate-900">
                            {item.name}
                          </span>
                          <span className="text-xs font-mono tabular-nums text-slate-500">
                            ({item.qty} × {formatRupiah(item.unitPrice)})
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 mt-1">
                          {targetIds.length > 1 ? (
                            <span>
                              Patungan <strong>{targetIds.length} orang</strong> ({assignedNames.join(', ')}) →{' '}
                              <span className="font-mono tabular-nums font-bold text-[#00AED6]">
                                {formatRupiah(perPersonShare)} / orang
                              </span>
                            </span>
                          ) : (
                            <span>
                              Dipesan oleh{' '}
                              <strong>{assignedNames[0] || '1 orang'}</strong>
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex sm:flex-col items-center sm:items-end justify-between bg-slate-50 sm:bg-transparent px-3 py-1.5 sm:p-0 rounded-xl shrink-0">
                        <span className="text-[11px] text-slate-400 block">
                          Harga Sebelum Bagi
                        </span>
                        <span className="text-sm font-extrabold font-mono tabular-nums text-slate-900">
                          {formatRupiah(fullLinePrice)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Full Receipt Subtotal + Tax + Discount Summary */}
            <div className="mt-4 pt-4 border-t border-dashed border-slate-200 space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal Seluruh Menu (Sebelum Pajak)</span>
                <span className="font-mono tabular-nums font-bold text-slate-900">
                  {formatRupiah(summary.rawSubtotal)}
                </span>
              </div>
              {summary.computedTax > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>Total Pajak Struk (PB1 / PPN)</span>
                  <span className="font-mono tabular-nums">
                    +{formatRupiah(summary.computedTax)}
                  </span>
                </div>
              )}
              {summary.computedService > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>Total Biaya Layanan</span>
                  <span className="font-mono tabular-nums">
                    +{formatRupiah(summary.computedService)}
                  </span>
                </div>
              )}
              {summary.computedDelivery > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>Total Ongkir / Kemasan</span>
                  <span className="font-mono tabular-nums">
                    +{formatRupiah(summary.computedDelivery)}
                  </span>
                </div>
              )}
              {summary.computedDiscount > 0 && (
                <div className="flex justify-between text-[#00880D] font-semibold">
                  <span>Total Potongan Diskon / Promo</span>
                  <span className="font-mono tabular-nums">
                    -{formatRupiah(summary.computedDiscount)}
                  </span>
                </div>
              )}
              <div className="pt-2 border-t border-slate-100 flex justify-between text-sm font-extrabold text-slate-900">
                <span>Total Bersih Seluruh Struk</span>
                <span className="font-mono tabular-nums">
                  {formatRupiah(summary.grandTotal)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (5 cols): QRIS & Payment Methods + Confirmation */}
        <div
          className={`${
            mobileSection === 'full_receipt' ? 'hidden lg:block' : 'block'
          } lg:col-span-5 space-y-5 sm:space-y-6`}
        >
          {/* Payment Methods & Custom QRIS Card */}
          <div className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-6 shadow-2xs">
            <h2 className="text-sm sm:text-base font-extrabold text-slate-900 font-display">
              2. Bayar ke {bill.creatorName || 'Pembuat Split Bill'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Pindai QRIS atau salin nomor rekening / e-wallet di bawah ini
            </p>

            {enabledChannels.length === 0 ? (
              <div className="mt-4 p-5 rounded-2xl border border-dashed border-slate-200 text-center text-xs text-slate-400">
                Pembuat tagihan belum menambahkan gambar QRIS atau nomor rekening.
              </div>
            ) : (
              <div className="mt-4 space-y-2.5">
                {enabledChannels.map((channel) => {
                  const isQris = channel.provider === 'QRIS';
                  const isWallet = ['OVO', 'DANA', 'ShopeePay'].includes(
                    channel.provider
                  );
                  return (
                    <div
                      key={channel.id}
                      className="p-3.5 rounded-2xl border border-slate-200 flex items-center justify-between gap-3 bg-slate-50/50"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-800 shrink-0">
                          {isQris ? (
                            <QrCode className="w-5 h-5 text-[#00AED6]" />
                          ) : isWallet ? (
                            <Wallet className="w-5 h-5 text-[#00AED6]" />
                          ) : (
                            <Building2 className="w-5 h-5 text-slate-700" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-extrabold text-slate-900 truncate">
                            {channel.provider} · a.n. {channel.accountHolder}
                          </div>
                          <div className="text-xs sm:text-sm font-mono tabular-nums font-bold text-slate-800 truncate mt-0.5">
                            {channel.accountNumber}
                          </div>
                        </div>
                      </div>

                      {isQris ? (
                        <button
                          type="button"
                          onClick={() => setShowQrisModal(!showQrisModal)}
                          className="min-h-[38px] px-3.5 py-2 rounded-full bg-[#00AED6] hover:bg-[#0099BD] text-white text-xs font-extrabold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
                        >
                          <QrCode className="w-3.5 h-3.5" />
                          {showQrisModal ? 'Tutup' : 'Buka QRIS'}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            handleCopy(
                              channel.accountNumber.replace(/[^0-9]/g, ''),
                              `ch-${channel.id}`
                            )
                          }
                          className="min-h-[38px] px-3.5 py-2 rounded-full border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
                        >
                          {copiedField === `ch-${channel.id}` ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-[#00880D]" />
                              Disalin
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              Salin
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Creator's Uploaded Custom QRIS Image */}
            {showQrisModal &&
              enabledChannels.some((c) => c.provider === 'QRIS') &&
              (() => {
                const qrisChannel = enabledChannels.find(
                  (c) => c.provider === 'QRIS'
                );
                const customQrisUrl = qrisChannel?.qrisImageUrl;

                return (
                  <div className="mt-4 p-4 sm:p-5 rounded-2xl border border-slate-200 bg-white text-center">
                    <div className="text-xs font-extrabold text-slate-900">
                      QRIS ·{' '}
                      {(
                        qrisChannel?.accountHolder ||
                        bill.creatorName ||
                        'Penerima'
                      ).toUpperCase()}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      Nominal Bayar:{' '}
                      <span className="font-mono font-extrabold text-[#00880D]">
                        {formatRupiah(transferAmount)}
                      </span>
                    </div>

                    {customQrisUrl ? (
                      <div className="my-3.5">
                        <div className="mx-auto max-w-[240px] p-2.5 bg-white border border-slate-200 rounded-2xl shadow-2xs">
                          <img
                            src={customQrisUrl}
                            alt={`QRIS ${
                              qrisChannel?.accountHolder || bill.creatorName
                            }`}
                            referrerPolicy="no-referrer"
                            className="w-full h-auto max-h-64 object-contain rounded-xl mx-auto"
                          />
                        </div>
                        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                          <a
                            href={customQrisUrl}
                            download={`QRIS-${(
                              qrisChannel?.accountHolder ||
                              bill.creatorName ||
                              'SplitBill'
                            ).replace(/\s+/g, '-')}.jpg`}
                            className="min-h-[40px] px-4 py-2 rounded-full bg-[#00AED6] hover:bg-[#0099BD] text-white text-xs font-extrabold inline-flex items-center gap-1.5 transition-colors"
                          >
                            <QrCode className="w-3.5 h-3.5" />
                            Unduh QRIS
                          </a>
                          <button
                            type="button"
                            onClick={() =>
                              handleCopy(String(transferAmount), 'qris-nominal')
                            }
                            className="min-h-[40px] px-4 py-2 rounded-full border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold inline-flex items-center gap-1.5 transition-colors"
                          >
                            {copiedField === 'qris-nominal' ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-[#00880D]" />
                                Nominal Disalin
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                Salin Nominal
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="my-4 p-5 rounded-2xl border border-dashed border-slate-200 text-xs text-slate-500">
                        Pembuat Split Bill belum mengunggah file gambar QRIS.
                      </div>
                    )}
                  </div>
                );
              })()}
          </div>

          {/* Payment Status Confirmation & Upload Proof Box */}
          <div className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-6 shadow-2xs">
            <h2 className="text-sm sm:text-base font-extrabold text-slate-900 font-display">
              3. Konfirmasi Pembayaran ({activeBreakdown.participant.name})
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Pilih metode bayar dan lampirkan bukti transfer agar status kamu berubah menjadi Lunas
            </p>

            <div className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Dibayar Pakai Apa?
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    'QRIS',
                    'BCA',
                    'SeaBank',
                    'Mandiri',
                    'BRI',
                    'BNI',
                    'OVO',
                    'DANA',
                    'Tunai',
                  ].map((method) => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setSelectedVia(method)}
                      className={`min-h-[36px] px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors whitespace-nowrap ${
                        selectedVia === method
                          ? 'bg-[#00AED6] text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {method}
                    </button>
                  ))}
                </div>
              </div>

              {/* Upload Proof Screenshot / Reference Number */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Bukti Transfer & No. Referensi (Opsional)
                </label>
                <input
                  ref={proofFileRef}
                  type="file"
                  accept="image/*"
                  onChange={handleProofFileChange}
                  className="hidden"
                />
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={proofRefNumber}
                    onChange={(e) => setProofRefNumber(e.target.value)}
                    placeholder="Nomor referensi transaksi"
                    className="flex-1 min-h-[42px] px-3.5 py-2 rounded-2xl border border-slate-300 text-xs font-mono text-slate-800 focus:border-[#00AED6] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => proofFileRef.current?.click()}
                    className="min-h-[42px] px-4 py-2 rounded-full border border-slate-300 bg-slate-50 hover:bg-slate-100 text-xs font-bold text-slate-700 flex items-center gap-1.5 transition-colors whitespace-nowrap"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    {proofPreview ? 'Ganti Foto' : 'Upload Bukti'}
                  </button>
                </div>

                {proofPreview && (
                  <div className="mt-2.5 p-2.5 rounded-2xl border border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <img
                        src={proofPreview}
                        alt="Pratinjau bukti transfer"
                        referrerPolicy="no-referrer"
                        className="w-10 h-10 rounded-lg object-cover border border-slate-200 shrink-0"
                      />
                      <div className="min-w-0">
                        <span className="text-xs font-bold text-slate-800 block truncate">
                          Bukti Transfer Terlampir
                        </span>
                        <span className="text-[11px] font-mono text-slate-500 block">
                          Ref: {proofRefNumber || '-'}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setProofPreview(undefined)}
                      className="text-xs text-slate-400 hover:text-red-600 px-2 py-1"
                    >
                      Hapus
                    </button>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Catatan Tambahan (Opsional)
                </label>
                <input
                  type="text"
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                  placeholder="Tulis catatan untuk pembuat tagihan..."
                  className="w-full min-h-[42px] px-3.5 py-2 rounded-2xl border border-slate-300 text-xs text-slate-800 focus:border-[#00AED6] focus:outline-none"
                />
              </div>

              {activeBreakdown.participant.status === 'paid' ? (
                <div className="p-4 rounded-2xl bg-[#00880D]/[0.06] border border-[#00880D]/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[#00880D] font-extrabold text-sm">
                      <CheckCircle2 className="w-5 h-5" />
                      <span>Bagian Kamu Sudah Lunas!</span>
                    </div>
                    <span className="text-xs font-mono text-slate-600">
                      via {activeBreakdown.participant.paidVia || 'Transfer'}
                    </span>
                  </div>
                  {activeBreakdown.participant.paidNote && (
                    <p className="text-xs text-slate-600">
                      Catatan: “{activeBreakdown.participant.paidNote}”
                    </p>
                  )}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowReceiptProofModal(true)}
                      className="min-h-[42px] flex-1 py-2.5 px-4 rounded-full bg-[#00880D] hover:bg-[#00700B] text-white text-xs font-extrabold flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <FileCheck2 className="w-4 h-4" />
                      Buka Struk Bukti Lunas
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onUpdatePaymentStatus(
                          activeBreakdown.participant.id,
                          'unpaid',
                          selectedVia,
                          paymentNote
                        )
                      }
                      className="min-h-[42px] py-2.5 px-4 rounded-full border border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 transition-colors"
                    >
                      Batalkan
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    onUpdatePaymentStatus(
                      activeBreakdown.participant.id,
                      'paid',
                      selectedVia,
                      paymentNote,
                      proofPreview,
                      proofRefNumber || 'SB-' + Date.now().toString().slice(-8)
                    );
                    setShowReceiptProofModal(true);
                  }}
                  className="w-full min-h-[48px] py-3 px-5 rounded-full bg-[#00880D] hover:bg-[#00700B] text-white font-extrabold text-sm flex items-center justify-center gap-2 transition-colors shadow-xs"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  Tandai Sudah Bayar {formatRupiah(transferAmount)}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Digital Paid Receipt Modal (Bottom Sheet on Mobile) */}
      {showReceiptProofModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-xs p-0 sm:p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-t-3xl sm:rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-xl max-h-[92vh] overflow-y-auto">
            <div className="w-10 h-1.5 bg-slate-200 rounded-full mx-auto mb-3 sm:hidden" />
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <div className="flex items-center gap-2 text-[#00880D] font-extrabold text-sm">
                <CheckCircle2 className="w-5 h-5" />
                <span>STRUK BUKTI LUNAS SPLIT BILL</span>
              </div>
              <button
                type="button"
                onClick={() => setShowReceiptProofModal(false)}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 text-center pb-4 border-b-2 border-dashed border-slate-200">
              <span className="text-xs text-slate-500 block">Nominal Dibayarkan</span>
              <span className="text-2xl font-extrabold font-mono tabular-nums text-slate-900 mt-1 block">
                {formatRupiah(transferAmount)}
              </span>
              <span className="text-xs text-[#00880D] font-bold mt-1 block">
                Status: Lunas · Metode: {activeBreakdown.participant.paidVia || selectedVia}
              </span>
            </div>

            <div className="mt-4 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Nama Anggota</span>
                <span className="font-bold text-slate-900">
                  {activeBreakdown.participant.name}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Tagihan</span>
                <span className="font-bold text-slate-900">{bill.title || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Subtotal Pesanan</span>
                <span className="font-mono tabular-nums text-slate-800">
                  {formatRupiah(activeBreakdown.subtotal)}
                </span>
              </div>
              {activeBreakdown.taxShare > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Pajak (PB1 / PPN)</span>
                  <span className="font-mono tabular-nums text-slate-800">
                    +{formatRupiah(activeBreakdown.taxShare)}
                  </span>
                </div>
              )}
              {activeBreakdown.serviceShare > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Biaya Layanan</span>
                  <span className="font-mono tabular-nums text-slate-800">
                    +{formatRupiah(activeBreakdown.serviceShare)}
                  </span>
                </div>
              )}
              {activeBreakdown.deliveryShare > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Ongkir / Kemasan</span>
                  <span className="font-mono tabular-nums text-slate-800">
                    +{formatRupiah(activeBreakdown.deliveryShare)}
                  </span>
                </div>
              )}
              {activeBreakdown.discountShare > 0 && (
                <div className="flex justify-between text-[#00880D]">
                  <span>Diskon / Promo</span>
                  <span className="font-mono tabular-nums font-bold">
                    -{formatRupiah(activeBreakdown.discountShare)}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-500">Penagih</span>
                <span className="font-bold text-slate-900">{bill.creatorName || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">No. Referensi</span>
                <span className="font-mono text-slate-800">
                  {activeBreakdown.participant.proofRefNumber ||
                    proofRefNumber ||
                    '-'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Waktu Konfirmasi</span>
                <span className="font-mono text-slate-800">
                  {activeBreakdown.participant.paidAt
                    ? new Date(activeBreakdown.participant.paidAt).toLocaleString('id-ID')
                    : new Date().toLocaleString('id-ID')}
                </span>
              </div>
            </div>

            {(activeBreakdown.participant.proofImageUrl || proofPreview) && (
              <div className="mt-4 pt-3 border-t border-slate-200">
                <span className="text-xs text-slate-500 block mb-2">
                  Lampiran Bukti Transfer:
                </span>
                <img
                  src={activeBreakdown.participant.proofImageUrl || proofPreview}
                  alt="Lampiran bukti transfer"
                  referrerPolicy="no-referrer"
                  className="max-h-44 mx-auto rounded-xl border border-slate-200 object-contain"
                />
              </div>
            )}

            <div className="mt-6 flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  handleCopy(
                    `BUKTI LUNAS SPLIT BILL\nTagihan: ${bill.title || '-'}\nNama: ${activeBreakdown.participant.name}\nNominal: ${formatRupiah(transferAmount)}\nMetode: ${
                      activeBreakdown.participant.paidVia || selectedVia
                    }\nStatus: LUNAS`,
                    'proof-text'
                  )
                }
                className="min-h-[44px] flex-1 py-2.5 px-4 rounded-full bg-[#00AED6] hover:bg-[#0099BD] text-white text-xs font-extrabold flex items-center justify-center gap-1.5 transition-colors"
              >
                {copiedField === 'proof-text' ? (
                  <>
                    <Check className="w-4 h-4" />
                    Bukti Tersalin
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Salin Teks Bukti Lunas
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => setShowReceiptProofModal(false)}
                className="min-h-[44px] py-2.5 px-4 rounded-full border border-slate-300 hover:bg-slate-50 text-xs font-bold text-slate-700"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

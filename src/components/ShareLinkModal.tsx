import React, { useState } from 'react';
import { Copy, Check, X, ExternalLink, MessageSquareShare, Link2 } from 'lucide-react';
import { SplitBill, BillCalculationSummary } from '../types';
import { buildShareablePaymentLink, formatRupiah } from '../utils/splitCalculator';

interface ShareLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  bill: SplitBill;
  summary: BillCalculationSummary;
  onOpenPreviewPortal: (participantId?: string) => void;
}

export const ShareLinkModal: React.FC<ShareLinkModalProps> = ({
  isOpen,
  onClose,
  bill,
  summary,
  onOpenPreviewPortal,
}) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [selectedParticipantId, setSelectedParticipantId] = useState<string>('all');

  if (!isOpen) return null;

  const activeLink = buildShareablePaymentLink(
    bill,
    selectedParticipantId === 'all' ? undefined : selectedParticipantId
  );

  const primaryChannel =
    bill.paymentChannels.find((c) => c.enabled) || bill.paymentChannels[0];

  const generateChatMessage = () => {
    const lines: string[] = [];
    lines.push(`*SPLIT BILL — ${(bill.title || 'TAGIHAN').toUpperCase()}*`);
    lines.push(`Tanggal: ${bill.date} · Oleh: ${bill.creatorName || 'Pembuat Tagihan'}`);
    lines.push(`Total Tagihan: *${formatRupiah(summary.grandTotal)}*`);
    lines.push('');
    lines.push('*Rincian Tagihan Masing-Masing:*');
    summary.participantBreakdowns.forEach((b) => {
      const statusText = b.participant.status === 'paid' ? '✓ Lunas' : 'Belum Bayar';
      const detailParts: string[] = [];
      if (
        b.taxShare > 0 ||
        b.serviceShare > 0 ||
        b.deliveryShare > 0 ||
        b.discountShare > 0
      ) {
        detailParts.push(`Pesanan ${formatRupiah(b.subtotal)}`);
        if (b.taxShare > 0) detailParts.push(`+ Pajak ${formatRupiah(b.taxShare)}`);
        if (b.serviceShare > 0)
          detailParts.push(`+ Layanan ${formatRupiah(b.serviceShare)}`);
        if (b.deliveryShare > 0)
          detailParts.push(`+ Ongkir ${formatRupiah(b.deliveryShare)}`);
        if (b.discountShare > 0)
          detailParts.push(`- Diskon ${formatRupiah(b.discountShare)}`);
      }
      const breakdownSuffix =
        detailParts.length > 0 ? ` [${detailParts.join(' ')}]` : '';
      lines.push(
        `• *${b.participant.name}*: *${formatRupiah(b.finalTotal)}*${breakdownSuffix} (${statusText})`
      );
    });
    lines.push('');
    if (primaryChannel) {
      lines.push(
        `Pembayaran via *${primaryChannel.provider}*: ${primaryChannel.accountNumber} (a.n. ${primaryChannel.accountHolder})`
      );
    }
    lines.push('');
    lines.push('Cek rincian menu kamu & konfirmasi pembayaran langsung di link ini:');
    lines.push(activeLink);
    return lines.join('\n');
  };

  const handleCopy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2200);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2200);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-xs p-0 sm:p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-t-3xl sm:rounded-3xl max-w-xl w-full p-5 sm:p-6 shadow-xl max-h-[92vh] overflow-y-auto">
        <div className="w-10 h-1.5 bg-slate-200 rounded-full mx-auto mb-3 sm:hidden" />
        <div className="flex items-center justify-between pb-3.5 border-b border-slate-200">
          <div>
            <h2 className="text-base sm:text-lg font-extrabold text-slate-900 font-display">
              Bagikan Link Pembayaran Otomatis
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Teman yang membuka link dapat melihat rincian pesanannya & menandai lunas
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-full text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            aria-label="Tutup modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-4 space-y-4">
          {/* Target Friend Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Pilih Target Link Pembayaran
            </label>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setSelectedParticipantId('all')}
                className={`min-h-[36px] px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors whitespace-nowrap ${
                  selectedParticipantId === 'all'
                    ? 'bg-[#00AED6] text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Semua Teman (Link Grup)
              </button>
              {summary.participantBreakdowns.map((b) => (
                <button
                  key={b.participant.id}
                  type="button"
                  onClick={() => setSelectedParticipantId(b.participant.id)}
                  className={`min-h-[36px] px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors whitespace-nowrap ${
                    selectedParticipantId === b.participant.id
                      ? 'bg-[#00880D] text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Khusus {b.participant.name} ({formatRupiah(b.finalTotal)})
                </button>
              ))}
            </div>
          </div>

          {/* Direct Shareable Link Box */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
              <span className="flex items-center gap-1.5 font-bold text-slate-700">
                <Link2 className="w-3.5 h-3.5 text-[#00880D]" />
                Link Tagihan Interaktif
              </span>
              <span className="text-[11px]">Tersimpan otomatis</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={activeLink}
                className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-mono text-slate-700 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => handleCopy(activeLink, 'link')}
                className="min-h-[42px] px-4 py-2 rounded-full bg-[#00880D] hover:bg-[#00700B] text-white text-xs font-extrabold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
              >
                {copiedKey === 'link' ? (
                  <>
                    <Check className="w-4 h-4" />
                    Tersalin
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Salin Link
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Formatted WhatsApp / Group Message */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <MessageSquareShare className="w-3.5 h-3.5 text-slate-600" />
                Format Pesan Siap Kirim (WhatsApp / Line / Telegram)
              </label>
              <button
                type="button"
                onClick={() => handleCopy(generateChatMessage(), 'chat')}
                className="text-xs font-extrabold text-[#00880D] hover:underline flex items-center gap-1"
              >
                {copiedKey === 'chat' ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    Pesan Tersalin!
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Salin Teks
                  </>
                )}
              </button>
            </div>
            <textarea
              readOnly
              rows={7}
              value={generateChatMessage()}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs font-mono text-slate-700 focus:outline-none"
            />
          </div>

          <div className="pt-1 flex flex-col sm:flex-row items-center justify-between gap-2.5">
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenPreviewPortal(
                  selectedParticipantId === 'all' ? undefined : selectedParticipantId
                );
              }}
              className="w-full sm:w-auto min-h-[44px] px-4 py-2.5 rounded-full border border-slate-300 hover:bg-slate-50 text-slate-800 text-xs font-bold flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
            >
              <ExternalLink className="w-4 h-4" />
              Buka Tampilan Link Bayar
            </button>
            <button
              type="button"
              onClick={() => handleCopy(generateChatMessage(), 'chat-btn')}
              className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 rounded-full bg-[#00AED6] hover:bg-[#0099BD] text-white text-xs font-extrabold flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
            >
              {copiedKey === 'chat-btn' ? (
                <>
                  <Check className="w-4 h-4" />
                  Teks & Link Berhasil Disalin
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  Salin Pesan + Link Pembayaran
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

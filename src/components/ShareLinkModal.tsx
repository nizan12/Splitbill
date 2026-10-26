import React, { useState, useEffect } from 'react';
import {
  Copy,
  Check,
  X,
  ExternalLink,
  MessageSquareShare,
  Link2,
  Send,
  Sparkles,
} from 'lucide-react';
import { SplitBill, BillCalculationSummary } from '../types';
import {
  buildShareablePaymentLink,
  formatRupiah,
} from '../utils/splitCalculator';

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

  // Immediate base direct link (e.g. https://domain/?pay=sb-123&p=p-1)
  const directLink = buildShareablePaymentLink(
    bill,
    selectedParticipantId === 'all' ? undefined : selectedParticipantId,
    false
  );

  const displayLink = directLink;

  // Make sure the bill is saved to backend when opening share modal
  useEffect(() => {
    if (!isOpen) return;
    fetch('/api/bills', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bill),
    }).catch(() => {});
  }, [isOpen, bill]);

  if (!isOpen) return null;

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
    lines.push(displayLink || directLink);
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

  const handleOpenWhatsApp = () => {
    const text = generateChatMessage();
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-xs p-0 sm:p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-t-3xl sm:rounded-3xl max-w-xl w-full p-5 sm:p-6 shadow-xl max-h-[92vh] overflow-y-auto">
        <div className="w-10 h-1.5 bg-slate-200 rounded-full mx-auto mb-3 sm:hidden" />
        
        <div className="flex items-center justify-between pb-3.5 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900 font-display">
                Bagikan Link Pembayaran
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#00880D]/10 text-[#00880D] flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                Resmi Patungans
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Teman yang membuka link dapat melihat rincian pesanannya & konfirmasi pembayaran
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
                  className={`min-h-[36px] px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors max-w-full ${
                    selectedParticipantId === b.participant.id
                      ? 'bg-[#00880D] text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                  title={`Khusus ${b.participant.name} (${formatRupiah(b.finalTotal)})`}
                >
                  <span className="truncate block">
                    Khusus {b.participant.name} ({formatRupiah(b.finalTotal)})
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Direct Link Box */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
              <span className="flex items-center gap-1.5 font-bold text-slate-700">
                <Link2 className="w-3.5 h-3.5 text-[#00880D]" />
                Link Pembayaran Siap Kirim
              </span>
              <span className="text-[11px] font-mono text-slate-500">
                {displayLink.length} karakter
              </span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={displayLink}
                className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-mono text-slate-700 focus:outline-none select-all"
              />
              <button
                type="button"
                onClick={() => handleCopy(displayLink, 'link')}
                className="min-h-[42px] px-4 py-2 rounded-full bg-[#00880D] hover:bg-[#00700B] text-white text-xs font-extrabold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 shadow-xs active:scale-[0.98]"
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

          {/* Actions Bar */}
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
              onClick={handleOpenWhatsApp}
              className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 rounded-full bg-[#00880D] hover:bg-[#00700B] text-white text-xs font-extrabold flex items-center justify-center gap-2 transition-all whitespace-nowrap shadow-xs active:scale-[0.98]"
            >
              <Send className="w-4 h-4" />
              Kirim ke WhatsApp
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

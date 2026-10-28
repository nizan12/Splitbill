import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  Download,
  Copy,
  Check,
  RefreshCw,
  Info,
  MapPin,
} from 'lucide-react';
import type { PaymentChannel } from '../types';
import { formatRupiah } from '../utils/splitCalculator';
import {
  decodeQRFromImage,
  generateDynamicQRIS,
  parseQRIS,
  isQRISString,
  type QRISData,
} from '../utils/qris';

interface DynamicQRISCardProps {
  qrisChannel: PaymentChannel;
  transferAmount: number;
  participantName: string;
  creatorName?: string;
  onCopy: (text: string, field: string) => void;
  copiedField: string | null;
}

export const DynamicQRISCard: React.FC<DynamicQRISCardProps> = ({
  qrisChannel,
  transferAmount,
  participantName,
  creatorName,
  onCopy,
  copiedField,
}) => {
  const [activeTab, setActiveTab] = useState<'dynamic' | 'static'>('dynamic');
  const [dynamicQrUrl, setDynamicQrUrl] = useState<string | null>(null);
  const [dynamicQrisString, setDynamicQrisString] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(true);
  const [detectedMerchant, setDetectedMerchant] = useState<string | null>(null);
  const [parseDetails, setParseDetails] = useState<QRISData | null>(null);
  const [decodeError, setDecodeError] = useState<string | null>(null);

  const customQrisUrl = qrisChannel.qrisImageUrl;

  useEffect(() => {
    let isCancelled = false;

    async function resolveQRIS() {
      setIsProcessing(true);
      setDecodeError(null);

      let stringToConvert = qrisChannel.qrisRawString || null;

      if (!stringToConvert && customQrisUrl) {
        try {
          const decoded = await decodeQRFromImage(customQrisUrl);
          if (decoded && isQRISString(decoded)) {
            stringToConvert = decoded;
          } else if (decoded) {
            stringToConvert = decoded;
          }
        } catch (err: any) {
          console.warn('Gagal membaca QR dari gambar:', err);
        }
      }

      if (isCancelled) return;

      if (!stringToConvert) {
        setIsProcessing(false);
        setDecodeError(
          'Gambar QRIS belum terdeteksi string EMVCo. Menampilkan QRIS statis bawaan.'
        );
        setActiveTab('static');
        return;
      }

      try {
        try {
          const parsed = parseQRIS(stringToConvert);
          if (!isCancelled) {
            setParseDetails(parsed);
            if (parsed.merchantName) {
              setDetectedMerchant(parsed.merchantName);
            }
          }
        } catch {
          // ignore parse preview error
        }

        const targetAmount = Math.max(1, Math.round(transferAmount));
        const { dynamicQrisString: dynStr, qrDataUrl } =
          await generateDynamicQRIS(stringToConvert, targetAmount, {
            width: 480,
          });

        if (!isCancelled) {
          setDynamicQrisString(dynStr);
          setDynamicQrUrl(qrDataUrl);
          setActiveTab('dynamic');
        }
      } catch (err: any) {
        console.warn('Gagal convert QRIS dinamis:', err);
        if (!isCancelled) {
          setDecodeError('Gagal membuat QRIS dinamis. Menggunakan QRIS statis.');
          setActiveTab('static');
        }
      } finally {
        if (!isCancelled) {
          setIsProcessing(false);
        }
      }
    }

    resolveQRIS();

    return () => {
      isCancelled = true;
    };
  }, [qrisChannel.qrisRawString, customQrisUrl, transferAmount]);

  const merchantDisplayName =
    detectedMerchant ||
    parseDetails?.merchantName ||
    qrisChannel.accountHolder ||
    creatorName ||
    'Penerima';

  const downloadFilename = `QRIS-${participantName.replace(/\s+/g, '-')}-${transferAmount}.png`;
  const isDynamicMode = activeTab === 'dynamic' && Boolean(dynamicQrUrl);

  return (
    <div className="mt-4 rounded-2xl glass-card overflow-hidden shadow-md">
      {/* Top Bar: Official-style QRIS Mark & Mode Switcher */}
      <div className="px-4 py-3 bg-white/40 border-b border-white/50 backdrop-blur-xs flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {/* Crisp Typographic QRIS Badge */}
          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-900 text-white select-none">
            <span className="text-[11px] font-black tracking-tighter leading-none font-display">
              QRIS
            </span>
            <span className="w-1 h-1 rounded-full bg-rose-500" />
          </div>
          <span className="text-[11px] font-medium text-slate-500 hidden sm:inline">
            Standar Pembayaran Nasional
          </span>
        </div>

        {/* Clean Segmented Control with Smooth Sliding Pill */}
        {dynamicQrUrl && customQrisUrl && (
          <div className="glass-tabs-track p-0.5 rounded-lg text-[11px] font-semibold inline-flex relative">
            <button
              type="button"
              onClick={() => setActiveTab('dynamic')}
              className={`relative px-2.5 py-1 rounded-md transition-colors ${
                activeTab === 'dynamic'
                  ? 'text-slate-900 font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {activeTab === 'dynamic' && (
                <motion.div
                  layoutId="qris-mode-pill"
                  className="glass-tab-pill-white"
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}
              <span className="relative z-10">Otomatis</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('static')}
              className={`relative px-2.5 py-1 rounded-md transition-colors ${
                activeTab === 'static'
                  ? 'text-slate-900 font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {activeTab === 'static' && (
                <motion.div
                  layoutId="qris-mode-pill"
                  className="glass-tab-pill-white"
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}
              <span className="relative z-10">QR Asli</span>
            </button>
          </div>
        )}
      </div>

      <div className="p-4 sm:p-5">
        {/* Merchant Identity */}
        <div className="text-center">
          <h3 className="text-sm sm:text-base font-extrabold text-slate-900 tracking-tight font-display">
            {merchantDisplayName.toUpperCase()}
          </h3>
          {parseDetails?.merchantCity && (
            <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-slate-400 font-medium">
              <MapPin className="w-3 h-3 text-slate-300" />
              <span>{parseDetails.merchantCity}</span>
            </p>
          )}
        </div>

        {/* Clean QR Standee Frame */}
        <div className="my-4 flex flex-col items-center">
          {isProcessing ? (
            <div className="w-full max-w-[240px] aspect-square flex flex-col items-center justify-center gap-2.5 bg-white/40 rounded-2xl border border-white/60">
              <RefreshCw className="w-5 h-5 text-slate-400 animate-spin" />
              <span className="text-xs text-slate-400 font-medium">
                Memuat kode QR...
              </span>
            </div>
          ) : isDynamicMode && dynamicQrUrl ? (
            <div className="relative p-3.5 bg-white rounded-2xl border border-white/80 shadow-[0_4px_20px_-6px_rgba(15,23,42,0.08)]">
              {/* Subtle Corner Viewfinder Accents */}
              <div className="pointer-events-none absolute top-2 left-2 w-3.5 h-3.5 border-t-2 border-l-2 border-slate-300 rounded-tl-md" />
              <div className="pointer-events-none absolute top-2 right-2 w-3.5 h-3.5 border-t-2 border-r-2 border-slate-300 rounded-tr-md" />
              <div className="pointer-events-none absolute bottom-2 left-2 w-3.5 h-3.5 border-b-2 border-l-2 border-slate-300 rounded-bl-md" />
              <div className="pointer-events-none absolute bottom-2 right-2 w-3.5 h-3.5 border-b-2 border-r-2 border-slate-300 rounded-br-md" />

              <img
                src={dynamicQrUrl}
                alt={`QRIS ${merchantDisplayName} - ${formatRupiah(transferAmount)}`}
                className="w-56 h-56 sm:w-60 sm:h-60 object-contain mx-auto block"
              />
            </div>
          ) : customQrisUrl ? (
            <div className="p-3 bg-white rounded-2xl border border-white/80 shadow-[0_4px_20px_-6px_rgba(15,23,42,0.08)]">
              <img
                src={customQrisUrl}
                alt={`QRIS ${merchantDisplayName}`}
                referrerPolicy="no-referrer"
                className="w-56 max-h-64 object-contain rounded-lg mx-auto block"
              />
            </div>
          ) : (
            <div className="w-full py-8 px-4 rounded-2xl border border-dashed border-white/60 bg-white/20 text-center text-xs text-slate-400">
              Pembuat Split Bill belum mengunggah gambar QRIS.
            </div>
          )}
        </div>

        {/* Amount Summary Box (Tactile Receipt Strip) */}
        <div className="rounded-xl bg-white/60 border border-white/70 px-3.5 py-3 flex items-center justify-between gap-3 backdrop-blur-xs">
          <div className="text-left min-w-0">
            <div className="flex items-center gap-1.5">
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  isDynamicMode ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
              />
              <span className="text-[11px] font-semibold text-slate-500 truncate">
                {isDynamicMode
                  ? 'Nominal otomatis saat di-scan'
                  : 'Ketik nominal manual saat scan'}
              </span>
            </div>
            <div className="text-base sm:text-lg font-extrabold font-mono tabular-nums text-slate-900 mt-0.5">
              {formatRupiah(transferAmount)}
            </div>
          </div>

          <button
            type="button"
            onClick={() => onCopy(String(transferAmount), 'qris-nominal')}
            className="glass-button-standard shrink-0 h-8 px-3 rounded-lg text-slate-700 text-xs font-semibold inline-flex items-center gap-1.5"
          >
            {copiedField === 'qris-nominal' ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-700">Tersalin</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-400" />
                <span>Salin</span>
              </>
            )}
          </button>
        </div>

        {/* Primary Action Buttons */}
        <div className="mt-3 flex items-center gap-2">
          {isDynamicMode && dynamicQrUrl ? (
            <a
              href={dynamicQrUrl}
              download={downloadFilename}
              className="glass-button-prominent flex-1 h-10 px-4 rounded-xl text-white text-xs font-bold inline-flex items-center justify-center gap-2"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Simpan Gambar QR</span>
            </a>
          ) : customQrisUrl ? (
            <a
              href={customQrisUrl}
              download={`QRIS-${merchantDisplayName.replace(/\s+/g, '-')}.jpg`}
              className="glass-button-prominent flex-1 h-10 px-4 rounded-xl text-white text-xs font-bold inline-flex items-center justify-center gap-2"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Simpan Gambar QR</span>
            </a>
          ) : null}

          {dynamicQrisString && (
            <button
              type="button"
              onClick={() => onCopy(dynamicQrisString, 'qris-string')}
              className="glass-button-standard h-10 px-3.5 rounded-xl text-slate-700 text-xs font-semibold inline-flex items-center justify-center gap-1.5 shrink-0"
              title="Salin kode mentah QRIS"
            >
              {copiedField === 'qris-string' ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700">Kode Tersalin</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-400" />
                  <span>Kode QR</span>
                </>
              )}
            </button>
          )}
        </div>

        {/* Subtle Footer Info */}
        <p className="mt-3 text-center text-[11px] text-slate-400 leading-relaxed">
          Bisa di-scan langsung atau unggah dari galeri lewat BCA, Livin&apos;, BRImo, GoPay, OVO, DANA, &amp; ShopeePay.
        </p>

        {/* Notice if fallback */}
        {decodeError && (
          <div className="mt-3 p-2.5 rounded-xl bg-amber-50/80 border border-amber-200/70 text-left text-[11px] text-amber-800 flex items-start gap-2">
            <Info className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
            <span>
              {decodeError} Anda tetap bisa membayar dengan menyalin nominal di atas.
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

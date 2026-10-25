import React, { useState, useEffect, useRef } from 'react';
import {
  QrCode,
  Download,
  Copy,
  Check,
  Zap,
  Sparkles,
  RefreshCw,
  Info,
  ShieldCheck,
  AlertCircle,
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
  const [rawQris, setRawQris] = useState<string | null>(
    qrisChannel.qrisRawString || null
  );

  const customQrisUrl = qrisChannel.qrisImageUrl;

  // Resolve raw QR string: either from channel or decoded from image
  useEffect(() => {
    let isCancelled = false;

    async function resolveQRIS() {
      setIsProcessing(true);
      setDecodeError(null);

      let stringToConvert = qrisChannel.qrisRawString || null;

      // If we don't have raw string, try to decode from image
      if (!stringToConvert && customQrisUrl) {
        try {
          const decoded = await decodeQRFromImage(customQrisUrl);
          if (decoded && isQRISString(decoded)) {
            stringToConvert = decoded;
            if (!isCancelled) {
              setRawQris(decoded);
            }
          } else if (decoded) {
            // Found a QR code but not Indonesian QRIS standard
            stringToConvert = decoded;
            if (!isCancelled) {
              setRawQris(decoded);
            }
          }
        } catch (err: any) {
          console.warn('Gagal membaca QR dari gambar:', err);
        }
      }

      if (isCancelled) return;

      if (!stringToConvert) {
        // Cannot convert to dynamic QRIS, fallback to static
        setIsProcessing(false);
        setDecodeError(
          'Gambar QRIS belum terdeteksi string EMVCo. Menampilkan QRIS statis bawaan.'
        );
        setActiveTab('static');
        return;
      }

      try {
        // Parse metadata (merchant name, city, etc.)
        try {
          const parsed = parseQRIS(stringToConvert);
          if (!isCancelled) {
            setParseDetails(parsed);
            if (parsed.merchantName) {
              setDetectedMerchant(parsed.merchantName);
            }
          }
        } catch {
          // parse preview error ignored
        }

        // Generate dynamic QRIS with exact transferAmount
        const targetAmount = Math.max(1, Math.round(transferAmount));
        const { dynamicQrisString: dynStr, qrDataUrl } =
          await generateDynamicQRIS(stringToConvert, targetAmount, {
            width: 360,
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

  const downloadFilename = `QRIS-Dinamis-${participantName.replace(/\s+/g, '-')}-${formatRupiah(transferAmount).replace(/\s+/g, '')}.png`;

  return (
    <div className="mt-4 p-4 sm:p-5 rounded-3xl border border-slate-200/90 bg-white text-center shadow-xs">
      {/* Merchant Header Badge */}
      <div className="flex flex-col items-center justify-center gap-1">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-[11px] font-bold">
          <ShieldCheck className="w-3.5 h-3.5 text-[#00880D]" />
          <span>QRIS STANDAR NASIONAL (GPN / BI)</span>
        </div>
        <div className="text-base font-extrabold text-slate-900 mt-1">
          {merchantDisplayName.toUpperCase()}
        </div>
        {parseDetails?.merchantCity && (
          <div className="text-[11px] text-slate-400 font-medium">
            Kota: {parseDetails.merchantCity}
          </div>
        )}
      </div>

      {/* Mode Switcher Tab (if dynamic QR is available) */}
      {dynamicQrUrl && customQrisUrl && (
        <div className="mt-3.5 inline-flex p-1 rounded-2xl bg-slate-100 border border-slate-200/80 text-xs font-bold max-w-full">
          <button
            type="button"
            onClick={() => setActiveTab('dynamic')}
            className={`px-3.5 py-1.5 rounded-xl transition-all flex items-center gap-1.5 ${
              activeTab === 'dynamic'
                ? 'bg-[#00880D] text-white shadow-xs font-extrabold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>QRIS Dinamis ({formatRupiah(transferAmount)})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('static')}
            className={`px-3.5 py-1.5 rounded-xl transition-all ${
              activeTab === 'static'
                ? 'bg-white text-slate-900 shadow-xs font-extrabold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>QRIS Asli (Statis)</span>
          </button>
        </div>
      )}

      {/* Dynamic Amount Highlight Banner */}
      {activeTab === 'dynamic' && dynamicQrUrl ? (
        <div className="mt-3 p-3 rounded-2xl bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border border-emerald-200/80 text-left sm:text-center">
          <div className="flex items-center justify-between sm:justify-center gap-2">
            <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-emerald-800 uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              Nominal Terkunci Otomatis
            </span>
            <span className="text-base sm:text-lg font-extrabold font-mono text-emerald-700">
              {formatRupiah(transferAmount)}
            </span>
          </div>
          <p className="text-[11px] text-emerald-700/90 mt-1 leading-snug">
            Tinggal scan dengan BCA, Mandiri, GoPay, OVO, DANA, ShopeePay.
            Nominal <strong>{formatRupiah(transferAmount)}</strong> langsung
            terisi otomatis tanpa perlu diketik!
          </p>
        </div>
      ) : (
        <div className="text-xs text-slate-500 mt-2">
          Nominal Bayar:{' '}
          <span className="font-mono font-extrabold text-[#00880D]">
            {formatRupiah(transferAmount)}
          </span>
        </div>
      )}

      {/* Main QR Code Render Area */}
      <div className="my-4">
        {isProcessing ? (
          <div className="mx-auto max-w-[260px] h-64 flex flex-col items-center justify-center gap-2 bg-slate-50 rounded-2xl border border-slate-200">
            <RefreshCw className="w-6 h-6 text-[#00AED6] animate-spin" />
            <span className="text-xs text-slate-500 font-medium">
              Menyiapkan QRIS Dinamis...
            </span>
          </div>
        ) : activeTab === 'dynamic' && dynamicQrUrl ? (
          <div className="mx-auto max-w-[270px] p-3.5 bg-white border-2 border-emerald-500/40 rounded-3xl shadow-sm hover:border-emerald-500 transition-colors">
            <div className="relative">
              <img
                src={dynamicQrUrl}
                alt={`QRIS Dinamis ${merchantDisplayName} - ${formatRupiah(transferAmount)}`}
                className="w-full h-auto aspect-square object-contain rounded-2xl mx-auto"
              />
              <div className="absolute top-1 left-1 bg-emerald-600 text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded-full shadow-xs flex items-center gap-0.5">
                <Zap className="w-2.5 h-2.5" />
                <span>DINAMIS</span>
              </div>
            </div>
            <div className="mt-2 text-[10px] text-slate-400 font-mono font-bold tracking-tight">
              {formatRupiah(transferAmount)} · {participantName}
            </div>
          </div>
        ) : customQrisUrl ? (
          <div className="mx-auto max-w-[260px] p-3 bg-white border border-slate-200 rounded-2xl shadow-2xs">
            <img
              src={customQrisUrl}
              alt={`QRIS ${merchantDisplayName}`}
              referrerPolicy="no-referrer"
              className="w-full h-auto max-h-64 object-contain rounded-xl mx-auto"
            />
          </div>
        ) : (
          <div className="my-4 p-5 rounded-2xl border border-dashed border-slate-200 text-xs text-slate-500">
            Pembuat Split Bill belum mengunggah file gambar QRIS.
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-3.5 flex flex-wrap items-center justify-center gap-2">
          {activeTab === 'dynamic' && dynamicQrUrl ? (
            <a
              href={dynamicQrUrl}
              download={downloadFilename}
              className="min-h-[42px] px-4 py-2 rounded-full bg-[#00880D] hover:bg-[#00700B] text-white text-xs font-extrabold inline-flex items-center gap-1.5 transition-colors shadow-2xs"
            >
              <Download className="w-3.5 h-3.5" />
              Unduh QRIS Dinamis
            </a>
          ) : customQrisUrl ? (
            <a
              href={customQrisUrl}
              download={`QRIS-${merchantDisplayName.replace(/\s+/g, '-')}.jpg`}
              className="min-h-[42px] px-4 py-2 rounded-full bg-[#00AED6] hover:bg-[#0099BD] text-white text-xs font-extrabold inline-flex items-center gap-1.5 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Unduh QRIS Asli
            </a>
          ) : null}

          <button
            type="button"
            onClick={() => onCopy(String(transferAmount), 'qris-nominal')}
            className="min-h-[42px] px-4 py-2 rounded-full border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold inline-flex items-center gap-1.5 transition-colors"
          >
            {copiedField === 'qris-nominal' ? (
              <>
                <Check className="w-3.5 h-3.5 text-[#00880D]" />
                Nominal Disalin
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                Salin Nominal ({formatRupiah(transferAmount)})
              </>
            )}
          </button>

          {dynamicQrisString && (
            <button
              type="button"
              onClick={() => onCopy(dynamicQrisString, 'qris-string')}
              className="min-h-[42px] px-3.5 py-2 rounded-full border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 text-[11px] font-semibold inline-flex items-center gap-1.5 transition-colors"
              title="Salin string kode QRIS untuk aplikasi tertentu"
            >
              {copiedField === 'qris-string' ? (
                <>
                  <Check className="w-3.5 h-3.5 text-[#00880D]" />
                  String QRIS Disalin
                </>
              ) : (
                <>
                  <QrCode className="w-3.5 h-3.5" />
                  Salin String QRIS
                </>
              )}
            </button>
          )}
        </div>

        {/* Small Notice */}
        {decodeError && (
          <div className="mt-3 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-left text-[11px] text-amber-800 flex items-start gap-2">
            <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span>
              {decodeError} Anda tetap bisa membayar dengan menyalin nominal di atas.
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

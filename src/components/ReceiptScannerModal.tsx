import React, { useState, useRef } from 'react';
import { Upload, FileText, Sparkles, X, Check, AlertCircle, Loader2 } from 'lucide-react';
import { formatRupiah, compressImageToDataUrl } from '../utils/splitCalculator';

interface ScannedReceiptResult {
  title: string;
  category: string;
  items: Array<{ name: string; qty: number; unitPrice: number }>;
  taxAmount: number;
  serviceAmount: number;
  deliveryAmount: number;
  discountAmount: number;
}

interface ReceiptScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyReceipt: (receipt: ScannedReceiptResult) => void;
}

export const ReceiptScannerModal: React.FC<ReceiptScannerModalProps> = ({
  isOpen,
  onClose,
  onApplyReceipt,
}) => {
  const [activeTab, setActiveTab] = useState<'image' | 'text'>('image');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageMimeType, setImageMimeType] = useState<string>('image/jpeg');
  const [rawText, setRawText] = useState<string>('');
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scannedResult, setScannedResult] = useState<ScannedReceiptResult | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const runScanRequest = async (payload: {
    imageBase64?: string | null;
    mimeType?: string;
    rawText?: string;
  }) => {
    setError(null);
    setIsScanning(true);

    try {
      const response = await fetch('/api/scan-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok || data.error) {
        throw new Error(data.error || 'Gagal membaca struk.');
      }

      setScannedResult(data.receipt);
    } catch (err: any) {
      setError(
        err?.message ||
          'Terjadi kendala saat memindai struk. Silakan coba lagi atau periksa koneksi.'
      );
    } finally {
      setIsScanning(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setScannedResult(null);

    try {
      const compressedDataUrl = await compressImageToDataUrl(file, 900, 0.8);
      setImagePreview(compressedDataUrl);
      setImageMimeType('image/jpeg');
      const base64Part = compressedDataUrl.split(',')[1] || '';
      setImageBase64(base64Part);
      if (base64Part) {
        await runScanRequest({ imageBase64: base64Part, mimeType: 'image/jpeg' });
      }
    } catch {
      const reader = new FileReader();
      reader.onload = async () => {
        const dataUrl = reader.result as string;
        setImagePreview(dataUrl);
        const mime = file.type || 'image/jpeg';
        setImageMimeType(mime);
        const base64Part = dataUrl.split(',')[1] || '';
        setImageBase64(base64Part);
        if (base64Part) {
          await runScanRequest({ imageBase64: base64Part, mimeType: mime });
        }
      };
      reader.readAsDataURL(file);
    } finally {
      e.target.value = '';
    }
  };

  const handleScan = async () => {
    const payload =
      activeTab === 'image'
        ? { imageBase64, mimeType: imageMimeType }
        : { rawText };
    await runScanRequest(payload);
  };

  const handleConfirmApply = () => {
    if (!scannedResult) return;
    onApplyReceipt(scannedResult);
    setScannedResult(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-xs p-0 sm:p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-t-3xl sm:rounded-3xl max-w-2xl w-full p-5 sm:p-6 shadow-xl max-h-[92vh] overflow-y-auto">
        <div className="w-10 h-1.5 bg-slate-200 rounded-full mx-auto mb-3 sm:hidden" />
        <div className="flex items-center justify-between pb-3.5 border-b border-slate-200">
          <div>
            <h2 className="text-base sm:text-lg font-extrabold text-slate-900 font-display">
              Scan Struk Otomatis
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Unggah foto struk atau tempel teks pesanan untuk mengekstrak menu & pajak otomatis
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

        {/* Mode Switcher */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-2xl mt-4">
          <button
            type="button"
            onClick={() => {
              setActiveTab('image');
              setError(null);
            }}
            className={`min-h-[40px] flex-1 py-2 px-3 text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap ${
              activeTab === 'image'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Upload className="w-4 h-4" />
            Unggah Foto Struk
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('text');
              setError(null);
            }}
            className={`min-h-[40px] flex-1 py-2 px-3 text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap ${
              activeTab === 'text'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText className="w-4 h-4" />
            Tempel Teks Struk
          </button>
        </div>

        <div className="mt-4">
          {activeTab === 'image' ? (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
              {!imagePreview ? (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full border-2 border-dashed border-slate-300 hover:border-[#00AED6] rounded-2xl p-6 sm:p-8 text-center transition-colors bg-slate-50/60 hover:bg-[#00AED6]/[0.03]"
                >
                  <div className="w-12 h-12 rounded-2xl bg-[#00AED6]/10 text-[#00AED6] flex items-center justify-center mx-auto mb-3">
                    <Upload className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-bold text-slate-900">
                    Ketuk untuk ambil atau pilih foto struk
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Mendukung foto kamera HP, JPG, PNG, atau screenshot pesanan
                  </p>
                </button>
              ) : (
                <div className="space-y-3">
                  <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-950 max-h-56 flex items-center justify-center">
                    <img
                      src={imagePreview}
                      alt="Pratinjau foto struk"
                      referrerPolicy="no-referrer"
                      className="max-h-52 w-auto object-contain"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setImagePreview(null);
                        setImageBase64(null);
                        setScannedResult(null);
                      }}
                      className="min-h-[36px] absolute top-3 right-3 px-3.5 py-1.5 bg-slate-900/80 text-white text-xs font-bold rounded-full hover:bg-slate-900 transition-colors"
                    >
                      Ganti Foto
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700">
                Tempel rincian teks pesanan atau struk di bawah ini:
              </label>
              <textarea
                rows={6}
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder="Tempel teks struk makan atau daftar pesanan beserta harganya di sini..."
                className="w-full rounded-2xl border border-slate-300 bg-slate-50 p-3.5 text-xs font-mono text-slate-800 focus:border-[#00AED6] focus:bg-white focus:outline-none"
              />
            </div>
          )}

          {error && (
            <div className="mt-4 p-3.5 rounded-2xl bg-red-50 border border-red-200 flex items-start gap-2.5 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Action button to trigger OCR */}
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              disabled={
                isScanning ||
                (activeTab === 'image' && !imageBase64) ||
                (activeTab === 'text' && !rawText.trim())
              }
              onClick={handleScan}
              className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 rounded-full bg-[#00880D] hover:bg-[#00700B] disabled:bg-slate-200 disabled:text-slate-400 text-white font-extrabold text-xs flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
            >
              {isScanning ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Mengekstrak Rincian Struk...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Ekstrak Menu & Pajak Otomatis
                </>
              )}
            </button>
          </div>

          {/* Preview of Scanned Receipt */}
          {scannedResult && (
            <div className="mt-5 pt-4 border-t border-slate-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-3">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">
                    Hasil Ekstraksi: {scannedResult.title || 'Struk Tagihan'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Kategori: {scannedResult.category} · {scannedResult.items.length} menu terdeteksi
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleConfirmApply}
                  className="min-h-[42px] px-4 py-2 rounded-full bg-[#00AED6] hover:bg-[#0099BD] text-white text-xs font-extrabold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
                >
                  <Check className="w-4 h-4" />
                  Terapkan ke Tagihan
                </button>
              </div>

              <div className="border border-slate-200 rounded-2xl overflow-hidden">
                <div className="divide-y divide-slate-100 max-h-56 overflow-y-auto">
                  {scannedResult.items.map((it, idx) => (
                    <div
                      key={idx}
                      className="p-3 flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 truncate">
                          {it.name}
                        </div>
                        <div className="font-mono tabular-nums text-slate-500">
                          {it.qty} × {formatRupiah(it.unitPrice)}
                        </div>
                      </div>
                      <div className="font-mono tabular-nums font-extrabold text-slate-900 shrink-0">
                        {formatRupiah(it.qty * it.unitPrice)}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="bg-slate-50 p-3 border-t border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div>
                    <span className="text-slate-500 block">Pajak PB1/PPN</span>
                    <span className="font-mono tabular-nums font-bold text-slate-800">
                      {formatRupiah(scannedResult.taxAmount)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Biaya Layanan</span>
                    <span className="font-mono tabular-nums font-bold text-slate-800">
                      {formatRupiah(scannedResult.serviceAmount)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Ongkos Kirim</span>
                    <span className="font-mono tabular-nums font-bold text-slate-800">
                      {formatRupiah(scannedResult.deliveryAmount)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Diskon Promo</span>
                    <span className="font-mono tabular-nums font-bold text-[#00880D]">
                      -{formatRupiah(scannedResult.discountAmount)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

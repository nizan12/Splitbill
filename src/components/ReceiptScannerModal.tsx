import React, { useState, useRef } from 'react';
import { motion } from 'motion/react';
import {
  Upload,
  FileText,
  Sparkles,
  X,
  Check,
  AlertCircle,
  Loader2,
  Plus,
  Image as ImageIcon,
  Trash2,
} from 'lucide-react';
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

interface UploadedImageItem {
  id: string;
  preview: string;
  base64: string;
  mimeType: string;
  name: string;
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
  const [images, setImages] = useState<UploadedImageItem[]>([]);
  const [isCompressing, setIsCompressing] = useState<boolean>(false);
  const [rawText, setRawText] = useState<string>('');
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scannedResult, setScannedResult] = useState<ScannedReceiptResult | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setError(null);
    setScannedResult(null);
    setIsCompressing(true);

    const newItems: UploadedImageItem[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const compressed = await compressImageToDataUrl(file, 800, 0.72);
        const base64 = compressed.split(',')[1] || '';
        newItems.push({
          id: `${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
          preview: compressed,
          base64,
          mimeType: 'image/jpeg',
          name: file.name || `Foto Struk ${images.length + i + 1}`,
        });
      } catch {
        // Fallback FileReader
        await new Promise<void>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => {
            const dataUrl = reader.result as string;
            const base64 = dataUrl.split(',')[1] || '';
            newItems.push({
              id: `${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
              preview: dataUrl,
              base64,
              mimeType: file.type || 'image/jpeg',
              name: file.name || `Foto Struk ${images.length + i + 1}`,
            });
            resolve();
          };
          reader.onerror = () => resolve();
          reader.readAsDataURL(file);
        });
      }
    }

    setImages((prev) => [...prev, ...newItems]);
    setIsCompressing(false);
    e.target.value = '';
  };

  const handleRemoveImage = (id: string) => {
    setImages((prev) => prev.filter((img) => img.id !== id));
    setScannedResult(null);
  };

  const handleClearAllImages = () => {
    setImages([]);
    setScannedResult(null);
    setError(null);
  };

  const handleScan = async () => {
    setError(null);
    setIsScanning(true);

    try {
      const payload: {
        images?: Array<{ imageBase64: string; mimeType: string }>;
        rawText?: string;
      } = {};

      if (activeTab === 'image') {
        if (images.length === 0) {
          throw new Error('Harap unggah minimal 1 foto struk.');
        }
        payload.images = images.map((img) => ({
          imageBase64: img.base64,
          mimeType: img.mimeType,
        }));
      } else {
        if (!rawText.trim()) {
          throw new Error('Harap masukkan atau tempel teks struk.');
        }
        payload.rawText = rawText.trim();
      }

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

  const handleConfirmApply = () => {
    if (!scannedResult) return;
    onApplyReceipt(scannedResult);
    setScannedResult(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-md p-0 sm:p-4 overflow-y-auto">
      <div className="glass-modal rounded-t-3xl sm:rounded-3xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl max-h-[92vh] overflow-y-auto">
        <div className="w-10 h-1.5 bg-slate-300/80 rounded-full mx-auto mb-3 sm:hidden" />

        <div className="flex items-center justify-between pb-3.5 border-b border-white/40">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900 font-display">
                Scan Struk Otomatis
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Bisa unggah lebih dari satu foto untuk struk panjang bersambung atau beberapa struk sekaligus
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="glass-button-standard min-h-[38px] min-w-[38px] flex items-center justify-center rounded-full text-slate-500 hover:text-slate-800 transition-colors"
            aria-label="Tutup modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Switcher with Smooth Sliding Pill */}
        <div className="glass-tabs-track p-1 rounded-2xl flex items-center gap-1 mt-4 relative">
          <button
            type="button"
            onClick={() => {
              setActiveTab('image');
              setError(null);
            }}
            className={`relative min-h-[38px] flex-1 py-2 px-3 text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap ${
              activeTab === 'image'
                ? 'text-slate-900 font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {activeTab === 'image' && (
              <motion.div
                layoutId="scanner-tab-pill"
                className="glass-tab-pill-white"
                transition={{ type: 'spring', stiffness: 500, damping: 35 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-1.5">
              <Upload className="w-4 h-4" />
              <span>Foto Struk ({images.length})</span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('text');
              setError(null);
            }}
            className={`relative min-h-[38px] flex-1 py-2 px-3 text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap ${
              activeTab === 'text'
                ? 'text-slate-900 font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {activeTab === 'text' && (
              <motion.div
                layoutId="scanner-tab-pill"
                className="glass-tab-pill-white"
                transition={{ type: 'spring', stiffness: 500, damping: 35 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-1.5">
              <FileText className="w-4 h-4" />
              <span>Tempel Teks</span>
            </span>
          </button>
        </div>

        <div className="mt-4">
          {activeTab === 'image' ? (
            <div>
              {/* Hidden file input with 'multiple' enabled */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileChange}
                className="hidden"
              />

              {images.length === 0 ? (
                <button
                  type="button"
                  disabled={isCompressing}
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full border-2 border-dashed border-white/60 hover:border-[#00AED6] rounded-2xl p-6 sm:p-8 text-center transition-all glass-card hover:bg-[#00AED6]/[0.04]"
                >
                  <div className="w-12 h-12 rounded-2xl bg-[#00AED6]/10 text-[#00AED6] flex items-center justify-center mx-auto mb-3">
                    {isCompressing ? (
                      <Loader2 className="w-6 h-6 animate-spin" />
                    ) : (
                      <Upload className="w-6 h-6" />
                    )}
                  </div>
                  <p className="text-sm font-bold text-slate-900">
                    {isCompressing
                      ? 'Sedang memproses foto...'
                      : 'Ketuk untuk pilih 1 atau beberapa foto struk'}
                  </p>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    Mendukung foto kamera langsung, screenshot, atau struk panjang yang difoto bersambung (bisa pilih banyak gambar sekaligus)
                  </p>
                </button>
              ) : (
                <div className="space-y-3">
                  {/* Gallery Grid of Uploaded Receipt Photos */}
                  <div className="flex items-center justify-between pb-1">
                    <span className="text-xs font-bold text-slate-700">
                      Foto Terpilih ({images.length} foto)
                    </span>
                    <button
                      type="button"
                      onClick={handleClearAllImages}
                      className="text-xs font-semibold text-red-600 hover:text-red-700 flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Hapus Semua
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {images.map((img, index) => (
                      <div
                        key={img.id}
                        className="relative group rounded-2xl overflow-hidden glass-card aspect-4/3 flex items-center justify-center shadow-sm"
                      >
                        <img
                          src={img.preview}
                          alt={`Struk bagian ${index + 1}`}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover group-hover:opacity-90 transition-opacity"
                        />
                        <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-slate-900/80 backdrop-blur-xs text-[10px] font-bold text-white shadow-xs">
                          Bagian {index + 1}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveImage(img.id)}
                          className="min-h-[30px] min-w-[30px] absolute top-2 right-2 flex items-center justify-center rounded-full bg-red-600 text-white hover:bg-red-700 transition-colors shadow-xs"
                          title="Hapus foto ini"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}

                    {/* Add More Photos Button */}
                    <button
                      type="button"
                      disabled={isCompressing}
                      onClick={() => fileInputRef.current?.click()}
                      className="rounded-2xl border-2 border-dashed border-white/60 hover:border-[#00AED6] glass-card hover:bg-[#00AED6]/[0.04] aspect-4/3 flex flex-col items-center justify-center p-3 text-center transition-all group"
                    >
                      <div className="w-9 h-9 rounded-full bg-[#00AED6]/10 text-[#00AED6] flex items-center justify-center mb-1 group-hover:scale-105 transition-transform">
                        {isCompressing ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Plus className="w-4 h-4" />
                        )}
                      </div>
                      <span className="text-xs font-bold text-slate-800">
                        Tambah Foto
                      </span>
                      <span className="text-[10px] text-slate-500">
                        Halaman berikutnya
                      </span>
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
                className="glass-input w-full rounded-2xl p-3.5 text-xs font-mono text-slate-800 focus:outline-none"
              />
            </div>
          )}

          {error && (
            <div className="mt-4 p-3.5 rounded-2xl bg-red-50/80 border border-red-200/80 backdrop-blur-xs flex items-start gap-2.5 text-xs text-red-700">
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
                isCompressing ||
                (activeTab === 'image' && images.length === 0) ||
                (activeTab === 'text' && !rawText.trim())
              }
              onClick={handleScan}
              className="glass-button-success w-full sm:w-auto min-h-[44px] px-6 py-2.5 rounded-full disabled:opacity-50 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-md"
            >
              {isScanning ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>
                    Mengekstrak {images.length > 1 ? `${images.length} Foto` : ''} dengan AI...
                  </span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>
                    {images.length > 1
                      ? `Ekstrak ${images.length} Foto Struk Sekaligus`
                      : 'Ekstrak Menu & Pajak Otomatis'}
                  </span>
                </>
              )}
            </button>
          </div>

          {/* Preview of Scanned Receipt */}
          {scannedResult && (
            <div className="mt-5 pt-4 border-t border-white/40">
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
                  className="glass-button-prominent min-h-[42px] px-5 py-2 rounded-full text-white text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-md active:scale-[0.98]"
                >
                  <Check className="w-4 h-4" />
                  Terapkan ke Tagihan
                </button>
              </div>

              <div className="glass-card rounded-2xl overflow-hidden shadow-sm">
                <div className="divide-y divide-white/40 max-h-56 overflow-y-auto">
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
                <div className="bg-white/40 p-3.5 border-t border-white/40 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs backdrop-blur-xs">
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

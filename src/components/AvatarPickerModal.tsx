import React, { useState, useEffect } from 'react';
import {
  X,
  Check,
  Dices,
  Sparkles,
  User as UserIcon,
  RotateCcw,
} from 'lucide-react';
import {
  AVATAR_STYLES,
  AVATAR_PRESETS,
  getRandomAvatarId,
  generateRandomSeed,
  getAvatarUrl,
  getAvatarInfo,
} from '../data/avatars';

interface AvatarPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentAvatarUrl?: string;
  originalGooglePhotoUrl?: string;
  title?: string;
  subtitle?: string;
  onSelectAvatar: (avatarUrl: string) => void;
}

export const AvatarPickerModal: React.FC<AvatarPickerModalProps> = ({
  isOpen,
  onClose,
  currentAvatarUrl,
  originalGooglePhotoUrl,
  title = 'Ganti Avatar Profil',
  subtitle = 'Pilih karakter unik favoritmu untuk profil di Patungans',
  onSelectAvatar,
}) => {
  const [selectedStyle, setSelectedStyle] = useState<string>('all');
  const [selectedAvatarId, setSelectedAvatarId] = useState<string>(
    currentAvatarUrl || 'pixelbot:Alpha'
  );

  useEffect(() => {
    if (isOpen) {
      setSelectedAvatarId(currentAvatarUrl || 'pixelbot:Alpha');
    }
  }, [isOpen, currentAvatarUrl]);

  if (!isOpen) return null;

  const currentPreviewUrl = getAvatarUrl(selectedAvatarId);
  const currentInfo = getAvatarInfo(selectedAvatarId);

  const filteredPresets =
    selectedStyle === 'all'
      ? AVATAR_PRESETS
      : AVATAR_PRESETS.filter((p) => p.group === selectedStyle);

  const handleRandomize = () => {
    const randomId = getRandomAvatarId(selectedStyle);
    setSelectedAvatarId(randomId);
  };

  const handleSurpriseSeed = () => {
    const newSeed = generateRandomSeed(
      selectedStyle === 'all' ? 'pixelbot' : selectedStyle
    );
    setSelectedAvatarId(newSeed);
  };

  const handleConfirm = () => {
    onSelectAvatar(currentPreviewUrl);
    onClose();
  };

  const handleRestoreGooglePhoto = () => {
    if (originalGooglePhotoUrl) {
      onSelectAvatar(originalGooglePhotoUrl);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-xs p-0 sm:p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-t-3xl sm:rounded-3xl max-w-2xl w-full p-4 sm:p-6 shadow-2xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Mobile drag handle */}
        <div className="w-10 h-1.5 bg-slate-200 rounded-full mx-auto mb-2 sm:hidden shrink-0" />

        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-slate-200 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900 font-display">
                {title}
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#00AED6]/10 text-[#00AED6] flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                DiceBear 10.x
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            aria-label="Tutup modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Active Selection Hero Banner */}
        <div className="mt-3.5 p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-slate-50 via-cyan-50/40 to-emerald-50/40 border border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative shrink-0">
              <img
                src={currentPreviewUrl}
                alt={currentInfo.label}
                referrerPolicy="no-referrer"
                className="w-16 h-16 sm:w-18 sm:h-18 rounded-2xl bg-white border-2 border-[#00AED6] p-1 shadow-xs object-contain"
              />
              <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#00880D] text-white flex items-center justify-center text-[10px] font-bold shadow-xs">
                ✓
              </span>
            </div>
            <div className="min-w-0">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Avatar Terpilih
              </span>
              <div className="text-sm sm:text-base font-extrabold text-slate-900 truncate">
                {currentInfo.label}
              </div>
              <span className="text-xs text-slate-500 block truncate">
                Gaya: <strong className="capitalize">{currentInfo.style}</strong>
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-end sm:items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleRandomize}
              className="min-h-[38px] px-3.5 py-1.5 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 flex items-center gap-1.5 transition-colors shadow-2xs"
              title="Pilih karakter acak dari daftar"
            >
              <Dices className="w-4 h-4 text-[#00AED6]" />
              <span className="hidden sm:inline">Acak Preset</span>
            </button>
            <button
              type="button"
              onClick={handleSurpriseSeed}
              className="min-h-[38px] px-3.5 py-1.5 rounded-full bg-[#00AED6]/10 hover:bg-[#00AED6]/20 text-[#00AED6] text-xs font-bold flex items-center gap-1.5 transition-colors"
              title="Buat variasi karakter unik baru"
            >
              <Sparkles className="w-4 h-4" />
              <span>Surprise</span>
            </button>
          </div>
        </div>

        {/* Style Filter Strip (Horizontal Scroll) */}
        <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1 shrink-0 -mx-1 px-1">
          {AVATAR_STYLES.map((style) => (
            <button
              key={style.id}
              type="button"
              onClick={() => setSelectedStyle(style.id)}
              className={`min-h-[34px] px-3 py-1 rounded-full text-xs font-bold transition-colors whitespace-nowrap shrink-0 ${
                selectedStyle === style.id
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              {style.label}
            </button>
          ))}
        </div>

        {/* Avatar Grid (Scrollable) */}
        <div className="mt-3 overflow-y-auto flex-1 min-h-[220px] max-h-[380px] pr-1">
          <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2 sm:gap-2.5">
            {filteredPresets.map((preset) => {
              const url = getAvatarUrl(preset.id);
              const isSelected =
                selectedAvatarId === preset.id ||
                currentPreviewUrl === url;

              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setSelectedAvatarId(preset.id)}
                  className={`group relative p-2 rounded-2xl border-2 transition-all flex flex-col items-center gap-1 text-center ${
                    isSelected
                      ? 'border-[#00AED6] bg-[#00AED6]/[0.08] ring-2 ring-[#00AED6]/20'
                      : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50'
                  }`}
                >
                  <img
                    src={url}
                    alt={preset.label}
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    className="w-12 h-12 sm:w-14 sm:h-14 object-contain transition-transform group-hover:scale-105"
                  />
                  <span className="text-[11px] font-bold text-slate-700 truncate w-full block">
                    {preset.name}
                  </span>
                  {isSelected && (
                    <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-[#00880D] text-white flex items-center justify-center text-[9px] font-extrabold shadow-2xs">
                      <Check className="w-3 h-3" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="mt-4 pt-3 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2.5 shrink-0">
          <div>
            {originalGooglePhotoUrl && (
              <button
                type="button"
                onClick={handleRestoreGooglePhoto}
                className="text-xs font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1.5 transition-colors py-1"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Gunakan Foto Asli Akun Google</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-initial min-h-[42px] px-4 py-2 rounded-full border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700 transition-colors"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="flex-1 sm:flex-initial min-h-[42px] px-6 py-2 rounded-full bg-[#00880D] hover:bg-[#00700B] text-white text-xs font-extrabold flex items-center justify-center gap-1.5 transition-colors shadow-xs active:scale-[0.98]"
            >
              <Check className="w-4 h-4" />
              <span>Gunakan Avatar Ini</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

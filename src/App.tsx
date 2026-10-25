import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Plus,
  Trash2,
  Share2,
  Copy,
  Check,
  Sparkles,
  ExternalLink,
  FilePlus2,
  Send,
  FileCheck2,
  Upload,
  QrCode,
  LogOut,
  ShieldCheck,
  Receipt,
  Users,
  Wallet,
  History,
} from 'lucide-react';
import {
  SplitBill,
  Participant,
  BillItem,
  PaymentChannel,
  PaymentStatus,
} from './types';
import { createEmptyBill } from './data/presets';
import {
  calculateSplitBill,
  formatRupiah,
  buildShareablePaymentLink,
  decodeBillFromUrlParam,
  compressImageToDataUrl,
} from './utils/splitCalculator';
import { ReceiptScannerModal } from './components/ReceiptScannerModal';
import { ShareLinkModal } from './components/ShareLinkModal';
import { FriendPaymentPortal } from './components/FriendPaymentPortal';
import {
  auth,
  onAuthStateChanged,
  signInWithGoogle,
  logoutGoogle,
  syncUserProfileToFirestore,
  syncBillMetadataToFirestore,
  deleteBillFromFirestore,
  User,
} from './firebase';

const BASE_STORAGE_KEY = 'patunganpay_bills_clean_v2';

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

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const storageKey = currentUser
    ? `${BASE_STORAGE_KEY}_${currentUser.uid}`
    : `${BASE_STORAGE_KEY}_guest`;

  // Riwayat starts empty until user logs in with Google or creates a bill while logged in
  const [savedBills, setSavedBills] = useState<SplitBill[]>([]);
  const [activeBill, setActiveBill] = useState<SplitBill>(() => createEmptyBill());
  const [viewMode, setViewMode] = useState<'editor' | 'saved' | 'portal'>('editor');
  // Mobile sub-panel inside editor so thumb users don't have to scroll 2500px
  const [mobileEditorTab, setMobileEditorTab] = useState<'input' | 'summary'>('input');
  const [portalParticipantId, setPortalParticipantId] = useState<
    string | undefined
  >(undefined);

  // Modals
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);

  // Form inputs
  const [newFriendName, setNewFriendName] = useState('');
  const [newFriendPhone, setNewFriendPhone] = useState('');
  const [newItemName, setNewItemName] = useState('');
  const [newItemQty, setNewItemQty] = useState<number>(1);
  const [newItemPrice, setNewItemPrice] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // New Payment Channel inputs
  const [newChannelProvider, setNewChannelProvider] =
    useState<PaymentChannel['provider']>('QRIS');
  const [newChannelNumber, setNewChannelNumber] = useState('');
  const [newChannelHolder, setNewChannelHolder] = useState('');
  const [newChannelQrisImage, setNewChannelQrisImage] = useState<string | undefined>(
    undefined
  );
  const [showAddChannel, setShowAddChannel] = useState(false);

  // Hidden file input for uploading/replacing QRIS image
  const qrisUploadInputRef = useRef<HTMLInputElement>(null);
  const [uploadingQrisChannelId, setUploadingQrisChannelId] = useState<string | null>(
    null
  );

  // Listen to Firebase Google Auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setAuthLoading(false);

      if (user) {
        syncUserProfileToFirestore(user).catch(() => {});

        const params = new URLSearchParams(window.location.search);
        if (!params.get('pay')) {
          try {
            const userKey = `${BASE_STORAGE_KEY}_${user.uid}`;
            const raw = localStorage.getItem(userKey);
            if (raw) {
              const parsed = JSON.parse(raw);
              if (Array.isArray(parsed) && parsed.length > 0) {
                setSavedBills(parsed);
                setActiveBill(parsed[0]);
                return;
              }
            }
          } catch {
            // ignore
          }
        }

        setActiveBill((prev) => ({
          ...prev,
          ownerId: user.uid,
          ownerEmail: user.email || undefined,
          creatorName: prev.creatorName || user.displayName || '',
        }));
      }
    });

    return () => unsubscribe();
  }, []);

  const handleGoogleLogin = async () => {
    setAuthError(null);
    try {
      const user = await signInWithGoogle();
      if (user) {
        setActiveBill((prev) => ({
          ...prev,
          ownerId: user.uid,
          ownerEmail: user.email || undefined,
          creatorName: prev.creatorName || user.displayName || '',
        }));
      }
    } catch (err: any) {
      console.error('Google Sign-In Error:', err);
      const code = err?.code || '';
      const message = err?.message || '';

      if (code === 'auth/popup-closed-by-user') {
        // User closed popup deliberately
        return;
      }

      if (code === 'auth/unauthorized-domain' || message.includes('unauthorized-domain')) {
        const host = window.location.hostname;
        setAuthError(
          `Domain "${host}" belum diotorisasi di Firebase. Gunakan http://localhost:3000 atau tambahkan "${host}" di Firebase Console > Authentication > Settings > Authorized domains.`
        );
      } else if (code === 'auth/operation-not-allowed') {
        setAuthError(
          'Metode login Google belum diaktifkan di Firebase Console. Buka Authentication > Sign-in method > aktifkan Google.'
        );
      } else if (code === 'auth/popup-blocked') {
        setAuthError('Popup diblokir oleh browser. Silakan izinkan popup untuk situs ini.');
      } else {
        setAuthError(
          `Login Google gagal (${code || 'error'}): ${message || 'Silakan coba lagi.'}`
        );
      }
    }
  };

  const handleGoogleLogout = async () => {
    setAuthError(null);
    try {
      await logoutGoogle();
      const empty = createEmptyBill();
      setSavedBills([empty]);
      setActiveBill(empty);
      setViewMode('editor');
    } catch {
      // ignore
    }
  };

  // Detect shared payment link on initial page load (?pay=...&p=...&d=...)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const payBillId = params.get('pay');
    const participantParam = params.get('p') || undefined;
    const encodedData = params.get('d');

    if (payBillId) {
      let decodedFromUrl: SplitBill | null = null;
      if (encodedData) {
        decodedFromUrl = decodeBillFromUrlParam(encodedData);
        if (decodedFromUrl) {
          setActiveBill(decodedFromUrl);
          setPortalParticipantId(participantParam);
          setViewMode('portal');
        }
      }

      fetch(`/api/bills/${payBillId}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data?.bill) {
            setActiveBill(data.bill);
            setPortalParticipantId(participantParam);
            setViewMode('portal');
          } else if (decodedFromUrl) {
            fetch('/api/bills', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(decodedFromUrl),
            }).catch(() => {});
          }
        })
        .catch(() => {});
    }
  }, []);

  const summary = useMemo(() => calculateSplitBill(activeBill), [activeBill]);

  // Clear obsolete guest local storage on initial load
  useEffect(() => {
    try {
      localStorage.removeItem(`${BASE_STORAGE_KEY}_guest`);
    } catch {
      // ignore
    }
  }, []);

  // Sync activeBill into savedBills, localStorage, Express backend, and Firestore
  useEffect(() => {
    // If not logged in, do not clutter history with draft bills
    if (!currentUser) return;

    setSavedBills((prev) => {
      const exists = prev.some((b) => b.id === activeBill.id);
      const next = exists
        ? prev.map((b) => (b.id === activeBill.id ? activeBill : b))
        : [activeBill, ...prev];
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });

    const timer = setTimeout(() => {
      fetch('/api/bills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(activeBill),
      }).catch(() => {});

      if (currentUser && (!activeBill.ownerId || activeBill.ownerId === currentUser.uid)) {
        syncBillMetadataToFirestore({
          id: activeBill.id,
          ownerId: currentUser.uid,
          ownerEmail: currentUser.email || undefined,
          title: activeBill.title,
          category: activeBill.category,
          date: activeBill.date,
          creatorName: activeBill.creatorName || currentUser.displayName || '',
          grandTotal: summary.grandTotal,
          paidCount: summary.paidCount,
          participantCount: activeBill.participants.length,
        }).catch(() => {});
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [activeBill, currentUser, storageKey, summary.grandTotal, summary.paidCount]);

  const handleCopyText = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const buildFriendReminderText = (participantId: string): string => {
    const calc = summary.participantBreakdowns.find(
      (b) => b.participant.id === participantId
    );
    if (!calc) return '';
    const link = buildShareablePaymentLink(activeBill, participantId);
    const channel =
      activeBill.paymentChannels.find((c) => c.enabled) ||
      activeBill.paymentChannels[0];

    const itemLines = calc.items
      .map(
        (it) =>
          `- ${it.name}${
            it.sharedWithCount > 1
              ? ` (Harga asli ${formatRupiah(it.lineTotal)} ÷ ${
                  it.sharedWithCount
                } org)`
              : ''
          }: ${formatRupiah(it.shareAmount)}`
      )
      .join('\n');

    const extraLines = [
      calc.taxShare > 0 ||
      calc.serviceShare > 0 ||
      calc.deliveryShare > 0 ||
      calc.discountShare > 0
        ? `Subtotal Pesanan: ${formatRupiah(calc.subtotal)}`
        : '',
      calc.taxShare > 0 ? `+ Pajak (PB1/PPN): +${formatRupiah(calc.taxShare)}` : '',
      calc.serviceShare > 0
        ? `+ Biaya Layanan: +${formatRupiah(calc.serviceShare)}`
        : '',
      calc.deliveryShare > 0
        ? `+ Ongkir / Kemasan: +${formatRupiah(calc.deliveryShare)}`
        : '',
      calc.discountShare > 0
        ? `- Diskon / Promo: -${formatRupiah(calc.discountShare)}`
        : '',
    ]
      .filter(Boolean)
      .join('\n');

    return [
      `Halo *${calc.participant.name}*! Berikut rincian Split Bill *${
        activeBill.title || 'Tagihan'
      }* (${activeBill.date}):`,
      '',
      itemLines,
      extraLines,
      `Total Bagian Kamu: *${formatRupiah(calc.finalTotal)}*`,
      channel
        ? `Pembayaran via *${channel.provider}*: ${channel.accountNumber} (a.n. ${channel.accountHolder})`
        : '',
      '',
      `Lihat struk & konfirmasi pembayaran di link ini:\n${link}`,
    ]
      .filter(Boolean)
      .join('\n');
  };

  const handleCreateNewBill = () => {
    const freshBill = createEmptyBill();
    freshBill.creatorName =
      activeBill.creatorName || currentUser?.displayName || '';
    freshBill.ownerId = currentUser?.uid;
    freshBill.ownerEmail = currentUser?.email || undefined;
    freshBill.paymentChannels = activeBill.paymentChannels;
    setActiveBill(freshBill);
    setViewMode('editor');
    setMobileEditorTab('input');
  };

  const handleDeleteSavedBill = (billId: string) => {
    if (currentUser) {
      deleteBillFromFirestore(billId).catch(() => {});
    }
    setSavedBills((prev) => {
      const filtered = prev.filter((b) => b.id !== billId);
      try {
        localStorage.setItem(storageKey, JSON.stringify(filtered));
      } catch {
        // ignore
      }
      if (activeBill.id === billId) {
        setActiveBill(filtered[0] || createEmptyBill());
      }
      return filtered;
    });
  };

  // Add Participant
  const handleAddParticipant = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newFriendName.trim();
    if (!trimmed) return;

    const newParticipant: Participant = {
      id: 'p-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
      name: trimmed,
      phoneOrHandle: newFriendPhone.trim() || undefined,
      status: 'unpaid',
      equalPortions: 1,
    };

    setActiveBill((prev) => ({
      ...prev,
      participants: [...prev.participants, newParticipant],
    }));
    setNewFriendName('');
    setNewFriendPhone('');
  };

  const handleRemoveParticipant = (participantId: string) => {
    setActiveBill((prev) => ({
      ...prev,
      participants: prev.participants.filter((p) => p.id !== participantId),
      items: prev.items.map((item) => ({
        ...item,
        assignedTo: item.assignedTo.filter((id) => id !== participantId),
      })),
    }));
  };

  const handleUpdatePaymentStatus = (
    participantId: string,
    status: PaymentStatus,
    paidVia?: string,
    paidNote?: string,
    proofImageUrl?: string,
    proofRefNumber?: string
  ) => {
    setActiveBill((prev) => ({
      ...prev,
      participants: prev.participants.map((p) =>
        p.id === participantId
          ? {
              ...p,
              status,
              paidAt: status === 'paid' ? new Date().toISOString() : undefined,
              paidVia: paidVia || p.paidVia || 'Transfer',
              paidNote: paidNote !== undefined ? paidNote : p.paidNote,
              proofImageUrl:
                status === 'unpaid'
                  ? undefined
                  : proofImageUrl !== undefined
                  ? proofImageUrl
                  : p.proofImageUrl,
              proofRefNumber:
                status === 'unpaid'
                  ? undefined
                  : proofRefNumber !== undefined
                  ? proofRefNumber
                  : p.proofRefNumber,
            }
          : p
      ),
    }));

    fetch(`/api/bills/${activeBill.id}/pay`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        participantId,
        status,
        paidVia,
        paidNote,
        proofImageUrl,
        proofRefNumber,
        billSnapshot: activeBill,
      }),
    }).catch(() => {});
  };

  // Add Menu Item
  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newItemName.trim();
    const price = Number(newItemPrice.replace(/[^0-9]/g, ''));
    if (!name || isNaN(price) || price <= 0) return;

    const newItem: BillItem = {
      id: 'it-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
      name,
      qty: Math.max(1, Number(newItemQty) || 1),
      unitPrice: price,
      assignedTo: activeBill.participants.map((p) => p.id),
    };

    setActiveBill((prev) => ({
      ...prev,
      items: [...prev.items, newItem],
    }));
    setNewItemName('');
    setNewItemQty(1);
    setNewItemPrice('');
  };

  const handleToggleItemAssignee = (itemId: string, participantId: string) => {
    setActiveBill((prev) => ({
      ...prev,
      items: prev.items.map((item) => {
        if (item.id !== itemId) return item;
        const exists = item.assignedTo.includes(participantId);
        const nextAssigned = exists
          ? item.assignedTo.filter((id) => id !== participantId)
          : [...item.assignedTo, participantId];
        return {
          ...item,
          assignedTo: nextAssigned,
        };
      }),
    }));
  };

  const handleAssignAllToItem = (itemId: string) => {
    const allIds = activeBill.participants.map((p) => p.id);
    setActiveBill((prev) => ({
      ...prev,
      items: prev.items.map((item) =>
        item.id === itemId ? { ...item, assignedTo: allIds } : item
      ),
    }));
  };

  const handleRemoveItem = (itemId: string) => {
    setActiveBill((prev) => ({
      ...prev,
      items: prev.items.filter((it) => it.id !== itemId),
    }));
  };

  // Apply OCR Scanned Receipt
  const handleApplyScannedReceipt = (scanned: {
    title: string;
    category: string;
    items: Array<{ name: string; qty: number; unitPrice: number }>;
    taxAmount: number;
    serviceAmount: number;
    deliveryAmount: number;
    discountAmount: number;
  }) => {
    const allParticipantIds = activeBill.participants.map((p) => p.id);
    const mappedItems: BillItem[] = (scanned.items || []).map((it, idx) => ({
      id: `scan-${Date.now()}-${idx}`,
      name: it.name,
      qty: Math.max(1, it.qty || 1),
      unitPrice: Math.max(0, it.unitPrice || 0),
      assignedTo: allParticipantIds,
    }));

    setActiveBill((prev) => ({
      ...prev,
      title: scanned.title || prev.title,
      category: scanned.category || prev.category,
      mode: 'itemized',
      useTaxPercent: false,
      taxAmount: scanned.taxAmount || 0,
      useServicePercent: false,
      serviceAmount: scanned.serviceAmount || 0,
      deliveryAmount: scanned.deliveryAmount || 0,
      discountAmount: scanned.discountAmount || 0,
      items: mappedItems.length > 0 ? mappedItems : prev.items,
    }));
    setViewMode('editor');
    setMobileEditorTab('input');
  };

  const handleAddPaymentChannel = (e: React.FormEvent) => {
    e.preventDefault();
    const isQris = newChannelProvider === 'QRIS';
    const holder =
      newChannelHolder.trim() ||
      activeBill.creatorName ||
      currentUser?.displayName ||
      'Penerima';
    const number =
      newChannelNumber.trim() || (isQris ? 'QRIS Pribadi' : '');
    if (!number || !holder) return;

    const ch: PaymentChannel = {
      id: 'ch-' + Date.now().toString(36),
      provider: newChannelProvider,
      accountNumber: number,
      accountHolder: holder,
      enabled: true,
      qrisImageUrl: isQris ? newChannelQrisImage : undefined,
    };
    setActiveBill((prev) => ({
      ...prev,
      paymentChannels: [...prev.paymentChannels, ch],
    }));
    setNewChannelNumber('');
    setNewChannelHolder('');
    setNewChannelQrisImage(undefined);
    setShowAddChannel(false);
  };

  const handleQrisFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressedDataUrl = await compressImageToDataUrl(file, 680, 0.85);
      if (uploadingQrisChannelId === '__NEW_CHANNEL__') {
        setNewChannelQrisImage(compressedDataUrl);
      } else if (uploadingQrisChannelId === '__QUICK_QRIS__') {
        setActiveBill((prev) => {
          const hasQris = prev.paymentChannels.some((c) => c.provider === 'QRIS');
          if (hasQris) {
            return {
              ...prev,
              paymentChannels: prev.paymentChannels.map((c) =>
                c.provider === 'QRIS'
                  ? { ...c, enabled: true, qrisImageUrl: compressedDataUrl }
                  : c
              ),
            };
          }
          const newQris: PaymentChannel = {
            id: 'ch-qris-' + Date.now().toString(36),
            provider: 'QRIS',
            accountNumber: 'QRIS Pribadi',
            accountHolder:
              prev.creatorName || currentUser?.displayName || 'Penerima',
            enabled: true,
            qrisImageUrl: compressedDataUrl,
          };
          return {
            ...prev,
            paymentChannels: [...prev.paymentChannels, newQris],
          };
        });
      } else if (uploadingQrisChannelId) {
        setActiveBill((prev) => ({
          ...prev,
          paymentChannels: prev.paymentChannels.map((c) =>
            c.id === uploadingQrisChannelId
              ? { ...c, enabled: true, qrisImageUrl: compressedDataUrl }
              : c
          ),
        }));
      }
    } catch {
      // ignore compression error
    } finally {
      e.target.value = '';
      setUploadingQrisChannelId(null);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F1F5F9] text-[#0F172A] pb-24 lg:pb-10">
      {/* Compact Sticky Top App Bar (3-Zone Contract, < 56px height on mobile) */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 sm:px-8 h-14 flex items-center justify-between gap-4">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            setViewMode('editor');
            setMobileEditorTab('input');
          }}
          className="text-base sm:text-lg font-extrabold tracking-tight text-[#00AED6] font-display whitespace-nowrap shrink-0"
        >
          Split Bill
        </a>

        {/* Zone 2: Desktop Navigation Links */}
        <nav className="hidden lg:flex items-center gap-6 text-sm font-medium text-slate-600">
          <button
            type="button"
            onClick={() => setViewMode('editor')}
            className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 ${
              viewMode === 'editor'
                ? 'text-slate-900 font-bold underline underline-offset-8 decoration-2 decoration-[#00AED6]'
                : ''
            }`}
          >
            Buat Split Bill
          </button>
          <button
            type="button"
            onClick={() => setViewMode('saved')}
            className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 ${
              viewMode === 'saved'
                ? 'text-slate-900 font-bold underline underline-offset-8 decoration-2 decoration-[#00AED6]'
                : ''
            }`}
          >
            Riwayat Split Bill
          </button>
          <button
            type="button"
            onClick={() => {
              setPortalParticipantId(undefined);
              setViewMode('portal');
            }}
            className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 ${
              viewMode === 'portal'
                ? 'text-slate-900 font-bold underline underline-offset-8 decoration-2 decoration-[#00AED6]'
                : ''
            }`}
          >
            Halaman Link Bayar
          </button>
        </nav>

        {/* Zone 3: Primary Action CTA (Touch-friendly 40px+ hitbox) */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setIsScannerOpen(true)}
            className="min-h-[40px] px-3.5 sm:px-4 py-2 text-xs font-bold text-white bg-[#00880D] hover:bg-[#00700B] active:scale-[0.98] rounded-full transition-all whitespace-nowrap shrink-0 flex items-center gap-1.5 shadow-2xs"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Scan Struk</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1">
        {viewMode === 'portal' ? (
          <FriendPaymentPortal
            bill={activeBill}
            summary={summary}
            initialParticipantId={portalParticipantId}
            onUpdatePaymentStatus={handleUpdatePaymentStatus}
            onBackToEditor={() => {
              if (window.location.search) {
                window.history.replaceState({}, '', window.location.pathname);
              }
              setViewMode('editor');
            }}
          />
        ) : viewMode === 'saved' ? (
          <div className="max-w-6xl mx-auto px-3.5 sm:px-8 py-5 sm:py-8">
            {/* Compact Google Auth Card in Saved View for Mobile */}
            <div className="mb-5 bg-white border border-slate-200 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-center gap-3 min-w-0">
                {currentUser?.photoURL ? (
                  <img
                    src={currentUser.photoURL}
                    alt={currentUser.displayName || 'Profil Google'}
                    referrerPolicy="no-referrer"
                    className="w-10 h-10 rounded-full object-cover border-2 border-[#00AED6] shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-[#00AED6]/10 text-[#00AED6] flex items-center justify-center font-extrabold text-xs shrink-0">
                    {currentUser?.displayName
                      ? getInitials(currentUser.displayName)
                      : 'G'}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                    {currentUser
                      ? currentUser.displayName || currentUser.email
                      : 'Akun Belum Terhubung'}
                  </div>
                  <div className="text-[11px] text-slate-500 truncate">
                    {currentUser
                      ? `Tersinkronisasi dengan ${currentUser.email}`
                      : 'Login Google untuk menyimpan riwayat di cloud'}
                  </div>
                </div>
              </div>

              {!authLoading &&
                (currentUser ? (
                  <button
                    type="button"
                    onClick={handleGoogleLogout}
                    className="min-h-[40px] px-3.5 py-2 rounded-full border border-slate-200 text-xs font-bold text-slate-600 hover:text-red-600 flex items-center gap-1.5"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Keluar
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleGoogleLogin}
                    className="min-h-[40px] px-4 py-2 rounded-full bg-slate-900 text-white text-xs font-bold flex items-center gap-1.5"
                  >
                    Masuk Google
                  </button>
                ))}
            </div>

            <div className="flex items-center justify-between gap-3 pb-4 border-b border-slate-200">
              <div>
                <h1 className="text-lg sm:text-2xl font-extrabold text-slate-900 font-display">
                  Riwayat Split Bill ({savedBills.length})
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  Ketuk kartu untuk membuka atau membagikan ulang tagihan
                </p>
              </div>
              <button
                type="button"
                onClick={handleCreateNewBill}
                className="min-h-[42px] px-4 py-2 rounded-full bg-[#00880D] hover:bg-[#00700B] active:scale-[0.98] text-white text-xs font-bold flex items-center gap-1.5 transition-all whitespace-nowrap shrink-0"
              >
                <FilePlus2 className="w-4 h-4" />
                <span>Struk Baru</span>
              </button>
            </div>

            {savedBills.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-3xl p-8 sm:p-12 text-center mt-6 flex flex-col items-center max-w-md mx-auto shadow-2xs">
                <div className="w-16 h-16 rounded-full bg-[#00AED6]/10 text-[#00AED6] flex items-center justify-center mb-4">
                  <History className="w-8 h-8" />
                </div>
                <h3 className="text-base sm:text-lg font-extrabold text-slate-900 font-display">
                  Belum Ada Riwayat Tagihan
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 mt-1.5 max-w-xs leading-relaxed">
                  {currentUser
                    ? 'Anda belum memiliki tagihan tersimpan. Buat struk baru atau gunakan scan struk.'
                    : 'Masuk dengan akun Google untuk menyimpan dan melihat riwayat tagihan Anda secara otomatis di cloud.'}
                </p>
                {!currentUser ? (
                  <button
                    type="button"
                    onClick={handleGoogleLogin}
                    className="mt-5 min-h-[44px] px-6 py-2.5 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-bold flex items-center gap-2 shadow-sm transition-all"
                  >
                    Masuk dengan Google
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleCreateNewBill}
                    className="mt-5 min-h-[44px] px-6 py-2.5 rounded-full bg-[#00880D] hover:bg-[#00700B] text-white text-xs sm:text-sm font-bold flex items-center gap-2 shadow-sm transition-all"
                  >
                    <FilePlus2 className="w-4 h-4" />
                    Buat Struk Baru
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-5">
                {savedBills.map((billItem) => {
                  const itemSummary = calculateSplitBill(billItem);
                  const isCurrent = billItem.id === activeBill.id;
                  return (
                    <div
                      key={billItem.id}
                      className={`bg-white rounded-3xl border p-5 flex flex-col justify-between transition-all shadow-2xs ${
                        isCurrent
                          ? 'border-[#00AED6] ring-2 ring-[#00AED6]/20'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-xs text-slate-500 flex items-center gap-1.5">
                            <span className="font-bold text-[#00AED6]">
                              {billItem.category}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>{billItem.date}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeleteSavedBill(billItem.id)}
                            className="min-h-[36px] min-w-[36px] flex items-center justify-center text-slate-400 hover:text-red-600 rounded-full"
                            title="Hapus tagihan"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <h2 className="text-base font-extrabold text-slate-900 font-display mt-1">
                          {billItem.title || 'Split Bill Tanpa Judul'}
                        </h2>
                        <div className="mt-3 pt-3 border-t border-dashed border-slate-200 flex items-baseline justify-between">
                          <span className="text-xs text-slate-500">Total Struk</span>
                          <span className="text-base font-extrabold font-mono tabular-nums text-slate-900">
                            {formatRupiah(itemSummary.grandTotal)}
                          </span>
                        </div>
                        <div className="mt-1.5 flex items-center justify-between text-xs">
                          <span className="text-slate-500">Status Lunas</span>
                          <span className="font-mono tabular-nums font-bold text-[#00880D]">
                            {itemSummary.paidCount}/{billItem.participants.length} Orang (
                            {formatRupiah(itemSummary.totalPaidAmount)})
                          </span>
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setActiveBill(billItem);
                            setViewMode('editor');
                            setMobileEditorTab('input');
                          }}
                          className="flex-1 min-h-[42px] py-2 px-3 rounded-full bg-[#00AED6] hover:bg-[#0099BD] text-white text-xs font-bold transition-colors whitespace-nowrap"
                        >
                          Edit Struk
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveBill(billItem);
                            setPortalParticipantId(undefined);
                            setViewMode('portal');
                          }}
                          className="min-h-[42px] py-2 px-4 rounded-full border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition-colors whitespace-nowrap"
                        >
                          Buka Link
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* MOBILE-FIRST SPLIT BILL EDITOR WORKSPACE */
          <div className="max-w-6xl mx-auto px-3.5 sm:px-6 lg:px-8 py-4 sm:py-6">
            {/* Compact Mobile-First Account & Quick Reset Bar */}
            <div className="bg-white border border-slate-200 rounded-2xl p-3 sm:px-5 flex items-center justify-between gap-2.5 shadow-2xs">
              <div className="flex items-center gap-2.5 min-w-0">
                {currentUser?.photoURL ? (
                  <img
                    src={currentUser.photoURL}
                    alt={currentUser.displayName || 'Profil Google'}
                    referrerPolicy="no-referrer"
                    className="w-9 h-9 rounded-full object-cover border-2 border-[#00AED6] shrink-0"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-[#00AED6]/10 text-[#00AED6] flex items-center justify-center font-extrabold text-xs shrink-0">
                    {currentUser?.displayName
                      ? getInitials(currentUser.displayName)
                      : 'G'}
                  </div>
                )}

                <div className="min-w-0">
                  {currentUser ? (
                    <>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                          {currentUser.displayName || 'Pengguna Google'}
                        </span>
                        <ShieldCheck className="w-3.5 h-3.5 text-[#00880D] shrink-0" />
                      </div>
                      <p className="text-[11px] text-slate-500 truncate">
                        {currentUser.email}
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                        Simpan Tagihan & QRIS di Akun Google
                      </div>
                      <p className="text-[11px] text-slate-500 truncate">
                        Login agar struk & QRIS tersimpan otomatis
                      </p>
                    </>
                  )}
                  {authError && (
                    <p className="text-[11px] text-red-600 mt-0.5">{authError}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={handleCreateNewBill}
                  className="min-h-[38px] px-3 py-1.5 rounded-full border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700 flex items-center gap-1 transition-colors whitespace-nowrap"
                  title="Kosongkan dan buat struk baru"
                >
                  <FilePlus2 className="w-3.5 h-3.5 text-[#00AED6]" />
                  <span className="hidden sm:inline">Reset Kosong</span>
                  <span className="sm:hidden">Baru</span>
                </button>

                {!authLoading &&
                  (currentUser ? (
                    <button
                      type="button"
                      onClick={handleGoogleLogout}
                      className="min-h-[38px] px-3 py-1.5 rounded-full border border-slate-200 hover:bg-red-50 hover:text-red-600 text-xs font-semibold text-slate-600 flex items-center gap-1 transition-colors whitespace-nowrap"
                      title="Keluar dari Google"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Keluar</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleGoogleLogin}
                      className="min-h-[38px] px-3.5 py-1.5 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 transition-colors whitespace-nowrap shadow-2xs"
                    >
                      <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24">
                        <path
                          fill="#4285F4"
                          d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                        />
                        <path
                          fill="#34A853"
                          d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14z"
                        />
                        <path
                          fill="#EA4335"
                          d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96z"
                        />
                      </svg>
                      <span>Login Google</span>
                    </button>
                  ))}
              </div>
            </div>

            {/* Compact Teal Summary Card (Optimized for Mobile 375px-430px) */}
            <div className="mt-3.5 bg-gradient-to-r from-[#00AED6] to-[#0093B8] rounded-3xl p-4 sm:p-6 text-white shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-white/85 flex items-center gap-1.5">
                    <Receipt className="w-3.5 h-3.5" />
                    <span>Split Bill · Patungan Otomatis</span>
                  </div>
                  <h1 className="text-lg sm:text-2xl font-extrabold font-display mt-0.5 truncate">
                    {activeBill.title || 'Buat Tagihan Split Bill Baru'}
                  </h1>
                </div>

                {/* 3 Compact Stat Boxes */}
                <div className="grid grid-cols-3 gap-2 shrink-0">
                  <div className="bg-white/15 backdrop-blur-xs rounded-2xl px-3 py-2 border border-white/20">
                    <span className="text-[10px] text-white/80 block">
                      Total Struk
                    </span>
                    <span className="text-xs sm:text-base font-extrabold font-mono tabular-nums text-white mt-0.5 block truncate">
                      {formatRupiah(summary.grandTotal)}
                    </span>
                  </div>
                  <div className="bg-white/15 backdrop-blur-xs rounded-2xl px-3 py-2 border border-white/20">
                    <span className="text-[10px] text-white/80 block">
                      Pajak & Biaya
                    </span>
                    <span className="text-xs sm:text-base font-extrabold font-mono tabular-nums text-white mt-0.5 block truncate">
                      +{formatRupiah(
                        summary.computedTax +
                          summary.computedService +
                          summary.computedDelivery
                      )}
                    </span>
                  </div>
                  <div className="bg-white/15 backdrop-blur-xs rounded-2xl px-3 py-2 border border-white/20">
                    <span className="text-[10px] text-white/80 block">
                      Lunas
                    </span>
                    <span className="text-xs sm:text-base font-extrabold font-mono tabular-nums text-white mt-0.5 block">
                      {summary.paidCount}/{activeBill.participants.length} Org
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Mobile Step Switcher (Visible on mobile/tablet < lg so users don't scroll endlessly) */}
            <div className="lg:hidden mt-3.5 p-1 bg-white border border-slate-200 rounded-2xl grid grid-cols-2 gap-1 shadow-2xs">
              <button
                type="button"
                onClick={() => setMobileEditorTab('input')}
                className={`min-h-[42px] py-2 px-3 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 ${
                  mobileEditorTab === 'input'
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'text-slate-600'
                }`}
              >
                <Receipt className="w-3.5 h-3.5" />
                <span>1. Isi Struk & Teman</span>
              </button>
              <button
                type="button"
                onClick={() => setMobileEditorTab('summary')}
                className={`min-h-[42px] py-2 px-3 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 ${
                  mobileEditorTab === 'summary'
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'text-slate-600'
                }`}
              >
                <Wallet className="w-3.5 h-3.5" />
                <span>
                  2. Tagihan & QRIS ({activeBill.participants.length})
                </span>
              </button>
            </div>

            {/* Main 12-Column Responsive Split Bill Workspace */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-4 sm:mt-6 items-start">
              {/* LEFT 7 COLUMNS: Perforated Receipt Editor (Shown on Desktop OR when mobileEditorTab === 'input') */}
              <div
                className={`lg:col-span-7 space-y-4 sm:space-y-6 ${
                  mobileEditorTab === 'summary' ? 'hidden lg:block' : 'block'
                }`}
              >
                {/* STEP 1: Mode Switcher & Bill Header Card */}
                <section className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-6 shadow-2xs">
                  {/* Split Mode Pill Switcher: Atur Jumlah vs Bagi Rata */}
                  <div className="p-1 bg-slate-100 rounded-full grid grid-cols-2 gap-1 mb-4">
                    <button
                      type="button"
                      onClick={() =>
                        setActiveBill((prev) => ({ ...prev, mode: 'itemized' }))
                      }
                      className={`min-h-[42px] py-2 px-3 rounded-full text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 ${
                        activeBill.mode === 'itemized'
                          ? 'bg-[#00AED6] text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Receipt className="w-3.5 h-3.5 shrink-0" />
                      <span>Atur Jumlah (Menu)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setActiveBill((prev) => ({ ...prev, mode: 'equal' }))
                      }
                      className={`min-h-[42px] py-2 px-3 rounded-full text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 ${
                        activeBill.mode === 'equal'
                          ? 'bg-[#00AED6] text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Users className="w-3.5 h-3.5 shrink-0" />
                      <span>Bagi Rata</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Nama Tagihan / Restoran
                      </label>
                      <input
                        type="text"
                        value={activeBill.title}
                        onChange={(e) =>
                          setActiveBill((prev) => ({ ...prev, title: e.target.value }))
                        }
                        placeholder="Ketik nama tempat makan atau acara patungan..."
                        className="w-full min-h-[44px] px-4 py-2.5 rounded-2xl border border-slate-300 text-sm font-semibold text-slate-900 focus:border-[#00AED6] focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Nama Pembuat Split Bill (Penagih)
                      </label>
                      <input
                        type="text"
                        value={activeBill.creatorName}
                        onChange={(e) =>
                          setActiveBill((prev) => ({
                            ...prev,
                            creatorName: e.target.value,
                          }))
                        }
                        placeholder="Nama Anda..."
                        className="w-full min-h-[42px] px-3.5 py-2 rounded-2xl border border-slate-300 text-xs font-medium text-slate-800 focus:border-[#00AED6] focus:outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Kategori
                        </label>
                        <select
                          value={activeBill.category}
                          onChange={(e) =>
                            setActiveBill((prev) => ({
                              ...prev,
                              category: e.target.value,
                            }))
                          }
                          className="w-full min-h-[42px] px-3 py-2 rounded-2xl border border-slate-300 text-xs font-medium text-slate-800 bg-white focus:border-[#00AED6] focus:outline-none"
                        >
                          <option value="Makan & Minum">Makan & Minum</option>
                          <option value="Nongkrong">Nongkrong</option>
                          <option value="Belanja">Belanja</option>
                          <option value="Perjalanan">Perjalanan</option>
                          <option value="Langganan">Langganan</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Tanggal
                        </label>
                        <input
                          type="date"
                          value={activeBill.date}
                          onChange={(e) =>
                            setActiveBill((prev) => ({ ...prev, date: e.target.value }))
                          }
                          className="w-full min-h-[42px] px-3 py-2 rounded-2xl border border-slate-300 text-xs font-mono text-slate-800 focus:border-[#00AED6] focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Catatan Tambahan (Opsional)
                      </label>
                      <input
                        type="text"
                        value={activeBill.notes || ''}
                        onChange={(e) =>
                          setActiveBill((prev) => ({ ...prev, notes: e.target.value }))
                        }
                        placeholder="Tambahkan pesan untuk teman patungan..."
                        className="w-full min-h-[42px] px-3.5 py-2 rounded-2xl border border-slate-300 text-xs text-slate-800 focus:border-[#00AED6] focus:outline-none"
                      />
                    </div>
                  </div>
                </section>

                {/* STEP 2: Circular Participant Bubbles Bar */}
                <section className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-6 shadow-2xs">
                  <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100">
                    <div>
                      <h2 className="text-sm sm:text-base font-extrabold text-slate-900 font-display">
                        Teman Patungan ({activeBill.participants.length} Orang)
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Tambahkan nama teman yang ikut patungan
                      </p>
                    </div>
                  </div>

                  {/* Mobile-Friendly Add Participant Form */}
                  <form
                    onSubmit={handleAddParticipant}
                    className="mt-3.5 flex flex-col sm:flex-row gap-2"
                  >
                    <div className="flex gap-2 flex-1">
                      <input
                        type="text"
                        value={newFriendName}
                        onChange={(e) => setNewFriendName(e.target.value)}
                        placeholder="Nama teman..."
                        className="flex-1 min-h-[44px] px-3.5 py-2 rounded-2xl border border-slate-300 text-xs font-medium text-slate-800 focus:border-[#00AED6] focus:outline-none"
                      />
                      <input
                        type="tel"
                        value={newFriendPhone}
                        onChange={(e) => setNewFriendPhone(e.target.value)}
                        placeholder="No. WA (opsional)"
                        className="w-36 sm:w-44 min-h-[44px] px-3 py-2 rounded-2xl border border-slate-300 text-xs font-mono text-slate-800 focus:border-[#00AED6] focus:outline-none"
                      />
                    </div>
                    <button
                      type="submit"
                      className="min-h-[44px] px-5 py-2.5 rounded-full bg-[#00AED6] hover:bg-[#0099BD] active:scale-[0.98] text-white text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all whitespace-nowrap shrink-0"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Tambah Teman</span>
                    </button>
                  </form>

                  {/* Horizontal Circular Avatar Strip + List */}
                  {activeBill.participants.length === 0 ? (
                    <div className="mt-4 p-5 rounded-2xl border border-dashed border-slate-200 text-center text-xs text-slate-400">
                      Belum ada anggota patungan. Ketik nama teman di atas lalu ketuk Tambah Teman.
                    </div>
                  ) : (
                    <div className="mt-4 space-y-3.5">
                      {/* Horizontal Circular Avatar Row */}
                      <div className="flex items-center gap-3.5 overflow-x-auto pb-1.5 pt-1">
                        {activeBill.participants.map((p, idx) => {
                          const isPaid = p.status === 'paid';
                          return (
                            <div
                              key={p.id}
                              className="flex flex-col items-center shrink-0 relative"
                            >
                              <div className="relative">
                                <div
                                  className={`w-11 h-11 rounded-full flex items-center justify-center font-extrabold text-xs shadow-2xs ${getAvatarColor(
                                    idx
                                  )}`}
                                >
                                  {getInitials(p.name)}
                                </div>
                                {isPaid && (
                                  <span
                                    className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-[#00880D] border-2 border-white text-white flex items-center justify-center"
                                    title="Sudah Lunas"
                                  >
                                    <Check className="w-2.5 h-2.5" />
                                  </span>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleRemoveParticipant(p.id)}
                                  className="-top-1 -right-1 absolute w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs hover:bg-red-600"
                                  title={`Hapus ${p.name}`}
                                >
                                  ×
                                </button>
                              </div>
                              <span className="text-[11px] font-bold text-slate-800 mt-1 max-w-[68px] truncate">
                                {p.name}
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      {/* Detailed Participant Rows */}
                      <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden">
                        {activeBill.participants.map((p, idx) => {
                          const calc = summary.participantBreakdowns.find(
                            (b) => b.participant.id === p.id
                          );
                          return (
                            <div
                              key={p.id}
                              className="p-3 bg-white flex items-center justify-between gap-2"
                            >
                              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                <div
                                  className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${getAvatarColor(
                                    idx
                                  )}`}
                                >
                                  {getInitials(p.name)}
                                </div>
                                <div className="min-w-0">
                                  <div className="text-xs font-bold text-slate-900 truncate">
                                    {p.name}
                                  </div>
                                  <div className="text-[11px] text-slate-500 truncate">
                                    Total:{' '}
                                    <span className="font-mono tabular-nums font-bold text-slate-900">
                                      {formatRupiah(calc?.finalTotal || 0)}
                                    </span>
                                    {calc && calc.taxShare > 0 && (
                                      <span className="font-mono tabular-nums text-slate-400 ml-1">
                                        (termasuk pajak {formatRupiah(calc.taxShare)})
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                {activeBill.mode === 'equal' && (
                                  <div className="flex items-center gap-1">
                                    <span className="text-[11px] text-slate-500">Porsi:</span>
                                    <input
                                      type="number"
                                      min={1}
                                      max={20}
                                      value={p.equalPortions || 1}
                                      onChange={(e) => {
                                        const val = Math.max(
                                          1,
                                          Number(e.target.value) || 1
                                        );
                                        setActiveBill((prev) => ({
                                          ...prev,
                                          participants: prev.participants.map((part) =>
                                            part.id === p.id
                                              ? { ...part, equalPortions: val }
                                              : part
                                          ),
                                        }));
                                      }}
                                      className="w-12 min-h-[36px] px-1.5 py-1 rounded-lg border border-slate-300 text-xs font-mono text-center"
                                    />
                                  </div>
                                )}

                                <button
                                  type="button"
                                  onClick={() =>
                                    handleUpdatePaymentStatus(
                                      p.id,
                                      p.status === 'paid' ? 'unpaid' : 'paid'
                                    )
                                  }
                                  className={`min-h-[36px] px-3 py-1 rounded-full text-xs font-bold transition-colors whitespace-nowrap ${
                                    p.status === 'paid'
                                      ? 'bg-[#00880D]/10 text-[#00880D]'
                                      : 'bg-slate-100 text-slate-600'
                                  }`}
                                >
                                  {p.status === 'paid' ? '✓ Lunas' : 'Belum'}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </section>

                {/* STEP 3: Perforated Receipt Card ("Daftar Pesanan & Pajak") */}
                <section className="relative bg-white border border-slate-200 rounded-3xl p-4 sm:p-6 shadow-2xs overflow-hidden">
                  <div
                    aria-hidden="true"
                    className="hidden sm:block absolute -left-3 top-20 w-6 h-6 rounded-full bg-[#F1F5F9] border border-slate-200"
                  />
                  <div
                    aria-hidden="true"
                    className="hidden sm:block absolute -right-3 top-20 w-6 h-6 rounded-full bg-[#F1F5F9] border border-slate-200"
                  />

                  <div className="flex items-center justify-between gap-2 pb-4 border-b-2 border-dashed border-slate-200">
                    <div>
                      <h2 className="text-sm sm:text-base font-extrabold text-slate-900 font-display flex items-center gap-1.5">
                        <Receipt className="w-4 h-4 text-[#00AED6] shrink-0" />
                        <span>Daftar Menu Struk ({activeBill.items.length})</span>
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Ketuk inisial teman di bawah tiap menu untuk membagi pesanan
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsScannerOpen(true)}
                      className="min-h-[38px] px-3 py-1.5 rounded-full bg-[#00AED6]/10 hover:bg-[#00AED6]/20 text-[#00AED6] text-xs font-extrabold flex items-center gap-1 transition-colors whitespace-nowrap shrink-0"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Scan Foto</span>
                    </button>
                  </div>

                  {/* Mobile-Ergonomic Add Item Form */}
                  <form
                    onSubmit={handleAddItem}
                    className="mt-4 space-y-2 sm:space-y-0 sm:grid sm:grid-cols-12 sm:gap-2"
                  >
                    <input
                      type="text"
                      value={newItemName}
                      onChange={(e) => setNewItemName(e.target.value)}
                      placeholder="Nama menu / pesanan..."
                      className="w-full sm:col-span-5 min-h-[44px] px-3.5 py-2 rounded-2xl border border-slate-300 text-xs font-medium text-slate-800 focus:border-[#00AED6] focus:outline-none"
                    />
                    <div className="grid grid-cols-12 gap-2 sm:col-span-7">
                      <input
                        type="number"
                        min={1}
                        value={newItemQty}
                        onChange={(e) =>
                          setNewItemQty(Math.max(1, Number(e.target.value) || 1))
                        }
                        placeholder="Qty"
                        className="col-span-3 min-h-[44px] px-2 py-2 rounded-2xl border border-slate-300 text-xs font-mono text-slate-800 text-center focus:border-[#00AED6] focus:outline-none"
                      />
                      <input
                        type="number"
                        min={0}
                        inputMode="numeric"
                        value={newItemPrice}
                        onChange={(e) => setNewItemPrice(e.target.value)}
                        placeholder="Harga satuan (Rp)"
                        className="col-span-5 min-h-[44px] px-3 py-2 rounded-2xl border border-slate-300 text-xs font-mono text-slate-800 focus:border-[#00AED6] focus:outline-none"
                      />
                      <button
                        type="submit"
                        className="col-span-4 min-h-[44px] px-3 py-2 rounded-full bg-[#00880D] hover:bg-[#00700B] active:scale-[0.98] text-white text-xs font-extrabold flex items-center justify-center gap-1 transition-all whitespace-nowrap"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Tambah</span>
                      </button>
                    </div>
                  </form>

                  {/* Menu Items List with Touch-Friendly Avatar Bubble Assignment */}
                  {activeBill.items.length === 0 ? (
                    <div className="mt-4 p-6 rounded-2xl border border-dashed border-slate-200 text-center text-xs text-slate-400">
                      Struk masih kosong. Tambahkan menu di atas atau ketuk tombol <strong>Scan Struk</strong>.
                    </div>
                  ) : (
                    <div className="mt-4 space-y-3">
                      {activeBill.items.map((item) => {
                        const lineTotal = item.qty * item.unitPrice;
                        const assignedCount = item.assignedTo.length;
                        const perPersonShare =
                          assignedCount > 0
                            ? Math.round(lineTotal / assignedCount)
                            : Math.round(
                                lineTotal / Math.max(1, activeBill.participants.length)
                              );

                        return (
                          <div
                            key={item.id}
                            className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50/60 space-y-2.5"
                          >
                            {/* Row 1: Item Name & Delete Button */}
                            <div className="flex items-center justify-between gap-2">
                              <input
                                type="text"
                                value={item.name}
                                onChange={(e) =>
                                  setActiveBill((prev) => ({
                                    ...prev,
                                    items: prev.items.map((it) =>
                                      it.id === item.id
                                        ? { ...it, name: e.target.value }
                                        : it
                                    ),
                                  }))
                                }
                                className="flex-1 min-w-0 bg-transparent text-sm font-extrabold text-slate-900 focus:bg-white focus:px-2 py-0.5 rounded-md focus:outline-none focus:ring-1 focus:ring-[#00AED6]"
                              />
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(item.id)}
                                className="min-h-[36px] min-w-[36px] flex items-center justify-center text-slate-400 hover:text-red-600 rounded-full transition-colors shrink-0"
                                title="Hapus menu"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>

                            {/* Row 2: Qty x UnitPrice & Line Total Before Split */}
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="number"
                                  min={1}
                                  value={item.qty}
                                  onChange={(e) => {
                                    const q = Math.max(
                                      1,
                                      Number(e.target.value) || 1
                                    );
                                    setActiveBill((prev) => ({
                                      ...prev,
                                      items: prev.items.map((it) =>
                                        it.id === item.id ? { ...it, qty: q } : it
                                      ),
                                    }));
                                  }}
                                  className="w-12 min-h-[36px] px-2 py-1 rounded-xl border border-slate-300 bg-white text-xs font-mono tabular-nums text-center"
                                />
                                <span className="text-xs text-slate-400">×</span>
                                <input
                                  type="number"
                                  min={0}
                                  inputMode="numeric"
                                  value={item.unitPrice}
                                  onChange={(e) => {
                                    const pr = Math.max(
                                      0,
                                      Number(e.target.value) || 0
                                    );
                                    setActiveBill((prev) => ({
                                      ...prev,
                                      items: prev.items.map((it) =>
                                        it.id === item.id
                                          ? { ...it, unitPrice: pr }
                                          : it
                                      ),
                                    }));
                                  }}
                                  className="w-28 min-h-[36px] px-2.5 py-1 rounded-xl border border-slate-300 bg-white text-xs font-mono tabular-nums text-right"
                                />
                              </div>

                              <div className="text-right">
                                <span className="text-[10px] text-slate-400 block">
                                  Harga Menu
                                </span>
                                <span className="text-sm font-extrabold font-mono tabular-nums text-slate-900">
                                  {formatRupiah(lineTotal)}
                                </span>
                              </div>
                            </div>

                            {/* Row 3: Touch-Friendly Participant Assignment Bubbles */}
                            {activeBill.mode === 'itemized' &&
                              activeBill.participants.length > 0 && (
                                <div className="pt-2.5 border-t border-dashed border-slate-200 space-y-2">
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => handleAssignAllToItem(item.id)}
                                      className={`min-h-[36px] px-3 py-1 rounded-full text-xs font-bold transition-all ${
                                        item.assignedTo.length ===
                                        activeBill.participants.length
                                          ? 'bg-[#00AED6] text-white'
                                          : 'bg-white border border-slate-200 text-slate-600'
                                      }`}
                                    >
                                      Semua
                                    </button>
                                    {activeBill.participants.map((p, idx) => {
                                      const isSelected = item.assignedTo.includes(
                                        p.id
                                      );
                                      return (
                                        <button
                                          key={p.id}
                                          type="button"
                                          onClick={() =>
                                            handleToggleItemAssignee(item.id, p.id)
                                          }
                                          className={`min-h-[36px] pl-1.5 pr-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 transition-all active:scale-[0.97] ${
                                            isSelected
                                              ? 'bg-[#00880D] text-white shadow-2xs'
                                              : 'bg-white border border-slate-200 text-slate-600 opacity-80'
                                          }`}
                                        >
                                          <span
                                            className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-extrabold ${
                                              isSelected
                                                ? 'bg-white text-[#00880D]'
                                                : getAvatarColor(idx)
                                            }`}
                                          >
                                            {isSelected
                                              ? '✓'
                                              : getInitials(p.name)}
                                          </span>
                                          <span>{p.name.split(' ')[0]}</span>
                                        </button>
                                      );
                                    })}
                                  </div>

                                  <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono tabular-nums">
                                    <span>
                                      Dibagi {assignedCount || activeBill.participants.length} orang
                                    </span>
                                    <span className="font-bold text-[#00880D]">
                                      {formatRupiah(perPersonShare)} / orang
                                    </span>
                                  </div>
                                </div>
                              )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Receipt Perforated Divider for Tax, Service, Delivery, Discount */}
                  <div className="mt-5 pt-5 border-t-2 border-dashed border-slate-200">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-3.5">
                      <div>
                        <h3 className="text-sm font-extrabold text-slate-900 font-display">
                          Pajak, Layanan, Ongkir & Diskon
                        </h3>
                        <p className="text-xs text-slate-500">
                          Otomatis disertakan ke tagihan masing-masing teman
                        </p>
                      </div>

                      <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-full">
                        <button
                          type="button"
                          onClick={() =>
                            setActiveBill((prev) => ({
                              ...prev,
                              extraRule: 'proportional',
                            }))
                          }
                          className={`min-h-[32px] px-3 py-1 text-xs font-bold rounded-full transition-colors whitespace-nowrap ${
                            activeBill.extraRule === 'proportional'
                              ? 'bg-white text-slate-900 shadow-2xs'
                              : 'text-slate-600'
                          }`}
                        >
                          Proporsional
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setActiveBill((prev) => ({ ...prev, extraRule: 'equal' }))
                          }
                          className={`min-h-[32px] px-3 py-1 text-xs font-bold rounded-full transition-colors whitespace-nowrap ${
                            activeBill.extraRule === 'equal'
                              ? 'bg-white text-slate-900 shadow-2xs'
                              : 'text-slate-600'
                          }`}
                        >
                          Bagi Rata
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Tax */}
                      <div className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50/50">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-slate-700">
                            Pajak PB1 / PPN
                          </span>
                          <div className="flex items-center gap-1 text-xs">
                            <button
                              type="button"
                              onClick={() =>
                                setActiveBill((prev) => ({
                                  ...prev,
                                  useTaxPercent: true,
                                }))
                              }
                              className={`min-h-[28px] px-2.5 py-0.5 rounded-full ${
                                activeBill.useTaxPercent
                                  ? 'bg-[#00AED6] text-white font-bold'
                                  : 'text-slate-500'
                              }`}
                            >
                              %
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setActiveBill((prev) => ({
                                  ...prev,
                                  useTaxPercent: false,
                                }))
                              }
                              className={`min-h-[28px] px-2.5 py-0.5 rounded-full ${
                                !activeBill.useTaxPercent
                                  ? 'bg-[#00AED6] text-white font-bold'
                                  : 'text-slate-500'
                              }`}
                            >
                              Rp
                            </button>
                          </div>
                        </div>
                        {activeBill.useTaxPercent ? (
                          <div className="flex items-center justify-between gap-2">
                            <input
                              type="number"
                              min={0}
                              max={100}
                              inputMode="numeric"
                              value={activeBill.taxPercent}
                              onChange={(e) =>
                                setActiveBill((prev) => ({
                                  ...prev,
                                  taxPercent: Math.max(
                                    0,
                                    Number(e.target.value) || 0
                                  ),
                                }))
                              }
                              className="w-24 min-h-[40px] px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-xs font-mono tabular-nums"
                            />
                            <span className="text-xs font-mono tabular-nums text-slate-600">
                              = {formatRupiah(summary.computedTax)}
                            </span>
                          </div>
                        ) : (
                          <input
                            type="number"
                            min={0}
                            inputMode="numeric"
                            value={activeBill.taxAmount}
                            onChange={(e) =>
                              setActiveBill((prev) => ({
                                ...prev,
                                taxAmount: Math.max(
                                  0,
                                  Number(e.target.value) || 0
                                ),
                              }))
                            }
                            className="w-full min-h-[40px] px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-xs font-mono tabular-nums"
                          />
                        )}
                      </div>

                      {/* Service Charge */}
                      <div className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50/50">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-slate-700">
                            Biaya Layanan / Service
                          </span>
                          <div className="flex items-center gap-1 text-xs">
                            <button
                              type="button"
                              onClick={() =>
                                setActiveBill((prev) => ({
                                  ...prev,
                                  useServicePercent: true,
                                }))
                              }
                              className={`min-h-[28px] px-2.5 py-0.5 rounded-full ${
                                activeBill.useServicePercent
                                  ? 'bg-[#00AED6] text-white font-bold'
                                  : 'text-slate-500'
                              }`}
                            >
                              %
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setActiveBill((prev) => ({
                                  ...prev,
                                  useServicePercent: false,
                                }))
                              }
                              className={`min-h-[28px] px-2.5 py-0.5 rounded-full ${
                                !activeBill.useServicePercent
                                  ? 'bg-[#00AED6] text-white font-bold'
                                  : 'text-slate-500'
                              }`}
                            >
                              Rp
                            </button>
                          </div>
                        </div>
                        {activeBill.useServicePercent ? (
                          <div className="flex items-center justify-between gap-2">
                            <input
                              type="number"
                              min={0}
                              max={100}
                              inputMode="numeric"
                              value={activeBill.servicePercent}
                              onChange={(e) =>
                                setActiveBill((prev) => ({
                                  ...prev,
                                  servicePercent: Math.max(
                                    0,
                                    Number(e.target.value) || 0
                                  ),
                                }))
                              }
                              className="w-24 min-h-[40px] px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-xs font-mono tabular-nums"
                            />
                            <span className="text-xs font-mono tabular-nums text-slate-600">
                              = {formatRupiah(summary.computedService)}
                            </span>
                          </div>
                        ) : (
                          <input
                            type="number"
                            min={0}
                            inputMode="numeric"
                            value={activeBill.serviceAmount}
                            onChange={(e) =>
                              setActiveBill((prev) => ({
                                ...prev,
                                serviceAmount: Math.max(
                                  0,
                                  Number(e.target.value) || 0
                                ),
                              }))
                            }
                            className="w-full min-h-[40px] px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-xs font-mono tabular-nums"
                          />
                        )}
                      </div>

                      {/* Delivery */}
                      <div className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50/50">
                        <label className="block text-xs font-bold text-slate-700 mb-2">
                          Ongkir / Biaya Kemasan (Rp)
                        </label>
                        <input
                          type="number"
                          min={0}
                          inputMode="numeric"
                          value={activeBill.deliveryAmount}
                          onChange={(e) =>
                            setActiveBill((prev) => ({
                              ...prev,
                              deliveryAmount: Math.max(
                                0,
                                Number(e.target.value) || 0
                              ),
                            }))
                          }
                          className="w-full min-h-[40px] px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-xs font-mono tabular-nums"
                        />
                      </div>

                      {/* Discount */}
                      <div className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50/50">
                        <label className="block text-xs font-bold text-[#00880D] mb-2">
                          Diskon / Promo Voucher (Rp)
                        </label>
                        <input
                          type="number"
                          min={0}
                          inputMode="numeric"
                          value={activeBill.discountAmount}
                          onChange={(e) =>
                            setActiveBill((prev) => ({
                              ...prev,
                              discountAmount: Math.max(
                                0,
                                Number(e.target.value) || 0
                              ),
                            }))
                          }
                          className="w-full min-h-[40px] px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-xs font-mono tabular-nums text-[#00880D] font-bold"
                        />
                      </div>
                    </div>

                    {/* Mobile Next Step CTA Button */}
                    <div className="lg:hidden mt-5">
                      <button
                        type="button"
                        onClick={() => {
                          setMobileEditorTab('summary');
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="w-full min-h-[48px] py-3 px-5 rounded-full bg-[#00AED6] text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-xs active:scale-[0.98] transition-transform"
                      >
                        <Wallet className="w-4 h-4" />
                        <span>Lihat Rincian Tagihan Per Teman & QRIS</span>
                      </button>
                    </div>
                  </div>
                </section>
              </div>

              {/* RIGHT 5 COLUMNS: Split Bill Summary Per Friend & Custom QRIS / Accounts */}
              <div
                className={`lg:col-span-5 space-y-4 sm:space-y-6 ${
                  mobileEditorTab === 'input' ? 'hidden lg:block' : 'block'
                }`}
              >
                {/* Per-Participant Split Bill Card */}
                <section className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-6 shadow-2xs">
                  <div className="flex items-center justify-between pb-3.5 border-b border-dashed border-slate-200">
                    <div>
                      <h2 className="text-sm sm:text-base font-extrabold text-slate-900 font-display">
                        Rincian Patungan Per Teman
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Termasuk harga menu sebelum bagi & pajak masing-masing
                      </p>
                    </div>
                    <span className="text-xs font-mono tabular-nums font-extrabold text-[#00880D]">
                      {summary.paidCount}/{activeBill.participants.length} Lunas
                    </span>
                  </div>

                  {summary.participantBreakdowns.length === 0 ? (
                    <div className="mt-4 p-6 rounded-2xl border border-dashed border-slate-200 text-center text-xs text-slate-400">
                      Tambahkan teman dan menu pesanan terlebih dahulu untuk melihat hasil bagi tagihan otomatis di sini.
                    </div>
                  ) : (
                    <div className="mt-4 space-y-3">
                      {summary.participantBreakdowns.map((b, idx) => {
                        const isPaid = b.participant.status === 'paid';
                        const personalLink = buildShareablePaymentLink(
                          activeBill,
                          b.participant.id
                        );

                        return (
                          <div
                            key={b.participant.id}
                            className="p-3.5 sm:p-4 rounded-2xl border border-slate-200 hover:border-[#00AED6] transition-colors bg-white"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div
                                  className={`w-9 h-9 rounded-full flex items-center justify-center font-extrabold text-xs shrink-0 ${getAvatarColor(
                                    idx
                                  )}`}
                                >
                                  {getInitials(b.participant.name)}
                                </div>
                                <div className="min-w-0">
                                  <div className="text-sm font-extrabold text-slate-900 truncate">
                                    {b.participant.name}
                                  </div>
                                  <div className="text-xs text-slate-500 flex items-center gap-1.5">
                                    <span>{b.items.length} menu</span>
                                    <span aria-hidden="true">·</span>
                                    {isPaid ? (
                                      <span className="text-[#00880D] font-bold">
                                        Lunas ({b.participant.paidVia || 'Transfer'})
                                      </span>
                                    ) : (
                                      <span className="text-amber-700 font-semibold">
                                        Belum Bayar
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="text-right shrink-0">
                                <div className="text-base font-extrabold font-mono tabular-nums text-slate-900">
                                  {formatRupiah(b.finalTotal)}
                                </div>
                                <div className="text-[11px] font-mono tabular-nums text-slate-400">
                                  Menu {formatRupiah(b.subtotal)}
                                  {b.taxShare > 0
                                    ? ` + Pajak ${formatRupiah(b.taxShare)}`
                                    : ''}
                                </div>
                              </div>
                            </div>

                            {(b.items.length > 0 ||
                              b.taxShare > 0 ||
                              b.serviceShare > 0 ||
                              b.deliveryShare > 0 ||
                              b.discountShare > 0) && (
                              <div className="mt-2.5 pt-2.5 border-t border-dashed border-slate-100 text-xs text-slate-600 space-y-1">
                                {b.items.map((it, i) => (
                                  <div
                                    key={i}
                                    className="flex items-center justify-between gap-2"
                                  >
                                    <span className="truncate">
                                      {it.name}{' '}
                                      {it.sharedWithCount > 1 && (
                                        <span className="text-slate-400 font-mono tabular-nums">
                                          ({formatRupiah(it.lineTotal)} ÷{' '}
                                          {it.sharedWithCount} org)
                                        </span>
                                      )}
                                    </span>
                                    <span className="font-mono tabular-nums text-slate-700 shrink-0">
                                      {formatRupiah(it.shareAmount)}
                                    </span>
                                  </div>
                                ))}

                                {(b.taxShare > 0 ||
                                  b.serviceShare > 0 ||
                                  b.deliveryShare > 0 ||
                                  b.discountShare > 0) && (
                                  <div className="pt-1.5 mt-1.5 border-t border-slate-100 space-y-1">
                                    <div className="flex items-center justify-between gap-2 text-slate-500">
                                      <span>Subtotal Pesanan</span>
                                      <span className="font-mono tabular-nums">
                                        {formatRupiah(b.subtotal)}
                                      </span>
                                    </div>
                                    {b.taxShare > 0 && (
                                      <div className="flex items-center justify-between gap-2 text-slate-700 font-medium">
                                        <span>+ Pajak (PB1 / PPN)</span>
                                        <span className="font-mono tabular-nums">
                                          +{formatRupiah(b.taxShare)}
                                        </span>
                                      </div>
                                    )}
                                    {b.serviceShare > 0 && (
                                      <div className="flex items-center justify-between gap-2 text-slate-600">
                                        <span>+ Biaya Layanan</span>
                                        <span className="font-mono tabular-nums">
                                          +{formatRupiah(b.serviceShare)}
                                        </span>
                                      </div>
                                    )}
                                    {b.deliveryShare > 0 && (
                                      <div className="flex items-center justify-between gap-2 text-slate-600">
                                        <span>+ Ongkir / Kemasan</span>
                                        <span className="font-mono tabular-nums">
                                          +{formatRupiah(b.deliveryShare)}
                                        </span>
                                      </div>
                                    )}
                                    {b.discountShare > 0 && (
                                      <div className="flex items-center justify-between gap-2 text-[#00880D] font-semibold">
                                        <span>- Diskon / Promo</span>
                                        <span className="font-mono tabular-nums">
                                          -{formatRupiah(b.discountShare)}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Touch-Friendly Action Buttons per Participant */}
                            <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleCopyText(
                                      personalLink,
                                      `link-${b.participant.id}`
                                    )
                                  }
                                  className="min-h-[38px] px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1 transition-colors whitespace-nowrap"
                                >
                                  {copiedId === `link-${b.participant.id}` ? (
                                    <>
                                      <Check className="w-3.5 h-3.5 text-[#00880D]" />
                                      <span>Tersalin</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-3.5 h-3.5" />
                                      <span>Salin Link</span>
                                    </>
                                  )}
                                </button>

                                {!isPaid ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleCopyText(
                                        buildFriendReminderText(b.participant.id),
                                        `remind-${b.participant.id}`
                                      )
                                    }
                                    className="min-h-[38px] px-3 py-1.5 rounded-full bg-[#00AED6]/10 hover:bg-[#00AED6]/20 text-[#00AED6] text-xs font-bold flex items-center gap-1 transition-colors whitespace-nowrap"
                                  >
                                    {copiedId === `remind-${b.participant.id}` ? (
                                      <>
                                        <Check className="w-3.5 h-3.5 text-[#00880D]" />
                                        <span>Teks Disalin</span>
                                      </>
                                    ) : (
                                      <>
                                        <Send className="w-3 h-3" />
                                        <span>Tagih WA</span>
                                      </>
                                    )}
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setPortalParticipantId(b.participant.id);
                                      setViewMode('portal');
                                    }}
                                    className="min-h-[38px] px-3 py-1.5 rounded-full bg-[#00880D]/10 text-[#00880D] text-xs font-bold flex items-center gap-1 transition-colors whitespace-nowrap"
                                  >
                                    <FileCheck2 className="w-3.5 h-3.5" />
                                    <span>Bukti Lunas</span>
                                  </button>
                                )}
                              </div>

                              <button
                                type="button"
                                onClick={() => {
                                  setPortalParticipantId(b.participant.id);
                                  setViewMode('portal');
                                }}
                                className="min-h-[38px] px-3 py-1.5 rounded-full text-xs font-bold text-[#00880D] hover:bg-[#00880D]/10 flex items-center gap-1 transition-colors whitespace-nowrap"
                              >
                                <span>Buka Link</span>
                                <ExternalLink className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Primary Share CTA */}
                  <div className="mt-5 space-y-2.5">
                    <button
                      type="button"
                      disabled={activeBill.participants.length === 0}
                      onClick={() => setIsShareOpen(true)}
                      className="w-full min-h-[48px] py-3 px-5 rounded-full bg-[#00880D] hover:bg-[#00700B] active:scale-[0.98] disabled:bg-slate-200 disabled:text-slate-400 text-white font-extrabold text-sm flex items-center justify-center gap-2 transition-all shadow-xs"
                    >
                      <Share2 className="w-4 h-4" />
                      <span>Bagikan Link Split Bill</span>
                    </button>

                    <button
                      type="button"
                      disabled={activeBill.participants.length === 0}
                      onClick={() => {
                        setPortalParticipantId(undefined);
                        setViewMode('portal');
                      }}
                      className="w-full min-h-[44px] py-2.5 px-4 rounded-full border border-slate-300 hover:bg-slate-50 disabled:opacity-50 text-slate-800 font-bold text-xs flex items-center justify-center gap-2 transition-colors"
                    >
                      <ExternalLink className="w-4 h-4 text-[#00AED6]" />
                      <span>Lihat Halaman Link Pembayaran</span>
                    </button>
                  </div>
                </section>

                {/* Creator QRIS & Bank Accounts Section */}
                <section className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-6 shadow-2xs">
                  <input
                    ref={qrisUploadInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleQrisFileSelect}
                    className="hidden"
                  />

                  <div className="flex flex-wrap items-center justify-between gap-2 pb-3.5 border-b border-slate-100">
                    <div>
                      <h2 className="text-sm sm:text-base font-extrabold text-slate-900 font-display flex items-center gap-1.5">
                        <Wallet className="w-4 h-4 text-[#00AED6]" />
                        <span>QRIS & Rekening Penerima</span>
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Unggah gambar QRIS Anda atau tambah nomor rekening
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setUploadingQrisChannelId('__QUICK_QRIS__');
                          qrisUploadInputRef.current?.click();
                        }}
                        className="min-h-[38px] px-3 py-1.5 rounded-full bg-[#00AED6]/10 hover:bg-[#00AED6]/20 text-[#00AED6] text-xs font-extrabold flex items-center gap-1.5 transition-colors whitespace-nowrap"
                      >
                        <QrCode className="w-3.5 h-3.5" />
                        <span>Unggah QRIS Saya</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowAddChannel(!showAddChannel)}
                        className="min-h-[38px] px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-800 flex items-center gap-1 transition-colors whitespace-nowrap"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Tambah</span>
                      </button>
                    </div>
                  </div>

                  {showAddChannel && (
                    <form
                      onSubmit={handleAddPaymentChannel}
                      className="mt-4 p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5"
                    >
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          value={newChannelProvider}
                          onChange={(e) =>
                            setNewChannelProvider(
                              e.target.value as PaymentChannel['provider']
                            )
                          }
                          className="min-h-[42px] px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-bold"
                        >
                          <option value="QRIS">QRIS</option>
                          <option value="BCA">BCA</option>
                          <option value="SeaBank">SeaBank</option>
                          <option value="Mandiri">Mandiri</option>
                          <option value="BRI">BRI</option>
                          <option value="BNI">BNI</option>
                          <option value="OVO">OVO</option>
                          <option value="DANA">DANA</option>
                          <option value="ShopeePay">ShopeePay</option>
                        </select>
                        <input
                          type="text"
                          value={newChannelNumber}
                          onChange={(e) => setNewChannelNumber(e.target.value)}
                          placeholder={
                            newChannelProvider === 'QRIS'
                              ? 'Nama Merchant / QRIS'
                              : 'Nomor Rekening / E-Wallet'
                          }
                          className="min-h-[42px] px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-mono"
                        />
                      </div>

                      {newChannelProvider === 'QRIS' && (
                        <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-white border border-slate-200">
                          <div className="flex items-center gap-2.5 min-w-0">
                            {newChannelQrisImage ? (
                              <img
                                src={newChannelQrisImage}
                                alt="Pratinjau QRIS"
                                referrerPolicy="no-referrer"
                                className="w-10 h-10 rounded object-contain border border-slate-200 shrink-0"
                              />
                            ) : (
                              <div className="w-9 h-9 rounded bg-slate-100 flex items-center justify-center text-slate-600 shrink-0">
                                <QrCode className="w-4 h-4" />
                              </div>
                            )}
                            <span className="text-xs text-slate-600 truncate">
                              {newChannelQrisImage
                                ? 'Gambar QRIS siap disimpan'
                                : 'Pilih gambar kode QRIS pribadi Anda'}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setUploadingQrisChannelId('__NEW_CHANNEL__');
                              qrisUploadInputRef.current?.click();
                            }}
                            className="min-h-[36px] px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-800 flex items-center gap-1 whitespace-nowrap shrink-0"
                          >
                            <Upload className="w-3.5 h-3.5" />
                            <span>{newChannelQrisImage ? 'Ganti' : 'Pilih'}</span>
                          </button>
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={newChannelHolder}
                          onChange={(e) => setNewChannelHolder(e.target.value)}
                          placeholder="Atas Nama Pemilik Rekening / QRIS"
                          className="flex-1 min-h-[42px] px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs"
                        />
                        <button
                          type="submit"
                          className="min-h-[42px] px-4 py-2 rounded-full bg-[#00880D] text-white text-xs font-bold whitespace-nowrap"
                        >
                          Simpan
                        </button>
                      </div>
                    </form>
                  )}

                  {activeBill.paymentChannels.length === 0 ? (
                    <div className="mt-4 p-5 rounded-2xl border border-dashed border-slate-200 text-center text-xs text-slate-400">
                      Belum ada metode pembayaran. Ketuk <strong>Unggah QRIS Saya</strong> untuk menampilkan kode QRIS Anda di halaman pembayaran teman.
                    </div>
                  ) : (
                    <div className="mt-4 space-y-2.5">
                      {activeBill.paymentChannels.map((ch) => (
                        <div
                          key={ch.id}
                          className="p-3.5 rounded-2xl border border-slate-200 space-y-2.5"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <div className="text-xs font-extrabold text-slate-900 truncate">
                                {ch.provider} · a.n. {ch.accountHolder}
                              </div>
                              <div className="text-xs font-mono tabular-nums text-slate-600 mt-0.5 truncate">
                                {ch.accountNumber}
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              {ch.provider === 'QRIS' && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setUploadingQrisChannelId(ch.id);
                                    qrisUploadInputRef.current?.click();
                                  }}
                                  className="min-h-[34px] px-2.5 py-1 rounded-full border border-slate-300 bg-white text-xs font-bold text-slate-700 flex items-center gap-1 whitespace-nowrap"
                                >
                                  <Upload className="w-3 h-3" />
                                  <span>{ch.qrisImageUrl ? 'Ganti' : 'QRIS'}</span>
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() =>
                                  setActiveBill((prev) => ({
                                    ...prev,
                                    paymentChannels: prev.paymentChannels.map(
                                      (item) =>
                                        item.id === ch.id
                                          ? { ...item, enabled: !item.enabled }
                                          : item
                                    ),
                                  }))
                                }
                                className={`min-h-[34px] px-2.5 py-1 rounded-full text-xs font-bold transition-colors ${
                                  ch.enabled
                                    ? 'bg-[#00880D]/10 text-[#00880D]'
                                    : 'bg-slate-100 text-slate-400'
                                }`}
                              >
                                {ch.enabled ? 'Aktif' : 'Off'}
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setActiveBill((prev) => ({
                                    ...prev,
                                    paymentChannels: prev.paymentChannels.filter(
                                      (item) => item.id !== ch.id
                                    ),
                                  }))
                                }
                                className="min-h-[34px] min-w-[34px] flex items-center justify-center text-slate-400 hover:text-red-600"
                                title="Hapus metode pembayaran"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {ch.provider === 'QRIS' && ch.qrisImageUrl && (
                            <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <img
                                  src={ch.qrisImageUrl}
                                  alt="QRIS Saya"
                                  referrerPolicy="no-referrer"
                                  className="w-12 h-12 rounded-lg object-contain border border-slate-200 bg-white p-0.5 shrink-0"
                                />
                                <div className="min-w-0">
                                  <span className="text-xs font-bold text-[#00880D] block">
                                    Gambar QRIS Terpasang
                                  </span>
                                  <span className="text-[11px] text-slate-500 block truncate">
                                    Tampil di link pembayaran teman
                                  </span>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() =>
                                  setActiveBill((prev) => ({
                                    ...prev,
                                    paymentChannels: prev.paymentChannels.map(
                                      (item) =>
                                        item.id === ch.id
                                          ? { ...item, qrisImageUrl: undefined }
                                          : item
                                    ),
                                  }))
                                }
                                className="text-xs text-slate-400 hover:text-red-600 px-2 py-1 shrink-0"
                              >
                                Hapus
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Fixed Bottom Thumb-Zone Navigation Bar for Mobile & Tablet (< lg) */}
      <nav
        aria-label="Navigasi Utama Mobile"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 grid grid-cols-4 items-center h-16 px-2"
      >
        <button
          type="button"
          onClick={() => {
            setViewMode('editor');
            setMobileEditorTab('input');
          }}
          className={`min-h-[48px] flex flex-col items-center justify-center rounded-xl transition-colors ${
            viewMode === 'editor' && mobileEditorTab === 'input'
              ? 'text-[#00AED6] font-extrabold'
              : 'text-slate-500 font-medium'
          }`}
        >
          <Receipt className="w-5 h-5" />
          <span className="text-[10px] tracking-tight mt-0.5">Isi Struk</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setViewMode('editor');
            setMobileEditorTab('summary');
          }}
          className={`min-h-[48px] flex flex-col items-center justify-center rounded-xl transition-colors ${
            viewMode === 'editor' && mobileEditorTab === 'summary'
              ? 'text-[#00AED6] font-extrabold'
              : 'text-slate-500 font-medium'
          }`}
        >
          <Wallet className="w-5 h-5" />
          <span className="text-[10px] tracking-tight mt-0.5">
            Rincian & QRIS
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setPortalParticipantId(undefined);
            setViewMode('portal');
          }}
          className={`min-h-[48px] flex flex-col items-center justify-center rounded-xl transition-colors ${
            viewMode === 'portal'
              ? 'text-[#00880D] font-extrabold'
              : 'text-slate-500 font-medium'
          }`}
        >
          <ExternalLink className="w-5 h-5" />
          <span className="text-[10px] tracking-tight mt-0.5">Link Bayar</span>
        </button>

        <button
          type="button"
          onClick={() => setViewMode('saved')}
          className={`min-h-[48px] flex flex-col items-center justify-center rounded-xl transition-colors ${
            viewMode === 'saved'
              ? 'text-[#00AED6] font-extrabold'
              : 'text-slate-500 font-medium'
          }`}
        >
          <History className="w-5 h-5" />
          <span className="text-[10px] tracking-tight mt-0.5">
            Riwayat ({savedBills.length})
          </span>
        </button>
      </nav>

      {/* Modals */}
      <ReceiptScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onApplyReceipt={handleApplyScannedReceipt}
      />

      <ShareLinkModal
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        bill={activeBill}
        summary={summary}
        onOpenPreviewPortal={(participantId) => {
          setPortalParticipantId(participantId);
          setViewMode('portal');
        }}
      />
    </div>
  );
}

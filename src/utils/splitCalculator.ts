import {
  SplitBill,
  BillCalculationSummary,
  ParticipantCalculation,
  ParticipantBreakdownItem,
  ParticipantBreakdownTravelItem,
} from '../types';

export function formatRupiah(amount: number): string {
  const rounded = Math.round(amount || 0);
  return 'Rp' + rounded.toLocaleString('id-ID');
}

export function calculateSplitBill(bill: SplitBill): BillCalculationSummary {
  const participants = bill.participants || [];
  const participantCount = Math.max(participants.length, 1);

  const itemsSubtotal = (bill.items || []).reduce(
    (sum, item) => sum + Math.max(0, item.qty) * Math.max(0, item.unitPrice),
    0
  );

  const rawSubtotal =
    bill.mode === 'equal' && bill.equalManualSubtotal && bill.equalManualSubtotal > 0 && bill.items.length === 0
      ? bill.equalManualSubtotal
      : itemsSubtotal;

  const computedTax = bill.useTaxPercent
    ? Math.round((rawSubtotal * Math.max(0, bill.taxPercent)) / 100)
    : Math.round(Math.max(0, bill.taxAmount));

  const computedService = bill.useServicePercent
    ? Math.round((rawSubtotal * Math.max(0, bill.servicePercent)) / 100)
    : Math.round(Math.max(0, bill.serviceAmount));

  const computedDelivery = Math.round(Math.max(0, bill.deliveryAmount || 0));
  const computedTravel = Math.round(
    (bill.travelItems || []).reduce((sum, t) => sum + Math.max(0, t.amount || 0), 0)
  );
  const computedDiscount = Math.round(Math.max(0, bill.discountAmount || 0));

  const grandTotal = Math.max(
    0,
    rawSubtotal +
      computedTax +
      computedService +
      computedDelivery +
      computedTravel -
      computedDiscount
  );

  // Map each participant's subtotal, food items, and travel expenses
  const subtotalsMap: Record<string, number> = {};
  const itemsMap: Record<string, ParticipantBreakdownItem[]> = {};
  const travelSubtotalsMap: Record<string, number> = {};
  const travelItemsMap: Record<string, ParticipantBreakdownTravelItem[]> = {};

  participants.forEach((p) => {
    subtotalsMap[p.id] = 0;
    itemsMap[p.id] = [];
    travelSubtotalsMap[p.id] = 0;
    travelItemsMap[p.id] = [];
  });

  if (bill.mode === 'equal') {
    const totalPortions = participants.reduce(
      (sum, p) => sum + Math.max(1, p.equalPortions || 1),
      0
    );
    const allNames = participants.map((p) => p.name);
    participants.forEach((p) => {
      const portions = Math.max(1, p.equalPortions || 1);
      const share = (rawSubtotal * portions) / Math.max(1, totalPortions);
      subtotalsMap[p.id] = share;
      if (rawSubtotal > 0) {
        itemsMap[p.id] = [
          {
            itemId: 'equal-share',
            name:
              portions > 1
                ? `Bagi Rata Tagihan (${portions} porsi)`
                : 'Bagi Rata Tagihan',
            totalQty: portions,
            unitPrice: Math.round(rawSubtotal),
            lineTotal: Math.round(rawSubtotal),
            sharedWithCount: totalPortions,
            sharedWithNames: allNames,
            shareAmount: Math.round(share),
          },
        ];
      }
    });
  } else {
    // Itemized mode (Food / Receipt Menu)
    (bill.items || []).forEach((item) => {
      const lineTotal = Math.max(0, item.qty) * Math.max(0, item.unitPrice);
      const validAssigned = (item.assignedTo || []).filter((id) =>
        participants.some((p) => p.id === id)
      );
      // If nobody is assigned to an item yet, split across all participants so total is accurate
      const targetIds =
        validAssigned.length > 0 ? validAssigned : participants.map((p) => p.id);
      const sharedNames = targetIds
        .map((id) => participants.find((p) => p.id === id)?.name || '')
        .filter(Boolean);

      const perPerson = lineTotal / Math.max(1, targetIds.length);
      targetIds.forEach((pid) => {
        subtotalsMap[pid] = (subtotalsMap[pid] || 0) + perPerson;
        if (!itemsMap[pid]) itemsMap[pid] = [];
        itemsMap[pid].push({
          itemId: item.id,
          name: item.name,
          totalQty: item.qty,
          unitPrice: item.unitPrice,
          lineTotal: Math.round(lineTotal),
          sharedWithCount: targetIds.length,
          sharedWithNames: sharedNames,
          shareAmount: Math.round(perPerson),
        });
      });
    });
  }

  // Separate Travel / Transport Expense Calculation (never taxed by restaurant PB1/service)
  (bill.travelItems || []).forEach((trip) => {
    const tripTotal = Math.max(0, trip.amount || 0);
    if (tripTotal <= 0) return;

    const validAssigned = (trip.assignedTo || []).filter((id) =>
      participants.some((p) => p.id === id)
    );
    const targetIds =
      validAssigned.length > 0 ? validAssigned : participants.map((p) => p.id);
    const sharedNames = targetIds
      .map((id) => participants.find((p) => p.id === id)?.name || '')
      .filter(Boolean);

    const perPerson = tripTotal / Math.max(1, targetIds.length);
    targetIds.forEach((pid) => {
      travelSubtotalsMap[pid] = (travelSubtotalsMap[pid] || 0) + perPerson;
      if (!travelItemsMap[pid]) travelItemsMap[pid] = [];
      travelItemsMap[pid].push({
        id: trip.id,
        name: trip.name,
        totalAmount: Math.round(tripTotal),
        sharedWithCount: targetIds.length,
        sharedWithNames: sharedNames,
        shareAmount: Math.round(perPerson),
      });
    });
  });

  const totalAssignedSubtotal = Object.values(subtotalsMap).reduce(
    (a, b) => a + b,
    0
  );

  const participantBreakdowns: ParticipantCalculation[] = participants.map(
    (p, idx) => {
      const pSubtotal = subtotalsMap[p.id] || 0;
      const pTravel = travelSubtotalsMap[p.id] || 0;
      const ratio =
        bill.extraRule === 'proportional' && totalAssignedSubtotal > 0
          ? pSubtotal / totalAssignedSubtotal
          : 1 / participantCount;

      // If a participant has 0 subtotal in itemized mode, they shouldn't pay restaurant tax/service unless extraRule is equal and everyone shares
      const activeRatio =
        bill.mode === 'itemized' && pSubtotal === 0 && totalAssignedSubtotal > 0
          ? 0
          : ratio;

      const taxShare = Math.round(computedTax * activeRatio);
      const serviceShare = Math.round(computedService * activeRatio);
      const deliveryShare = Math.round(computedDelivery * activeRatio);
      const travelShare = Math.round(pTravel);
      const discountShare = Math.round(computedDiscount * activeRatio);

      const finalTotal = Math.max(
        0,
        Math.round(pSubtotal) +
          taxShare +
          serviceShare +
          deliveryShare +
          travelShare -
          discountShare
      );

      return {
        participant: p,
        items: itemsMap[p.id] || [],
        travelItems: travelItemsMap[p.id] || [],
        subtotal: Math.round(pSubtotal),
        taxShare,
        serviceShare,
        deliveryShare,
        travelShare,
        discountShare,
        finalTotal,
        uniqueCode: 101 + ((idx + 1) * 17) % 890,
      };
    }
  );

  const totalPaidAmount = participantBreakdowns
    .filter((b) => b.participant.status === 'paid')
    .reduce((sum, b) => sum + b.finalTotal, 0);

  const totalUnpaidAmount = participantBreakdowns
    .filter((b) => b.participant.status !== 'paid')
    .reduce((sum, b) => sum + b.finalTotal, 0);

  const paidCount = participantBreakdowns.filter(
    (b) => b.participant.status === 'paid'
  ).length;

  return {
    rawSubtotal: Math.round(rawSubtotal),
    computedTax,
    computedService,
    computedDelivery,
    computedTravel,
    computedDiscount,
    grandTotal,
    totalPaidAmount,
    totalUnpaidAmount,
    paidCount,
    participantBreakdowns,
  };
}

// Compress uploaded QRIS or proof image so it stays fast and scannable
export function compressImageToDataUrl(
  file: File,
  maxDimension = 640,
  quality = 0.82
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Gagal membaca file gambar.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => resolve(reader.result as string);
      img.onload = () => {
        const scale = Math.min(
          1,
          maxDimension / Math.max(img.width || 1, img.height || 1)
        );
        const width = Math.round(img.width * scale);
        const height = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(reader.result as string);
          return;
        }
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

// Compact schema for ultra-short URLs
export function encodeBillToUrlParam(bill: SplitBill): string {
  try {
    const compact = {
      v: 2,
      i: bill.id,
      t: bill.title || '',
      c: bill.creatorName || '',
      d: bill.date || '',
      g: bill.category || '',
      m: bill.mode === 'equal' ? 'e' : 'i',
      r: bill.extraRule === 'equal' ? 'e' : 'p',
      tp: bill.taxPercent || 0,
      ta: bill.taxAmount || 0,
      sp: bill.servicePercent || 0,
      sa: bill.serviceAmount || 0,
      dl: bill.deliveryAmount || 0,
      ds: bill.discountAmount || 0,
      k: (bill.paymentChannels || [])
        .filter((c) => c.enabled)
        .map((c) => [
          c.id,
          c.provider,
          c.accountNumber,
          c.accountHolder,
          c.qrisRawString || '',
        ]),
      p: (bill.participants || []).map((p) => [
        p.id,
        p.name,
        p.status === 'paid' ? 1 : 0,
        p.paidVia || '',
        p.paidAt || '',
        p.phoneOrHandle || '',
      ]),
      it: (bill.items || []).map((it) => [
        it.id,
        it.name,
        it.qty,
        it.unitPrice,
        it.assignedTo,
      ]),
      tr: (bill.travelItems || []).map((t) => [
        t.id,
        t.name,
        t.amount,
        t.assignedTo,
      ]),
    };
    const json = JSON.stringify(compact);
    const bytes = new TextEncoder().encode(json);
    let binary = '';
    bytes.forEach((b) => {
      binary += String.fromCharCode(b);
    });
    return btoa(binary)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  } catch {
    return '';
  }
}

export function decodeBillFromUrlParam(encoded: string): SplitBill | null {
  try {
    const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '==='.slice((base64.length + 3) % 4);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const json = new TextDecoder().decode(bytes);
    const parsed = JSON.parse(json);

    // If version 2 compact schema
    if (parsed && parsed.v === 2) {
      return {
        id: parsed.i || `sb-${Date.now().toString(36)}`,
        title: parsed.t || '',
        creatorName: parsed.c || '',
        date: parsed.d || new Date().toISOString().slice(0, 10),
        category: parsed.g || 'Makan & Minum',
        createdAt: new Date().toISOString(),
        mode: parsed.m === 'e' ? 'equal' : 'itemized',
        extraRule: parsed.r === 'e' ? 'equal' : 'proportional',
        taxPercent: Number(parsed.tp) || 0,
        taxAmount: Number(parsed.ta) || 0,
        useTaxPercent: Boolean(parsed.tp),
        servicePercent: Number(parsed.sp) || 0,
        serviceAmount: Number(parsed.sa) || 0,
        useServicePercent: Boolean(parsed.sp),
        deliveryAmount: Number(parsed.dl) || 0,
        discountAmount: Number(parsed.ds) || 0,
        notes: '',
        paymentChannels: Array.isArray(parsed.k)
          ? parsed.k.map((c: any) => ({
              id: c[0] || `ch-${Math.random().toString(36).slice(2, 6)}`,
              provider: c[1] || 'Transfer',
              accountNumber: c[2] || '',
              accountHolder: c[3] || '',
              enabled: true,
              qrisRawString: c[4] || undefined,
            }))
          : [],
        participants: Array.isArray(parsed.p)
          ? parsed.p.map((p: any) => ({
              id: p[0],
              name: p[1] || 'Teman',
              status: p[2] === 1 ? 'paid' : 'unpaid',
              paidVia: p[3] || undefined,
              paidAt: p[4] || undefined,
              phoneOrHandle: p[5] || undefined,
            }))
          : [],
        items: Array.isArray(parsed.it)
          ? parsed.it.map((it: any) => ({
              id: it[0],
              name: it[1] || 'Menu',
              qty: Number(it[2]) || 1,
              unitPrice: Number(it[3]) || 0,
              assignedTo: Array.isArray(it[4]) ? it[4] : [],
            }))
          : [],
        travelItems: Array.isArray(parsed.tr)
          ? parsed.tr.map((t: any) => ({
              id: t[0] || `tr-${Math.random().toString(36).slice(2, 6)}`,
              name: t[1] || 'Perjalanan',
              amount: Number(t[2]) || 0,
              assignedTo: Array.isArray(t[3]) ? t[3] : [],
            }))
          : [],
      };
    }

    return parsed as SplitBill;
  } catch {
    return null;
  }
}

export function buildShareablePaymentLink(
  bill: SplitBill,
  participantId?: string,
  includeDataFallback: boolean = false
): string {
  const baseUrl =
    typeof window !== 'undefined' && window.location
      ? window.location.origin + window.location.pathname
      : 'https://patungans.vercel.app/';
  const params = new URLSearchParams();
  params.set('pay', bill.id);
  if (participantId) {
    params.set('p', participantId);
  }
  if (includeDataFallback) {
    const encoded = encodeBillToUrlParam(bill);
    if (encoded) {
      params.set('d', encoded);
    }
  }
  return `${baseUrl}?${params.toString()}`;
}

export async function fetchShortenedUrl(longUrl: string): Promise<string> {
  try {
    const res = await fetch(`/api/shorten?url=${encodeURIComponent(longUrl)}`);
    if (res.ok) {
      const data = await res.json();
      if (data?.shortUrl) {
        return data.shortUrl;
      }
    }
  } catch {
    // fallback
  }
  return longUrl;
}

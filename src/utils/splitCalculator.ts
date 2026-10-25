import {
  SplitBill,
  BillCalculationSummary,
  ParticipantCalculation,
  ParticipantBreakdownItem,
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
  const computedDiscount = Math.round(Math.max(0, bill.discountAmount || 0));

  const grandTotal = Math.max(
    0,
    rawSubtotal + computedTax + computedService + computedDelivery - computedDiscount
  );

  // Map each participant's subtotal and items
  const subtotalsMap: Record<string, number> = {};
  const itemsMap: Record<string, ParticipantBreakdownItem[]> = {};

  participants.forEach((p) => {
    subtotalsMap[p.id] = 0;
    itemsMap[p.id] = [];
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
    });
  } else {
    // Itemized mode
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

  const totalAssignedSubtotal = Object.values(subtotalsMap).reduce(
    (a, b) => a + b,
    0
  );

  const participantBreakdowns: ParticipantCalculation[] = participants.map(
    (p, idx) => {
      const pSubtotal = subtotalsMap[p.id] || 0;
      const ratio =
        bill.extraRule === 'proportional' && totalAssignedSubtotal > 0
          ? pSubtotal / totalAssignedSubtotal
          : 1 / participantCount;

      // If a participant has 0 subtotal in itemized mode, they shouldn't pay tax/service unless extraRule is equal and everyone shares
      const activeRatio =
        bill.mode === 'itemized' && pSubtotal === 0 && totalAssignedSubtotal > 0
          ? 0
          : ratio;

      const taxShare = Math.round(computedTax * activeRatio);
      const serviceShare = Math.round(computedService * activeRatio);
      const deliveryShare = Math.round(computedDelivery * activeRatio);
      const discountShare = Math.round(computedDiscount * activeRatio);

      const finalTotal = Math.max(
        0,
        Math.round(pSubtotal) +
          taxShare +
          serviceShare +
          deliveryShare -
          discountShare
      );

      return {
        participant: p,
        items: itemsMap[p.id] || [],
        subtotal: Math.round(pSubtotal),
        taxShare,
        serviceShare,
        deliveryShare,
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

// Encode bill into URL-safe base64 string so shared links work anywhere without requiring login
export function encodeBillToUrlParam(bill: SplitBill): string {
  try {
    // Strip heavy base64 images from the query param if > 4KB so URL stays short;
    // the full qrisImageUrl and proofImageUrl are persisted on /api/bills/:id
    const lightBill: SplitBill = {
      ...bill,
      paymentChannels: bill.paymentChannels.map((ch) => ({
        ...ch,
        qrisImageUrl:
          ch.qrisImageUrl && ch.qrisImageUrl.length > 4000
            ? undefined
            : ch.qrisImageUrl,
      })),
      participants: bill.participants.map((p) => ({
        ...p,
        proofImageUrl:
          p.proofImageUrl && p.proofImageUrl.length > 4000
            ? undefined
            : p.proofImageUrl,
      })),
    };
    const json = JSON.stringify(lightBill);
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
    return JSON.parse(json) as SplitBill;
  } catch {
    return null;
  }
}

export function buildShareablePaymentLink(
  bill: SplitBill,
  participantId?: string
): string {
  const baseUrl = window.location.origin + window.location.pathname;
  const encoded = encodeBillToUrlParam(bill);
  const params = new URLSearchParams();
  params.set('pay', bill.id);
  if (participantId) {
    params.set('p', participantId);
  }
  if (encoded) {
    params.set('d', encoded);
  }
  return `${baseUrl}?${params.toString()}`;
}

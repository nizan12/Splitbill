import jsQR from 'jsqr';
import QRCode from 'qrcode';
import { calculateCRC16 } from './crc16';
import { parseTLV, parseQRIS } from './parser';
import { convertQRIS } from './converter';
import { validateQRIS } from './validator';
import type { TLV, QRISData, ConvertOptions, ValidationResult } from './types';

export {
  calculateCRC16,
  parseTLV,
  parseQRIS,
  convertQRIS,
  validateQRIS,
};
export type { TLV, QRISData, ConvertOptions, ValidationResult };

/**
 * Checks if a string looks like an Indonesian EMVCo QRIS string.
 */
export function isQRISString(str: string): boolean {
  if (!str) return false;
  const s = str.trim();
  return s.startsWith('000201') && s.length >= 30;
}

/**
 * Decodes raw QR code content from an image source (data URL, blob, file, or image URL)
 * using jsQR.
 */
export async function decodeQRFromImage(
  input: string | File | Blob
): Promise<string | null> {
  if (typeof window === 'undefined') return null;

  return new Promise((resolve) => {
    let src = '';
    let shouldRevoke = false;

    if (typeof input === 'string') {
      src = input;
    } else if (typeof Blob !== 'undefined' && input instanceof Blob) {
      src = URL.createObjectURL(input);
      shouldRevoke = true;
    } else {
      resolve(null);
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';

    const cleanup = () => {
      if (shouldRevoke && src) {
        URL.revokeObjectURL(src);
      }
    };

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          cleanup();
          resolve(null);
          return;
        }

        // Limit size to max 1200px for speedy and accurate QR scanning
        let w = img.naturalWidth || img.width;
        let h = img.naturalHeight || img.height;
        const maxDim = 1200;
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }

        canvas.width = w;
        canvas.height = h;
        ctx.drawImage(img, 0, 0, w, h);

        const imgData = ctx.getImageData(0, 0, w, h);
        const code = jsQR(imgData.data, w, h, {
          inversionAttempts: 'attemptBoth',
        });

        cleanup();
        if (code && code.data) {
          resolve(code.data.trim());
        } else {
          resolve(null);
        }
      } catch (err) {
        cleanup();
        console.warn('Error reading QR from canvas:', err);
        resolve(null);
      }
    };

    img.onerror = () => {
      cleanup();
      resolve(null);
    };

    img.src = src;
  });
}

/**
 * Generates dynamic QRIS string and returns a dataURL image with the specified amount.
 * Powered by verssache/qris-dinamis
 */
export async function generateDynamicQRIS(
  staticQrisString: string,
  amount: number,
  options?: {
    fee?: {
      type: 'fixed' | 'percentage';
      value: number;
    };
    width?: number;
  }
): Promise<{ dynamicQrisString: string; qrDataUrl: string }> {
  const dynamicQrisString = convertQRIS(staticQrisString, {
    amount: Math.round(amount),
    fee: options?.fee,
  });

  const qrDataUrl = await QRCode.toDataURL(dynamicQrisString, {
    width: options?.width || 320,
    margin: 2,
    errorCorrectionLevel: 'M',
    color: {
      dark: '#000000',
      light: '#FFFFFF',
    },
  });

  return { dynamicQrisString, qrDataUrl };
}

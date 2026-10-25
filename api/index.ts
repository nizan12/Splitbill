import express, { Request, Response } from "express";
import fs from "fs";
import path from "path";
import os from "os";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";

export const app = express();
app.use(express.json({ limit: "15mb" }));

// In Vercel / serverless environments, process.cwd() is read-only, so use os.tmpdir()
const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const DATA_DIR = isServerless
  ? path.join(os.tmpdir(), "patunganpay-data")
  : path.resolve(process.cwd(), "data");
const BILLS_FILE = path.join(DATA_DIR, "bills.json");

// In-memory fallback
const memoryBills: Record<string, any> = {};

function ensureDataDir() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(BILLS_FILE)) {
      fs.writeFileSync(BILLS_FILE, JSON.stringify({}), "utf-8");
    }
  } catch {
    // If filesystem is restricted, memoryBills serves as fallback
  }
}

function readBills(): Record<string, any> {
  try {
    ensureDataDir();
    if (fs.existsSync(BILLS_FILE)) {
      const raw = fs.readFileSync(BILLS_FILE, "utf-8");
      const parsed = JSON.parse(raw || "{}");
      return { ...memoryBills, ...parsed };
    }
  } catch {
    // fallback
  }
  return memoryBills;
}

function writeBills(bills: Record<string, any>) {
  Object.assign(memoryBills, bills);
  try {
    ensureDataDir();
    fs.writeFileSync(BILLS_FILE, JSON.stringify(bills, null, 2), "utf-8");
  } catch {
    // In-memory fallback already has the data
  }
}

export const apiRouter = express.Router();

apiRouter.get("/", (_req, res) => {
  res.json({ status: "ok", app: "PatunganPay API" });
});

apiRouter.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Get all saved split bills
apiRouter.get("/bills", (_req, res) => {
  try {
    const bills = readBills();
    const list = Object.values(bills).sort(
      (a: any, b: any) =>
        new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    );
    res.json({ bills: list });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Gagal membaca tagihan." });
  }
});

// Get single bill by ID
apiRouter.get("/bills/:id", (req, res) => {
  try {
    const bills = readBills();
    const bill = bills[req.params.id];
    if (!bill) {
      res.status(404).json({ error: "Tagihan tidak ditemukan." });
      return;
    }
    res.json({ bill });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Gagal membaca tagihan." });
  }
});

// Create or update a split bill
apiRouter.post("/bills", (req, res) => {
  try {
    const bill = req.body;
    if (!bill || !bill.id) {
      res.status(400).json({ error: "Data tagihan tidak valid." });
      return;
    }
    const bills = readBills();
    bills[bill.id] = {
      ...bill,
      updatedAt: new Date().toISOString(),
    };
    writeBills(bills);
    res.json({ bill: bills[bill.id] });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Gagal menyimpan tagihan." });
  }
});

// Friend confirms payment or creator toggles payment status via link
apiRouter.patch("/bills/:id/pay", (req, res) => {
  try {
    const {
      participantId,
      status,
      paidVia,
      paidNote,
      proofImageUrl,
      proofRefNumber,
      billSnapshot,
    } = req.body;
    const bills = readBills();
    let bill = bills[req.params.id];

    if (!bill && billSnapshot && billSnapshot.id === req.params.id) {
      bill = billSnapshot;
    }

    if (!bill) {
      res.status(404).json({ error: "Tagihan tidak ditemukan." });
      return;
    }

    bill.participants = (bill.participants || []).map((p: any) => {
      if (p.id === participantId) {
        return {
          ...p,
          status: status || "paid",
          paidAt: status === "unpaid" ? undefined : new Date().toISOString(),
          paidVia: paidVia || p.paidVia || "Transfer",
          paidNote: paidNote !== undefined ? paidNote : p.paidNote,
          proofImageUrl:
            status === "unpaid"
              ? undefined
              : proofImageUrl !== undefined
              ? proofImageUrl
              : p.proofImageUrl,
          proofRefNumber:
            status === "unpaid"
              ? undefined
              : proofRefNumber !== undefined
              ? proofRefNumber
              : p.proofRefNumber,
        };
      }
      return p;
    });

    bill.updatedAt = new Date().toISOString();
    bills[bill.id] = bill;
    writeBills(bills);

    res.json({ bill });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Gagal memperbarui status pembayaran." });
  }
});

// Scan Receipt via Gemini Vision / OCR (Supports 1 or multiple receipt images)
apiRouter.post("/scan-receipt", async (req, res) => {
  try {
    const { imageBase64, mimeType, images, rawText } = req.body;

    // Normalise images array (supports single imageBase64 or array of images)
    const imageList: Array<{ imageBase64: string; mimeType?: string }> = [];
    if (Array.isArray(images) && images.length > 0) {
      imageList.push(...images.filter((img) => img && img.imageBase64));
    } else if (imageBase64) {
      imageList.push({ imageBase64, mimeType: mimeType || "image/jpeg" });
    }

    if (imageList.length === 0 && !rawText) {
      res.status(400).json({ error: "Harap unggah minimal satu foto struk atau masukkan teks struk." });
      return;
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      res.status(400).json({
        error:
          "GEMINI_API_KEY belum dikonfigurasi. Tambahkan GEMINI_API_KEY di Vercel Dashboard (Settings > Environment Variables).",
      });
      return;
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });

    const promptText =
      `Ekstrak struk berikut (terdiri dari ${imageList.length > 0 ? imageList.length + ' foto struk' : 'teks struk'}) menjadi satu objek JSON murni dengan format persis:\n` +
      `{"title":"Nama Toko/Resto","category":"Makan & Minum","items":[{"name":"Nama Menu","qty":1,"unitPrice":25000}],"taxAmount":0,"serviceAmount":0,"deliveryAmount":0,"discountAmount":0}\n` +
      `Aturan:\n` +
      `- Jika ada beberapa foto struk (misalnya struk panjang bersambung, halaman 1 & 2, atau beberapa pesanan toko berbeda), gabungkan semua menu ke dalam array items menjadi satu kesatuan utuh.\n` +
      `- Semua nominal dalam angka bulat Rupiah tanpa tanda titik atau koma (contoh: 45.000 -> 45000, 11.500 -> 11500).\n` +
      `- unitPrice adalah harga satuan per 1 item (jika tertulis 2x 25.000 = 50.000, maka qty: 2, unitPrice: 25000).\n` +
      `- Jangan masukkan baris subtotal, total, bayar, atau kembalian ke dalam array items.\n` +
      `- Jumlahkan taxAmount (pajak), serviceAmount (layanan), deliveryAmount (ongkir), dan discountAmount (diskon) dari seluruh struk yang disertakan.\n` +
      (rawText ? `\nTeks tambahan:\n${rawText}` : "");

    // Gemini Multimodal best practice: prompt text first, then images
    const parts: any[] = [{ text: promptText }];
    for (const img of imageList) {
      parts.push({
        inlineData: {
          data: img.imageBase64,
          mimeType: img.mimeType || "image/jpeg",
        },
      });
    }

    let rawJson = "";
    const candidateModels = [
      "gemini-3.5-flash-lite",
      "gemini-flash-lite-latest",
      "gemini-3.8-flash",
    ];

    for (const modelName of candidateModels) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: parts,
          config: {
            temperature: 0.1,
            responseMimeType: "application/json",
          },
        });
        if (response.text) {
          rawJson = response.text.trim();
          break;
        }
      } catch (modelErr: any) {
        console.warn(`Model ${modelName} encountered issue: ${modelErr?.message}, trying next model...`);
      }
    }

    if (!rawJson) {
      throw new Error("Layanan AI Gemini sedang mengalami lonjakan trafik. Silakan coba lagi dalam beberapa detik.");
    }

    const parsed = JSON.parse(rawJson);
    const rawItems =
      parsed.items || parsed.menu || parsed.itemList || parsed.daftarMenu || [];

    const normalizedItems = Array.isArray(rawItems)
      ? rawItems
          .map((it: any) => ({
            name: String(it.name || it.item || it.title || it.menu || "Menu").trim(),
            qty: Math.max(1, Number(it.qty || it.quantity || it.jumlah || it.count || 1) || 1),
            unitPrice: Math.max(
              0,
              Math.round(Number(it.unitPrice || it.price || it.harga || it.amount || 0) || 0)
            ),
          }))
          .filter((it: any) => it.name && it.unitPrice > 0)
      : [];

    if (normalizedItems.length === 0) {
      throw new Error(
        "AI belum berhasil mendeteksi daftar item dari foto. Pastikan teks pada foto struk terlihat jelas dan coba scan ulang."
      );
    }

    const normalized = {
      title: String(parsed.title || "Struk Tagihan"),
      category: String(parsed.category || "Makan & Minum"),
      items: normalizedItems,
      taxAmount: Math.max(0, Math.round(Number(parsed.taxAmount || 0) || 0)),
      serviceAmount: Math.max(
        0,
        Math.round(Number(parsed.serviceAmount || 0) || 0)
      ),
      deliveryAmount: Math.max(
        0,
        Math.round(Number(parsed.deliveryAmount || 0) || 0)
      ),
      discountAmount: Math.max(
        0,
        Math.round(Math.abs(Number(parsed.discountAmount || 0) || 0))
      ),
    };

    res.json({ receipt: normalized });
  } catch (error: any) {
    console.error("Receipt scan error:", error);
    res.status(500).json({
      error:
        error?.message ||
        "Gagal memindai struk secara otomatis. Silakan coba lagi atau gunakan input manual.",
    });
  }
});

// Mount on both /api and / so all Vercel and local path formats match
app.use("/api", apiRouter);
app.use("/", apiRouter);

// Error handling middleware
app.use((err: any, _req: Request, res: Response, _next: any) => {
  console.error("API error:", err);
  res.status(500).json({ error: err?.message || "Internal Server Error" });
});

// Default export as standard Vercel serverless function handler
export default function handler(req: any, res: any) {
  return app(req, res);
}

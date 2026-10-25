import express from "express";
import fs from "fs";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, ThinkingLevel, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "15mb" }));

const DATA_DIR = path.resolve(process.cwd(), "data");
const BILLS_FILE = path.join(DATA_DIR, "bills.json");

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(BILLS_FILE)) {
    fs.writeFileSync(BILLS_FILE, JSON.stringify({}), "utf-8");
  }
}

function readBills(): Record<string, any> {
  try {
    ensureDataDir();
    const raw = fs.readFileSync(BILLS_FILE, "utf-8");
    return JSON.parse(raw || "{}");
  } catch {
    return {};
  }
}

function writeBills(bills: Record<string, any>) {
  try {
    ensureDataDir();
    fs.writeFileSync(BILLS_FILE, JSON.stringify(bills, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to write bills:", err);
  }
}

// Get all saved split bills
app.get("/api/bills", (_req, res) => {
  const bills = readBills();
  const list = Object.values(bills).sort(
    (a: any, b: any) =>
      new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
  );
  res.json({ bills: list });
});

// Get single bill by ID
app.get("/api/bills/:id", (req, res) => {
  const bills = readBills();
  const bill = bills[req.params.id];
  if (!bill) {
    res.status(404).json({ error: "Tagihan tidak ditemukan." });
    return;
  }
  res.json({ bill });
});

// Create or update a split bill
app.post("/api/bills", (req, res) => {
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
});

// Friend confirms payment or creator toggles payment status via link
app.patch("/api/bills/:id/pay", (req, res) => {
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

  // If bill came from a self-contained URL link and wasn't stored on server yet, hydrate it
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
});

// Scan Receipt via Fast Gemini Flash-Lite Vision / Text OCR (<1.5s latency)
app.post("/api/scan-receipt", async (req, res) => {
  try {
    const { imageBase64, mimeType, rawText } = req.body;
    if (!imageBase64 && !rawText) {
      res.status(400).json({ error: "Harap unggah foto struk atau masukkan teks struk." });
      return;
    }

    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });

    const parts: any[] = [];
    if (imageBase64) {
      parts.push({
        inlineData: {
          data: imageBase64,
          mimeType: mimeType || "image/jpeg",
        },
      });
    }
    parts.push({
      text:
        `Ekstrak struk berikut menjadi objek JSON murni dengan format persis:\n` +
        `{"title":"Nama Toko/Resto","category":"Makan & Minum","items":[{"name":"Nama Menu","qty":1,"unitPrice":25000}],"taxAmount":0,"serviceAmount":0,"deliveryAmount":0,"discountAmount":0}\n` +
        `Aturan:\n` +
        `- Semua nominal dalam angka bulat Rupiah (contoh: 45.000 -> 45000).\n` +
        `- unitPrice adalah harga satuan per 1 item (jika tertulis 2x 25.000 = 50.000, maka qty: 2, unitPrice: 25000).\n` +
        `- Jangan masukkan subtotal/total akhir ke dalam array items.\n` +
        (rawText ? `\nTeks struk:\n${rawText}` : ""),
    });

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite",
      contents: { parts },
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
        temperature: 0.1,
        responseMimeType: "application/json",
      },
    });

    const rawJson = (response.text || "{}").trim();
    const parsed = JSON.parse(rawJson);

    const normalized = {
      title: String(parsed.title || "Struk Tagihan"),
      category: String(parsed.category || "Makan & Minum"),
      items: Array.isArray(parsed.items)
        ? parsed.items
            .map((it: any) => ({
              name: String(it.name || it.item || "Menu").trim(),
              qty: Math.max(1, Number(it.qty || it.quantity || 1) || 1),
              unitPrice: Math.max(
                0,
                Math.round(Number(it.unitPrice || it.price || 0) || 0)
              ),
            }))
            .filter((it: any) => it.name && it.unitPrice > 0)
        : [],
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

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`PatunganPay server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

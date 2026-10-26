import express, { Request, Response } from "express";
import fs from "fs";
import path from "path";
import os from "os";
import { GoogleGenAI } from "@google/genai";

export const app = express();
app.use(express.json({ limit: "15mb" }));

// In Vercel / serverless environments, process.cwd() is read-only, so use os.tmpdir()
const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const DATA_DIR = isServerless
  ? path.join(os.tmpdir(), "patunganpay-data")
  : path.resolve(process.cwd(), "data");
const BILLS_FILE = path.join(DATA_DIR, "bills.json");
const USERS_FILE = path.join(DATA_DIR, "users.json");

// In-memory fallback
const memoryBills: Record<string, any> = {};
const memoryUsers: Record<string, any> = {};

function ensureDataDir() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(BILLS_FILE)) {
      fs.writeFileSync(BILLS_FILE, JSON.stringify({}), "utf-8");
    }
    if (!fs.existsSync(USERS_FILE)) {
      fs.writeFileSync(USERS_FILE, JSON.stringify({}), "utf-8");
    }
  } catch {
    // If filesystem is restricted, memory objects serve as fallback
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

function readUsers(): Record<string, any> {
  try {
    ensureDataDir();
    if (fs.existsSync(USERS_FILE)) {
      const raw = fs.readFileSync(USERS_FILE, "utf-8");
      const parsed = JSON.parse(raw || "{}");
      return { ...memoryUsers, ...parsed };
    }
  } catch {
    // fallback
  }
  return memoryUsers;
}

function writeUsers(users: Record<string, any>) {
  Object.assign(memoryUsers, users);
  try {
    ensureDataDir();
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), "utf-8");
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

// Sync or register a user profile so friends can find them by name/email
apiRouter.post("/users/sync", (req, res) => {
  try {
    const { uid, displayName, email, photoURL, phoneOrHandle } = req.body || {};
    if (!uid && !email) {
      res.status(400).json({ error: "UID atau email diperlukan." });
      return;
    }

    const users = readUsers();
    const key = uid || String(email).toLowerCase();
    const existing = users[key] || {};

    users[key] = {
      uid: uid || existing.uid || key,
      displayName: String(displayName || existing.displayName || email?.split("@")[0] || "Pengguna").trim(),
      email: String(email || existing.email || "").trim().toLowerCase(),
      photoURL: photoURL || existing.photoURL || "",
      phoneOrHandle: phoneOrHandle || existing.phoneOrHandle || "",
      updatedAt: new Date().toISOString(),
    };

    writeUsers(users);
    res.json({ user: users[key] });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Gagal menyimpan profil pengguna." });
  }
});

// Search / list registered users (also extracts known participant profiles from existing bills)
apiRouter.get("/users", (req, res) => {
  try {
    const q = String(req.query.q || "").trim().toLowerCase();
    const usersMap = readUsers();
    const bills = readBills();

    // Also harvest any registered owners/participants from bills so directory is always rich
    const combined = new Map<string, any>();

    for (const u of Object.values(usersMap)) {
      if (u && (u.email || u.uid)) {
        const key = (u.email || u.uid).toLowerCase();
        combined.set(key, u);
      }
    }

    for (const bill of Object.values(bills)) {
      if (bill?.ownerId && bill?.ownerEmail) {
        const key = String(bill.ownerEmail).toLowerCase();
        if (!combined.has(key)) {
          combined.set(key, {
            uid: bill.ownerId,
            displayName: bill.creatorName || bill.ownerEmail.split("@")[0],
            email: String(bill.ownerEmail).toLowerCase(),
            photoURL: "",
          });
        }
      }
      if (Array.isArray(bill?.participants)) {
        for (const p of bill.participants) {
          if (p?.email) {
            const key = String(p.email).toLowerCase();
            if (!combined.has(key)) {
              combined.set(key, {
                uid: p.userId || key,
                displayName: p.name || p.email.split("@")[0],
                email: key,
                photoURL: p.photoURL || "",
                phoneOrHandle: p.phoneOrHandle || "",
              });
            }
          }
        }
      }
    }

    let list = Array.from(combined.values());
    if (q) {
      list = list.filter(
        (u) =>
          String(u.displayName || "").toLowerCase().includes(q) ||
          String(u.email || "").toLowerCase().includes(q) ||
          String(u.phoneOrHandle || "").toLowerCase().includes(q)
      );
    }

    res.json({ users: list.slice(0, 30) });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Gagal memuat daftar pengguna." });
  }
});

// Get saved split bills (supports filtering by userId, email, and/or local bill ids)
apiRouter.get("/bills", (req, res) => {
  try {
    const userId = String(req.query.userId || "").trim();
    const email = String(req.query.email || "").trim().toLowerCase();
    const idsParam = String(req.query.ids || "").trim();
    const idSet = new Set(
      idsParam
        ? idsParam
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : []
    );

    const bills = readBills();
    let list = Object.values(bills);

    // If any filter is provided, return bills matching the user's ownership, participation, or visited IDs
    if (userId || email || idSet.size > 0) {
      list = list.filter((bill: any) => {
        if (!bill || !bill.id) return false;
        const hasTitle = Boolean(String(bill.title || "").trim());
        const hasItems = Array.isArray(bill.items) && bill.items.length > 0;
        const hasTravel = Array.isArray(bill.travelItems) && bill.travelItems.length > 0;
        if (!hasTitle && !hasItems && !hasTravel) return false;

        if (idSet.has(bill.id)) return true;
        if (userId && bill.ownerId === userId) return true;
        if (email && String(bill.ownerEmail || "").toLowerCase() === email) return true;

        if (Array.isArray(bill.participants)) {
          const isParticipant = bill.participants.some((p: any) => {
            if (userId && p.userId && p.userId === userId) return true;
            if (email && p.email && String(p.email).toLowerCase() === email) return true;
            return false;
          });
          if (isParticipant) return true;
        }
        return false;
      });
    } else {
      list = list.filter((bill: any) => {
        if (!bill || !bill.id) return false;
        const hasTitle = Boolean(String(bill.title || "").trim());
        const hasItems = Array.isArray(bill.items) && bill.items.length > 0;
        const hasTravel = Array.isArray(bill.travelItems) && bill.travelItems.length > 0;
        return hasTitle || hasItems || hasTravel;
      });
    }

    list.sort(
      (a: any, b: any) =>
        new Date(b.updatedAt || b.createdAt || 0).getTime() -
        new Date(a.updatedAt || a.createdAt || 0).getTime()
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

// Delete a bill by ID
apiRouter.delete("/bills/:id", (req, res) => {
  try {
    const billId = req.params.id;
    const bills = readBills();
    delete bills[billId];
    delete memoryBills[billId];
    try {
      ensureDataDir();
      fs.writeFileSync(BILLS_FILE, JSON.stringify(bills, null, 2), "utf-8");
    } catch {
      // ignore
    }
    res.json({ deleted: true, id: billId });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Gagal menghapus tagihan." });
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

    // Automatically match participant emails against registered users if userId isn't set yet
    const users = readUsers();
    const emailToUser = new Map<string, any>();
    for (const u of Object.values(users)) {
      if (u?.email) {
        emailToUser.set(String(u.email).toLowerCase(), u);
      }
    }

    if (Array.isArray(bill.participants)) {
      bill.participants = bill.participants.map((p: any) => {
        if (p?.email) {
          const matched = emailToUser.get(String(p.email).toLowerCase());
          if (matched) {
            return {
              ...p,
              email: String(p.email).toLowerCase(),
              userId: p.userId || matched.uid,
              photoURL: p.photoURL || matched.photoURL || undefined,
            };
          }
        }
        return p;
      });
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

// Claim / Link a participant slot to a logged-in user account so the bill stays in their history
apiRouter.post("/bills/:id/claim", (req, res) => {
  try {
    const { participantId, userId, email, displayName, photoURL, billSnapshot } = req.body || {};
    if (!userId && !email) {
      res.status(400).json({ error: "Data akun diperlukan untuk menautkan tagihan." });
      return;
    }

    const bills = readBills();
    let bill = bills[req.params.id];
    if (!bill && billSnapshot && billSnapshot.id === req.params.id) {
      bill = billSnapshot;
    }
    if (!bill) {
      res.status(404).json({ error: "Tagihan tidak ditemukan." });
      return;
    }

    const normEmail = email ? String(email).trim().toLowerCase() : undefined;
    let matchedAny = false;

    bill.participants = (bill.participants || []).map((p: any) => {
      const isTargetById = participantId && p.id === participantId;
      const isTargetByEmail = normEmail && p.email && String(p.email).toLowerCase() === normEmail;
      const isTargetByName =
        !participantId &&
        displayName &&
        String(p.name || "").trim().toLowerCase() === String(displayName).trim().toLowerCase();

      if (isTargetById || isTargetByEmail || isTargetByName) {
        matchedAny = true;
        return {
          ...p,
          userId: userId || p.userId,
          email: normEmail || p.email,
          photoURL: photoURL || p.photoURL,
        };
      }
      return p;
    });

    if (matchedAny) {
      bill.updatedAt = new Date().toISOString();
      bills[bill.id] = bill;
      writeBills(bills);
    }

    res.json({ bill, linked: matchedAny });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Gagal menautkan akun ke tagihan." });
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
      userId,
      email,
      photoURL,
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
          userId: userId || p.userId,
          email: email ? String(email).toLowerCase() : p.email,
          photoURL: photoURL || p.photoURL,
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

// Shorten URL via TinyURL for compact social sharing
apiRouter.get("/shorten", async (req, res) => {
  try {
    const longUrl = req.query.url as string;
    if (!longUrl) {
      res.status(400).json({ error: "Parameter url diperlukan." });
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);

    const response = await fetch(
      `https://tinyurl.com/api-create.php?url=${encodeURIComponent(longUrl)}`,
      { signal: controller.signal }
    );
    clearTimeout(timeout);

    if (response.ok) {
      const shortUrl = (await response.text()).trim();
      if (shortUrl.startsWith("http")) {
        res.json({ shortUrl });
        return;
      }
    }
    res.json({ shortUrl: longUrl });
  } catch {
    res.json({ shortUrl: (req.query.url as string) || "" });
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
      `PENTING - ATURAN FORMAT NOMINAL & KUANTITAS (QTY):\n` +
      `1. TANDA TITIK (.) PADA STRUK INDONESIA ADALAH PEMISAH RIBUAN, BUKAN DESIMAL!\n` +
      `   - Contoh: "4.000 Kg" artinya kuantitas qty = 4000 (empat ribu), JANGAN ditulis 4!\n` +
      `   - Contoh: "8.000 Pcs" artinya kuantitas qty = 8000 (delapan ribu), JANGAN ditulis 8!\n` +
      `   - Contoh: "1600 Kg" artinya kuantitas qty = 1600, JANGAN diubah jadi 16!\n` +
      `   - Contoh: "800 Box" artinya kuantitas qty = 800, JANGAN diubah jadi 8!\n` +
      `2. VALIDASI MATEMATIKA PER BARIS ITEM:\n` +
      `   - Pastikan selalu: (qty * unitPrice) harus sama dengan total baris tersebut di struk!\n` +
      `   - Contoh di struk: "4.000 Kg X 12.500 Rp. 50.000.000".\n` +
      `     Jika qty=4 & unitPrice=12500, maka 4*12500 = 50.000 (SALAH BESAR!).\n` +
      `     Yang benar adalah qty=4000 & unitPrice=12500, karena 4000 * 12500 = 50.000.000 (BENAR!).\n` +
      `3. Jangan pernah memotong angka nol (00 / 000) dari kuantitas (qty) maupun harga satuan (unitPrice)!\n` +
      `4. Semua nominal harga dalam angka bulat Rupiah (integer tanpa titik atau koma, misal: 12500, 27500).\n` +
      `5. Jika ada beberapa foto struk, gabungkan semua menu ke dalam array items tanpa menduplikasi.\n` +
      `6. Jangan masukkan baris subtotal, total akhir, bayar, atau kembalian ke dalam items.\n` +
      `7. Jumlahkan taxAmount (pajak), serviceAmount (layanan), deliveryAmount (ongkir), dan discountAmount (diskon) dari seluruh struk yang disertakan.\n` +
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

import type { Express } from "express";
import { type Server } from "http";
import { storage } from "./storage";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import { api } from "@shared/routes";
import { randomBytes, createHmac } from "crypto";
import { isUpiGatewayConfigured, createUpiGatewayOrder, checkUpiGatewayStatus } from "./upigateway";
import { isPayIndiaConfigured, createPayIndiaOrder, checkPayIndiaStatus } from "./payindia";
import { checkPaytmTransactionStatus, isPaymentSuccess, initiatePaytmTransaction, isPaytmConfigured, getPaytmMid, getPaytmBaseUrl } from "./paytm";
import Razorpay from "razorpay";
import multer from "multer";
import path from "path";
import fs from "fs";

const videosDir = path.resolve(process.cwd(), "client/public/videos");
if (!fs.existsSync(videosDir)) fs.mkdirSync(videosDir, { recursive: true });

const videoStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, videosDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || ".mp4";
    const name = `${Date.now()}_${randomBytes(4).toString("hex")}${ext}`;
    cb(null, name);
  },
});
const uploadVideo = multer({
  storage: videoStorage,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("video/")) cb(null, true);
    else cb(new Error("Only video files allowed"));
  },
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  await setupAuth(app);
  registerAuthRoutes(app);

  // === Products (public) ===
  app.get(api.products.list.path, async (_req, res) => {
    const products = await storage.getProducts();
    res.json(products);
  });

  app.get("/api/products/stock", async (_req, res) => {
    const products = await storage.getProducts();
    const stockMap: Record<number, number> = {};
    for (const p of products) {
      const stock = await storage.getLicenseKeyStock(p.id);
      for (const s of stock) {
        stockMap[s.tierId] = s.available;
      }
    }
    res.json(stockMap);
  });

  // === Wallet ===
  app.get(api.wallet.balance.path, isAuthenticated, async (req: any, res) => {
    const userId = req.userId;
    const balance = await storage.getWalletBalance(userId);
    res.json({ balance });
  });

  app.post(api.wallet.topup.path, isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.userId;
      const { amount } = api.wallet.topup.input.parse(req.body);
      const tx = await storage.addWalletCredit(userId, amount, `Wallet top-up: ₹${amount.toFixed(2)}`);
      const balance = await storage.getWalletBalance(userId);
      res.status(201).json({ balance, transaction: tx });
    } catch (err) {
      res.status(400).json({ message: "Invalid amount" });
    }
  });

  app.get(api.wallet.transactions.path, isAuthenticated, async (req: any, res) => {
    const userId = req.userId;
    const txns = await storage.getWalletTransactions(userId);
    res.json(txns);
  });

  // === Purchases ===
  app.get(api.purchases.list.path, isAuthenticated, async (req: any, res) => {
    const userId = req.userId;
    const purchasesList = await storage.getPurchases(userId);
    res.json(purchasesList);
  });

  app.post(api.purchases.buy.path, isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.userId;
      const { tierId } = api.purchases.buy.input.parse(req.body);

      const tier = await storage.getTier(tierId);
      if (!tier) {
        return res.status(404).json({ message: "Pricing tier not found" });
      }

      const balance = await storage.getWalletBalance(userId);
      const price = Number(tier.price);

      if (balance < price) {
        return res.status(400).json({ message: "Insufficient balance" });
      }

      const purchase = await storage.createPurchaseWithStockKey(userId, tierId, tier.productId, price);
      if (!purchase) {
        return res.status(400).json({ message: "No keys available in stock for this tier. Please contact admin." });
      }

      res.status(201).json(purchase);
    } catch (err) {
      res.status(400).json({ message: "Invalid request" });
    }
  });

  // === Dashboard ===
  app.get(api.dashboard.stats.path, isAuthenticated, async (req: any, res) => {
    const userId = req.userId;
    const stats = await storage.getDashboardStats(userId);
    res.json(stats);
  });

  // === Referrals ===
  app.get(api.referrals.info.path, isAuthenticated, async (req: any, res) => {
    const userId = req.userId;
    const info = await storage.getReferrals(userId);
    res.json(info);
  });

  // === Coins & Spin ===
  app.get("/api/coins/balance", isAuthenticated, async (req: any, res) => {
    const coins = await storage.getCoinsBalance(req.userId);
    res.json({ coins });
  });

  app.post("/api/coins/spin", isAuthenticated, async (req: any, res) => {
    try {
      const result = await storage.spinWheel(req.userId);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  // === Profile ===
  app.get(api.profile.get.path, isAuthenticated, async (req: any, res) => {
    const userId = req.userId;
    const user = await storage.getUser(userId);
    res.json(user);
  });

  app.post(api.profile.update.path, isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.userId;
      const { firstName, lastName } = api.profile.update.input.parse(req.body);
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      const updated = await storage.upsertUser({
        ...user,
        firstName: firstName ?? user.firstName,
        lastName: lastName ?? user.lastName,
      });
      res.json(updated);
    } catch (err) {
      res.status(400).json({ message: "Invalid request" });
    }
  });

  // === Payments (Razorpay live or UPI QR fallback) ===
  const rzKeyId = process.env.RAZORPAY_KEY_ID || "";
  const rzKeySecret = process.env.RAZORPAY_KEY_SECRET || "";
  const isRazorpayLive = rzKeyId && !rzKeyId.startsWith("rzp_test_");
  let razorpay: InstanceType<typeof Razorpay> | null = null;
  if (isRazorpayLive) {
    razorpay = new Razorpay({ key_id: rzKeyId, key_secret: rzKeySecret });
  }

  app.get("/api/payments/razorpay-key", isAuthenticated, async (_req: any, res) => {
    res.json({ keyId: rzKeyId });
  });

  app.post(api.payments.create.path, isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.userId;
      const { amount } = api.payments.create.input.parse(req.body);

      if (razorpay && isRazorpayLive) {
        const rzOrder = await razorpay.orders.create({
          amount: Math.round(amount * 100),
          currency: "INR",
          receipt: `rcpt_${Date.now()}`,
        });
        const session = await storage.createPaymentSession(userId, amount, rzOrder.id as string, "razorpay");
        return res.status(201).json({
          sessionId: session.id,
          orderId: rzOrder.id,
          amount,
          currency: "INR",
          method: "razorpay",
        });
      }

      const clientTxnId = `NXP${Date.now()}${randomBytes(4).toString("hex").toUpperCase()}`;
      const redirectUrl = `${req.protocol}://${req.get("host")}/deposit`;
      const user = await storage.getUser(userId);
      const customerName = user?.username || "Customer";
      const customerEmail = `${userId}@nexapanel.com`;

      if (isPayIndiaConfigured()) {
        const orderResult = await createPayIndiaOrder(
          clientTxnId, amount, "9999999999", redirectUrl, "NexaPanel", "WalletDeposit"
        );
        if (orderResult && orderResult.status && orderResult.result?.payment_url) {
          const session = await storage.createPaymentSession(userId, amount, clientTxnId, "payindia");
          return res.status(201).json({
            sessionId: session.id,
            amount,
            method: "payindia",
            paymentUrl: orderResult.result.payment_url,
            createdAt: session.createdAt,
          });
        }
        console.error("PayIndia order creation failed, trying UPIGateway fallback");
      }

      if (isUpiGatewayConfigured()) {
        const orderResult = await createUpiGatewayOrder(
          clientTxnId, amount, customerName, customerEmail, "9999999999", redirectUrl
        );
        if (orderResult && orderResult.status) {
          const session = await storage.createPaymentSession(userId, amount, clientTxnId, "upigateway");
          return res.status(201).json({
            sessionId: session.id,
            amount,
            method: "upigateway",
            paymentUrl: orderResult.data.payment_url,
            createdAt: session.createdAt,
          });
        }
        console.error("UPIGateway order creation failed, falling back to manual QR");
      }

      const orderId = `ORD${Date.now()}${randomBytes(4).toString("hex").toUpperCase()}`;
      const session = await storage.createPaymentSession(userId, amount, orderId, "manual");

      const upiId = process.env.UPI_ID || "";
      const merchantName = "NEXA PANEL";
      const upiPayString = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(merchantName)}&am=${amount}&tr=${encodeURIComponent(orderId)}&tn=${encodeURIComponent(`NXP${Date.now()}`)}&cu=INR`;
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=350x350&data=${encodeURIComponent(upiPayString)}`;

      res.status(201).json({
        ...session,
        sessionId: session.id,
        amount: Number(session.amount),
        qrUrl,
        method: "manual_qr",
      });
    } catch (err) {
      console.error("Payment create error:", err);
      res.status(400).json({ message: "Could not create payment order" });
    }
  });

  app.post("/api/payments/verify", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.userId;
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature, sessionId } = req.body;

      if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        return res.status(400).json({ message: "Missing payment details" });
      }

      const expectedSignature = createHmac("sha256", rzKeySecret)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest("hex");

      if (expectedSignature !== razorpay_signature) {
        return res.status(400).json({ message: "Payment verification failed" });
      }

      const session = await storage.getPaymentSession(Number(sessionId));
      if (!session || session.userId !== userId) {
        return res.status(404).json({ message: "Payment session not found" });
      }
      if (session.status === "completed") {
        return res.json({ success: true, message: "Already credited" });
      }

      const amount = Number(session.amount);
      await storage.addWalletCredit(userId, amount, `Deposit via Razorpay - ${razorpay_payment_id}`);
      await storage.completePaymentSession(session.id);

      const balance = await storage.getWalletBalance(userId);
      res.json({ success: true, balance });
    } catch (err) {
      console.error("Payment verify error:", err);
      res.status(500).json({ message: "Verification failed" });
    }
  });

  app.get("/api/payments/:id", isAuthenticated, async (req: any, res) => {
    const sessionId = Number(req.params.id);
    const session = await storage.getPaymentSession(sessionId);
    if (!session) {
      return res.status(404).json({ message: "Payment session not found" });
    }
    if (session.userId !== req.userId) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    if (session.status === "pending") {
      const createdAt = new Date(session.createdAt!).getTime();
      const now = Date.now();
      const EXPIRY_MS = 5 * 60 * 1000;

      if (now - createdAt > EXPIRY_MS) {
        res.json({ ...session, status: "expired" });
        return;
      }
    }

    res.json(session);
  });

  app.post("/api/payments/verify-status", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.userId;
      const { sessionId } = req.body;

      const session = await storage.getPaymentSession(Number(sessionId));
      if (!session) {
        return res.status(404).json({ message: "Payment session not found" });
      }
      if (session.userId !== userId) {
        return res.status(403).json({ message: "Unauthorized" });
      }
      if (session.status === "completed") {
        return res.json({ success: true, status: "completed" });
      }
      if (session.status === "failed") {
        return res.json({ success: false, status: "failed" });
      }

      const createdAt = new Date(session.createdAt!).getTime();
      const now = Date.now();
      const EXPIRY_MS = 5 * 60 * 1000;
      if (now - createdAt > EXPIRY_MS) {
        return res.json({ success: false, status: "expired" });
      }

      const serverTxnId = session.transactionRef;
      if (serverTxnId.startsWith("NXP")) {
        const createdDate = new Date(session.createdAt!);
        const txnDate = `${String(createdDate.getDate()).padStart(2, "0")}-${String(createdDate.getMonth() + 1).padStart(2, "0")}-${createdDate.getFullYear()}`;

        if (isPayIndiaConfigured()) {
          const piResult = await checkPayIndiaStatus(serverTxnId);
          if (piResult) {
            const txnStatus = (piResult.txnStatus || piResult.status || "").toUpperCase();
            if (txnStatus === "SUCCESS" || txnStatus === "COMPLETED") {
              if (piResult.amount && Math.abs(Number(piResult.amount) - Number(session.amount)) > 0.01) {
                console.error(`PayIndia amount mismatch: expected ${session.amount}, got ${piResult.amount}`);
                return res.json({ success: false, status: "failed", remark: "Amount mismatch" });
              }
              const upiTxnId = piResult.orderId || serverTxnId;
              const completed = await storage.atomicCompletePayment(session.id, userId, upiTxnId);
              if (completed) {
                const amount = Number(session.amount);
                await storage.addWalletCredit(userId, amount, `UPI Deposit - ${upiTxnId}`);
              }
              return res.json({ success: true, status: "completed" });
            }
            if (txnStatus === "FAILED" || txnStatus === "FAILURE" || txnStatus === "ERROR") {
              await storage.failPaymentSession(session.id);
              return res.json({ success: false, status: "failed", remark: piResult.resultInfo || "Payment failed" });
            }
            if (txnStatus === "PENDING" || txnStatus === "SCANNING" || txnStatus === "CREATED") {
              return res.json({ success: false, status: "scanning" });
            }
          }
        }

        if (isUpiGatewayConfigured()) {
          const ugResult = await checkUpiGatewayStatus(serverTxnId, txnDate);
          if (ugResult?.status && ugResult.data) {
            const ugStatus = ugResult.data.status;
            if (ugStatus === "success") {
              if (ugResult.data.amount && Math.abs(Number(ugResult.data.amount) - Number(session.amount)) > 0.01) {
                console.error(`UPIGateway amount mismatch: expected ${session.amount}, got ${ugResult.data.amount}`);
                return res.json({ success: false, status: "failed", remark: "Amount mismatch" });
              }
              const upiTxnId = ugResult.data.upi_txn_id || serverTxnId;
              const completed = await storage.atomicCompletePayment(session.id, userId, upiTxnId);
              if (completed) {
                const amount = Number(session.amount);
                await storage.addWalletCredit(userId, amount, `UPI Deposit - ${upiTxnId}`);
              }
              return res.json({ success: true, status: "completed" });
            }
            if (ugStatus === "failure") {
              await storage.failPaymentSession(session.id);
              return res.json({ success: false, status: "failed", remark: ugResult.data.remark });
            }
            if (ugStatus === "scanning") {
              return res.json({ success: false, status: "scanning" });
            }
          }
        }
      }

      res.json({ success: false, status: "pending" });
    } catch (err) {
      res.json({ success: false, status: "pending" });
    }
  });

  app.post("/api/payments/submit-utr", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.userId;
      const { sessionId, utr } = req.body;

      if (!utr || typeof utr !== "string") {
        return res.status(400).json({ message: "Please enter a valid UTR/transaction reference number" });
      }

      const cleanUtr = utr.trim().replace(/[^a-zA-Z0-9]/g, "");
      if (cleanUtr.length < 10 || cleanUtr.length > 30) {
        return res.status(400).json({ message: "UTR must be 10-30 characters (alphanumeric)" });
      }

      const session = await storage.getPaymentSession(Number(sessionId));
      if (!session) {
        return res.status(404).json({ message: "Payment session not found" });
      }
      if (session.userId !== userId) {
        return res.status(403).json({ message: "Unauthorized" });
      }
      if (session.status === "completed") {
        return res.json({ success: true, message: "Already credited" });
      }
      if (session.status !== "pending") {
        return res.status(400).json({ message: "Payment session is no longer valid" });
      }

      const createdAt = new Date(session.createdAt!).getTime();
      if (Date.now() - createdAt > 10 * 60 * 1000) {
        return res.status(400).json({ message: "Payment session expired. Please create a new deposit." });
      }

      const alreadyUsed = await storage.isUtrUsed(cleanUtr);
      if (alreadyUsed) {
        return res.status(400).json({ message: "This UTR has already been used for another deposit" });
      }

      try {
        await storage.setPaymentSessionUtr(session.id, cleanUtr);
      } catch (e: any) {
        if (e.code === "23505") {
          return res.status(400).json({ message: "This UTR has already been used" });
        }
        throw e;
      }

      res.json({ success: true, message: "UTR submitted. Awaiting admin verification." });
    } catch (err) {
      console.error("UTR submit error:", err);
      res.status(500).json({ message: "Verification failed" });
    }
  });

  app.post("/api/payments/paytm-callback", async (req: any, res) => {
    try {
      const { ORDERID, STATUS, TXNID } = req.body;
      if (STATUS === "TXN_SUCCESS" && ORDERID) {
        const session = await storage.getPaymentSessionByRef(ORDERID);
        if (session && session.status === "pending") {
          const amount = Number(session.amount);
          await storage.addWalletCredit(session.userId, amount, `UPI Deposit - Ref: ${ORDERID}`);
          await storage.completePaymentSession(session.id);
        }
      }
      res.redirect("/deposit");
    } catch (err) {
      console.error("Paytm callback error:", err);
      res.redirect("/deposit");
    }
  });

  app.post(api.payments.confirm.path, isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.userId;
      const { sessionId } = api.payments.confirm.input.parse(req.body);

      const session = await storage.getPaymentSession(sessionId);
      if (!session) {
        return res.status(404).json({ message: "Payment session not found" });
      }
      if (session.userId !== userId) {
        return res.status(403).json({ message: "Unauthorized" });
      }
      if (session.status === "completed") {
        return res.json({ success: true, status: "completed" });
      }
      if (session.status === "failed") {
        return res.status(400).json({ message: "Payment failed. Please create a new payment session." });
      }

      const createdAt = new Date(session.createdAt!).getTime();
      const now = Date.now();
      const EXPIRY_MS = 5 * 60 * 1000;
      if (now - createdAt > EXPIRY_MS) {
        return res.json({ success: false, status: "expired" });
      }

      const paytmResult = await checkPaytmTransactionStatus(session.transactionRef);

      if (paytmResult && isPaymentSuccess(paytmResult)) {
        const amount = Number(session.amount);
        await storage.addWalletCredit(userId, amount, `UPI Deposit - Ref: ${session.transactionRef}`);
        await storage.completePaymentSession(sessionId);
        const balance = await storage.getWalletBalance(userId);
        res.json({ success: true, status: "completed", balance });
      } else {
        res.json({ success: false, status: "pending" });
      }
    } catch (err) {
      res.json({ success: false, status: "pending" });
    }
  });


  // === Reseller System ===
  app.get("/api/reseller/status", isAuthenticated, async (req: any, res) => {
    const isReseller = await storage.isUserReseller(req.userId);
    res.json({ isReseller });
  });

  app.post("/api/reseller/upgrade", isAuthenticated, async (req: any, res) => {
    try {
      const alreadyReseller = await storage.isUserReseller(req.userId);
      if (alreadyReseller) {
        return res.status(400).json({ message: "You are already a reseller" });
      }
      const success = await storage.upgradeToReseller(req.userId);
      if (!success) {
        return res.status(400).json({ message: "You need minimum ₹1,000 balance to unlock reseller. No amount will be deducted." });
      }
      res.json({ success: true, message: "Congratulations! You are now a Reseller." });
    } catch (err) {
      res.status(500).json({ message: "Upgrade failed" });
    }
  });

  app.get("/api/reseller/products", isAuthenticated, async (req: any, res) => {
    const isReseller = await storage.isUserReseller(req.userId);
    if (!isReseller) {
      return res.status(403).json({ message: "Reseller access required" });
    }
    const products = await storage.getResellerProducts();
    res.json(products);
  });

  app.post("/api/reseller/buy", isAuthenticated, async (req: any, res) => {
    try {
      const isReseller = await storage.isUserReseller(req.userId);
      if (!isReseller) {
        return res.status(403).json({ message: "Reseller access required" });
      }
      const { tierId } = api.purchases.buy.input.parse(req.body);
      const tier = await storage.getTier(tierId);
      if (!tier || !tier.resellerPrice) {
        return res.status(404).json({ message: "Reseller pricing not available for this tier" });
      }
      const resellerPrice = Number(tier.resellerPrice);
      const balance = await storage.getWalletBalance(req.userId);
      if (balance < resellerPrice) {
        return res.status(400).json({ message: "Insufficient balance" });
      }
      const purchase = await storage.createResellerPurchase(req.userId, tierId, tier.productId, resellerPrice);
      if (!purchase) {
        return res.status(400).json({ message: "No keys available in stock for this tier." });
      }
      res.status(201).json(purchase);
    } catch (err) {
      res.status(400).json({ message: "Purchase failed" });
    }
  });

  // === Admin Auth ===
  const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
  const adminLoginAttempts = new Map<string, { count: number; lastAttempt: number }>();

  function isAdmin(req: any, res: any, next: any) {
    if (req.session?.isAdmin) {
      return next();
    }
    return res.status(401).json({ message: "Admin access required" });
  }

  app.post("/api/admin/login", (req: any, res) => {
    if (!ADMIN_USERNAME || !ADMIN_PASSWORD) {
      return res.status(503).json({ message: "Admin credentials not configured" });
    }

    const ip = req.ip || "unknown";
    const attempt = adminLoginAttempts.get(ip);
    if (attempt && attempt.count >= 5 && Date.now() - attempt.lastAttempt < 15 * 60 * 1000) {
      return res.status(429).json({ message: "Too many login attempts. Try again later." });
    }

    const { username, password } = req.body || {};
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      adminLoginAttempts.delete(ip);
      req.session.isAdmin = true;
      return res.json({ success: true });
    }

    const current = adminLoginAttempts.get(ip) || { count: 0, lastAttempt: 0 };
    adminLoginAttempts.set(ip, { count: current.count + 1, lastAttempt: Date.now() });
    return res.status(401).json({ message: "Invalid credentials" });
  });

  app.get("/api/admin/session", (req: any, res) => {
    res.json({ isAdmin: !!req.session?.isAdmin });
  });

  app.post("/api/admin/logout", (req: any, res) => {
    if (req.session) {
      req.session.isAdmin = false;
    }
    res.json({ success: true });
  });

  // === Admin Stats ===
  app.get("/api/admin/stats", isAdmin, async (_req: any, res) => {
    const stats = await storage.getAdminStats();
    res.json(stats);
  });

  // === Admin Products ===
  app.get("/api/admin/products", isAdmin, async (_req: any, res) => {
    const allProducts = await storage.getAllProducts();
    res.json(allProducts);
  });

  app.post("/api/admin/products", isAdmin, async (req: any, res) => {
    try {
      const product = await storage.createProduct(req.body);
      res.status(201).json(product);
    } catch (err) {
      res.status(400).json({ message: "Invalid product data" });
    }
  });

  app.put("/api/admin/products/:id", isAdmin, async (req: any, res) => {
    const id = Number(req.params.id);
    const updated = await storage.updateProduct(id, req.body);
    if (!updated) return res.status(404).json({ message: "Product not found" });
    res.json(updated);
  });

  app.delete("/api/admin/products/:id", isAdmin, async (req: any, res) => {
    const id = Number(req.params.id);
    await storage.deleteProduct(id);
    res.json({ success: true });
  });

  app.post("/api/admin/upload-video", isAdmin, uploadVideo.single("video"), async (req: any, res) => {
    if (!req.file) return res.status(400).json({ message: "No video file uploaded" });
    const videoPath = `/videos/${req.file.filename}`;
    res.json({ videoUrl: videoPath });
  });

  // === Admin Pricing Tiers ===
  app.post("/api/admin/tiers", isAdmin, async (req: any, res) => {
    try {
      const tier = await storage.createPricingTier(req.body);
      res.status(201).json(tier);
    } catch (err) {
      res.status(400).json({ message: "Invalid tier data" });
    }
  });

  app.put("/api/admin/tiers/:id", isAdmin, async (req: any, res) => {
    const id = Number(req.params.id);
    const updated = await storage.updatePricingTier(id, req.body);
    if (!updated) return res.status(404).json({ message: "Tier not found" });
    res.json(updated);
  });

  app.delete("/api/admin/tiers/:id", isAdmin, async (req: any, res) => {
    const id = Number(req.params.id);
    await storage.deletePricingTier(id);
    res.json({ success: true });
  });

  // === Admin License Key Stock ===
  app.post("/api/admin/keys/add", isAdmin, async (req: any, res) => {
    const { tierId, productId, keys } = req.body;
    if (!tierId || !productId || !Array.isArray(keys) || keys.length === 0) {
      return res.status(400).json({ message: "tierId, productId, and keys array required" });
    }
    const validKeys = keys.map((k: string) => k.trim()).filter(Boolean);
    if (validKeys.length === 0) {
      return res.status(400).json({ message: "No valid keys provided" });
    }
    const added = await storage.addLicenseKeys(tierId, productId, validKeys);
    res.status(201).json(added);
  });

  app.get("/api/admin/keys/stock/:productId", isAdmin, async (req: any, res) => {
    const productId = Number(req.params.productId);
    const stock = await storage.getLicenseKeyStock(productId);
    res.json(stock);
  });

  app.get("/api/admin/keys/tier/:tierId", isAdmin, async (req: any, res) => {
    const tierId = Number(req.params.tierId);
    const keys = await storage.getLicenseKeysByTier(tierId);
    res.json(keys);
  });

  app.delete("/api/admin/keys/:id", isAdmin, async (req: any, res) => {
    const id = Number(req.params.id);
    await storage.deleteLicenseKey(id);
    res.json({ success: true });
  });

  // === Admin Purchases/Keys ===
  app.get("/api/admin/purchases", isAdmin, async (_req: any, res) => {
    const allPurchases = await storage.getAllPurchases();
    res.json(allPurchases);
  });

  // === Admin Users ===
  app.get("/api/admin/users", isAdmin, async (_req: any, res) => {
    const allUsers = await storage.getAllUsers();
    res.json(allUsers);
  });

  app.post("/api/admin/users/:id/balance", isAdmin, async (req: any, res) => {
    const userId = req.params.id;
    const { amount, type, description } = req.body;
    const parsedAmount = Number(amount);
    if (!parsedAmount || parsedAmount <= 0 || !["credit", "debit"].includes(type)) {
      return res.status(400).json({ message: "Valid amount and type (credit/debit) required" });
    }
    if (type === "debit") {
      const balance = await storage.getWalletBalance(userId);
      if (balance < parsedAmount) {
        return res.status(400).json({ message: `Insufficient balance. User has ₹${balance.toFixed(2)}` });
      }
    }
    const tx = await storage.adjustWalletBalance(userId, parsedAmount, description || `Admin ${type}: ₹${parsedAmount}`, type);
    res.json(tx);
  });

  // === Admin Payment Sessions ===
  app.get("/api/admin/payments", isAdmin, async (_req: any, res) => {
    const sessions = await storage.getAllPaymentSessions();
    res.json(sessions);
  });

  app.post("/api/admin/payments/:id/approve", isAdmin, async (req: any, res) => {
    try {
      const id = Number(req.params.id);
      const session = await storage.getPaymentSession(id);
      if (!session) return res.status(404).json({ message: "Session not found" });
      if (session.status === "completed") return res.status(400).json({ message: "Already completed" });

      const amount = Number(session.amount);
      const utrInfo = session.utr ? ` (UTR: ${session.utr})` : "";
      await storage.addWalletCredit(session.userId, amount, `UPI Deposit - Ref: ${session.transactionRef}${utrInfo}`);
      if (session.utr) {
        await storage.completePaymentSessionWithUtr(id, session.utr);
      } else {
        await storage.completePaymentSession(id);
      }
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Failed to approve payment" });
    }
  });

  app.post("/api/admin/payments/:id/reject", isAdmin, async (req: any, res) => {
    try {
      const id = Number(req.params.id);
      await storage.failPaymentSession(id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Failed to reject payment" });
    }
  });

  // === Seed ===
  await seedDatabase();
  await ensureVideoUrls();
  startAutoPaymentPoller();

  return httpServer;
}

async function seedDatabase() {
  const existingProducts = await storage.getProducts();
  if (existingProducts.length > 0) return;

  console.log("Seeding database...");

  const p1 = await storage.createProduct({
    name: "BR MOD FF",
    description: "Premium gaming modification tool with advanced features for competitive play.",
    features: [
      "Silent Aim",
      "Aim Magnet",
      "Speed",
      "Ghost Mode",
      "Headshot",
      "ESP All Location",
      "CS / BR Rank Working",
      "Safe In Secret Setup",
      "Root & Virtual Non Root",
      "PC All Safe Work",
    ],
    imageUrl: "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=600&q=80",
    videoUrl: "/videos/br_mod.mp4",
    youtubeUrl: "https://t.me/BANTI_BHAIYABB",
    updateUrl: "https://t.me/ALLHACKPDATE",
    feedbackUrl: "https://t.me/BANTI_BHAIYABB",
    status: "active",
    sortOrder: 1,
  });

  await storage.createPricingTier({ productId: p1.id, label: "1 Day Mobile", price: 79, sortOrder: 1 });
  await storage.createPricingTier({ productId: p1.id, label: "7 Days Mobile", price: 319, sortOrder: 2 });
  await storage.createPricingTier({ productId: p1.id, label: "15 Days Mobile", price: 559, sortOrder: 3 });
  await storage.createPricingTier({ productId: p1.id, label: "30 Days Mobile", price: 799, sortOrder: 4 });
  await storage.createPricingTier({ productId: p1.id, label: "1 Day PC", price: 79, sortOrder: 5 });
  await storage.createPricingTier({ productId: p1.id, label: "10 Days PC", price: 479, sortOrder: 6 });

  const p2 = await storage.createProduct({
    name: "DRIPCLIENT FF",
    description: "Advanced client modification with comprehensive feature set.",
    features: [
      "AimAssist",
      "Silent Aim",
      "UnderScore",
      "Speed",
      "God Ghost Mode",
      "Headshot",
      "ESP All Location",
      "CS / BR Rank Working",
      "Safe In Secret Setup",
      "Root & Non Root",
      "PC All Safe Work",
    ],
    imageUrl: "https://images.unsplash.com/photo-1511512578047-dfb367046420?w=600&q=80",
    videoUrl: "/videos/dripclient.mp4",
    youtubeUrl: "https://t.me/BANTI_BHAIYABB",
    updateUrl: "https://t.me/ALLHACKPDATE",
    feedbackUrl: "https://t.me/BANTI_BHAIYABB",
    status: "active",
    sortOrder: 2,
  });

  await storage.createPricingTier({ productId: p2.id, label: "1 Day NONROOT", price: 90, sortOrder: 1 });
  await storage.createPricingTier({ productId: p2.id, label: "7 Days NONROOT", price: 350, sortOrder: 2 });
  await storage.createPricingTier({ productId: p2.id, label: "15 Days NONROOT", price: 600, sortOrder: 3 });
  await storage.createPricingTier({ productId: p2.id, label: "30 Days NONROOT", price: 900, sortOrder: 4 });
  await storage.createPricingTier({ productId: p2.id, label: "1 Day PC", price: 150, sortOrder: 5 });
  await storage.createPricingTier({ productId: p2.id, label: "7 Days PC", price: 450, sortOrder: 6 });

  const p3 = await storage.createProduct({
    name: "PRIME HOOK FF",
    description: "Reliable hook modification with essential features.",
    features: [
      "Aim Magnet",
      "Silent Aim",
      "Aimbot",
      "Speed Mode",
      "Headshot",
      "ESP All Location",
      "CS / BR Rank Working",
      "Safe In Secret Setup",
      "Root & Non Root",
      "All Device Safe Work",
    ],
    imageUrl: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=600&q=80",
    videoUrl: "/videos/prime_hook.mp4",
    youtubeUrl: "https://t.me/BANTI_BHAIYABB",
    updateUrl: "https://t.me/ALLHACKPDATE",
    feedbackUrl: "https://t.me/BANTI_BHAIYABB",
    status: "active",
    sortOrder: 3,
  });

  await storage.createPricingTier({ productId: p3.id, label: "5 Days Mod", price: 176, sortOrder: 1 });
  await storage.createPricingTier({ productId: p3.id, label: "10 Days Mod", price: 351, sortOrder: 2 });
  await storage.createPricingTier({ productId: p3.id, label: "30 Days Mod", price: 799, sortOrder: 3 });

  const p4 = await storage.createProduct({
    name: "HG CHEATS FF",
    description: "High-grade modification tool with premium features.",
    features: [
      "Aim Magnet",
      "Silent Aim",
      "Aimbot",
      "Speed Mode",
      "Headshot",
      "ESP All Location",
      "CS / BR Rank Working",
      "Safe In Secret Setup",
      "Root & Non Root",
      "All Device Safe Work",
    ],
    imageUrl: "https://images.unsplash.com/photo-1612287230202-1ff1d85d1bdf?w=600&q=80",
    videoUrl: "/videos/hg_cheats.mp4",
    youtubeUrl: "https://t.me/BANTI_BHAIYABB",
    updateUrl: "https://t.me/ALLHACKPDATE",
    feedbackUrl: "https://t.me/BANTI_BHAIYABB",
    status: "active",
    sortOrder: 4,
  });

  await storage.createPricingTier({ productId: p4.id, label: "1 Day", price: 150, sortOrder: 1 });
  await storage.createPricingTier({ productId: p4.id, label: "7 Days", price: 350, sortOrder: 2 });
  await storage.createPricingTier({ productId: p4.id, label: "10 Days", price: 450, sortOrder: 3 });
  await storage.createPricingTier({ productId: p4.id, label: "30 Days", price: 1200, sortOrder: 4 });

  const p5 = await storage.createProduct({
    name: "IOS FLUORITE FF",
    description: "Premium iOS modification with full compatibility.",
    features: [
      "Silent Aim",
      "Aimbot",
      "Speed",
      "Headshot",
      "ESP All Location",
      "CS / BR Rank Working",
      "Safe In Secret Setup",
      "Full Safe In iOS",
    ],
    imageUrl: "https://images.unsplash.com/photo-1580327344181-c131b5fbc2e6?w=600&q=80",
    videoUrl: "/videos/ios_fluorite.mp4",
    youtubeUrl: "https://t.me/BANTI_BHAIYABB",
    updateUrl: "https://t.me/ALLHACKPDATE",
    feedbackUrl: "https://t.me/BANTI_BHAIYABB",
    status: "active",
    sortOrder: 5,
  });

  await storage.createPricingTier({ productId: p5.id, label: "1 Day Fluorite", price: 399, sortOrder: 1 });
  await storage.createPricingTier({ productId: p5.id, label: "7 Days Fluorite", price: 1119, sortOrder: 2 });
  await storage.createPricingTier({ productId: p5.id, label: "30 Days Fluorite", price: 1919, sortOrder: 3 });

  const p6 = await storage.createProduct({
    name: "PATO TEAM FF",
    description: "Team-grade modification with advanced targeting.",
    features: [
      "Silent Aim",
      "Aim Magnet",
      "Speed",
      "Ghost Mode",
      "Headshot",
      "ESP All Location",
      "CS / BR Rank Working",
      "Safe In Secret Setup",
      "Root & Virtual Non Root",
      "PC All Safe Work",
    ],
    imageUrl: "https://images.unsplash.com/photo-1493711662062-fa541adb3fc8?w=600&q=80",
    videoUrl: "/videos/pato_team.mp4",
    youtubeUrl: "https://t.me/BANTI_BHAIYABB",
    updateUrl: "https://t.me/ALLHACKPDATE",
    feedbackUrl: "https://t.me/BANTI_BHAIYABB",
    status: "active",
    sortOrder: 6,
  });

  await storage.createPricingTier({ productId: p6.id, label: "7 Days Brutal", price: 559, sortOrder: 1 });
  await storage.createPricingTier({ productId: p6.id, label: "7 Days", price: 500, sortOrder: 2 });

  console.log("Database seeded successfully!");
}

async function startAutoPaymentPoller() {
  const POLL_INTERVAL = 10_000;

  setInterval(async () => {
    try {
      const pending = await storage.getPendingAutoPayments();
      if (!pending.length) return;

      for (const session of pending) {
        const createdAt = new Date(session.createdAt!).getTime();
        const now = Date.now();
        if (now - createdAt > 10 * 60 * 1000) {
          await storage.failPaymentSession(session.id);
          continue;
        }

        const txnId = session.transactionRef;
        const createdDate = new Date(session.createdAt!);
        const txnDate = `${String(createdDate.getDate()).padStart(2, "0")}-${String(createdDate.getMonth() + 1).padStart(2, "0")}-${createdDate.getFullYear()}`;

        if (session.method === "payindia" && isPayIndiaConfigured()) {
          const piResult = await checkPayIndiaStatus(txnId);
          if (piResult) {
            const txnStatus = (piResult.txnStatus || piResult.status || "").toUpperCase();
            if (txnStatus === "SUCCESS" || txnStatus === "COMPLETED") {
              if (piResult.amount && Math.abs(Number(piResult.amount) - Number(session.amount)) > 0.01) continue;
              const upiTxnId = piResult.orderId || txnId;
              const completed = await storage.atomicCompletePayment(session.id, session.userId, upiTxnId);
              if (completed) {
                await storage.addWalletCredit(session.userId, Number(session.amount), `UPI Deposit - ${upiTxnId}`);
                console.log(`[AutoPoll] PayIndia payment ${session.id} auto-completed for user ${session.userId}, ₹${session.amount}`);
              }
            } else if (txnStatus === "FAILED" || txnStatus === "FAILURE" || txnStatus === "ERROR") {
              await storage.failPaymentSession(session.id);
            }
          }
        }

        if (session.method === "upigateway" && isUpiGatewayConfigured()) {
          const ugResult = await checkUpiGatewayStatus(txnId, txnDate);
          if (ugResult?.status && ugResult.data) {
            if (ugResult.data.status === "success") {
              if (ugResult.data.amount && Math.abs(Number(ugResult.data.amount) - Number(session.amount)) > 0.01) continue;
              const upiTxnId = ugResult.data.upi_txn_id || txnId;
              const completed = await storage.atomicCompletePayment(session.id, session.userId, upiTxnId);
              if (completed) {
                await storage.addWalletCredit(session.userId, Number(session.amount), `UPI Deposit - ${upiTxnId}`);
                console.log(`[AutoPoll] UPIGateway payment ${session.id} auto-completed for user ${session.userId}, ₹${session.amount}`);
              }
            } else if (ugResult.data.status === "failure") {
              await storage.failPaymentSession(session.id);
            }
          }
        }
      }
    } catch (err) {
      console.error("[AutoPoll] Error:", err);
    }
  }, POLL_INTERVAL);

  console.log("[AutoPoll] Background payment poller started (every 10s)");
}

async function ensureVideoUrls() {
  const videoMap: Record<string, string> = {
    "BR MOD FF": "/videos/br_mod.mp4",
    "DRIPCLIENT FF": "/videos/dripclient.mp4",
    "PRIME HOOK FF": "/videos/prime_hook.mp4",
    "HG CHEATS FF": "/videos/hg_cheats.mp4",
    "IOS FLUORITE FF": "/videos/ios_fluorite.mp4",
    "PATO TEAM FF": "/videos/pato_team.mp4",
  };

  const possibleDirs = [
    path.resolve(process.cwd(), "client/public/videos"),
    path.resolve(process.cwd(), "dist/public/videos"),
  ];
  const videosDir = possibleDirs.find(d => fs.existsSync(d)) || possibleDirs[0];
  console.log(`ensureVideoUrls checking dir: ${videosDir}, exists: ${fs.existsSync(videosDir)}`);

  const products = await storage.getProducts();
  for (const product of products) {
    const expectedVideo = videoMap[product.name];
    if (expectedVideo) {
      if (!product.videoUrl || product.videoUrl !== expectedVideo) {
        await storage.updateProduct(product.id, { videoUrl: expectedVideo });
        console.log(`Updated video URL for ${product.name} to ${expectedVideo}`);
      }
    }
  }
}

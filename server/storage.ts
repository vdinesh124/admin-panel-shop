import { db } from "./db";
import { pool } from "./db";
import { eq, desc, sql, count, sum, asc, and } from "drizzle-orm";
import { users } from "@shared/models/auth";
import {
  products,
  pricingTiers,
  walletTransactions,
  purchases,
  referrals,
  paymentSessions,
  licenseKeys,
  type Product,
  type InsertProduct,
  type PricingTier,
  type InsertPricingTier,
  type WalletTransaction,
  type Purchase,
  type Referral,
  type PaymentSession,
  type LicenseKey,
} from "@shared/schema";
import { authStorage, type IAuthStorage } from "./replit_integrations/auth/storage";

export interface IStorage extends IAuthStorage {
  getUserByUsername(username: string): Promise<any>;
  getProducts(): Promise<(Product & { tiers: PricingTier[] })[]>;
  getWalletBalance(userId: string): Promise<number>;
  getWalletTransactions(userId: string): Promise<WalletTransaction[]>;
  addWalletCredit(userId: string, amount: number, description: string): Promise<WalletTransaction>;
  getPurchases(userId: string): Promise<(Purchase & { productName?: string; tierLabel?: string })[]>;
  getTier(tierId: number): Promise<PricingTier | undefined>;
  createPurchase(userId: string, tierId: number, productId: number, amount: number, licenseKey: string): Promise<Purchase>;
  createProduct(product: InsertProduct): Promise<Product>;
  createPricingTier(tier: InsertPricingTier): Promise<PricingTier>;
  getDashboardStats(userId: string): Promise<{ balance: number; totalPurchases: number; totalSpent: number; totalReferrals: number }>;
  getReferrals(userId: string): Promise<{ referralCode: string; totalReferred: number; totalEarned: number; referrals: Referral[] }>;
  createPaymentSession(userId: string, amount: number, transactionRef: string, method?: string): Promise<PaymentSession>;
  getPaymentSession(id: number): Promise<PaymentSession | undefined>;
  getPaymentSessionByRef(transactionRef: string): Promise<PaymentSession | undefined>;
  completePaymentSession(id: number): Promise<PaymentSession | undefined>;
  completePaymentSessionWithUtr(id: number, utr: string): Promise<PaymentSession | undefined>;
  setPaymentSessionUtr(id: number, utr: string): Promise<PaymentSession | undefined>;
  isUtrUsed(utr: string): Promise<boolean>;
  atomicCompletePayment(id: number, userId: string, utr: string): Promise<boolean>;
  failPaymentSession(id: number): Promise<PaymentSession | undefined>;
  getAllPaymentSessions(): Promise<(PaymentSession & { username: string })[]>;
  // Admin methods
  getAllProducts(): Promise<(Product & { tiers: PricingTier[] })[]>;
  getProduct(id: number): Promise<Product | undefined>;
  updateProduct(id: number, data: Partial<InsertProduct>): Promise<Product | undefined>;
  deleteProduct(id: number): Promise<void>;
  updatePricingTier(id: number, data: Partial<InsertPricingTier>): Promise<PricingTier | undefined>;
  deletePricingTier(id: number): Promise<void>;
  getAllPurchases(): Promise<(Purchase & { productName?: string; tierLabel?: string; userEmail?: string })[]>;
  getAllUsers(): Promise<any[]>;
  adjustWalletBalance(userId: string, amount: number, description: string, type: "credit" | "debit"): Promise<WalletTransaction>;
  getAdminStats(): Promise<{ totalUsers: number; totalProducts: number; totalPurchases: number; totalRevenue: number }>;
  createPurchaseWithStockKey(userId: string, tierId: number, productId: number, amount: number): Promise<Purchase | null>;
  addLicenseKeys(tierId: number, productId: number, keys: string[]): Promise<LicenseKey[]>;
  getLicenseKeysByTier(tierId: number): Promise<LicenseKey[]>;
  getLicenseKeyStock(productId: number): Promise<{ tierId: number; total: number; available: number }[]>;
  claimLicenseKey(tierId: number, userId: string): Promise<LicenseKey | null>;
  deleteLicenseKey(id: number): Promise<void>;
  processReferral(referralCode: string, newUserId: string): Promise<boolean>;
  getUserIdByReferralCode(code: string): Promise<string | null>;
  isUserReseller(userId: string): Promise<boolean>;
  upgradeToReseller(userId: string): Promise<boolean>;
  getResellerProducts(): Promise<(Product & { tiers: PricingTier[] })[]>;
  createResellerPurchase(userId: string, tierId: number, productId: number, resellerPrice: number): Promise<Purchase | null>;
}

export class DatabaseStorage implements IStorage {
  getUser = authStorage.getUser;
  getUserByUsername = authStorage.getUserByUsername;
  upsertUser = authStorage.upsertUser;

  async getProducts(): Promise<(Product & { tiers: PricingTier[] })[]> {
    const allProducts = await db.select().from(products).where(eq(products.status, "active")).orderBy(products.sortOrder);
    const allTiers = await db.select().from(pricingTiers).orderBy(pricingTiers.sortOrder);

    return allProducts.map((p) => ({
      ...p,
      tiers: allTiers.filter((t) => t.productId === p.id),
    }));
  }

  async getWalletBalance(userId: string): Promise<number> {
    const result = await db
      .select({
        balance: sql<string>`COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE -amount END), 0)`,
      })
      .from(walletTransactions)
      .where(eq(walletTransactions.userId, userId));

    return Number(result[0]?.balance ?? 0);
  }

  async getWalletTransactions(userId: string): Promise<WalletTransaction[]> {
    return await db.select().from(walletTransactions).where(eq(walletTransactions.userId, userId)).orderBy(desc(walletTransactions.createdAt));
  }

  async addWalletCredit(userId: string, amount: number, description: string): Promise<WalletTransaction> {
    const [tx] = await db.insert(walletTransactions).values({
      userId,
      amount: String(amount),
      type: "credit",
      description,
    }).returning();
    return tx;
  }

  async getPurchases(userId: string): Promise<(Purchase & { productName?: string; tierLabel?: string })[]> {
    const userPurchases = await db.select().from(purchases).where(eq(purchases.userId, userId)).orderBy(desc(purchases.createdAt));

    const allProducts = await db.select().from(products);
    const allTiers = await db.select().from(pricingTiers);

    return userPurchases.map((p) => ({
      ...p,
      productName: allProducts.find((prod) => prod.id === p.productId)?.name,
      tierLabel: allTiers.find((t) => t.id === p.tierId)?.label,
    }));
  }

  async getTier(tierId: number): Promise<PricingTier | undefined> {
    const [tier] = await db.select().from(pricingTiers).where(eq(pricingTiers.id, tierId));
    return tier;
  }

  async createPurchase(userId: string, tierId: number, productId: number, amount: number, licenseKey: string): Promise<Purchase> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `INSERT INTO wallet_transactions (user_id, amount, type, description) VALUES ($1, $2, 'debit', $3)`,
        [userId, String(amount), `Purchase - Tier #${tierId}`]
      );

      const result = await client.query(
        `INSERT INTO purchases (user_id, product_id, tier_id, license_key, amount) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [userId, productId, tierId, licenseKey, String(amount)]
      );

      await client.query('COMMIT');

      return result.rows[0] as Purchase;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async createProduct(product: InsertProduct): Promise<Product> {
    const [p] = await db.insert(products).values(product).returning();
    return p;
  }

  async createPricingTier(tier: InsertPricingTier): Promise<PricingTier> {
    const [t] = await db.insert(pricingTiers).values(tier).returning();
    return t;
  }

  async getDashboardStats(userId: string): Promise<{ balance: number; totalPurchases: number; totalSpent: number; totalReferrals: number }> {
    const balance = await this.getWalletBalance(userId);

    const [purchaseStats] = await db
      .select({
        totalPurchases: sql<string>`COUNT(*)`,
        totalSpent: sql<string>`COALESCE(SUM(amount), 0)`,
      })
      .from(purchases)
      .where(eq(purchases.userId, userId));

    const [referralStats] = await db
      .select({
        totalReferrals: sql<string>`COUNT(*)`,
      })
      .from(referrals)
      .where(eq(referrals.referrerId, userId));

    return {
      balance,
      totalPurchases: Number(purchaseStats?.totalPurchases ?? 0),
      totalSpent: Number(purchaseStats?.totalSpent ?? 0),
      totalReferrals: Number(referralStats?.totalReferrals ?? 0),
    };
  }

  async getReferrals(userId: string): Promise<{ referralCode: string; totalReferred: number; totalEarned: number; coins: number; referrals: Referral[] }> {
    const userReferrals = await db.select().from(referrals).where(eq(referrals.referrerId, userId)).orderBy(desc(referrals.createdAt));

    const totalEarned = userReferrals.reduce((acc, r) => acc + Number(r.rewardAmount), 0);

    const code = Buffer.from(userId).toString("base64").slice(0, 8).toUpperCase();

    const user = await this.getUser(userId);
    const coins = user?.coins ?? 0;

    return {
      referralCode: code,
      totalReferred: userReferrals.length,
      totalEarned,
      coins,
      referrals: userReferrals,
    };
  }

  async getCoinsBalance(userId: string): Promise<number> {
    const user = await this.getUser(userId);
    return user?.coins ?? 0;
  }

  async spinWheel(userId: string): Promise<{ prize: number; newCoins: number }> {
    const SPIN_COST = 25;

    const segments = [1, 5, 20, 100];
    const weights = [55, 33, 10, 2];
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    const rand = Math.random() * totalWeight;
    let cumulative = 0;
    let prize = segments[0];
    for (let i = 0; i < weights.length; i++) {
      cumulative += weights[i];
      if (rand < cumulative) {
        prize = segments[i];
        break;
      }
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const deductResult = await client.query(
        'UPDATE users SET coins = coins - $1 WHERE id = $2 AND coins >= $1 RETURNING coins',
        [SPIN_COST, userId]
      );
      if (deductResult.rows.length === 0) {
        await client.query('ROLLBACK');
        throw new Error("Not enough coins. You need 25 coins to spin.");
      }
      const newCoins = deductResult.rows[0].coins;
      await client.query(
        'INSERT INTO wallet_transactions (user_id, amount, type, description) VALUES ($1, $2, $3, $4)',
        [userId, String(prize), 'credit', `Lucky Spin reward - won ₹${prize}`]
      );
      await client.query('COMMIT');
      return { prize, newCoins };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async createPaymentSession(userId: string, amount: number, transactionRef: string, method?: string): Promise<PaymentSession> {
    const [session] = await db.insert(paymentSessions).values({
      userId,
      amount: String(amount),
      transactionRef,
      status: "pending",
      method: method || "manual",
    }).returning();
    return session;
  }

  async getPaymentSession(id: number): Promise<PaymentSession | undefined> {
    const [session] = await db.select().from(paymentSessions).where(eq(paymentSessions.id, id));
    return session;
  }

  async getPaymentSessionByRef(transactionRef: string): Promise<PaymentSession | undefined> {
    const [session] = await db.select().from(paymentSessions).where(eq(paymentSessions.transactionRef, transactionRef));
    return session;
  }

  async completePaymentSession(id: number): Promise<PaymentSession | undefined> {
    const [session] = await db.update(paymentSessions)
      .set({ status: "completed" })
      .where(eq(paymentSessions.id, id))
      .returning();
    return session;
  }

  async completePaymentSessionWithUtr(id: number, utr: string): Promise<PaymentSession | undefined> {
    const [session] = await db.update(paymentSessions)
      .set({ status: "completed", utr })
      .where(eq(paymentSessions.id, id))
      .returning();
    return session;
  }

  async setPaymentSessionUtr(id: number, utr: string): Promise<PaymentSession | undefined> {
    const [session] = await db.update(paymentSessions)
      .set({ utr })
      .where(eq(paymentSessions.id, id))
      .returning();
    return session;
  }

  async isUtrUsed(utr: string): Promise<boolean> {
    const [existing] = await db.select()
      .from(paymentSessions)
      .where(and(eq(paymentSessions.utr, utr), eq(paymentSessions.status, "completed")))
      .limit(1);
    return !!existing;
  }

  async atomicCompletePayment(id: number, userId: string, utr: string): Promise<boolean> {
    const [updated] = await db.update(paymentSessions)
      .set({ status: "completed", utr })
      .where(and(
        eq(paymentSessions.id, id),
        eq(paymentSessions.userId, userId),
        eq(paymentSessions.status, "pending")
      ))
      .returning();
    return !!updated;
  }

  async failPaymentSession(id: number): Promise<PaymentSession | undefined> {
    const [session] = await db.update(paymentSessions)
      .set({ status: "failed" })
      .where(eq(paymentSessions.id, id))
      .returning();
    return session;
  }

  async getPendingAutoPayments(): Promise<PaymentSession[]> {
    return db.select().from(paymentSessions)
      .where(
        and(
          eq(paymentSessions.status, "pending"),
          sql`${paymentSessions.method} IN ('payindia', 'upigateway')`
        )
      );
  }

  async getAllPaymentSessions(): Promise<(PaymentSession & { username: string })[]> {
    const allSessions = await db
      .select({
        id: paymentSessions.id,
        userId: paymentSessions.userId,
        amount: paymentSessions.amount,
        transactionRef: paymentSessions.transactionRef,
        utr: paymentSessions.utr,
        status: paymentSessions.status,
        method: paymentSessions.method,
        createdAt: paymentSessions.createdAt,
        username: users.username,
      })
      .from(paymentSessions)
      .leftJoin(users, eq(paymentSessions.userId, users.id))
      .orderBy(desc(paymentSessions.createdAt));
    return allSessions.map(s => ({ ...s, username: s.username || "Unknown" }));
  }

  async getAllProducts(): Promise<(Product & { tiers: PricingTier[] })[]> {
    const allProducts = await db.select().from(products).orderBy(products.sortOrder);
    const allTiers = await db.select().from(pricingTiers).orderBy(pricingTiers.sortOrder);
    return allProducts.map((p) => ({
      ...p,
      tiers: allTiers.filter((t) => t.productId === p.id),
    }));
  }

  async getProduct(id: number): Promise<Product | undefined> {
    const [p] = await db.select().from(products).where(eq(products.id, id));
    return p;
  }

  async updateProduct(id: number, data: Partial<InsertProduct>): Promise<Product | undefined> {
    const [p] = await db.update(products).set(data).where(eq(products.id, id)).returning();
    return p;
  }

  async deleteProduct(id: number): Promise<void> {
    await db.delete(licenseKeys).where(eq(licenseKeys.productId, id));
    await db.delete(pricingTiers).where(eq(pricingTiers.productId, id));
    await db.delete(products).where(eq(products.id, id));
  }

  async updatePricingTier(id: number, data: Partial<InsertPricingTier>): Promise<PricingTier | undefined> {
    const [t] = await db.update(pricingTiers).set(data).where(eq(pricingTiers.id, id)).returning();
    return t;
  }

  async deletePricingTier(id: number): Promise<void> {
    await db.delete(licenseKeys).where(eq(licenseKeys.tierId, id));
    await db.delete(pricingTiers).where(eq(pricingTiers.id, id));
  }

  async getAllPurchases(): Promise<(Purchase & { productName?: string; tierLabel?: string; userEmail?: string })[]> {
    const allPurchases = await db.select().from(purchases).orderBy(desc(purchases.createdAt));
    const allProducts = await db.select().from(products);
    const allTiers = await db.select().from(pricingTiers);
    const allUsers = await db.select().from(users);
    return allPurchases.map((p) => ({
      ...p,
      productName: allProducts.find((prod) => prod.id === p.productId)?.name,
      tierLabel: allTiers.find((t) => t.id === p.tierId)?.label,
      userEmail: allUsers.find((u) => u.id === p.userId)?.email || p.userId,
    }));
  }

  async getAllUsers(): Promise<any[]> {
    const allUsers = await db.select().from(users).orderBy(desc(users.createdAt));
    const result = [];
    for (const u of allUsers) {
      const balance = await this.getWalletBalance(u.id);
      const [purchaseStats] = await db
        .select({ total: sql<string>`COUNT(*)` })
        .from(purchases)
        .where(eq(purchases.userId, u.id));
      result.push({
        ...u,
        walletBalance: balance,
        totalPurchases: Number(purchaseStats?.total ?? 0),
      });
    }
    return result;
  }

  async adjustWalletBalance(userId: string, amount: number, description: string, type: "credit" | "debit"): Promise<WalletTransaction> {
    const [tx] = await db.insert(walletTransactions).values({
      userId,
      amount: String(Math.abs(amount)),
      type,
      description,
    }).returning();
    return tx;
  }

  async getAdminStats(): Promise<{ totalUsers: number; totalProducts: number; totalPurchases: number; totalRevenue: number }> {
    const [userCount] = await db.select({ total: sql<string>`COUNT(*)` }).from(users);
    const [productCount] = await db.select({ total: sql<string>`COUNT(*)` }).from(products);
    const [purchaseStats] = await db.select({
      total: sql<string>`COUNT(*)`,
      revenue: sql<string>`COALESCE(SUM(amount), 0)`,
    }).from(purchases);

    return {
      totalUsers: Number(userCount?.total ?? 0),
      totalProducts: Number(productCount?.total ?? 0),
      totalPurchases: Number(purchaseStats?.total ?? 0),
      totalRevenue: Number(purchaseStats?.revenue ?? 0),
    };
  }

  async createPurchaseWithStockKey(userId: string, tierId: number, productId: number, amount: number): Promise<Purchase | null> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const keyResult = await client.query(
        `UPDATE license_keys SET status = 'sold', sold_to_user_id = $1, sold_at = NOW()
         WHERE id = (SELECT id FROM license_keys WHERE tier_id = $2 AND status = 'available' LIMIT 1 FOR UPDATE SKIP LOCKED)
         RETURNING *`,
        [userId, tierId]
      );

      if (keyResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return null;
      }

      const licenseKey = keyResult.rows[0].key_value;

      await client.query(
        `INSERT INTO wallet_transactions (user_id, amount, type, description) VALUES ($1, $2, 'debit', $3)`,
        [userId, String(amount), `Purchase - Tier #${tierId}`]
      );

      const purchaseResult = await client.query(
        `INSERT INTO purchases (user_id, product_id, tier_id, license_key, amount) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [userId, productId, tierId, licenseKey, String(amount)]
      );

      await client.query('COMMIT');
      return purchaseResult.rows[0] as Purchase;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async addLicenseKeys(tierId: number, productId: number, keys: string[]): Promise<LicenseKey[]> {
    const values = keys.map((k) => ({
      tierId,
      productId,
      keyValue: k.trim(),
      status: "available" as const,
    }));
    const inserted = await db.insert(licenseKeys).values(values).returning();
    return inserted;
  }

  async getLicenseKeysByTier(tierId: number): Promise<LicenseKey[]> {
    return await db.select().from(licenseKeys).where(eq(licenseKeys.tierId, tierId)).orderBy(desc(licenseKeys.createdAt));
  }

  async getLicenseKeyStock(productId: number): Promise<{ tierId: number; total: number; available: number }[]> {
    const result = await db
      .select({
        tierId: licenseKeys.tierId,
        total: sql<string>`COUNT(*)`,
        available: sql<string>`COUNT(*) FILTER (WHERE ${licenseKeys.status} = 'available')`,
      })
      .from(licenseKeys)
      .where(eq(licenseKeys.productId, productId))
      .groupBy(licenseKeys.tierId);
    return result.map((r) => ({
      tierId: r.tierId,
      total: Number(r.total),
      available: Number(r.available),
    }));
  }

  async claimLicenseKey(tierId: number, userId: string): Promise<LicenseKey | null> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        `UPDATE license_keys SET status = 'sold', sold_to_user_id = $1, sold_at = NOW()
         WHERE id = (SELECT id FROM license_keys WHERE tier_id = $2 AND status = 'available' LIMIT 1 FOR UPDATE SKIP LOCKED)
         RETURNING *`,
        [userId, tierId]
      );
      await client.query('COMMIT');
      if (result.rows.length === 0) return null;
      return result.rows[0] as LicenseKey;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async deleteLicenseKey(id: number): Promise<void> {
    await db.delete(licenseKeys).where(eq(licenseKeys.id, id));
  }

  async getUserIdByReferralCode(code: string): Promise<string | null> {
    const allUsers = await db.select({ id: users.id }).from(users);
    for (const u of allUsers) {
      const userCode = Buffer.from(String(u.id)).toString("base64").slice(0, 8).toUpperCase();
      if (userCode === code.toUpperCase()) {
        return String(u.id);
      }
    }
    return null;
  }

  async isUserReseller(userId: string): Promise<boolean> {
    const user = await this.getUser(userId);
    return user?.isReseller === 1;
  }

  async upgradeToReseller(userId: string): Promise<boolean> {
    const RESELLER_MIN_BALANCE = 1000;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const lockResult = await client.query(
        'SELECT is_reseller FROM users WHERE id = $1 FOR UPDATE',
        [userId]
      );
      if (!lockResult.rows.length || lockResult.rows[0].is_reseller === 1) {
        await client.query('ROLLBACK');
        return false;
      }
      const balResult = await client.query(
        `SELECT COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE -amount END), 0) as balance FROM wallet_transactions WHERE user_id = $1`,
        [userId]
      );
      const balance = Number(balResult.rows[0]?.balance ?? 0);
      if (balance < RESELLER_MIN_BALANCE) {
        await client.query('ROLLBACK');
        return false;
      }
      const updateResult = await client.query(
        'UPDATE users SET is_reseller = 1 WHERE id = $1 AND is_reseller = 0 RETURNING id',
        [userId]
      );
      if (updateResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return false;
      }
      await client.query('COMMIT');
      return true;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async getResellerProducts(): Promise<(Product & { tiers: PricingTier[] })[]> {
    const allProducts = await db.select().from(products).where(eq(products.status, "active")).orderBy(products.sortOrder);
    const allTiers = await db.select().from(pricingTiers).orderBy(pricingTiers.sortOrder);
    const productsWithResellerTiers = allProducts.map((p) => ({
      ...p,
      tiers: allTiers.filter((t) => t.productId === p.id && t.resellerPrice != null),
    }));
    return productsWithResellerTiers.filter(p => p.tiers.length > 0);
  }

  async createResellerPurchase(userId: string, tierId: number, productId: number, resellerPrice: number): Promise<Purchase | null> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const balResult = await client.query(
        `SELECT COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE -amount END), 0) as balance FROM wallet_transactions WHERE user_id = $1`,
        [userId]
      );
      if (Number(balResult.rows[0]?.balance ?? 0) < resellerPrice) {
        await client.query('ROLLBACK');
        throw new Error("Insufficient balance");
      }
      const keyResult = await client.query(
        `UPDATE license_keys SET status = 'sold', sold_to_user_id = $1, sold_at = NOW()
         WHERE id = (SELECT id FROM license_keys WHERE tier_id = $2 AND status = 'available' LIMIT 1 FOR UPDATE SKIP LOCKED)
         RETURNING *`,
        [userId, tierId]
      );
      if (keyResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return null;
      }
      const licenseKey = keyResult.rows[0].key_value;
      await client.query(
        `INSERT INTO wallet_transactions (user_id, amount, type, description) VALUES ($1, $2, 'debit', $3)`,
        [userId, String(resellerPrice), `Reseller Purchase - Tier #${tierId}`]
      );
      const purchaseResult = await client.query(
        `INSERT INTO purchases (user_id, product_id, tier_id, license_key, amount) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [userId, productId, tierId, licenseKey, String(resellerPrice)]
      );
      await client.query('COMMIT');
      return purchaseResult.rows[0] as Purchase;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async processReferral(referralCode: string, newUserId: string): Promise<boolean> {
    const referrerId = await this.getUserIdByReferralCode(referralCode);
    if (!referrerId || referrerId === newUserId) return false;

    const existing = await db.select().from(referrals).where(eq(referrals.referredId, newUserId));
    if (existing.length > 0) return false;

    const coinsReward = 5;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        'INSERT INTO referrals (referrer_id, referred_id, reward_amount) VALUES ($1, $2, $3)',
        [referrerId, newUserId, String(coinsReward)]
      );
      await client.query(
        'UPDATE users SET coins = coins + $1 WHERE id = $2',
        [coinsReward, referrerId]
      );
      await client.query('COMMIT');
      return true;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}

export const storage = new DatabaseStorage();

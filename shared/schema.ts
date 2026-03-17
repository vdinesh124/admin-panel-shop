import { sql } from "drizzle-orm";
import { pgTable, text, serial, integer, boolean, timestamp, decimal, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Export Auth models
export * from "./models/auth";

// === Products (Digital Products) ===
export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  features: text("features").array().notNull(),
  imageUrl: text("image_url").notNull(),
  videoUrl: text("video_url"),
  youtubeUrl: text("youtube_url"),
  updateUrl: text("update_url"),
  feedbackUrl: text("feedback_url"),
  category: text("category").notNull().default("mobile"),
  status: text("status", { enum: ["active", "draft"] }).notNull().default("active"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertProductSchema = createInsertSchema(products).omit({
  id: true,
  createdAt: true,
});

export type Product = typeof products.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;

// === Pricing Tiers (per product) ===
export const pricingTiers = pgTable("pricing_tiers", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull(),
  label: text("label").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  resellerPrice: decimal("reseller_price", { precision: 10, scale: 2 }),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const insertPricingTierSchema = createInsertSchema(pricingTiers).omit({
  id: true,
}).extend({
  price: z.coerce.number().min(0),
});

export type PricingTier = typeof pricingTiers.$inferSelect;
export type InsertPricingTier = z.infer<typeof insertPricingTierSchema>;

// === Wallet Transactions ===
export const walletTransactions = pgTable("wallet_transactions", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  type: text("type", { enum: ["credit", "debit"] }).notNull(),
  description: text("description").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export type WalletTransaction = typeof walletTransactions.$inferSelect;

// === Purchases ===
export const purchases = pgTable("purchases", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  productId: integer("product_id").notNull(),
  tierId: integer("tier_id").notNull(),
  licenseKey: text("license_key").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export type Purchase = typeof purchases.$inferSelect;

// === Referrals ===
export const referrals = pgTable("referrals", {
  id: serial("id").primaryKey(),
  referrerId: text("referrer_id").notNull(),
  referredId: text("referred_id").notNull(),
  rewardAmount: decimal("reward_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("created_at").defaultNow(),
});

export type Referral = typeof referrals.$inferSelect;

// === License Key Stock (pre-added by admin) ===
export const licenseKeys = pgTable("license_keys", {
  id: serial("id").primaryKey(),
  tierId: integer("tier_id").notNull(),
  productId: integer("product_id").notNull(),
  keyValue: text("key_value").notNull(),
  status: text("status", { enum: ["available", "sold"] }).notNull().default("available"),
  soldToUserId: text("sold_to_user_id"),
  soldAt: timestamp("sold_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertLicenseKeySchema = createInsertSchema(licenseKeys).omit({
  id: true,
  createdAt: true,
  soldAt: true,
});

export type LicenseKey = typeof licenseKeys.$inferSelect;
export type InsertLicenseKey = z.infer<typeof insertLicenseKeySchema>;

// === Payment Sessions (UPI) ===
export const paymentSessions = pgTable("payment_sessions", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  transactionRef: text("transaction_ref").notNull(),
  utr: text("utr"),
  status: text("status", { enum: ["pending", "completed", "expired", "failed"] }).notNull().default("pending"),
  method: text("method").default("manual"),
  createdAt: timestamp("created_at").defaultNow(),
});

export type PaymentSession = typeof paymentSessions.$inferSelect;

// === Relations ===
export const productRelations = relations(products, ({ many }) => ({
  tiers: many(pricingTiers),
}));

export const pricingTierRelations = relations(pricingTiers, ({ one }) => ({
  product: one(products, {
    fields: [pricingTiers.productId],
    references: [products.id],
  }),
}));

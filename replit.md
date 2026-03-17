# AdminPanels - Digital Product Marketplace

## Overview
A digital product marketplace matching adminpanels.shop with sidebar navigation, wallet system, product marketplace, license key delivery, referrals, and user profile management.

## Architecture
- **Frontend**: React + Vite + TailwindCSS + Shadcn UI (Sidebar layout)
- **Backend**: Express.js + Drizzle ORM + PostgreSQL
- **Auth**: Custom username/password with bcrypt + express-session
- **Routing**: wouter (client-side)
- **Currency**: Indian Rupees (₹)
- **Default Theme**: Dark mode

## Key Features
- Sidebar navigation (Dashboard, Deposit, User Stock, My Keys, History, Reseller, Referrals, Profile)
- Product listings with feature lists and multiple pricing tiers
- Wallet-based payment system with deposit page
- Instant license key delivery on purchase
- Transaction history tracking
- Referral program with unique codes
- User profile management
- Dark/Light theme toggle
- ₹500 welcome bonus for new users
- **Admin Panel** at /admin with separate username/password login
  - Dashboard with stats (users, products, purchases, revenue)
  - Products CRUD (add/edit/delete products and pricing tiers)
  - License Keys viewer (all issued keys with user info)
  - Users management (view users, adjust wallet balances)
  - Rate-limited login (5 attempts per 15 minutes)
- **Reseller System** — ₹1000 one-time upgrade from wallet
  - Reseller Package card on marketplace page
  - Dedicated /reseller page with wholesale pricing
  - Discounted reseller prices set per tier by admin (reseller_price column)
  - Resellers buy at lower rate, resell for profit
  - Same stock-based license key delivery

## Database Tables
- `users` / `sessions` - Auth tables (managed by Replit Auth integration)
- `products` - Digital products with name, description, features array, image
- `pricing_tiers` - Multiple pricing options per product (label + price in ₹)
- `wallet_transactions` - Credit/debit records per user
- `purchases` - Purchase records with generated license keys
- `referrals` - Referral tracking (referrer, referred, reward amount)
- `payment_sessions` - UPI payment sessions (userId, amount, transactionRef, status, createdAt)

## API Endpoints
- `GET /api/products` - List all active products with tiers (public)
- `GET /api/wallet/balance` - Get user wallet balance (auth, auto-grants ₹500 welcome bonus)
- `POST /api/wallet/topup` - Add funds to wallet (auth, body: {amount})
- `GET /api/wallet/transactions` - Transaction history (auth)
- `POST /api/purchases/buy` - Purchase a tier (auth, body: {tierId})
- `GET /api/purchases` - List user purchases with product/tier names (auth)
- `GET /api/dashboard/stats` - Dashboard stats: balance, purchases, spent, referrals (auth)
- `GET /api/referrals` - Referral info: code, stats, list (auth)
- `GET /api/profile` - User profile (auth)
- `POST /api/profile` - Update profile (auth, body: {firstName, lastName})
- `POST /api/payments/create` - Create UPI payment session (auth, body: {amount})
- `GET /api/payments/:id` - Get payment session status (auth)
- `GET /api/payments/upi-info` - Get UPI merchant info (auth)
- `POST /api/payments/confirm` - Confirm UPI payment (auth, body: {sessionId})
- Auth routes: `POST /api/auth/register` (accepts referralCode), `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/user`

## Payment Flow (4-tier: Razorpay Live → PayIndia Auto → UPIGateway Auto → Manual QR + UTR)
1. Deposit page has "INSTANT UPI" and "BINANCE / USDT" tabs with preset amount buttons
2. User enters amount → clicks "PAY INSTANTLY"
3. Priority 1: If RAZORPAY_KEY_ID starts with `rzp_live_` → Razorpay Checkout modal
4. Priority 2: If PAYINDIA_API_KEY configured → PayIndia auto-payment (payment.powercrker.fun)
   - Creates order via PayIndia API → gets payment_url
   - Payment page shown in iframe with QR code + UPI app buttons
   - Backend polls PayIndia status API every 3s → auto-credits wallet on success
   - No UTR needed, no admin approval needed — fully automatic
5. Priority 3: If UPIGATEWAY_API_KEY configured → UPIGateway.com auto-payment (same flow)
6. Priority 4: Fallback → Manual UPI QR code with UTR submission (admin approval)
7. Admin can still approve/reject payments from /admin/payments
8. PAYINDIA_API_KEY and UPIGATEWAY_API_KEY stored as env secrets

## Frontend Pages & Routes
- `/` - Marketplace / User Stock (public, default landing page)
- `/login` - Login page
- `/register` - Registration page
- `/dashboard` - Dashboard (authenticated)
- `/deposit` - Wallet deposit page (UPI payment method)
- `/payment/:id` - UPI payment QR code page
- `/buy` - Alias for Marketplace (same as /)
- `/mykeys` - My Keys (purchased license keys)
- `/history` - Transaction history
- `/referrals` - Referral program
- `/reseller` - Reseller panel (upgrade or wholesale products)
- `/profile` - User profile
- `/admin` - Admin login / Admin Dashboard
- `/admin/products` - Admin Products management
- `/admin/keys` - Admin License Keys viewer
- `/admin/payments` - Admin UPI Payments (approve/reject)
- `/admin/users` - Admin Users management

## Project Structure
- `client/src/App.tsx` - Main app with sidebar layout + admin routing
- `client/src/components/app-sidebar.tsx` - User sidebar navigation
- `client/src/components/admin-sidebar.tsx` - Admin sidebar navigation
- `client/src/components/ProductCard.tsx` - Product card with tiers
- `client/src/components/WalletBadge.tsx` - Wallet balance badge
- `client/src/components/ThemeToggle.tsx` - Theme switcher
- `client/src/pages/` - Dashboard, Deposit, Payment, Marketplace, MyPurchases, History, Referrals, Profile, Landing
- `client/src/pages/Admin*.tsx` - AdminLogin, AdminDashboard, AdminProducts, AdminKeys, AdminUsers
- `server/routes.ts` - All API routes + admin routes + seed data
- `server/storage.ts` - Database storage layer + admin methods
- `server/payindia.ts` - PayIndia payment gateway integration (payment.powercrker.fun)
- `server/upigateway.ts` - UPIGateway.com payment gateway integration
- `shared/schema.ts` - Drizzle schema + types
- `shared/routes.ts` - API contract definitions

## Admin Panel
- Separate username/password auth (not Replit Auth)
- Credentials stored in env vars: ADMIN_USERNAME, ADMIN_PASSWORD
- Rate-limited login: 5 attempts per 15 minutes per IP
- Session-based auth with isAdmin flag
- Admin API routes: /api/admin/* (all protected by isAdmin middleware)

## Recent Changes
- 2026-02-19: Added Admin Panel
  - Separate admin login at /admin with username/password
  - Admin Dashboard with stats (users, products, purchases, revenue)
  - Products CRUD (add/edit/delete products and pricing tiers)
  - License Keys viewer (all issued keys with user info)
  - Users management (view users, adjust wallet balances with validation)
  - Rate-limited login (5 attempts per 15 minutes)
  - Admin sidebar navigation
- 2026-02-19: Added UPI/Paytm payment integration
  - Payment sessions table for tracking UPI payments
  - UPI QR code payment page matching reference site design
  - Countdown timer, merchant info, copy UPI ID
  - Server-side session expiry (5 min)
  - Deposit page redirects to UPI payment flow
- 2026-03-09: Premium UI animation overhaul across all pages
  - Card entrance animations with staggered delays (animate-card-entrance)
  - Glowing title text effects (animate-title-glow)
  - Pulsing balance displays (animate-balance-pulse)
  - Scan-line effect on product video hover (GPU-accelerated transform)
  - Purchase button shimmer effect on hover
  - Feature rows slide-in on hover
  - Consistent dark theme with cyan/teal accents across all pages
  - Narrowed CSS transitions for better performance
  - prefers-reduced-motion media query support
  - Dashboard, Deposit, History, MyKeys, Referrals, Profile all restyled
- 2026-03-09: Coins & Lucky Spin referral system
  - Referrals now reward 25 coins (instead of ₹5 balance)
  - Lucky Spin wheel on Referrals page (costs 25 coins, win ₹1/5/20/100)
  - Coins column added to users table
  - Weighted spin: 50% ₹1, 30% ₹5, 15% ₹20, 5% ₹100
  - Spin winnings credited to wallet balance
  - SVG spin wheel with animation, matching dark theme
- 2026-02-19: Full site rebuild matching adminpanels.shop
  - Sidebar navigation layout with all pages
  - Dashboard with stats cards
  - Deposit page with preset amounts
  - Transaction history page
  - Referral program page
  - Profile management page
  - Landing page matching reference login style
  - ₹ currency throughout

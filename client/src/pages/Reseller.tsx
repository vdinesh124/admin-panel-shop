import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Crown, Zap, ShieldCheck, Sparkles, Lock, Star, ChevronDown } from "lucide-react";
import type { Product, PricingTier } from "@shared/schema";

type ProductWithTiers = Product & { tiers: PricingTier[] };

function ResellerProductCard({ product, index }: { product: ProductWithTiers; index: number }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [showTiers, setShowTiers] = useState(false);

  const buyMutation = useMutation({
    mutationFn: async (tierId: number) => {
      try {
        const res = await apiRequest("POST", "/api/reseller/buy", { tierId });
        return res.json();
      } catch (err: any) {
        const msg = err?.message || "";
        try {
          const jsonPart = msg.substring(msg.indexOf("{"));
          const parsed = JSON.parse(jsonPart);
          throw new Error(parsed.message || "Purchase failed");
        } catch (parseErr) {
          if (parseErr instanceof Error && parseErr.message !== "Purchase failed" && !parseErr.message.includes("JSON")) {
            throw parseErr;
          }
          throw new Error(msg.includes("Insufficient") ? "Insufficient balance" : "Purchase failed");
        }
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/wallet/balance"] });
      queryClient.invalidateQueries({ queryKey: ["/api/purchases"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet/transactions"] });
      const key = data.licenseKey || data.license_key || "";
      navigator.clipboard.writeText(key).catch(() => {});
      toast({
        title: ">> KEY COPIED AUTOMATICALLY <<",
        description: `Your license key: ${key}`,
      });
    },
    onError: (error: Error) => {
      if (error.message?.toLowerCase().includes("insufficient")) {
        toast({ title: "Insufficient Balance", description: "Add funds to your wallet first.", variant: "destructive" });
        setTimeout(() => setLocation("/deposit"), 1000);
        return;
      }
      toast({ title: "Purchase Failed", description: error.message, variant: "destructive" });
    },
  });

  return (
    <div
      className="rounded-xl overflow-hidden flex flex-col animate-card-entrance"
      style={{
        border: "2px solid rgba(245, 158, 11, 0.5)",
        animationDelay: `${index * 0.12}s`,
        background: "linear-gradient(180deg, #0d0d1a 0%, #1a1a2e 100%)",
      }}
      data-testid={`card-reseller-product-${product.id}`}
    >
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center gap-2 mb-3">
          <Crown className="w-4 h-4 text-amber-400" />
          <h5 className="text-sm font-extrabold uppercase tracking-wider text-white animate-title-glow" data-testid={`text-reseller-product-${product.id}`}>
            {product.name}
          </h5>
        </div>

        <div className="space-y-1.5">
          {product.features.slice(0, 3).map((feature, idx) => (
            <div
              key={idx}
              className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs"
              style={{ background: "rgba(245, 158, 11, 0.04)", border: "1px solid rgba(245, 158, 11, 0.15)" }}
            >
              <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400 flex-shrink-0" />
              <span className="text-gray-300 font-medium">{feature.startsWith("-") ? feature.slice(1).trim() : feature}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="px-4 pb-4 mt-auto">
        <button
          onClick={() => setShowTiers(!showTiers)}
          className="w-full py-2.5 rounded-md text-xs font-extrabold uppercase tracking-widest text-white relative overflow-hidden"
          style={{ background: "linear-gradient(135deg, #d97706 0%, #f59e0b 50%, #eab308 100%)" }}
          data-testid={`button-reseller-purchase-${product.id}`}
        >
          <Crown className="w-3.5 h-3.5 inline mr-1" />
          Reseller Purchase
        </button>

        {showTiers && (
          <div className="mt-2 space-y-1.5 animate-slide-down">
            {product.tiers.map((tier, tIdx) => (
              <div
                key={tier.id}
                className="flex items-center justify-between gap-2 px-3 py-2 rounded-md"
                style={{ background: "rgba(245, 158, 11, 0.08)", border: "1px solid rgba(245, 158, 11, 0.25)" }}
                data-testid={`row-reseller-tier-${tier.id}`}
              >
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-gray-300">{tier.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-500 line-through">₹{Number(tier.price).toFixed(0)}</span>
                    <span className="text-xs font-bold text-amber-400" data-testid={`text-reseller-price-${tier.id}`}>
                      ₹{Number(tier.resellerPrice).toFixed(0)}
                    </span>
                    <span className="text-[9px] font-bold text-green-400 px-1 py-0.5 rounded" style={{ background: "rgba(16, 185, 129, 0.15)" }}>
                      SAVE ₹{(Number(tier.price) - Number(tier.resellerPrice)).toFixed(0)}
                    </span>
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => buyMutation.mutate(tier.id)}
                  disabled={buyMutation.isPending}
                  className="uppercase text-[10px] font-bold px-3 h-6 border-0"
                  style={{ background: "linear-gradient(135deg, #d97706, #f59e0b)" }}
                  data-testid={`button-reseller-buy-${tier.id}`}
                >
                  Buy
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Reseller() {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const { data: resellerStatus } = useQuery<{ isReseller: boolean }>({
    queryKey: ["/api/reseller/status"],
    enabled: isAuthenticated,
  });

  const { data: walletData } = useQuery<{ balance: number }>({
    queryKey: ["/api/wallet/balance"],
    enabled: isAuthenticated,
  });

  const { data: resellerProducts, isLoading: productsLoading } = useQuery<ProductWithTiers[]>({
    queryKey: ["/api/reseller/products"],
    enabled: isAuthenticated && resellerStatus?.isReseller === true,
  });

  const balance = walletData?.balance ?? 0;
  const isReseller = resellerStatus?.isReseller === true;

  const upgradeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/reseller/upgrade");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reseller/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet/balance"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet/transactions"] });
      toast({ title: "Reseller Activated!", description: "You now have access to wholesale prices." });
    },
    onError: (error: Error) => {
      if (error.message?.includes("Insufficient") || error.message?.includes("1000")) {
        toast({ title: "Insufficient Balance", description: "You need minimum ₹1,000 balance to unlock. No amount deducted.", variant: "destructive" });
        setTimeout(() => setLocation("/deposit"), 1500);
        return;
      }
      toast({ title: "Upgrade Failed", description: error.message, variant: "destructive" });
    },
  });

  if (!isReseller) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center gap-3 animate-fade-slide-up">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md"
            style={{ background: "linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(245, 158, 11, 0.02))", border: "1px solid rgba(245, 158, 11, 0.3)" }}
          >
            <Crown className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-extrabold uppercase tracking-wider text-amber-400">Reseller Program</span>
          </div>
        </div>

        <div
          className="rounded-2xl p-6 space-y-6 animate-card-entrance"
          style={{
            background: "linear-gradient(135deg, #0d1424 0%, #1a1a2e 100%)",
            border: "2px solid rgba(245, 158, 11, 0.4)",
            boxShadow: "0 0 30px rgba(245, 158, 11, 0.08)",
          }}
        >
          <div className="text-center space-y-3">
            <div className="w-20 h-20 rounded-full mx-auto flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(245, 158, 11, 0.05))", border: "3px solid rgba(245, 158, 11, 0.4)" }}
            >
              <Crown className="w-10 h-10 text-amber-400" />
            </div>
            <h2 className="text-2xl font-extrabold text-white tracking-wide">RESELLER PACKAGE</h2>
            <p className="text-gray-400 text-sm">Maintain ₹1,000+ balance to unlock wholesale prices — no deduction!</p>
          </div>

          <div className="space-y-3">
            {[
              "Buy products at discounted wholesale prices",
              "Higher profit margins on every sale",
              "Access to exclusive reseller dashboard",
              "Priority stock availability",
              "No deduction — just maintain ₹1,000 balance to unlock",
            ].map((feature, idx) => (
              <div
                key={idx}
                className="flex items-center gap-3 px-4 py-2.5 rounded-lg"
                style={{ background: "rgba(245, 158, 11, 0.05)", border: "1px solid rgba(245, 158, 11, 0.15)" }}
              >
                <Star className="w-4 h-4 text-amber-400 fill-amber-400 flex-shrink-0" />
                <span className="text-sm text-gray-300 font-medium">{feature}</span>
              </div>
            ))}
          </div>

          <div className="text-center space-y-4 pt-2">
            <div className="flex items-center justify-center gap-2">
              <span className="text-4xl font-extrabold text-amber-400">₹1,000</span>
              <span className="text-sm text-gray-500 font-medium">min balance required</span>
            </div>

            {isAuthenticated && (
              <p className="text-xs text-gray-500">
                Your balance: <span className="text-white font-bold">₹{balance.toFixed(2)}</span>
              </p>
            )}

            <Button
              onClick={() => {
                if (!isAuthenticated) {
                  setLocation("/login");
                  return;
                }
                upgradeMutation.mutate();
              }}
              disabled={upgradeMutation.isPending}
              className="w-full py-6 text-base font-extrabold uppercase tracking-widest rounded-xl border-0"
              style={{ background: "linear-gradient(135deg, #d97706 0%, #f59e0b 50%, #eab308 100%)", color: "#000" }}
              data-testid="button-upgrade-reseller"
            >
              {upgradeMutation.isPending ? "Processing..." : (
                <>
                  <Crown className="w-5 h-5 mr-2" />
                  Unlock Reseller — ₹0 Deduction
                </>
              )}
            </Button>

            {balance < 1000 && isAuthenticated && (
              <button
                onClick={() => setLocation("/deposit")}
                className="text-xs text-amber-400 hover:text-amber-300 underline"
                data-testid="link-deposit-for-reseller"
              >
                Deposit ₹{(1000 - balance).toFixed(0)} more to reach ₹1,000 balance
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center gap-3 animate-fade-slide-up">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-md"
          style={{ background: "linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(245, 158, 11, 0.02))", border: "1px solid rgba(245, 158, 11, 0.3)" }}
        >
          <Crown className="w-4 h-4 text-amber-400" />
          <span className="text-sm font-extrabold uppercase tracking-wider text-amber-400 animate-title-glow">
            Reseller Panel
          </span>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-1 rounded text-[10px] text-emerald-400 font-semibold"
          style={{ background: "rgba(16, 185, 129, 0.08)", border: "1px solid rgba(16, 185, 129, 0.2)" }}
        >
          <ShieldCheck className="w-3 h-3" />
          ACTIVE
        </div>
      </div>

      <div
        className="flex items-center justify-between px-4 py-3 rounded-lg animate-fade-slide-up"
        style={{ background: "linear-gradient(135deg, rgba(245, 158, 11, 0.06), rgba(0, 0, 0, 0.3))", border: "1px solid rgba(245, 158, 11, 0.2)" }}
      >
        <p className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Wallet Balance:</p>
        <h4 className="text-xl font-extrabold text-white animate-balance-pulse" data-testid="text-reseller-balance">
          ₹{balance.toFixed(2)}
        </h4>
      </div>

      <div
        className="flex items-center gap-3 px-4 py-3 rounded-lg"
        style={{ background: "rgba(245, 158, 11, 0.05)", border: "1px solid rgba(245, 158, 11, 0.2)" }}
      >
        <Crown className="w-5 h-5 text-amber-400" />
        <span className="text-sm text-amber-300 font-semibold">Wholesale prices applied — buy at discounted rates and resell for profit!</span>
      </div>

      {productsLoading ? (
        <div className="text-center py-16 text-gray-500">Loading reseller products...</div>
      ) : resellerProducts && resellerProducts.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {resellerProducts.map((product, idx) => (
            <ResellerProductCard key={product.id} product={product} index={idx} />
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <Crown className="w-12 h-12 text-amber-400/30 mx-auto mb-3" />
          <p className="text-gray-500">No reseller products available yet.</p>
          <p className="text-gray-600 text-sm mt-1">Admin needs to set reseller prices for products.</p>
        </div>
      )}
    </div>
  );
}

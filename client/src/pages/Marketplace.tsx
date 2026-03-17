import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { ProductCard } from "@/components/ProductCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Lock, ShieldCheck, Sparkles, Crown } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import type { Product, PricingTier } from "@shared/schema";

type ProductWithTiers = Product & { tiers: PricingTier[] };

export default function Marketplace() {
  const { isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const [showSecureLink, setShowSecureLink] = useState(true);
  const [showKeyCopied, setShowKeyCopied] = useState(false);

  const { data: products, isLoading } = useQuery<ProductWithTiers[]>({
    queryKey: ["/api/products"],
  });

  const { data: walletData } = useQuery<{ balance: number }>({
    queryKey: ["/api/wallet/balance"],
    enabled: isAuthenticated,
  });

  const { data: resellerStatus } = useQuery<{ isReseller: boolean }>({
    queryKey: ["/api/reseller/status"],
    enabled: isAuthenticated,
  });

  const balance = walletData?.balance ?? 0;
  const isReseller = resellerStatus?.isReseller === true;

  useEffect(() => {
    const timer = setTimeout(() => setShowSecureLink(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const handler = () => {
      setShowKeyCopied(true);
      setTimeout(() => setShowKeyCopied(false), 5000);
    };
    window.addEventListener("key-copied", handler);
    return () => window.removeEventListener("key-copied", handler);
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-4">
      {showSecureLink && (
        <div
          className="flex items-center justify-center gap-2 text-xs text-yellow-500 bg-yellow-500/10 rounded-md py-2 px-3 animate-secure-link animate-fade-scale-in"
          style={{ border: "1px solid rgba(234, 179, 8, 0.2)" }}
          data-testid="text-secure-link"
        >
          <Lock className="w-3 h-3 animate-pulse" />
          <span className="font-semibold tracking-wide">Initializing secure link...</span>
        </div>
      )}

      {showKeyCopied && (
        <div
          className="flex items-center justify-center text-xs text-green-400 bg-green-500/10 border border-green-500/20 rounded-md py-2 px-3 font-bold tracking-wider animate-key-copied"
          data-testid="text-key-copied"
        >
          &gt;&gt; KEY COPIED AUTOMATICALLY &lt;&lt;
        </div>
      )}

      <div className="flex items-center gap-3 animate-fade-slide-up">
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-md"
          style={{
            background: "linear-gradient(135deg, rgba(0, 220, 255, 0.08), rgba(0, 220, 255, 0.02))",
            border: "1px solid rgba(0, 220, 255, 0.2)",
          }}
        >
          <Sparkles className="w-4 h-4 text-cyan-400" />
          <span className="text-sm font-extrabold uppercase tracking-wider text-cyan-400 animate-title-glow">
            Marketplace / User Stock
          </span>
        </div>
        <div
          className="flex items-center gap-1.5 px-2 py-1 rounded text-[10px] text-emerald-400 font-semibold"
          style={{
            background: "rgba(16, 185, 129, 0.08)",
            border: "1px solid rgba(16, 185, 129, 0.2)",
          }}
        >
          <ShieldCheck className="w-3 h-3" />
          LIVE
        </div>
      </div>

      {isAuthenticated && (
        <div
          className="flex items-center justify-between px-4 py-3 rounded-lg animate-fade-slide-up balance-bar animate-border-glow"
          style={{
            background: "linear-gradient(135deg, rgba(0, 220, 255, 0.06), rgba(0, 0, 0, 0.3))",
            border: "1px solid rgba(0, 220, 255, 0.2)",
            animationDelay: "0.1s",
          }}
        >
          <p className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Available Balance:</p>
          <h4 className="text-xl font-extrabold text-white animate-balance-pulse" data-testid="text-balance-display">
            ₹{balance.toFixed(2)}
          </h4>
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl overflow-hidden animate-pulse" style={{ border: "2px solid rgba(0, 220, 255, 0.15)" }}>
              <Skeleton className="h-44 w-full" style={{ background: "rgba(0, 220, 255, 0.05)" }} />
              <div className="p-4 space-y-3" style={{ background: "#1a1a2e" }}>
                <Skeleton className="h-4 w-2/3 mx-auto" style={{ background: "rgba(0, 220, 255, 0.08)" }} />
                <Skeleton className="h-3 w-full" style={{ background: "rgba(0, 220, 255, 0.05)" }} />
                <Skeleton className="h-3 w-5/6" style={{ background: "rgba(0, 220, 255, 0.05)" }} />
                <Skeleton className="h-3 w-4/6" style={{ background: "rgba(0, 220, 255, 0.05)" }} />
                <Skeleton className="h-10 w-full rounded-md" style={{ background: "rgba(124, 58, 237, 0.15)" }} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-5" data-testid="list-products">
          {(() => {
            const sorted = [...(products || [])].sort((a, b) => a.sortOrder - b.sortOrder);
            const mobileProducts = sorted.filter(p => (p as any).category !== "pc");
            const pcProducts = sorted.filter(p => (p as any).category === "pc");
            let cardIdx = 0;

            return (
              <>
                {mobileProducts.length > 0 && (
                  <div>
                    <div className="flex items-center gap-3 mb-4 animate-fade-slide-up">
                      <div
                        className="flex items-center gap-2 px-3 py-1.5 rounded-md"
                        style={{
                          background: "linear-gradient(135deg, rgba(0, 220, 255, 0.08), rgba(0, 220, 255, 0.02))",
                          border: "1px solid rgba(0, 220, 255, 0.25)",
                        }}
                      >
                        <Sparkles className="w-4 h-4 text-cyan-400" />
                        <span className="text-sm font-extrabold uppercase tracking-wider text-cyan-400">
                          Mobile Panels
                        </span>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                      {mobileProducts.map((product) => {
                        const idx = cardIdx++;
                        return <ProductCard key={product.id} product={product} index={idx} />;
                      })}
                    </div>
                  </div>
                )}

                {pcProducts.length > 0 && (
                  <div>
                    <div className="flex items-center gap-3 my-4 animate-fade-slide-up">
                      <div
                        className="flex items-center gap-2 px-3 py-1.5 rounded-md"
                        style={{
                          background: "linear-gradient(135deg, rgba(168, 85, 247, 0.1), rgba(168, 85, 247, 0.02))",
                          border: "1px solid rgba(168, 85, 247, 0.3)",
                        }}
                      >
                        <Sparkles className="w-4 h-4 text-purple-400" />
                        <span className="text-sm font-extrabold uppercase tracking-wider text-purple-400">
                          PC Panels
                        </span>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                      {pcProducts.map((product) => {
                        const idx = cardIdx++;
                        return <ProductCard key={product.id} product={product} index={idx} />;
                      })}
                    </div>
                  </div>
                )}
              </>
            );
          })()}
        </div>
      )}

      {!isLoading && (!products || products.length === 0) && (
        <div className="text-center py-16 text-muted-foreground">
          No products available at the moment.
        </div>
      )}

      {isAuthenticated && !isReseller && (
        <div className="animate-fade-slide-up" style={{ animationDelay: "0.3s" }}>
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-md"
              style={{ background: "linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(245, 158, 11, 0.02))", border: "1px solid rgba(245, 158, 11, 0.3)" }}
            >
              <Crown className="w-4 h-4 text-amber-400" />
              <span className="text-sm font-extrabold uppercase tracking-wider text-amber-400">Reseller Program</span>
            </div>
          </div>
          <div
            className="rounded-xl overflow-hidden cursor-pointer transition-all duration-300 hover:scale-[1.01]"
            style={{
              background: "linear-gradient(135deg, #0d1424 0%, #1a1a2e 100%)",
              border: "2px solid rgba(245, 158, 11, 0.4)",
              boxShadow: "0 0 20px rgba(245, 158, 11, 0.06)",
            }}
            onClick={() => setLocation("/reseller")}
            data-testid="card-reseller-package"
          >
            <div className="p-5 flex items-center gap-5">
              <div className="w-16 h-16 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: "linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(245, 158, 11, 0.05))", border: "2px solid rgba(245, 158, 11, 0.3)" }}
              >
                <Crown className="w-8 h-8 text-amber-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-extrabold text-white uppercase tracking-wide">Reseller Package</h3>
                <p className="text-xs text-gray-400 mt-1">Maintain ₹1,000 balance to unlock wholesale prices. No deduction — buy at lower rates & resell!</p>
                <div className="flex items-center gap-3 mt-2">
                  <span className="text-xl font-extrabold text-amber-400">₹1,000</span>
                  <span className="text-[10px] text-gray-500 font-medium uppercase">min balance • no deduction</span>
                </div>
              </div>
              <div className="px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider text-black flex-shrink-0"
                style={{ background: "linear-gradient(135deg, #d97706, #f59e0b)" }}
              >
                Unlock Now
              </div>
            </div>
          </div>
        </div>
      )}

      {isAuthenticated && isReseller && (
        <div className="animate-fade-slide-up" style={{ animationDelay: "0.3s" }}>
          <div
            className="rounded-xl overflow-hidden cursor-pointer transition-all duration-300 hover:scale-[1.01]"
            style={{
              background: "linear-gradient(135deg, rgba(245, 158, 11, 0.05), rgba(0, 0, 0, 0.3))",
              border: "1px solid rgba(245, 158, 11, 0.2)",
            }}
            onClick={() => setLocation("/reseller")}
            data-testid="card-reseller-active"
          >
            <div className="p-4 flex items-center gap-3">
              <Crown className="w-5 h-5 text-amber-400" />
              <span className="text-sm font-bold text-amber-300">Reseller Panel Active</span>
              <span className="text-[10px] text-green-400 font-semibold ml-auto px-2 py-0.5 rounded" style={{ background: "rgba(16, 185, 129, 0.1)", border: "1px solid rgba(16, 185, 129, 0.2)" }}>
                ACTIVE
              </span>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

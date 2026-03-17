import { useQuery } from "@tanstack/react-query";
import { Key, Copy, CheckCircle2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

interface PurchaseWithDetails {
  id: number;
  userId: string;
  productId: number;
  tierId: number;
  licenseKey: string;
  amount: string;
  createdAt: string;
  productName?: string;
  tierLabel?: string;
}

export default function MyPurchases() {
  const { toast } = useToast();
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const { data: purchases, isLoading } = useQuery<PurchaseWithDetails[]>({
    queryKey: ["/api/purchases"],
  });

  const copyKey = (key: string, id: number) => {
    navigator.clipboard.writeText(key);
    setCopiedId(id);
    toast({ title: "Copied!", description: "License key copied to clipboard." });
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-5">
      <div className="flex items-center gap-3 animate-fade-slide-up">
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-md"
          style={{
            background: "linear-gradient(135deg, rgba(0, 220, 255, 0.08), rgba(0, 220, 255, 0.02))",
            border: "1px solid rgba(0, 220, 255, 0.2)",
          }}
        >
          <Key className="w-4 h-4 text-cyan-400" />
          <span className="text-sm font-extrabold uppercase tracking-wider text-cyan-400 animate-title-glow">
            My Keys
          </span>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-xl p-4 animate-pulse" style={{ background: "#1a1a2e", border: "1px solid rgba(0, 220, 255, 0.08)" }}>
              <div className="flex items-center gap-3">
                <Skeleton className="w-10 h-10 rounded-lg" style={{ background: "rgba(0, 220, 255, 0.05)" }} />
                <div className="flex-1">
                  <Skeleton className="h-3 w-48 mb-2" style={{ background: "rgba(0, 220, 255, 0.05)" }} />
                  <Skeleton className="h-2.5 w-64" style={{ background: "rgba(0, 220, 255, 0.03)" }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : purchases && purchases.length > 0 ? (
        <div className="space-y-3">
          {purchases.map((purchase, idx) => (
            <div
              key={purchase.id}
              className="rounded-xl p-4 animate-card-entrance action-btn-hover"
              style={{
                background: "linear-gradient(135deg, rgba(124, 58, 237, 0.06), rgba(0, 0, 0, 0.2))",
                border: "1.5px solid rgba(124, 58, 237, 0.2)",
                animationDelay: `${idx * 0.08}s`,
              }}
              data-testid={`card-purchase-${purchase.id}`}
            >
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "rgba(124, 58, 237, 0.15)" }}>
                    <Key className="w-4 h-4 text-purple-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-200">
                      {purchase.productName || `Product #${purchase.productId}`}
                      {purchase.tierLabel && (
                        <span className="text-gray-500 ml-1">- {purchase.tierLabel}</span>
                      )}
                    </p>
                    <p className="text-xs text-cyan-500/70 font-mono truncate max-w-xs" data-testid={`text-license-key-${purchase.id}`}>
                      {purchase.licenseKey}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span
                    className="text-xs font-bold px-2 py-1 rounded-md"
                    style={{
                      background: "rgba(124, 58, 237, 0.1)",
                      color: "#a78bfa",
                      border: "1px solid rgba(124, 58, 237, 0.2)",
                    }}
                  >
                    ₹{Number(purchase.amount).toFixed(2)}
                  </span>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => copyKey(purchase.licenseKey, purchase.id)}
                    className="hover:bg-cyan-500/10 transition-all"
                    data-testid={`button-copy-key-${purchase.id}`}
                  >
                    {copiedId === purchase.id ? (
                      <CheckCircle2 className="w-4 h-4 text-green-400" />
                    ) : (
                      <Copy className="w-4 h-4 text-gray-400" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div
          className="text-center py-16 rounded-xl animate-fade-slide-up"
          style={{
            background: "rgba(0, 220, 255, 0.02)",
            border: "1px solid rgba(0, 220, 255, 0.08)",
          }}
          data-testid="text-no-purchases"
        >
          <ShieldCheck className="w-10 h-10 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500">No purchases yet. Browse the marketplace to get started.</p>
        </div>
      )}
    </div>
  );
}

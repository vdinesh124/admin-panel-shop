import { useQuery } from "@tanstack/react-query";
import { Loader2, Clock, Crown } from "lucide-react";

interface PricingTier {
  id: number;
  label: string;
  price: string;
  resellerPrice: string | null;
}

interface Product {
  id: number;
  name: string;
  image: string | null;
  tiers: PricingTier[];
}

export default function ResellerPriceList() {
  const { data: products, isLoading } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });
  const { data: stockMap } = useQuery<Record<number, number>>({
    queryKey: ["/api/products/stock"],
  });

  const cards: { product: Product; tier: PricingTier }[] = [];
  products?.forEach(p =>
    p.tiers.forEach(t => {
      if (t.resellerPrice) cards.push({ product: p, tier: t });
    })
  );

  return (
    <div className="min-h-screen" style={{ background: "#050505" }}>
      <div className="max-w-2xl mx-auto px-3 py-6">
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-3" style={{ background: "rgba(217,119,6,0.1)", border: "1px solid rgba(217,119,6,0.2)" }}>
            <Crown className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">Reseller Price List</span>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {cards.map(({ product, tier }) => {
              const stock = stockMap?.[tier.id] ?? 0;
              const userPrice = Number(tier.price);
              const resellerPrice = Number(tier.resellerPrice);
              return (
                <div
                  key={tier.id}
                  className="rounded-xl p-3 relative overflow-hidden"
                  style={{
                    background: "#0d1424",
                    border: "1px solid rgba(16,185,129,0.25)",
                    boxShadow: "0 0 15px rgba(16,185,129,0.08)",
                  }}
                >
                  <div className="absolute top-2.5 right-2.5">
                    <span className="text-2xl font-extrabold italic" style={{ color: "rgba(16,185,129,0.25)" }}>
                      {stock}
                    </span>
                  </div>

                  <h3 className="text-sm font-extrabold text-white uppercase leading-tight pr-8">{product.name}</h3>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <Clock className="w-3.5 h-3.5 text-cyan-400" />
                    <span className="text-xs text-gray-400">{tier.label}</span>
                  </div>

                  <div className="mt-3 space-y-1.5">
                    <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg" style={{ background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.15)" }}>
                      <span className="text-[10px] font-bold text-blue-400 uppercase">User Price:</span>
                      <span className="text-sm font-extrabold text-white">₹{userPrice.toFixed(0)}</span>
                    </div>

                    <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.15)" }}>
                      <span className="text-[10px] font-bold text-red-400 uppercase">Reseller:</span>
                      <span className="text-sm font-extrabold text-emerald-400">₹{resellerPrice.toFixed(0)}</span>
                    </div>
                  </div>

                </div>
              );
            })}
          </div>
        )}

        {cards.length === 0 && !isLoading && (
          <div className="text-center py-12 text-gray-600 text-sm">No reseller products available</div>
        )}
      </div>
    </div>
  );
}

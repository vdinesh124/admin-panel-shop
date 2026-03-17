import { useQuery } from "@tanstack/react-query";
import { Wallet, ShoppingCart, CreditCard, Users, Sparkles, TrendingUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface DashboardStats {
  balance: number;
  totalPurchases: number;
  totalSpent: number;
  totalReferrals: number;
}

const gradients = [
  { border: "rgba(16, 185, 129, 0.3)", bg: "linear-gradient(135deg, rgba(16, 185, 129, 0.08), rgba(16, 185, 129, 0.02))", glow: "0 0 20px rgba(16, 185, 129, 0.1)" },
  { border: "rgba(59, 130, 246, 0.3)", bg: "linear-gradient(135deg, rgba(59, 130, 246, 0.08), rgba(59, 130, 246, 0.02))", glow: "0 0 20px rgba(59, 130, 246, 0.1)" },
  { border: "rgba(249, 115, 22, 0.3)", bg: "linear-gradient(135deg, rgba(249, 115, 22, 0.08), rgba(249, 115, 22, 0.02))", glow: "0 0 20px rgba(249, 115, 22, 0.1)" },
  { border: "rgba(168, 85, 247, 0.3)", bg: "linear-gradient(135deg, rgba(168, 85, 247, 0.08), rgba(168, 85, 247, 0.02))", glow: "0 0 20px rgba(168, 85, 247, 0.1)" },
];

export default function Dashboard() {
  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
  });

  const statCards = [
    { label: "Available Balance", value: stats ? `₹${stats.balance.toFixed(2)}` : "...", icon: Wallet, color: "text-emerald-400", iconBg: "rgba(16, 185, 129, 0.15)" },
    { label: "Total Purchases", value: stats ? String(stats.totalPurchases) : "...", icon: ShoppingCart, color: "text-blue-400", iconBg: "rgba(59, 130, 246, 0.15)" },
    { label: "Total Spent", value: stats ? `₹${stats.totalSpent.toFixed(2)}` : "...", icon: CreditCard, color: "text-orange-400", iconBg: "rgba(249, 115, 22, 0.15)" },
    { label: "Total Referrals", value: stats ? String(stats.totalReferrals) : "...", icon: Users, color: "text-purple-400", iconBg: "rgba(168, 85, 247, 0.15)" },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center gap-3 animate-fade-slide-up">
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-md"
          style={{
            background: "linear-gradient(135deg, rgba(0, 220, 255, 0.08), rgba(0, 220, 255, 0.02))",
            border: "1px solid rgba(0, 220, 255, 0.2)",
          }}
        >
          <TrendingUp className="w-4 h-4 text-cyan-400" />
          <span className="text-sm font-extrabold uppercase tracking-wider text-cyan-400 animate-title-glow">
            Dashboard / Overview
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {isLoading
          ? [0, 1, 2, 3].map((i) => (
              <div key={i} className="rounded-xl p-4 animate-pulse" style={{ background: "#1a1a2e", border: "1px solid rgba(0, 220, 255, 0.1)" }}>
                <Skeleton className="h-10 w-10 rounded-md mb-3" style={{ background: "rgba(0, 220, 255, 0.05)" }} />
                <Skeleton className="h-3 w-24 mb-2" style={{ background: "rgba(0, 220, 255, 0.05)" }} />
                <Skeleton className="h-6 w-20" style={{ background: "rgba(0, 220, 255, 0.08)" }} />
              </div>
            ))
          : statCards.map((card, idx) => (
              <div
                key={card.label}
                className="rounded-xl p-4 animate-card-entrance action-btn-hover"
                style={{
                  background: gradients[idx].bg,
                  border: `1.5px solid ${gradients[idx].border}`,
                  boxShadow: gradients[idx].glow,
                  animationDelay: `${idx * 0.1}s`,
                }}
                data-testid={`card-stat-${card.label.toLowerCase().replace(/\s/g, '-')}`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: card.iconBg }}
                  >
                    <card.icon className={`w-5 h-5 ${card.color}`} />
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase tracking-widest font-semibold">{card.label}</p>
                    <p className="text-xl font-extrabold mt-0.5 text-white" data-testid={`text-stat-${card.label.toLowerCase().replace(/\s/g, '-')}`}>
                      {card.value}
                    </p>
                  </div>
                </div>
              </div>
            ))}
      </div>

      <div
        className="rounded-xl p-4 animate-fade-slide-up"
        style={{
          background: "linear-gradient(180deg, rgba(0, 220, 255, 0.04), rgba(0, 0, 0, 0.2))",
          border: "1px solid rgba(0, 220, 255, 0.15)",
          animationDelay: "0.4s",
        }}
      >
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-cyan-400" />
          <p className="text-xs font-bold uppercase tracking-widest text-cyan-400">Quick Actions</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <a href="/deposit" className="block">
            <div
              className="p-3 rounded-lg cursor-pointer action-btn-hover flex items-center gap-2"
              style={{ border: "1px solid rgba(16, 185, 129, 0.2)", background: "rgba(16, 185, 129, 0.04)" }}
              data-testid="link-quick-deposit"
            >
              <Wallet className="w-4 h-4 text-emerald-400" />
              <span className="text-sm font-semibold text-gray-300">Add Funds</span>
            </div>
          </a>
          <a href="/buy" className="block">
            <div
              className="p-3 rounded-lg cursor-pointer action-btn-hover flex items-center gap-2"
              style={{ border: "1px solid rgba(124, 58, 237, 0.2)", background: "rgba(124, 58, 237, 0.04)" }}
              data-testid="link-quick-buy"
            >
              <ShoppingCart className="w-4 h-4 text-purple-400" />
              <span className="text-sm font-semibold text-gray-300">Browse Stock</span>
            </div>
          </a>
        </div>
      </div>
    </div>
  );
}

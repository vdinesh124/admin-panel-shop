import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, ArrowDownLeft, Clock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface Transaction {
  id: number;
  userId: string;
  amount: string;
  type: "credit" | "debit";
  description: string;
  createdAt: string;
}

export default function History() {
  const { data: transactions, isLoading } = useQuery<Transaction[]>({
    queryKey: ["/api/wallet/transactions"],
  });

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
      <div className="flex items-center gap-3 animate-fade-slide-up">
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-md"
          style={{
            background: "linear-gradient(135deg, rgba(0, 220, 255, 0.08), rgba(0, 220, 255, 0.02))",
            border: "1px solid rgba(0, 220, 255, 0.2)",
          }}
        >
          <Clock className="w-4 h-4 text-cyan-400" />
          <span className="text-sm font-extrabold uppercase tracking-wider text-cyan-400 animate-title-glow">
            Transaction History
          </span>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-xl p-3 animate-pulse" style={{ background: "#1a1a2e", border: "1px solid rgba(0, 220, 255, 0.08)", animationDelay: `${i * 0.05}s` }}>
              <div className="flex items-center gap-3">
                <Skeleton className="w-9 h-9 rounded-lg" style={{ background: "rgba(0, 220, 255, 0.05)" }} />
                <div className="flex-1">
                  <Skeleton className="h-3 w-40 mb-2" style={{ background: "rgba(0, 220, 255, 0.05)" }} />
                  <Skeleton className="h-2.5 w-24" style={{ background: "rgba(0, 220, 255, 0.03)" }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : transactions && transactions.length > 0 ? (
        <div className="space-y-2">
          {transactions.map((tx, idx) => {
            const isCredit = tx.type === "credit";
            return (
              <div
                key={tx.id}
                className="rounded-xl p-3 animate-feature-slide-in feature-row-hover"
                style={{
                  background: isCredit ? "rgba(16, 185, 129, 0.04)" : "rgba(239, 68, 68, 0.04)",
                  border: `1px solid ${isCredit ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)"}`,
                  animationDelay: `${idx * 0.04}s`,
                }}
                data-testid={`card-transaction-${tx.id}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: isCredit ? "rgba(16, 185, 129, 0.12)" : "rgba(239, 68, 68, 0.12)" }}
                    >
                      {isCredit ? (
                        <ArrowDownLeft className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <ArrowUpRight className="w-4 h-4 text-red-400" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate text-gray-200" data-testid={`text-tx-desc-${tx.id}`}>
                        {tx.description}
                      </p>
                      <p className="text-[10px] text-gray-500 uppercase tracking-wider">
                        {new Date(tx.createdAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    <span
                      className="text-sm font-bold px-2.5 py-1 rounded-md"
                      style={{
                        background: isCredit ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)",
                        color: isCredit ? "#34d399" : "#f87171",
                        border: `1px solid ${isCredit ? "rgba(16, 185, 129, 0.2)" : "rgba(239, 68, 68, 0.2)"}`,
                      }}
                      data-testid={`text-tx-amount-${tx.id}`}
                    >
                      {isCredit ? "+" : "-"}₹{Number(tx.amount).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-16 text-gray-500" data-testid="text-no-transactions">
          No transactions yet.
        </div>
      )}
    </div>
  );
}

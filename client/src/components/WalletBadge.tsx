import { useQuery } from "@tanstack/react-query";
import { Wallet } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export function WalletBadge() {
  const { isAuthenticated } = useAuth();

  const { data } = useQuery<{ balance: number }>({
    queryKey: ["/api/wallet/balance"],
    enabled: isAuthenticated,
  });

  if (!isAuthenticated) return null;

  const balance = data?.balance ?? 0;

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-primary/10 text-primary" data-testid="text-wallet-balance">
      <Wallet className="w-4 h-4" />
      <span className="text-sm font-bold">
        ₹{balance.toFixed(2)}
      </span>
    </div>
  );
}

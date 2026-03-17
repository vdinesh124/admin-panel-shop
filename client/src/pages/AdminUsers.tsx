import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Users, Plus, Minus, IndianRupee } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface UserData {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  createdAt: string;
  walletBalance: number;
  totalPurchases: number;
}

export default function AdminUsers() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [balanceUserId, setBalanceUserId] = useState<string | null>(null);
  const [balanceAmount, setBalanceAmount] = useState("");
  const [balanceType, setBalanceType] = useState<"credit" | "debit">("credit");

  const { data: allUsers, isLoading } = useQuery<UserData[]>({
    queryKey: ["/api/admin/users"],
  });

  const adjustBalance = useMutation({
    mutationFn: async (userId: string) => {
      const res = await apiRequest("POST", `/api/admin/users/${userId}/balance`, {
        amount: Number(balanceAmount),
        type: balanceType,
        description: `Admin ${balanceType}: ₹${balanceAmount}`,
      });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setBalanceUserId(null);
      setBalanceAmount("");
      toast({ title: `Balance ${balanceType === "credit" ? "added" : "deducted"} successfully` });
    },
    onError: () => {
      toast({ title: "Failed to adjust balance", variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-xl font-bold" data-testid="text-admin-users-title">Manage Users</h1>
        <Badge variant="secondary">{allUsers?.length || 0} Users</Badge>
      </div>

      <div className="space-y-2">
        {allUsers?.map((u) => (
          <Card key={u.id} className="p-3 space-y-2" data-testid={`card-admin-user-${u.id}`}>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3 min-w-0">
                <Avatar className="w-8 h-8 flex-shrink-0">
                  <AvatarImage src={u.profileImageUrl || ""} />
                  <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-bold">
                    {u.firstName?.[0] || u.email?.[0] || "U"}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate" data-testid={`text-user-name-${u.id}`}>
                    {u.firstName ? `${u.firstName} ${u.lastName || ""}`.trim() : u.email || u.id}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{u.email || u.id}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0 flex-wrap">
                <div className="text-right">
                  <p className="text-sm font-bold" data-testid={`text-user-balance-${u.id}`}>₹{u.walletBalance.toFixed(2)}</p>
                  <p className="text-[10px] text-muted-foreground">{u.totalPurchases} purchases</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setBalanceUserId(balanceUserId === u.id ? null : u.id)}
                  data-testid={`button-adjust-balance-${u.id}`}
                >
                  <IndianRupee className="w-3 h-3 mr-1" />
                  Adjust
                </Button>
              </div>
            </div>

            {balanceUserId === u.id && (
              <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-border">
                <select
                  className="bg-transparent border border-border rounded-md px-2 py-1 text-sm"
                  value={balanceType}
                  onChange={(e) => setBalanceType(e.target.value as "credit" | "debit")}
                  data-testid="select-balance-type"
                >
                  <option value="credit">Add Balance</option>
                  <option value="debit">Deduct Balance</option>
                </select>
                <Input
                  type="number"
                  placeholder="Amount"
                  value={balanceAmount}
                  onChange={(e) => setBalanceAmount(e.target.value)}
                  className="w-28"
                  data-testid="input-balance-amount"
                />
                <Button
                  size="sm"
                  onClick={() => adjustBalance.mutate(u.id)}
                  disabled={!balanceAmount || Number(balanceAmount) <= 0 || adjustBalance.isPending}
                  data-testid="button-confirm-adjust"
                >
                  {balanceType === "credit" ? <Plus className="w-3 h-3 mr-1" /> : <Minus className="w-3 h-3 mr-1" />}
                  {adjustBalance.isPending ? "..." : "Confirm"}
                </Button>
              </div>
            )}
          </Card>
        ))}
        {(!allUsers || allUsers.length === 0) && (
          <Card className="p-8 text-center space-y-2">
            <Users className="w-8 h-8 mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No users registered yet.</p>
          </Card>
        )}
      </div>
    </div>
  );
}

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Clock, IndianRupee, Zap } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface PaymentSession {
  id: number;
  userId: string;
  amount: string;
  transactionRef: string;
  utr: string | null;
  status: string;
  method: string | null;
  createdAt: string;
  username: string;
}

export default function AdminPayments() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: sessions, isLoading } = useQuery<PaymentSession[]>({
    queryKey: ["/api/admin/payments"],
    refetchInterval: 5000,
  });

  const approveMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/admin/payments/${id}/approve`);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/payments"] });
      toast({ title: "Payment approved and wallet credited" });
    },
    onError: () => {
      toast({ title: "Failed to approve", variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/admin/payments/${id}/reject`);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/payments"] });
      toast({ title: "Payment rejected" });
    },
    onError: () => {
      toast({ title: "Failed to reject", variant: "destructive" });
    },
  });

  const statusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="gap-1 text-yellow-500 border-yellow-500/30"><Clock className="w-3 h-3" />Pending</Badge>;
      case "completed":
        return <Badge variant="outline" className="gap-1 text-green-500 border-green-500/30"><CheckCircle2 className="w-3 h-3" />Completed</Badge>;
      case "failed":
        return <Badge variant="outline" className="gap-1 text-red-500 border-red-500/30"><XCircle className="w-3 h-3" />Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center gap-2">
        <IndianRupee className="w-5 h-5 text-primary" />
        <h1 className="text-lg font-bold" data-testid="text-admin-payments-title">UPI Payments</h1>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}
        </div>
      ) : !sessions?.length ? (
        <Card className="p-8 text-center text-muted-foreground">No payment sessions yet</Card>
      ) : (
        <div className="space-y-3">
          {sessions.map((s) => (
            <Card key={s.id} className="p-4" data-testid={`card-payment-${s.id}`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm" data-testid={`text-payment-user-${s.id}`}>{s.username}</span>
                    {statusBadge(s.status)}
                    {(s.method === "payindia" || s.method === "upigateway") && (
                      <Badge variant="outline" className="gap-1 text-cyan-400 border-cyan-400/30 text-[10px]">
                        <Zap className="w-2.5 h-2.5" />Auto
                      </Badge>
                    )}
                    {s.method === "manual" && (
                      <Badge variant="outline" className="gap-1 text-gray-400 border-gray-400/30 text-[10px]">Manual</Badge>
                    )}
                  </div>
                  <p className="text-lg font-bold" data-testid={`text-payment-amount-${s.id}`}>₹{Number(s.amount).toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">Ref: {s.transactionRef}</p>
                  {s.utr && <p className="text-xs text-cyan-400 font-semibold">UTR: {s.utr}</p>}
                  <p className="text-xs text-muted-foreground">{new Date(s.createdAt).toLocaleString()}</p>
                  {s.status === "pending" && (s.method === "payindia" || s.method === "upigateway") && (
                    <p className="text-[10px] text-cyan-400 mt-1">Auto-verifying with payment gateway...</p>
                  )}
                </div>

                {s.status === "pending" && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="gap-1"
                      onClick={() => approveMutation.mutate(s.id)}
                      disabled={approveMutation.isPending}
                      data-testid={`button-approve-${s.id}`}
                    >
                      <CheckCircle2 className="w-3 h-3" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="gap-1"
                      onClick={() => rejectMutation.mutate(s.id)}
                      disabled={rejectMutation.isPending}
                      data-testid={`button-reject-${s.id}`}
                    >
                      <XCircle className="w-3 h-3" />
                      Reject
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

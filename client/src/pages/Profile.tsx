import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Lock, ShieldAlert } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";

export default function Profile() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  const { data: balanceData } = useQuery<{ balance: number }>({
    queryKey: ["/api/wallet/balance"],
  });

  const changePasswordMutation = useMutation({
    mutationFn: async (data: { currentPassword: string; newPassword: string }) => {
      const res = await apiRequest("POST", "/api/auth/change-password", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Password Updated", description: "Your password has been changed successfully." });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
    },
    onError: (error: Error) => {
      const msg = error.message || "";
      let parsed = "Failed to change password";
      try {
        const jsonPart = msg.substring(msg.indexOf("{"));
        const data = JSON.parse(jsonPart);
        parsed = data.message || parsed;
      } catch {}
      toast({ title: "Error", description: parsed, variant: "destructive" });
    },
  });

  const handleChangePassword = () => {
    if (!currentPassword || !newPassword || !confirmNewPassword) {
      toast({ title: "Error", description: "All password fields are required", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmNewPassword) {
      toast({ title: "Error", description: "New passwords do not match", variant: "destructive" });
      return;
    }
    if (newPassword.length < 6) {
      toast({ title: "Error", description: "New password must be at least 6 characters", variant: "destructive" });
      return;
    }
    changePasswordMutation.mutate({ currentPassword, newPassword });
  };

  const inputStyle = {
    background: "rgba(255, 255, 255, 0.05)",
    border: "1px solid rgba(255, 255, 255, 0.1)",
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.borderColor = "rgba(0, 220, 255, 0.4)";
    e.target.style.boxShadow = "0 0 10px rgba(0, 220, 255, 0.08)";
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.borderColor = "rgba(255, 255, 255, 0.1)";
    e.target.style.boxShadow = "none";
  };

  if (!user) {
    return (
      <div className="p-4 md:p-6 space-y-6 max-w-lg">
        <Skeleton className="h-12 rounded-lg" />
        <Skeleton className="h-64 rounded-lg" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-5" style={{ background: "transparent" }}>
      <div className="flex items-center gap-3 animate-fade-slide-up">
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-md"
          style={{
            background: "linear-gradient(135deg, rgba(0, 220, 255, 0.08), rgba(0, 220, 255, 0.02))",
            border: "1px solid rgba(0, 220, 255, 0.2)",
          }}
        >
          <ShieldAlert className="w-4 h-4 text-cyan-400" />
          <span className="text-sm font-extrabold uppercase tracking-wider text-cyan-400 animate-title-glow" data-testid="text-page-title">
            Profile Settings
          </span>
        </div>
      </div>

      <div
        className="rounded-xl p-5 space-y-4 animate-card-entrance"
        style={{
          background: "linear-gradient(180deg, rgba(15, 20, 40, 0.95) 0%, rgba(10, 15, 30, 0.98) 100%)",
          border: "1.5px solid rgba(0, 220, 255, 0.15)",
          boxShadow: "0 0 20px rgba(0, 220, 255, 0.05)",
        }}
      >
        <h2 className="text-sm font-extrabold uppercase tracking-wider text-white" data-testid="text-security-update">
          &gt;&gt; Security Update
        </h2>

        <div className="space-y-3">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest mb-1.5 block" style={{ color: "rgba(0, 220, 255, 0.6)" }}>
              Current Password
            </label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-lg text-sm text-white placeholder-gray-500 outline-none transition-all duration-300"
              style={inputStyle}
              onFocus={handleFocus}
              onBlur={handleBlur}
              data-testid="input-current-password"
              autoComplete="current-password"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest mb-1.5 block" style={{ color: "rgba(0, 220, 255, 0.6)" }}>
              New Password
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-lg text-sm text-white placeholder-gray-500 outline-none transition-all duration-300"
              style={inputStyle}
              onFocus={handleFocus}
              onBlur={handleBlur}
              data-testid="input-new-password"
              autoComplete="new-password"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest mb-1.5 block" style={{ color: "rgba(0, 220, 255, 0.6)" }}>
              Confirm New Password
            </label>
            <input
              type="password"
              value={confirmNewPassword}
              onChange={(e) => setConfirmNewPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-lg text-sm text-white placeholder-gray-500 outline-none transition-all duration-300"
              style={inputStyle}
              onFocus={handleFocus}
              onBlur={handleBlur}
              data-testid="input-confirm-new-password"
              autoComplete="new-password"
            />
          </div>
        </div>

        <button
          onClick={handleChangePassword}
          disabled={changePasswordMutation.isPending}
          className="w-full py-3 rounded-lg text-sm font-extrabold uppercase tracking-widest text-white flex items-center justify-center gap-2 transition-all duration-300 disabled:opacity-40"
          style={{
            background: "linear-gradient(135deg, rgba(0, 220, 255, 0.85), rgba(0, 180, 220, 0.95))",
            boxShadow: "0 0 20px rgba(0, 220, 255, 0.2)",
          }}
          onMouseEnter={(e) => { (e.target as HTMLElement).style.boxShadow = "0 0 30px rgba(0, 220, 255, 0.4)"; }}
          onMouseLeave={(e) => { (e.target as HTMLElement).style.boxShadow = "0 0 20px rgba(0, 220, 255, 0.2)"; }}
          data-testid="button-update-password"
        >
          <Lock className="w-4 h-4" />
          {changePasswordMutation.isPending ? "Updating..." : "Update Password"}
        </button>
      </div>

      <div
        className="rounded-xl p-5 space-y-4 animate-card-entrance"
        style={{
          background: "linear-gradient(180deg, rgba(15, 20, 40, 0.95) 0%, rgba(10, 15, 30, 0.98) 100%)",
          border: "1.5px solid rgba(0, 220, 255, 0.15)",
          boxShadow: "0 0 20px rgba(0, 220, 255, 0.05)",
          animationDelay: "0.15s",
        }}
      >
        <h2 className="text-sm font-extrabold uppercase tracking-wider text-white" data-testid="text-account-id">
          &gt;&gt; Account Identification
        </h2>

        <div className="space-y-3">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest mb-1.5 block" style={{ color: "rgba(0, 220, 255, 0.6)" }}>
              Username
            </label>
            <div
              className="w-full px-4 py-3 rounded-lg text-sm text-white font-semibold uppercase"
              style={inputStyle}
              data-testid="text-profile-username"
            >
              {user.username || "N/A"}
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest mb-1.5 block" style={{ color: "rgba(0, 220, 255, 0.6)" }}>
              Email Address
            </label>
            <div
              className="w-full px-4 py-3 rounded-lg text-sm text-white"
              style={inputStyle}
              data-testid="text-profile-email"
            >
              {user.email || "Not set"}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-1">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest mb-1.5 block" style={{ color: "rgba(0, 220, 255, 0.6)" }}>
              Account Role
            </label>
            <div
              className="px-4 py-2.5 rounded-lg text-sm font-bold text-center uppercase"
              style={{
                background: "rgba(124, 58, 237, 0.15)",
                border: "1px solid rgba(124, 58, 237, 0.3)",
                color: "rgba(167, 139, 250, 1)",
              }}
              data-testid="text-account-role"
            >
              User
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest mb-1.5 block" style={{ color: "rgba(0, 220, 255, 0.6)" }}>
              Current Balance
            </label>
            <div
              className="px-4 py-2.5 rounded-lg text-sm font-bold text-center"
              style={{
                background: "rgba(0, 220, 255, 0.08)",
                border: "1px solid rgba(0, 220, 255, 0.2)",
                color: "rgb(0, 220, 255)",
              }}
              data-testid="text-current-balance"
            >
              ₹{balanceData?.balance !== undefined ? Number(balanceData.balance).toFixed(2) : "0.00"}
            </div>
          </div>
        </div>

        <div
          className="rounded-lg p-3 mt-2"
          style={{
            background: "rgba(0, 220, 255, 0.04)",
            border: "1px solid rgba(0, 220, 255, 0.1)",
          }}
        >
          <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "rgba(0, 220, 255, 0.5)" }}>
            Security Note:
          </p>
          <p className="text-xs text-gray-400">
            Account details are verified and locked. Contact admin for manual changes.
          </p>
        </div>
      </div>
    </div>
  );
}

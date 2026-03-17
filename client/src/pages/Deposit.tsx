import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Zap, Loader2, CheckCircle, Clock, XCircle, Wallet, Shield, ExternalLink, Phone, Copy, Check, Download, ArrowLeft } from "lucide-react";
import binanceQrImg from "@assets/IMG_20260312_125503_986_1773300356103.jpg";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

declare global {
  interface Window {
    Razorpay: any;
  }
}

type PaymentMethod = "razorpay" | "upigateway" | "payindia" | "manual_qr";

interface AutoPaySession {
  sessionId: number;
  amount: number;
  paymentUrl: string;
  createdAt: string;
}

export default function Deposit() {
  const { user } = useAuth();
  const [amount, setAmount] = useState("");
  const [activeTab, setActiveTab] = useState<"upi" | "crypto">("upi");
  const [paymentSuccess, setPaymentSuccess] = useState<number | null>(null);
  const [paymentFailed, setPaymentFailed] = useState(false);
  const [autoPaySession, setAutoPaySession] = useState<AutoPaySession | null>(null);
  const [manualQrSession, setManualQrSession] = useState<{ id: number; qrUrl: string; amount: number; ref: string; createdAt: string } | null>(null);
  const [timeLeft, setTimeLeft] = useState(300);
  const [utrInput, setUtrInput] = useState("");
  const [utrSubmitted, setUtrSubmitted] = useState(false);
  const [paymentWindowOpened, setPaymentWindowOpened] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [cryptoView, setCryptoView] = useState<"main" | "verify">("main");
  const [cryptoTxnId, setCryptoTxnId] = useState("");
  const [cryptoAmount, setCryptoAmount] = useState("");
  const [cryptoMobile, setCryptoMobile] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: walletData, isLoading } = useQuery<{ balance: number }>({
    queryKey: ["/api/wallet/balance"],
  });

  const { data: rzKeyData } = useQuery<{ keyId: string }>({
    queryKey: ["/api/payments/razorpay-key"],
  });

  const { data: txData } = useQuery<any[]>({
    queryKey: ["/api/wallet/transactions"],
  });

  const todayDeposit = (() => {
    if (!txData) return 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return txData
      .filter((t: any) => t.type === "credit" && new Date(t.createdAt) >= today)
      .reduce((sum: number, t: any) => sum + Number(t.amount), 0);
  })();

  const isRazorpayLive = rzKeyData?.keyId && !rzKeyData.keyId.startsWith("rzp_test_");

  useEffect(() => {
    if (!document.getElementById("razorpay-script") && isRazorpayLive) {
      const script = document.createElement("script");
      script.id = "razorpay-script";
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      document.body.appendChild(script);
    }
  }, [isRazorpayLive]);

  const markComplete = useCallback((amt: number) => {
    setPaymentSuccess(amt);
    setAutoPaySession(null);
    setManualQrSession(null);
    setUtrInput("");
    setUtrSubmitted(false);
    setPaymentFailed(false);
    setPaymentWindowOpened(false);
    if (pollRef.current) clearInterval(pollRef.current);
    qc.invalidateQueries({ queryKey: ["/api/wallet/balance"] });
    qc.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
    qc.invalidateQueries({ queryKey: ["/api/wallet/transactions"] });
  }, [qc]);

  useEffect(() => {
    const activeSession = autoPaySession || manualQrSession;
    if (!activeSession) return;
    const created = new Date(activeSession.createdAt).getTime();
    const expiry = created + 300 * 1000;
    const timer = setInterval(() => {
      const remaining = Math.max(0, Math.floor((expiry - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining <= 0) {
        clearInterval(timer);
        if (pollRef.current) clearInterval(pollRef.current);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [autoPaySession, manualQrSession]);

  useEffect(() => {
    if (!autoPaySession) return;
    const verify = async () => {
      try {
        const res = await fetch("/api/payments/verify-status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: autoPaySession.sessionId }),
          credentials: "include",
        });
        const data = await res.json();
        if (data.success && data.status === "completed") {
          markComplete(autoPaySession.amount);
        } else if (data.status === "failed" || data.status === "expired") {
          setPaymentFailed(true);
          if (pollRef.current) clearInterval(pollRef.current);
        }
      } catch (err) {
        console.error("Payment status check failed:", err);
      }
    };
    const initialDelay = setTimeout(verify, 2000);
    pollRef.current = setInterval(verify, 3000);
    return () => {
      clearTimeout(initialDelay);
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [autoPaySession, markComplete]);

  const payMutation = useMutation({
    mutationFn: async (amt: number) => {
      const res = await apiRequest("POST", "/api/payments/create", { amount: amt });
      return res.json();
    },
    onSuccess: (data: any) => {
      const method: PaymentMethod = data.method || "manual_qr";

      if (method === "razorpay" && data.orderId) {
        if (!window.Razorpay) {
          toast({ title: "Error", description: "Payment system loading. Try again.", variant: "destructive" });
          return;
        }
        const options = {
          key: rzKeyData?.keyId || "",
          amount: Math.round(data.amount * 100),
          currency: data.currency,
          name: "NEXA PANEL",
          description: `Wallet Deposit ₹${data.amount}`,
          order_id: data.orderId,
          handler: async (response: any) => {
            try {
              const verifyRes = await apiRequest("POST", "/api/payments/verify", {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                sessionId: data.sessionId,
              });
              const result = await verifyRes.json();
              if (result.success) markComplete(data.amount);
              else toast({ title: "Verification Failed", variant: "destructive" });
            } catch {
              toast({ title: "Error", description: "Payment verification failed.", variant: "destructive" });
            }
          },
          theme: { color: "#764ba2" },
          modal: { ondismiss: () => toast({ title: "Payment Cancelled", variant: "destructive" }) },
        };
        new window.Razorpay(options).open();
      } else if ((method === "upigateway" || method === "payindia") && data.paymentUrl) {
        setAutoPaySession({
          sessionId: data.sessionId,
          amount: data.amount || Number(amount),
          paymentUrl: data.paymentUrl,
          createdAt: data.createdAt || new Date().toISOString(),
        });
        setTimeLeft(300);
        setPaymentFailed(false);
        setPaymentWindowOpened(false);
        window.open(data.paymentUrl, "_blank", "noopener,noreferrer");
        setPaymentWindowOpened(true);
      } else {
        setManualQrSession({
          id: data.sessionId || data.id,
          qrUrl: data.qrUrl,
          amount: data.amount || Number(amount),
          ref: data.transactionRef || data.orderId || "",
          createdAt: data.createdAt || new Date().toISOString(),
        });
        setTimeLeft(300);
        setUtrInput("");
        setUtrSubmitted(false);
      }
    },
    onError: () => {
      toast({ title: "Error", description: "Could not create payment. Try again.", variant: "destructive" });
    },
  });

  const utrMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/payments/submit-utr", {
        sessionId: manualQrSession!.id,
        utr: utrInput.trim(),
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      if (data.success) {
        setUtrSubmitted(true);
        if (pollRef.current) clearInterval(pollRef.current);
      } else {
        toast({ title: "Error", description: data.message || "Verification failed", variant: "destructive" });
      }
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err?.message || "Could not verify UTR", variant: "destructive" });
    },
  });

  const handlePay = () => {
    const amt = Number(amount);
    if (amt <= 0) {
      toast({ title: "Invalid Amount", description: "Please enter a valid amount.", variant: "destructive" });
      return;
    }
    payMutation.mutate(amt);
  };

  const resetAll = () => {
    setPaymentSuccess(null);
    setPaymentFailed(false);
    setAutoPaySession(null);
    setManualQrSession(null);
    setUtrSubmitted(false);
    setUtrInput("");
    setAmount("");
    setPaymentWindowOpened(false);
    if (pollRef.current) clearInterval(pollRef.current);
  };

  if (paymentSuccess !== null) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center px-6" style={{ background: "#0b0e1a" }}>
        <div className="w-20 h-20 rounded-full flex items-center justify-center mb-5" style={{ background: "rgba(34, 197, 94, 0.12)", border: "2px solid rgba(34, 197, 94, 0.25)" }}>
          <CheckCircle className="w-10 h-10 text-green-400" />
        </div>
        <h1 className="text-xl font-bold text-white mb-2" data-testid="text-payment-success">Payment Successful!</h1>
        <p className="text-gray-500 text-sm mb-2">Your wallet has been credited.</p>
        <p className="text-3xl font-extrabold text-green-400 mb-8" data-testid="text-credited-amount">₹{paymentSuccess.toFixed(2)}</p>
        <button onClick={resetAll} className="px-10 py-3 rounded-lg text-sm font-bold text-white" style={{ background: "#22c55e" }} data-testid="button-continue">
          Continue
        </button>
      </div>
    );
  }

  if (paymentFailed) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center px-6" style={{ background: "#0b0e1a" }}>
        <div className="w-20 h-20 rounded-full flex items-center justify-center mb-5" style={{ background: "rgba(239, 68, 68, 0.12)", border: "2px solid rgba(239, 68, 68, 0.25)" }}>
          <XCircle className="w-10 h-10 text-red-400" />
        </div>
        <h1 className="text-xl font-bold text-white mb-2">Payment Failed</h1>
        <p className="text-gray-500 text-sm mb-6">Payment was not completed. Please try again.</p>
        <button onClick={resetAll} className="px-10 py-3 rounded-lg text-sm font-bold text-white" style={{ background: "#22c55e" }} data-testid="button-retry">
          Try Again
        </button>
      </div>
    );
  }

  if (utrSubmitted && manualQrSession) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center px-6" style={{ background: "#0b0e1a" }}>
        <div className="w-20 h-20 rounded-full flex items-center justify-center mb-5" style={{ background: "rgba(245, 158, 11, 0.12)", border: "2px solid rgba(245, 158, 11, 0.25)" }}>
          <Clock className="w-10 h-10 text-yellow-400" />
        </div>
        <h1 className="text-xl font-bold text-white mb-2" data-testid="text-utr-submitted">UTR Submitted</h1>
        <p className="text-gray-500 text-sm mb-1">Your payment is being verified.</p>
        <p className="text-gray-500 text-xs mb-6">Amount: <span className="text-white font-bold">₹{manualQrSession.amount.toFixed(2)}</span></p>
        <button onClick={resetAll} className="px-10 py-3 rounded-lg text-sm font-bold text-white" style={{ background: "#22c55e" }} data-testid="button-back-to-deposit">
          Back to Deposit
        </button>
      </div>
    );
  }

  if (autoPaySession) {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;

    if (timeLeft <= 0) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center text-center px-6" style={{ background: "#0b0e1a" }}>
          <div className="w-20 h-20 rounded-full flex items-center justify-center mb-5" style={{ background: "rgba(239, 68, 68, 0.12)" }}>
            <Clock className="w-10 h-10 text-red-400" />
          </div>
          <h1 className="text-xl font-bold text-white mb-2">Payment Expired</h1>
          <p className="text-gray-500 text-sm mb-6">Session expired. Please create a new payment.</p>
          <button onClick={resetAll} className="px-10 py-3 rounded-lg text-sm font-bold text-white" style={{ background: "#22c55e" }}>Back to Deposit</button>
        </div>
      );
    }

    return (
      <div className="max-w-md mx-auto px-4 py-6 space-y-4">
        <div className="rounded-xl p-5 text-center" style={{ background: "#1a1f35", border: "1px solid rgba(0,255,200,0.15)" }}>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider mb-3" style={{ background: "rgba(34, 197, 94, 0.1)", color: "#22c55e", border: "1px solid rgba(34, 197, 94, 0.2)" }}>
            <Shield className="w-3 h-3" /> Auto-Verified
          </div>
          <h2 className="text-lg font-bold text-white mb-1" data-testid="text-merchant-name">NEXA PANEL</h2>
          <p className="text-2xl font-extrabold text-green-400 mb-3" data-testid="text-payment-amount">₹{autoPaySession.amount.toFixed(2)}</p>

          <div className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-bold mb-5" style={{ background: "rgba(239, 68, 68, 0.1)", color: "#ef4444", border: "1px solid rgba(239, 68, 68, 0.15)" }}>
            <Clock className="w-3.5 h-3.5" />
            <span data-testid="text-timer">{String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}</span>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2 justify-center text-sm text-gray-400">
              <Loader2 className="w-4 h-4 animate-spin text-green-400" />
              <span>Waiting for payment...</span>
            </div>

            <p className="text-xs text-gray-500">
              {paymentWindowOpened
                ? "Complete the payment in the opened window. Your wallet will be credited automatically."
                : "Click below to open the payment page."}
            </p>

            <a
              href={autoPaySession.paymentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3 rounded-lg text-sm font-bold text-white flex items-center justify-center gap-2"
              style={{ background: "linear-gradient(135deg, #7c3aed, #6d28d9)" }}
              data-testid="link-open-payment"
              onClick={() => setPaymentWindowOpened(true)}
            >
              <ExternalLink className="w-4 h-4" /> {paymentWindowOpened ? "Reopen Payment Page" : "Open Payment Page"}
            </a>

            <button onClick={resetAll} className="text-xs text-gray-500 hover:text-gray-300" data-testid="button-cancel-payment">
              Cancel Payment
            </button>
          </div>
        </div>

        <div className="rounded-xl p-4" style={{ background: "#1a1f35", border: "1px solid rgba(0,255,200,0.1)" }}>
          <p className="text-[11px] text-gray-400 mb-2 font-semibold">How it works:</p>
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0" style={{ background: "rgba(34, 197, 94, 0.15)", color: "#22c55e" }}>1</span>
              <p className="text-xs text-gray-400">Complete payment on the opened page</p>
            </div>
            <div className="flex items-start gap-2">
              <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0" style={{ background: "rgba(34, 197, 94, 0.15)", color: "#22c55e" }}>2</span>
              <p className="text-xs text-gray-400">Payment is verified automatically</p>
            </div>
            <div className="flex items-start gap-2">
              <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0" style={{ background: "rgba(34, 197, 94, 0.15)", color: "#22c55e" }}>3</span>
              <p className="text-xs text-gray-400">Wallet credited instantly — no UTR needed</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (manualQrSession) {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;

    if (timeLeft <= 0) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center text-center px-6" style={{ background: "#0b0e1a" }}>
          <div className="w-20 h-20 rounded-full flex items-center justify-center mb-5" style={{ background: "rgba(239, 68, 68, 0.12)" }}>
            <Clock className="w-10 h-10 text-red-400" />
          </div>
          <h1 className="text-xl font-bold text-white mb-2">Payment Expired</h1>
          <p className="text-gray-500 text-sm mb-6">Session expired. Please try again.</p>
          <button onClick={resetAll} className="px-10 py-3 rounded-lg text-sm font-bold text-white" style={{ background: "#22c55e" }}>Back to Deposit</button>
        </div>
      );
    }

    return (
      <div className="max-w-md mx-auto px-4 py-6">
        <div className="rounded-xl p-5 text-center" style={{ background: "#1a1f35", border: "1px solid rgba(0,255,200,0.15)" }}>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider mb-2" style={{ background: "rgba(34, 197, 94, 0.1)", color: "#22c55e", border: "1px solid rgba(34, 197, 94, 0.2)" }}>
            <Shield className="w-3 h-3" /> Verified Merchant
          </span>
          <p className="text-lg font-bold text-white mb-1">NEXA PANEL</p>

          <div className="rounded-lg p-2 mx-auto mb-3" style={{ background: "#0b0e1a", border: "1px solid rgba(0,255,200,0.1)" }}>
            <div className="text-2xl font-extrabold text-green-400">₹{manualQrSession.amount.toFixed(2)}</div>
            <div className="text-[10px] text-gray-500 font-semibold mt-0.5">ORDER: {manualQrSession.ref}</div>
          </div>

          <div className="mx-auto mb-3 inline-block" style={{ background: "#fff", padding: 8, borderRadius: 12 }}>
            <img src={manualQrSession.qrUrl} alt="UPI QR Code" style={{ width: 180, height: 180, display: "block" }} data-testid="img-upi-qr" />
          </div>

          <div className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full font-bold text-sm mb-3" style={{ background: "rgba(239, 68, 68, 0.1)", color: "#ef4444", border: "1px solid rgba(239, 68, 68, 0.15)" }}>
            <Clock className="w-3.5 h-3.5" />
            <span data-testid="text-timer">{String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}</span>
          </div>

          <div className="mt-3 space-y-2">
            <p className="text-xs font-semibold text-gray-300">Enter UTR after payment:</p>
            <input
              type="text"
              placeholder="Enter UTR / Transaction ID"
              value={utrInput}
              onChange={(e) => setUtrInput(e.target.value.replace(/\s/g, ""))}
              className="w-full px-4 py-2.5 rounded-lg text-sm font-semibold text-center text-white outline-none"
              style={{ background: "#0b0e1a", border: "1px solid rgba(0,255,200,0.15)" }}
              data-testid="input-utr"
            />
            <button
              onClick={() => utrMutation.mutate()}
              disabled={!utrInput.trim() || utrInput.trim().length < 10 || utrMutation.isPending}
              className="w-full py-2.5 rounded-lg text-sm font-bold text-white disabled:opacity-40 flex items-center justify-center gap-2"
              style={{ background: "linear-gradient(135deg, #7c3aed, #6d28d9)" }}
              data-testid="button-submit-utr"
            >
              {utrMutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Verifying...</> : <><CheckCircle className="w-4 h-4" /> Submit UTR</>}
            </button>
            <p className="text-[10px] text-gray-500">Find UTR in your UPI app payment history</p>
          </div>

          <button onClick={resetAll} className="mt-3 text-xs text-gray-500 hover:text-gray-300" data-testid="button-cancel-payment">Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 py-4 space-y-4">
      <div className="rounded-2xl py-5 px-4 text-center" style={{ background: "#0d1424", border: "2px solid #00e5bf", boxShadow: "0 0 15px rgba(0,229,191,0.25), 0 0 30px rgba(0,229,191,0.1), 0 0 60px rgba(0,229,191,0.05)" }}>
        <p className="text-[11px] font-bold uppercase tracking-[3px] mb-1.5" style={{ color: "#8b9dc3" }}>Current Balance</p>
        {isLoading ? (
          <div className="h-8 w-28 mx-auto rounded animate-pulse" style={{ background: "rgba(255,255,255,0.05)" }} />
        ) : (
          <p className="text-[28px] font-extrabold text-white" data-testid="text-deposit-balance">₹{(walletData?.balance ?? 0).toFixed(2)}</p>
        )}
      </div>

      <div className="rounded-2xl py-4 px-4 text-center" style={{ background: "#0d1424", border: "2px solid #00e5bf", boxShadow: "0 0 15px rgba(0,229,191,0.25), 0 0 30px rgba(0,229,191,0.1), 0 0 60px rgba(0,229,191,0.05)" }}>
        <p className="text-[11px] font-bold uppercase tracking-[3px] mb-1.5" style={{ color: "#8b9dc3" }}>Today Deposit</p>
        <p className="text-[24px] font-extrabold text-white" data-testid="text-today-deposit">₹{todayDeposit.toFixed(2)}</p>
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => { setActiveTab("upi"); setCryptoView("main"); }}
          className="flex-1 py-3.5 rounded-xl text-[13px] font-bold uppercase tracking-wider flex items-center justify-center transition-all"
          style={{
            background: activeTab === "upi" ? "#16a34a" : "#0d1424",
            color: activeTab === "upi" ? "#fff" : "#8b9dc3",
            border: activeTab === "upi" ? "none" : "1px solid rgba(255,255,255,0.06)",
          }}
          data-testid="tab-instant-upi"
        >
          INSTANT UPI
        </button>
        <button
          onClick={() => setActiveTab("crypto")}
          className="flex-1 py-3.5 rounded-xl text-[13px] font-bold uppercase tracking-wider flex items-center justify-center transition-all"
          style={{
            background: activeTab === "crypto" ? "#7c3aed" : "#0d1424",
            color: activeTab === "crypto" ? "#fff" : "#8b9dc3",
            border: activeTab === "crypto" ? "none" : "1px solid rgba(255,255,255,0.06)",
          }}
          data-testid="tab-binance"
        >
          BINANCE / USDT
        </button>
      </div>

      {activeTab === "upi" ? (
        <div className="rounded-2xl p-6 space-y-6" style={{ background: "#0d1424", border: "2px solid #166534", boxShadow: "0 0 15px rgba(22,101,52,0.12)" }}>
          <div className="text-center space-y-3 pb-1">
            <div className="relative w-16 h-16 mx-auto">
              <div className="absolute inset-0 rounded-2xl" style={{ background: "rgba(139,92,246,0.08)", border: "1.5px solid rgba(139,92,246,0.2)" }} />
              <div className="absolute inset-2 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #5b21b6, #7c3aed)", boxShadow: "0 4px 15px rgba(124,58,237,0.4)" }}>
                <Zap className="w-6 h-6 text-white" />
              </div>
            </div>
            <h2 className="text-[22px] font-extrabold text-white">Instant Deposit</h2>
            <p className="text-[13px] leading-5" style={{ color: "#7d8fb3" }}>Add funds instantly with zero manual<br />approval!</p>
          </div>

          <div>
            <label className="text-[12px] uppercase tracking-wider font-semibold mb-2.5 block" style={{ color: "#7d8fb3" }}>Amount (₹)</label>
            <div className="flex items-center rounded-xl" style={{ background: "#080d1a", border: "1px solid rgba(255,255,255,0.05)" }}>
              <div className="w-14 flex items-center justify-center py-3.5">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.2)" }}>
                  <span style={{ color: "#a78bfa", fontWeight: 700, fontSize: "15px" }}>₹</span>
                </div>
              </div>
              <input
                type="number"
                placeholder="Enter amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min="1"
                max="50000"
                className="flex-1 px-1 py-3.5 bg-transparent text-[14px] text-white outline-none"
                style={{ caretColor: "#a78bfa" }}
                data-testid="input-deposit-amount"
              />
            </div>
          </div>

          <div>
            <label className="text-[12px] uppercase tracking-wider font-semibold mb-2.5 block" style={{ color: "#7d8fb3" }}>Mobile Number</label>
            <div className="flex items-center rounded-xl" style={{ background: "#080d1a", border: "1px solid rgba(255,255,255,0.05)" }}>
              <div className="w-14 flex items-center justify-center py-3.5">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "rgba(0,221,179,0.08)", border: "1px solid rgba(0,221,179,0.18)" }}>
                  <Phone className="w-4 h-4" style={{ color: "#00ddb3" }} />
                </div>
              </div>
              <input
                type="tel"
                placeholder="e.g., 9918595291"
                className="flex-1 px-1 py-3.5 bg-transparent text-[14px] text-white outline-none"
                style={{ caretColor: "#00ddb3" }}
                maxLength={10}
                data-testid="input-mobile-number"
              />
            </div>
          </div>

          <button
            className="w-full py-4 rounded-2xl text-[15px] font-bold uppercase tracking-wider text-white disabled:opacity-40 flex items-center justify-center gap-2.5 transition-all"
            style={{
              background: (!amount || Number(amount) <= 0 || payMutation.isPending) ? "#1e293b" : "#8b5cf6",
              boxShadow: (!amount || Number(amount) <= 0 || payMutation.isPending) ? "none" : "0 4px 25px rgba(139, 92, 246, 0.4)",
            }}
            disabled={!amount || Number(amount) <= 0 || payMutation.isPending}
            onClick={handlePay}
            data-testid="button-pay-instantly"
          >
            {payMutation.isPending ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> Processing...</>
            ) : (
              <><Zap className="w-5 h-5" /> PAY INSTANTLY</>
            )}
          </button>
        </div>
      ) : (
        <>
          {cryptoView === "main" ? (
            <div className="rounded-2xl p-6 space-y-5" style={{ background: "#0d1424", border: "2px solid rgba(245,158,11,0.5)", boxShadow: "0 0 15px rgba(245,158,11,0.08)" }}>
              <h2 className="text-[22px] font-extrabold text-white text-center tracking-wide">INSTANT USDT PAY</h2>

              <div className="flex justify-center">
                <div className="rounded-xl overflow-hidden bg-white p-3" style={{ width: "220px" }}>
                  <p className="text-[11px] text-center text-gray-500 mb-2">Scan with Binance App to pay</p>
                  <img src={binanceQrImg} alt="Binance Pay QR" className="w-full object-contain" data-testid="img-binance-qr" />
                </div>
              </div>

              <div className="flex justify-center">
                <button
                  onClick={() => {
                    const link = document.createElement("a");
                    link.href = binanceQrImg;
                    link.download = "binance-pay-qr.jpg";
                    link.click();
                  }}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-[13px] font-semibold text-white transition-all"
                  style={{ background: "#1a2332", border: "1px solid rgba(255,255,255,0.1)" }}
                  data-testid="button-download-qr"
                >
                  <Download className="w-4 h-4" />
                  DOWNLOAD QR
                </button>
              </div>

              <div className="rounded-xl px-4 py-3.5" style={{ background: "#080d1a", border: "1.5px solid rgba(245,158,11,0.3)" }}>
                <p className="text-[11px] uppercase tracking-[2px] font-bold mb-1" style={{ color: "#8b9dc3" }}>Binance Pay ID</p>
                <div className="flex items-center justify-between">
                  <p className="text-[15px] font-bold text-white font-mono" data-testid="text-binance-pay-id">1152285958</p>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText("1152285958");
                      setCopiedField("binance");
                      setTimeout(() => setCopiedField(null), 2000);
                    }}
                    className="w-8 h-8 rounded-lg flex items-center justify-center transition-all"
                    style={{ background: copiedField === "binance" ? "rgba(16,185,129,0.15)" : "rgba(255,255,255,0.05)" }}
                    data-testid="button-copy-binance-id"
                  >
                    {copiedField === "binance" ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" style={{ color: "#7d8fb3" }} />}
                  </button>
                </div>
              </div>

              <div className="rounded-xl px-4 py-3.5" style={{ background: "#080d1a", border: "1.5px solid rgba(245,158,11,0.3)" }}>
                <p className="text-[11px] uppercase tracking-[2px] font-bold mb-1" style={{ color: "#8b9dc3" }}>USDT Address (Tron TRC20)</p>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[13px] font-semibold text-white font-mono break-all leading-5" data-testid="text-usdt-address">TN7z6W7ey8JW7r9gVbizmmhTaiZzGmEjYL</p>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText("TN7z6W7ey8JW7r9gVbizmmhTaiZzGmEjYL");
                      setCopiedField("usdt");
                      setTimeout(() => setCopiedField(null), 2000);
                    }}
                    className="w-8 h-8 rounded-lg flex items-center justify-center transition-all flex-shrink-0"
                    style={{ background: copiedField === "usdt" ? "rgba(16,185,129,0.15)" : "rgba(255,255,255,0.05)" }}
                    data-testid="button-copy-usdt-address"
                  >
                    {copiedField === "usdt" ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" style={{ color: "#7d8fb3" }} />}
                  </button>
                </div>
              </div>

              <button
                onClick={() => setCryptoView("verify")}
                className="w-full py-4 rounded-2xl text-[15px] font-bold uppercase tracking-wider text-white flex items-center justify-center gap-2 transition-all"
                style={{ background: "#f59e0b", boxShadow: "0 4px 20px rgba(245,158,11,0.3)" }}
                data-testid="button-i-have-paid"
              >
                I HAVE PAID
              </button>
            </div>
          ) : (
            <div className="rounded-2xl p-6 space-y-5" style={{ background: "#0d1424", border: "2px solid rgba(245,158,11,0.5)", boxShadow: "0 0 15px rgba(245,158,11,0.08)" }}>
              <h2 className="text-[22px] font-extrabold text-white text-center tracking-wide">VERIFY PAYMENT</h2>

              <div>
                <label className="text-[12px] uppercase tracking-wider font-semibold mb-2 block" style={{ color: "#7d8fb3" }}>Panel Name / Username</label>
                <div className="rounded-xl px-4 py-3.5" style={{ background: "#080d1a", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <p className="text-[14px] font-bold text-white uppercase" data-testid="text-crypto-username">{user?.username || user?.firstName || "USER"}</p>
                </div>
              </div>

              <div>
                <label className="text-[12px] uppercase tracking-wider font-semibold mb-2 block" style={{ color: "#7d8fb3" }}>Transaction ID (Min 9 Chars)</label>
                <input
                  type="text"
                  placeholder="Order ID / Transaction ID"
                  value={cryptoTxnId}
                  onChange={(e) => setCryptoTxnId(e.target.value)}
                  className="w-full rounded-xl px-4 py-3.5 bg-transparent text-[14px] text-white outline-none"
                  style={{ background: "#080d1a", border: "1px solid rgba(255,255,255,0.08)", caretColor: "#f59e0b" }}
                  data-testid="input-crypto-txn-id"
                />
              </div>

              <div>
                <label className="text-[12px] uppercase tracking-wider font-semibold mb-2 block" style={{ color: "#7d8fb3" }}>Amount Paid</label>
                <input
                  type="number"
                  placeholder="Enter Amount Paid"
                  value={cryptoAmount}
                  onChange={(e) => setCryptoAmount(e.target.value)}
                  className="w-full rounded-xl px-4 py-3.5 bg-transparent text-[14px] text-white outline-none"
                  style={{ background: "#080d1a", border: "1px solid rgba(255,255,255,0.08)", caretColor: "#f59e0b" }}
                  data-testid="input-crypto-amount"
                />
              </div>

              <div>
                <label className="text-[12px] uppercase tracking-wider font-semibold mb-2 block" style={{ color: "#7d8fb3" }}>Your Contact Number</label>
                <input
                  type="tel"
                  placeholder="Your Mobile Number"
                  value={cryptoMobile}
                  onChange={(e) => setCryptoMobile(e.target.value)}
                  maxLength={10}
                  className="w-full rounded-xl px-4 py-3.5 bg-transparent text-[14px] text-white outline-none"
                  style={{ background: "#080d1a", border: "1px solid rgba(255,255,255,0.08)", caretColor: "#f59e0b" }}
                  data-testid="input-crypto-mobile"
                />
              </div>

              <button
                onClick={() => {
                  if (!cryptoTxnId || cryptoTxnId.length < 9) {
                    toast({ title: "Invalid Transaction ID", description: "Transaction ID must be at least 9 characters", variant: "destructive" });
                    return;
                  }
                  if (!cryptoAmount || Number(cryptoAmount) <= 0) {
                    toast({ title: "Invalid Amount", description: "Please enter a valid amount", variant: "destructive" });
                    return;
                  }
                  const panelName = user?.username || user?.firstName || "USER";
                  const msg = `🚀 *NEW DEPOSIT REQUEST*\n----------------------\n👤 *Panel:* ${panelName.toUpperCase()}\n📌 *TXID:* ${cryptoTxnId}\n💰 *Amount:* ${cryptoAmount}\n📱 *Mobile:* ${cryptoMobile || "N/A"}\n----------------------\n_Please verify my payment!_`;
                  const tgUrl = `https://t.me/NEXAPANELS?text=${encodeURIComponent(msg)}`;
                  window.open(tgUrl, "_blank");
                  toast({ title: "Payment Submitted", description: "Your details have been sent to admin on Telegram." });
                  setCryptoView("main");
                  setCryptoTxnId("");
                  setCryptoAmount("");
                  setCryptoMobile("");
                }}
                disabled={!cryptoTxnId || cryptoTxnId.length < 9 || !cryptoAmount}
                className="w-full py-4 rounded-2xl text-[15px] font-bold uppercase tracking-wider text-white disabled:opacity-40 flex items-center justify-center transition-all"
                style={{
                  background: (!cryptoTxnId || cryptoTxnId.length < 9 || !cryptoAmount) ? "#1e293b" : "#f59e0b",
                  boxShadow: (!cryptoTxnId || cryptoTxnId.length < 9 || !cryptoAmount) ? "none" : "0 4px 20px rgba(245,158,11,0.3)",
                }}
                data-testid="button-submit-crypto"
              >
                SUBMIT DETAILS
              </button>

              <button
                onClick={() => setCryptoView("main")}
                className="w-full text-center text-[14px] font-semibold py-2 transition-all"
                style={{ color: "#7d8fb3" }}
                data-testid="button-go-back-crypto"
              >
                Go Back
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

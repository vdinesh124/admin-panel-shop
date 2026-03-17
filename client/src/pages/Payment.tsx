import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

const PAYMENT_TIMEOUT_SECONDS = 5 * 60;
const POLL_INTERVAL_MS = 2000;

export default function Payment({ params }: { params: { id: string } }) {
  const sessionId = Number(params.id);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [timeLeft, setTimeLeft] = useState(PAYMENT_TIMEOUT_SECONDS);
  const [paymentComplete, setPaymentComplete] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const searchParams = new URLSearchParams(window.location.search);
  const qrFromUrl = searchParams.get("qr") || "";

  const { data: session, isLoading: sessionLoading } = useQuery<{
    id: number;
    amount: string;
    transactionRef: string;
    status: string;
    createdAt: string;
  }>({
    queryKey: ["/api/payments", sessionId],
    enabled: !!sessionId && !paymentComplete,
  });

  const { data: upiInfo } = useQuery<{ upiId: string; merchantName: string }>({
    queryKey: ["/api/payments/upi-info"],
  });

  const markComplete = useCallback(() => {
    setPaymentComplete(true);
    if (pollRef.current) clearInterval(pollRef.current);
    qc.invalidateQueries({ queryKey: ["/api/wallet/balance"] });
    qc.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
    qc.invalidateQueries({ queryKey: ["/api/wallet/transactions"] });
  }, [qc]);

  useEffect(() => {
    if (session?.status === "completed" && !paymentComplete) {
      markComplete();
    }
  }, [session?.status, paymentComplete, markComplete]);

  useEffect(() => {
    if (!sessionId || paymentComplete) return;

    const verifyPayment = async () => {
      try {
        const res = await fetch("/api/payments/verify-status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
          credentials: "include",
        });
        const data = await res.json();
        if (data.success && data.status === "completed") {
          markComplete();
        } else if (data.status === "failed") {
          if (pollRef.current) clearInterval(pollRef.current);
        }
      } catch {}
    };

    const initialDelay = setTimeout(verifyPayment, 1500);
    pollRef.current = setInterval(verifyPayment, POLL_INTERVAL_MS);
    return () => {
      clearTimeout(initialDelay);
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [sessionId, paymentComplete, markComplete]);

  useEffect(() => {
    if (!session?.createdAt) return;
    const created = new Date(session.createdAt).getTime();
    const expiry = created + PAYMENT_TIMEOUT_SECONDS * 1000;
    const interval = setInterval(() => {
      const now = Date.now();
      const remaining = Math.max(0, Math.floor((expiry - now) / 1000));
      setTimeLeft(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
        if (pollRef.current) clearInterval(pollRef.current);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [session?.createdAt]);

  const amount = Number(session?.amount || 0);
  const upiId = upiInfo?.upiId || "";
  const merchantName = upiInfo?.merchantName || "NEXA PANEL";
  const transactionRef = session?.transactionRef || "";

  const upiPayString = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(merchantName)}&am=${amount}&tr=${encodeURIComponent(transactionRef)}&tn=${encodeURIComponent(`Deposit ${transactionRef}`)}&cu=INR`;
  const qrUrl = qrFromUrl || `https://api.qrserver.com/v1/create-qr-code/?size=350x350&data=${encodeURIComponent(upiPayString)}`;

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  const handleDownloadQR = useCallback(async () => {
    try {
      const response = await fetch(qrUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Pay_QR_${transactionRef}.png`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast({ title: "QR Code Saved" });
    } catch {
      window.open(qrUrl, "_blank");
    }
  }, [qrUrl, transactionRef, toast]);

  if (paymentComplete) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center text-center px-6" style={{ background: "linear-gradient(135deg, #0f0c29, #302b63, #24243e)" }}>
        <div className="w-24 h-24 rounded-full flex items-center justify-center mb-5" style={{ background: "rgba(0, 184, 148, 0.15)" }}>
          <svg className="w-14 h-14" viewBox="0 0 24 24" fill="none" stroke="#00b894" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        </div>
        <h1 className="text-2xl font-extrabold text-white mb-2" data-testid="text-payment-success">Payment Received!</h1>
        <p className="text-gray-400 text-sm mb-2">Your wallet has been credited automatically.</p>
        <p className="text-4xl font-black text-purple-400 mb-6">₹{amount.toFixed(2)}</p>
        <button onClick={() => navigate("/deposit")} className="w-4/5 max-w-xs py-4 rounded-full text-lg font-bold text-white" style={{ background: "linear-gradient(to right, #667eea, #764ba2)" }} data-testid="button-continue">Continue</button>
      </div>
    );
  }

  if (session?.status === "failed") {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center text-center px-6" style={{ background: "linear-gradient(135deg, #0f0c29, #302b63, #24243e)" }}>
        <div className="w-24 h-24 rounded-full flex items-center justify-center mb-5" style={{ background: "rgba(255, 82, 82, 0.15)" }}>
          <svg className="w-14 h-14" viewBox="0 0 24 24" fill="none" stroke="#ff5252" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        </div>
        <h1 className="text-2xl font-extrabold text-white mb-2" data-testid="text-payment-failed">Payment Failed</h1>
        <p className="text-gray-400 text-sm mb-6">Payment was rejected. Please try again.</p>
        <button onClick={() => navigate("/deposit")} className="w-4/5 max-w-xs py-4 rounded-full text-lg font-bold text-white" style={{ background: "linear-gradient(to right, #667eea, #764ba2)" }} data-testid="button-retry-deposit">Try Again</button>
      </div>
    );
  }

  if (session?.status === "expired" || (session?.status === "pending" && timeLeft <= 0)) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center text-center px-6" style={{ background: "linear-gradient(135deg, #0f0c29, #302b63, #24243e)" }}>
        <div className="w-24 h-24 rounded-full flex items-center justify-center mb-5" style={{ background: "rgba(255, 82, 82, 0.15)" }}>
          <svg className="w-14 h-14" viewBox="0 0 24 24" fill="none" stroke="#ff5252" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
          </svg>
        </div>
        <h1 className="text-2xl font-extrabold text-white mb-2">Payment Expired</h1>
        <p className="text-gray-400 text-sm mb-6">This session has expired. Please create a new one.</p>
        <button onClick={() => navigate("/deposit")} className="w-4/5 max-w-xs py-4 rounded-full text-lg font-bold text-white" style={{ background: "linear-gradient(to right, #667eea, #764ba2)" }}>Back to Deposit</button>
      </div>
    );
  }

  if (sessionLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: "linear-gradient(135deg, #0f0c29, #302b63, #24243e)" }}>
        <Skeleton className="h-[500px] w-[360px] rounded-[35px]" style={{ background: "rgba(255,255,255,0.05)" }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-start justify-center py-6 px-4" style={{ background: "linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)" }}>
      <div className="w-full max-w-[420px]">
        <div className="rounded-[35px] p-6 text-center" style={{ background: "rgba(255, 255, 255, 0.96)", boxShadow: "0 25px 50px rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.2)" }}>
          <div className="mb-5">
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold" style={{ background: "#f3f0ff", color: "#764ba2", border: "1px solid rgba(118,75,162,0.1)" }}>
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              Verified Merchant
            </span>
            <span className="block mt-3 text-xl font-extrabold text-gray-900" data-testid="text-merchant-name">{merchantName}</span>
          </div>

          <div className="rounded-2xl p-4 mx-auto mb-4" style={{ background: "#f8fafc", border: "1px solid #edf2f7" }}>
            <div className="text-4xl font-black" style={{ color: "#764ba2", letterSpacing: "-1px" }} data-testid="text-payment-amount">₹{amount.toFixed(2)}</div>
            <div className="text-[11px] text-gray-500 font-semibold mt-1">ORDER ID: {transactionRef}</div>
          </div>

          <div className="relative mx-auto mb-4" style={{ width: 260, height: 260, background: "#ffffff", padding: 15, borderRadius: 30, boxShadow: "0 10px 30px rgba(0,0,0,0.1)", border: "2px solid #f1f5f9", overflow: "hidden" }}>
            <div className="absolute top-0 left-0 w-[45px] h-[45px] border-t-[5px] border-l-[5px] rounded-tl-[25px]" style={{ borderColor: "#764ba2" }} />
            <div className="absolute top-0 right-0 w-[45px] h-[45px] border-t-[5px] border-r-[5px] rounded-tr-[25px]" style={{ borderColor: "#764ba2" }} />
            <div className="absolute bottom-0 left-0 w-[45px] h-[45px] border-b-[5px] border-l-[5px] rounded-bl-[25px]" style={{ borderColor: "#764ba2" }} />
            <div className="absolute bottom-0 right-0 w-[45px] h-[45px] border-b-[5px] border-r-[5px] rounded-br-[25px]" style={{ borderColor: "#764ba2" }} />
            <div className="absolute left-[15px] w-[calc(100%-30px)] h-[4px] rounded-lg z-10" style={{ background: "linear-gradient(to right, transparent, #667eea, transparent)", boxShadow: "0 0 15px #667eea", animation: "scanMove 3s infinite" }} />
            <img src={qrUrl} alt="UPI QR Code" className="w-full h-full rounded-[15px] relative z-[5]" style={{ pointerEvents: "none" }} data-testid="img-upi-qr" />
          </div>

          <button onClick={handleDownloadQR} className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-sm transition-all duration-300" style={{ background: "#ffffff", color: "#764ba2", border: "2px solid #764ba2" }} data-testid="button-download-qr">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Download QR Code
          </button>

          <div className="inline-flex items-center gap-2 mt-5 px-6 py-3 rounded-full font-extrabold text-sm" style={{ background: "#fff5f5", color: "#ff5252", border: "1px solid #fed7d7" }}>
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
            </svg>
            <span data-testid="text-timer">{String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}</span>
          </div>

          <div className="flex items-center justify-center gap-2 mt-4 p-3 rounded-2xl" style={{ background: "#f0fff4", border: "1px solid #c6f6d5" }}>
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#00b894", animation: "blink 1s infinite" }} />
            <span className="text-[13px] font-bold" style={{ color: "#2f855a" }} data-testid="text-waiting">Auto-verifying payment...</span>
          </div>

          <p className="text-[10px] text-gray-400 mt-4">Please do not close this window after payment.</p>
        </div>
      </div>

      <style>{`
        @keyframes scanMove { 0%, 100% { top: 15px; } 50% { top: 240px; } }
        @keyframes blink { 0%, 100% { opacity: 0.4; } 50% { opacity: 1; } }
      `}</style>
    </div>
  );
}

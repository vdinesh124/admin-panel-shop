import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Copy, CheckCircle2, Users, Share2, Gift, Coins } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { queryClient, apiRequest } from "@/lib/queryClient";

interface ReferralInfo {
  referralCode: string;
  totalReferred: number;
  totalEarned: number;
  coins: number;
  referrals: any[];
}

const SEGMENTS = [
  { value: 100, color: "#6366f1" },
  { value: 5, color: "#1e1e3a" },
  { value: 20, color: "#6366f1" },
  { value: 1, color: "#1e1e3a" },
];

function SpinWheel({ coins, onSpinComplete }: { coins: number; onSpinComplete: (prize: number, newCoins: number) => void }) {
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [result, setResult] = useState<number | null>(null);
  const { toast } = useToast();
  const wheelRef = useRef<SVGSVGElement>(null);

  const spinMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/coins/spin");
      return res.json();
    },
    onSuccess: (data: { prize: number; newCoins: number }) => {
      const prizeIndex = SEGMENTS.findIndex(s => s.value === data.prize);
      const segmentAngle = 360 / SEGMENTS.length;
      const targetSegmentCenter = prizeIndex * segmentAngle + segmentAngle / 2;
      const spins = 5 + Math.floor(Math.random() * 3);
      const finalRotation = spins * 360 + (360 - targetSegmentCenter);
      setRotation(prev => prev + finalRotation);

      setTimeout(() => {
        setSpinning(false);
        setResult(data.prize);
        onSpinComplete(data.prize, data.newCoins);
        toast({
          title: `You won ₹${data.prize}!`,
          description: "Balance has been added to your wallet.",
        });
        queryClient.invalidateQueries({ queryKey: ["/api/referrals"] });
        queryClient.invalidateQueries({ queryKey: ["/api/wallet/balance"] });
        queryClient.invalidateQueries({ queryKey: ["/api/wallet/transactions"] });
      }, 4000);
    },
    onError: (err: any) => {
      setSpinning(false);
      toast({
        title: "Cannot Spin",
        description: err.message || "Not enough coins.",
        variant: "destructive",
      });
    },
  });

  const handleSpin = useCallback(() => {
    if (spinning) return;
    if (coins < 25) {
      toast({
        title: "Not Enough Coins",
        description: "You need 25 coins to spin. Refer friends to earn coins!",
        variant: "destructive",
      });
      return;
    }
    setSpinning(true);
    setResult(null);
    spinMutation.mutate();
  }, [spinning, coins]);

  const size = 280;
  const center = size / 2;
  const radius = size / 2 - 10;

  return (
    <div
      className="rounded-xl p-5 space-y-4 animate-card-entrance"
      style={{
        background: "linear-gradient(180deg, rgba(0, 220, 255, 0.04), rgba(0, 0, 0, 0.3))",
        border: "2px dashed rgba(0, 220, 255, 0.25)",
        animationDelay: "0.15s",
      }}
      data-testid="card-lucky-spin"
    >
      <div className="flex items-center gap-2">
        <span className="text-cyan-400 font-extrabold text-sm uppercase tracking-widest">
          {">> "}User Rewards / Lucky Spin
        </span>
      </div>

      <div className="flex flex-col items-center">
        <div className="relative" style={{ width: size, height: size + 20 }}>
          <div
            className="absolute left-1/2 -translate-x-1/2 z-10"
            style={{ top: -2 }}
          >
            <div
              style={{
                width: 0,
                height: 0,
                borderLeft: "12px solid transparent",
                borderRight: "12px solid transparent",
                borderTop: "20px solid #ef4444",
                filter: "drop-shadow(0 2px 4px rgba(239, 68, 68, 0.5))",
              }}
            />
          </div>

          <svg
            ref={wheelRef}
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
            style={{
              transform: `rotate(${rotation}deg)`,
              transition: spinning ? "transform 4s cubic-bezier(0.17, 0.67, 0.12, 0.99)" : "none",
              marginTop: 16,
            }}
          >
            <circle cx={center} cy={center} r={radius} fill="none" stroke="rgba(99, 102, 241, 0.6)" strokeWidth="3" />

            {SEGMENTS.map((seg, i) => {
              const angle = 360 / SEGMENTS.length;
              const startAngle = (i * angle - 90) * (Math.PI / 180);
              const endAngle = ((i + 1) * angle - 90) * (Math.PI / 180);
              const x1 = center + radius * Math.cos(startAngle);
              const y1 = center + radius * Math.sin(startAngle);
              const x2 = center + radius * Math.cos(endAngle);
              const y2 = center + radius * Math.sin(endAngle);
              const largeArc = angle > 180 ? 1 : 0;
              const midAngle = ((i * angle + angle / 2) - 90) * (Math.PI / 180);
              const textR = radius * 0.6;
              const textX = center + textR * Math.cos(midAngle);
              const textY = center + textR * Math.sin(midAngle);
              const textRotation = i * angle + angle / 2;

              return (
                <g key={i}>
                  <path
                    d={`M ${center} ${center} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`}
                    fill={seg.color}
                    stroke="rgba(99, 102, 241, 0.4)"
                    strokeWidth="1.5"
                  />
                  <text
                    x={textX}
                    y={textY}
                    fill={seg.color === "#1e1e3a" ? "rgba(255,255,255,0.7)" : "#fff"}
                    fontSize="22"
                    fontWeight="bold"
                    textAnchor="middle"
                    dominantBaseline="central"
                    transform={`rotate(${textRotation}, ${textX}, ${textY})`}
                  >
                    {seg.value}
                  </text>
                  <line
                    x1={center}
                    y1={center}
                    x2={x1}
                    y2={y1}
                    stroke="rgba(99, 102, 241, 0.4)"
                    strokeWidth="1.5"
                  />
                </g>
              );
            })}

            <circle cx={center} cy={center} r="8" fill="rgba(99, 102, 241, 0.8)" />
          </svg>
        </div>

        <p className="text-sm text-gray-400 mt-2 text-center">
          COST: <span className="text-white font-bold">25 coins</span> | WIN UP TO <span className="text-white font-bold">₹100</span>
        </p>

        {result !== null && (
          <div
            className="mt-2 px-4 py-2 rounded-lg text-center"
            style={{
              background: "rgba(16, 185, 129, 0.15)",
              border: "1px solid rgba(16, 185, 129, 0.3)",
            }}
          >
            <span className="text-emerald-400 font-bold text-lg">🎉 You won ₹{result}!</span>
          </div>
        )}

        <button
          onClick={handleSpin}
          disabled={spinning || coins < 25}
          className="w-full mt-3 py-3 rounded-xl text-sm font-extrabold uppercase tracking-widest transition-all duration-300 disabled:opacity-50"
          style={{
            background: spinning
              ? "rgba(128, 128, 128, 0.3)"
              : "linear-gradient(135deg, #a855f7, #6366f1, #ec4899)",
            color: "#fff",
            boxShadow: spinning ? "none" : "0 0 20px rgba(168, 85, 247, 0.3)",
          }}
          data-testid="button-spin"
        >
          {spinning ? "SPINNING..." : "SPIN NOW"}
        </button>
      </div>
    </div>
  );
}

export default function Referrals() {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const { data, isLoading } = useQuery<ReferralInfo>({
    queryKey: ["/api/referrals"],
  });

  const referralLink = data ? `${window.location.origin}/register?ref=${data.referralCode}` : "";

  const copyCode = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    toast({ title: "Copied!", description: "Referral link copied to clipboard." });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSpinComplete = (_prize: number, _newCoins: number) => {
  };

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-5">
      <div className="flex items-center gap-3 animate-fade-slide-up">
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-md"
          style={{
            background: "linear-gradient(135deg, rgba(0, 220, 255, 0.08), rgba(0, 220, 255, 0.02))",
            border: "1px solid rgba(0, 220, 255, 0.2)",
          }}
        >
          <Gift className="w-4 h-4 text-cyan-400" />
          <span className="text-sm font-extrabold uppercase tracking-wider text-cyan-400 animate-title-glow">
            Referral Program
          </span>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {[0, 1].map((i) => (
              <div key={i} className="rounded-xl p-4 animate-pulse" style={{ background: "#1a1a2e", border: "1px solid rgba(0, 220, 255, 0.08)" }}>
                <Skeleton className="h-10 w-10 rounded-lg mb-2" style={{ background: "rgba(0, 220, 255, 0.05)" }} />
                <Skeleton className="h-3 w-16 mb-1" style={{ background: "rgba(0, 220, 255, 0.05)" }} />
                <Skeleton className="h-5 w-12" style={{ background: "rgba(0, 220, 255, 0.08)" }} />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div
              className="rounded-xl p-4 animate-card-entrance"
              style={{
                background: "linear-gradient(135deg, rgba(168, 85, 247, 0.08), rgba(168, 85, 247, 0.02))",
                border: "1.5px solid rgba(168, 85, 247, 0.25)",
                boxShadow: "0 0 20px rgba(168, 85, 247, 0.08)",
              }}
              data-testid="card-referral-count"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: "rgba(168, 85, 247, 0.15)" }}>
                  <Users className="w-4 h-4 text-purple-400" />
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 uppercase tracking-widest font-semibold">Referred</p>
                  <p className="text-lg font-extrabold text-white" data-testid="text-total-referred">
                    {data?.totalReferred ?? 0}
                  </p>
                </div>
              </div>
            </div>
            <div
              className="rounded-xl p-4 animate-card-entrance"
              style={{
                background: "linear-gradient(135deg, rgba(245, 158, 11, 0.08), rgba(245, 158, 11, 0.02))",
                border: "1.5px solid rgba(245, 158, 11, 0.25)",
                boxShadow: "0 0 20px rgba(245, 158, 11, 0.08)",
                animationDelay: "0.1s",
              }}
              data-testid="card-coins-balance"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: "rgba(245, 158, 11, 0.15)" }}>
                  <Coins className="w-4 h-4 text-amber-400" />
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 uppercase tracking-widest font-semibold">Coins</p>
                  <p className="text-lg font-extrabold text-amber-400" data-testid="text-coins-balance">
                    {data?.coins ?? 0}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <SpinWheel coins={data?.coins ?? 0} onSpinComplete={handleSpinComplete} />

          <div
            className="rounded-xl p-4 space-y-3 animate-card-entrance"
            style={{
              background: "linear-gradient(180deg, rgba(0, 220, 255, 0.04), rgba(0, 0, 0, 0.2))",
              border: "1.5px solid rgba(0, 220, 255, 0.15)",
              animationDelay: "0.2s",
            }}
          >
            <div className="flex items-center gap-2">
              <Share2 className="w-4 h-4 text-cyan-400" />
              <p className="text-xs font-bold uppercase tracking-widest text-cyan-400">
                Your Referral Link
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={referralLink}
                className="flex-1 px-3 py-2.5 rounded-lg text-xs font-mono text-gray-300 outline-none bg-transparent transition-all"
                style={{ border: "1px solid rgba(0, 220, 255, 0.15)", background: "rgba(0, 220, 255, 0.03)" }}
                data-testid="input-referral-link"
              />
              <button
                onClick={copyCode}
                className="w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-300 hover:scale-105"
                style={{
                  border: "1px solid rgba(0, 220, 255, 0.3)",
                  background: "rgba(0, 220, 255, 0.05)",
                }}
                data-testid="button-copy-referral"
              >
                {copied ? (
                  <CheckCircle2 className="w-4 h-4 text-green-400" />
                ) : (
                  <Copy className="w-4 h-4 text-cyan-400" />
                )}
              </button>
            </div>
            <p className="text-xs text-gray-500">
              Your code: <span className="font-bold text-cyan-400" data-testid="text-referral-code">{data?.referralCode}</span>
            </p>
          </div>

          {data && data.referrals.length > 0 && (
            <div
              className="rounded-xl p-4 space-y-3 animate-card-entrance"
              style={{
                background: "linear-gradient(180deg, rgba(0, 220, 255, 0.04), rgba(0, 0, 0, 0.2))",
                border: "1.5px solid rgba(0, 220, 255, 0.15)",
                animationDelay: "0.3s",
              }}
            >
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-cyan-400" />
                <p className="text-xs font-bold uppercase tracking-widest text-cyan-400">
                  Referred Users
                </p>
              </div>
              <div className="space-y-2">
                {data.referrals.map((ref: any, i: number) => (
                  <div
                    key={ref.id || i}
                    className="flex items-center justify-between px-3 py-2 rounded-md animate-feature-slide-in feature-row-hover"
                    style={{
                      background: "rgba(0, 220, 255, 0.04)",
                      border: "1px solid rgba(0, 220, 255, 0.08)",
                      animationDelay: `${0.3 + i * 0.05}s`,
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ background: "rgba(168, 85, 247, 0.15)", color: "#a78bfa" }}>
                        {i + 1}
                      </span>
                      <span className="text-xs text-gray-300">User #{ref.referredId}</span>
                    </div>
                    <span
                      className="text-xs font-bold px-2 py-0.5 rounded"
                      style={{ background: "rgba(245, 158, 11, 0.1)", color: "#fbbf24", border: "1px solid rgba(245, 158, 11, 0.2)" }}
                    >
                      +{Number(ref.rewardAmount)} coins
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div
            className="rounded-xl p-4 animate-card-entrance"
            style={{
              background: "linear-gradient(180deg, rgba(0, 220, 255, 0.03), rgba(0, 0, 0, 0.15))",
              border: "1px solid rgba(0, 220, 255, 0.1)",
              animationDelay: "0.4s",
            }}
          >
            <p className="text-xs font-bold uppercase tracking-widest text-cyan-400 mb-3">How it works</p>
            <div className="space-y-2">
              {[
                "Share your referral link with friends",
                "They register using your referral code",
                "You earn 5 coins for each referral",
                "Use 25 coins to spin the Lucky Wheel",
                "Win up to ₹100 wallet balance per spin!",
              ].map((step, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 px-3 py-2 rounded-md animate-feature-slide-in"
                  style={{
                    background: "rgba(0, 220, 255, 0.04)",
                    border: "1px solid rgba(0, 220, 255, 0.08)",
                    animationDelay: `${0.4 + i * 0.06}s`,
                  }}
                >
                  <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0" style={{ background: "rgba(0, 220, 255, 0.12)", color: "rgb(0, 220, 255)" }}>
                    {i + 1}
                  </span>
                  <span className="text-sm text-gray-400">{step}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ChevronDown, Download, Pause, Play, Video, Zap } from "lucide-react";
import type { Product, PricingTier } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ProductCardProps {
  product: Product & { tiers: PricingTier[] };
  index?: number;
}

export function ProductCard({ product, index = 0 }: ProductCardProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [expanded, setExpanded] = useState(false);
  const [showTiers, setShowTiers] = useState(false);

  const hasVideo = !!product.videoUrl;

  const buyMutation = useMutation({
    mutationFn: async (tierId: number) => {
      try {
        const res = await apiRequest("POST", "/api/purchases/buy", { tierId });
        return res.json();
      } catch (err: any) {
        const msg = err?.message || "";
        try {
          const jsonPart = msg.substring(msg.indexOf("{"));
          const parsed = JSON.parse(jsonPart);
          throw new Error(parsed.message || "Purchase failed");
        } catch (parseErr) {
          if (parseErr instanceof Error && parseErr.message !== "Purchase failed" && !parseErr.message.includes("JSON")) {
            throw parseErr;
          }
          throw new Error(msg.includes("Insufficient") ? "Insufficient balance" : "Purchase failed");
        }
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/wallet/balance"] });
      queryClient.invalidateQueries({ queryKey: ["/api/purchases"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet/transactions"] });
      const key = data.licenseKey || data.license_key || "";
      navigator.clipboard.writeText(key).catch(() => {});
      toast({
        title: ">> KEY COPIED AUTOMATICALLY <<",
        description: `Your license key: ${key}`,
      });
      window.dispatchEvent(new Event("key-copied"));
    },
    onError: (error: Error) => {
      if (error.message && error.message.toLowerCase().includes("insufficient balance")) {
        toast({
          title: "Insufficient Balance",
          description: "Redirecting to deposit page to add funds...",
          variant: "destructive",
        });
        setTimeout(() => setLocation("/deposit"), 1000);
        return;
      }
      toast({
        title: "Purchase Failed",
        description: error.message || "Something went wrong.",
        variant: "destructive",
      });
    },
  });

  const handleBuy = (tierId: number) => {
    if (!isAuthenticated) {
      setLocation("/login?redirect=/");
      return;
    }
    buyMutation.mutate(tierId);
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.muted = false;
      videoRef.current.play().catch(() => {
        setIsPlaying(false);
      });
    } else {
      videoRef.current.pause();
      videoRef.current.muted = true;
    }
  };

  const visibleFeatures = expanded ? product.features : product.features.slice(0, 3);
  const hasMoreFeatures = product.features.length > 3;

  return (
    <div
      className="rounded-xl overflow-hidden flex flex-col animate-card-entrance product-card-hover"
      style={{
        border: "2px solid rgba(0, 220, 255, 0.4)",
        animationDelay: `${index * 0.12}s`,
        background: "linear-gradient(180deg, #0d0d1a 0%, #1a1a2e 100%)",
      }}
      data-testid={`card-product-${product.id}`}
    >
      <div className="relative bg-black overflow-hidden">
        <div className="relative" style={{ minHeight: "180px" }}>
          {hasVideo ? (
            <>
              <video
                ref={videoRef}
                src={product.videoUrl! + "#t=0.1"}
                className="w-full aspect-video object-cover bg-black"
                loop
                playsInline
                preload="metadata"
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                data-testid={`video-product-${product.id}`}
              />
              <div className="video-overlay-gradient absolute inset-0 pointer-events-none" />
              <button
                onClick={togglePlay}
                className="absolute inset-0 z-10 flex items-center justify-center group"
                data-testid={`button-playpause-${product.id}`}
              >
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 group-hover:scale-110 animate-play-btn-pulse"
                  style={{
                    background: "rgba(0, 0, 0, 0.5)",
                    border: "3px solid rgba(0, 220, 255, 0.8)",
                  }}
                >
                  {isPlaying ? (
                    <Pause className="w-6 h-6 text-white fill-white" />
                  ) : (
                    <Play className="w-6 h-6 text-white fill-white ml-0.5" />
                  )}
                </div>
              </button>

              <div
                className="scan-line absolute top-0 left-0 w-full h-[2px] z-5 pointer-events-none"
                style={{
                  background: "linear-gradient(90deg, transparent, rgba(0, 220, 255, 0.4), transparent)",
                  animation: "scanLine 3s linear infinite",
                }}
              />
            </>
          ) : (
            <div
              className="w-full aspect-video flex items-center justify-center"
              style={{
                background: "radial-gradient(ellipse at center, rgba(0, 220, 255, 0.05) 0%, rgba(0, 0, 0, 0.95) 70%)",
              }}
            >
              <Video className="w-10 h-10 text-cyan-500/30" />
            </div>
          )}
        </div>

        {product.youtubeUrl && product.youtubeUrl !== "#" && (
          <a
            href={product.youtubeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute top-2 left-2 z-20"
            data-testid={`link-youtube-${product.id}`}
          >
            <div className="flex items-center gap-1 px-2 py-1 rounded text-[9px] font-bold uppercase tracking-wider text-white cursor-pointer transition-all hover:scale-105"
              style={{ background: "linear-gradient(135deg, #dc2626, #b91c1c)", boxShadow: "0 2px 8px rgba(220, 38, 38, 0.4)" }}
            >
              <Play className="w-3 h-3 fill-white" />
              Watch on YouTube
            </div>
          </a>
        )}
      </div>

      <div className="flex-1 flex flex-col" style={{ background: "linear-gradient(180deg, #1a1a2e 0%, #12122a 100%)" }}>
        <div className="px-3 pt-3 pb-2">
          <h5
            className="text-sm font-extrabold uppercase tracking-wider text-center text-white mb-3 animate-title-glow"
            data-testid={`text-product-name-${product.id}`}
          >
            {product.name}
          </h5>

          <div className="space-y-1.5">
            {visibleFeatures.map((feature, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs feature-row-hover animate-feature-slide-in"
                style={{
                  background: "rgba(0, 220, 255, 0.04)",
                  border: "1px solid rgba(0, 220, 255, 0.1)",
                  animationDelay: `${idx * 0.06}s`,
                }}
              >
                <Zap className="w-3.5 h-3.5 text-cyan-400 fill-cyan-400 flex-shrink-0 zap-icon" />
                <span className="text-gray-300 font-medium">
                  {feature.startsWith("-") ? feature.slice(1).trim() : feature}
                </span>
              </div>
            ))}
          </div>

          {hasMoreFeatures && (
            <div className="flex justify-center mt-2">
              <button
                onClick={() => setExpanded(!expanded)}
                className="text-gray-400 hover:text-cyan-400 transition-all duration-300 p-1 hover:scale-125"
                data-testid={`button-expand-${product.id}`}
              >
                <ChevronDown className={`w-5 h-5 transition-transform duration-500 ${expanded ? "rotate-180" : ""}`} />
              </button>
            </div>
          )}
        </div>

        <div className="px-3 pb-3 mt-auto">
          <div className="flex gap-2 mb-2">
            {product.updateUrl && product.updateUrl !== "#" && (
              <a
                href={product.updateUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1"
                data-testid={`link-update-${product.id}`}
              >
                <div className="flex items-center justify-center gap-1.5 px-2 py-2 rounded-md text-[10px] font-bold uppercase tracking-wider text-gray-300 cursor-pointer action-btn-hover"
                  style={{ border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.02)" }}
                >
                  <Download className="w-3 h-3" />
                  <span>Check<br/>Update File</span>
                </div>
              </a>
            )}
            {product.feedbackUrl && product.feedbackUrl !== "#" && (
              <a
                href={product.feedbackUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1"
                data-testid={`link-feedback-${product.id}`}
              >
                <div className="flex items-center justify-center gap-1.5 px-2 py-2 rounded-md text-[10px] font-bold uppercase tracking-wider text-gray-300 cursor-pointer action-btn-hover"
                  style={{ border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.02)" }}
                >
                  <Play className="w-3 h-3" />
                  <span>Check Video /<br/>Feedback</span>
                </div>
              </a>
            )}
          </div>

          <button
            onClick={() => setShowTiers(!showTiers)}
            className="w-full py-2.5 rounded-md text-xs font-extrabold uppercase tracking-widest text-white purchase-btn-hover animate-purchase-pulse relative overflow-hidden"
            style={{
              background: "linear-gradient(135deg, #7c3aed 0%, #c026d3 50%, #ec4899 100%)",
            }}
            data-testid={`button-purchase-${product.id}`}
          >
            Purchase Key
          </button>

          {showTiers && (
            <div className="mt-2 space-y-1.5 animate-slide-down">
              {product.tiers.map((tier, tIdx) => (
                <div
                  key={tier.id}
                  className="flex items-center justify-between gap-2 px-3 py-2 rounded-md tier-row-hover animate-feature-slide-in"
                  style={{
                    background: "rgba(124, 58, 237, 0.08)",
                    border: "1px solid rgba(124, 58, 237, 0.2)",
                    animationDelay: `${tIdx * 0.05}s`,
                  }}
                  data-testid={`row-tier-${tier.id}`}
                >
                  <span className="text-xs font-semibold text-gray-300" data-testid={`text-tier-label-${tier.id}`}>
                    {tier.label}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white" data-testid={`text-tier-price-${tier.id}`}>
                      ₹{Number(tier.price).toFixed(0)}
                    </span>
                    <Button
                      size="sm"
                      onClick={() => handleBuy(tier.id)}
                      disabled={buyMutation.isPending}
                      className="uppercase text-[10px] font-bold px-3 h-6 border-0 buy-btn-hover"
                      style={{ background: "linear-gradient(135deg, #7c3aed, #c026d3)" }}
                      data-testid={`button-buy-tier-${tier.id}`}
                    >
                      Buy
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

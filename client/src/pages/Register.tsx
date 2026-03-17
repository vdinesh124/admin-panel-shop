import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { ShieldCheck, Loader2, Lock } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  opacity: number;
  life?: number;
  maxLife?: number;
}

export default function Register() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [loading, setLoading] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const particlesRef = useRef<Particle[]>([]);
  const mouseRef = useRef<{ x: number; y: number; active: boolean }>({ x: 0, y: 0, active: false });
  const maxParticlesRef = useRef<number>(200);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");
    if (ref) setReferralCode(ref);
  }, []);

  const initParticles = useCallback((width: number, height: number) => {
    const count = Math.min(Math.floor((width * height) / 8000), 150);
    maxParticlesRef.current = count + 80;
    const particles: Particle[] = [];
    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 1.2,
        vy: (Math.random() - 0.5) * 1.2,
        radius: Math.random() * 5 + 3,
        opacity: Math.random() * 0.4 + 0.6,
      });
    }
    particlesRef.current = particles;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      initParticles(canvas.width, canvas.height);
    };
    resize();
    window.addEventListener("resize", resize);

    const spawnParticlesAtCursor = (cx: number, cy: number) => {
      const particles = particlesRef.current;
      if (particles.length >= maxParticlesRef.current) return;
      const count = 2;
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 2 + 0.5;
        particles.push({
          x: cx + (Math.random() - 0.5) * 20,
          y: cy + (Math.random() - 0.5) * 20,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          radius: Math.random() * 4 + 2,
          opacity: Math.random() * 0.3 + 0.7,
          life: 0,
          maxLife: 120 + Math.random() * 80,
        });
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY, active: true };
      spawnParticlesAtCursor(e.clientX, e.clientY);
    };

    const handleTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (touch) {
        mouseRef.current = { x: touch.clientX, y: touch.clientY, active: true };
        spawnParticlesAtCursor(touch.clientX, touch.clientY);
      }
    };

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (touch) {
        mouseRef.current = { x: touch.clientX, y: touch.clientY, active: true };
        for (let i = 0; i < 5; i++) {
          spawnParticlesAtCursor(touch.clientX, touch.clientY);
        }
      }
    };

    const handleMouseLeave = () => { mouseRef.current.active = false; };
    const handleTouchEnd = () => { mouseRef.current.active = false; };

    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("touchmove", handleTouchMove, { passive: true });
    canvas.addEventListener("touchstart", handleTouchStart, { passive: true });
    canvas.addEventListener("mouseleave", handleMouseLeave);
    canvas.addEventListener("touchend", handleTouchEnd);

    const animate = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      const particles = particlesRef.current;
      const connectionDist = 150;
      const mouse = mouseRef.current;

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        if (p.life !== undefined && p.maxLife !== undefined) {
          p.life++;
          if (p.life >= p.maxLife) {
            particles.splice(i, 1);
            continue;
          }
          p.opacity = (1 - p.life / p.maxLife) * 0.8;
        }
      }

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        if (mouse.active) {
          const dx = p.x - mouse.x;
          const dy = p.y - mouse.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120 && dist > 0) {
            const force = (120 - dist) / 120 * 0.3;
            p.vx += (dx / dist) * force;
            p.vy += (dy / dist) * force;
          }
        }

        const maxSpeed = 2;
        const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        if (speed > maxSpeed) {
          p.vx = (p.vx / speed) * maxSpeed;
          p.vy = (p.vy / speed) * maxSpeed;
        }

        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) { p.x = 0; p.vx *= -1; }
        if (p.x > w) { p.x = w; p.vx *= -1; }
        if (p.y < 0) { p.y = 0; p.vy *= -1; }
        if (p.y > h) { p.y = h; p.vy *= -1; }

        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dx = p.x - p2.x;
          const dy = p.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < connectionDist) {
            const alpha = (1 - dist / connectionDist) * 0.5 * Math.min(p.opacity, p2.opacity);
            ctx.beginPath();
            ctx.strokeStyle = `rgba(0, 220, 255, ${alpha})`;
            ctx.lineWidth = 1;
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
        }

        if (mouse.active) {
          const dx = p.x - mouse.x;
          const dy = p.y - mouse.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < connectionDist) {
            const alpha = (1 - dist / connectionDist) * 0.6;
            ctx.beginPath();
            ctx.strokeStyle = `rgba(0, 255, 255, ${alpha})`;
            ctx.lineWidth = 1.5;
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(mouse.x, mouse.y);
            ctx.stroke();
          }
        }
      }

      for (const p of particles) {
        ctx.beginPath();
        const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius * 4);
        gradient.addColorStop(0, `rgba(0, 255, 255, ${p.opacity})`);
        gradient.addColorStop(0.3, `rgba(0, 220, 255, ${p.opacity * 0.6})`);
        gradient.addColorStop(0.6, `rgba(0, 200, 255, ${p.opacity * 0.2})`);
        gradient.addColorStop(1, "rgba(0, 220, 255, 0)");
        ctx.fillStyle = gradient;
        ctx.arc(p.x, p.y, p.radius * 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.fillStyle = `rgba(0, 255, 255, ${p.opacity})`;
        ctx.shadowColor = "rgba(0, 255, 255, 0.8)";
        ctx.shadowBlur = 15;
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      animationRef.current = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("touchmove", handleTouchMove);
      canvas.removeEventListener("touchstart", handleTouchStart);
      canvas.removeEventListener("mouseleave", handleMouseLeave);
      canvas.removeEventListener("touchend", handleTouchEnd);
      cancelAnimationFrame(animationRef.current);
    };
  }, [initParticles]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password || !email) return;
    if (password !== confirmPassword) {
      toast({ title: "Passwords do not match", variant: "destructive" });
      return;
    }
    if (password.length < 6) {
      toast({ title: "Password must be at least 6 characters", variant: "destructive" });
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast({ title: "Please enter a valid email address", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, email, referralCode: referralCode || undefined }),
        credentials: "include",
      });
      if (res.ok) {
        await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
        setLocation("/dashboard");
      } else {
        const data = await res.json();
        toast({ title: data.message || "Registration failed", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Registration failed. Please try again.", variant: "destructive" });
    }
    setLoading(false);
  };

  const inputStyle = {
    background: "rgba(0, 220, 255, 0.03)",
    border: "1.5px solid rgba(0, 220, 255, 0.12)",
    letterSpacing: "0.05em",
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.borderColor = "rgba(0, 220, 255, 0.4)";
    e.target.style.boxShadow = "0 0 15px rgba(0, 220, 255, 0.08)";
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.borderColor = "rgba(0, 220, 255, 0.12)";
    e.target.style.boxShadow = "none";
  };

  return (
    <div className="relative min-h-screen overflow-hidden" style={{ background: "#000" }}>
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" style={{ zIndex: 1, touchAction: "none" }} />

      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4 py-8 pointer-events-none">
        <div
          className="text-center mb-6 animate-fade-slide-up"
          style={{ animationDelay: "0s" }}
        >
          <p
            className="text-[11px] font-bold uppercase tracking-[0.3em]"
            style={{ color: "rgba(0, 220, 255, 0.7)" }}
            data-testid="text-security-validation"
          >
            Security Validation
          </p>
          <div className="flex items-center justify-center gap-2 mt-2">
            <Lock className="w-3 h-3" style={{ color: "rgba(0, 220, 255, 0.5)" }} />
            <p
              className="text-[10px] tracking-wider"
              style={{ color: "rgba(0, 220, 255, 0.4)" }}
            >
              Syncing security keys<span className="syncing-dots">...</span>
            </p>
          </div>
        </div>

        <div
          className="w-full max-w-[380px] animate-fade-slide-up pointer-events-auto"
          style={{ animationDelay: "0.15s" }}
        >
          <div
            className="rounded-2xl p-8 space-y-6"
            style={{
              background: "linear-gradient(180deg, rgba(8, 12, 28, 0.96) 0%, rgba(4, 8, 18, 0.98) 100%)",
              border: "1.5px solid rgba(0, 220, 255, 0.25)",
              boxShadow: "0 0 40px rgba(0, 220, 255, 0.1), 0 0 80px rgba(0, 220, 255, 0.03), inset 0 1px 0 rgba(0, 220, 255, 0.08)",
            }}
          >
            <div className="text-center space-y-4 pt-2">
              <div
                className="w-[72px] h-[72px] rounded-full flex items-center justify-center mx-auto shield-glow"
                style={{
                  background: "radial-gradient(circle, rgba(0, 220, 255, 0.15) 0%, rgba(0, 220, 255, 0.05) 70%, transparent 100%)",
                  border: "2px solid rgba(0, 220, 255, 0.3)",
                }}
              >
                <ShieldCheck className="w-9 h-9" style={{ color: "rgb(0, 220, 255)", filter: "drop-shadow(0 0 8px rgba(0, 220, 255, 0.5))" }} />
              </div>
              <div>
                <h1
                  className="text-[22px] font-extrabold tracking-[0.15em] uppercase text-white"
                  data-testid="text-brand"
                >
                  Nexa <span style={{ color: "rgb(0, 220, 255)" }}>Panel</span>
                </h1>
                <p
                  className="text-[10px] uppercase tracking-[0.3em] font-semibold mt-1.5"
                  style={{ color: "rgba(0, 220, 255, 0.5)" }}
                >
                  Create Account
                </p>
              </div>
            </div>

            <form onSubmit={handleRegister} className="space-y-4">
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="USER NAME"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-4 py-3.5 rounded-xl text-[13px] text-white placeholder-gray-500 outline-none transition-all duration-300"
                  style={inputStyle}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                  data-testid="input-register-username"
                  autoComplete="username"
                />
                <input
                  type="email"
                  placeholder="EMAIL"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3.5 rounded-xl text-[13px] text-white placeholder-gray-500 outline-none transition-all duration-300"
                  style={inputStyle}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                  data-testid="input-register-email"
                  autoComplete="email"
                />
                <input
                  type="password"
                  placeholder="PASSWORD"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3.5 rounded-xl text-[13px] text-white placeholder-gray-500 outline-none transition-all duration-300"
                  style={inputStyle}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                  data-testid="input-register-password"
                  autoComplete="new-password"
                />
                <input
                  type="password"
                  placeholder="CONFIRM PASSWORD"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-3.5 rounded-xl text-[13px] text-white placeholder-gray-500 outline-none transition-all duration-300"
                  style={inputStyle}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                  data-testid="input-register-confirm-password"
                  autoComplete="new-password"
                />
                <input
                  type="text"
                  placeholder="REFERRAL CODE (OPTIONAL)"
                  value={referralCode}
                  onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                  className="w-full px-4 py-3.5 rounded-xl text-[13px] text-white placeholder-gray-500 outline-none transition-all duration-300"
                  style={referralCode ? { ...inputStyle, border: "1.5px solid rgba(0, 220, 255, 0.35)" } : inputStyle}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                  data-testid="input-register-referral"
                  autoComplete="off"
                />
              </div>

              <button
                type="submit"
                disabled={loading || !username || !email || !password || !confirmPassword}
                className="w-full py-3.5 rounded-xl text-[13px] font-extrabold uppercase tracking-[0.2em] text-white transition-all duration-300 disabled:opacity-40 flex items-center justify-center gap-2"
                style={{
                  background: "linear-gradient(135deg, rgba(0, 220, 255, 0.85), rgba(0, 180, 220, 0.95))",
                  boxShadow: "0 0 25px rgba(0, 220, 255, 0.25), 0 4px 15px rgba(0, 0, 0, 0.3)",
                }}
                onMouseEnter={(e) => { (e.target as HTMLElement).style.boxShadow = "0 0 35px rgba(0, 220, 255, 0.4), 0 4px 20px rgba(0, 0, 0, 0.4)"; }}
                onMouseLeave={(e) => { (e.target as HTMLElement).style.boxShadow = "0 0 25px rgba(0, 220, 255, 0.25), 0 4px 15px rgba(0, 0, 0, 0.3)"; }}
                data-testid="button-register"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Register Now
              </button>
            </form>

            <p className="text-center text-[12px] text-gray-400 pb-1">
              Already Member ?{" "}
              <a
                href="/login"
                className="font-semibold hover:underline transition-colors"
                style={{ color: "rgb(0, 220, 255)" }}
                data-testid="link-login"
              >
                Login Now
              </a>
            </p>
          </div>

          <p
            className="text-center text-[10px] mt-5 tracking-[0.15em] uppercase"
            style={{ color: "rgba(100, 110, 130, 0.6)" }}
          >
            &copy; {new Date().getFullYear()} Nexa Panel
          </p>
        </div>
      </div>
    </div>
  );
}

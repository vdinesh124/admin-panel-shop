import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Shield, Lock, User } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface AdminLoginProps {
  onLogin: () => void;
}

export default function AdminLogin({ onLogin }: AdminLoginProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const { toast } = useToast();

  const loginMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/login", { username, password });
      return res.json();
    },
    onSuccess: () => {
      onLogin();
    },
    onError: () => {
      toast({
        title: "Login Failed",
        description: "Invalid username or password",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-3">
          <div className="w-20 h-20 mx-auto rounded-full border-2 border-dashed border-primary/50 flex items-center justify-center bg-primary/5">
            <Shield className="w-10 h-10 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight">
              ADMIN <span className="text-primary">PANEL</span>
            </h1>
            <p className="text-xs text-muted-foreground uppercase tracking-[0.3em]">Authorize Access</p>
          </div>
        </div>

        <Card className="p-6 space-y-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              loginMutation.mutate();
            }}
            className="space-y-4"
          >
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="pl-10"
                data-testid="input-admin-username"
              />
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10"
                data-testid="input-admin-password"
              />
            </div>
            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={loginMutation.isPending || !username || !password}
              data-testid="button-admin-login"
            >
              {loginMutation.isPending ? "Verifying..." : "LOGIN NOW"}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}

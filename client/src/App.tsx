import { useState, useEffect } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { AdminSidebar } from "@/components/admin-sidebar";
import { WalletBadge } from "@/components/WalletBadge";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/Landing";
import Register from "@/pages/Register";
import Dashboard from "@/pages/Dashboard";
import Deposit from "@/pages/Deposit";
import Marketplace from "@/pages/Marketplace";
import MyPurchases from "@/pages/MyPurchases";
import History from "@/pages/History";
import Referrals from "@/pages/Referrals";
import Profile from "@/pages/Profile";
import Payment from "@/pages/Payment";
import AdminLogin from "@/pages/AdminLogin";
import AdminDashboard from "@/pages/AdminDashboard";
import AdminProducts from "@/pages/AdminProducts";
import AdminKeys from "@/pages/AdminKeys";
import AdminUsers from "@/pages/AdminUsers";
import AdminPayments from "@/pages/AdminPayments";
import Reseller from "@/pages/Reseller";
import CustomerPriceList from "@/pages/CustomerPriceList";
import ResellerPriceList from "@/pages/ResellerPriceList";

const PUBLIC_PAGES = ["/", "/buy", "/login", "/register"];

function MainLayout() {
  const { isAuthenticated, isLoading } = useAuth();
  const [location, setLocation] = useLocation();
  const style = {
    "--sidebar-width": "15rem",
    "--sidebar-width-icon": "3rem",
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const isPublicPage = PUBLIC_PAGES.includes(location);

  if (!isAuthenticated && !isPublicPage) {
    return <Landing redirectTo={location} />;
  }

  if (location === "/login") {
    if (isAuthenticated) {
      setLocation("/dashboard");
      return null;
    }
    return <Landing />;
  }

  if (location === "/register") {
    if (isAuthenticated) {
      setLocation("/dashboard");
      return null;
    }
    return <Register />;
  }

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 min-w-0 relative" style={{ background: "#050505" }}>
          <div className="absolute inset-y-0 left-0 w-[3px] z-10" style={{ background: "linear-gradient(180deg, #3b82f6, #8b5cf6, #06b6d4, #10b981, #f59e0b, #ef4444, #8b5cf6)" }} />
          <div className="absolute inset-y-0 right-0 w-[3px] z-10" style={{ background: "linear-gradient(180deg, #f59e0b, #ef4444, #8b5cf6, #3b82f6, #06b6d4, #10b981, #f59e0b)" }} />
          <header className="sticky top-0 z-50 px-3 pt-2 pb-1">
            <div className="flex items-center justify-between w-full rounded-2xl px-4 py-2.5" style={{ background: "#111827", border: "1px solid rgba(255,255,255,0.05)" }}>
              <SidebarTrigger className="h-9 w-9 text-white hover:text-cyan-400 hover:bg-cyan-500/10" data-testid="button-sidebar-toggle" />
              <div className="flex items-center gap-2 flex-wrap">
                {isAuthenticated && <WalletBadge />}
                <ThemeToggle />
              </div>
            </div>
          </header>
          <main className="flex-1 overflow-y-auto">
            <Switch>
              <Route path="/" component={Marketplace} />
              <Route path="/buy" component={Marketplace} />
              <Route path="/dashboard" component={Dashboard} />
              <Route path="/deposit" component={Deposit} />
              <Route path="/mykeys" component={MyPurchases} />
              <Route path="/history" component={History} />
              <Route path="/reseller" component={Reseller} />
              <Route path="/referrals" component={Referrals} />
              <Route path="/profile" component={Profile} />
              <Route path="/payment/:id" component={Payment} />
              <Route component={NotFound} />
            </Switch>
          </main>
        </div>
      </div>

      <a href="https://t.me/nexamodoffical" target="_blank" rel="noopener noreferrer" className="fixed bottom-5 right-5 z-40" data-testid="button-telegram">
        <div className="w-12 h-12 rounded-full flex items-center justify-center shadow-lg" style={{ background: "#0088cc", boxShadow: "0 4px 15px rgba(0,136,204,0.4)" }}>
          <Send className="w-5 h-5 text-white" />
        </div>
      </a>
    </SidebarProvider>
  );
}

function AdminLayout() {
  const style = {
    "--sidebar-width": "15rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AdminSidebar />
        <div className="flex flex-col flex-1 min-w-0">
          <header className="sticky top-0 z-50 flex items-center justify-between gap-3 px-3 h-12 border-b border-border bg-card">
            <SidebarTrigger data-testid="button-admin-sidebar-toggle" />
            <ThemeToggle />
          </header>
          <main className="flex-1 overflow-y-auto">
            <Switch>
              <Route path="/admin" component={AdminDashboard} />
              <Route path="/admin/products" component={AdminProducts} />
              <Route path="/admin/keys" component={AdminKeys} />
              <Route path="/admin/payments" component={AdminPayments} />
              <Route path="/admin/users" component={AdminUsers} />
              <Route component={NotFound} />
            </Switch>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function AdminApp() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  const { data: session } = useQuery<{ isAdmin: boolean }>({
    queryKey: ["/api/admin/session"],
    retry: false,
  });

  useEffect(() => {
    if (session !== undefined) {
      setIsAdmin(session?.isAdmin ?? false);
    }
  }, [session]);

  if (isAdmin === null) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <AdminLogin
        onLogin={() => {
          setIsAdmin(true);
          queryClient.invalidateQueries({ queryKey: ["/api/admin/session"] });
        }}
      />
    );
  }

  return <AdminLayout />;
}

function AppRouter() {
  const [location] = useLocation();
  const isAdminRoute = location.startsWith("/admin");

  if (location === "/customer") return <CustomerPriceList />;
  if (location === "/reseller-price") return <ResellerPriceList />;

  if (isAdminRoute) {
    return <AdminApp />;
  }

  return <MainLayout />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <AppRouter />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

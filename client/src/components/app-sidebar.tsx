import { useLocation, Link } from "wouter";
import { LayoutDashboard, Wallet, Store, Key, Clock, Users, User, LogOut, LogIn, UserPlus, Send, Crown } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/use-auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

const authNavItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/deposit", label: "Deposit", icon: Wallet },
  { href: "/", label: "Buy Keys", icon: Store },
  { href: "/mykeys", label: "My Keys", icon: Key },
  { href: "/history", label: "History", icon: Clock },
  { href: "/reseller", label: "Reseller", icon: Crown },
  { href: "/referrals", label: "Referrals", icon: Users },
  { href: "/profile", label: "Profile", icon: User },
];

const guestNavItems = [
  { href: "/login", label: "Login", icon: LogIn },
  { href: "/register", label: "Register", icon: UserPlus },
  { href: "/", label: "Buy Keys", icon: Store },
];

function LogoutButton() {
  const { logout } = useAuth();
  return (
    <Button size="icon" variant="ghost" onClick={() => logout()} data-testid="button-logout">
      <LogOut className="w-3.5 h-3.5" />
    </Button>
  );
}

export function AppSidebar() {
  const [location] = useLocation();
  const { user, isAuthenticated } = useAuth();

  const navItems = isAuthenticated ? authNavItems : guestNavItems;
  const groupLabel = isAuthenticated ? "Navigation" : "Welcome";

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "radial-gradient(circle, rgba(0, 220, 255, 0.15) 0%, rgba(0, 220, 255, 0.05) 70%, transparent 100%)", border: "1.5px solid rgba(0, 220, 255, 0.3)" }}>
            <Store className="w-4 h-4" style={{ color: "rgb(0, 220, 255)" }} />
          </div>
          <div>
            <p className="font-bold text-sm" data-testid="text-sidebar-brand">NEXA PANEL</p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="uppercase tracking-widest text-[10px]" style={{ color: "rgba(0, 220, 255, 0.6)" }}>{groupLabel}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.href + item.label}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.href || (item.href === "/" && location === "/buy")}
                    data-testid={`link-sidebar-${item.label.toLowerCase().replace(/\s/g, '-')}`}
                  >
                    <Link href={item.href}>
                      <item.icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild data-testid="link-join-telegram">
                  <a href="https://t.me/nexamodoffical" target="_blank" rel="noopener noreferrer">
                    <Send className="w-4 h-4" style={{ color: "#29b6f6" }} />
                    <span>Join Telegram</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-3">
        {isAuthenticated && (
          <div className="flex items-center gap-2 px-2 py-1.5">
            <Avatar className="w-7 h-7">
              <AvatarImage src={user?.profileImageUrl || ""} />
              <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-bold">
                {user?.firstName?.[0] || user?.email?.[0] || "U"}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate" data-testid="text-sidebar-username">
                {user?.username || user?.firstName || user?.email || "User"}
              </p>
            </div>
            <LogoutButton />
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}

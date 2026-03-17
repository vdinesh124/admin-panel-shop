import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Package, ShoppingCart, IndianRupee } from "lucide-react";

export default function AdminDashboard() {
  const { data: stats, isLoading } = useQuery<{
    totalUsers: number;
    totalProducts: number;
    totalPurchases: number;
    totalRevenue: number;
  }>({
    queryKey: ["/api/admin/stats"],
  });

  const cards = [
    { label: "Total Users", value: stats?.totalUsers ?? 0, icon: Users, color: "text-blue-500" },
    { label: "Total Products", value: stats?.totalProducts ?? 0, icon: Package, color: "text-green-500" },
    { label: "Total Purchases", value: stats?.totalPurchases ?? 0, icon: ShoppingCart, color: "text-purple-500" },
    { label: "Total Revenue", value: `₹${(stats?.totalRevenue ?? 0).toFixed(2)}`, icon: IndianRupee, color: "text-amber-500" },
  ];

  return (
    <div className="p-4 md:p-6 space-y-6">
      <h1 className="text-xl font-bold" data-testid="text-admin-dashboard-title">Admin Dashboard</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <Card key={card.label} className="p-4 space-y-2">
            {isLoading ? (
              <Skeleton className="h-16 w-full" />
            ) : (
              <>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm text-muted-foreground">{card.label}</span>
                  <card.icon className={`w-5 h-5 ${card.color}`} />
                </div>
                <p className="text-2xl font-bold" data-testid={`text-admin-stat-${card.label.toLowerCase().replace(/\s/g, '-')}`}>
                  {card.value}
                </p>
              </>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}

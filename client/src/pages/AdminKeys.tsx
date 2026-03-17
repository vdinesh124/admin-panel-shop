import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Key, Copy, Check, Plus, Trash2, Package, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useState, useCallback } from "react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface Purchase {
  id: number;
  userId: string;
  productId: number;
  tierId: number;
  licenseKey: string;
  amount: string;
  createdAt: string;
  productName?: string;
  tierLabel?: string;
  userEmail?: string;
}

interface PricingTier {
  id: number;
  productId: number;
  label: string;
  price: string;
  sortOrder: number;
}

interface Product {
  id: number;
  name: string;
  tiers: PricingTier[];
}

interface KeyStock {
  tierId: number;
  total: string;
  available: string;
}

interface StockKey {
  id: number;
  tierId: number;
  productId: number;
  keyValue: string;
  status: string;
  soldToUserId: string | null;
  createdAt: string;
}

export default function AdminKeys() {
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"add" | "sold">("add");
  const [selectedProduct, setSelectedProduct] = useState<number | null>(null);
  const [selectedTier, setSelectedTier] = useState<number | null>(null);
  const [keysText, setKeysText] = useState("");
  const [expandedProduct, setExpandedProduct] = useState<number | null>(null);
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: purchases, isLoading: purchasesLoading } = useQuery<Purchase[]>({
    queryKey: ["/api/admin/purchases"],
  });

  const { data: products, isLoading: productsLoading } = useQuery<Product[]>({
    queryKey: ["/api/admin/products"],
  });

  const copyKey = useCallback((id: number, key: string) => {
    navigator.clipboard.writeText(key);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  const addKeysMutation = useMutation({
    mutationFn: async ({ tierId, productId, keys }: { tierId: number; productId: number; keys: string[] }) => {
      const res = await apiRequest("POST", "/api/admin/keys/add", { tierId, productId, keys });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Keys added successfully" });
      setKeysText("");
      if (selectedProduct) {
        qc.invalidateQueries({ queryKey: ["/api/admin/keys/stock", selectedProduct] });
      }
      if (selectedTier) {
        qc.invalidateQueries({ queryKey: ["/api/admin/keys/tier", selectedTier] });
      }
    },
    onError: (error: Error) => {
      toast({ title: "Failed to add keys", description: error.message, variant: "destructive" });
    },
  });

  const deleteKeyMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/admin/keys/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Key deleted" });
      if (selectedTier) {
        qc.invalidateQueries({ queryKey: ["/api/admin/keys/tier", selectedTier] });
      }
      if (selectedProduct) {
        qc.invalidateQueries({ queryKey: ["/api/admin/keys/stock", selectedProduct] });
      }
    },
  });

  const handleAddKeys = () => {
    if (!selectedTier || !selectedProduct || !keysText.trim()) return;
    const keys = keysText.split("\n").map(k => k.trim()).filter(Boolean);
    if (keys.length === 0) return;
    addKeysMutation.mutate({ tierId: selectedTier, productId: selectedProduct, keys });
  };

  const selectedProductData = products?.find(p => p.id === selectedProduct);
  const keyLines = keysText.split("\n").filter(l => l.trim()).length;

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-xl font-bold" data-testid="text-admin-keys-title">License Keys</h1>
        <div className="flex gap-1">
          <Button
            size="sm"
            variant={activeTab === "add" ? "default" : "outline"}
            onClick={() => setActiveTab("add")}
            className="gap-1.5 text-xs"
            data-testid="tab-add-keys"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Keys
          </Button>
          <Button
            size="sm"
            variant={activeTab === "sold" ? "default" : "outline"}
            onClick={() => setActiveTab("sold")}
            className="gap-1.5 text-xs"
            data-testid="tab-sold-keys"
          >
            <Key className="w-3.5 h-3.5" />
            Sold Keys
            <Badge variant="secondary" className="ml-1 text-[10px]">{purchases?.length || 0}</Badge>
          </Button>
        </div>
      </div>

      {activeTab === "add" && (
        <div className="space-y-4">
          <Card className="p-4 space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider">Add License Keys to Stock</h2>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">
                  Select Product
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {productsLoading ? (
                    <Skeleton className="h-10 col-span-2" />
                  ) : (
                    products?.map(p => (
                      <Button
                        key={p.id}
                        variant={selectedProduct === p.id ? "default" : "outline"}
                        className="justify-start gap-2 text-xs h-auto py-2"
                        onClick={() => {
                          setSelectedProduct(p.id);
                          setSelectedTier(null);
                        }}
                        data-testid={`button-select-product-${p.id}`}
                      >
                        <Package className="w-3.5 h-3.5" />
                        {p.name}
                      </Button>
                    ))
                  )}
                </div>
              </div>

              {selectedProduct && selectedProductData && (
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">
                    Select Tier
                  </label>
                  <div className="flex gap-2 flex-wrap">
                    {selectedProductData.tiers.map(t => (
                      <Button
                        key={t.id}
                        variant={selectedTier === t.id ? "default" : "outline"}
                        size="sm"
                        className="text-xs"
                        onClick={() => setSelectedTier(t.id)}
                        data-testid={`button-select-tier-${t.id}`}
                      >
                        {t.label} - ₹{Number(t.price).toFixed(0)}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {selectedTier && (
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                    Paste License Keys (one per line)
                  </label>
                  <Textarea
                    value={keysText}
                    onChange={(e) => setKeysText(e.target.value)}
                    placeholder={"XXXX-XXXX-XXXX-XXXX\nYYYY-YYYY-YYYY-YYYY\nZZZZ-ZZZZ-ZZZZ-ZZZZ"}
                    rows={6}
                    className="font-mono text-xs"
                    data-testid="textarea-keys"
                  />
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">
                      {keyLines} key{keyLines !== 1 ? "s" : ""} ready to add
                    </p>
                    <Button
                      onClick={handleAddKeys}
                      disabled={!keysText.trim() || addKeysMutation.isPending}
                      className="gap-1.5"
                      size="sm"
                      data-testid="button-add-keys"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      {addKeysMutation.isPending ? "Adding..." : `Add ${keyLines} Key${keyLines !== 1 ? "s" : ""}`}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </Card>

          <Card className="p-4 space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-wider">Key Stock by Product</h2>
            {productsLoading ? (
              <Skeleton className="h-20" />
            ) : (
              <div className="space-y-2">
                {products?.map(p => (
                  <ProductStockSection
                    key={p.id}
                    product={p}
                    expanded={expandedProduct === p.id}
                    onToggle={() => setExpandedProduct(expandedProduct === p.id ? null : p.id)}
                    onDeleteKey={(id) => deleteKeyMutation.mutate(id)}
                    deletingKey={deleteKeyMutation.isPending}
                  />
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {activeTab === "sold" && (
        <div>
          {purchasesLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
            </div>
          ) : purchases && purchases.length > 0 ? (
            <div className="space-y-2">
              {purchases.map((p) => (
                <Card key={p.id} className="p-3" data-testid={`card-admin-key-${p.id}`}>
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Key className="w-4 h-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold" data-testid={`text-key-product-${p.id}`}>{p.productName || `Product #${p.productId}`}</span>
                          <Badge variant="secondary" className="text-[10px]">{p.tierLabel}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          User: {p.userEmail} | ₹{Number(p.amount).toFixed(0)} | {new Date(p.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <code className="text-[10px] bg-muted px-2 py-1 rounded font-mono max-w-[160px] truncate" data-testid={`text-license-key-${p.id}`}>
                        {p.licenseKey}
                      </code>
                      <Button size="icon" variant="ghost" onClick={() => copyKey(p.id, p.licenseKey)} data-testid={`button-copy-key-${p.id}`}>
                        {copiedId === p.id ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="p-8 text-center space-y-2">
              <Key className="w-8 h-8 mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No license keys sold yet.</p>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

function ProductStockSection({
  product,
  expanded,
  onToggle,
  onDeleteKey,
  deletingKey,
}: {
  product: Product;
  expanded: boolean;
  onToggle: () => void;
  onDeleteKey: (id: number) => void;
  deletingKey: boolean;
}) {
  const { data: stock } = useQuery<KeyStock[]>({
    queryKey: ["/api/admin/keys/stock", product.id],
    queryFn: async () => {
      const res = await fetch(`/api/admin/keys/stock/${product.id}`, { credentials: "include" });
      return res.json();
    },
  });

  const [viewTier, setViewTier] = useState<number | null>(null);

  const { data: tierKeys } = useQuery<StockKey[]>({
    queryKey: ["/api/admin/keys/tier", viewTier],
    queryFn: async () => {
      const res = await fetch(`/api/admin/keys/tier/${viewTier}`, { credentials: "include" });
      return res.json();
    },
    enabled: !!viewTier,
  });

  const getStock = (tierId: number) => stock?.find(s => s.tierId === tierId);
  const totalAvailable = stock?.reduce((sum, s) => sum + Number(s.available), 0) || 0;
  const totalKeys = stock?.reduce((sum, s) => sum + Number(s.total), 0) || 0;

  return (
    <div className="border border-border rounded-lg overflow-hidden" data-testid={`stock-product-${product.id}`}>
      <button
        className="w-full flex items-center justify-between gap-3 px-3 py-2.5 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
        onClick={onToggle}
        data-testid={`button-toggle-stock-${product.id}`}
      >
        <div className="flex items-center gap-2">
          <Package className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold">{product.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={totalAvailable > 0 ? "default" : "destructive"} className="text-[10px]">
            {totalAvailable} available / {totalKeys} total
          </Badge>
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {expanded && (
        <div className="p-3 space-y-2">
          {product.tiers.map(t => {
            const s = getStock(t.id);
            const available = Number(s?.available || 0);
            const total = Number(s?.total || 0);
            const isViewing = viewTier === t.id;

            return (
              <div key={t.id} className="space-y-1">
                <div className="flex items-center justify-between gap-2 px-2 py-1.5 rounded bg-muted/40">
                  <span className="text-xs font-medium">{t.label} - ₹{Number(t.price).toFixed(0)}</span>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={available > 0 ? "outline" : "destructive"}
                      className="text-[10px]"
                    >
                      {available} available
                    </Badge>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-[10px] h-6 px-2"
                      onClick={() => setViewTier(isViewing ? null : t.id)}
                      data-testid={`button-view-keys-${t.id}`}
                    >
                      {isViewing ? "Hide" : "View Keys"}
                    </Button>
                  </div>
                </div>

                {isViewing && tierKeys && (
                  <div className="ml-3 space-y-1">
                    {tierKeys.length === 0 ? (
                      <p className="text-[10px] text-muted-foreground py-1">No keys in stock</p>
                    ) : (
                      tierKeys.map(k => (
                        <div key={k.id} className="flex items-center justify-between gap-2 text-[10px] px-2 py-1 rounded bg-muted/20">
                          <div className="flex items-center gap-2 min-w-0">
                            <Badge
                              variant={k.status === "available" ? "outline" : "secondary"}
                              className="text-[9px] px-1.5"
                            >
                              {k.status}
                            </Badge>
                            <code className="font-mono truncate max-w-[200px]">{k.keyValue}</code>
                          </div>
                          {k.status === "available" && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-5 w-5"
                              onClick={() => onDeleteKey(k.id)}
                              disabled={deletingKey}
                              data-testid={`button-delete-key-${k.id}`}
                            >
                              <Trash2 className="w-3 h-3 text-destructive" />
                            </Button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

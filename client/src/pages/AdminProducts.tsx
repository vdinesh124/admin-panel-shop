import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Pencil, X, Save, Package, Key, ChevronDown, ChevronUp, Upload, Video } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface PricingTier {
  id: number;
  productId: number;
  label: string;
  price: string;
  resellerPrice: string | null;
  sortOrder: number;
}

interface Product {
  id: number;
  name: string;
  description: string;
  features: string[];
  imageUrl: string;
  videoUrl: string | null;
  youtubeUrl: string | null;
  updateUrl: string | null;
  feedbackUrl: string | null;
  category: string;
  status: string;
  sortOrder: number;
  tiers: PricingTier[];
}

interface KeyStock {
  tierId: number;
  total: number;
  available: number;
}

interface LicenseKeyItem {
  id: number;
  tierId: number;
  productId: number;
  keyValue: string;
  status: string;
  soldToUserId: string | null;
  soldAt: string | null;
  createdAt: string;
}

export default function AdminProducts() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [addTierProductId, setAddTierProductId] = useState<number | null>(null);
  const [addKeysState, setAddKeysState] = useState<{ tierId: number; productId: number } | null>(null);
  const [keysText, setKeysText] = useState("");
  const [viewKeysTierId, setViewKeysTierId] = useState<number | null>(null);
  const [expandedStockProduct, setExpandedStockProduct] = useState<number | null>(null);

  const [form, setForm] = useState({ name: "", description: "", features: "", imageUrl: "", videoUrl: "", youtubeUrl: "", updateUrl: "", feedbackUrl: "", category: "mobile", status: "active" });
  const [editForm, setEditForm] = useState({ name: "", description: "", features: "", imageUrl: "", videoUrl: "", youtubeUrl: "", updateUrl: "", feedbackUrl: "", category: "mobile", status: "active" });
  const [tierForm, setTierForm] = useState({ label: "", price: "", resellerPrice: "" });
  const [editingTierId, setEditingTierId] = useState<number | null>(null);
  const [editTierForm, setEditTierForm] = useState({ label: "", price: "", resellerPrice: "" });

  const { data: products, isLoading } = useQuery<Product[]>({
    queryKey: ["/api/admin/products"],
  });

  const createProduct = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/products", {
        name: form.name,
        description: form.description,
        features: form.features.split("\n").filter(Boolean),
        imageUrl: "https://placeholder.co/600x400",
        videoUrl: form.videoUrl || null,
        youtubeUrl: form.youtubeUrl || null,
        updateUrl: form.updateUrl || null,
        feedbackUrl: form.feedbackUrl || null,
        category: form.category,
        status: form.status,
        sortOrder: (products?.length || 0) + 1,
      });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/products"] });
      qc.invalidateQueries({ queryKey: ["/api/products"] });
      setShowAdd(false);
      setForm({ name: "", description: "", features: "", imageUrl: "", videoUrl: "", youtubeUrl: "", updateUrl: "", feedbackUrl: "", category: "mobile", status: "active" });
      toast({ title: "Product created" });
    },
    onError: () => toast({ title: "Failed to create product", variant: "destructive" }),
  });

  const updateProduct = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("PUT", `/api/admin/products/${id}`, {
        name: editForm.name,
        description: editForm.description,
        features: editForm.features.split("\n").filter(Boolean),
        imageUrl: editForm.imageUrl,
        videoUrl: editForm.videoUrl || null,
        youtubeUrl: editForm.youtubeUrl || null,
        updateUrl: editForm.updateUrl || null,
        feedbackUrl: editForm.feedbackUrl || null,
        category: editForm.category,
        status: editForm.status,
      });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/products"] });
      qc.invalidateQueries({ queryKey: ["/api/products"] });
      setEditingId(null);
      toast({ title: "Product updated" });
    },
  });

  const deleteProduct = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/admin/products/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/products"] });
      toast({ title: "Product deleted" });
    },
  });

  const addTier = useMutation({
    mutationFn: async (productId: number) => {
      const payload: any = {
        productId,
        label: tierForm.label,
        price: Number(tierForm.price),
        sortOrder: 0,
      };
      if (tierForm.resellerPrice) payload.resellerPrice = String(Number(tierForm.resellerPrice));
      const res = await apiRequest("POST", "/api/admin/tiers", payload);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/products"] });
      setAddTierProductId(null);
      setTierForm({ label: "", price: "", resellerPrice: "" });
      toast({ title: "Tier added" });
    },
  });

  const updateTier = useMutation({
    mutationFn: async ({ id, label, price, resellerPrice }: { id: number; label: string; price: number; resellerPrice: string }) => {
      const payload: any = { label, price };
      if (resellerPrice) payload.resellerPrice = String(Number(resellerPrice));
      else payload.resellerPrice = null;
      const res = await apiRequest("PUT", `/api/admin/tiers/${id}`, payload);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/products"] });
      qc.invalidateQueries({ queryKey: ["/api/products"] });
      setEditingTierId(null);
      toast({ title: "Tier updated" });
    },
    onError: () => toast({ title: "Failed to update tier", variant: "destructive" }),
  });

  const deleteTier = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/admin/tiers/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/products"] });
      toast({ title: "Tier deleted" });
    },
  });

  const addKeys = useMutation({
    mutationFn: async ({ tierId, productId, keys }: { tierId: number; productId: number; keys: string[] }) => {
      const res = await apiRequest("POST", "/api/admin/keys/add", { tierId, productId, keys });
      return res.json();
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["/api/admin/keys/stock", vars.productId] });
      qc.invalidateQueries({ queryKey: ["/api/admin/keys/tier", vars.tierId] });
      setAddKeysState(null);
      setKeysText("");
      toast({ title: "Keys added to stock" });
    },
    onError: () => toast({ title: "Failed to add keys", variant: "destructive" }),
  });

  const deleteKey = useMutation({
    mutationFn: async ({ id, productId, tierId }: { id: number; productId: number; tierId: number }) => {
      await apiRequest("DELETE", `/api/admin/keys/${id}`);
      return { productId, tierId };
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["/api/admin/keys/stock", data.productId] });
      qc.invalidateQueries({ queryKey: ["/api/admin/keys/tier", data.tierId] });
      toast({ title: "Key deleted" });
    },
  });

  const [uploadingVideo, setUploadingVideo] = useState(false);

  const handleVideoUpload = async (file: File, target: "form" | "editForm") => {
    setUploadingVideo(true);
    try {
      const formData = new FormData();
      formData.append("video", file);
      const res = await fetch("/api/admin/upload-video", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      if (target === "form") {
        setForm((prev) => ({ ...prev, videoUrl: data.videoUrl }));
      } else {
        setEditForm((prev) => ({ ...prev, videoUrl: data.videoUrl }));
      }
      toast({ title: "Video uploaded" });
    } catch {
      toast({ title: "Failed to upload video", variant: "destructive" });
    } finally {
      setUploadingVideo(false);
    }
  };

  const startEdit = (p: Product) => {
    setEditingId(p.id);
    setEditForm({
      name: p.name,
      description: p.description,
      features: p.features.join("\n"),
      imageUrl: p.imageUrl,
      videoUrl: p.videoUrl || "",
      youtubeUrl: p.youtubeUrl || "",
      updateUrl: p.updateUrl || "",
      feedbackUrl: p.feedbackUrl || "",
      category: p.category || "mobile",
      status: p.status,
    });
  };

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-xl font-bold" data-testid="text-admin-products-title">Manage Products</h1>
        <Button onClick={() => setShowAdd(!showAdd)} data-testid="button-add-product">
          <Plus className="w-4 h-4 mr-1" />
          Add Product
        </Button>
      </div>

      {showAdd && (
        <Card className="p-4 space-y-3">
          <h3 className="font-semibold text-sm">New Product</h3>
          <Input placeholder="Product Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="input-product-name" />
          <Input placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} data-testid="input-product-description" />
          <textarea
            className="w-full bg-transparent border border-border rounded-md p-2 text-sm resize-y min-h-[60px]"
            placeholder="Features (one per line)"
            value={form.features}
            onChange={(e) => setForm({ ...form, features: e.target.value })}
            data-testid="input-product-features"
          />
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 cursor-pointer px-3 py-2 border border-border rounded-md hover:bg-muted transition-colors text-sm">
                <Upload className="w-4 h-4" />
                {uploadingVideo ? "Uploading..." : "Upload Video"}
                <input
                  type="file"
                  accept="video/*"
                  className="hidden"
                  disabled={uploadingVideo}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleVideoUpload(f, "form");
                    e.target.value = "";
                  }}
                  data-testid="input-product-video-upload"
                />
              </label>
              {form.videoUrl && (
                <div className="flex items-center gap-1 text-xs text-green-500">
                  <Video className="w-3 h-3" />
                  <span>Video added</span>
                  <button onClick={() => setForm({ ...form, videoUrl: "" })} className="text-destructive/60 hover:text-destructive ml-1">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          </div>
          <Input placeholder="Telegram Channel URL (optional)" value={form.youtubeUrl} onChange={(e) => setForm({ ...form, youtubeUrl: e.target.value })} data-testid="input-product-youtube" />
          <Input placeholder="Update / Join URL (optional)" value={form.updateUrl} onChange={(e) => setForm({ ...form, updateUrl: e.target.value })} data-testid="input-product-update" />
          <Input placeholder="Feedback URL (optional)" value={form.feedbackUrl} onChange={(e) => setForm({ ...form, feedbackUrl: e.target.value })} data-testid="input-product-feedback" />
          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1 block">Category</label>
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="w-full px-3 py-2 rounded-md bg-background border border-border text-sm"
              data-testid="select-product-category"
            >
              <option value="mobile">Mobile Panel</option>
              <option value="pc">PC Panel</option>
            </select>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button onClick={() => createProduct.mutate()} disabled={!form.name || !form.description || createProduct.isPending} data-testid="button-save-product">
              <Save className="w-4 h-4 mr-1" /> Save
            </Button>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
          </div>
        </Card>
      )}

      <div className="space-y-4">
        {products?.map((p) => (
          <ProductCard
            key={p.id}
            product={p}
            editingId={editingId}
            editForm={editForm}
            setEditForm={setEditForm}
            addTierProductId={addTierProductId}
            tierForm={tierForm}
            setTierForm={setTierForm}
            addKeysState={addKeysState}
            keysText={keysText}
            setKeysText={setKeysText}
            viewKeysTierId={viewKeysTierId}
            expandedStockProduct={expandedStockProduct}
            onStartEdit={startEdit}
            onCancelEdit={() => setEditingId(null)}
            onSaveEdit={(id) => updateProduct.mutate(id)}
            onDelete={(id) => deleteProduct.mutate(id)}
            onToggleAddTier={(id) => setAddTierProductId(addTierProductId === id ? null : id)}
            onSaveTier={(productId) => addTier.mutate(productId)}
            onDeleteTier={(id) => deleteTier.mutate(id)}
            editingTierId={editingTierId}
            editTierForm={editTierForm}
            setEditTierForm={setEditTierForm}
            onStartEditTier={(t: PricingTier) => {
              setEditingTierId(t.id);
              setEditTierForm({ label: t.label, price: String(Number(t.price)), resellerPrice: t.resellerPrice ? String(Number(t.resellerPrice)) : "" });
            }}
            onCancelEditTier={() => setEditingTierId(null)}
            onSaveEditTier={(id: number) => {
              updateTier.mutate({ id, label: editTierForm.label, price: Number(editTierForm.price), resellerPrice: editTierForm.resellerPrice });
            }}
            updateTierPending={updateTier.isPending}
            onToggleAddKeys={(tierId, productId) => {
              if (addKeysState?.tierId === tierId) {
                setAddKeysState(null);
                setKeysText("");
              } else {
                setAddKeysState({ tierId, productId });
                setKeysText("");
              }
            }}
            onSaveKeys={() => {
              if (!addKeysState) return;
              const keys = keysText.split("\n").map((k) => k.trim()).filter(Boolean);
              if (keys.length === 0) return;
              addKeys.mutate({ tierId: addKeysState.tierId, productId: addKeysState.productId, keys });
            }}
            addKeysPending={addKeys.isPending}
            onViewKeys={(tierId) => setViewKeysTierId(viewKeysTierId === tierId ? null : tierId)}
            onDeleteKey={(id, productId, tierId) => deleteKey.mutate({ id, productId, tierId })}
            onToggleStock={(productId) => setExpandedStockProduct(expandedStockProduct === productId ? null : productId)}
            updatePending={updateProduct.isPending}
            onVideoUpload={handleVideoUpload}
            uploadingVideo={uploadingVideo}
          />
        ))}
        {(!products || products.length === 0) && (
          <Card className="p-8 text-center space-y-2">
            <Package className="w-8 h-8 mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No products yet. Add your first product above.</p>
          </Card>
        )}
      </div>
    </div>
  );
}

function ProductCard({
  product: p,
  editingId,
  editForm,
  setEditForm,
  addTierProductId,
  tierForm,
  setTierForm,
  addKeysState,
  keysText,
  setKeysText,
  viewKeysTierId,
  expandedStockProduct,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
  onToggleAddTier,
  onSaveTier,
  onDeleteTier,
  editingTierId,
  editTierForm,
  setEditTierForm,
  onStartEditTier,
  onCancelEditTier,
  onSaveEditTier,
  updateTierPending,
  onToggleAddKeys,
  onSaveKeys,
  addKeysPending,
  onViewKeys,
  onDeleteKey,
  onToggleStock,
  updatePending,
  onVideoUpload,
  uploadingVideo,
}: any) {
  const { data: stock } = useQuery<KeyStock[]>({
    queryKey: ["/api/admin/keys/stock", p.id],
    queryFn: async () => {
      const res = await fetch(`/api/admin/keys/stock/${p.id}`, { credentials: "include" });
      return res.json();
    },
  });

  const { data: tierKeys } = useQuery<LicenseKeyItem[]>({
    queryKey: ["/api/admin/keys/tier", viewKeysTierId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/keys/tier/${viewKeysTierId}`, { credentials: "include" });
      return res.json();
    },
    enabled: !!viewKeysTierId && p.tiers.some((t: PricingTier) => t.id === viewKeysTierId),
  });

  const getStock = (tierId: number) => stock?.find((s) => s.tierId === tierId);
  const isExpanded = expandedStockProduct === p.id;

  return (
    <Card className="p-4 space-y-3" data-testid={`card-admin-product-${p.id}`}>
      {editingId === p.id ? (
        <div className="space-y-3">
          <Input value={editForm.name} onChange={(e: any) => setEditForm({ ...editForm, name: e.target.value })} />
          <Input value={editForm.description} onChange={(e: any) => setEditForm({ ...editForm, description: e.target.value })} />
          <textarea
            className="w-full bg-transparent border border-border rounded-md p-2 text-sm resize-y min-h-[60px]"
            value={editForm.features}
            onChange={(e: any) => setEditForm({ ...editForm, features: e.target.value })}
          />
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 cursor-pointer px-3 py-2 border border-border rounded-md hover:bg-muted transition-colors text-sm">
              <Upload className="w-4 h-4" />
              {uploadingVideo ? "Uploading..." : "Upload Video"}
              <input
                type="file"
                accept="video/*"
                className="hidden"
                disabled={uploadingVideo}
                onChange={(e: any) => {
                  const f = e.target.files?.[0];
                  if (f) onVideoUpload(f, "editForm");
                  e.target.value = "";
                }}
              />
            </label>
            {editForm.videoUrl && (
              <div className="flex items-center gap-1 text-xs text-green-500">
                <Video className="w-3 h-3" />
                <span>Video: {editForm.videoUrl.split("/").pop()}</span>
                <button onClick={() => setEditForm({ ...editForm, videoUrl: "" })} className="text-destructive/60 hover:text-destructive ml-1">
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
          <Input value={editForm.youtubeUrl} onChange={(e: any) => setEditForm({ ...editForm, youtubeUrl: e.target.value })} placeholder="Telegram Channel URL (optional)" />
          <Input value={editForm.updateUrl} onChange={(e: any) => setEditForm({ ...editForm, updateUrl: e.target.value })} placeholder="Update / Join URL (optional)" />
          <Input value={editForm.feedbackUrl} onChange={(e: any) => setEditForm({ ...editForm, feedbackUrl: e.target.value })} placeholder="Feedback URL (optional)" />
          <div className="flex gap-2 flex-wrap">
            <select
              className="bg-transparent border border-border rounded-md px-2 py-1 text-sm"
              value={editForm.category}
              onChange={(e: any) => setEditForm({ ...editForm, category: e.target.value })}
            >
              <option value="mobile">Mobile Panel</option>
              <option value="pc">PC Panel</option>
            </select>
            <select
              className="bg-transparent border border-border rounded-md px-2 py-1 text-sm"
              value={editForm.status}
              onChange={(e: any) => setEditForm({ ...editForm, status: e.target.value })}
            >
              <option value="active">Active</option>
              <option value="draft">Draft</option>
            </select>
            <Button onClick={() => onSaveEdit(p.id)} disabled={updatePending}>
              <Save className="w-4 h-4 mr-1" /> Save
            </Button>
            <Button variant="outline" onClick={onCancelEdit}>
              <X className="w-4 h-4 mr-1" /> Cancel
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-12 h-12 rounded-md bg-muted overflow-hidden flex-shrink-0 flex items-center justify-center">
                {p.videoUrl ? (
                  <Video className="w-6 h-6 text-cyan-500/70" />
                ) : (
                  <Package className="w-6 h-6 text-muted-foreground" />
                )}
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold text-sm truncate" data-testid={`text-product-name-${p.id}`}>{p.name}</h3>
                <p className="text-xs text-muted-foreground truncate">{p.description}</p>
              </div>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <Badge variant={p.status === "active" ? "default" : "secondary"} className="text-[10px]">
                {p.status}
              </Badge>
              <Button size="icon" variant="ghost" onClick={() => onStartEdit(p)} data-testid={`button-edit-product-${p.id}`}>
                <Pencil className="w-3.5 h-3.5" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => onDelete(p.id)} data-testid={`button-delete-product-${p.id}`}>
                <Trash2 className="w-3.5 h-3.5 text-destructive" />
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pricing Tiers</p>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onToggleStock(p.id)}
                  data-testid={`button-toggle-stock-${p.id}`}
                >
                  <Key className="w-3 h-3 mr-1" />
                  Stock
                  {isExpanded ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onToggleAddTier(p.id)}
                  data-testid={`button-add-tier-${p.id}`}
                >
                  <Plus className="w-3 h-3 mr-1" /> Add Tier
                </Button>
              </div>
            </div>
            {addTierProductId === p.id && (
              <div className="space-y-2 bg-muted/20 rounded-md p-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Input
                    placeholder="Label (e.g. 7 Days)"
                    value={tierForm.label}
                    onChange={(e: any) => setTierForm({ ...tierForm, label: e.target.value })}
                    className="flex-1 min-w-[120px]"
                    data-testid="input-tier-label"
                  />
                  <Input
                    placeholder="Price ₹"
                    type="number"
                    value={tierForm.price}
                    onChange={(e: any) => setTierForm({ ...tierForm, price: e.target.value })}
                    className="w-24"
                    data-testid="input-tier-price"
                  />
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1 flex-1 min-w-[140px]">
                    <span className="text-xs text-amber-400 font-semibold whitespace-nowrap">Reseller ₹</span>
                    <Input
                      placeholder="Optional"
                      type="number"
                      value={tierForm.resellerPrice}
                      onChange={(e: any) => setTierForm({ ...tierForm, resellerPrice: e.target.value })}
                      className="w-24"
                      data-testid="input-tier-reseller-price"
                    />
                  </div>
                  <Button size="sm" onClick={() => onSaveTier(p.id)} disabled={!tierForm.label || !tierForm.price} data-testid="button-save-tier">
                    Save
                  </Button>
                </div>
              </div>
            )}
            <div className="space-y-1.5">
              {p.tiers.map((t: PricingTier) => {
                const s = getStock(t.id);
                const isEditingThis = editingTierId === t.id;
                return isEditingThis ? (
                  <div key={t.id} className="bg-muted/30 rounded-md px-2 py-2 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Input
                        value={editTierForm.label}
                        onChange={(e: any) => setEditTierForm({ ...editTierForm, label: e.target.value })}
                        className="flex-1 min-w-[100px] h-7 text-xs"
                        placeholder="Label"
                        data-testid={`input-edit-tier-label-${t.id}`}
                      />
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-muted-foreground">₹</span>
                        <Input
                          type="number"
                          value={editTierForm.price}
                          onChange={(e: any) => setEditTierForm({ ...editTierForm, price: e.target.value })}
                          className="w-20 h-7 text-xs"
                          placeholder="Price"
                          data-testid={`input-edit-tier-price-${t.id}`}
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex items-center gap-1 flex-1 min-w-[140px]">
                        <span className="text-xs text-amber-400 font-semibold whitespace-nowrap">Reseller ₹</span>
                        <Input
                          type="number"
                          value={editTierForm.resellerPrice}
                          onChange={(e: any) => setEditTierForm({ ...editTierForm, resellerPrice: e.target.value })}
                          className="w-24 h-7 text-xs"
                          placeholder="Leave empty = no reseller"
                          data-testid={`input-edit-tier-reseller-price-${t.id}`}
                        />
                      </div>
                      <Button size="sm" className="h-7 text-[10px] px-2" onClick={() => onSaveEditTier(t.id)} disabled={!editTierForm.label || !editTierForm.price || updateTierPending} data-testid={`button-save-edit-tier-${t.id}`}>
                        <Save className="w-3 h-3 mr-1" /> Save
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 text-[10px] px-2" onClick={onCancelEditTier}>
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div key={t.id} className="flex items-center gap-1 bg-muted/50 rounded-md px-2 py-1 text-xs">
                    <span>{t.label}</span>
                    <span className="font-semibold">₹{Number(t.price).toFixed(0)}</span>
                    {t.resellerPrice && (
                      <span className="text-amber-400 font-semibold ml-1">R₹{Number(t.resellerPrice).toFixed(0)}</span>
                    )}
                    {s && (
                      <Badge variant="secondary" className="text-[9px] ml-1 no-default-active-elevate">
                        {s.available}/{s.total}
                      </Badge>
                    )}
                    <button onClick={() => onStartEditTier(t)} className="ml-1 text-muted-foreground hover:text-foreground" data-testid={`button-edit-tier-${t.id}`}>
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button onClick={() => onDeleteTier(t.id)} className="ml-0.5 text-destructive/60 hover:text-destructive" data-testid={`button-delete-tier-${t.id}`}>
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
              {p.tiers.length === 0 && <p className="text-xs text-muted-foreground">No tiers yet</p>}
            </div>
          </div>

          {isExpanded && (
            <div className="space-y-3 border-t border-border pt-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <Key className="w-3 h-3" /> License Key Stock
              </p>
              {p.tiers.map((t: PricingTier) => {
                const s = getStock(t.id);
                const isAddingKeys = addKeysState?.tierId === t.id;
                const isViewingKeys = viewKeysTierId === t.id;
                return (
                  <div key={t.id} className="space-y-2">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{t.label}</span>
                        <Badge variant="secondary" className="text-[10px] no-default-active-elevate">
                          {s ? `${s.available} available / ${s.total} total` : "0 keys"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onViewKeys(t.id)}
                          data-testid={`button-view-keys-${t.id}`}
                        >
                          {isViewingKeys ? "Hide" : "View"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onToggleAddKeys(t.id, p.id)}
                          data-testid={`button-add-keys-${t.id}`}
                        >
                          <Plus className="w-3 h-3 mr-1" /> Add Keys
                        </Button>
                      </div>
                    </div>

                    {isAddingKeys && (
                      <div className="space-y-2 pl-2 border-l-2 border-primary/30">
                        <textarea
                          className="w-full bg-transparent border border-border rounded-md p-2 text-xs font-mono resize-y min-h-[80px]"
                          placeholder="Paste license keys here (one per line)"
                          value={keysText}
                          onChange={(e) => setKeysText(e.target.value)}
                          data-testid={`input-keys-text-${t.id}`}
                        />
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            onClick={onSaveKeys}
                            disabled={!keysText.trim() || addKeysPending}
                            data-testid={`button-save-keys-${t.id}`}
                          >
                            <Save className="w-3 h-3 mr-1" />
                            {addKeysPending ? "Adding..." : `Add ${keysText.split("\n").filter((l: string) => l.trim()).length} Keys`}
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => onToggleAddKeys(t.id, p.id)}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}

                    {isViewingKeys && tierKeys && (
                      <div className="space-y-1 pl-2 border-l-2 border-muted max-h-[200px] overflow-y-auto">
                        {tierKeys.length === 0 && (
                          <p className="text-xs text-muted-foreground py-1">No keys in stock</p>
                        )}
                        {tierKeys.map((k: LicenseKeyItem) => (
                          <div key={k.id} className="flex items-center justify-between gap-2 text-xs py-0.5" data-testid={`key-item-${k.id}`}>
                            <code className="font-mono text-[11px] truncate flex-1 min-w-0">{k.keyValue}</code>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <Badge
                                variant={k.status === "available" ? "default" : "secondary"}
                                className="text-[9px] no-default-active-elevate"
                              >
                                {k.status}
                              </Badge>
                              {k.status === "available" && (
                                <button
                                  onClick={() => onDeleteKey(k.id, p.id, t.id)}
                                  className="text-destructive/60 hover:text-destructive"
                                  data-testid={`button-delete-key-${k.id}`}
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              {p.tiers.length === 0 && (
                <p className="text-xs text-muted-foreground">Add pricing tiers first, then add keys to each tier.</p>
              )}
            </div>
          )}
        </>
      )}
    </Card>
  );
}
